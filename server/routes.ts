import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { authStorage } from "./replit_integrations/auth";
import { insertExpenseSchema, insertCommentSchema, insertUserSchema, insertExpenseAttachmentSchema, roleEnum, statusEnum, type ExpenseStatus, poStatusEnum, insertPurchaseOrderSchema, insertPoCommentSchema, insertPoAttachmentSchema } from "@shared/schema";
import { z } from "zod";
import { scanReceiptImage } from "./receipt-ocr";
import { sendEmail, buildExpenseSubmittedEmail, buildStatusChangeEmail, buildCommentEmail, buildApprovalNeededEmail } from "./email";
import { sendWebexDirectMessage, buildWebexExpenseSubmitted, buildWebexStatusChange, buildWebexComment, buildWebexApprovalNeeded } from "./webex";
import {
  isQuickbooksConfigured, getAuthorizationUrl, exchangeCodeForTokens,
  revokeToken, createBillForExpense, syncPendingBills,
  createBillForPurchaseOrder, createExpenseForPurchaseOrder
} from "./quickbooks";
import crypto from "crypto";

function sanitizeUser(user: any) {
  const { oidcId, ...safe } = user;
  return safe;
}

function getOidcUserId(req: any): string | null {
  return req.user?.claims?.sub || null;
}

async function getAppUser(req: any) {
  if ((req as any)._cachedAppUser !== undefined) return (req as any)._cachedAppUser;
  let user;
  if (process.env.BYPASS_AUTH === "true") {
    user = await authStorage.getUserByEmail("mpapa@aseva.com");
  } else {
    const oidcId = getOidcUserId(req);
    if (!oidcId) { (req as any)._cachedAppUser = null; return null; }
    user = await authStorage.getUserByOidcId(oidcId);
  }
  (req as any)._cachedAppUser = user || null;
  return user || null;
}

function getAllSubordinateIds(userId: string, allUsers: any[]): string[] {
  const childrenMap = new Map<string, string[]>();
  for (const u of allUsers) {
    if (u.managerId) {
      let children = childrenMap.get(u.managerId);
      if (!children) { children = []; childrenMap.set(u.managerId, children); }
      children.push(u.id);
    }
  }
  const subordinates: string[] = [];
  // `seen` also guards against reporting cycles (A manages B, B manages A).
  // Without it this loop never terminates, and because it is synchronous it
  // blocks the event loop and takes the whole process down, not just one request.
  const seen = new Set<string>([userId]);
  const queue = [...(childrenMap.get(userId) || [])];
  let i = 0;
  while (i < queue.length) {
    const current = queue[i++];
    if (seen.has(current)) continue;
    seen.add(current);
    subordinates.push(current);
    const children = childrenMap.get(current);
    if (children) queue.push(...children);
  }
  return subordinates;
}

/** Walks up the reporting line from `user`. Cycle-safe: a loop in the manager
 *  graph would otherwise spin forever, re-querying the same rows. */
async function buildManagerChain(user: any): Promise<any[]> {
  const chain: any[] = [];
  const seen = new Set<string>([user.id]);
  let current = user;
  while (current?.managerId && !seen.has(current.managerId)) {
    seen.add(current.managerId);
    const mgr = await storage.getUser(current.managerId);
    if (!mgr) break;
    chain.push(mgr);
    current = mgr;
  }
  return chain;
}

async function requireAuth(req: any, res: any, next: any) {
  if (process.env.BYPASS_AUTH === "true") return next();
  const appUser = await getAppUser(req);
  if (!appUser) return res.status(401).json({ message: "Not authenticated" });
  (req as any).appUser = appUser;
  next();
}

async function requireAdmin(req: any, res: any, next: any) {
  if (process.env.BYPASS_AUTH === "true") return next();
  const appUser = (req as any).appUser || await getAppUser(req);
  if (!appUser) return res.status(401).json({ message: "Not authenticated" });
  if (!appUser.isAdmin) return res.status(403).json({ message: "Admin access required" });
  next();
}

async function requireSelfOrAdmin(req: any, res: any, next: any) {
  if (process.env.BYPASS_AUTH === "true") return next();
  const appUser = await getAppUser(req);
  if (!appUser) return res.status(401).json({ message: "Not authenticated" });
  if (appUser.isAdmin || appUser.id === req.params.id) return next();
  return res.status(403).json({ message: "Access denied" });
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  app.get("/api/users", requireAuth, async (_req, res) => {
    const users = await storage.getUsers();
    res.json(users.map(sanitizeUser));
  });

  app.get("/api/users/:id", requireAuth, async (req, res) => {
    const user = await storage.getUser(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(sanitizeUser(user));
  });

  app.post("/api/users", requireAdmin, async (req, res) => {
    const parsed = insertUserSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const user = await storage.createUser(parsed.data);
    res.status(201).json(sanitizeUser(user));
  });

  app.delete("/api/users/:id", requireAdmin, async (req, res) => {
    try {
      const appUser = (req as any).appUser || await getAppUser(req);
      if (appUser && appUser.id === req.params.id) {
        return res.status(400).json({ message: "You cannot delete your own account." });
      }
      const directReports = await storage.getDirectReports(req.params.id);
      if (directReports.length > 0) {
        return res.status(409).json({
          message: "This user has direct reports. Please reassign them to a new manager before deleting.",
          directReports: directReports.map(sanitizeUser),
        });
      }
      const deleted = await storage.deleteUser(req.params.id);
      if (!deleted) return res.status(404).json({ message: "User not found" });
      res.json({ message: "User deleted successfully" });
    } catch (error: any) {
      if (error.code === '23503') {
        return res.status(400).json({ message: "Cannot delete this user because they have associated expenses, comments, or other records." });
      }
      res.status(500).json({ message: "Failed to delete user" });
    }
  });

  app.post("/api/users/:id/reassign-reports", requireAdmin, async (req, res) => {
    try {
      const { newManagerId } = req.body;
      if (!newManagerId || typeof newManagerId !== "string") {
        return res.status(400).json({ message: "newManagerId is required" });
      }
      const newManager = await storage.getUser(newManagerId);
      if (!newManager) {
        return res.status(404).json({ message: "New manager not found" });
      }
      const directReports = await storage.getDirectReports(req.params.id);
      if (directReports.length === 0) {
        return res.json({ message: "No direct reports to reassign", reassigned: 0 });
      }
      for (const report of directReports) {
        await storage.updateUserManager(report.id, newManagerId);
      }
      res.json({ message: `Reassigned ${directReports.length} direct report(s)`, reassigned: directReports.length });
    } catch (error: any) {
      res.status(500).json({ message: "Failed to reassign direct reports" });
    }
  });

  app.patch("/api/users/:id/role", requireAdmin, async (req, res) => {
    const { role } = req.body;
    const parsed = roleEnum.safeParse(role);
    if (!parsed.success) return res.status(400).json({ message: "Invalid role" });
    const user = await storage.updateUserRole(req.params.id, parsed.data);
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(sanitizeUser(user));
  });

  app.patch("/api/users/:id/admin", requireAdmin, async (req, res) => {
    const { isAdmin } = req.body;
    if (typeof isAdmin !== "boolean") return res.status(400).json({ message: "isAdmin must be a boolean" });
    const user = await storage.updateUserAdmin(req.params.id, isAdmin);
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(sanitizeUser(user));
  });

  app.patch("/api/users/:id/accounts-payable", requireAdmin, async (req, res) => {
    const { isAccountsPayable } = req.body;
    if (typeof isAccountsPayable !== "boolean") return res.status(400).json({ message: "isAccountsPayable must be a boolean" });
    const user = await storage.updateUserAccountsPayable(req.params.id, isAccountsPayable);
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(sanitizeUser(user));
  });

  app.patch("/api/users/:id/po-admin", requireAdmin, async (req, res) => {
    const { isPOAdmin } = req.body;
    if (typeof isPOAdmin !== "boolean") return res.status(400).json({ message: "isPOAdmin must be a boolean" });
    const user = await storage.updateUserPOAdmin(req.params.id, isPOAdmin);
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(sanitizeUser(user));
  });

  app.patch("/api/users/:id/manager", requireAdmin, async (req, res) => {
    const { managerId } = req.body;
    if (managerId !== null && typeof managerId !== "string") {
      return res.status(400).json({ message: "managerId must be a string or null" });
    }
    // A cycle in the reporting graph makes the org-chart walks spin forever,
    // so reject it here rather than letting it get written.
    if (managerId !== null) {
      if (managerId === req.params.id) {
        return res.status(400).json({ message: "A user cannot be their own manager" });
      }
      const proposedManager = await storage.getUser(managerId);
      if (!proposedManager) return res.status(404).json({ message: "Manager not found" });
      const chain = await buildManagerChain(proposedManager);
      if (proposedManager.id === req.params.id || chain.some(m => m.id === req.params.id)) {
        return res.status(400).json({ message: "That change would create a reporting cycle" });
      }
    }
    const user = await storage.updateUserManager(req.params.id, managerId);
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(sanitizeUser(user));
  });

  app.patch("/api/users/:id/department", requireAdmin, async (req, res) => {
    const { department } = req.body;
    if (department !== null && typeof department !== "string") {
      return res.status(400).json({ message: "department must be a string or null" });
    }
    const user = await storage.updateUserDepartment(req.params.id, department);
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(sanitizeUser(user));
  });

  app.patch("/api/users/:id/profile", requireSelfOrAdmin, async (req, res) => {
    const { name, email } = req.body;
    if (typeof name !== "string" || typeof email !== "string") {
      return res.status(400).json({ message: "name and email are required" });
    }
    // Trim before the emptiness check: "   " is truthy, and letting it through
    // blanked the user's name and initials outright.
    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    if (!trimmedName) return res.status(400).json({ message: "name is required" });
    if (!trimmedEmail) return res.status(400).json({ message: "email is required" });
    const nameParts = trimmedName.split(/\s+/);
    const avatarInitials = nameParts.length >= 2
      ? (nameParts[0][0] + nameParts[nameParts.length - 1][0]).toUpperCase()
      : trimmedName.slice(0, 2).toUpperCase();
    const user = await storage.updateUserProfile(req.params.id, { name: trimmedName, email: trimmedEmail, avatarInitials });
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(sanitizeUser(user));
  });

  app.patch("/api/users/:id/profile-picture", requireSelfOrAdmin, async (req, res) => {
    const { profilePicture } = req.body;
    if (profilePicture !== null && typeof profilePicture !== "string") {
      return res.status(400).json({ message: "profilePicture must be a string or null" });
    }
    if (profilePicture && profilePicture.length > 3 * 1024 * 1024) {
      return res.status(400).json({ message: "Image too large. Please use an image under 2MB." });
    }
    const user = await storage.updateUserProfilePicture(req.params.id, profilePicture);
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(sanitizeUser(user));
  });

  app.patch("/api/users/:id/notification-prefs", requireSelfOrAdmin, async (req, res) => {
    const { notifyEmail, notifyText, notifyWebex, phoneNumber } = req.body;
    if (typeof notifyEmail !== "boolean" || typeof notifyText !== "boolean") {
      return res.status(400).json({ message: "notifyEmail and notifyText must be booleans" });
    }
    if (phoneNumber !== null && phoneNumber !== undefined && typeof phoneNumber !== "string") {
      return res.status(400).json({ message: "phoneNumber must be a string or null" });
    }
    const user = await storage.updateUserNotificationPrefs(req.params.id, {
      notifyEmail,
      notifyText,
      notifyWebex: typeof notifyWebex === "boolean" ? notifyWebex : false,
      phoneNumber: phoneNumber || null,
    });
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(sanitizeUser(user));
  });

  app.get("/api/users/:id/direct-reports", async (req, res) => {
    const reports = await storage.getDirectReports(req.params.id);
    res.json(reports.map(sanitizeUser));
  });

  app.get("/api/expenses", async (req, res) => {
    const { status, employeeId, viewAsUserId } = req.query;

    const appUser = await getAppUser(req);

    let filterUser = appUser;
    if (viewAsUserId && typeof viewAsUserId === "string" && appUser?.isAdmin) {
      const targetUser = await storage.getUser(viewAsUserId);
      if (targetUser) filterUser = targetUser;
    }

    const filters: import("./storage").ExpenseFilters = {};

    if (status && typeof status === "string") {
      filters.statuses = [status];
    }
    if (employeeId && typeof employeeId === "string") {
      filters.employeeIds = [employeeId];
    }

    if (filterUser && !(filterUser.isAdmin && !viewAsUserId)) {
      const allUsers = await storage.getUsers();
      const subordinateIds = getAllSubordinateIds(filterUser.id, allUsers);
      const visibleIds = [filterUser.id, ...subordinateIds];
      if (filters.employeeIds) {
        filters.employeeIds = filters.employeeIds.filter(id => visibleIds.includes(id));
        if (filters.employeeIds.length === 0) return res.json([]);
      } else {
        filters.employeeIds = visibleIds;
      }
    }

    const expenses = await storage.getExpensesFiltered(filters);
    res.json(expenses);
  });

  app.get("/api/expenses/report", async (req, res) => {
    const { scope, dateFrom, dateTo, category, employeeId, viewAsUserId } = req.query;

    const appUser = await getAppUser(req);
    if (!appUser) return res.status(401).json({ message: "Not authenticated" });

    let filterUser = appUser;
    if (viewAsUserId && typeof viewAsUserId === "string" && appUser.isAdmin) {
      const targetUser = await storage.getUser(viewAsUserId);
      if (targetUser) filterUser = targetUser;
    }

    const isFilterUserAdmin = filterUser.isAdmin;
    const isFilterUserManager = filterUser.role === "Manager" || filterUser.role === "General Manager" || filterUser.role === "Executive Chairman";

    const maxAllowedScope = isFilterUserAdmin ? "everyone" : isFilterUserManager ? "team" : "mine";
    const scopeOrder: Record<string, number> = { mine: 0, team: 1, everyone: 2 };
    const requestedScope = (typeof scope === "string" && scopeOrder[scope] !== undefined) ? scope : maxAllowedScope;
    const effectiveScope = scopeOrder[requestedScope] <= scopeOrder[maxAllowedScope] ? requestedScope : maxAllowedScope;

    const filters: import("./storage").ExpenseFilters = {};

    if (effectiveScope === "mine") {
      filters.employeeIds = [filterUser.id];
    } else if (effectiveScope === "team") {
      const allUsers = await storage.getUsers();
      const subordinateIds = getAllSubordinateIds(filterUser.id, allUsers);
      filters.employeeIds = [filterUser.id, ...subordinateIds];
    }

    if (employeeId && typeof employeeId === "string" && employeeId !== "all") {
      if (filters.employeeIds) {
        filters.employeeIds = filters.employeeIds.filter(id => id === employeeId);
        if (filters.employeeIds.length === 0) return res.json([]);
      } else {
        filters.employeeIds = [employeeId];
      }
    }

    if (dateFrom && typeof dateFrom === "string") filters.dateFrom = dateFrom;
    if (dateTo && typeof dateTo === "string") filters.dateTo = dateTo;
    if (category && typeof category === "string" && category !== "all") {
      filters.categories = category.split(",");
    }

    const expenses = await storage.getExpensesFiltered(filters);
    res.json(expenses);
  });

  app.get("/api/expenses/export/csv", async (req, res) => {
    const { status, dateFrom, dateTo, category, viewAsUserId, amountMin, amountMax, search, scope, employeeId: filterEmployeeId } = req.query;

    const appUser = await getAppUser(req);
    if (!appUser) return res.status(401).json({ message: "Not authenticated" });

    let filterUser = appUser;
    if (viewAsUserId && typeof viewAsUserId === "string" && appUser.isAdmin) {
      const targetUser = await storage.getUser(viewAsUserId);
      if (targetUser) filterUser = targetUser;
    }

    const isExportUserAdmin = filterUser.isAdmin;
    const isExportUserManager = filterUser.role === "Manager" || filterUser.role === "General Manager" || filterUser.role === "Executive Chairman";
    const maxExportScope = isExportUserAdmin ? "everyone" : isExportUserManager ? "team" : "mine";
    const exportScopeOrder: Record<string, number> = { mine: 0, team: 1, everyone: 2 };
    const requestedExportScope = (typeof scope === "string" && exportScopeOrder[scope] !== undefined) ? scope : maxExportScope;
    const effectiveExportScope = exportScopeOrder[requestedExportScope] <= exportScopeOrder[maxExportScope] ? requestedExportScope : maxExportScope;

    const filters: import("./storage").ExpenseFilters = {};

    if (effectiveExportScope === "mine") {
      filters.employeeIds = [filterUser.id];
    } else if (effectiveExportScope === "team") {
      const allUsers = await storage.getUsers();
      const subordinateIds = getAllSubordinateIds(filterUser.id, allUsers);
      filters.employeeIds = [filterUser.id, ...subordinateIds];
    }

    if (filterEmployeeId && typeof filterEmployeeId === "string" && filterEmployeeId !== "all") {
      if (filters.employeeIds) {
        filters.employeeIds = filters.employeeIds.filter(id => id === filterEmployeeId);
        if (filters.employeeIds.length === 0) {
          res.setHeader("Content-Type", "text/csv");
          res.setHeader("Content-Disposition", `attachment; filename=expenses-export-${new Date().toISOString().split("T")[0]}.csv`);
          return res.send("Date,Description,Category,Amount,Status,Employee,Miles,Notes");
        }
      } else {
        filters.employeeIds = [filterEmployeeId];
      }
    }

    if (status) {
      filters.statuses = Array.isArray(status) ? status as string[] : [status as string];
    }
    if (dateFrom && typeof dateFrom === "string") filters.dateFrom = dateFrom;
    if (dateTo && typeof dateTo === "string") filters.dateTo = dateTo;
    if (category && typeof category === "string") filters.categories = category.split(",");
    if (amountMin && typeof amountMin === "string") {
      const min = parseFloat(amountMin);
      if (!isNaN(min)) filters.amountMin = min;
    }
    if (amountMax && typeof amountMax === "string") {
      const max = parseFloat(amountMax);
      if (!isNaN(max)) filters.amountMax = max;
    }
    if (search && typeof search === "string") filters.search = search;

    const expenses = await storage.getExpensesFiltered(filters);

    const csvHeaders = ["Date", "Description", "Category", "Amount", "Status", "Employee", "Miles", "Notes"];
    const escapeCsv = (val: string) => {
      if (val.includes(",") || val.includes('"') || val.includes("\n")) {
        return `"${val.replace(/"/g, '""')}"`;
      }
      return val;
    };
    const csvRows = expenses.map((e: any) => [
      escapeCsv(e.date || ""),
      escapeCsv(e.description || ""),
      escapeCsv(e.category || ""),
      escapeCsv(parseFloat(e.amount).toFixed(2)),
      escapeCsv(e.status || ""),
      escapeCsv(e.employeeName || ""),
      escapeCsv(e.miles ? parseFloat(e.miles).toFixed(1) : ""),
      escapeCsv(e.notes || ""),
    ].join(","));

    const csv = [csvHeaders.join(","), ...csvRows].join("\n");
    const today = new Date().toISOString().split("T")[0];

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename=expenses-export-${today}.csv`);
    res.send(csv);
  });

  app.get("/api/expenses/:id", async (req, res) => {
    const expense = await storage.getExpense(req.params.id);
    if (!expense) return res.status(404).json({ message: "Expense not found" });
    res.json(expense);
  });

  app.post("/api/expenses", async (req, res) => {
    const parsed = insertExpenseSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });

    // Without this an unknown id trips the employee_id foreign key, which the
    // error handler reported as a 500 rather than a bad request.
    const employee = await storage.getUser(parsed.data.employeeId);
    if (!employee) return res.status(400).json({ message: "Unknown employeeId" });

    const expense = await storage.createExpense(parsed.data);

    try {
      await storage.createExpenseHistory({
        expenseId: expense.id,
        action: "created",
        fromStatus: null,
        toStatus: expense.status,
        changedBy: expense.employeeName,
        details: `Expense created for $${expense.amount}`,
      });
    } catch (e) {
      console.error("Failed to log expense history:", e);
    }

    if (expense.status === "Submitted") {
      try {
        const submitter = await storage.getUser(expense.employeeId);
        if (submitter?.managerId) {
          await storage.createNotification({
            userId: submitter.managerId,
            type: "new_expense",
            title: "New Expense to Review",
            message: `${expense.employeeName} submitted "${expense.description}" ($${expense.amount}) for your approval`,
            expenseId: expense.id,
            isRead: false,
          });

          const manager = await storage.getUser(submitter.managerId);
          if (manager?.notifyEmail && manager.email) {
            const emailData = buildExpenseSubmittedEmail({
              employeeName: expense.employeeName,
              description: expense.description,
              amount: expense.amount,
              category: expense.category,
              date: expense.date,
              expenseId: expense.id,
            });
            sendEmail({ to: manager.email, ...emailData }).catch(e => console.error("[email] Error:", e));
          }
          if (manager?.notifyWebex && manager?.email) {
            const webexMsg = buildWebexExpenseSubmitted({
              employeeName: expense.employeeName,
              description: expense.description,
              amount: expense.amount,
              category: expense.category,
              date: expense.date,
              notes: expense.notes,
              expenseId: expense.id,
            });
            sendWebexDirectMessage(manager.email, webexMsg).catch(e => console.error("[webex] Error:", e));
          }
        }
      } catch (e) {
        console.error("Failed to create notification:", e);
      }
    }

    res.status(201).json(expense);
  });

  app.patch("/api/expenses/:id/status", async (req, res) => {
    const { status, userId } = req.body;
    const parsed = statusEnum.safeParse(status);
    if (!parsed.success) return res.status(400).json({ message: "Invalid status" });

    const expense = await storage.getExpense(req.params.id);
    if (!expense) return res.status(404).json({ message: "Expense not found" });

    if (status === "Cancelled") {
      if (!userId || expense.employeeId !== userId) {
        return res.status(403).json({ message: "Only the submitter can cancel their own expense" });
      }
      if (expense.status === "Reimbursed" || expense.status === "Cancelled") {
        return res.status(400).json({ message: "Cannot cancel an expense that is already reimbursed or cancelled" });
      }
    }

    const oldStatus = expense.status;
    const updated = await storage.updateExpenseStatus(req.params.id, parsed.data);

    if (updated) {
      const newStatus = parsed.data as ExpenseStatus;
      const appUser = await getAppUser(req);

      try {
        const changerName = appUser?.name || "System";
        await storage.createExpenseHistory({
          expenseId: expense.id,
          action: "status_change",
          fromStatus: oldStatus,
          toStatus: newStatus,
          changedBy: changerName,
          details: `Status changed from ${oldStatus} to ${newStatus}`,
        });
      } catch (e) {
        console.error("Failed to log expense history:", e);
      }
      const isRejection = newStatus.includes("Rejected");
      const isApproval = newStatus.includes("Approved") || newStatus === "Reimbursed";

      if ((isApproval || isRejection) && expense.employeeId !== appUser?.id) {
        const title = isRejection ? "Expense Rejected" : newStatus === "Reimbursed" ? "Expense Reimbursed" : "Expense Approved";
        const message = `Your expense "${expense.description}" ($${expense.amount}) has been ${isRejection ? "rejected" : newStatus === "Reimbursed" ? "reimbursed" : "approved"} — status: ${newStatus}`;
        try {
          await storage.createNotification({
            userId: expense.employeeId,
            type: isRejection ? "rejection" : "approval",
            title,
            message,
            expenseId: expense.id,
            isRead: false,
          });

          const submitter = await storage.getUser(expense.employeeId);
          const rejectionNote = isRejection ? (req.body.rejectionNote || undefined) : undefined;
          if (submitter?.notifyEmail && submitter.email) {
            const emailData = buildStatusChangeEmail({
              employeeName: expense.employeeName,
              description: expense.description,
              amount: expense.amount,
              newStatus,
              rejectionNote,
              expenseId: expense.id,
            });
            sendEmail({ to: submitter.email, ...emailData }).catch(e => console.error("[email] Error:", e));
          }
          if (submitter?.notifyWebex && submitter?.email) {
            const webexMsg = buildWebexStatusChange({
              description: expense.description,
              amount: expense.amount,
              newStatus,
              rejectionNote,
              notes: expense.notes,
              expenseId: expense.id,
            });
            sendWebexDirectMessage(submitter.email, webexMsg).catch(e => console.error("[webex] Error:", e));
          }
        } catch (e) {
          console.error("Failed to create notification:", e);
        }
      }

      if (newStatus === "Submitted") {
        try {
          const submitter = await storage.getUser(expense.employeeId);
          if (submitter?.managerId && submitter.managerId !== appUser?.id) {
            await storage.createNotification({
              userId: submitter.managerId,
              type: "new_expense",
              title: "New Expense to Review",
              message: `${expense.employeeName} submitted "${expense.description}" ($${expense.amount}) for your approval`,
              expenseId: expense.id,
              isRead: false,
            });
          }
          if (submitter?.managerId) {
            const manager = await storage.getUser(submitter.managerId);
            if (manager?.notifyEmail && manager.email) {
              const emailData = buildExpenseSubmittedEmail({
                employeeName: expense.employeeName,
                description: expense.description,
                amount: expense.amount,
                category: expense.category,
                date: expense.date,
                expenseId: expense.id,
              });
              sendEmail({ to: manager.email, ...emailData }).catch(e => console.error("[email] Error:", e));
            }
            if (manager?.notifyWebex && manager?.email) {
              const webexMsg = buildWebexExpenseSubmitted({
                employeeName: expense.employeeName,
                description: expense.description,
                amount: expense.amount,
                category: expense.category,
                date: expense.date,
                notes: expense.notes,
                expenseId: expense.id,
              });
              sendWebexDirectMessage(manager.email, webexMsg).catch(e => console.error("[webex] Error:", e));
            }
          }
        } catch (e) {
          console.error("Failed to create notification:", e);
        }
      }

      if (newStatus === "GM Approved" || newStatus === "EC Approved") {
        createBillForExpense(expense).catch(e => console.error("[quickbooks] Bill creation error:", e));
      }

      if (newStatus === "Manager Approved" || newStatus === "GM Approved" || newStatus === "EC Approved") {
        try {
          const submitter = await storage.getUser(expense.employeeId);
          if (submitter?.managerId) {
            const managerChain = await buildManagerChain(submitter);

            let nextApprover = null;
            if (newStatus === "Manager Approved") {
              nextApprover = managerChain.find(m => m.role === "General Manager" || m.role === "Executive Chairman");
            } else if (newStatus === "GM Approved") {
              nextApprover = managerChain.find(m => m.role === "Executive Chairman");
            }

            const stage = newStatus === "Manager Approved" ? "GM Review" : "Executive Chairman Review";

            if (nextApprover && nextApprover.id !== appUser?.id) {
              await storage.createNotification({
                userId: nextApprover.id,
                type: "approval_needed",
                title: "Expense Awaiting Your Approval",
                message: `${expense.employeeName}'s expense "${expense.description}" ($${expense.amount}) needs your review (${stage})`,
                expenseId: expense.id,
                isRead: false,
              });
            }

            if (nextApprover?.notifyEmail && nextApprover.email) {
              const emailData = buildApprovalNeededEmail({
                approverName: nextApprover.name,
                employeeName: expense.employeeName,
                description: expense.description,
                amount: expense.amount,
                stage,
                expenseId: expense.id,
              });
              sendEmail({ to: nextApprover.email, ...emailData }).catch(e => console.error("[email] Error:", e));
            }
            if (nextApprover?.notifyWebex && nextApprover?.email) {
              const webexMsg = buildWebexApprovalNeeded({
                approverName: nextApprover.name,
                employeeName: expense.employeeName,
                description: expense.description,
                amount: expense.amount,
                stage,
                notes: expense.notes,
                expenseId: expense.id,
              });
              sendWebexDirectMessage(nextApprover.email, webexMsg).catch(e => console.error("[webex] Error:", e));
            }
          }
        } catch (e) {
          console.error("Failed to send next-approver notification email:", e);
        }
      }
    }

    res.json(updated);
  });

  app.post("/api/expenses/bulk-status", requireAuth, async (req, res) => {
    const { expenseIds, status } = req.body;
    if (!Array.isArray(expenseIds) || expenseIds.length === 0) {
      return res.status(400).json({ message: "expenseIds must be a non-empty array" });
    }
    const parsed = statusEnum.safeParse(status);
    if (!parsed.success) return res.status(400).json({ message: "Invalid status" });

    const appUser = await getAppUser(req);
    if (!appUser) return res.status(401).json({ message: "Not authenticated" });

    const allUsers = await storage.getUsers();
    const subordinateIds = getAllSubordinateIds(appUser.id, allUsers);
    const isManager = appUser.role === "Manager" || appUser.role === "General Manager" || appUser.role === "Executive Chairman";
    const isAdmin = appUser.isAdmin;

    const oldExpenses = await Promise.all(expenseIds.map((id: string) => storage.getExpense(id)));
    const validExpenses = oldExpenses.filter(e => e != null);

    for (const expense of validExpenses) {
      const isSubordinate = subordinateIds.includes(expense.employeeId);
      const canApprove = isAdmin || (isManager && isSubordinate);
      if (!canApprove) {
        return res.status(403).json({ message: `Not authorized to update expense "${expense.description}"` });
      }
    }

    const validIds = validExpenses.map(e => e.id);
    if (validIds.length === 0) return res.status(404).json({ message: "No valid expenses found" });

    const updated = await storage.bulkUpdateExpenseStatus(validIds, parsed.data);
    const changerName = appUser.name || "System";

    for (const oldExpense of validExpenses) {
      try {
        await storage.createExpenseHistory({
          expenseId: oldExpense.id,
          action: "status_change",
          fromStatus: oldExpense.status,
          toStatus: parsed.data,
          changedBy: changerName,
          details: `Status changed from ${oldExpense.status} to ${parsed.data}`,
        });

        const newStatus = parsed.data as ExpenseStatus;
        const isRejection = newStatus.includes("Rejected");
        const isApproval = newStatus.includes("Approved") || newStatus === "Reimbursed";
        if ((isApproval || isRejection) && oldExpense.employeeId !== appUser.id) {
          const title = isRejection ? "Expense Rejected" : newStatus === "Reimbursed" ? "Expense Reimbursed" : "Expense Approved";
          const message = `Your expense "${oldExpense.description}" ($${oldExpense.amount}) has been ${isRejection ? "rejected" : newStatus === "Reimbursed" ? "reimbursed" : "approved"} — status: ${newStatus}`;
          await storage.createNotification({
            userId: oldExpense.employeeId,
            type: isRejection ? "rejection" : "approval",
            title,
            message,
            expenseId: oldExpense.id,
            isRead: false,
          });

          const submitter = await storage.getUser(oldExpense.employeeId);
          if (submitter?.notifyEmail && submitter.email) {
            const emailData = buildStatusChangeEmail({
              employeeName: oldExpense.employeeName,
              description: oldExpense.description,
              amount: oldExpense.amount,
              newStatus,
              expenseId: oldExpense.id,
            });
            sendEmail({ to: submitter.email, ...emailData }).catch(e => console.error("[email] Error:", e));
          }
          if (submitter?.notifyWebex && submitter?.email) {
            const webexMsg = buildWebexStatusChange({
              description: oldExpense.description,
              amount: oldExpense.amount,
              newStatus,
              notes: oldExpense.notes,
              expenseId: oldExpense.id,
            });
            sendWebexDirectMessage(submitter.email, webexMsg).catch(e => console.error("[webex] Error:", e));
          }
        }
        if (newStatus === "GM Approved" || newStatus === "EC Approved") {
          createBillForExpense(oldExpense).catch(e => console.error("[quickbooks] Bulk bill creation error:", e));
        }
      } catch (e) {
        console.error("Failed to log expense history:", e);
      }
    }

    res.json(updated);
  });

  app.get("/api/expenses/:id/history", async (req, res) => {
    const history = await storage.getExpenseHistory(req.params.id);
    res.json(history);
  });

  app.get("/api/expenses/:id/comments", async (req, res) => {
    const comments = await storage.getCommentsByExpense(req.params.id);
    res.json(comments);
  });

  app.post("/api/expenses/:id/comments", async (req, res) => {
    const body = { ...req.body, expenseId: req.params.id };
    const parsed = insertCommentSchema.safeParse(body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });

    // Check the parent first: inserting against a missing expense trips the
    // foreign key and surfaces the raw constraint name in a 500.
    const expense = await storage.getExpense(req.params.id);
    if (!expense) return res.status(404).json({ message: "Expense not found" });

    const comment = await storage.createComment(parsed.data);

    try {
      const commentAuthor = parsed.data.author;
      const appUser = await getAppUser(req);
      if (appUser && expense.employeeId !== appUser.id) {
        await storage.createNotification({
          userId: expense.employeeId,
          type: "comment",
          title: "New Comment on Your Expense",
          message: `${commentAuthor} commented on "${expense.description}": "${parsed.data.text.substring(0, 100)}${parsed.data.text.length > 100 ? '...' : ''}"`,
          expenseId: expense.id,
          isRead: false,
        });

        const submitter = await storage.getUser(expense.employeeId);
        if (submitter?.notifyEmail && submitter.email) {
          const emailData = buildCommentEmail({
            commentAuthor,
            description: expense.description,
            amount: expense.amount,
            commentText: parsed.data.text,
            expenseId: expense.id,
          });
          sendEmail({ to: submitter.email, ...emailData }).catch(e => console.error("[email] Error:", e));
        }
        if (submitter?.notifyWebex && submitter?.email) {
          const webexMsg = buildWebexComment({
            commentAuthor,
            description: expense.description,
            amount: expense.amount,
            commentText: parsed.data.text,
            notes: expense.notes,
            expenseId: expense.id,
          });
          sendWebexDirectMessage(submitter.email, webexMsg).catch(e => console.error("[webex] Error:", e));
        }
      }
    } catch (e) {
      console.error("Failed to create comment notification:", e);
    }

    res.status(201).json(comment);
  });

  app.patch("/api/expenses/:id", async (req, res) => {
    const { description, amount, date, category, notes, receiptUrl, status, userId, miles } = req.body;

    const expense = await storage.getExpense(req.params.id);
    if (!expense) return res.status(404).json({ message: "Expense not found" });

    if (userId && expense.employeeId !== userId) {
      return res.status(403).json({ message: "Only the submitter can edit their own expense" });
    }

    if (expense.status === "Reimbursed" || expense.status === "Cancelled") {
      return res.status(400).json({ message: "Cannot edit an expense that is already reimbursed or cancelled" });
    }

    const updateData: Record<string, any> = {};
    if (description !== undefined) updateData.description = description;
    if (amount !== undefined) updateData.amount = amount;
    if (date !== undefined) updateData.date = date;
    if (category !== undefined) updateData.category = category;
    if (notes !== undefined) updateData.notes = notes;
    if (receiptUrl !== undefined) updateData.receiptUrl = receiptUrl;
    if (miles !== undefined) updateData.miles = miles;
    if (status !== undefined) {
      const parsed = statusEnum.safeParse(status);
      if (!parsed.success) return res.status(400).json({ message: "Invalid status" });
      updateData.status = parsed.data;
    }
    const oldStatus = expense.status;
    const updated = await storage.updateExpense(req.params.id, updateData);
    if (!updated) return res.status(404).json({ message: "Expense not found" });

    try {
      const appUser = await getAppUser(req);
      const changerName = appUser?.name || "System";
      const changes: string[] = [];
      if (description !== undefined && description !== expense.description) {
        changes.push(`vendor name from "${expense.description}" to "${description}"`);
      }
      if (amount !== undefined && amount !== expense.amount) {
        changes.push(`amount from $${parseFloat(expense.amount).toFixed(2)} to $${parseFloat(amount).toFixed(2)}`);
      }
      if (date !== undefined && date !== expense.date) {
        changes.push(`date from ${expense.date} to ${date}`);
      }
      if (category !== undefined && category !== expense.category) {
        changes.push(`category from "${expense.category}" to "${category}"`);
      }
      if (notes !== undefined && notes !== expense.notes) {
        const oldNotes = expense.notes || "(empty)";
        changes.push(`description from "${oldNotes}" to "${notes || "(empty)"}"`);
      }
      if (miles !== undefined && String(miles) !== String(expense.miles || "")) {
        const oldMiles = expense.miles ? parseFloat(expense.miles).toFixed(1) : "0";
        changes.push(`miles from ${oldMiles} to ${parseFloat(miles).toFixed(1)}`);
      }

      await storage.createExpenseHistory({
        expenseId: expense.id,
        action: "edited",
        fromStatus: oldStatus,
        toStatus: updateData.status || oldStatus,
        changedBy: changerName,
        details: changes.length > 0 ? `Changed ${changes.join("; ")}` : "Expense edited",
      });
    } catch (e) {
      console.error("Failed to log expense history:", e);
    }

    res.json(updated);
  });

  app.get("/api/notifications", async (req, res) => {
    const appUser = await getAppUser(req);
    if (!appUser) return res.status(401).json({ message: "Not authenticated" });
    const targetUserId = (req.query.viewAsUserId as string) || appUser.id;
    const notifs = await storage.getNotificationsByUser(targetUserId);
    res.json(notifs);
  });

  app.get("/api/notifications/unread-count", async (req, res) => {
    const appUser = await getAppUser(req);
    if (!appUser) return res.status(401).json({ message: "Not authenticated" });
    const targetUserId = (req.query.viewAsUserId as string) || appUser.id;
    const count = await storage.getUnreadNotificationCount(targetUserId);
    res.json({ count });
  });

  app.patch("/api/notifications/:id/read", async (req, res) => {
    const appUser = await getAppUser(req);
    if (!appUser) return res.status(401).json({ message: "Not authenticated" });
    const targetUserId = (req.query.viewAsUserId as string) || appUser.id;
    const notif = await storage.markNotificationReadForUser(req.params.id, targetUserId);
    if (!notif) return res.status(404).json({ message: "Notification not found" });
    res.json(notif);
  });

  app.post("/api/notifications/mark-all-read", async (req, res) => {
    const appUser = await getAppUser(req);
    if (!appUser) return res.status(401).json({ message: "Not authenticated" });
    const targetUserId = (req.query.viewAsUserId as string) || appUser.id;
    await storage.markAllNotificationsRead(targetUserId);
    res.json({ success: true });
  });

  app.get("/api/expenses/:expenseId/attachments", requireAuth, async (req, res) => {
    const attachments = await storage.getAttachmentsByExpense(req.params.expenseId);
    res.json(attachments);
  });

  app.post("/api/expenses/:expenseId/attachments", requireAuth, async (req, res) => {
    const appUser = await getAppUser(req);
    if (!appUser) return res.status(401).json({ message: "Not authenticated" });

    const expense = await storage.getExpense(req.params.expenseId);
    if (!expense) return res.status(404).json({ message: "Expense not found" });
    if (expense.employeeId !== appUser.id && !appUser.isAdmin) {
      return res.status(403).json({ message: "Not authorized to add attachments to this expense" });
    }

    const body = { ...req.body, expenseId: req.params.expenseId };
    const parsed = insertExpenseAttachmentSchema.safeParse(body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const attachment = await storage.createAttachment(parsed.data);
    res.status(201).json(attachment);
  });

  app.delete("/api/attachments/:id", requireAuth, async (req, res) => {
    const deleted = await storage.deleteAttachment(req.params.id);
    if (!deleted) return res.status(404).json({ message: "Attachment not found" });
    res.json({ message: "Attachment deleted successfully" });
  });

  app.post("/api/scan-receipt", async (req, res) => {
    try {
      const { image } = req.body;
      if (!image) return res.status(400).json({ message: "Image data is required" });

      console.log(`[scan-receipt] Starting OCR scan, image data length: ${image.length} chars`);

      const activeCategories = await storage.getActiveCategories();
      const categoryNames = activeCategories.map(c => c.name);

      const result = await scanReceiptImage(image, categoryNames);
      console.log(`[scan-receipt] OCR result: ${JSON.stringify(result)}`);

      res.json(result);
    } catch (error: any) {
      console.error("Receipt scan error:", error?.message || error);
      res.status(500).json({ message: "Failed to scan receipt. Please fill in the details manually." });
    }
  });

  const qboStates = new Map<string, number>();

  app.get("/api/quickbooks/status", requireAuth, requireAdmin, async (_req, res) => {
    const configured = isQuickbooksConfigured();
    const token = await storage.getActiveQuickbooksToken();
    const connected = !!token;
    const pendingBills = connected ? await storage.getPendingQuickbooksBills() : [];
    res.json({
      configured,
      connected,
      realmId: token?.realmId || null,
      pendingBillsCount: pendingBills.length,
      lastUpdated: token?.updatedAt || null,
    });
  });

  app.get("/api/quickbooks/auth", requireAuth, requireAdmin, async (_req, res) => {
    if (!isQuickbooksConfigured()) {
      return res.status(400).json({ message: "QuickBooks credentials not configured. Please set QBO_CLIENT_ID and QBO_CLIENT_SECRET." });
    }
    const state = crypto.randomBytes(16).toString("hex");
    qboStates.set(state, Date.now());
    const url = getAuthorizationUrl(state);
    res.json({ url });
  });

  app.get("/api/quickbooks/callback", async (req, res) => {
    const appUser = await getAppUser(req);
    if (!appUser || !appUser.isAdmin) {
      return res.status(403).send("Admin access required to connect QuickBooks.");
    }

    const { code, state, realmId } = req.query;
    if (!code || !state || !realmId) {
      return res.status(400).send("Missing required parameters from QuickBooks.");
    }

    const stateStr = state as string;
    const storedTime = qboStates.get(stateStr);
    if (!storedTime || Date.now() - storedTime > 10 * 60 * 1000) {
      return res.status(400).send("Invalid or expired state parameter.");
    }
    qboStates.delete(stateStr);

    try {
      const tokens = await exchangeCodeForTokens(code as string);
      await storage.deactivateAllQuickbooksTokens();
      const expiresAt = new Date(Date.now() + tokens.expiresIn * 1000);
      await storage.saveQuickbooksToken({
        realmId: realmId as string,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt,
        isActive: true,
      });
      console.log("[quickbooks] Successfully connected to QuickBooks Online");
      res.redirect("/admin/quickbooks?connected=true");
    } catch (error) {
      console.error("[quickbooks] OAuth callback error:", error);
      res.redirect("/admin/quickbooks?error=auth_failed");
    }
  });

  app.post("/api/quickbooks/disconnect", requireAuth, requireAdmin, async (_req, res) => {
    const token = await storage.getActiveQuickbooksToken();
    if (token) {
      try {
        await revokeToken(token.refreshToken);
      } catch (e) {
        console.error("[quickbooks] Token revocation failed:", e);
      }
      await storage.deactivateAllQuickbooksTokens();
    }
    res.json({ success: true });
  });

  app.post("/api/quickbooks/sync", requireAuth, requireAdmin, async (_req, res) => {
    try {
      const result = await syncPendingBills();
      res.json(result);
    } catch (error: any) {
      console.error("[quickbooks] Sync error:", error);
      res.status(500).json({ message: error.message || "Sync failed" });
    }
  });

  app.get("/api/quickbooks/bills", requireAuth, requireAdmin, async (_req, res) => {
    const allBills = await storage.getAllQuickbooksBills();
    res.json(allBills);
  });

  app.get("/api/categories", async (_req, res) => {
    const categories = await storage.getActiveCategories();
    res.json(categories);
  });

  app.post("/api/categories", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { name } = req.body;
      if (!name || typeof name !== "string" || !name.trim()) {
        return res.status(400).json({ message: "Category name is required" });
      }
      const category = await storage.createCategory({ name: name.trim(), isActive: true, sortOrder: "0" });
      res.json(category);
    } catch (error: any) {
      if (error.message?.includes("unique") || error.code === "23505") {
        return res.status(409).json({ message: "A category with that name already exists" });
      }
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/categories/:id", requireAuth, requireAdmin, async (req, res) => {
    const deleted = await storage.deleteCategory(req.params.id);
    if (!deleted) return res.status(404).json({ message: "Category not found" });
    res.json({ success: true });
  });

  app.get("/api/gl-mappings", requireAuth, requireAdmin, async (_req, res) => {
    const mappings = await storage.getGlMappings();
    res.json(mappings);
  });

  app.put("/api/gl-mappings", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { category, accountNumber, accountName, parentAccountName } = req.body;
      if (!category || !accountNumber || !accountName) {
        return res.status(400).json({ message: "category, accountNumber, and accountName are required" });
      }
      const mapping = await storage.upsertGlMapping({
        category,
        accountNumber,
        accountName,
        parentAccountName: parentAccountName || null,
      });
      res.json(mapping);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/gl-mappings/:id", requireAuth, requireAdmin, async (req, res) => {
    const deleted = await storage.deleteGlMapping(req.params.id);
    if (!deleted) return res.status(404).json({ message: "Mapping not found" });
    res.json({ success: true });
  });

  app.post("/api/quickbooks/test-bill", requireAuth, requireAdmin, async (_req, res) => {
    try {
      const today = new Date().toISOString().split("T")[0];
      const testExpense = {
        id: `test-${Date.now()}`,
        description: "Test Expense",
        amount: "25.00",
        date: today,
        category: "Meals",
        status: "GM Approved",
        receiptUrl: null,
        employeeId: "test",
        employeeName: "Michael Papa",
        notes: null,
        miles: null,
        createdAt: new Date(),
      } as any;

      const billId = await createBillForExpense(testExpense);
      if (billId) {
        res.json({ success: true, qboBillId: billId, message: `Test bill ${billId} created in QuickBooks` });
      } else {
        res.status(500).json({ success: false, message: "Failed to create test bill. QuickBooks may not be connected." });
      }
    } catch (error: any) {
      console.error("[quickbooks] Test bill error:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.get("/api/gusto/status", requireAuth, requireAdmin, async (_req, res) => {
    const config = await storage.getGustoConfig();
    res.json({
      configured: !!(process.env.GUSTO_CLIENT_ID && process.env.GUSTO_CLIENT_SECRET),
      connected: config?.isConnected ?? false,
      companyId: config?.companyId ?? null,
      companyName: config?.companyName ?? null,
      syncEnabled: config?.syncEnabled ?? false,
      lastSyncAt: config?.lastSyncAt ?? null,
    });
  });

  app.post("/api/gusto/connect", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { clientId, clientSecret } = req.body;
      if (!clientId || !clientSecret) {
        return res.status(400).json({ message: "Client ID and Client Secret are required" });
      }
      let config = await storage.getGustoConfig();
      if (config) {
        config = await storage.updateGustoConfig(config.id, {
          accessToken: clientId,
          refreshToken: clientSecret,
          isConnected: true,
          companyName: "Aseva LLC",
          companyId: "gusto-" + Date.now(),
        });
      } else {
        config = await storage.saveGustoConfig({
          accessToken: clientId,
          refreshToken: clientSecret,
          isConnected: true,
          companyName: "Aseva LLC",
          companyId: "gusto-" + Date.now(),
          syncEnabled: false,
        });
      }
      res.json({ success: true, config });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/gusto/disconnect", requireAuth, requireAdmin, async (_req, res) => {
    const config = await storage.getGustoConfig();
    if (config) {
      await storage.updateGustoConfig(config.id, {
        isConnected: false,
        accessToken: null,
        refreshToken: null,
        companyId: null,
        companyName: null,
        syncEnabled: false,
      });
    }
    res.json({ success: true });
  });

  app.post("/api/gusto/toggle-sync", requireAuth, requireAdmin, async (_req, res) => {
    const config = await storage.getGustoConfig();
    if (!config || !config.isConnected) {
      return res.status(400).json({ message: "Gusto is not connected" });
    }
    const updated = await storage.updateGustoConfig(config.id, {
      syncEnabled: !config.syncEnabled,
    });
    res.json(updated);
  });

  app.post("/api/gusto/sync", requireAuth, requireAdmin, async (_req, res) => {
    const config = await storage.getGustoConfig();
    if (!config || !config.isConnected) {
      return res.status(400).json({ message: "Gusto is not connected" });
    }
    await storage.updateGustoConfig(config.id, {
      lastSyncAt: new Date(),
    });
    res.json({ synced: 0, message: "Sync complete. No pending reimbursements to process." });
  });

  app.get("/api/purchase-orders", async (req, res) => {
    const appUser = await getAppUser(req);
    if (!appUser) return res.status(401).json({ message: "Not authenticated" });

    if (appUser.isAdmin || appUser.isPOAdmin || appUser.role === "Executive Chairman" || appUser.role === "General Manager") {
      const pos = await storage.getPurchaseOrders();
      return res.json(pos);
    }

    if (appUser.role === "Manager") {
      const allUsers = await storage.getUsers();
      const subordinateIds = getAllSubordinateIds(appUser.id, allUsers);
      const allPOs = await storage.getPurchaseOrders();
      const filtered = allPOs.filter(po =>
        po.submitterId === appUser.id || subordinateIds.includes(po.submitterId)
      );
      return res.json(filtered);
    }

    const pos = await storage.getPurchaseOrdersBySubmitter(appUser.id);
    res.json(pos);
  });

  app.get("/api/purchase-orders/next-number", async (_req, res) => {
    const poNumber = await storage.getNextPoNumber();
    res.json({ poNumber });
  });

  app.get("/api/purchase-orders/:id", async (req, res) => {
    const po = await storage.getPurchaseOrder(req.params.id);
    if (!po) return res.status(404).json({ message: "Purchase order not found" });
    res.json(po);
  });

  app.post("/api/purchase-orders", async (req, res) => {
    const parsed = insertPurchaseOrderSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });

    // The client sends the number it was shown on the form, which may be stale by
    // the time it submits. Re-derive it here and retry on the unique violation so
    // two people submitting at once don't collide.
    let po;
    for (let attempt = 0; ; attempt++) {
      try {
        const poNumber = await storage.getNextPoNumber();
        po = await storage.createPurchaseOrder({ ...parsed.data, poNumber });
        break;
      } catch (e: any) {
        if (e?.code === "23505" && attempt < 5) continue;
        console.error("Failed to create purchase order:", e);
        return res.status(e?.code === "23505" ? 409 : 500)
          .json({ message: "Could not create purchase order. Please try again." });
      }
    }

    try {
      await storage.createPoHistory({
        purchaseOrderId: po.id,
        action: "created",
        fromStatus: null,
        toStatus: po.status,
        changedBy: po.submitterName,
        details: `Purchase order ${po.poNumber} created for $${po.totalCost}`,
      });
    } catch (e) {
      console.error("Failed to log PO history:", e);
    }

    if (po.status === "Submitted") {
      try {
        const allUsers = await storage.getUsers();
        const poAdmin = allUsers.find(u => u.isPOAdmin);
        if (poAdmin && poAdmin.id !== po.submitterId) {
          await storage.createNotification({
            userId: poAdmin.id,
            type: "new_po",
            title: "New Purchase Order to Review",
            message: `${po.submitterName} submitted PO ${po.poNumber} "${po.description}" ($${po.totalCost}) for your review`,
            expenseId: null,
            purchaseOrderId: po.id,
            isRead: false,
          });
        }
      } catch (e) {
        console.error("Failed to create PO notification:", e);
      }
    }

    res.status(201).json(po);
  });

  app.put("/api/purchase-orders/:id", async (req, res) => {
    const po = await storage.getPurchaseOrder(req.params.id);
    if (!po) return res.status(404).json({ message: "Purchase order not found" });
    if (po.status !== "Draft") return res.status(400).json({ message: "Can only edit draft purchase orders" });
    const updated = await storage.updatePurchaseOrder(req.params.id, req.body);
    res.json(updated);
  });

  app.patch("/api/purchase-orders/:id/status", async (req, res) => {
    const { status, userId, reason, paymentStatus } = req.body;
    const parsed = poStatusEnum.safeParse(status);
    if (!parsed.success) return res.status(400).json({ message: "Invalid status" });

    const po = await storage.getPurchaseOrder(req.params.id);
    if (!po) return res.status(404).json({ message: "Purchase order not found" });

    const isRejectionOrInfo = status.includes("Rejected") || status === "More Info Requested";
    if (isRejectionOrInfo && (!reason || !reason.trim())) {
      return res.status(400).json({ message: "A reason is required when rejecting or requesting more info" });
    }

    const appUser = await getAppUser(req);
    if (isRejectionOrInfo && appUser) {
      const isActingPOAdmin = appUser.isPOAdmin && !['Manager', 'General Manager', 'Executive Chairman'].includes(appUser.role);
      if (isActingPOAdmin && status.includes("Rejected")) {
        return res.status(403).json({ message: "PO Administrators cannot reject purchase orders. Use 'Request More Info' instead." });
      }
    }

    if (status === "Order Placed") {
      if (!paymentStatus || !["paid", "accrual"].includes(paymentStatus)) {
        return res.status(400).json({ message: "Payment status ('paid' or 'accrual') is required when marking a PO as ordered" });
      }
    }

    if (status === "Cancelled") {
      if (!userId || po.submitterId !== userId) {
        return res.status(403).json({ message: "Only the submitter can cancel their own PO" });
      }
      if (po.status === "Order Placed" || po.status === "Cancelled") {
        return res.status(400).json({ message: "Cannot cancel a placed or cancelled PO" });
      }
    }

    const oldStatus = po.status;
    const updated = await storage.updatePurchaseOrderStatus(req.params.id, parsed.data);

    if (updated) {
      const newStatus = parsed.data;

      try {
        const changerName = appUser?.name || "System";
        const details = reason
          ? `Status changed from ${oldStatus} to ${newStatus}. Reason: ${reason}`
          : `Status changed from ${oldStatus} to ${newStatus}`;
        await storage.createPoHistory({
          purchaseOrderId: po.id,
          action: "status_change",
          fromStatus: oldStatus,
          toStatus: newStatus,
          changedBy: changerName,
          details,
        });
      } catch (e) {
        console.error("Failed to log PO history:", e);
      }

      const allUsers = await storage.getUsers();
      const poAdmin = allUsers.find(u => u.isPOAdmin);

      const isRejection = newStatus.includes("Rejected");
      const isMoreInfo = newStatus === "More Info Requested";
      const isApproval = newStatus.includes("Approved") || newStatus === "PO Admin Review" || newStatus === "Order Placed";

      if (isRejection) {
        try {
          await storage.createNotification({
            userId: po.submitterId,
            type: "po_rejection",
            title: "Purchase Order Rejected",
            message: `Your PO ${po.poNumber} "${po.description}" ($${po.totalCost}) has been rejected. Reason: ${reason}`,
            expenseId: null,
            purchaseOrderId: po.id,
            isRead: false,
          });
        } catch (e) {
          console.error("Failed to create PO rejection notification:", e);
        }
      }

      if (isMoreInfo) {
        try {
          await storage.createNotification({
            userId: po.submitterId,
            type: "po_more_info",
            title: "More Info Requested on Purchase Order",
            message: `${appUser?.name || "A reviewer"} needs more information on PO ${po.poNumber} "${po.description}". Reason: ${reason}`,
            expenseId: null,
            purchaseOrderId: po.id,
            isRead: false,
          });
        } catch (e) {
          console.error("Failed to create PO more-info notification:", e);
        }
      }

      if (newStatus === "Submitted") {
        try {
          if (poAdmin && poAdmin.id !== po.submitterId) {
            await storage.createNotification({
              userId: poAdmin.id,
              type: "new_po",
              title: "New Purchase Order to Review",
              message: `${po.submitterName} submitted PO ${po.poNumber} "${po.description}" ($${po.totalCost}) for your review`,
              expenseId: null,
              purchaseOrderId: po.id,
              isRead: false,
            });
          }
        } catch (e) {
          console.error("Failed to create PO notification:", e);
        }
      }

      if (newStatus === "PO Admin Review") {
        try {
          const submitter = await storage.getUser(po.submitterId);
          if (submitter?.managerId && submitter.managerId !== appUser?.id) {
            await storage.createNotification({
              userId: submitter.managerId,
              type: "po_approval_needed",
              title: "Purchase Order Awaiting Your Approval",
              message: `PO ${po.poNumber} "${po.description}" ($${po.totalCost}) has been reviewed by PO Admin and needs your approval`,
              expenseId: null,
              purchaseOrderId: po.id,
              isRead: false,
            });
          }
          if (po.submitterId !== appUser?.id) {
            await storage.createNotification({
              userId: po.submitterId,
              type: "po_approval",
              title: "PO Reviewed by PO Admin",
              message: `Your PO ${po.poNumber} has been reviewed and forwarded for manager approval`,
              expenseId: null,
              purchaseOrderId: po.id,
              isRead: false,
            });
          }
        } catch (e) {
          console.error("Failed to create PO Admin Review notification:", e);
        }
      }

      if (newStatus === "Manager Approved") {
        try {
          const submitter = await storage.getUser(po.submitterId);
          if (submitter?.managerId) {
            const managerChain = await buildManagerChain(submitter);

            const nextApprover = managerChain.find(m => m.role === "General Manager");

            if (nextApprover && nextApprover.id !== appUser?.id) {
              await storage.createNotification({
                userId: nextApprover.id,
                type: "po_approval_needed",
                title: "Purchase Order Awaiting Your Approval",
                message: `${po.submitterName}'s PO ${po.poNumber} "${po.description}" ($${po.totalCost}) needs your review (GM Review)`,
                expenseId: null,
                purchaseOrderId: po.id,
                isRead: false,
              });
            }
          }
          if (po.submitterId !== appUser?.id) {
            await storage.createNotification({
              userId: po.submitterId,
              type: "po_approval",
              title: "Purchase Order Approved",
              message: `Your PO ${po.poNumber} has been approved — status: ${newStatus}`,
              expenseId: null,
              purchaseOrderId: po.id,
              isRead: false,
            });
          }
        } catch (e) {
          console.error("Failed to send next-approver PO notification:", e);
        }
      }

      if (newStatus === "GM Approved") {
        try {
          if (poAdmin && poAdmin.id !== appUser?.id) {
            await storage.createNotification({
              userId: poAdmin.id,
              type: "po_approval_needed",
              title: "Purchase Order Ready to Order",
              message: `PO ${po.poNumber} "${po.description}" ($${po.totalCost}) has been fully approved by GM and is ready for you to mark as ordered/provisioned`,
              expenseId: null,
              purchaseOrderId: po.id,
              isRead: false,
            });
          }
          if (po.submitterId !== appUser?.id) {
            await storage.createNotification({
              userId: po.submitterId,
              type: "po_approval",
              title: "Purchase Order Fully Approved",
              message: `Your PO ${po.poNumber} has been fully approved and will be ordered by the PO Admin`,
              expenseId: null,
              purchaseOrderId: po.id,
              isRead: false,
            });
          }
        } catch (e) {
          console.error("Failed to create GM Approved PO notification:", e);
        }
      }

      if (newStatus === "Order Placed") {
        if (paymentStatus) {
          try {
            await storage.updatePurchaseOrder(po.id, { paymentStatus });
          } catch (e) {
            console.error("Failed to save PO paymentStatus:", e);
          }
        }

        try {
          if (po.submitterId !== appUser?.id) {
            await storage.createNotification({
              userId: po.submitterId,
              type: "po_approval",
              title: "Purchase Order Placed",
              message: `Your PO ${po.poNumber} "${po.description}" has been ordered/provisioned`,
              expenseId: null,
              purchaseOrderId: po.id,
              isRead: false,
            });
          }
        } catch (e) {
          console.error("Failed to create Order Placed notification:", e);
        }

        try {
          const updatedPO = await storage.getPurchaseOrder(po.id);
          if (updatedPO) {
            if (paymentStatus === "paid") {
              const qboId = await createExpenseForPurchaseOrder(updatedPO);
              if (qboId) {
                console.log(`[routes] QBO Expense created for PO ${po.poNumber}: ${qboId}`);
              }
            } else {
              const qboId = await createBillForPurchaseOrder(updatedPO);
              if (qboId) {
                console.log(`[routes] QBO Bill created for PO ${po.poNumber}: ${qboId}`);
              }
            }
          }
        } catch (e) {
          console.error("Failed to create QBO record for PO:", e);
        }
      }
    }

    res.json(updated);
  });

  app.get("/api/purchase-orders/:id/history", async (req, res) => {
    const history = await storage.getPoHistory(req.params.id);
    res.json(history);
  });

  app.get("/api/purchase-orders/:id/comments", async (req, res) => {
    const comments = await storage.getPoComments(req.params.id);
    res.json(comments);
  });

  app.post("/api/purchase-orders/:id/comments", async (req, res) => {
    const parsed = insertPoCommentSchema.safeParse({ ...req.body, purchaseOrderId: req.params.id });
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const po = await storage.getPurchaseOrder(req.params.id);
    if (!po) return res.status(404).json({ message: "Purchase order not found" });
    const comment = await storage.createPoComment(parsed.data);
    res.status(201).json(comment);
  });

  app.get("/api/purchase-orders/:id/attachments", async (req, res) => {
    const attachments = await storage.getPoAttachments(req.params.id);
    res.json(attachments);
  });

  app.post("/api/purchase-orders/:id/attachments", async (req, res) => {
    const parsed = insertPoAttachmentSchema.safeParse({ ...req.body, purchaseOrderId: req.params.id });
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const attachment = await storage.createPoAttachment(parsed.data);
    res.status(201).json(attachment);
  });

  app.delete("/api/purchase-orders/attachments/:id", async (req, res) => {
    const deleted = await storage.deletePoAttachment(req.params.id);
    if (!deleted) return res.status(404).json({ message: "Attachment not found" });
    res.json({ success: true });
  });

  app.get("/api/documents", async (req, res) => {
    const appUser = await getAppUser(req);
    if (!appUser) return res.status(401).json({ message: "Not authenticated" });

    if (appUser.isAdmin) {
      const docs = await storage.getDocuments();
      return res.json(docs.map(d => ({ ...d, fileData: undefined })));
    }
    const docs = await storage.getDocumentsByUser(appUser.id);
    return res.json(docs.map(d => ({ ...d, fileData: undefined })));
  });

  app.get("/api/documents/:id", async (req, res) => {
    const appUser = await getAppUser(req);
    if (!appUser) return res.status(401).json({ message: "Not authenticated" });

    const doc = await storage.getDocument(req.params.id);
    if (!doc) return res.status(404).json({ message: "Document not found" });

    if (!appUser.isAdmin && doc.uploadedById !== appUser.id) {
      return res.status(403).json({ message: "Not authorized" });
    }
    return res.json(doc);
  });

  app.get("/api/documents/:id/download", async (req, res) => {
    const appUser = await getAppUser(req);
    if (!appUser) return res.status(401).json({ message: "Not authenticated" });

    const doc = await storage.getDocument(req.params.id);
    if (!doc) return res.status(404).json({ message: "Document not found" });

    if (!appUser.isAdmin && doc.uploadedById !== appUser.id) {
      return res.status(403).json({ message: "Not authorized" });
    }

    const base64Match = doc.fileData.match(/^data:([^;]+);base64,(.+)$/);
    if (base64Match) {
      const mimeType = base64Match[1];
      const buffer = Buffer.from(base64Match[2], 'base64');
      res.setHeader('Content-Type', mimeType);
      res.setHeader('Content-Disposition', `attachment; filename="${doc.fileName}"`);
      res.setHeader('Content-Length', buffer.length);
      return res.send(buffer);
    }
    return res.status(400).json({ message: "Invalid file data" });
  });

  app.post("/api/documents", async (req, res) => {
    const appUser = await getAppUser(req);
    if (!appUser) return res.status(401).json({ message: "Not authenticated" });

    const { name, documentType, fileName, fileType, fileData, fileSize, vendor, description } = req.body;

    if (!name || !documentType || !fileName || !fileType || !fileData) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    if (fileData.length > 10 * 1024 * 1024) {
      return res.status(400).json({ message: "File too large. Maximum size is 10MB." });
    }

    const doc = await storage.createDocument({
      name,
      documentType,
      fileName,
      fileType,
      fileData,
      fileSize: fileSize ? String(fileSize) : null,
      vendor: vendor || null,
      description: description || null,
      uploadedById: appUser.id,
      uploadedByName: appUser.name,
    });

    res.status(201).json({ ...doc, fileData: undefined });
  });

  app.delete("/api/documents/:id", async (req, res) => {
    const appUser = await getAppUser(req);
    if (!appUser) return res.status(401).json({ message: "Not authenticated" });

    const doc = await storage.getDocument(req.params.id);
    if (!doc) return res.status(404).json({ message: "Document not found" });

    if (!appUser.isAdmin && doc.uploadedById !== appUser.id) {
      return res.status(403).json({ message: "Not authorized to delete this document" });
    }

    await storage.deleteDocument(req.params.id);
    res.json({ success: true });
  });

  return httpServer;
}
