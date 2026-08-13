import { useState } from "react";
import { useRole } from "@/lib/roleContext";
import { Expense, User, ExpenseHistory, PurchaseOrder } from "@/lib/mockData";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ReceiptThumbnail } from "@/components/receipt-viewer";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Check, X, Clock, FileText, History, Download, File, Paperclip, CheckCircle2, ShoppingCart, Info, AlertTriangle, Edit, ExternalLink } from "lucide-react";
import burningCashIcon from "@/assets/burning-cash-icon.png";
import { Link } from "wouter";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, getQueryFn } from "@/lib/queryClient";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

export default function Approvals() {
  const { role, currentUser, isViewingAs, viewAsUser } = useRole();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [comment, setComment] = useState("");
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
  const [selectedExpenses, setSelectedExpenses] = useState<Set<string>>(new Set());
  const [isBulkReject, setIsBulkReject] = useState(false);
  const [poReasonDialog, setPoReasonDialog] = useState<{
    poId: string;
    targetStatus: string;
    type: 'reject' | 'more_info';
  } | null>(null);
  const [poReasonText, setPoReasonText] = useState('');

  const expenseUrl = isViewingAs && viewAsUser ? `/api/expenses?viewAsUserId=${viewAsUser.id}` : "/api/expenses";
  const { data: expenses = [], isLoading } = useQuery<Expense[]>({
    queryKey: [expenseUrl],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const { data: allUsers = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const { data: purchaseOrders = [] } = useQuery<PurchaseOrder[]>({
    queryKey: ['/api/purchase-orders'],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const directReportIds = allUsers
    .filter((u: User) => u.managerId === currentUser?.id)
    .map((u: User) => u.id);

  const allSubordinateIds = getAllSubordinateIds(currentUser?.id, allUsers);

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      await apiRequest("PATCH", `/api/expenses/${id}/status`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ predicate: (query) => typeof query.queryKey[0] === 'string' && (query.queryKey[0] as string).startsWith('/api/expenses') });
    },
  });

  const commentMutation = useMutation({
    mutationFn: async ({ expenseId, author, text, date }: { expenseId: string; author: string; text: string; date: string }) => {
      await apiRequest("POST", `/api/expenses/${expenseId}/comments`, { author, text, date });
    },
  });

  const pendingExpenses = expenses.filter((e: Expense) => {
    if (role === 'Manager') {
      return e.status === 'Submitted' && directReportIds.includes(e.employeeId);
    }
    if (role === 'General Manager') {
      const isDirectReportSubmission = e.status === 'Submitted' && directReportIds.includes(e.employeeId);
      const isManagerApprovedFromChain = e.status === 'Manager Approved' && allSubordinateIds.includes(e.employeeId);
      return isDirectReportSubmission || isManagerApprovedFromChain;
    }
    if (role === 'Executive Chairman') {
      const isDirectReportSubmission = e.status === 'Submitted' && directReportIds.includes(e.employeeId);
      const isGMApprovedFromChain = e.status === 'GM Approved' && allSubordinateIds.includes(e.employeeId);
      return isDirectReportSubmission || isGMApprovedFromChain;
    }
    return false;
  });

  const processedHistory = expenses.filter((e: Expense) => {
    if (role === 'Manager') {
      return (e.status === 'Manager Approved' || e.status === 'Manager Rejected') && directReportIds.includes(e.employeeId);
    }
    if (role === 'General Manager') {
      return (['GM Approved', 'GM Rejected', 'Reimbursed'].includes(e.status)) && allSubordinateIds.includes(e.employeeId);
    }
    if (role === 'Executive Chairman') {
      return (['EC Approved', 'EC Rejected', 'Reimbursed'].includes(e.status)) && allSubordinateIds.includes(e.employeeId);
    }
    return false;
  });

  const handleApprove = (expense: Expense) => {
    let updatedStatus = 'Submitted';
    let description = '';

    if (role === 'Manager') {
      updatedStatus = 'Manager Approved';
      description = 'Request approved and forwarded to General Manager for review.';
    } else if (role === 'General Manager') {
      updatedStatus = 'GM Approved';
      description = 'Request approved. A bill will be created in QuickBooks for processing.';
    } else if (role === 'Executive Chairman') {
      updatedStatus = 'EC Approved';
      description = 'Request approved. A bill will be created in QuickBooks for processing.';
    }

    statusMutation.mutate({ id: expense.id, status: updatedStatus }, {
      onSuccess: () => {
        toast({
          title: updatedStatus === 'Reimbursed' ? "Expense Processed" : "Expense Approved",
          description,
          variant: "default",
          className: "bg-emerald-50 border-emerald-200 text-emerald-900"
        });
      }
    });
  };

  const handleReject = () => {
    if (!selectedExpense) return;

    let updatedStatus = 'Draft';
    if (role === 'Manager') {
      updatedStatus = 'Manager Rejected';
    } else if (role === 'General Manager') {
      updatedStatus = 'GM Rejected';
    } else if (role === 'Executive Chairman') {
      updatedStatus = 'EC Rejected';
    }

    commentMutation.mutate({
      expenseId: selectedExpense.id,
      author: currentUser?.name || role,
      text: comment,
      date: new Date().toISOString().split('T')[0],
    });

    statusMutation.mutate({ id: selectedExpense.id, status: updatedStatus }, {
      onSuccess: () => {
        toast({
          title: "Expense Rejected",
          description: "The request has been returned to the employee.",
          variant: "destructive"
        });
      }
    });

    setIsRejectDialogOpen(false);
    setComment("");
    setSelectedExpense(null);
    if (isBulkReject) {
      setSelectedExpenses(new Set());
      setIsBulkReject(false);
    }
  };

  const bulkStatusMutation = useMutation({
    mutationFn: async ({ expenseIds, status }: { expenseIds: string[]; status: string }) => {
      await apiRequest("POST", "/api/expenses/bulk-status", { expenseIds, status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ predicate: (query) => typeof query.queryKey[0] === 'string' && (query.queryKey[0] as string).startsWith('/api/expenses') });
    },
  });

  const getApproveStatus = (expense: Expense): string => {
    if (role === 'Manager') return 'Manager Approved';
    if (role === 'General Manager') return 'GM Approved';
    if (role === 'Executive Chairman') return 'EC Approved';
    return 'Submitted';
  };

  const handleBulkApprove = async () => {
    const selected = pendingExpenses.filter(e => selectedExpenses.has(e.id));
    const grouped = new Map<string, string[]>();
    for (const expense of selected) {
      const status = getApproveStatus(expense);
      if (!grouped.has(status)) grouped.set(status, []);
      grouped.get(status)!.push(expense.id);
    }
    try {
      await Promise.all(
        Array.from(grouped.entries()).map(([status, ids]) =>
          bulkStatusMutation.mutateAsync({ expenseIds: ids, status })
        )
      );
      toast({
        title: "Bulk Approve Complete",
        description: `${selected.length} expense(s) approved successfully.`,
        variant: "default",
        className: "bg-emerald-50 border-emerald-200 text-emerald-900"
      });
      setSelectedExpenses(new Set());
    } catch {
      toast({ title: "Error", description: "Failed to approve some expenses.", variant: "destructive" });
    }
  };

  const handleBulkRejectOpen = () => {
    setIsBulkReject(true);
    setIsRejectDialogOpen(true);
  };

  const handleBulkRejectConfirm = async () => {
    const selected = pendingExpenses.filter(e => selectedExpenses.has(e.id));
    const grouped = new Map<string, Expense[]>();
    for (const expense of selected) {
      let rejectStatus = 'Draft';
      if (role === 'Manager') rejectStatus = 'Manager Rejected';
      else if (role === 'General Manager') rejectStatus = 'GM Rejected';
      else if (role === 'Executive Chairman') rejectStatus = 'EC Rejected';
      if (!grouped.has(rejectStatus)) grouped.set(rejectStatus, []);
      grouped.get(rejectStatus)!.push(expense);
    }
    try {
      await Promise.all([
        ...Array.from(grouped.entries()).map(([status, exps]) =>
          bulkStatusMutation.mutateAsync({ expenseIds: exps.map(e => e.id), status })
        ),
        ...selected.map(expense =>
          commentMutation.mutateAsync({
            expenseId: expense.id,
            author: currentUser?.name || role,
            text: comment,
            date: new Date().toISOString().split('T')[0],
          })
        ),
      ]);
      toast({
        title: "Bulk Reject Complete",
        description: `${selected.length} expense(s) rejected.`,
        variant: "destructive"
      });
    } catch {
      toast({ title: "Error", description: "Failed to reject some expenses.", variant: "destructive" });
    }
    setIsRejectDialogOpen(false);
    setComment("");
    setSelectedExpenses(new Set());
    setIsBulkReject(false);
  };

  const toggleExpenseSelection = (id: string) => {
    setSelectedExpenses(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedExpenses.size === pendingExpenses.length) {
      setSelectedExpenses(new Set());
    } else {
      setSelectedExpenses(new Set(pendingExpenses.map(e => e.id)));
    }
  };

  const isPOAdmin = currentUser?.isPOAdmin === true;

  const canApprovePO = (po: PurchaseOrder) => {
    if (!currentUser) return false;
    if (po.status === 'Submitted' && isPOAdmin) return true;
    if (po.status === 'PO Admin Review' && (role === 'Manager' || role === 'General Manager')) return true;
    if (po.status === 'Manager Approved' && role === 'General Manager') return true;
    if (po.status === 'GM Approved' && isPOAdmin) return true;
    return false;
  };

  const getNextPOApprovalStatus = (currentStatus: string): string => {
    if (currentStatus === 'Submitted') return 'PO Admin Review';
    if (currentStatus === 'PO Admin Review') return 'Manager Approved';
    if (currentStatus === 'Manager Approved') return 'GM Approved';
    if (currentStatus === 'GM Approved') return 'Order Placed';
    return currentStatus;
  };

  const getPORejectionStatus = (currentStatus: string): string => {
    if (currentStatus === 'PO Admin Review') return 'Manager Rejected';
    if (currentStatus === 'Manager Approved') return 'GM Rejected';
    return currentStatus;
  };

  const canRejectPO = (po: PurchaseOrder): boolean => {
    if (po.status === 'Submitted' && isPOAdmin) return false;
    if (po.status === 'GM Approved' && isPOAdmin) return false;
    return canApprovePO(po) && po.status !== 'GM Approved';
  };

  const canRequestMoreInfoPO = (po: PurchaseOrder): boolean => {
    return canApprovePO(po) && po.status !== 'GM Approved';
  };

  const getPOApproveLabel = (po: PurchaseOrder): string => {
    if (po.status === 'Submitted') return 'Approve & Forward';
    if (po.status === 'GM Approved') return 'Mark as Ordered/Provisioned';
    return 'Approve';
  };

  const pendingPOs = purchaseOrders.filter((po: PurchaseOrder) => canApprovePO(po));

  const processedPOHistory = purchaseOrders.filter((po: PurchaseOrder) => {
    const terminalStatuses = ['Order Placed', 'Cancelled', 'Manager Rejected', 'GM Rejected', 'EC Rejected', 'PO Admin Rejected'];
    if (!terminalStatuses.includes(po.status)) return false;
    return true;
  });

  const [poOrderDialog, setPoOrderDialog] = useState<string | null>(null);

  const poStatusMutation = useMutation({
    mutationFn: async ({ id, status, reason, paymentStatus }: { id: string; status: string; reason?: string; paymentStatus?: string }) => {
      const res = await apiRequest('PATCH', `/api/purchase-orders/${id}/status`, {
        status,
        userId: currentUser?.id,
        reason,
        paymentStatus,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/purchase-orders'] });
      toast({ title: 'PO Status updated' });
      setPoReasonDialog(null);
      setPoReasonText('');
      setPoOrderDialog(null);
    },
    onError: (err: any) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  const handlePOApprove = (po: PurchaseOrder) => {
    if (po.status === 'GM Approved') {
      setPoOrderDialog(po.id);
      return;
    }
    const nextStatus = getNextPOApprovalStatus(po.status);
    poStatusMutation.mutate({ id: po.id, status: nextStatus }, {
      onSuccess: () => {
        toast({
          title: "PO Approved",
          description: `Purchase order ${po.poNumber} has been approved.`,
          variant: "default",
          className: "bg-emerald-50 border-emerald-200 text-emerald-900"
        });
      }
    });
  };

  const handlePOReject = (po: PurchaseOrder) => {
    setPoReasonDialog({
      poId: po.id,
      targetStatus: getPORejectionStatus(po.status),
      type: 'reject',
    });
    setPoReasonText('');
  };

  const handlePORequestMoreInfo = (po: PurchaseOrder) => {
    setPoReasonDialog({
      poId: po.id,
      targetStatus: 'More Info Requested',
      type: 'more_info',
    });
    setPoReasonText('');
  };

  const submitPOReasonAction = () => {
    if (!poReasonDialog || !poReasonText.trim()) return;
    poStatusMutation.mutate({
      id: poReasonDialog.poId,
      status: poReasonDialog.targetStatus,
      reason: poReasonText.trim(),
    });
  };

  const myRejectedExpenses = expenses.filter((e: Expense) => {
    if (!currentUser) return false;
    return e.employeeId === currentUser.id && ['Manager Rejected', 'GM Rejected', 'EC Rejected', 'AP Rejected'].includes(e.status);
  });

  const myDraftExpenses = expenses.filter((e: Expense) => {
    if (!currentUser) return false;
    return e.employeeId === currentUser.id && e.status === 'Draft';
  });

  const myPOsNeedingInfo = purchaseOrders.filter((po: PurchaseOrder) => {
    if (!currentUser) return false;
    return po.submitterId === currentUser.id && po.status === 'More Info Requested';
  });

  const myDraftPOs = purchaseOrders.filter((po: PurchaseOrder) => {
    if (!currentUser) return false;
    return po.submitterId === currentUser.id && po.status === 'Draft';
  });

  const myItemsCount = myRejectedExpenses.length + myPOsNeedingInfo.length + myDraftExpenses.length + myDraftPOs.length;
  const totalActionNeeded = pendingExpenses.length + pendingPOs.length + myItemsCount;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <h2 className="text-xl sm:text-2xl font-display font-bold text-slate-900 dark:text-slate-100" data-testid="text-page-title">Action Needed</h2>
        <p className="text-slate-500 dark:text-slate-400">All items requiring your attention — approvals, rejected expenses, and POs needing more info.</p>
      </div>

      <Tabs defaultValue={pendingExpenses.length + pendingPOs.length > 0 ? "pending" : myItemsCount > 0 ? "my-items" : "pending"}>
        <TabsList className="overflow-x-auto">
          <TabsTrigger value="pending" data-testid="tab-pending">Pending Review ({pendingExpenses.length + pendingPOs.length})</TabsTrigger>
          <TabsTrigger value="my-items" data-testid="tab-my-items">My Items ({myItemsCount})</TabsTrigger>
          <TabsTrigger value="history" data-testid="tab-history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="space-y-4 mt-6">
          {pendingExpenses.length > 0 && (
            <>
              <div className="flex items-center gap-2 mb-2">
                <FileText className="w-5 h-5 text-[#E85D04]" />
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100" data-testid="text-expense-approvals-header">Expense Approvals ({pendingExpenses.length})</h3>
              </div>
              <div className="flex items-center gap-3 px-2" data-testid="select-all-container">
                <Checkbox
                  checked={pendingExpenses.length > 0 && selectedExpenses.size === pendingExpenses.length}
                  onCheckedChange={toggleSelectAll}
                  data-testid="checkbox-select-all"
                />
                <label className="text-sm font-medium text-slate-600 dark:text-slate-300 cursor-pointer" onClick={toggleSelectAll}>
                  Select All ({pendingExpenses.length})
                </label>
              </div>
              {pendingExpenses.map((expense: Expense) => (
                <ApprovalCard
                  key={expense.id}
                  expense={expense}
                  selected={selectedExpenses.has(expense.id)}
                  onToggleSelect={() => toggleExpenseSelection(expense.id)}
                  onApprove={() => handleApprove(expense)}
                  onReject={() => {
                    setSelectedExpense(expense);
                    setIsRejectDialogOpen(true);
                  }}
                />
              ))}
            </>
          )}

          {pendingPOs.length > 0 && (
            <>
              <div className="flex items-center gap-2 mb-2 mt-6">
                <ShoppingCart className="w-5 h-5 text-[#E85D04]" />
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100" data-testid="text-po-approvals-header">PO Approvals ({pendingPOs.length})</h3>
              </div>
              {pendingPOs.map((po: PurchaseOrder) => (
                <POApprovalCard
                  key={po.id}
                  po={po}
                  onApprove={() => handlePOApprove(po)}
                  onReject={() => handlePOReject(po)}
                  onRequestMoreInfo={() => handlePORequestMoreInfo(po)}
                  canReject={canRejectPO(po)}
                  canRequestMoreInfo={canRequestMoreInfoPO(po)}
                  approveLabel={getPOApproveLabel(po)}
                />
              ))}
            </>
          )}

          {pendingExpenses.length === 0 && pendingPOs.length === 0 && (
            <div className="text-center py-12 border rounded-lg bg-slate-50 border-dashed">
              <img src={burningCashIcon} alt="" className="w-20 h-20 mx-auto mb-2 opacity-40" />
              <p className="text-slate-500 font-medium">All caught up!</p>
              <p className="text-sm text-slate-400">No pending requests for review.</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="my-items" className="space-y-4 mt-6">
          {myDraftExpenses.length > 0 && (
            <>
              <div className="flex items-center gap-2 mb-2">
                <Edit className="w-5 h-5 text-slate-500" />
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100" data-testid="text-draft-expenses-header">Draft Expenses ({myDraftExpenses.length})</h3>
              </div>
              {myDraftExpenses.map((expense: Expense) => (
                <Link key={expense.id} href={`/edit-expense/${expense.id}`}>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border border-slate-200 rounded-lg bg-white dark:bg-slate-800 dark:border-slate-700 gap-2 cursor-pointer hover:shadow-md hover:border-[#E85D04]/30 transition-all group" data-testid={`card-draft-expense-${expense.id}`}>
                    <div className="min-w-0">
                      <p className="font-medium truncate group-hover:text-[#E85D04] transition-colors">{expense.description}</p>
                      <p className="text-sm text-muted-foreground">{expense.category} &middot; {expense.date}</p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="font-bold">${parseFloat(expense.amount).toFixed(2)}</span>
                      <Badge variant="outline" className="bg-slate-100 text-slate-600">Draft</Badge>
                      <ExternalLink className="w-4 h-4 text-slate-400 group-hover:text-[#E85D04]" />
                    </div>
                  </div>
                </Link>
              ))}
            </>
          )}

          {myDraftPOs.length > 0 && (
            <>
              <div className="flex items-center gap-2 mb-2 mt-6">
                <Edit className="w-5 h-5 text-slate-500" />
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100" data-testid="text-draft-pos-header">Draft Purchase Orders ({myDraftPOs.length})</h3>
              </div>
              {myDraftPOs.map((po: PurchaseOrder) => (
                <Link key={po.id} href="/purchase-orders">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border border-slate-200 rounded-lg bg-white dark:bg-slate-800 dark:border-slate-700 gap-2 cursor-pointer hover:shadow-md hover:border-[#E85D04]/30 transition-all group" data-testid={`card-draft-po-${po.id}`}>
                    <div className="min-w-0">
                      <p className="font-medium truncate group-hover:text-[#E85D04] transition-colors">{po.poNumber} — {po.description}</p>
                      <p className="text-sm text-muted-foreground">{po.vendor}</p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="font-bold">${parseFloat(po.totalCost).toFixed(2)}</span>
                      <Badge variant="outline" className="bg-slate-100 text-slate-600">Draft</Badge>
                      <ExternalLink className="w-4 h-4 text-slate-400 group-hover:text-[#E85D04]" />
                    </div>
                  </div>
                </Link>
              ))}
            </>
          )}

          {myRejectedExpenses.length > 0 && (
            <>
              <div className="flex items-center gap-2 mb-2 mt-6">
                <AlertTriangle className="w-5 h-5 text-red-500" />
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100" data-testid="text-rejected-expenses-header">Rejected Expenses ({myRejectedExpenses.length})</h3>
              </div>
              {myRejectedExpenses.map((expense: Expense) => (
                <Link key={expense.id} href={`/edit-expense/${expense.id}`}>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border border-red-200 rounded-lg bg-red-50 dark:bg-red-900/10 dark:border-red-800 gap-2 cursor-pointer hover:shadow-md hover:border-red-300 transition-all group" data-testid={`card-rejected-expense-${expense.id}`}>
                    <div className="min-w-0">
                      <p className="font-medium truncate group-hover:text-red-700 transition-colors">{expense.description}</p>
                      <p className="text-sm text-muted-foreground">{expense.category} &middot; {expense.date}</p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="font-bold">${parseFloat(expense.amount).toFixed(2)}</span>
                      <Badge variant="destructive">{expense.status}</Badge>
                      <ExternalLink className="w-4 h-4 text-slate-400 group-hover:text-red-500" />
                    </div>
                  </div>
                </Link>
              ))}
            </>
          )}

          {myPOsNeedingInfo.length > 0 && (
            <>
              <div className="flex items-center gap-2 mb-2 mt-6">
                <Info className="w-5 h-5 text-orange-500" />
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100" data-testid="text-po-info-header">POs Needing More Info ({myPOsNeedingInfo.length})</h3>
              </div>
              {myPOsNeedingInfo.map((po: PurchaseOrder) => (
                <Link key={po.id} href="/purchase-orders">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border border-orange-200 rounded-lg bg-orange-50 dark:bg-orange-900/10 dark:border-orange-800 gap-2 cursor-pointer hover:shadow-md hover:border-orange-300 transition-all group" data-testid={`card-po-info-${po.id}`}>
                    <div className="min-w-0">
                      <p className="font-medium truncate group-hover:text-orange-700 transition-colors">{po.poNumber} — {po.description}</p>
                      <p className="text-sm text-muted-foreground">{po.vendor} &middot; More info requested</p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="font-bold">${parseFloat(po.totalCost).toFixed(2)}</span>
                      <Badge className="bg-orange-100 text-orange-700 border-orange-300">More Info Requested</Badge>
                      <ExternalLink className="w-4 h-4 text-slate-400 group-hover:text-orange-500" />
                    </div>
                  </div>
                </Link>
              ))}
            </>
          )}

          {myItemsCount === 0 && (
            <div className="text-center py-12 border rounded-lg bg-slate-50 border-dashed">
              <Check className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-slate-500 font-medium">No items need your attention</p>
              <p className="text-sm text-slate-400">Your drafts, rejected expenses, and PO info requests will appear here.</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="history" className="space-y-4 mt-6">
           {processedHistory.length > 0 && (
             <>
               <div className="flex items-center gap-2 mb-2">
                 <FileText className="w-5 h-5 text-[#E85D04]" />
                 <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Expense History</h3>
               </div>
               {processedHistory.map((expense: Expense) => (
                 <div key={expense.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border rounded-lg bg-white dark:bg-slate-800 opacity-75 gap-2" data-testid={`card-history-${expense.id}`}>
                    <div className="min-w-0">
                       <p className="font-medium truncate">{expense.description}</p>
                       <p className="text-sm text-muted-foreground">{expense.employeeName} &middot; {expense.date}</p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                       <span className="font-bold">${parseFloat(expense.amount).toFixed(2)}</span>
                       <Badge variant="outline">{expense.status}</Badge>
                    </div>
                 </div>
               ))}
             </>
           )}

           {processedPOHistory.length > 0 && (
             <>
               <div className="flex items-center gap-2 mb-2 mt-6">
                 <ShoppingCart className="w-5 h-5 text-[#E85D04]" />
                 <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">PO History</h3>
               </div>
               {processedPOHistory.map((po: PurchaseOrder) => (
                 <div key={po.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border rounded-lg bg-white dark:bg-slate-800 opacity-75 gap-2" data-testid={`card-po-history-${po.id}`}>
                    <div className="min-w-0">
                       <p className="font-medium truncate">{po.poNumber} — {po.description}</p>
                       <p className="text-sm text-muted-foreground">{po.vendor} &middot; {po.submitterName}</p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                       <span className="font-bold">${parseFloat(po.totalCost).toFixed(2)}</span>
                       <POStatusBadge status={po.status} />
                    </div>
                 </div>
               ))}
             </>
           )}

           {processedHistory.length === 0 && processedPOHistory.length === 0 && (
             <div className="text-center py-12 border rounded-lg bg-slate-50 border-dashed">
               <p className="text-slate-500 font-medium">No history yet</p>
               <p className="text-sm text-slate-400">Processed approvals will appear here.</p>
             </div>
           )}
        </TabsContent>
      </Tabs>

      {selectedExpenses.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-slate-800 border-t shadow-lg px-3 py-3 sm:px-6 sm:py-4" data-testid="bulk-action-bar">
          <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-blue-500" />
              <span className="font-medium text-sm sm:text-base text-slate-700 dark:text-slate-200" data-testid="text-selected-count">{selectedExpenses.size} selected</span>
            </div>
            <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
              <Button
                className="bg-emerald-600 hover:bg-emerald-700 flex-1 sm:flex-none text-sm"
                size="sm"
                onClick={handleBulkApprove}
                disabled={bulkStatusMutation.isPending}
                data-testid="button-bulk-approve"
              >
                <Check className="w-4 h-4 mr-1 sm:mr-2" /> Approve All
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-red-600 hover:bg-red-50 hover:text-red-700 border-red-200 flex-1 sm:flex-none text-sm"
                onClick={handleBulkRejectOpen}
                disabled={bulkStatusMutation.isPending}
                data-testid="button-bulk-reject"
              >
                <X className="w-4 h-4 mr-1 sm:mr-2" /> Reject All
              </Button>
            </div>
          </div>
        </div>
      )}

      <Dialog open={isRejectDialogOpen} onOpenChange={(open) => {
        setIsRejectDialogOpen(open);
        if (!open) { setIsBulkReject(false); }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isBulkReject ? `Reject ${selectedExpenses.size} Expense(s)` : 'Reject Expense Request'}</DialogTitle>
            <DialogDescription>
              {isBulkReject
                ? `Please provide a reason for rejecting ${selectedExpenses.size} selected expense(s). This will be shared with the employees.`
                : 'Please provide a reason for rejecting this expense. This will be shared with the employee.'}
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Reason for rejection..."
            className="min-h-[100px]"
            data-testid="input-reject-reason"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRejectDialogOpen(false)} data-testid="button-cancel-reject">Cancel</Button>
            <Button
              variant="destructive"
              onClick={isBulkReject ? handleBulkRejectConfirm : handleReject}
              disabled={!comment}
              data-testid="button-confirm-reject"
            >
              {isBulkReject ? `Reject ${selectedExpenses.size} Request(s)` : 'Reject Request'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!poReasonDialog} onOpenChange={(open) => { if (!open) { setPoReasonDialog(null); setPoReasonText(''); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {poReasonDialog?.type === 'reject' ? (
                <>
                  <AlertTriangle className="w-5 h-5 text-red-500" />
                  Reject Purchase Order
                </>
              ) : (
                <>
                  <Info className="w-5 h-5 text-orange-500" />
                  Request More Information
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              {poReasonDialog?.type === 'reject'
                ? "Please provide a reason for rejecting this purchase order. This will be sent to the submitter."
                : "Please describe what additional information is needed. This will be sent to the submitter."}
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={poReasonText}
            onChange={(e) => setPoReasonText(e.target.value)}
            placeholder={poReasonDialog?.type === 'reject'
              ? "e.g. Budget exceeded, need alternative vendor quote..."
              : "e.g. Please provide the vendor quote, need project justification..."}
            className="min-h-[100px]"
            data-testid="input-po-reject-reason"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => { setPoReasonDialog(null); setPoReasonText(''); }} data-testid="button-cancel-po-reason">Cancel</Button>
            <Button
              onClick={submitPOReasonAction}
              disabled={!poReasonText.trim() || poStatusMutation.isPending}
              className={poReasonDialog?.type === 'reject' ? "bg-red-600 hover:bg-red-700 text-white" : "bg-orange-600 hover:bg-orange-700 text-white"}
              data-testid="button-confirm-po-reason"
            >
              {poReasonDialog?.type === 'reject' ? 'Reject PO' : 'Send Request'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!poOrderDialog} onOpenChange={(open) => { if (!open) setPoOrderDialog(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-emerald-600" />
              Mark as Ordered/Provisioned
            </DialogTitle>
            <DialogDescription>
              How was this purchase order paid? This determines what type of record is created in QuickBooks.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <Button
              className="w-full justify-start h-auto py-4 px-4 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200"
              variant="outline"
              onClick={() => {
                if (poOrderDialog) {
                  poStatusMutation.mutate({ id: poOrderDialog, status: 'Order Placed', paymentStatus: 'paid' });
                }
              }}
              disabled={poStatusMutation.isPending}
              data-testid="button-po-order-paid"
            >
              <div className="text-left">
                <div className="font-semibold">Already Paid</div>
                <div className="text-xs text-emerald-700 mt-0.5">Creates a QBO Expense — payment already made (credit card, check, etc.)</div>
              </div>
            </Button>
            <Button
              className="w-full justify-start h-auto py-4 px-4 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200"
              variant="outline"
              onClick={() => {
                if (poOrderDialog) {
                  poStatusMutation.mutate({ id: poOrderDialog, status: 'Order Placed', paymentStatus: 'accrual' });
                }
              }}
              disabled={poStatusMutation.isPending}
              data-testid="button-po-order-accrual"
            >
              <div className="text-left">
                <div className="font-semibold">Not Yet Paid (Accrual)</div>
                <div className="text-xs text-amber-700 mt-0.5">Creates a QBO Bill — vendor will invoice, payment pending</div>
              </div>
            </Button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPoOrderDialog(null)} data-testid="button-cancel-po-order">
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
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

interface AttachmentData {
  id: string;
  expenseId: string;
  fileName: string;
  fileType: string;
  fileUrl: string;
}

function ApprovalCard({ expense, selected, onToggleSelect, onApprove, onReject }: { expense: Expense, selected?: boolean, onToggleSelect?: () => void, onApprove: () => void, onReject: () => void }) {
  const [showReceipt, setShowReceipt] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const { data: history = [] } = useQuery<ExpenseHistory[]>({
    queryKey: [`/api/expenses/${expense.id}/history`],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: showHistory,
  });

  const { data: attachmentsData = [] } = useQuery<AttachmentData[]>({
    queryKey: [`/api/expenses/${expense.id}/attachments`],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const hasAttachments = attachmentsData.length > 0 || !!expense.receiptUrl;

  return (
    <Card className={`overflow-hidden ${selected ? 'ring-2 ring-blue-500' : ''}`} data-testid={`card-approval-${expense.id}`}>
      <div className="flex flex-col md:flex-row">
        <div className="flex-1 p-4 sm:p-6">
          <div className="flex justify-between items-start mb-4">
            <div className="flex items-start gap-3">
              {onToggleSelect && (
                <Checkbox
                  checked={!!selected}
                  onCheckedChange={onToggleSelect}
                  className="mt-1"
                  data-testid={`checkbox-expense-${expense.id}`}
                />
              )}
            <div>
               <div className="flex items-center gap-2 mb-1">
                 <Badge variant="secondary" className="text-xs">{expense.category}</Badge>
                 <Badge variant="outline" className="text-xs">{expense.status}</Badge>
                 <span className="text-xs text-muted-foreground">{expense.date}</span>
               </div>
               <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">{expense.description}</h3>
               <p className="text-sm text-slate-500 dark:text-slate-400">Submitted by <span className="font-semibold text-slate-700 dark:text-slate-300">{expense.employeeName}</span></p>
               {expense.notes && (
                 <p className="text-sm text-slate-600 mt-2" data-testid="text-expense-notes">{expense.notes}</p>
               )}
            </div>
            </div>
            <div className="text-right">
              <div className="text-xl sm:text-2xl font-display font-bold text-slate-900 dark:text-slate-100">${parseFloat(expense.amount).toFixed(2)}</div>
              {expense.miles && (
                <div className="text-xs text-slate-500 mt-1">{parseFloat(expense.miles).toFixed(1)} mi @ $0.67/mi</div>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 mb-6">
            {hasAttachments && (
              <Button variant="outline" size="sm" onClick={() => setShowReceipt(!showReceipt)} data-testid="button-view-receipt">
                <Paperclip className="w-4 h-4 mr-2" />
                {showReceipt ? 'Hide Attachments' : `View Attachments${attachmentsData.length > 0 ? ` (${attachmentsData.length})` : ''}`}
              </Button>
            )}
            {expense.receiptUrl && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const link = document.createElement('a');
                  link.href = expense.receiptUrl!;
                  const ext = expense.receiptUrl!.startsWith('data:image/png') ? 'png' : 'jpg';
                  link.download = `receipt-${expense.employeeName.replace(/\s+/g, '_')}-${expense.date}.${ext}`;
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                }}
                data-testid="button-download-receipt"
              >
                <Download className="w-4 h-4 mr-2" />
                Download Receipt
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => setShowHistory(!showHistory)} data-testid="button-view-history-approval">
              <History className="w-4 h-4 mr-2" />
              {showHistory ? 'Hide History' : 'View History'}
            </Button>
          </div>

          {showReceipt && hasAttachments && (
            <div className="mb-6 space-y-3">
              {expense.receiptUrl && attachmentsData.length === 0 && (
                <ReceiptThumbnail src={expense.receiptUrl} />
              )}
              {attachmentsData.map((att: AttachmentData) => (
                <div key={att.id} data-testid={`attachment-display-${att.id}`}>
                  {att.fileType.startsWith("image/") ? (
                    <div>
                      <ReceiptThumbnail src={att.fileUrl} />
                      <p className="text-xs text-slate-500 mt-1">{att.fileName}</p>
                    </div>
                  ) : (
                    <a href={att.fileUrl} download={att.fileName} className="flex items-center gap-2 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg border hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors" data-testid={`link-attachment-${att.id}`}>
                      <File className="h-6 w-6 text-red-500 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate">{att.fileName}</p>
                        <p className="text-xs text-slate-400">PDF Document</p>
                      </div>
                      <FileText className="h-4 w-4 text-slate-400" />
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}

          {showHistory && (
            <div className="mb-6 bg-slate-50 dark:bg-slate-800 border rounded-lg p-3">
              <p className="text-xs font-medium text-slate-600 dark:text-slate-300 mb-3 flex items-center gap-1"><Clock className="w-3 h-3" /> Change History</p>
              {history.length === 0 ? (
                <p className="text-xs text-slate-400">No history recorded yet.</p>
              ) : (
                <div className="relative">
                  <div className="absolute left-[7px] top-2 bottom-2 w-px bg-slate-200" />
                  <div className="space-y-3">
                    {history.map((h: ExpenseHistory) => (
                      <div key={h.id} className="flex gap-3 relative" data-testid={`history-entry-${h.id}`}>
                        <div className={`w-[15px] h-[15px] rounded-full shrink-0 mt-0.5 border-2 z-10 ${
                          h.action === 'created' ? 'bg-blue-500 border-blue-300' :
                          h.action === 'edited' ? 'bg-amber-500 border-amber-300' :
                          h.toStatus?.includes('Rejected') ? 'bg-red-500 border-red-300' :
                          h.toStatus === 'Reimbursed' ? 'bg-emerald-500 border-emerald-300' :
                          h.toStatus === 'Cancelled' ? 'bg-slate-400 border-slate-300' :
                          'bg-[#E85D04] border-[#E85D04]/30'
                        }`} />
                        <div className="min-w-0 flex-1">
                          {h.action === 'edited' && h.details?.startsWith('Changed ') ? (
                            <div>
                              <p className="text-sm font-medium text-slate-700">Expense edited</p>
                              <div className="mt-1 space-y-1">
                                {h.details.replace('Changed ', '').split('; ').map((change: string, i: number) => {
                                  const fromMatch = change.match(/^(.+?) from [""]?(.+?)[""]? to [""]?(.+?)[""]?$/);
                                  if (fromMatch) {
                                    return (
                                      <div key={i} className="text-xs bg-white border rounded px-2 py-1">
                                        <span className="font-medium text-slate-600 capitalize">{fromMatch[1]}:</span>{' '}
                                        <span className="text-red-500 line-through">{fromMatch[2]}</span>
                                        {' → '}
                                        <span className="text-emerald-600 font-medium">{fromMatch[3]}</span>
                                      </div>
                                    );
                                  }
                                  return <p key={i} className="text-xs text-slate-600">{change}</p>;
                                })}
                              </div>
                            </div>
                          ) : (
                            <p className="text-sm text-slate-800">{h.details}</p>
                          )}
                          <p className="text-xs text-slate-400 mt-1">
                            {h.changedBy} &middot; {h.createdAt ? new Date(h.createdAt).toLocaleString() : ''}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="flex gap-3 pt-4 border-t">
            <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700" onClick={onApprove} data-testid="button-approve">
              <Check className="w-4 h-4 mr-2" /> Approve
            </Button>
            <Button variant="outline" className="flex-1 text-red-600 hover:bg-red-50 hover:text-red-700 border-red-200" onClick={onReject} data-testid="button-reject">
              <X className="w-4 h-4 mr-2" /> Reject
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}

function POStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    'Draft': 'bg-slate-100 text-slate-600 border-slate-200',
    'Submitted': 'bg-blue-50 text-blue-600 border-blue-200',
    'PO Admin Review': 'bg-amber-50 text-amber-700 border-amber-200',
    'PO Admin Rejected': 'bg-red-50 text-red-600 border-red-200',
    'More Info Requested': 'bg-orange-50 text-orange-600 border-orange-200',
    'Manager Approved': 'bg-[#E85D04]/10 text-[#E85D04] border-[#E85D04]/20',
    'GM Approved': 'bg-purple-50 text-purple-600 border-purple-200',
    'EC Approved': 'bg-violet-50 text-violet-600 border-violet-200',
    'Ordering': 'bg-orange-50 text-orange-600 border-orange-200',
    'Order Placed': 'bg-emerald-100 text-emerald-700 border-emerald-300',
    'Manager Rejected': 'bg-red-50 text-red-600 border-red-200',
    'GM Rejected': 'bg-red-50 text-red-600 border-red-200',
    'EC Rejected': 'bg-red-50 text-red-600 border-red-200',
    'Cancelled': 'bg-slate-200 text-slate-500 border-slate-300',
  };

  return (
    <Badge variant="outline" className={`${styles[status] || styles['Draft']} font-normal px-2 py-0.5`}>
      {status}
    </Badge>
  );
}

function POApprovalCard({ po, onApprove, onReject, onRequestMoreInfo, canReject, canRequestMoreInfo, approveLabel }: {
  po: PurchaseOrder;
  onApprove: () => void;
  onReject: () => void;
  onRequestMoreInfo: () => void;
  canReject: boolean;
  canRequestMoreInfo: boolean;
  approveLabel: string;
}) {
  return (
    <Card className="overflow-hidden" data-testid={`card-po-approval-${po.id}`}>
      <div className="p-4 sm:p-6">
        <div className="flex justify-between items-start mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-display font-bold text-[#2D1810] dark:text-blue-300" data-testid={`text-po-number-${po.id}`}>
                {po.poNumber}
              </span>
              <POStatusBadge status={po.status} />
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">{po.description}</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Vendor: <span className="font-semibold text-slate-700 dark:text-slate-300">{po.vendor}</span>
              {' · '}Submitted by <span className="font-semibold text-slate-700 dark:text-slate-300">{po.submitterName}</span>
            </p>
            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
              <span>Project: {po.projectName}</span>
              <span>•</span>
              <span>{po.createdAt ? new Date(po.createdAt).toLocaleDateString() : ''}</span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-xl sm:text-2xl font-display font-bold text-[#E85D04]">${parseFloat(po.totalCost).toFixed(2)}</div>
          </div>
        </div>

        {po.notes && (
          <p className="text-sm text-slate-600 dark:text-slate-300 mb-4" data-testid={`text-po-notes-${po.id}`}>{po.notes}</p>
        )}

        <div className="flex flex-wrap gap-2 pt-4 border-t">
          <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={onApprove} data-testid={`button-approve-po-${po.id}`}>
            <Check className="w-4 h-4 mr-2" /> {approveLabel}
          </Button>
          {canReject && (
            <Button variant="outline" className="text-red-600 hover:bg-red-50 hover:text-red-700 border-red-200" onClick={onReject} data-testid={`button-reject-po-${po.id}`}>
              <X className="w-4 h-4 mr-2" /> Reject
            </Button>
          )}
          {canRequestMoreInfo && (
            <Button variant="outline" className="text-orange-600 border-orange-300 hover:bg-orange-50" onClick={onRequestMoreInfo} data-testid={`button-more-info-po-${po.id}`}>
              <Info className="w-4 h-4 mr-2" /> Request More Info
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
