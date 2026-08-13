import { sql } from "drizzle-orm";
import { pgTable, text, varchar, numeric, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export * from "./models/auth";

export const roleEnum = z.enum(['Employee', 'Manager', 'General Manager', 'Executive Chairman']);
export type Role = z.infer<typeof roleEnum>;

export const statusEnum = z.enum([
  'Draft', 'Submitted', 'Manager Approved', 'Manager Rejected',
  'GM Approved', 'GM Rejected', 'EC Approved', 'EC Rejected',
  'Accounts Payable', 'AP Rejected', 'Reimbursed', 'Cancelled'
]);
export type ExpenseStatus = z.infer<typeof statusEnum>;

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  role: text("role").notNull().default("Employee"),
  isAdmin: boolean("is_admin").notNull().default(false),
  isAccountsPayable: boolean("is_accounts_payable").notNull().default(false),
  isPOAdmin: boolean("is_po_admin").notNull().default(false),
  managerId: varchar("manager_id"),
  department: text("department"),
  avatarInitials: text("avatar_initials").notNull(),
  profilePicture: text("profile_picture"),
  notifyEmail: boolean("notify_email").notNull().default(false),
  notifyText: boolean("notify_text").notNull().default(false),
  notifyWebex: boolean("notify_webex").notNull().default(false),
  phoneNumber: text("phone_number"),
  oidcId: varchar("oidc_id").unique(),
  profileImageUrl: varchar("profile_image_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const expenses = pgTable("expenses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  description: text("description").notNull(),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  date: text("date").notNull(),
  category: text("category").notNull(),
  status: text("status").notNull().default("Draft"),
  receiptUrl: text("receipt_url"),
  employeeId: varchar("employee_id").notNull().references(() => users.id),
  employeeName: text("employee_name").notNull(),
  notes: text("notes"),
  miles: numeric("miles", { precision: 10, scale: 2 }),
  createdAt: timestamp("created_at").defaultNow(),
});

export const comments = pgTable("comments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  expenseId: varchar("expense_id").notNull().references(() => expenses.id),
  author: text("author").notNull(),
  text: text("text").notNull(),
  date: text("date").notNull(),
});

export const notifications = pgTable("notifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  type: text("type").notNull(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  expenseId: varchar("expense_id").references(() => expenses.id),
  purchaseOrderId: varchar("purchase_order_id"),
  isRead: boolean("is_read").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const expenseHistory = pgTable("expense_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  expenseId: varchar("expense_id").notNull().references(() => expenses.id),
  action: text("action").notNull(),
  fromStatus: text("from_status"),
  toStatus: text("to_status"),
  changedBy: text("changed_by").notNull(),
  details: text("details"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertExpenseHistorySchema = createInsertSchema(expenseHistory).omit({ id: true, createdAt: true });

export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true, updatedAt: true });
export const insertExpenseSchema = createInsertSchema(expenses).omit({ id: true, createdAt: true });
export const insertCommentSchema = createInsertSchema(comments).omit({ id: true });
export const insertNotificationSchema = createInsertSchema(notifications).omit({ id: true, createdAt: true });

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertExpense = z.infer<typeof insertExpenseSchema>;
export type Expense = typeof expenses.$inferSelect;
export type InsertComment = z.infer<typeof insertCommentSchema>;
export type Comment = typeof comments.$inferSelect;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type Notification = typeof notifications.$inferSelect;
export type InsertExpenseHistory = z.infer<typeof insertExpenseHistorySchema>;
export type ExpenseHistory = typeof expenseHistory.$inferSelect;

export const expenseAttachments = pgTable("expense_attachments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  expenseId: varchar("expense_id").notNull().references(() => expenses.id),
  fileName: text("file_name").notNull(),
  fileType: text("file_type").notNull(),
  fileUrl: text("file_url").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertExpenseAttachmentSchema = createInsertSchema(expenseAttachments).omit({ id: true, createdAt: true });
export type InsertExpenseAttachment = z.infer<typeof insertExpenseAttachmentSchema>;
export type ExpenseAttachment = typeof expenseAttachments.$inferSelect;

export const quickbooksTokens = pgTable("quickbooks_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  realmId: text("realm_id").notNull(),
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const quickbooksBills = pgTable("quickbooks_bills", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  expenseId: varchar("expense_id").references(() => expenses.id),
  purchaseOrderId: varchar("purchase_order_id").references(() => purchaseOrders.id),
  qboBillId: text("qbo_bill_id").notNull(),
  qboType: text("qbo_type").notNull().default("bill"),
  syncStatus: text("sync_status").notNull().default("pending"),
  lastSyncAt: timestamp("last_sync_at"),
  error: text("error"),
  vendorName: text("vendor_name"),
  amount: text("amount"),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertQuickbooksTokenSchema = createInsertSchema(quickbooksTokens).omit({ id: true, createdAt: true, updatedAt: true });
export const insertQuickbooksBillSchema = createInsertSchema(quickbooksBills).omit({ id: true, createdAt: true });
export type InsertQuickbooksToken = z.infer<typeof insertQuickbooksTokenSchema>;
export type QuickbooksToken = typeof quickbooksTokens.$inferSelect;
export type InsertQuickbooksBill = z.infer<typeof insertQuickbooksBillSchema>;
export type QuickbooksBill = typeof quickbooksBills.$inferSelect;

export const glMappings = pgTable("gl_mappings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  category: text("category").notNull().unique(),
  accountNumber: text("account_number").notNull(),
  accountName: text("account_name").notNull(),
  parentAccountName: text("parent_account_name"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertGlMappingSchema = createInsertSchema(glMappings).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertGlMapping = z.infer<typeof insertGlMappingSchema>;
export type GlMapping = typeof glMappings.$inferSelect;

export const expenseCategories = pgTable("expense_categories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: numeric("sort_order", { precision: 10, scale: 0 }).notNull().default("0"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertExpenseCategorySchema = createInsertSchema(expenseCategories).omit({ id: true, createdAt: true });
export type InsertExpenseCategory = z.infer<typeof insertExpenseCategorySchema>;
export type ExpenseCategory = typeof expenseCategories.$inferSelect;

export const DEFAULT_CATEGORIES = ["Flights", "Meals", "Hotel", "Mileage", "Taxi"];
export const MILEAGE_RATE = 0.67;

export const poStatusEnum = z.enum([
  'Draft', 'Submitted', 'PO Admin Review', 'PO Admin Rejected',
  'More Info Requested',
  'Manager Approved', 'Manager Rejected',
  'GM Approved', 'GM Rejected', 'EC Approved', 'EC Rejected',
  'Ordering', 'Order Placed',
  'Cancelled'
]);
export type POStatus = z.infer<typeof poStatusEnum>;

export const billingFrequencyEnum = z.enum(['One-Time', 'Recurring']);
export type BillingFrequency = z.infer<typeof billingFrequencyEnum>;

export const usageTypeEnum = z.enum(['Internal', 'Customer', 'Other']);
export type UsageType = z.infer<typeof usageTypeEnum>;

export const purchaseOrders = pgTable("purchase_orders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  poNumber: text("po_number").notNull().unique(),
  vendor: text("vendor").notNull(),
  usage: text("usage").notNull(),
  description: text("description").notNull(),
  cost: numeric("cost", { precision: 10, scale: 2 }).notNull(),
  tax: numeric("tax", { precision: 10, scale: 2 }).notNull().default("0"),
  shipping: numeric("shipping", { precision: 10, scale: 2 }).notNull().default("0"),
  totalCost: numeric("total_cost", { precision: 10, scale: 2 }).notNull(),
  billingFrequency: text("billing_frequency").notNull().default("One-Time"),
  recurringFrequency: text("recurring_frequency"),
  recurringTerm: text("recurring_term"),
  projectName: text("project_name").notNull(),
  keyStakeholder: text("key_stakeholder").notNull(),
  status: text("status").notNull().default("Draft"),
  submitterId: varchar("submitter_id").notNull().references(() => users.id),
  submitterName: text("submitter_name").notNull(),
  notes: text("notes"),
  paymentStatus: text("payment_status"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const poHistory = pgTable("po_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  purchaseOrderId: varchar("purchase_order_id").notNull().references(() => purchaseOrders.id),
  action: text("action").notNull(),
  fromStatus: text("from_status"),
  toStatus: text("to_status"),
  changedBy: text("changed_by").notNull(),
  details: text("details"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const poComments = pgTable("po_comments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  purchaseOrderId: varchar("purchase_order_id").notNull().references(() => purchaseOrders.id),
  author: text("author").notNull(),
  text: text("text").notNull(),
  date: text("date").notNull(),
});

export const poAttachments = pgTable("po_attachments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  purchaseOrderId: varchar("purchase_order_id").notNull().references(() => purchaseOrders.id),
  fileName: text("file_name").notNull(),
  fileType: text("file_type").notNull(),
  fileUrl: text("file_url").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const documentTypeEnum = z.enum(['Invoice', 'W9', 'W8', 'Contract', 'Receipt', 'Quote', 'Insurance', 'License', 'Other']);
export type DocumentType = z.infer<typeof documentTypeEnum>;

export const documents = pgTable("documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  documentType: text("document_type").notNull(),
  fileName: text("file_name").notNull(),
  fileType: text("file_type").notNull(),
  fileData: text("file_data").notNull(),
  fileSize: numeric("file_size"),
  vendor: text("vendor"),
  description: text("description"),
  uploadedById: varchar("uploaded_by_id").notNull(),
  uploadedByName: text("uploaded_by_name").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertDocumentSchema = createInsertSchema(documents).omit({ id: true, createdAt: true });
export type InsertDocument = z.infer<typeof insertDocumentSchema>;
export type Document = typeof documents.$inferSelect;

export const insertPurchaseOrderSchema = createInsertSchema(purchaseOrders).omit({ id: true, createdAt: true });
export const insertPoHistorySchema = createInsertSchema(poHistory).omit({ id: true, createdAt: true });
export const insertPoCommentSchema = createInsertSchema(poComments).omit({ id: true });
export const insertPoAttachmentSchema = createInsertSchema(poAttachments).omit({ id: true, createdAt: true });

export type InsertPurchaseOrder = z.infer<typeof insertPurchaseOrderSchema>;
export type PurchaseOrder = typeof purchaseOrders.$inferSelect;
export type InsertPoHistory = z.infer<typeof insertPoHistorySchema>;
export type PoHistory = typeof poHistory.$inferSelect;
export type InsertPoComment = z.infer<typeof insertPoCommentSchema>;
export type PoComment = typeof poComments.$inferSelect;
export type InsertPoAttachment = z.infer<typeof insertPoAttachmentSchema>;
export type PoAttachment = typeof poAttachments.$inferSelect;

export const gustoConfig = pgTable("gusto_config", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  companyId: text("company_id"),
  companyName: text("company_name"),
  isConnected: boolean("is_connected").notNull().default(false),
  syncEnabled: boolean("sync_enabled").notNull().default(false),
  lastSyncAt: timestamp("last_sync_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertGustoConfigSchema = createInsertSchema(gustoConfig).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertGustoConfig = z.infer<typeof insertGustoConfigSchema>;
export type GustoConfig = typeof gustoConfig.$inferSelect;
