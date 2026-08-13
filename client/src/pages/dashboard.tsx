import { useState } from "react";
import { useRole } from "@/lib/roleContext";
import { Expense, User, PurchaseOrder } from "@/lib/mockData";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, DollarSign, Clock, AlertCircle, CheckCircle, ShoppingCart, Info, Edit, Settings, GripVertical, Eye, EyeOff, RotateCcw } from "lucide-react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/queryClient";
import burningCashBg from "@/assets/burning-cash-1.png";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { useDashboardWidgets, WidgetConfig } from "@/lib/dashboard-widgets";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";

export default function Dashboard() {
  const { role, currentUser, isViewingAs, viewAsUser } = useRole();
  const { widgets, toggleWidget, moveWidget, resetWidgets, isVisible } = useDashboardWidgets();
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const expenseUrl = isViewingAs && viewAsUser ? `/api/expenses?viewAsUserId=${viewAsUser.id}` : "/api/expenses";
  const { data: allExpenses = [], isLoading } = useQuery<Expense[]>({
    queryKey: [expenseUrl],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const { data: allUsers = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const { data: purchaseOrders = [] } = useQuery<PurchaseOrder[]>({
    queryKey: ["/api/purchase-orders"],
    queryFn: getQueryFn({ on401: "returnNull" }),
  });

  const myExpenses = allExpenses.filter((e: Expense) => e.employeeId === currentUser?.id);

  const directReportIds = allUsers
    .filter((u: User) => u.managerId === currentUser?.id)
    .map((u: User) => u.id);

  const isPOAdmin = currentUser?.isPOAdmin === true;
  const isManager = role === 'Manager' || role === 'General Manager' || role === 'Executive Chairman';
  const hasApprovalAccess = isManager || isPOAdmin;
  const allSubordinateIds = getAllSubordinateIds(currentUser?.id, allUsers);

  const getApprovalItems = (): Expense[] => {
    const items: Expense[] = [];
    const addedIds = new Set<string>();

    const addItems = (filtered: Expense[]) => {
      for (const e of filtered) {
        if (!addedIds.has(e.id)) {
          addedIds.add(e.id);
          items.push(e);
        }
      }
    };

    if (role === 'Manager') {
      addItems(allExpenses.filter((e: Expense) => e.status === 'Submitted' && directReportIds.includes(e.employeeId)));
    }
    if (role === 'General Manager') {
      addItems(allExpenses.filter((e: Expense) => e.status === 'Submitted' && directReportIds.includes(e.employeeId)));
      addItems(allExpenses.filter((e: Expense) => e.status === 'Manager Approved' && allSubordinateIds.includes(e.employeeId)));
    }
    if (role === 'Executive Chairman') {
      addItems(allExpenses.filter((e: Expense) => e.status === 'Submitted' && directReportIds.includes(e.employeeId)));
      addItems(allExpenses.filter((e: Expense) => e.status === 'GM Approved' && allSubordinateIds.includes(e.employeeId)));
    }
    return items;
  };

  const approvalItems = getApprovalItems();
  const rejectedItems = myExpenses.filter((e: Expense) => ['Manager Rejected', 'GM Rejected', 'EC Rejected', 'AP Rejected'].includes(e.status));

  const poApprovalItems = purchaseOrders.filter((po: PurchaseOrder) => {
    if (!currentUser) return false;
    if (po.status === 'Submitted' && isPOAdmin) return true;
    if (po.status === 'PO Admin Review' && (role === 'Manager' || role === 'General Manager')) return true;
    if (po.status === 'Manager Approved' && role === 'General Manager') return true;
    if (po.status === 'GM Approved' && isPOAdmin) return true;
    return false;
  });

  const myPOsNeedingAction = purchaseOrders.filter((po: PurchaseOrder) => {
    if (!currentUser) return false;
    return po.submitterId === currentUser.id && po.status === 'More Info Requested';
  });

  const myDraftExpenses = myExpenses.filter((e: Expense) => e.status === 'Draft');
  const myDraftPOs = purchaseOrders.filter((po: PurchaseOrder) => {
    if (!currentUser) return false;
    return po.submitterId === currentUser.id && po.status === 'Draft';
  });

  const needsAttentionItems = [...approvalItems, ...rejectedItems, ...poApprovalItems, ...myPOsNeedingAction, ...myDraftExpenses, ...myDraftPOs];

  const totalPending = myExpenses
    .filter((e: Expense) => ['Submitted', 'Manager Approved', 'GM Approved', 'EC Approved', 'Accounts Payable'].includes(e.status))
    .reduce((acc: number, curr: Expense) => acc + parseFloat(curr.amount), 0);
  const totalReimbursed = myExpenses
    .filter((e: Expense) => e.status === 'Reimbursed')
    .reduce((acc: number, curr: Expense) => acc + parseFloat(curr.amount), 0);

  const firstName = currentUser?.name?.split(' ')[0] || 'there';
  const expenses = myExpenses;
  const recentActivityExpenses = myExpenses.slice(0, 5);

  return (
    <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-500">
      <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl text-white p-4 sm:p-8 md:p-12 shadow-2xl" style={{ background: 'linear-gradient(to bottom, #2D1810, #1C1917)' }}>
        <div className="absolute inset-0 opacity-30">
          <img src={burningCashBg} alt="Background" className="w-full h-full object-cover mix-blend-overlay" />
        </div>
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 sm:gap-6">
          <div>
            <h2 className="text-xl sm:text-3xl md:text-4xl font-display font-bold mb-1 sm:mb-2" data-testid="text-welcome">
              Welcome back, {firstName}
            </h2>
            <p className="text-amber-200/80 text-sm sm:text-base max-w-md">
              {expenses.length > 0 ? (
                <>
                  You have <span className="text-white font-semibold">{expenses.filter((e: Expense) => ['Submitted', 'Manager Approved', 'GM Approved', 'EC Approved', 'Accounts Payable'].includes(e.status)).length} pending</span> expenses
                  {expenses.filter((e: Expense) => ['Manager Rejected', 'GM Rejected', 'EC Rejected', 'AP Rejected'].includes(e.status)).length > 0 && <> and <span className="text-red-300 font-semibold">{expenses.filter((e: Expense) => ['Manager Rejected', 'GM Rejected', 'EC Rejected', 'AP Rejected'].includes(e.status)).length} rejected</span></>}
                  {approvalItems.length > 0 && <>, plus <span className="text-cyan-300 font-semibold">{approvalItems.length} awaiting your review</span></>}.
                </>
              ) : (
                <>No expenses yet. Create one to get started.</>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
            <Button size="icon" variant="ghost" className="border-white/20 text-white/70 hover:bg-white/10 hover:text-white h-9 w-9 shrink-0" onClick={() => setCustomizeOpen(true)} data-testid="button-customize-dashboard">
              <Settings className="h-4 w-4" />
            </Button>
            <Link href="/new-purchase-order" className="flex-1 sm:flex-none">
              <Button size="default" variant="outline" className="w-full sm:w-auto border-white/30 text-white hover:bg-white/10 text-xs sm:text-sm" data-testid="button-new-po">
                <ShoppingCart className="mr-1.5 h-4 w-4" /> New PO
              </Button>
            </Link>
            <Link href="/new-expense" className="flex-1 sm:flex-none">
              <Button size="default" className="w-full sm:w-auto bg-[#E85D04] hover:bg-[#C2410C] text-white border-0 shadow-lg shadow-[#E85D04]/20 text-xs sm:text-sm" data-testid="button-new-expense">
                <Plus className="mr-1.5 h-4 w-4" /> New Expense
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {widgets.filter(w => w.visible).map(widget => {
        if (widget.id === "summary-cards") return (
          <div key="summary-cards" className="grid grid-cols-3 gap-3 sm:gap-6">
            <Link href="/expenses?filter=pending">
              <Card className="border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-shadow cursor-pointer group" data-testid="card-pending">
                <CardContent className="p-3 sm:p-6">
                  <div className="flex items-center justify-between mb-1 sm:mb-2">
                    <p className="text-[10px] sm:text-sm font-medium text-muted-foreground group-hover:text-slate-700 dark:group-hover:text-slate-300 transition-colors">Pending</p>
                    <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-amber-500" />
                  </div>
                  <div className="text-base sm:text-2xl font-bold font-display" data-testid="text-pending-amount">${totalPending.toFixed(2)}</div>
                  <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 sm:mt-1 hidden sm:block">Awaiting review</p>
                </CardContent>
              </Card>
            </Link>
            <Link href="/expenses?filter=reimbursed">
              <Card className="border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-shadow cursor-pointer group" data-testid="card-reimbursed">
                <CardContent className="p-3 sm:p-6">
                  <div className="flex items-center justify-between mb-1 sm:mb-2">
                    <p className="text-[10px] sm:text-sm font-medium text-muted-foreground group-hover:text-slate-700 dark:group-hover:text-slate-300 transition-colors">Reimbursed</p>
                    <DollarSign className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-emerald-500" />
                  </div>
                  <div className="text-base sm:text-2xl font-bold font-display" data-testid="text-reimbursed-amount">${totalReimbursed.toFixed(2)}</div>
                  <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 sm:mt-1 hidden sm:block">Year to date</p>
                </CardContent>
              </Card>
            </Link>
            <Link href="/approvals">
              <Card className="border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-shadow cursor-pointer group" data-testid="card-action-items">
                <CardContent className="p-3 sm:p-6">
                  <div className="flex items-center justify-between mb-1 sm:mb-2">
                    <p className="text-[10px] sm:text-sm font-medium text-muted-foreground group-hover:text-slate-700 dark:group-hover:text-slate-300 transition-colors">Attention</p>
                    <AlertCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-[#E85D04]" />
                  </div>
                  <div className="text-base sm:text-2xl font-bold font-display" data-testid="text-action-items">{needsAttentionItems.length}</div>
                  <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 sm:mt-1 hidden sm:block">
                    {approvalItems.length > 0 && <span className="text-[#E85D04] font-medium">{approvalItems.length} to review</span>}
                    {approvalItems.length > 0 && (poApprovalItems.length > 0 || rejectedItems.length > 0) && ' + '}
                    {poApprovalItems.length > 0 && <span className="text-amber-600 font-medium">{poApprovalItems.length} PO{poApprovalItems.length !== 1 ? 's' : ''}</span>}
                    {(poApprovalItems.length > 0 || approvalItems.length > 0) && (rejectedItems.length > 0 || myPOsNeedingAction.length > 0) && ' + '}
                    {rejectedItems.length > 0 && <span className="text-red-500 font-medium">{rejectedItems.length} rejected</span>}
                    {rejectedItems.length > 0 && (myPOsNeedingAction.length > 0 || myDraftExpenses.length + myDraftPOs.length > 0) && ' + '}
                    {myPOsNeedingAction.length > 0 && <span className="text-orange-500 font-medium">{myPOsNeedingAction.length} info needed</span>}
                    {myPOsNeedingAction.length > 0 && myDraftExpenses.length + myDraftPOs.length > 0 && ' + '}
                    {myDraftExpenses.length + myDraftPOs.length > 0 && <span className="text-slate-500 font-medium">{myDraftExpenses.length + myDraftPOs.length} draft{myDraftExpenses.length + myDraftPOs.length !== 1 ? 's' : ''}</span>}
                    {needsAttentionItems.length === 0 && 'All caught up'}
                  </p>
                </CardContent>
              </Card>
            </Link>
          </div>
        );

        if (widget.id === "needs-attention" && needsAttentionItems.length > 0) return (
          <div key="needs-attention" className="space-y-3 sm:space-y-4">
            <h3 className="text-base sm:text-lg font-display font-semibold text-slate-900 dark:text-white px-1">Needs Attention</h3>
            <div className="grid grid-cols-2 gap-3">
              {approvalItems.length > 0 && (
                <Link href="/approvals">
                  <Card className="shadow-sm hover:shadow-md transition-shadow cursor-pointer border-[#E85D04]/20" data-testid="card-pending-approvals">
                    <CardContent className="p-3 sm:p-4 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center bg-[#E85D04]/10 text-[#E85D04] shrink-0">
                        <CheckCircle className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xl sm:text-2xl font-display font-bold text-slate-900 dark:text-slate-100">{approvalItems.length}</p>
                        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 truncate">Awaiting Review</p>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              )}
              {poApprovalItems.length > 0 && (
                <Link href="/approvals">
                  <Card className="shadow-sm hover:shadow-md transition-shadow cursor-pointer border-amber-200" data-testid="card-po-approvals">
                    <CardContent className="p-3 sm:p-4 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center bg-amber-100 text-amber-600 shrink-0">
                        <ShoppingCart className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xl sm:text-2xl font-display font-bold text-slate-900 dark:text-slate-100">{poApprovalItems.length}</p>
                        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 truncate">PO Approvals</p>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              )}
              {myPOsNeedingAction.length > 0 && (
                <Link href="/approvals">
                  <Card className="shadow-sm hover:shadow-md transition-shadow cursor-pointer border-orange-200" data-testid="card-po-more-info">
                    <CardContent className="p-3 sm:p-4 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center bg-orange-100 text-orange-600 shrink-0">
                        <Info className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xl sm:text-2xl font-display font-bold text-slate-900 dark:text-slate-100">{myPOsNeedingAction.length}</p>
                        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 truncate">Info Requested</p>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              )}
              {rejectedItems.length > 0 && (
                <Link href="/approvals">
                  <Card className="shadow-sm hover:shadow-md transition-shadow cursor-pointer border-red-200" data-testid="card-rejected-expenses">
                    <CardContent className="p-3 sm:p-4 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center bg-red-100 text-red-600 shrink-0">
                        <AlertCircle className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xl sm:text-2xl font-display font-bold text-slate-900 dark:text-slate-100">{rejectedItems.length}</p>
                        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 truncate">Rejected</p>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              )}
              {myDraftExpenses.length + myDraftPOs.length > 0 && (
                <Link href="/approvals">
                  <Card className="shadow-sm hover:shadow-md transition-shadow cursor-pointer border-slate-200" data-testid="card-drafts">
                    <CardContent className="p-3 sm:p-4 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center bg-slate-100 text-slate-600 shrink-0">
                        <Edit className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xl sm:text-2xl font-display font-bold text-slate-900 dark:text-slate-100">{myDraftExpenses.length + myDraftPOs.length}</p>
                        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 truncate">Drafts</p>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              )}
            </div>
          </div>
        );

        if (widget.id === "spending-analytics") return (
          <SpendingAnalytics key="spending-analytics" myExpenses={myExpenses} />
        );

        if (widget.id === "recent-activity") return (
          <div key="recent-activity" className="space-y-3 sm:space-y-4">
            <h3 className="text-base sm:text-lg font-display font-semibold text-slate-900 dark:text-white px-1">Recent Activity</h3>
            <Card className="shadow-sm">
              <CardContent className="p-0">
                {isLoading ? (
                  <div className="p-8 text-center text-muted-foreground">Loading...</div>
                ) : recentActivityExpenses.length === 0 ? (
                  <div className="p-6 sm:p-8 text-center text-muted-foreground text-sm">No expenses yet</div>
                ) : (
                  <div className="divide-y divide-slate-100 dark:divide-slate-700">
                    {recentActivityExpenses.map((expense: Expense) => (
                      <div key={expense.id} className="flex items-center justify-between p-3 sm:p-4 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors gap-3" data-testid={`card-expense-${expense.id}`}>
                        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                          <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center shrink-0 text-xs sm:text-sm ${
                            expense.category === 'Flights' ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' :
                            expense.category === 'Meals' ? 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400' :
                            expense.category === 'Hotel' ? 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400' :
                            expense.category === 'Mileage' ? 'bg-teal-100 text-teal-600 dark:bg-teal-900/30 dark:text-teal-400' :
                            expense.category === 'Taxi' ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400' :
                            'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                          }`}>
                            {expense.category[0]}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-xs sm:text-sm text-slate-900 dark:text-slate-100 truncate">{expense.description}</p>
                            <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 truncate">
                              {expense.date}
                              <span className="hidden sm:inline"> • {expense.employeeName}</span>
                              {expense.miles && <span className="hidden sm:inline"> • {parseFloat(expense.miles).toFixed(1)} mi</span>}
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-0.5 sm:gap-1 shrink-0">
                          <span className="font-display font-bold text-xs sm:text-base text-slate-900 dark:text-slate-100">${parseFloat(expense.amount).toFixed(2)}</span>
                          <StatusBadge status={expense.status} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        );

        return null;
      })}

      <Dialog open={customizeOpen} onOpenChange={setCustomizeOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Customize Dashboard</DialogTitle>
            <DialogDescription>Show, hide, and reorder your dashboard widgets. Drag to reorder.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1 mt-2">
            {widgets.map((widget, index) => (
              <div
                key={widget.id}
                draggable
                onDragStart={() => setDragIndex(index)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => {
                  if (dragIndex !== null && dragIndex !== index) {
                    moveWidget(dragIndex, index);
                  }
                  setDragIndex(null);
                }}
                onDragEnd={() => setDragIndex(null)}
                className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                  dragIndex === index ? 'border-[#E85D04] bg-[#E85D04]/5' : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
                data-testid={`widget-config-${widget.id}`}
              >
                <GripVertical className="w-4 h-4 text-slate-400 cursor-grab shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{widget.label}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{widget.description}</p>
                </div>
                <Switch
                  checked={widget.visible}
                  onCheckedChange={() => toggleWidget(widget.id)}
                  data-testid={`toggle-${widget.id}`}
                />
              </div>
            ))}
          </div>
          <div className="flex justify-between items-center mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
            <Button variant="ghost" size="sm" onClick={resetWidgets} className="text-slate-500 hover:text-slate-700" data-testid="button-reset-widgets">
              <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
              Reset to Default
            </Button>
            <Button size="sm" onClick={() => setCustomizeOpen(false)} className="bg-[#E85D04] hover:bg-[#C2410C]" data-testid="button-done-customize">
              Done
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SpendingAnalytics({ myExpenses }: { myExpenses: Expense[] }) {
  const CATEGORY_COLORS: Record<string, string> = {
    Flights: '#3B82F6',
    Meals: '#F97316',
    Hotel: '#8B5CF6',
    Mileage: '#14B8A6',
    Taxi: '#F59E0B',
  };

  const categoryData = Object.entries(
    myExpenses.reduce((acc: Record<string, number>, e: Expense) => {
      const cat = CATEGORY_COLORS[e.category] ? e.category : 'Other';
      acc[cat] = (acc[cat] || 0) + parseFloat(e.amount);
      return acc;
    }, {} as Record<string, number>)
  ).map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 }));

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const now = new Date();
  const last6Months: { key: string; month: string }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    last6Months.push({
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      month: monthNames[d.getMonth()],
    });
  }

  const monthTotals: Record<string, number> = {};
  myExpenses.forEach((e: Expense) => {
    const date = new Date(e.date);
    if (!isNaN(date.getTime())) {
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      monthTotals[key] = (monthTotals[key] || 0) + parseFloat(e.amount);
    }
  });

  const monthlyData = last6Months.map((m) => ({
    month: m.month,
    amount: Math.round((monthTotals[m.key] || 0) * 100) / 100,
  }));

  if (myExpenses.length === 0) return null;

  return (
    <div className="space-y-3 sm:space-y-4">
      <h3 className="text-base sm:text-lg font-display font-semibold text-slate-900 dark:text-white px-1">Spending Analytics</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
        <Card className="border-slate-200 dark:border-slate-700 shadow-sm" data-testid="card-spending-by-category">
          <CardHeader className="pb-2 sm:pb-4">
            <CardTitle className="text-sm sm:text-base dark:text-slate-100">Spending by Category</CardTitle>
          </CardHeader>
          <CardContent>
            {categoryData.length === 0 ? (
              <div className="flex items-center justify-center h-[180px] sm:h-[250px] text-muted-foreground text-sm" data-testid="text-no-category-data">No expense data yet</div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={75}
                    dataKey="value"
                    nameKey="name"
                  >
                    {categoryData.map((entry) => (
                      <Cell key={entry.name} fill={CATEGORY_COLORS[entry.name] || '#6B7280'} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => `$${value.toFixed(2)}`} />
                  <Legend
                    wrapperStyle={{ fontSize: '11px' }}
                    formatter={(value: string) => {
                      const item = categoryData.find((d) => d.name === value);
                      return `${value} ($${item ? item.value.toFixed(2) : '0.00'})`;
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
        <Card className="border-slate-200 dark:border-slate-700 shadow-sm" data-testid="card-monthly-spending">
          <CardHeader className="pb-2 sm:pb-4">
            <CardTitle className="text-sm sm:text-base dark:text-slate-100">Monthly Spending</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={monthlyData}>
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(value: number) => `$${value.toFixed(2)}`} />
                <Bar dataKey="amount" fill="#E85D04" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    'Draft': 'bg-slate-100 text-slate-600 border-slate-200',
    'Submitted': 'bg-blue-50 text-blue-600 border-blue-200',
    'Manager Approved': 'bg-[#E85D04]/10 text-[#E85D04] border-[#E85D04]/20',
    'GM Approved': 'bg-purple-50 text-purple-600 border-purple-200',
    'EC Approved': 'bg-violet-50 text-violet-600 border-violet-200',
    'Reimbursed': 'bg-emerald-100 text-emerald-700 border-emerald-300',
    'Manager Rejected': 'bg-red-50 text-red-600 border-red-200',
    'GM Rejected': 'bg-red-50 text-red-600 border-red-200',
    'EC Rejected': 'bg-red-50 text-red-600 border-red-200',
    'Accounts Payable': 'bg-indigo-50 text-indigo-600 border-indigo-200',
    'AP Rejected': 'bg-red-50 text-red-600 border-red-200',
    'Cancelled': 'bg-slate-200 text-slate-500 border-slate-300',
  };

  const shortLabels: Record<string, string> = {
    'Manager Approved': 'Mgr Appr',
    'Manager Rejected': 'Mgr Rej',
    'GM Approved': 'GM Appr',
    'GM Rejected': 'GM Rej',
    'EC Approved': 'EC Appr',
    'EC Rejected': 'EC Rej',
    'Accounts Payable': 'AP',
    'AP Rejected': 'AP Rej',
  };

  return (
    <Badge variant="outline" className={`${styles[status] || styles['Draft']} font-normal px-1.5 sm:px-2 py-0 sm:py-0.5 text-[10px] sm:text-xs`}>
      <span className="sm:hidden">{shortLabels[status] || status}</span>
      <span className="hidden sm:inline">{status}</span>
    </Badge>
  );
}

function getAllSubordinateIds(userId: string | undefined, allUsers: User[]): string[] {
  if (!userId) return [];
  const subordinates: string[] = [];
  const queue = allUsers.filter(u => u.managerId === userId).map(u => u.id);
  while (queue.length > 0) {
    const current = queue.shift()!;
    subordinates.push(current);
    const reports = allUsers.filter(u => u.managerId === current).map(u => u.id);
    queue.push(...reports);
  }
  return subordinates;
}
