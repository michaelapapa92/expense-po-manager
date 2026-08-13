export type Role = 'Employee' | 'Manager' | 'General Manager' | 'Executive Chairman';

export type ExpenseStatus = 
  | 'Draft'
  | 'Submitted'
  | 'Manager Approved'
  | 'Manager Rejected'
  | 'GM Approved'
  | 'GM Rejected'
  | 'EC Approved'
  | 'EC Rejected'
  | 'Reimbursed'
  | 'Cancelled';

export interface Expense {
  id: string;
  description: string;
  amount: string;
  date: string;
  category: string;
  status: ExpenseStatus;
  receiptUrl?: string | null;
  employeeId: string;
  employeeName: string;
  notes?: string | null;
  miles?: string | null;
  createdAt?: string | null;
}

export interface Comment {
  id: string;
  expenseId: string;
  author: string;
  text: string;
  date: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  isAdmin: boolean;
  isAccountsPayable: boolean;
  isPOAdmin: boolean;
  managerId: string | null;
  department: string | null;
  avatarInitials: string;
  profilePicture: string | null;
  profileImageUrl: string | null;
  notifyEmail: boolean;
  notifyText: boolean;
  notifyWebex: boolean;
  phoneNumber: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface ExpenseHistory {
  id: string;
  expenseId: string;
  action: string;
  fromStatus: string | null;
  toStatus: string | null;
  changedBy: string;
  details: string | null;
  createdAt: string | null;
}

export const CATEGORIES = [
  "Flights",
  "Meals",
  "Hotel",
  "Mileage",
  "Taxi"
];
export const MILEAGE_RATE = 0.67;

export type POStatus =
  | 'Draft'
  | 'Submitted'
  | 'PO Admin Review'
  | 'PO Admin Rejected'
  | 'Manager Approved'
  | 'Manager Rejected'
  | 'GM Approved'
  | 'GM Rejected'
  | 'EC Approved'
  | 'EC Rejected'
  | 'Ordering'
  | 'Order Placed'
  | 'Cancelled';

export type BillingFrequency = 'One-Time' | 'Recurring';
export type UsageType = 'Internal' | 'Customer' | 'Other';

export interface PurchaseOrder {
  id: string;
  poNumber: string;
  vendor: string;
  usage: UsageType;
  description: string;
  cost: string;
  tax: string;
  shipping: string;
  totalCost: string;
  billingFrequency: BillingFrequency;
  recurringFrequency?: string | null;
  recurringTerm?: string | null;
  projectName: string;
  keyStakeholder: string;
  status: POStatus;
  submitterId: string;
  submitterName: string;
  notes?: string | null;
  createdAt?: string | null;
}

export interface PoHistory {
  id: string;
  purchaseOrderId: string;
  action: string;
  fromStatus: string | null;
  toStatus: string | null;
  changedBy: string;
  details: string | null;
  createdAt: string | null;
}

export interface PoComment {
  id: string;
  purchaseOrderId: string;
  author: string;
  text: string;
  date: string;
}
