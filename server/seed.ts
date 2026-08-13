import { db } from "./db";
import { eq } from "drizzle-orm";
import { users, expenses, comments, expenseCategories, DEFAULT_CATEGORIES } from "@shared/schema";

export async function seed() {
  const existingCats = await db.select().from(expenseCategories);
  if (existingCats.length === 0) {
    await db.insert(expenseCategories).values(
      DEFAULT_CATEGORIES.map((name, i) => ({ name, isActive: true, sortOrder: String(i) }))
    );
  }

  const existingUsers = await db.select().from(users);
  if (existingUsers.length > 0) {
    return;
  }

  const [tony] = await db.insert(users).values([
    { name: "Tony Papa", email: "tpapa@ciralta.com", role: "Executive Chairman", isAdmin: true, department: "Executive", avatarInitials: "TP" },
  ]).returning();

  const [kelly, michael, chris, drake, chrisW, kao] = await db.insert(users).values([
    { name: "Kelly Gardner", email: "kgardner@aseva.com", role: "Employee", isAdmin: false, department: "Sales", avatarInitials: "KG" },
    { name: "Michael Papa", email: "mpapa@aseva.com", role: "General Manager", isAdmin: true, isAccountsPayable: true, department: "Executive", avatarInitials: "MP", managerId: tony.id },
    { name: "Chris Rose", email: "crose@aseva.com", role: "Manager", isAdmin: true, department: "Executive", avatarInitials: "CR" },
    { name: "Drake Johnson", email: "djohnson@aseva.com", role: "Employee", isAdmin: false, department: "Account Management", avatarInitials: "DJ" },
    { name: "Chris Waytek", email: "cwaytek@aseva.com", role: "Manager", isAdmin: false, department: "Operations", avatarInitials: "CW" },
    { name: "Kao Nou Xiong", email: "kxiong@aseva.com", role: "Manager", isAdmin: false, isAccountsPayable: true, department: "Accounting", avatarInitials: "KX" },
  ]).returning();

  const remainingEmployees = await db.insert(users).values([
    { name: "Alex Chau", email: "achau@aseva.com", role: "Employee", isAdmin: false, managerId: chris.id, department: "TAC", avatarInitials: "AC" },
    { name: "Dane Allen", email: "lallen@aseva.com", role: "Employee", isAdmin: false, isPOAdmin: true, managerId: chris.id, department: "Operations", avatarInitials: "DA" },
    { name: "Jessie Bryan", email: "jbryan@aseva.com", role: "Employee", isAdmin: true, managerId: chris.id, department: "Executive", avatarInitials: "JB" },
    { name: "Ava Morris", email: "amorris@aseva.com", role: "Employee", isAdmin: false, managerId: chrisW.id, department: "Administrative", avatarInitials: "AM" },
    { name: "Blake Thulin", email: "bthulin@aseva.com", role: "Employee", isAdmin: false, managerId: chrisW.id, department: "NOC", avatarInitials: "BT" },
    { name: "Cassandra Chan", email: "cchan@aseva.com", role: "Employee", isAdmin: false, managerId: chrisW.id, department: "Operations", avatarInitials: "CC" },
    { name: "Chelsea Renick", email: "crenick@aseva.com", role: "Employee", isAdmin: false, managerId: kao.id, department: "Billing", avatarInitials: "CR" },
    { name: "Cooper Self", email: "cself@aseva.com", role: "Employee", isAdmin: false, managerId: kao.id, department: "NOC", avatarInitials: "CS" },
    { name: "James Washington", email: "jwashington@aseva.com", role: "Employee", isAdmin: false, managerId: kao.id, department: "NOC", avatarInitials: "JW" },
    { name: "Jay Hennigan", email: "jhennigan@aseva.com", role: "Employee", isAdmin: false, managerId: chris.id, department: "NOC", avatarInitials: "JH" },
    { name: "Julie Vang", email: "jvang@aseva.com", role: "Employee", isAdmin: false, managerId: chrisW.id, department: "Administrative", avatarInitials: "JV" },
    { name: "Justin Thompson", email: "jthompson@aseva.com", role: "Employee", isAdmin: false, managerId: kao.id, department: "NOC", avatarInitials: "JT" },
    { name: "Justin Worley", email: "jworley@aseva.com", role: "Employee", isAdmin: false, managerId: chris.id, department: "NOC", avatarInitials: "JW" },
    { name: "Mahdroo McCaleb", email: "mmccaleb@aseva.com", role: "Employee", isAdmin: false, managerId: chrisW.id, department: "Operations", avatarInitials: "MM" },
    { name: "Malin Cordero", email: "mcordero@aseva.com", role: "Employee", isAdmin: false, isAccountsPayable: true, managerId: kao.id, department: "Accounting", avatarInitials: "MC" },
    { name: "Manny Negrete", email: "mnegrete@aseva.com", role: "Employee", isAdmin: false, managerId: chris.id, department: "NOC", avatarInitials: "MN" },
    { name: "Nat Soderman", email: "nsoderman@aseva.com", role: "Employee", isAdmin: false, managerId: chrisW.id, department: "TAC", avatarInitials: "NS" },
    { name: "Stephen Leedy", email: "sleedy@aseva.com", role: "Employee", isAdmin: false, managerId: kao.id, department: "NOC", avatarInitials: "SL" },
    { name: "Sumeet Singh", email: "ssingh@aseva.com", role: "Employee", isAdmin: false, managerId: chris.id, department: "Account Management", avatarInitials: "SS" },
    { name: "Victoria Rosas", email: "vrosas@aseva.com", role: "Employee", isAdmin: false, managerId: chrisW.id, department: "NOC", avatarInitials: "VR" },
    { name: "Zack Russell", email: "zrussell@aseva.com", role: "Employee", isAdmin: false, managerId: kao.id, department: "TAC", avatarInitials: "ZR" },
  ]).returning();

  await db.update(users).set({ managerId: michael.id }).where(eq(users.id, chris.id));
  await db.update(users).set({ managerId: michael.id }).where(eq(users.id, chrisW.id));
  await db.update(users).set({ managerId: michael.id }).where(eq(users.id, kao.id));
  await db.update(users).set({ managerId: chris.id }).where(eq(users.id, kelly.id));
  await db.update(users).set({ managerId: chris.id }).where(eq(users.id, drake.id));

  const [exp1, exp2, exp3, exp4, exp5] = await db.insert(expenses).values([
    {
      description: "Client Lunch - TechCorp",
      amount: "145.50",
      date: "2024-03-10",
      category: "Meals",
      status: "Submitted",
      employeeId: kelly.id,
      employeeName: "Kelly Gardner",
    },
    {
      description: "Flight to NYC Conference",
      amount: "450.00",
      date: "2024-03-12",
      category: "Travel",
      status: "Manager Approved",
      employeeId: kao.id,
      employeeName: "Kao Nou Xiong",
    },
    {
      description: "Office Monitors (2x)",
      amount: "600.00",
      date: "2024-03-14",
      category: "Supplies",
      status: "Draft",
      employeeId: kelly.id,
      employeeName: "Kelly Gardner",
    },
    {
      description: "Team Dinner",
      amount: "850.00",
      date: "2024-03-15",
      category: "Meals",
      status: "GM Approved",
      employeeId: kao.id,
      employeeName: "Kao Nou Xiong",
    },
    {
      description: "Uber from Airport",
      amount: "45.20",
      date: "2024-03-18",
      category: "Travel",
      status: "Reimbursed",
      employeeId: kelly.id,
      employeeName: "Kelly Gardner",
    }
  ]).returning();

  await db.insert(comments).values([
    { expenseId: exp2.id, author: "Michael Papa", text: "Looks good, approved.", date: "2024-03-13" },
    { expenseId: exp4.id, author: "Michael Papa", text: "Approved.", date: "2024-03-16" },
    { expenseId: exp4.id, author: "Chris Rose", text: "Within budget.", date: "2024-03-17" },
  ]);

  console.log("Database seeded successfully.");
}
