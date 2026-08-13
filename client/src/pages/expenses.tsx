import { useRole } from "@/lib/roleContext";
import { Expense, Comment, ExpenseHistory } from "@/lib/mockData";
import { useCategories } from "@/hooks/use-categories";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ReceiptThumbnail } from "@/components/receipt-viewer";
import { ArrowLeft, FileText, MessageSquare, Pencil, AlertTriangle, XCircle, History, Clock, File, Paperclip, Download, Search, Filter, X } from "lucide-react";
import burningCashIcon from "@/assets/burning-cash-icon.png";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Link, useSearch, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getQueryFn, apiRequest } from "@/lib/queryClient";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const ALL_STATUSES = [
  'Draft', 'Submitted', 'Manager Approved', 'Manager Rejected',
  'GM Approved', 'GM Rejected', 'EC Approved', 'EC Rejected',
  'Accounts Payable', 'AP Rejected', 'Reimbursed', 'Cancelled'
];

const STATUS_FILTERS: Record<string, { label: string; statuses: string[]; description: string }> = {
  pending: {
    label: "Pending Approval",
    statuses: ['Submitted', 'Manager Approved', 'GM Approved', 'EC Approved', 'Accounts Payable'],
    description: "Expenses currently awaiting approval or processing",
  },
  reimbursed: {
    label: "Reimbursed",
    statuses: ['Reimbursed'],
    description: "Expenses that have been fully reimbursed",
  },
  drafts: {
    label: "Drafts",
    statuses: ['Draft'],
    description: "Draft expenses that haven't been submitted yet",
  },
  review: {
    label: "Pending Review",
    statuses: ['Submitted'],
    description: "Submitted expenses waiting for your review",
  },
  rejected: {
    label: "Rejected",
    statuses: ['Manager Rejected', 'GM Rejected', 'EC Rejected', 'AP Rejected'],
    description: "Expenses that have been rejected and need revision",
  },
  cancelled: {
    label: "Cancelled",
    statuses: ['Cancelled'],
    description: "Expenses that have been cancelled by the submitter",
  },
};

const FINAL_STATUSES = ['Reimbursed', 'Cancelled'];
const APPROVED_STATUSES = ['Manager Approved', 'GM Approved', 'EC Approved'];

export default function Expenses() {
  const { categoryNames: CATEGORIES } = useCategories();
  const { role, currentUser, isViewingAs, viewAsUser } = useRole();
  const searchString = useSearch();
  const params = new URLSearchParams(searchString);
  const filterKey = params.get("filter") || "all";

  const [searchQuery, setSearchQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [amountMin, setAmountMin] = useState("");
  const [amountMax, setAmountMax] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);

  const expenseUrl = isViewingAs && viewAsUser ? `/api/expenses?viewAsUserId=${viewAsUser.id}` : "/api/expenses";
  const { data: expenses = [], isLoading } = useQuery<Expense[]>({
    queryKey: [expenseUrl],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const filter = STATUS_FILTERS[filterKey];
  const pageTitle = filter ? filter.label : "All Expenses";
  const pageDescription = filter ? filter.description : "View all expense requests";

  const statusFiltered = filter
    ? expenses.filter((e: Expense) => filter.statuses.includes(e.status))
    : expenses;

  const filteredExpenses = statusFiltered.filter((e: Expense) => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchDesc = e.description?.toLowerCase().includes(q);
      const matchName = e.employeeName?.toLowerCase().includes(q);
      const matchNotes = e.notes?.toLowerCase().includes(q);
      if (!matchDesc && !matchName && !matchNotes) return false;
    }
    if (dateFrom && e.date < dateFrom) return false;
    if (dateTo && e.date > dateTo) return false;
    if (amountMin && parseFloat(e.amount) < parseFloat(amountMin)) return false;
    if (amountMax && parseFloat(e.amount) > parseFloat(amountMax)) return false;
    if (selectedCategories.length > 0 && !selectedCategories.includes(e.category)) return false;
    if (selectedStatuses.length > 0 && !selectedStatuses.includes(e.status)) return false;
    return true;
  });

  const hasActiveFilters = searchQuery || dateFrom || dateTo || amountMin || amountMax || selectedCategories.length > 0 || selectedStatuses.length > 0;

  const clearAllFilters = () => {
    setSearchQuery("");
    setDateFrom("");
    setDateTo("");
    setAmountMin("");
    setAmountMax("");
    setSelectedCategories([]);
    setSelectedStatuses([]);
  };

  const toggleCategory = (cat: string) => {
    setSelectedCategories(prev => prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]);
  };

  const toggleStatus = (status: string) => {
    setSelectedStatuses(prev => prev.includes(status) ? prev.filter(s => s !== status) : [...prev, status]);
  };

  const handleExportCsv = () => {
    const params = new URLSearchParams();
    if (filter) {
      filter.statuses.forEach(s => params.append("status", s));
    }
    if (isViewingAs && viewAsUser) {
      params.set("viewAsUserId", viewAsUser.id);
    }
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);
    if (amountMin) params.set("amountMin", amountMin);
    if (amountMax) params.set("amountMax", amountMax);
    if (selectedCategories.length > 0) params.set("category", selectedCategories.join(","));
    if (searchQuery) params.set("search", searchQuery);
    const url = `/api/expenses/export/csv${params.toString() ? `?${params.toString()}` : ""}`;
    const a = document.createElement("a");
    a.href = url;
    a.download = "";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleExportPdf = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    const rows = filteredExpenses.map((e: Expense) =>
      `<tr>
        <td style="border:1px solid #ddd;padding:8px">${e.date}</td>
        <td style="border:1px solid #ddd;padding:8px">${e.description}</td>
        <td style="border:1px solid #ddd;padding:8px">${e.category}</td>
        <td style="border:1px solid #ddd;padding:8px;text-align:right">$${parseFloat(e.amount).toFixed(2)}</td>
        <td style="border:1px solid #ddd;padding:8px">${e.status}</td>
        <td style="border:1px solid #ddd;padding:8px">${e.employeeName}</td>
        <td style="border:1px solid #ddd;padding:8px;text-align:right">${e.miles ? parseFloat(e.miles).toFixed(1) : ""}</td>
        <td style="border:1px solid #ddd;padding:8px">${e.notes || ""}</td>
      </tr>`
    ).join("");
    printWindow.document.write(`<!DOCTYPE html><html><head><title>Expense Report</title>
      <style>body{font-family:Arial,sans-serif;padding:20px}table{border-collapse:collapse;width:100%}th{background:#E85D04;color:#fff;padding:10px;border:1px solid #ddd;text-align:left}td{padding:8px;border:1px solid #ddd}h1{color:#E85D04;margin-bottom:4px}p{color:#666;margin-top:0}</style>
    </head><body>
      <h1>${pageTitle}</h1>
      <p>Exported on ${new Date().toLocaleDateString()}</p>
      <table><thead><tr>
        <th>Date</th><th>Description</th><th>Category</th><th>Amount</th><th>Status</th><th>Employee</th><th>Miles</th><th>Notes</th>
      </tr></thead><tbody>${rows}</tbody></table>
    </body></html>`);
    printWindow.document.close();
    printWindow.print();
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center gap-2 sm:gap-4">
        <Link href="/">
          <Button variant="ghost" size="icon" className="shrink-0" data-testid="button-back">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="flex-1">
          <h2 className="text-xl sm:text-2xl font-display font-bold text-slate-900 dark:text-slate-100" data-testid="text-page-title">{pageTitle}</h2>
          <p className="text-slate-500 dark:text-slate-400">{pageDescription}</p>
        </div>
        {filteredExpenses.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" data-testid="button-export">
                <Download className="h-4 w-4 mr-2" /> Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleExportCsv} data-testid="button-export-csv">
                Export as CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportPdf} data-testid="button-export-pdf">
                Export as PDF
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            data-testid="input-search-expenses"
            placeholder="Search by description, employee, or notes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-white dark:bg-slate-800 dark:text-slate-100"
          />
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className={`${showFilters ? 'bg-[#E85D04]/10 border-[#E85D04]/30 text-[#E85D04]' : ''}`}
            data-testid="button-toggle-filters"
          >
            <Filter className="h-4 w-4 mr-2" />
            Filters
          </Button>
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearAllFilters}
              className="text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
              data-testid="button-clear-filters"
            >
              <X className="h-4 w-4 mr-1" />
              Clear All
            </Button>
          )}
        </div>

        {showFilters && (
          <Card className="shadow-sm dark:bg-slate-800">
            <CardContent className="p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Date From</label>
                  <Input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    data-testid="input-date-from"
                    className="dark:bg-slate-900 dark:text-slate-100"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Date To</label>
                  <Input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    data-testid="input-date-to"
                    className="dark:bg-slate-900 dark:text-slate-100"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Min Amount</label>
                  <Input
                    type="number"
                    placeholder="0.00"
                    value={amountMin}
                    onChange={(e) => setAmountMin(e.target.value)}
                    data-testid="input-amount-min"
                    className="dark:bg-slate-900 dark:text-slate-100"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Max Amount</label>
                  <Input
                    type="number"
                    placeholder="0.00"
                    value={amountMax}
                    onChange={(e) => setAmountMax(e.target.value)}
                    data-testid="input-amount-max"
                    className="dark:bg-slate-900 dark:text-slate-100"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Category</label>
                  <Select
                    value=""
                    onValueChange={(val) => toggleCategory(val)}
                  >
                    <SelectTrigger data-testid="select-category-filter" className="dark:bg-slate-900 dark:text-slate-100">
                      <SelectValue placeholder={selectedCategories.length > 0 ? `${selectedCategories.length} selected` : "All categories"} />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((cat) => (
                        <SelectItem key={cat} value={cat}>
                          <span className="flex items-center gap-2">
                            {selectedCategories.includes(cat) && <span className="text-[#E85D04]">✓</span>}
                            {cat}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Status</label>
                  <Select
                    value=""
                    onValueChange={(val) => toggleStatus(val)}
                  >
                    <SelectTrigger data-testid="select-status-filter" className="dark:bg-slate-900 dark:text-slate-100">
                      <SelectValue placeholder={selectedStatuses.length > 0 ? `${selectedStatuses.length} selected` : "All statuses"} />
                    </SelectTrigger>
                    <SelectContent>
                      {ALL_STATUSES.map((status) => (
                        <SelectItem key={status} value={status}>
                          <span className="flex items-center gap-2">
                            {selectedStatuses.includes(status) && <span className="text-[#E85D04]">✓</span>}
                            {status}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {hasActiveFilters && (
          <div className="flex flex-wrap gap-2">
            {searchQuery && (
              <Badge variant="secondary" className="flex items-center gap-1 bg-[#E85D04]/10 text-[#E85D04] border-[#E85D04]/20">
                Search: "{searchQuery}"
                <button onClick={() => setSearchQuery("")} className="ml-1 hover:text-red-500"><X className="h-3 w-3" /></button>
              </Badge>
            )}
            {dateFrom && (
              <Badge variant="secondary" className="flex items-center gap-1 bg-[#E85D04]/10 text-[#E85D04] border-[#E85D04]/20">
                From: {dateFrom}
                <button onClick={() => setDateFrom("")} className="ml-1 hover:text-red-500"><X className="h-3 w-3" /></button>
              </Badge>
            )}
            {dateTo && (
              <Badge variant="secondary" className="flex items-center gap-1 bg-[#E85D04]/10 text-[#E85D04] border-[#E85D04]/20">
                To: {dateTo}
                <button onClick={() => setDateTo("")} className="ml-1 hover:text-red-500"><X className="h-3 w-3" /></button>
              </Badge>
            )}
            {amountMin && (
              <Badge variant="secondary" className="flex items-center gap-1 bg-[#E85D04]/10 text-[#E85D04] border-[#E85D04]/20">
                Min: ${amountMin}
                <button onClick={() => setAmountMin("")} className="ml-1 hover:text-red-500"><X className="h-3 w-3" /></button>
              </Badge>
            )}
            {amountMax && (
              <Badge variant="secondary" className="flex items-center gap-1 bg-[#E85D04]/10 text-[#E85D04] border-[#E85D04]/20">
                Max: ${amountMax}
                <button onClick={() => setAmountMax("")} className="ml-1 hover:text-red-500"><X className="h-3 w-3" /></button>
              </Badge>
            )}
            {selectedCategories.map((cat) => (
              <Badge key={cat} variant="secondary" className="flex items-center gap-1 bg-[#E85D04]/10 text-[#E85D04] border-[#E85D04]/20">
                {cat}
                <button onClick={() => toggleCategory(cat)} className="ml-1 hover:text-red-500"><X className="h-3 w-3" /></button>
              </Badge>
            ))}
            {selectedStatuses.map((status) => (
              <Badge key={status} variant="secondary" className="flex items-center gap-1 bg-[#E85D04]/10 text-[#E85D04] border-[#E85D04]/20">
                {status}
                <button onClick={() => toggleStatus(status)} className="ml-1 hover:text-red-500"><X className="h-3 w-3" /></button>
              </Badge>
            ))}
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="p-8 text-center text-muted-foreground">Loading...</div>
      ) : filteredExpenses.length === 0 ? (
        <Card className="shadow-sm">
          <CardContent className="py-12 text-center">
            <img src={burningCashIcon} alt="" className="w-24 h-24 mx-auto mb-3 opacity-60" />
            <p className="text-slate-500 font-medium">No expenses found</p>
            <p className="text-sm text-slate-400 mt-1">
              {filterKey === 'drafts' ? 'You have no draft expenses.' :
               filterKey === 'reimbursed' ? 'No reimbursed expenses yet.' :
               filterKey === 'pending' ? 'No expenses are currently pending.' :
               filterKey === 'cancelled' ? 'No cancelled expenses.' :
               'No expenses match this filter.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="shadow-sm">
          <CardContent className="p-0">
            <div className="divide-y divide-slate-100 dark:divide-slate-700">
              {filteredExpenses.map((expense: Expense) => (
                <ExpenseRow key={expense.id} expense={expense} currentUserId={currentUser?.id} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="text-sm text-slate-400 dark:text-slate-500 text-center">
        {filteredExpenses.length} {filteredExpenses.length === 1 ? 'expense' : 'expenses'}
      </div>
    </div>
  );
}

interface AttachmentData {
  id: string;
  expenseId: string;
  fileName: string;
  fileType: string;
  fileUrl: string;
}

function ExpenseRow({ expense, currentUserId }: { expense: Expense; currentUserId?: string }) {
  const [showReceipt, setShowReceipt] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isRejected = ['Manager Rejected', 'GM Rejected', 'EC Rejected', 'AP Rejected'].includes(expense.status);
  const isOwner = currentUserId === expense.employeeId;
  const canCancel = isOwner && !FINAL_STATUSES.includes(expense.status);
  const canEdit = isOwner && !FINAL_STATUSES.includes(expense.status);
  const isApproved = APPROVED_STATUSES.includes(expense.status);

  const { data: comments = [] } = useQuery<Comment[]>({
    queryKey: [`/api/expenses/${expense.id}/comments`],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: isRejected,
  });

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

  const cancelExpense = useMutation({
    mutationFn: async () => {
      await apiRequest("PATCH", `/api/expenses/${expense.id}/status`, { status: "Cancelled", userId: currentUserId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ predicate: (query) => typeof query.queryKey[0] === 'string' && (query.queryKey[0] as string).startsWith('/api/expenses') });
      toast({
        title: "Expense Cancelled",
        description: "This expense request has been cancelled.",
        className: "bg-slate-50 border-slate-200 text-slate-900",
      });
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  return (
    <div data-testid={`card-expense-${expense.id}`}>
      <div className="p-3 sm:p-4 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
              isRejected ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' :
              expense.status === 'Cancelled' ? 'bg-slate-200 text-slate-500 dark:bg-slate-700 dark:text-slate-400' :
              expense.category === 'Flights' ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' :
              expense.category === 'Meals' ? 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400' :
              expense.category === 'Hotel' ? 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400' :
              expense.category === 'Mileage' ? 'bg-teal-100 text-teal-600 dark:bg-teal-900/30 dark:text-teal-400' :
              expense.category === 'Taxi' ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400' :
              'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
            }`}>
              {isRejected ? <AlertTriangle className="w-5 h-5" /> :
               expense.status === 'Cancelled' ? <XCircle className="w-5 h-5" /> :
               expense.category[0]}
            </div>
            <div className="min-w-0">
              <p className={`font-medium text-sm truncate ${expense.status === 'Cancelled' ? 'text-slate-400 line-through' : 'text-slate-900 dark:text-slate-100'}`}>{expense.description}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                {expense.date} &middot; {expense.employeeName}
                {expense.miles && <span> &middot; {parseFloat(expense.miles).toFixed(1)} mi</span>}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-4 shrink-0">
            <div className="hidden sm:flex items-center gap-1">
              {isRejected && comments.length > 0 && (
                <Button variant="ghost" size="sm" onClick={() => setShowComments(!showComments)} className="text-red-400 hover:text-red-600" data-testid="button-view-comments">
                  <MessageSquare className="w-4 h-4" />
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={() => setShowHistory(!showHistory)} className={`${showHistory ? 'text-[#E85D04]' : 'text-slate-400'} hover:text-[#E85D04]`} data-testid="button-view-history">
                <History className="w-4 h-4" />
              </Button>
              {hasAttachments && (
                <Button variant="ghost" size="sm" onClick={() => setShowReceipt(!showReceipt)} className="text-slate-400 hover:text-slate-600 relative" data-testid="button-view-receipt">
                  <Paperclip className="w-4 h-4" />
                  {attachmentsData.length > 0 && (
                    <span className="absolute -top-1 -right-1 bg-[#E85D04] text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center" data-testid="badge-attachment-count">
                      {attachmentsData.length}
                    </span>
                  )}
                </Button>
              )}
            </div>
            <div className="flex flex-col items-end gap-1">
              <span className={`font-display font-bold text-sm sm:text-base ${expense.status === 'Cancelled' ? 'text-slate-400' : 'text-slate-900 dark:text-slate-100'}`}>${parseFloat(expense.amount).toFixed(2)}</span>
              <StatusBadge status={expense.status} />
            </div>
          </div>
        </div>
        <div className="flex sm:hidden items-center gap-1 mt-2 ml-[52px]">
          {isRejected && comments.length > 0 && (
            <Button variant="ghost" size="sm" onClick={() => setShowComments(!showComments)} className="text-red-400 hover:text-red-600 h-7 px-2" data-testid="button-view-comments-mobile">
              <MessageSquare className="w-3.5 h-3.5 mr-1" />
              <span className="text-xs">Comments</span>
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={() => setShowHistory(!showHistory)} className={`${showHistory ? 'text-[#E85D04]' : 'text-slate-400'} hover:text-[#E85D04] h-7 px-2`} data-testid="button-view-history-mobile">
            <History className="w-3.5 h-3.5 mr-1" />
            <span className="text-xs">History</span>
          </Button>
          {hasAttachments && (
            <Button variant="ghost" size="sm" onClick={() => setShowReceipt(!showReceipt)} className="text-slate-400 hover:text-slate-600 h-7 px-2" data-testid="button-view-receipt-mobile">
              <Paperclip className="w-3.5 h-3.5 mr-1" />
              <span className="text-xs">Files{attachmentsData.length > 0 ? ` (${attachmentsData.length})` : ''}</span>
            </Button>
          )}
        </div>
      </div>
      {isRejected && showComments && comments.length > 0 && (
        <div className="px-4 pb-3">
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 space-y-2">
            <p className="text-xs font-medium text-red-700">Rejection Notes:</p>
            {comments.map((c: Comment) => (
              <div key={c.id} className="text-sm text-red-800 bg-white/60 rounded p-2 border border-red-100">
                <p>{c.text}</p>
                <p className="text-xs text-red-500 mt-1">— {c.author} on {c.date}</p>
              </div>
            ))}
          </div>
        </div>
      )}
      {isOwner && !FINAL_STATUSES.includes(expense.status) && (
        <div className="px-4 pb-3 flex flex-wrap gap-2">
          {canEdit && (
            <Button
              variant="outline"
              size="sm"
              className="flex-1 text-[#E85D04] border-[#E85D04]/20 hover:bg-[#E85D04]/10"
              onClick={() => setLocation(`/edit-expense/${expense.id}`)}
              data-testid="button-edit-expense"
            >
              <Pencil className="w-4 h-4 mr-2" />
              {isRejected ? 'Edit & Resubmit' : isApproved ? 'Edit (Restarts Approval)' : 'Edit'}
            </Button>
          )}
          {canCancel && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-red-600 border-red-200 hover:bg-red-50"
                  data-testid="button-cancel-expense"
                >
                  <XCircle className="w-4 h-4 mr-2" /> Cancel
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Cancel this expense?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will cancel the expense request for <strong>${parseFloat(expense.amount).toFixed(2)}</strong> ({expense.description}).
                    {isApproved && " This expense has already received approval — cancelling it will stop it from being processed."}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Keep It</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => cancelExpense.mutate()}
                    className="bg-red-600 hover:bg-red-700"
                    data-testid="button-confirm-cancel"
                  >
                    Yes, Cancel Expense
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      )}
      {showReceipt && hasAttachments && (
        <div className="px-4 pb-4 space-y-3">
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
        <div className="px-4 pb-4">
          <div className="bg-slate-50 dark:bg-slate-800 border rounded-lg p-3">
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
        </div>
      )}
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
    'Cancelled': 'bg-slate-200 text-slate-500 border-slate-300',
  };

  return (
    <Badge variant="outline" className={`${styles[status] || styles['Draft']} font-normal px-2 py-0.5`}>
      {status}
    </Badge>
  );
}
