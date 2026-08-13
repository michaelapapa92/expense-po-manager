import { getAppUrl } from "./app-url";

const WEBEX_BOT_TOKEN = process.env.WEBEX_BOT_TOKEN;
const WEBEX_API_BASE = "https://webexapis.com/v1";

function buildExpenseLink(expenseId?: string): string {
  if (!expenseId) return "";
  const appUrl = getAppUrl();
  return `[View in ReimburseFlow](${appUrl}/approvals?highlight=${expenseId})`;
}

export async function sendWebexDirectMessage(toEmail: string, markdown: string): Promise<boolean> {
  if (!WEBEX_BOT_TOKEN) {
    console.warn("[webex] Missing WEBEX_BOT_TOKEN — Webex notifications disabled");
    return false;
  }

  try {
    const response = await fetch(`${WEBEX_API_BASE}/messages`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${WEBEX_BOT_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        toPersonEmail: toEmail,
        markdown,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[webex] Failed to send to ${toEmail}: ${response.status} ${errorText}`);
      return false;
    }

    console.log(`[webex] Sent notification to ${toEmail}`);
    return true;
  } catch (error: any) {
    console.error(`[webex] Error sending to ${toEmail}:`, error?.message || error);
    return false;
  }
}

function formatCurrency(amount: string | number): string {
  return `$${parseFloat(String(amount)).toFixed(2)}`;
}

export function buildWebexExpenseSubmitted(data: {
  employeeName: string;
  description: string;
  amount: string | number;
  category: string;
  date: string;
  notes?: string | null;
  expenseId?: string;
}): string {
  let msg = `📋 **New Expense to Review**\n\n**${data.employeeName}** submitted an expense for your approval.\n\n- **Vendor Name:** ${data.description}\n- **Amount:** ${formatCurrency(data.amount)}\n- **Category:** ${data.category}\n- **Date:** ${data.date}`;
  if (data.notes) msg += `\n- **Description:** ${data.notes}`;
  msg += `\n\n${buildExpenseLink(data.expenseId)}`;
  return msg;
}

export function buildWebexStatusChange(data: {
  description: string;
  amount: string | number;
  newStatus: string;
  rejectionNote?: string;
  notes?: string | null;
  expenseId?: string;
}): string {
  const isRejection = data.newStatus.includes("Rejected");
  const icon = isRejection ? "❌" : data.newStatus === "Reimbursed" ? "💰" : "✅";
  let msg = `${icon} **Expense ${data.newStatus}**\n\n- **Vendor Name:** ${data.description}\n- **Amount:** ${formatCurrency(data.amount)}\n- **Status:** ${data.newStatus}`;
  if (data.notes) msg += `\n- **Description:** ${data.notes}`;
  if (isRejection && data.rejectionNote) {
    msg += `\n\n> **Rejection Note:** ${data.rejectionNote}`;
  }
  msg += `\n\n${buildExpenseLink(data.expenseId)}`;
  return msg;
}

export function buildWebexComment(data: {
  commentAuthor: string;
  description: string;
  amount: string | number;
  commentText: string;
  notes?: string | null;
  expenseId?: string;
}): string {
  let expenseLabel = `${data.description} (${formatCurrency(data.amount)})`;
  let msg = `💬 **New Comment on Your Expense**\n\n**${data.commentAuthor}** commented on your expense.\n\n- **Vendor Name:** ${data.description}\n- **Amount:** ${formatCurrency(data.amount)}`;
  if (data.notes) msg += `\n- **Description:** ${data.notes}`;
  msg += `\n\n> ${data.commentText}\n\n${buildExpenseLink(data.expenseId)}`;
  return msg;
}

export function buildWebexApprovalNeeded(data: {
  approverName: string;
  employeeName: string;
  description: string;
  amount: string | number;
  stage: string;
  notes?: string | null;
  expenseId?: string;
}): string {
  let msg = `🔔 **Expense Awaiting Your Approval**\n\nHi ${data.approverName}, an expense has advanced to **${data.stage}** and needs your action.\n\n- **Submitted By:** ${data.employeeName}\n- **Vendor Name:** ${data.description}\n- **Amount:** ${formatCurrency(data.amount)}`;
  if (data.notes) msg += `\n- **Description:** ${data.notes}`;
  msg += `\n\n${buildExpenseLink(data.expenseId)}`;
  return msg;
}
