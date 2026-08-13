import { db } from "./db";
import { eq, desc, and, inArray, sql, gte, lte, ilike, or } from "drizzle-orm";
import {
  users, expenses, comments, notifications, expenseHistory, expenseAttachments,
  quickbooksTokens, quickbooksBills, glMappings, expenseCategories,
  purchaseOrders, poHistory, poComments, poAttachments, documents, gustoConfig,
  type User, type InsertUser,
  type Expense, type InsertExpense,
  type Comment, type InsertComment,
  type Notification, type InsertNotification,
  type ExpenseHistory, type InsertExpenseHistory,
  type ExpenseAttachment, type InsertExpenseAttachment,
  type QuickbooksToken, type InsertQuickbooksToken,
  type QuickbooksBill, type InsertQuickbooksBill,
  type GlMapping, type InsertGlMapping,
  type ExpenseCategory, type InsertExpenseCategory,
  type PurchaseOrder, type InsertPurchaseOrder,
  type PoHistory, type InsertPoHistory,
  type PoComment, type InsertPoComment,
  type PoAttachment, type InsertPoAttachment,
  type Document, type InsertDocument,
  type GustoConfig, type InsertGustoConfig,
} from "@shared/schema";
import { asc } from "drizzle-orm";
import { encrypt, decrypt, isEncrypted } from "./encryption";

export interface ExpenseFilters {
  employeeIds?: string[];
  statuses?: string[];
  categories?: string[];
  dateFrom?: string;
  dateTo?: string;
  amountMin?: number;
  amountMax?: number;
  search?: string;
}

export interface IStorage {
  getUsers(): Promise<User[]>;
  getUser(id: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUserRole(id: string, role: string): Promise<User | undefined>;
  updateUserAdmin(id: string, isAdmin: boolean): Promise<User | undefined>;
  updateUserAccountsPayable(id: string, isAccountsPayable: boolean): Promise<User | undefined>;
  updateUserPOAdmin(id: string, isPOAdmin: boolean): Promise<User | undefined>;
  updateUserManager(id: string, managerId: string | null): Promise<User | undefined>;
  updateUserDepartment(id: string, department: string | null): Promise<User | undefined>;
  updateUserProfile(id: string, data: { name: string; email: string; avatarInitials: string }): Promise<User | undefined>;
  updateUserProfilePicture(id: string, profilePicture: string | null): Promise<User | undefined>;
  updateUserNotificationPrefs(id: string, data: { notifyEmail: boolean; notifyText: boolean; notifyWebex: boolean; phoneNumber: string | null }): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  deleteUser(id: string): Promise<boolean>;
  getDirectReports(managerId: string): Promise<User[]>;

  getExpenses(): Promise<Expense[]>;
  getExpensesByEmployee(employeeId: string): Promise<Expense[]>;
  getExpensesByStatus(status: string): Promise<Expense[]>;
  getExpensesFiltered(filters: ExpenseFilters): Promise<Expense[]>;
  getExpense(id: string): Promise<Expense | undefined>;
  createExpense(expense: InsertExpense): Promise<Expense>;
  updateExpenseStatus(id: string, status: string): Promise<Expense | undefined>;
  updateExpense(id: string, data: Partial<InsertExpense>): Promise<Expense | undefined>;

  getCommentsByExpense(expenseId: string): Promise<Comment[]>;
  createComment(comment: InsertComment): Promise<Comment>;

  getNotificationsByUser(userId: string): Promise<Notification[]>;
  createNotification(notification: InsertNotification): Promise<Notification>;
  markNotificationRead(id: string): Promise<Notification | undefined>;
  markNotificationReadForUser(id: string, userId: string): Promise<Notification | undefined>;
  markAllNotificationsRead(userId: string): Promise<void>;
  getUnreadNotificationCount(userId: string): Promise<number>;

  getExpenseHistory(expenseId: string): Promise<ExpenseHistory[]>;
  createExpenseHistory(entry: InsertExpenseHistory): Promise<ExpenseHistory>;

  getAttachmentsByExpense(expenseId: string): Promise<ExpenseAttachment[]>;
  createAttachment(attachment: InsertExpenseAttachment): Promise<ExpenseAttachment>;
  getAttachment(id: string): Promise<ExpenseAttachment | undefined>;
  deleteAttachment(id: string): Promise<boolean>;

  bulkUpdateExpenseStatus(ids: string[], status: string): Promise<Expense[]>;

  getActiveQuickbooksToken(): Promise<QuickbooksToken | undefined>;
  saveQuickbooksToken(token: InsertQuickbooksToken): Promise<QuickbooksToken>;
  updateQuickbooksToken(id: string, data: Partial<InsertQuickbooksToken>): Promise<QuickbooksToken | undefined>;
  deactivateAllQuickbooksTokens(): Promise<void>;
  getQuickbooksBillByExpenseId(expenseId: string): Promise<QuickbooksBill | undefined>;
  getQuickbooksBillByPurchaseOrderId(purchaseOrderId: string): Promise<QuickbooksBill | undefined>;
  getAllQuickbooksBills(): Promise<QuickbooksBill[]>;
  createQuickbooksBill(bill: InsertQuickbooksBill): Promise<QuickbooksBill>;
  updateQuickbooksBill(id: string, data: Partial<InsertQuickbooksBill>): Promise<QuickbooksBill | undefined>;
  getPendingQuickbooksBills(): Promise<QuickbooksBill[]>;

  getGlMappings(): Promise<GlMapping[]>;
  getGlMappingByCategory(category: string): Promise<GlMapping | undefined>;
  upsertGlMapping(mapping: InsertGlMapping): Promise<GlMapping>;
  deleteGlMapping(id: string): Promise<boolean>;

  getActiveCategories(): Promise<ExpenseCategory[]>;
  getAllCategories(): Promise<ExpenseCategory[]>;
  createCategory(category: InsertExpenseCategory): Promise<ExpenseCategory>;
  deleteCategory(id: string): Promise<boolean>;

  getPurchaseOrders(): Promise<PurchaseOrder[]>;
  getPurchaseOrdersBySubmitter(submitterId: string): Promise<PurchaseOrder[]>;
  getPurchaseOrder(id: string): Promise<PurchaseOrder | undefined>;
  createPurchaseOrder(po: InsertPurchaseOrder): Promise<PurchaseOrder>;
  updatePurchaseOrderStatus(id: string, status: string): Promise<PurchaseOrder | undefined>;
  updatePurchaseOrder(id: string, data: Partial<InsertPurchaseOrder>): Promise<PurchaseOrder | undefined>;
  getNextPoNumber(): Promise<string>;

  getPoHistory(purchaseOrderId: string): Promise<PoHistory[]>;
  createPoHistory(entry: InsertPoHistory): Promise<PoHistory>;

  getPoComments(purchaseOrderId: string): Promise<PoComment[]>;
  createPoComment(comment: InsertPoComment): Promise<PoComment>;

  getPoAttachments(purchaseOrderId: string): Promise<PoAttachment[]>;
  createPoAttachment(attachment: InsertPoAttachment): Promise<PoAttachment>;
  deletePoAttachment(id: string): Promise<boolean>;

  getDocuments(): Promise<Document[]>;
  getDocumentsByUser(userId: string): Promise<Document[]>;
  getDocument(id: string): Promise<Document | undefined>;
  createDocument(doc: InsertDocument): Promise<Document>;
  deleteDocument(id: string): Promise<boolean>;

  getGustoConfig(): Promise<GustoConfig | undefined>;
  saveGustoConfig(config: InsertGustoConfig): Promise<GustoConfig>;
  updateGustoConfig(id: string, data: Partial<InsertGustoConfig>): Promise<GustoConfig | undefined>;
}

export class DatabaseStorage implements IStorage {
  async getUsers(): Promise<User[]> {
    return db.select().from(users);
  }

  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async createUser(user: InsertUser): Promise<User> {
    const [created] = await db.insert(users).values(user).returning();
    return created;
  }

  async updateUserRole(id: string, role: string): Promise<User | undefined> {
    const [updated] = await db.update(users).set({ role }).where(eq(users.id, id)).returning();
    return updated;
  }

  async updateUserAdmin(id: string, isAdmin: boolean): Promise<User | undefined> {
    const [updated] = await db.update(users).set({ isAdmin }).where(eq(users.id, id)).returning();
    return updated;
  }

  async updateUserAccountsPayable(id: string, isAccountsPayable: boolean): Promise<User | undefined> {
    const [updated] = await db.update(users).set({ isAccountsPayable }).where(eq(users.id, id)).returning();
    return updated;
  }

  async updateUserPOAdmin(id: string, isPOAdmin: boolean): Promise<User | undefined> {
    const [updated] = await db.update(users).set({ isPOAdmin }).where(eq(users.id, id)).returning();
    return updated;
  }

  async updateUserManager(id: string, managerId: string | null): Promise<User | undefined> {
    const [updated] = await db.update(users).set({ managerId }).where(eq(users.id, id)).returning();
    return updated;
  }

  async updateUserDepartment(id: string, department: string | null): Promise<User | undefined> {
    const [updated] = await db.update(users).set({ department }).where(eq(users.id, id)).returning();
    return updated;
  }

  async updateUserProfile(id: string, data: { name: string; email: string; avatarInitials: string }): Promise<User | undefined> {
    const [updated] = await db.update(users).set(data).where(eq(users.id, id)).returning();
    return updated;
  }

  async updateUserProfilePicture(id: string, profilePicture: string | null): Promise<User | undefined> {
    const [updated] = await db.update(users).set({ profilePicture }).where(eq(users.id, id)).returning();
    return updated;
  }

  async updateUserNotificationPrefs(id: string, data: { notifyEmail: boolean; notifyText: boolean; notifyWebex: boolean; phoneNumber: string | null }): Promise<User | undefined> {
    const [updated] = await db.update(users).set({
      notifyEmail: data.notifyEmail,
      notifyText: data.notifyText,
      notifyWebex: data.notifyWebex,
      phoneNumber: data.phoneNumber,
    }).where(eq(users.id, id)).returning();
    return updated;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async deleteUser(id: string): Promise<boolean> {
    const result = await db.delete(users).where(eq(users.id, id)).returning();
    return result.length > 0;
  }

  async getDirectReports(managerId: string): Promise<User[]> {
    return db.select().from(users).where(eq(users.managerId, managerId));
  }

  async getExpenses(): Promise<Expense[]> {
    return db.select().from(expenses).orderBy(expenses.createdAt);
  }

  async getExpensesByEmployee(employeeId: string): Promise<Expense[]> {
    return db.select().from(expenses).where(eq(expenses.employeeId, employeeId));
  }

  async getExpensesByStatus(status: string): Promise<Expense[]> {
    return db.select().from(expenses).where(eq(expenses.status, status));
  }

  async getExpensesFiltered(filters: ExpenseFilters): Promise<Expense[]> {
    const conditions = [];
    if (filters.employeeIds && filters.employeeIds.length > 0) {
      conditions.push(inArray(expenses.employeeId, filters.employeeIds));
    }
    if (filters.statuses && filters.statuses.length > 0) {
      conditions.push(inArray(expenses.status, filters.statuses));
    }
    if (filters.categories && filters.categories.length > 0) {
      conditions.push(inArray(expenses.category, filters.categories));
    }
    if (filters.dateFrom) {
      conditions.push(gte(expenses.date, filters.dateFrom));
    }
    if (filters.dateTo) {
      conditions.push(lte(expenses.date, filters.dateTo));
    }
    if (filters.amountMin !== undefined) {
      conditions.push(gte(expenses.amount, String(filters.amountMin)));
    }
    if (filters.amountMax !== undefined) {
      conditions.push(lte(expenses.amount, String(filters.amountMax)));
    }
    if (filters.search) {
      const searchPattern = `%${filters.search}%`;
      conditions.push(or(
        ilike(expenses.description, searchPattern),
        ilike(expenses.employeeName, searchPattern),
        sql`${expenses.notes} ILIKE ${searchPattern}`,
      ));
    }
    const query = conditions.length > 0
      ? db.select().from(expenses).where(and(...conditions)).orderBy(expenses.createdAt)
      : db.select().from(expenses).orderBy(expenses.createdAt);
    return query;
  }

  async getExpense(id: string): Promise<Expense | undefined> {
    const [expense] = await db.select().from(expenses).where(eq(expenses.id, id));
    return expense;
  }

  async createExpense(expense: InsertExpense): Promise<Expense> {
    const [created] = await db.insert(expenses).values(expense).returning();
    return created;
  }

  async updateExpenseStatus(id: string, status: string): Promise<Expense | undefined> {
    const [updated] = await db.update(expenses).set({ status }).where(eq(expenses.id, id)).returning();
    return updated;
  }

  async updateExpense(id: string, data: Partial<InsertExpense>): Promise<Expense | undefined> {
    const [updated] = await db.update(expenses).set(data).where(eq(expenses.id, id)).returning();
    return updated;
  }

  async getCommentsByExpense(expenseId: string): Promise<Comment[]> {
    return db.select().from(comments).where(eq(comments.expenseId, expenseId));
  }

  async createComment(comment: InsertComment): Promise<Comment> {
    const [created] = await db.insert(comments).values(comment).returning();
    return created;
  }

  async getNotificationsByUser(userId: string): Promise<Notification[]> {
    return db.select().from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt))
      .limit(50);
  }

  async createNotification(notification: InsertNotification): Promise<Notification> {
    const [created] = await db.insert(notifications).values(notification).returning();
    return created;
  }

  async markNotificationRead(id: string): Promise<Notification | undefined> {
    const [updated] = await db.update(notifications)
      .set({ isRead: true })
      .where(eq(notifications.id, id))
      .returning();
    return updated;
  }

  async markNotificationReadForUser(id: string, userId: string): Promise<Notification | undefined> {
    const [updated] = await db.update(notifications)
      .set({ isRead: true })
      .where(and(eq(notifications.id, id), eq(notifications.userId, userId)))
      .returning();
    return updated;
  }

  async markAllNotificationsRead(userId: string): Promise<void> {
    await db.update(notifications)
      .set({ isRead: true })
      .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));
  }

  async getUnreadNotificationCount(userId: string): Promise<number> {
    const [{ value }] = await db
      .select({ value: sql<number>`count(*)` })
      .from(notifications)
      .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));
    return Number(value);
  }

  async getExpenseHistory(expenseId: string): Promise<ExpenseHistory[]> {
    return db.select().from(expenseHistory)
      .where(eq(expenseHistory.expenseId, expenseId))
      .orderBy(desc(expenseHistory.createdAt));
  }

  async createExpenseHistory(entry: InsertExpenseHistory): Promise<ExpenseHistory> {
    const [created] = await db.insert(expenseHistory).values(entry).returning();
    return created;
  }

  async getAttachmentsByExpense(expenseId: string): Promise<ExpenseAttachment[]> {
    return db.select().from(expenseAttachments).where(eq(expenseAttachments.expenseId, expenseId));
  }

  async createAttachment(attachment: InsertExpenseAttachment): Promise<ExpenseAttachment> {
    const [created] = await db.insert(expenseAttachments).values(attachment).returning();
    return created;
  }

  async getAttachment(id: string): Promise<ExpenseAttachment | undefined> {
    const [found] = await db.select().from(expenseAttachments).where(eq(expenseAttachments.id, id));
    return found;
  }

  async deleteAttachment(id: string): Promise<boolean> {
    const result = await db.delete(expenseAttachments).where(eq(expenseAttachments.id, id)).returning();
    return result.length > 0;
  }

  async bulkUpdateExpenseStatus(ids: string[], status: string): Promise<Expense[]> {
    const updated = await db.update(expenses).set({ status }).where(inArray(expenses.id, ids)).returning();
    return updated;
  }

  async getActiveQuickbooksToken(): Promise<QuickbooksToken | undefined> {
    const [token] = await db.select().from(quickbooksTokens).where(eq(quickbooksTokens.isActive, true));
    if (!token) return undefined;

    const needsReEncrypt = !isEncrypted(token.accessToken) || !isEncrypted(token.refreshToken);

    const decryptedToken = {
      ...token,
      accessToken: decrypt(token.accessToken),
      refreshToken: decrypt(token.refreshToken),
    };

    if (needsReEncrypt) {
      await db.update(quickbooksTokens).set({
        accessToken: encrypt(decryptedToken.accessToken),
        refreshToken: encrypt(decryptedToken.refreshToken),
        updatedAt: new Date(),
      }).where(eq(quickbooksTokens.id, token.id));
    }

    return decryptedToken;
  }

  async saveQuickbooksToken(token: InsertQuickbooksToken): Promise<QuickbooksToken> {
    const encryptedToken = {
      ...token,
      accessToken: encrypt(token.accessToken),
      refreshToken: encrypt(token.refreshToken),
    };
    const [created] = await db.insert(quickbooksTokens).values(encryptedToken).returning();
    return created;
  }

  async updateQuickbooksToken(id: string, data: Partial<InsertQuickbooksToken>): Promise<QuickbooksToken | undefined> {
    const encryptedData = { ...data };
    if (encryptedData.accessToken) {
      encryptedData.accessToken = encrypt(encryptedData.accessToken);
    }
    if (encryptedData.refreshToken) {
      encryptedData.refreshToken = encrypt(encryptedData.refreshToken);
    }
    const [updated] = await db.update(quickbooksTokens).set({ ...encryptedData, updatedAt: new Date() }).where(eq(quickbooksTokens.id, id)).returning();
    return updated;
  }

  async deactivateAllQuickbooksTokens(): Promise<void> {
    await db.update(quickbooksTokens).set({ isActive: false, updatedAt: new Date() });
  }

  async getQuickbooksBillByExpenseId(expenseId: string): Promise<QuickbooksBill | undefined> {
    const [bill] = await db.select().from(quickbooksBills).where(eq(quickbooksBills.expenseId, expenseId));
    return bill;
  }

  async getQuickbooksBillByPurchaseOrderId(purchaseOrderId: string): Promise<QuickbooksBill | undefined> {
    const [bill] = await db.select().from(quickbooksBills).where(eq(quickbooksBills.purchaseOrderId, purchaseOrderId));
    return bill;
  }

  async getAllQuickbooksBills(): Promise<QuickbooksBill[]> {
    return db.select().from(quickbooksBills).orderBy(desc(quickbooksBills.createdAt));
  }

  async createQuickbooksBill(bill: InsertQuickbooksBill): Promise<QuickbooksBill> {
    const [created] = await db.insert(quickbooksBills).values(bill).returning();
    return created;
  }

  async updateQuickbooksBill(id: string, data: Partial<InsertQuickbooksBill>): Promise<QuickbooksBill | undefined> {
    const [updated] = await db.update(quickbooksBills).set(data).where(eq(quickbooksBills.id, id)).returning();
    return updated;
  }

  async getPendingQuickbooksBills(): Promise<QuickbooksBill[]> {
    return db.select().from(quickbooksBills).where(eq(quickbooksBills.syncStatus, "pending"));
  }

  async getGlMappings(): Promise<GlMapping[]> {
    return db.select().from(glMappings);
  }

  async getGlMappingByCategory(category: string): Promise<GlMapping | undefined> {
    const [mapping] = await db.select().from(glMappings).where(eq(glMappings.category, category));
    return mapping;
  }

  async upsertGlMapping(mapping: InsertGlMapping): Promise<GlMapping> {
    const [result] = await db
      .insert(glMappings)
      .values(mapping)
      .onConflictDoUpdate({
        target: glMappings.category,
        set: {
          accountNumber: mapping.accountNumber,
          accountName: mapping.accountName,
          parentAccountName: mapping.parentAccountName,
          updatedAt: new Date(),
        },
      })
      .returning();
    return result;
  }

  async deleteGlMapping(id: string): Promise<boolean> {
    const [deleted] = await db.delete(glMappings).where(eq(glMappings.id, id)).returning();
    return !!deleted;
  }

  async getActiveCategories(): Promise<ExpenseCategory[]> {
    return db.select().from(expenseCategories).where(eq(expenseCategories.isActive, true)).orderBy(asc(expenseCategories.sortOrder));
  }

  async getAllCategories(): Promise<ExpenseCategory[]> {
    return db.select().from(expenseCategories).orderBy(asc(expenseCategories.sortOrder));
  }

  async createCategory(category: InsertExpenseCategory): Promise<ExpenseCategory> {
    const maxOrder = await db.select().from(expenseCategories).orderBy(desc(expenseCategories.sortOrder));
    const nextOrder = maxOrder.length > 0 ? Number(maxOrder[0].sortOrder) + 1 : 0;
    const [created] = await db.insert(expenseCategories).values({ ...category, sortOrder: String(nextOrder) }).returning();
    return created;
  }

  async deleteCategory(id: string): Promise<boolean> {
    const [deleted] = await db.delete(expenseCategories).where(eq(expenseCategories.id, id)).returning();
    return !!deleted;
  }

  async getPurchaseOrders(): Promise<PurchaseOrder[]> {
    return db.select().from(purchaseOrders).orderBy(desc(purchaseOrders.createdAt));
  }

  async getPurchaseOrdersBySubmitter(submitterId: string): Promise<PurchaseOrder[]> {
    return db.select().from(purchaseOrders).where(eq(purchaseOrders.submitterId, submitterId)).orderBy(desc(purchaseOrders.createdAt));
  }

  async getPurchaseOrder(id: string): Promise<PurchaseOrder | undefined> {
    const [po] = await db.select().from(purchaseOrders).where(eq(purchaseOrders.id, id));
    return po;
  }

  async createPurchaseOrder(po: InsertPurchaseOrder): Promise<PurchaseOrder> {
    const [created] = await db.insert(purchaseOrders).values(po).returning();
    return created;
  }

  async updatePurchaseOrderStatus(id: string, status: string): Promise<PurchaseOrder | undefined> {
    const [updated] = await db.update(purchaseOrders).set({ status }).where(eq(purchaseOrders.id, id)).returning();
    return updated;
  }

  async updatePurchaseOrder(id: string, data: Partial<InsertPurchaseOrder>): Promise<PurchaseOrder | undefined> {
    const [updated] = await db.update(purchaseOrders).set(data).where(eq(purchaseOrders.id, id)).returning();
    return updated;
  }

  // Derived from the highest number actually issued, not from row count: a
  // deleted PO or a manually-typed number would otherwise make count+1 hand
  // back a number that already exists, and po_number is UNIQUE.
  async getNextPoNumber(): Promise<string> {
    const result = await db
      .select({ max: sql<number>`coalesce(max(nullif(regexp_replace(${purchaseOrders.poNumber}, '\\D', '', 'g'), '')::bigint), 0)` })
      .from(purchaseOrders);
    const nextNum = Number(result[0]?.max || 0) + 1;
    return `PO-${String(nextNum).padStart(5, '0')}`;
  }

  async getPoHistory(purchaseOrderId: string): Promise<PoHistory[]> {
    return db.select().from(poHistory).where(eq(poHistory.purchaseOrderId, purchaseOrderId)).orderBy(desc(poHistory.createdAt));
  }

  async createPoHistory(entry: InsertPoHistory): Promise<PoHistory> {
    const [created] = await db.insert(poHistory).values(entry).returning();
    return created;
  }

  async getPoComments(purchaseOrderId: string): Promise<PoComment[]> {
    return db.select().from(poComments).where(eq(poComments.purchaseOrderId, purchaseOrderId));
  }

  async createPoComment(comment: InsertPoComment): Promise<PoComment> {
    const [created] = await db.insert(poComments).values(comment).returning();
    return created;
  }

  async getPoAttachments(purchaseOrderId: string): Promise<PoAttachment[]> {
    return db.select().from(poAttachments).where(eq(poAttachments.purchaseOrderId, purchaseOrderId));
  }

  async createPoAttachment(attachment: InsertPoAttachment): Promise<PoAttachment> {
    const [created] = await db.insert(poAttachments).values(attachment).returning();
    return created;
  }

  async deletePoAttachment(id: string): Promise<boolean> {
    const [deleted] = await db.delete(poAttachments).where(eq(poAttachments.id, id)).returning();
    return !!deleted;
  }

  async getDocuments(): Promise<Document[]> {
    return db.select().from(documents).orderBy(desc(documents.createdAt));
  }

  async getDocumentsByUser(userId: string): Promise<Document[]> {
    return db.select().from(documents).where(eq(documents.uploadedById, userId)).orderBy(desc(documents.createdAt));
  }

  async getDocument(id: string): Promise<Document | undefined> {
    const [doc] = await db.select().from(documents).where(eq(documents.id, id));
    return doc;
  }

  async createDocument(doc: InsertDocument): Promise<Document> {
    const [created] = await db.insert(documents).values(doc).returning();
    return created;
  }

  async deleteDocument(id: string): Promise<boolean> {
    const [deleted] = await db.delete(documents).where(eq(documents.id, id)).returning();
    return !!deleted;
  }

  async getGustoConfig(): Promise<GustoConfig | undefined> {
    const [config] = await db.select().from(gustoConfig).limit(1);
    return config;
  }

  async saveGustoConfig(config: InsertGustoConfig): Promise<GustoConfig> {
    const [created] = await db.insert(gustoConfig).values(config).returning();
    return created;
  }

  async updateGustoConfig(id: string, data: Partial<InsertGustoConfig>): Promise<GustoConfig | undefined> {
    const [updated] = await db.update(gustoConfig).set({ ...data, updatedAt: new Date() }).where(eq(gustoConfig.id, id)).returning();
    return updated;
  }
}

export const storage = new DatabaseStorage();
