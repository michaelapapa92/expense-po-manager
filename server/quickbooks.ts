import { storage } from "./storage";
import type { Expense, PurchaseOrder } from "@shared/schema";

const QBO_AUTH_URL = "https://appcenter.intuit.com/connect/oauth2";
const QBO_TOKEN_URL = "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer";
const QBO_REVOKE_URL = "https://developer.api.intuit.com/v2/oauth2/tokens/revoke";
const QBO_API_BASE_SANDBOX = "https://sandbox-quickbooks.api.intuit.com";
const QBO_API_BASE_PRODUCTION = "https://quickbooks.api.intuit.com";

function getClientId(): string {
  return process.env.QBO_CLIENT_ID || "";
}

function getClientSecret(): string {
  return process.env.QBO_CLIENT_SECRET || "";
}

function getRedirectUri(): string {
  const base = process.env.APP_URL || "https://expense-flow-papa92.replit.app";
  return `${base}/api/quickbooks/callback`;
}

function isSandbox(): boolean {
  return process.env.QBO_SANDBOX === "true";
}

function getApiBase(): string {
  return isSandbox() ? QBO_API_BASE_SANDBOX : QBO_API_BASE_PRODUCTION;
}

export function isQuickbooksConfigured(): boolean {
  return !!(getClientId() && getClientSecret());
}

export function getAuthorizationUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: getClientId(),
    redirect_uri: getRedirectUri(),
    response_type: "code",
    scope: "com.intuit.quickbooks.accounting",
    state,
  });
  return `${QBO_AUTH_URL}?${params.toString()}`;
}

export async function exchangeCodeForTokens(code: string): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  realmId?: string;
}> {
  const basicAuth = Buffer.from(`${getClientId()}:${getClientSecret()}`).toString("base64");

  const response = await fetch(QBO_TOKEN_URL, {
    method: "POST",
    headers: {
      "Authorization": `Basic ${basicAuth}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "Accept": "application/json",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: getRedirectUri(),
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Token exchange failed: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
  };
}

export async function refreshAccessToken(refreshToken: string): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}> {
  const basicAuth = Buffer.from(`${getClientId()}:${getClientSecret()}`).toString("base64");

  const response = await fetch(QBO_TOKEN_URL, {
    method: "POST",
    headers: {
      "Authorization": `Basic ${basicAuth}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "Accept": "application/json",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Token refresh failed: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
  };
}

export async function revokeToken(token: string): Promise<void> {
  const basicAuth = Buffer.from(`${getClientId()}:${getClientSecret()}`).toString("base64");

  await fetch(QBO_REVOKE_URL, {
    method: "POST",
    headers: {
      "Authorization": `Basic ${basicAuth}`,
      "Content-Type": "application/json",
      "Accept": "application/json",
    },
    body: JSON.stringify({ token }),
  });
}

async function getValidToken(): Promise<{ accessToken: string; realmId: string } | null> {
  const tokenRecord = await storage.getActiveQuickbooksToken();
  if (!tokenRecord) return null;

  const now = new Date();
  const bufferMs = 5 * 60 * 1000;

  if (tokenRecord.expiresAt.getTime() - bufferMs > now.getTime()) {
    return { accessToken: tokenRecord.accessToken, realmId: tokenRecord.realmId };
  }

  try {
    const refreshed = await refreshAccessToken(tokenRecord.refreshToken);
    const expiresAt = new Date(Date.now() + refreshed.expiresIn * 1000);
    await storage.updateQuickbooksToken(tokenRecord.id, {
      accessToken: refreshed.accessToken,
      refreshToken: refreshed.refreshToken,
      expiresAt,
    });
    return { accessToken: refreshed.accessToken, realmId: tokenRecord.realmId };
  } catch (error) {
    console.error("[quickbooks] Token refresh failed:", error);
    await storage.updateQuickbooksToken(tokenRecord.id, { isActive: false } as any);
    return null;
  }
}

async function qboRequest(method: string, path: string, body?: any): Promise<any> {
  const token = await getValidToken();
  if (!token) throw new Error("QuickBooks not connected");

  const url = `${getApiBase()}/v3/company/${token.realmId}${path}`;
  const headers: Record<string, string> = {
    "Authorization": `Bearer ${token.accessToken}`,
    "Accept": "application/json",
    "Content-Type": "application/json",
  };

  const response = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const intuitTid = response.headers.get("intuit_tid") || "unknown";

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[quickbooks] API error — method: ${method}, path: ${path}, status: ${response.status}, intuit_tid: ${intuitTid}, body: ${errorText}`);
    throw new Error(`QBO API error: ${response.status} ${errorText} (intuit_tid: ${intuitTid})`);
  }

  console.log(`[quickbooks] API success — method: ${method}, path: ${path}, status: ${response.status}, intuit_tid: ${intuitTid}`);
  return response.json();
}

function dataUrlToBuffer(dataUrl: string): { buffer: Buffer; mimeType: string; extension: string } {
  const match = dataUrl.match(/^data:([\w\/\+\-\.]+);base64,(.+)$/);
  if (!match) throw new Error("Invalid data URL format");
  const mimeType = match[1];
  const buffer = Buffer.from(match[2], "base64");
  const extMap: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/gif": "gif",
    "image/webp": "webp",
    "application/pdf": "pdf",
    "image/heic": "heic",
    "image/heif": "heif",
  };
  const extension = extMap[mimeType] || "jpg";
  return { buffer, mimeType, extension };
}

async function uploadAttachmentToBill(qboBillId: string, fileName: string, dataUrl: string): Promise<void> {
  const token = await getValidToken();
  if (!token) throw new Error("QuickBooks not connected");

  const { buffer, mimeType, extension } = dataUrlToBuffer(dataUrl);
  const actualFileName = fileName.includes(".") ? fileName : `${fileName}.${extension}`;

  const boundary = `----QBOBoundary${Date.now()}`;

  const attachableMetadata = JSON.stringify({
    AttachableRef: [
      {
        EntityRef: {
          type: "Bill",
          value: qboBillId,
        },
        IncludeOnSend: true,
      },
    ],
    FileName: actualFileName,
    ContentType: mimeType,
  });

  const bodyParts: Buffer[] = [];
  bodyParts.push(Buffer.from(`--${boundary}\r\n`));
  bodyParts.push(Buffer.from(`Content-Disposition: form-data; name="file_metadata_0"\r\n`));
  bodyParts.push(Buffer.from(`Content-Type: application/json\r\n\r\n`));
  bodyParts.push(Buffer.from(attachableMetadata));
  bodyParts.push(Buffer.from(`\r\n--${boundary}\r\n`));
  bodyParts.push(Buffer.from(`Content-Disposition: form-data; name="file_content_0"; filename="${actualFileName}"\r\n`));
  bodyParts.push(Buffer.from(`Content-Type: ${mimeType}\r\n\r\n`));
  bodyParts.push(buffer);
  bodyParts.push(Buffer.from(`\r\n--${boundary}--\r\n`));

  const fullBody = Buffer.concat(bodyParts);

  const url = `${getApiBase()}/v3/company/${token.realmId}/upload`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token.accessToken}`,
      "Content-Type": `multipart/form-data; boundary=${boundary}`,
      "Accept": "application/json",
    },
    body: fullBody,
  });

  const intuitTid = response.headers.get("intuit_tid") || "unknown";

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[quickbooks] Attachment upload error — status: ${response.status}, intuit_tid: ${intuitTid}, body: ${errorText}`);
    throw new Error(`QBO attachment upload failed: ${response.status} ${errorText}`);
  }

  console.log(`[quickbooks] Attachment "${actualFileName}" uploaded to bill ${qboBillId} (intuit_tid: ${intuitTid})`);
}

async function uploadExpenseAttachmentsToBill(expense: Expense, qboBillId: string): Promise<void> {
  try {
    const attachmentFiles: Array<{ fileName: string; dataUrl: string }> = [];

    if (expense.receiptUrl && expense.receiptUrl.startsWith("data:")) {
      attachmentFiles.push({ fileName: "receipt", dataUrl: expense.receiptUrl });
    }

    const dbAttachments = await storage.getAttachmentsByExpense(expense.id);
    for (const att of dbAttachments) {
      if (att.fileUrl && att.fileUrl.startsWith("data:")) {
        attachmentFiles.push({ fileName: att.fileName, dataUrl: att.fileUrl });
      }
    }

    if (attachmentFiles.length === 0) {
      console.log(`[quickbooks] No attachments found for expense ${expense.id}`);
      return;
    }

    console.log(`[quickbooks] Uploading ${attachmentFiles.length} attachment(s) for expense ${expense.id} to bill ${qboBillId}`);

    for (const file of attachmentFiles) {
      try {
        await uploadAttachmentToBill(qboBillId, file.fileName, file.dataUrl);
      } catch (err) {
        console.error(`[quickbooks] Failed to upload attachment "${file.fileName}" for expense ${expense.id}:`, err);
      }
    }
  } catch (error) {
    console.error(`[quickbooks] Error uploading attachments for expense ${expense.id}:`, error);
  }
}

async function findOrCreateVendor(vendorDisplayName: string): Promise<string> {
  try {
    const query = `SELECT * FROM Vendor WHERE DisplayName = '${vendorDisplayName.replace(/'/g, "\\'")}'`;
    const result = await qboRequest("GET", `/query?query=${encodeURIComponent(query)}`);
    const vendors = result?.QueryResponse?.Vendor;
    if (vendors && vendors.length > 0) {
      return vendors[0].Id;
    }
  } catch (e) {
    console.error("[quickbooks] Vendor query failed:", e);
  }

  const newVendor = await qboRequest("POST", "/vendor", {
    DisplayName: vendorDisplayName,
  });
  return newVendor.Vendor.Id;
}

const FALLBACK_GL_MAP: Record<string, { accountNumber: string; accountName: string; parentName: string }> = {
  "Flights": { accountNumber: "6305", accountName: "Airfare", parentName: "Travel and Entertainment" },
  "Meals": { accountNumber: "6301", accountName: "Meals & Entertainment -Standard", parentName: "Travel and Entertainment" },
  "Hotel": { accountNumber: "6306", accountName: "Hotel", parentName: "Travel and Entertainment" },
  "Mileage": { accountNumber: "6303", accountName: "Mileage", parentName: "Travel and Entertainment" },
  "Taxi": { accountNumber: "6304", accountName: "Local Transportation", parentName: "Travel and Entertainment" },
};

const DEFAULT_GL = { accountNumber: "6300", accountName: "Travel and Entertainment", parentName: "" };

async function getGlMappingForCategory(category?: string): Promise<{ accountNumber: string; accountName: string; parentName: string }> {
  if (!category) return DEFAULT_GL;

  try {
    const dbMapping = await storage.getGlMappingByCategory(category);
    if (dbMapping) {
      return {
        accountNumber: dbMapping.accountNumber,
        accountName: dbMapping.accountName,
        parentName: dbMapping.parentAccountName || "",
      };
    }
  } catch (e) {
    console.error("[quickbooks] Error fetching GL mapping from DB:", e);
  }

  return FALLBACK_GL_MAP[category] || DEFAULT_GL;
}

async function findOrCreateAccount(category?: string): Promise<string> {
  const glMapping = await getGlMappingForCategory(category);
  const fullAccountName = glMapping.parentName
    ? `${glMapping.parentName}:${glMapping.accountName}`
    : glMapping.accountName;

  try {
    const query = `SELECT * FROM Account WHERE FullyQualifiedName = '${fullAccountName.replace(/'/g, "\\'")}'`;
    const result = await qboRequest("GET", `/query?query=${encodeURIComponent(query)}`);
    const accounts = result?.QueryResponse?.Account;
    if (accounts && accounts.length > 0) {
      console.log(`[quickbooks] Found existing GL account: ${fullAccountName} (ID: ${accounts[0].Id})`);
      return accounts[0].Id;
    }
  } catch (e) {
    console.error("[quickbooks] Account query failed:", e);
  }

  try {
    const nameQuery = `SELECT * FROM Account WHERE Name = '${glMapping.accountName.replace(/'/g, "\\'")}'`;
    const nameResult = await qboRequest("GET", `/query?query=${encodeURIComponent(nameQuery)}`);
    const nameAccounts = nameResult?.QueryResponse?.Account;
    if (nameAccounts && nameAccounts.length > 0) {
      console.log(`[quickbooks] Found GL account by name: ${glMapping.accountName} (ID: ${nameAccounts[0].Id})`);
      return nameAccounts[0].Id;
    }
  } catch (e) {
    console.error("[quickbooks] Account name query failed:", e);
  }

  let parentId: string | undefined;
  if (glMapping.parentName) {
    try {
      const parentQuery = `SELECT * FROM Account WHERE Name = '${glMapping.parentName.replace(/'/g, "\\'")}' AND AccountType = 'Expense'`;
      const parentResult = await qboRequest("GET", `/query?query=${encodeURIComponent(parentQuery)}`);
      const parentAccounts = parentResult?.QueryResponse?.Account;
      if (parentAccounts && parentAccounts.length > 0) {
        parentId = parentAccounts[0].Id;
      } else {
        const newParent = await qboRequest("POST", "/account", {
          Name: glMapping.parentName,
          AccountType: "Expense",
          AcctNum: "6300",
        });
        parentId = newParent.Account.Id;
      }
    } catch (e) {
      console.error("[quickbooks] Parent account query/create failed:", e);
    }
  }

  const newAccountData: any = {
    Name: glMapping.accountName,
    AccountType: "Expense",
    AccountSubType: "TravelExpenses",
    AcctNum: glMapping.accountNumber,
  };
  if (parentId) {
    newAccountData.ParentRef = { value: parentId };
    newAccountData.SubAccount = true;
  }

  const newAccount = await qboRequest("POST", "/account", newAccountData);
  console.log(`[quickbooks] Created GL account: ${fullAccountName} (ID: ${newAccount.Account.Id})`);
  return newAccount.Account.Id;
}

export async function createBillForExpense(expense: Expense): Promise<string | null> {
  try {
    const existingBill = await storage.getQuickbooksBillByExpenseId(expense.id);
    if (existingBill) {
      console.log(`[quickbooks] Bill already exists for expense ${expense.id}`);
      return existingBill.qboBillId;
    }

    const token = await getValidToken();
    if (!token) {
      console.log("[quickbooks] Not connected, skipping bill creation");
      return null;
    }

    const vendorId = await findOrCreateVendor(`${expense.employeeName} Expenses`);
    const accountId = await findOrCreateAccount(expense.category);

    const vendorDescription = expense.category === "Mileage"
      ? `Mileage - ${expense.description}`
      : `${expense.category} - ${expense.description}`;

    const billData = {
      VendorRef: { value: vendorId },
      Line: [
        {
          DetailType: "AccountBasedExpenseLineDetail",
          Amount: parseFloat(expense.amount),
          AccountBasedExpenseLineDetail: {
            AccountRef: { value: accountId },
          },
          Description: vendorDescription,
        },
      ],
      TxnDate: expense.date,
    };

    const result = await qboRequest("POST", "/bill", billData);
    const qboBillId = result.Bill.Id;

    await storage.createQuickbooksBill({
      expenseId: expense.id,
      qboBillId,
      syncStatus: "pending",
      vendorName: `${expense.employeeName} Expenses`,
      amount: expense.amount,
      description: `${expense.category} - ${expense.description}`,
    });

    console.log(`[quickbooks] Bill ${qboBillId} created for expense ${expense.id}`);

    await uploadExpenseAttachmentsToBill(expense, qboBillId);

    return qboBillId;
  } catch (error) {
    console.error("[quickbooks] Failed to create bill:", error);
    return null;
  }
}

export async function checkBillPaymentStatus(qboBillId: string, realmId?: string): Promise<"paid" | "unpaid" | "error"> {
  try {
    const result = await qboRequest("GET", `/bill/${qboBillId}`);
    const bill = result.Bill;

    if (bill.Balance === 0) {
      return "paid";
    }
    return "unpaid";
  } catch (error) {
    console.error(`[quickbooks] Failed to check bill ${qboBillId}:`, error);
    return "error";
  }
}

export async function syncPendingBills(): Promise<{
  synced: number;
  errors: number;
  total: number;
}> {
  const pendingBills = await storage.getPendingQuickbooksBills();
  let synced = 0;
  let errors = 0;

  for (const bill of pendingBills) {
    try {
      const status = await checkBillPaymentStatus(bill.qboBillId);

      if (status === "paid") {
        const expense = await storage.getExpense(bill.expenseId);
        if (expense && expense.status !== "Reimbursed") {
          await storage.updateExpenseStatus(bill.expenseId, "Reimbursed");

          await storage.createExpenseHistory({
            expenseId: bill.expenseId,
            action: "status_change",
            fromStatus: expense.status,
            toStatus: "Reimbursed",
            changedBy: "QuickBooks Sync",
            details: "Automatically marked as reimbursed after QuickBooks bill was paid",
          });

          await storage.createNotification({
            userId: expense.employeeId,
            type: "approval",
            title: "Expense Reimbursed",
            message: `Your expense "${expense.description}" ($${expense.amount}) has been paid via QuickBooks.`,
            expenseId: expense.id,
            isRead: false,
          });
        }

        await storage.updateQuickbooksBill(bill.id, {
          syncStatus: "paid",
          lastSyncAt: new Date(),
          error: null,
        });
        synced++;
      } else if (status === "error") {
        await storage.updateQuickbooksBill(bill.id, {
          lastSyncAt: new Date(),
          error: "Failed to check bill status",
        });
        errors++;
      } else {
        await storage.updateQuickbooksBill(bill.id, {
          lastSyncAt: new Date(),
        });
      }
    } catch (error) {
      console.error(`[quickbooks] Sync error for bill ${bill.id}:`, error);
      await storage.updateQuickbooksBill(bill.id, {
        lastSyncAt: new Date(),
        error: String(error),
      });
      errors++;
    }
  }

  return { synced, errors, total: pendingBills.length };
}

const PO_DEFAULT_GL = { accountNumber: "5000", accountName: "Cost of Goods Sold", parentName: "" };

async function getGlMappingForPO(): Promise<{ accountNumber: string; accountName: string; parentName: string }> {
  try {
    const dbMapping = await storage.getGlMappingByCategory("Purchase Orders");
    if (dbMapping) {
      return {
        accountNumber: dbMapping.accountNumber,
        accountName: dbMapping.accountName,
        parentName: dbMapping.parentAccountName || "",
      };
    }
  } catch (e) {
    console.error("[quickbooks] Error fetching PO GL mapping from DB:", e);
  }
  return PO_DEFAULT_GL;
}

async function findOrCreatePOAccount(): Promise<string> {
  const glMapping = await getGlMappingForPO();
  const fullAccountName = glMapping.parentName
    ? `${glMapping.parentName}:${glMapping.accountName}`
    : glMapping.accountName;

  try {
    const query = `SELECT * FROM Account WHERE FullyQualifiedName = '${fullAccountName.replace(/'/g, "\\'")}'`;
    const result = await qboRequest("GET", `/query?query=${encodeURIComponent(query)}`);
    const accounts = result?.QueryResponse?.Account;
    if (accounts && accounts.length > 0) {
      return accounts[0].Id;
    }
  } catch (e) {
    console.error("[quickbooks] PO account query failed:", e);
  }

  try {
    const nameQuery = `SELECT * FROM Account WHERE Name = '${glMapping.accountName.replace(/'/g, "\\'")}'`;
    const nameResult = await qboRequest("GET", `/query?query=${encodeURIComponent(nameQuery)}`);
    const nameAccounts = nameResult?.QueryResponse?.Account;
    if (nameAccounts && nameAccounts.length > 0) {
      return nameAccounts[0].Id;
    }
  } catch (e) {
    console.error("[quickbooks] PO account name query failed:", e);
  }

  const newAccount = await qboRequest("POST", "/account", {
    Name: glMapping.accountName,
    AccountType: "Expense",
    AcctNum: glMapping.accountNumber,
  });
  return newAccount.Account.Id;
}

export async function createBillForPurchaseOrder(po: PurchaseOrder): Promise<string | null> {
  try {
    const existingBill = await storage.getQuickbooksBillByPurchaseOrderId(po.id);
    if (existingBill) {
      console.log(`[quickbooks] Bill already exists for PO ${po.poNumber}`);
      return existingBill.qboBillId;
    }

    const token = await getValidToken();
    if (!token) {
      console.log("[quickbooks] Not connected, skipping PO bill creation");
      return null;
    }

    const vendorId = await findOrCreateVendor(po.vendor);
    const accountId = await findOrCreatePOAccount();

    const billData = {
      VendorRef: { value: vendorId },
      Line: [
        {
          DetailType: "AccountBasedExpenseLineDetail",
          Amount: parseFloat(po.totalCost),
          AccountBasedExpenseLineDetail: {
            AccountRef: { value: accountId },
          },
          Description: `PO ${po.poNumber} - ${po.description}`,
        },
      ],
      DocNumber: po.poNumber,
      PrivateNote: `Purchase Order ${po.poNumber} - ${po.description}. Project: ${po.projectName}. Stakeholder: ${po.keyStakeholder}.`,
    };

    const result = await qboRequest("POST", "/bill", billData);
    const qboBillId = result.Bill.Id;

    await storage.createQuickbooksBill({
      purchaseOrderId: po.id,
      qboBillId,
      qboType: "bill",
      syncStatus: "pending",
      vendorName: po.vendor,
      amount: po.totalCost,
      description: `PO ${po.poNumber} - ${po.description}`,
    });

    console.log(`[quickbooks] Bill ${qboBillId} created for PO ${po.poNumber} (accrual)`);

    const attachments = await storage.getPoAttachments(po.id);
    for (const att of attachments) {
      if (att.fileUrl && att.fileUrl.startsWith("data:")) {
        try {
          await uploadAttachmentToBill(qboBillId, att.fileName, att.fileUrl);
        } catch (err) {
          console.error(`[quickbooks] Failed to upload PO attachment "${att.fileName}":`, err);
        }
      }
    }

    return qboBillId;
  } catch (error) {
    console.error("[quickbooks] Failed to create bill for PO:", error);
    return null;
  }
}

export async function createExpenseForPurchaseOrder(po: PurchaseOrder): Promise<string | null> {
  try {
    const existingBill = await storage.getQuickbooksBillByPurchaseOrderId(po.id);
    if (existingBill) {
      console.log(`[quickbooks] QBO record already exists for PO ${po.poNumber}`);
      return existingBill.qboBillId;
    }

    const token = await getValidToken();
    if (!token) {
      console.log("[quickbooks] Not connected, skipping PO expense creation");
      return null;
    }

    const vendorId = await findOrCreateVendor(po.vendor);
    const accountId = await findOrCreatePOAccount();

    let bankAccountId: string | undefined;
    try {
      const bankQuery = `SELECT * FROM Account WHERE AccountType = 'Bank' AND Active = true`;
      const bankResult = await qboRequest("GET", `/query?query=${encodeURIComponent(bankQuery)}`);
      const bankAccounts = bankResult?.QueryResponse?.Account;
      if (bankAccounts && bankAccounts.length > 0) {
        bankAccountId = bankAccounts[0].Id;
      }
    } catch (e) {
      console.error("[quickbooks] Bank account query failed:", e);
    }

    const purchaseData: any = {
      PaymentType: "Cash",
      EntityRef: { value: vendorId, type: "Vendor" },
      Line: [
        {
          DetailType: "AccountBasedExpenseLineDetail",
          Amount: parseFloat(po.totalCost),
          AccountBasedExpenseLineDetail: {
            AccountRef: { value: accountId },
          },
          Description: `PO ${po.poNumber} - ${po.description}`,
        },
      ],
      DocNumber: po.poNumber,
      PrivateNote: `Purchase Order ${po.poNumber} - ${po.description}. Project: ${po.projectName}. Stakeholder: ${po.keyStakeholder}.`,
    };

    if (bankAccountId) {
      purchaseData.AccountRef = { value: bankAccountId };
    }

    const result = await qboRequest("POST", "/purchase", purchaseData);
    const qboExpenseId = result.Purchase.Id;

    await storage.createQuickbooksBill({
      purchaseOrderId: po.id,
      qboBillId: qboExpenseId,
      qboType: "expense",
      syncStatus: "paid",
      vendorName: po.vendor,
      amount: po.totalCost,
      description: `PO ${po.poNumber} - ${po.description}`,
    });

    console.log(`[quickbooks] Expense ${qboExpenseId} created for PO ${po.poNumber} (already paid)`);

    const attachments = await storage.getPoAttachments(po.id);
    for (const att of attachments) {
      if (att.fileUrl && att.fileUrl.startsWith("data:")) {
        try {
          await uploadAttachmentToBill(qboExpenseId, att.fileName, att.fileUrl);
        } catch (err) {
          console.error(`[quickbooks] Failed to upload PO attachment "${att.fileName}":`, err);
        }
      }
    }

    return qboExpenseId;
  } catch (error) {
    console.error("[quickbooks] Failed to create expense for PO:", error);
    return null;
  }
}
