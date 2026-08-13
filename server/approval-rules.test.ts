/**
 * Checks the expense approval chain against Aseva's actual rules:
 * every workflow ends at the GM, except a report submitted by the GM, which
 * ends at the EC. A direct report of the GM needs one approval, not two.
 *
 * Run with: npx tsx server/approval-rules.test.ts
 */
import { expenseApprovalPlan, canTransitionExpense } from "./routes";

const ec    = { id: "ec",    name: "Tony Papa",     role: "Executive Chairman", isAdmin: true,  managerId: null };
const gm    = { id: "gm",    name: "Michael Papa",  role: "General Manager",    isAdmin: true,  managerId: "ec" };
const mgr   = { id: "mgr",   name: "Chris Waytek",  role: "Manager",            isAdmin: false, managerId: "gm" };
const emp   = { id: "emp",   name: "Ava Morris",    role: "Employee",           isAdmin: false, managerId: "mgr" };
const direct= { id: "direct",name: "Dana Direct",   role: "Employee",           isAdmin: false, managerId: "gm" };
const ap    = { id: "ap",    name: "Kao Nou Xiong", role: "Manager",            isAdmin: false, managerId: "gm", isAccountsPayable: true };
const ALL = [ec, gm, mgr, emp, direct, ap];

const expense = (owner: any, status: string) => ({ id: "x", employeeId: owner.id, status, description: "d" });

let pass = 0, fail = 0;
function check(label: string, actual: boolean, expected: boolean, detail = "") {
  const ok = actual === expected;
  ok ? pass++ : fail++;
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}${ok ? "" : `  (expected ${expected}, got ${actual}) ${detail}`}`);
}
function allow(label: string, actor: any, owner: any, from: string, to: string, expected: boolean) {
  const plan = expenseApprovalPlan(owner, ALL);
  const v = canTransitionExpense(actor, expense(owner, from), to as any, plan);
  check(label, v.ok, expected, v.ok ? "" : (v as any).message);
}

console.log("\nPlan shape");
{
  const p = expenseApprovalPlan(emp, ALL);
  check("employee -> final approver is the GM", p.finalApprover?.id === "gm", true);
  check("employee -> needs a manager stage first", p.needsManagerStage, true);

  const pg = expenseApprovalPlan(gm, ALL);
  check("GM's own report -> final approver is the EC", pg.finalApprover?.id === "ec", true);
  check("GM's own report -> no manager stage (EC is the direct manager)", pg.needsManagerStage, false);

  const pe = expenseApprovalPlan(ec, ALL);
  check("EC's own report -> final approver is the GM", pe.finalApprover?.id === "gm", true);

  const pd = expenseApprovalPlan(direct, ALL);
  check("GM's direct report -> single stage", pd.needsManagerStage, false);
  check("GM's direct report -> final status is GM Approved", pd.finalStatus === "GM Approved", true);
}

console.log("\nEmployee report: Manager then GM, never the EC");
allow("manager approves at the manager stage",      mgr, emp, "Submitted",        "Manager Approved", true);
allow("GM cannot pre-empt the manager stage",       gm,  emp, "Submitted",        "GM Approved",      false);
allow("GM approves after the manager",              gm,  emp, "Manager Approved", "GM Approved",      true);
allow("EC is not in an employee's chain",           ec,  emp, "Manager Approved", "EC Approved",      false);
allow("cannot skip straight to Reimbursed",         mgr, emp, "Submitted",        "Reimbursed",       false);
allow("an unrelated employee cannot approve",       emp, mgr, "Submitted",        "Manager Approved", false);

console.log("\nGM's own report goes to the EC");
allow("EC approves the GM's report",                ec,  gm,  "Submitted",        "EC Approved",      true);
allow("GM cannot approve their own report",         gm,  gm,  "Submitted",        "EC Approved",      false);
allow("GM cannot self-approve via the GM branch",   gm,  gm,  "Submitted",        "GM Approved",      false);

console.log("\nEC's own report ends at the GM");
allow("GM approves the EC's report",                gm,  ec,  "Submitted",        "GM Approved",      true);
allow("EC cannot approve their own report",         ec,  ec,  "Submitted",        "GM Approved",      false);

console.log("\nGM's direct report: one approval, not two");
allow("GM approves directly from Submitted",        gm,  direct, "Submitted",     "GM Approved",      true);
allow("no separate manager stage exists",           gm,  direct, "Submitted",     "Manager Approved", false);

console.log("\nLegacy rows stay approvable (submitter has no manager)");
{
  const orphan = { id: "orphan", name: "No Manager", role: "Manager", isAdmin: false, managerId: null };
  const users = [...ALL, orphan];
  const plan = expenseApprovalPlan(orphan, users);
  check("no manager -> single stage", plan.needsManagerStage, false);
  const v = canTransitionExpense(gm, expense(orphan, "Manager Approved"), "GM Approved" as any, plan);
  check("GM can still finalise a row stuck at Manager Approved", v.ok, true, v.ok ? "" : (v as any).message);
}

console.log("\nSelf-approval is blocked even for admins");
allow("admin manager cannot approve own expense",   mgr, mgr, "Submitted",         "Manager Approved", false);
allow("submitter may still cancel their own",       emp, emp, "Submitted",         "Cancelled",        true);
allow("submitter may still submit their own",       emp, emp, "Draft",             "Submitted",        true);
allow("a stranger cannot cancel someone else's",    mgr, emp, "Submitted",         "Cancelled",        false);

console.log("\nReimbursement");
allow("AP marks reimbursed",                        ap,  emp, "GM Approved",       "Reimbursed",       true);
allow("plain employee cannot mark reimbursed",      emp, mgr, "GM Approved",       "Reimbursed",       false);

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
