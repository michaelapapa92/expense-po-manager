import { ClientSecretCredential } from "@azure/identity";
import { Client } from "@microsoft/microsoft-graph-client";
import { TokenCredentialAuthenticationProvider } from "@microsoft/microsoft-graph-client/authProviders/azureTokenCredentials/index.js";

const TENANT_ID = process.env.MS_TENANT_ID;
const CLIENT_ID = process.env.MS_CLIENT_ID;
const CLIENT_SECRET = process.env.MS_CLIENT_SECRET;
const SEND_FROM = process.env.MS_SEND_FROM_EMAIL || "expenses@aseva.com";

let graphClient: Client | null = null;

function getGraphClient(): Client | null {
  if (graphClient) return graphClient;
  if (!TENANT_ID || !CLIENT_ID || !CLIENT_SECRET) {
    console.warn("[email] Missing MS_TENANT_ID, MS_CLIENT_ID, or MS_CLIENT_SECRET — email notifications disabled");
    return null;
  }

  const credential = new ClientSecretCredential(TENANT_ID, CLIENT_ID, CLIENT_SECRET);
  const authProvider = new TokenCredentialAuthenticationProvider(credential, {
    scopes: ["https://graph.microsoft.com/.default"],
  });

  graphClient = Client.initWithMiddleware({ authProvider });
  return graphClient;
}

interface EmailOptions {
  to: string;
  subject: string;
  body: string;
}

export async function sendEmail(options: EmailOptions): Promise<boolean> {
  const client = getGraphClient();
  if (!client) return false;

  try {
    await client.api(`/users/${SEND_FROM}/sendMail`).post({
      message: {
        subject: options.subject,
        body: {
          contentType: "HTML",
          content: options.body,
        },
        toRecipients: [
          {
            emailAddress: {
              address: options.to,
            },
          },
        ],
      },
      saveToSentItems: false,
    });
    console.log(`[email] Sent to ${options.to}: ${options.subject}`);
    return true;
  } catch (error: any) {
    console.error(`[email] Failed to send to ${options.to}:`, error?.message || error);
    return false;
  }
}

function getAppUrl(): string {
  return process.env.APP_URL || `https://${process.env.REPLIT_DEV_DOMAIN || process.env.REPLIT_DOMAINS || "localhost:5000"}`;
}

function buildViewButton(expenseId?: string): string {
  if (!expenseId) return "";
  const appUrl = getAppUrl();
  return `
    <div style="margin:24px 0 8px;text-align:center;">
      <a href="${appUrl}/approvals?highlight=${expenseId}" style="display:inline-block;background-color:#0d9488;color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:6px;font-weight:600;font-size:14px;">View Expense in ReimburseFlow</a>
    </div>`;
}

function wrapInTemplate(title: string, content: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#f4f6f9;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f6f9;padding:32px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
          <tr>
            <td style="background-color:#0f2b4c;padding:24px 32px;">
              <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:600;">ReimburseFlow</h1>
              <p style="margin:4px 0 0;color:#5eead4;font-size:13px;">Expense Management System</p>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <h2 style="margin:0 0 16px;color:#0f2b4c;font-size:18px;">${title}</h2>
              ${content}
            </td>
          </tr>
          <tr>
            <td style="background-color:#f8fafc;padding:16px 32px;border-top:1px solid #e2e8f0;">
              <p style="margin:0;color:#94a3b8;font-size:12px;">This is an automated notification from ReimburseFlow. Please do not reply to this email.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function formatCurrency(amount: string | number): string {
  return `$${parseFloat(String(amount)).toFixed(2)}`;
}

export function buildExpenseSubmittedEmail(data: {
  employeeName: string;
  description: string;
  amount: string | number;
  category: string;
  date: string;
  expenseId?: string;
}): { subject: string; body: string } {
  return {
    subject: `New Expense to Review: ${data.description}`,
    body: wrapInTemplate("New Expense Submitted for Your Approval", `
      <p style="color:#475569;line-height:1.6;margin:0 0 16px;">
        <strong>${data.employeeName}</strong> has submitted a new expense that requires your approval.
      </p>
      <table width="100%" cellpadding="8" cellspacing="0" style="background-color:#f8fafc;border-radius:6px;margin:16px 0;">
        <tr><td style="color:#64748b;width:120px;">Description</td><td style="color:#0f172a;font-weight:500;">${data.description}</td></tr>
        <tr><td style="color:#64748b;">Amount</td><td style="color:#0f172a;font-weight:600;">${formatCurrency(data.amount)}</td></tr>
        <tr><td style="color:#64748b;">Category</td><td style="color:#0f172a;">${data.category}</td></tr>
        <tr><td style="color:#64748b;">Date</td><td style="color:#0f172a;">${data.date}</td></tr>
      </table>
      ${buildViewButton(data.expenseId)}
    `),
  };
}

export function buildStatusChangeEmail(data: {
  employeeName: string;
  description: string;
  amount: string | number;
  newStatus: string;
  rejectionNote?: string;
  expenseId?: string;
}): { subject: string; body: string } {
  const isRejection = data.newStatus.includes("Rejected");
  const isReimbursed = data.newStatus === "Reimbursed";

  let statusColor = "#0d9488";
  let statusLabel = "Approved";
  if (isRejection) {
    statusColor = "#dc2626";
    statusLabel = "Rejected";
  } else if (isReimbursed) {
    statusColor = "#059669";
    statusLabel = "Reimbursed";
  }

  let rejectionHtml = "";
  if (isRejection && data.rejectionNote) {
    rejectionHtml = `
      <div style="background-color:#fef2f2;border-left:4px solid #dc2626;padding:12px 16px;margin:16px 0;border-radius:0 6px 6px 0;">
        <p style="margin:0 0 4px;color:#991b1b;font-size:13px;font-weight:600;">Rejection Note:</p>
        <p style="margin:0;color:#7f1d1d;line-height:1.5;">${data.rejectionNote}</p>
      </div>`;
  }

  return {
    subject: `Expense ${statusLabel}: ${data.description}`,
    body: wrapInTemplate(`Expense ${statusLabel}`, `
      <p style="color:#475569;line-height:1.6;margin:0 0 16px;">
        Your expense has been updated to a new status.
      </p>
      <table width="100%" cellpadding="8" cellspacing="0" style="background-color:#f8fafc;border-radius:6px;margin:16px 0;">
        <tr><td style="color:#64748b;width:120px;">Description</td><td style="color:#0f172a;font-weight:500;">${data.description}</td></tr>
        <tr><td style="color:#64748b;">Amount</td><td style="color:#0f172a;font-weight:600;">${formatCurrency(data.amount)}</td></tr>
        <tr><td style="color:#64748b;">Status</td><td><span style="color:${statusColor};font-weight:600;">${data.newStatus}</span></td></tr>
      </table>
      ${rejectionHtml}
      ${buildViewButton(data.expenseId)}
      ${isRejection ? '<p style="color:#475569;line-height:1.6;margin:16px 0 0;">You can edit and resubmit this expense in ReimburseFlow.</p>' : ""}
    `),
  };
}

export function buildCommentEmail(data: {
  commentAuthor: string;
  description: string;
  amount: string | number;
  commentText: string;
  expenseId?: string;
}): { subject: string; body: string } {
  return {
    subject: `New Comment on Expense: ${data.description}`,
    body: wrapInTemplate("New Comment on Your Expense", `
      <p style="color:#475569;line-height:1.6;margin:0 0 16px;">
        <strong>${data.commentAuthor}</strong> commented on your expense.
      </p>
      <table width="100%" cellpadding="8" cellspacing="0" style="background-color:#f8fafc;border-radius:6px;margin:16px 0;">
        <tr><td style="color:#64748b;width:120px;">Expense</td><td style="color:#0f172a;font-weight:500;">${data.description}</td></tr>
        <tr><td style="color:#64748b;">Amount</td><td style="color:#0f172a;font-weight:600;">${formatCurrency(data.amount)}</td></tr>
      </table>
      <div style="background-color:#f0fdfa;border-left:4px solid #0d9488;padding:12px 16px;margin:16px 0;border-radius:0 6px 6px 0;">
        <p style="margin:0 0 4px;color:#0f766e;font-size:13px;font-weight:600;">${data.commentAuthor} wrote:</p>
        <p style="margin:0;color:#134e4a;line-height:1.5;">${data.commentText}</p>
      </div>
      ${buildViewButton(data.expenseId)}
    `),
  };
}

export function buildApprovalNeededEmail(data: {
  approverName: string;
  employeeName: string;
  description: string;
  amount: string | number;
  stage: string;
  expenseId?: string;
}): { subject: string; body: string } {
  return {
    subject: `Approval Needed: ${data.description} (${formatCurrency(data.amount)})`,
    body: wrapInTemplate("Expense Awaiting Your Approval", `
      <p style="color:#475569;line-height:1.6;margin:0 0 16px;">
        Hi ${data.approverName}, an expense has advanced to the <strong>${data.stage}</strong> stage and requires your action.
      </p>
      <table width="100%" cellpadding="8" cellspacing="0" style="background-color:#f8fafc;border-radius:6px;margin:16px 0;">
        <tr><td style="color:#64748b;width:120px;">Submitted By</td><td style="color:#0f172a;font-weight:500;">${data.employeeName}</td></tr>
        <tr><td style="color:#64748b;">Description</td><td style="color:#0f172a;">${data.description}</td></tr>
        <tr><td style="color:#64748b;">Amount</td><td style="color:#0f172a;font-weight:600;">${formatCurrency(data.amount)}</td></tr>
        <tr><td style="color:#64748b;">Stage</td><td style="color:#0d9488;font-weight:600;">${data.stage}</td></tr>
      </table>
      ${buildViewButton(data.expenseId)}
    `),
  };
}
