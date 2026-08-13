import { useState, useRef, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getQueryFn, apiRequest } from '@/lib/queryClient';
import { useRole } from '@/lib/roleContext';
import { PurchaseOrder, User, PoHistory, PoComment } from '@/lib/mockData';
import { PoAttachment } from '@shared/schema';
import { Link } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import {
  PlusCircle, Search, Filter, Eye, Clock, MessageSquare,
  ChevronDown, ChevronUp, RefreshCw, X, ShoppingCart, AlertTriangle, Info,
  Paperclip, Upload, File, Download, Trash2, Archive,
  Building2, UserCircle, Calendar
} from 'lucide-react';
import burningCashIcon from "@/assets/burning-cash-icon.png";

function StatusBadge({ status }: { status: string }) {
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

function CategoryBadge({ status }: { status: string }) {
  const categoryStyles: Record<string, string> = {
    'Open': 'bg-blue-50 text-blue-600 border-blue-200',
    'Approved': 'bg-emerald-50 text-emerald-700 border-emerald-200',
    'Rejected': 'bg-red-50 text-red-600 border-red-200',
  };
  const getCategory = (s: string) => {
    if (s.includes('Rejected') || s === 'Cancelled') return 'Rejected';
    if (s === 'Order Placed' || s === 'GM Approved') return 'Approved';
    return 'Open';
  };
  const category = getCategory(status);
  return (
    <div className="flex items-center gap-1.5">
      <Badge variant="outline" className={`${categoryStyles[category]} font-medium px-2 py-0.5`}>
        {category}
      </Badge>
      <span className="text-xs text-muted-foreground">({status})</span>
    </div>
  );
}

function getStatusCategory(status: string): 'Open' | 'Rejected' | 'Approved' {
  if (status.includes('Rejected') || status === 'Cancelled') return 'Rejected';
  if (status === 'Order Placed' || status === 'GM Approved') return 'Approved';
  return 'Open';
}

export default function PurchaseOrders() {
  const { currentUser, effectiveUser } = useRole();
  const activeUser = effectiveUser || currentUser;
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('active');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [expandedPO, setExpandedPO] = useState<string | null>(null);

  const [repoVendorSearch, setRepoVendorSearch] = useState('');
  const [repoRequestorSearch, setRepoRequestorSearch] = useState('');
  const [repoStatusFilter, setRepoStatusFilter] = useState('all');
  const [expandedRepoPO, setExpandedRepoPO] = useState<string | null>(null);
  const [historyPO, setHistoryPO] = useState<string | null>(null);
  const [commentsPO, setCommentsPO] = useState<string | null>(null);
  const [newComment, setNewComment] = useState('');

  const [previewAttachment, setPreviewAttachment] = useState<PoAttachment | null>(null);

  const [reasonDialog, setReasonDialog] = useState<{
    poId: string;
    targetStatus: string;
    type: 'reject' | 'more_info';
  } | null>(null);
  const [reasonText, setReasonText] = useState('');

  const [orderDialog, setOrderDialog] = useState<string | null>(null);

  const { data: purchaseOrders = [], isLoading } = useQuery<PurchaseOrder[]>({
    queryKey: ['/api/purchase-orders'],
    queryFn: getQueryFn({ on401: 'returnNull' }),
  });

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ['/api/users'],
    queryFn: getQueryFn({ on401: 'returnNull' }),
  });

  const { data: poHistoryData = [] } = useQuery<PoHistory[]>({
    queryKey: [`/api/purchase-orders/${historyPO}/history`],
    queryFn: getQueryFn({ on401: 'returnNull' }),
    enabled: !!historyPO,
  });

  const { data: poCommentsData = [] } = useQuery<PoComment[]>({
    queryKey: [`/api/purchase-orders/${commentsPO}/comments`],
    queryFn: getQueryFn({ on401: 'returnNull' }),
    enabled: !!commentsPO,
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status, reason, paymentStatus }: { id: string; status: string; reason?: string; paymentStatus?: string }) => {
      const res = await apiRequest('PATCH', `/api/purchase-orders/${id}/status`, {
        status,
        userId: activeUser?.id,
        reason,
        paymentStatus,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/purchase-orders'] });
      toast({ title: 'Status updated' });
      setReasonDialog(null);
      setReasonText('');
      setOrderDialog(null);
    },
    onError: (err: any) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: poAttachments = [] } = useQuery<PoAttachment[]>({
    queryKey: [`/api/purchase-orders/${expandedPO}/attachments`],
    queryFn: getQueryFn({ on401: 'returnNull' }),
    enabled: !!expandedPO,
  });

  const uploadAttachmentMutation = useMutation({
    mutationFn: async ({ poId, file }: { poId: string; file: globalThis.File }) => {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const res = await apiRequest('POST', `/api/purchase-orders/${poId}/attachments`, {
        fileName: file.name,
        fileType: file.type || 'application/octet-stream',
        fileUrl: dataUrl,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/purchase-orders/${expandedPO}/attachments`] });
      toast({ title: 'File uploaded' });
    },
    onError: (err: any) => {
      toast({ title: 'Upload failed', description: err.message, variant: 'destructive' });
    },
  });

  const deleteAttachmentMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest('DELETE', `/api/purchase-orders/attachments/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/purchase-orders/${expandedPO}/attachments`] });
      toast({ title: 'File removed' });
    },
  });

  const handlePoFileUpload = (poId: string, files: FileList) => {
    const MAX_FILE_SIZE = 10 * 1024 * 1024;
    for (const file of Array.from(files)) {
      if (file.size > MAX_FILE_SIZE) {
        toast({ title: 'File too large', description: `${file.name} exceeds the 10MB limit`, variant: 'destructive' });
        continue;
      }
      uploadAttachmentMutation.mutate({ poId, file });
    }
  };

  const downloadAttachment = (att: PoAttachment) => {
    const link = document.createElement('a');
    link.href = att.fileUrl;
    link.download = att.fileName;
    link.click();
  };

  const commentMutation = useMutation({
    mutationFn: async ({ poId, text }: { poId: string; text: string }) => {
      const res = await apiRequest('POST', `/api/purchase-orders/${poId}/comments`, {
        author: activeUser?.name || 'Unknown',
        text,
        purchaseOrderId: poId,
        date: new Date().toISOString().split('T')[0],
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/purchase-orders/${commentsPO}/comments`] });
      setNewComment('');
      toast({ title: 'Comment added' });
    },
  });

  const isPOAdmin = activeUser?.isPOAdmin === true;

  const canApprove = (po: PurchaseOrder) => {
    if (!activeUser) return false;
    if (po.status === 'Submitted' && isPOAdmin) return true;
    if (po.status === 'PO Admin Review' && (activeUser.role === 'Manager' || activeUser.role === 'General Manager')) return true;
    if (po.status === 'Manager Approved' && activeUser.role === 'General Manager') return true;
    if (po.status === 'GM Approved' && isPOAdmin) return true;
    return false;
  };

  const getNextApprovalStatus = (currentStatus: string): string => {
    if (currentStatus === 'Submitted') return 'PO Admin Review';
    if (currentStatus === 'PO Admin Review') return 'Manager Approved';
    if (currentStatus === 'Manager Approved') return 'GM Approved';
    if (currentStatus === 'GM Approved') return 'Order Placed';
    return currentStatus;
  };

  const getRejectionStatus = (currentStatus: string): string => {
    if (currentStatus === 'PO Admin Review') return 'Manager Rejected';
    if (currentStatus === 'Manager Approved') return 'GM Rejected';
    return currentStatus;
  };

  const canReject = (po: PurchaseOrder): boolean => {
    if (po.status === 'Submitted' && isPOAdmin) return false;
    if (po.status === 'GM Approved' && isPOAdmin) return false;
    return canApprove(po) && po.status !== 'GM Approved';
  };

  const canRequestMoreInfo = (po: PurchaseOrder): boolean => {
    return canApprove(po) && po.status !== 'GM Approved';
  };

  const getApproveLabel = (po: PurchaseOrder): string => {
    if (po.status === 'Submitted') return 'Approve & Forward';
    if (po.status === 'GM Approved') return 'Mark as Ordered/Provisioned';
    return 'Approve';
  };

  const handleReject = (po: PurchaseOrder) => {
    setReasonDialog({
      poId: po.id,
      targetStatus: getRejectionStatus(po.status),
      type: 'reject',
    });
    setReasonText('');
  };

  const handleRequestMoreInfo = (po: PurchaseOrder) => {
    setReasonDialog({
      poId: po.id,
      targetStatus: 'More Info Requested',
      type: 'more_info',
    });
    setReasonText('');
  };

  const submitReasonAction = () => {
    if (!reasonDialog || !reasonText.trim()) return;
    statusMutation.mutate({
      id: reasonDialog.poId,
      status: reasonDialog.targetStatus,
      reason: reasonText.trim(),
    });
  };

  const terminalStatuses = ['Order Placed', 'Cancelled', 'Manager Rejected', 'GM Rejected', 'EC Rejected', 'PO Admin Rejected'];

  const activePOs = purchaseOrders.filter(po => {
    if (terminalStatuses.includes(po.status)) return false;

    const isMine = po.submitterId === activeUser?.id;
    const needsMyAction = canApprove(po) || canReject(po) || canRequestMoreInfo(po);
    const canResubmit = po.status === 'More Info Requested' && isMine;
    const isDraft = po.status === 'Draft' && isMine;

    return isMine || needsMyAction || canResubmit || isDraft;
  });

  const filtered = activePOs.filter(po => {
    if (statusFilter !== 'all' && po.status !== statusFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return po.poNumber.toLowerCase().includes(q) ||
        po.vendor.toLowerCase().includes(q) ||
        po.description.toLowerCase().includes(q) ||
        po.submitterName.toLowerCase().includes(q) ||
        po.projectName.toLowerCase().includes(q);
    }
    return true;
  });

  const activeStatuses = [...new Set(activePOs.map(po => po.status))].sort();

  const uniqueVendors = useMemo(() => [...new Set(purchaseOrders.map(po => po.vendor))].sort(), [purchaseOrders]);
  const uniqueRequestors = useMemo(() => [...new Set(purchaseOrders.map(po => po.submitterName))].sort(), [purchaseOrders]);

  const repoFiltered = useMemo(() => {
    return purchaseOrders.filter(po => {
      if (repoStatusFilter !== 'all' && getStatusCategory(po.status) !== repoStatusFilter) return false;
      if (repoVendorSearch) {
        if (!po.vendor.toLowerCase().includes(repoVendorSearch.toLowerCase())) return false;
      }
      if (repoRequestorSearch) {
        if (!po.submitterName.toLowerCase().includes(repoRequestorSearch.toLowerCase())) return false;
      }
      return true;
    });
  }, [purchaseOrders, repoVendorSearch, repoRequestorSearch, repoStatusFilter]);

  const repoTotalValue = repoFiltered.reduce((sum, po) => sum + parseFloat(po.totalCost || '0'), 0);
  const repoHasFilters = repoVendorSearch || repoRequestorSearch || repoStatusFilter !== 'all';
  const clearRepoFilters = () => { setRepoVendorSearch(''); setRepoRequestorSearch(''); setRepoStatusFilter('all'); };

  if (isLoading) {
    return (
      <div className="p-4 sm:p-8">
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="w-6 h-6 animate-spin text-slate-400" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-8 max-w-[1400px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-bold text-[#2D1810] dark:text-white" data-testid="text-page-title">
            Purchase Orders
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Manage active POs and browse the full repository</p>
        </div>
        <Link href="/new-purchase-order">
          <Button className="bg-[#E85D04] hover:bg-[#E85D04]/85 text-white shadow-md gap-2 font-semibold" data-testid="button-new-po">
            <PlusCircle className="w-4 h-4" /> New PO Request
          </Button>
        </Link>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="active" data-testid="tab-active-pos">
            <ShoppingCart className="w-3.5 h-3.5 mr-1.5" /> Active ({activePOs.length})
          </TabsTrigger>
          <TabsTrigger value="repository" data-testid="tab-repository">
            <Archive className="w-3.5 h-3.5 mr-1.5" /> Repository ({purchaseOrders.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="space-y-4 mt-0">
          <Card className="border-slate-200 dark:border-slate-700">
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search POs..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="pl-9"
                    data-testid="input-search-po"
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full sm:w-[200px]" data-testid="select-status-filter">
                    <SelectValue placeholder="All Statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    {activeStatuses.map(s => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {filtered.length === 0 ? (
            <Card className="border-slate-200 dark:border-slate-700">
              <CardContent className="p-12 text-center">
                <img src={burningCashIcon} alt="" className="w-24 h-24 mx-auto mb-3 opacity-50" />
                <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-1">No active purchase orders</h3>
                <p className="text-sm text-muted-foreground">
                  {activePOs.length === 0
                    ? "You have no POs that need attention. Create a new one or switch to the Repository tab for history."
                    : "No POs match your current filters."}
                </p>
                {activePOs.length === 0 && (
                  <Button variant="outline" size="sm" className="mt-3 gap-1.5" onClick={() => setActiveTab('repository')} data-testid="link-go-to-repository">
                    Browse Repository
                  </Button>
                )}
              </CardContent>
            </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map(po => (
            <Card
              key={po.id}
              className="border-slate-200 dark:border-slate-700 hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => setExpandedPO(expandedPO === po.id ? null : po.id)}
              data-testid={`card-po-${po.id}`}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-display font-bold text-[#2D1810] dark:text-blue-300" data-testid={`text-po-number-${po.id}`}>
                        {po.poNumber}
                      </span>
                      <StatusBadge status={po.status} />
                    </div>
                    <p className="text-sm text-slate-600 dark:text-slate-300 mt-1 truncate">{po.description}</p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                      <span>{po.vendor}</span>
                      <span>•</span>
                      <span>{po.submitterName}</span>
                      <span>•</span>
                      <span>{new Date(po.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="font-display font-bold text-lg text-[#E85D04]">${parseFloat(po.totalCost).toFixed(2)}</span>
                    {expandedPO === po.id ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                  </div>
                </div>

                {expandedPO === po.id && (
                  <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700" onClick={e => e.stopPropagation()}>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mb-4">
                      <div>
                        <label className="text-xs font-medium text-slate-400 uppercase">Usage</label>
                        <p className="text-sm text-slate-700 dark:text-slate-300">{po.usage}</p>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-slate-400 uppercase">Project</label>
                        <p className="text-sm text-slate-700 dark:text-slate-300">{po.projectName}</p>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-slate-400 uppercase">Key Stakeholder</label>
                        <p className="text-sm text-slate-700 dark:text-slate-300">{po.keyStakeholder}</p>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-slate-400 uppercase">Billing</label>
                        <p className="text-sm text-slate-700 dark:text-slate-300">
                          {po.billingFrequency}
                          {po.billingFrequency === 'Recurring' && po.recurringFrequency && ` — ${po.recurringFrequency}`}
                          {po.recurringTerm && ` (${po.recurringTerm})`}
                        </p>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-slate-400 uppercase">Cost Breakdown</label>
                        <p className="text-sm text-slate-700 dark:text-slate-300">
                          Cost: ${parseFloat(po.cost).toFixed(2)} | Tax: ${parseFloat(po.tax).toFixed(2)} | Shipping: ${parseFloat(po.shipping).toFixed(2)}
                        </p>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-slate-400 uppercase">Total</label>
                        <p className="font-bold text-[#E85D04]">${parseFloat(po.totalCost).toFixed(2)}</p>
                      </div>
                      {po.paymentStatus && (
                        <div>
                          <label className="text-xs font-medium text-slate-400 uppercase">QBO Type</label>
                          <p className="text-sm">
                            <Badge variant="outline" className={po.paymentStatus === 'paid' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}>
                              {po.paymentStatus === 'paid' ? 'Expense (Paid)' : 'Bill (Accrual)'}
                            </Badge>
                          </p>
                        </div>
                      )}
                    </div>

                    {po.notes && (
                      <div className="mb-4">
                        <label className="text-xs font-medium text-slate-400 uppercase">Notes</label>
                        <p className="text-sm text-slate-600 dark:text-slate-300">{po.notes}</p>
                      </div>
                    )}

                    <div className="mb-4">
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-xs font-medium text-slate-400 uppercase flex items-center gap-1.5">
                          <Paperclip className="w-3.5 h-3.5" /> Attachments ({poAttachments.length})
                        </label>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs gap-1.5"
                          onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                          data-testid={`button-upload-file-${po.id}`}
                        >
                          <Upload className="w-3.5 h-3.5" /> Upload File
                        </Button>
                        <input
                          ref={fileInputRef}
                          type="file"
                          multiple
                          className="hidden"
                          onChange={(e) => { if (e.target.files) handlePoFileUpload(po.id, e.target.files); e.target.value = ''; }}
                        />
                      </div>
                      {poAttachments.length > 0 ? (
                        <div className="space-y-2">
                          {poAttachments.map((att) => {
                            const isImage = att.fileType?.startsWith('image/');
                            return (
                            <div key={att.id} className="bg-slate-50 dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700 overflow-hidden">
                              {isImage && (
                                <div
                                  className="w-full h-32 cursor-pointer hover:opacity-90 transition-opacity"
                                  onClick={(e) => { e.stopPropagation(); setPreviewAttachment(att); }}
                                  data-testid={`preview-thumbnail-${att.id}`}
                                >
                                  <img
                                    src={att.fileUrl}
                                    alt={att.fileName}
                                    className="w-full h-full object-cover"
                                  />
                                </div>
                              )}
                              <div className="flex items-center gap-2 p-2">
                                <File className="w-4 h-4 text-[#E85D04] shrink-0" />
                                <span className="text-sm text-slate-700 dark:text-slate-300 flex-1 truncate">{att.fileName}</span>
                                {isImage && (
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-7 w-7 text-slate-400 hover:text-[#E85D04]"
                                    onClick={(e) => { e.stopPropagation(); setPreviewAttachment(att); }}
                                    data-testid={`button-preview-att-${att.id}`}
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                  </Button>
                                )}
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-7 w-7 text-slate-400 hover:text-[#E85D04]"
                                  onClick={(e) => { e.stopPropagation(); downloadAttachment(att); }}
                                  data-testid={`button-download-att-${att.id}`}
                                >
                                  <Download className="w-3.5 h-3.5" />
                                </Button>
                                {(po.submitterId === activeUser?.id || activeUser?.isAdmin || isPOAdmin) && (
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-7 w-7 text-slate-400 hover:text-red-500"
                                    onClick={(e) => { e.stopPropagation(); deleteAttachmentMutation.mutate(att.id); }}
                                    data-testid={`button-delete-att-${att.id}`}
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </Button>
                              )}
                              </div>
                            </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-xs text-slate-400 italic">No files attached</p>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {canApprove(po) && (
                        <Button
                          size="sm"
                          className="bg-emerald-600 hover:bg-emerald-700 text-white"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (po.status === 'GM Approved') {
                              setOrderDialog(po.id);
                            } else {
                              statusMutation.mutate({ id: po.id, status: getNextApprovalStatus(po.status) });
                            }
                          }}
                          data-testid={`button-approve-${po.id}`}
                        >
                          {getApproveLabel(po)}
                        </Button>
                      )}
                      {canReject(po) && (
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={(e) => { e.stopPropagation(); handleReject(po); }}
                          data-testid={`button-reject-${po.id}`}
                        >
                          Reject
                        </Button>
                      )}
                      {canRequestMoreInfo(po) && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-orange-600 border-orange-300 hover:bg-orange-50"
                          onClick={(e) => { e.stopPropagation(); handleRequestMoreInfo(po); }}
                          data-testid={`button-more-info-${po.id}`}
                        >
                          <Info className="w-3.5 h-3.5 mr-1.5" />
                          Request More Info
                        </Button>
                      )}
                      {po.status === 'More Info Requested' && po.submitterId === activeUser?.id && (
                        <Button
                          size="sm"
                          className="bg-blue-600 hover:bg-blue-700 text-white"
                          onClick={(e) => { e.stopPropagation(); statusMutation.mutate({ id: po.id, status: 'Submitted' }); }}
                          data-testid={`button-resubmit-${po.id}`}
                        >
                          Resubmit
                        </Button>
                      )}
                      {po.status === 'Draft' && po.submitterId === activeUser?.id && (
                        <Button
                          size="sm"
                          className="bg-blue-600 hover:bg-blue-700 text-white"
                          onClick={(e) => { e.stopPropagation(); statusMutation.mutate({ id: po.id, status: 'Submitted' }); }}
                          data-testid={`button-submit-${po.id}`}
                        >
                          Submit for Approval
                        </Button>
                      )}
                      {po.submitterId === activeUser?.id && po.status !== 'Order Placed' && po.status !== 'Cancelled' && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-600"
                          onClick={(e) => { e.stopPropagation(); statusMutation.mutate({ id: po.id, status: 'Cancelled' }); }}
                          data-testid={`button-cancel-${po.id}`}
                        >
                          Cancel
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => { e.stopPropagation(); setHistoryPO(po.id); }}
                        data-testid={`button-history-${po.id}`}
                      >
                        <Clock className="w-3.5 h-3.5 mr-1.5" /> History
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => { e.stopPropagation(); setCommentsPO(po.id); }}
                        data-testid={`button-comments-${po.id}`}
                      >
                        <MessageSquare className="w-3.5 h-3.5 mr-1.5" /> Comments
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
        </TabsContent>

        <TabsContent value="repository" className="space-y-4 mt-0">
          <Card className="border-slate-200 dark:border-slate-700">
            <CardContent className="p-4 sm:p-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div>
                  <Label className="text-xs font-medium text-slate-500 mb-1.5 flex items-center gap-1">
                    <Building2 className="w-3.5 h-3.5" /> Vendor
                  </Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by vendor..."
                      value={repoVendorSearch}
                      onChange={e => setRepoVendorSearch(e.target.value)}
                      className="pl-9"
                      list="vendor-suggestions"
                      data-testid="input-search-vendor"
                    />
                    <datalist id="vendor-suggestions">
                      {uniqueVendors.map(v => <option key={v} value={v} />)}
                    </datalist>
                  </div>
                </div>
                <div>
                  <Label className="text-xs font-medium text-slate-500 mb-1.5 flex items-center gap-1">
                    <UserCircle className="w-3.5 h-3.5" /> Requestor
                  </Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by requestor..."
                      value={repoRequestorSearch}
                      onChange={e => setRepoRequestorSearch(e.target.value)}
                      className="pl-9"
                      list="requestor-suggestions"
                      data-testid="input-search-requestor"
                    />
                    <datalist id="requestor-suggestions">
                      {uniqueRequestors.map(r => <option key={r} value={r} />)}
                    </datalist>
                  </div>
                </div>
                <div>
                  <Label className="text-xs font-medium text-slate-500 mb-1.5 flex items-center gap-1">
                    <Filter className="w-3.5 h-3.5" /> Status
                  </Label>
                  <Select value={repoStatusFilter} onValueChange={setRepoStatusFilter}>
                    <SelectTrigger data-testid="select-repo-status-filter">
                      <SelectValue placeholder="All Statuses" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="Open">Open</SelectItem>
                      <SelectItem value="Rejected">Rejected</SelectItem>
                      <SelectItem value="Approved">Approved</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end">
                  {repoHasFilters && (
                    <Button variant="outline" size="sm" className="gap-1.5 text-slate-500" onClick={clearRepoFilters} data-testid="button-clear-repo-filters">
                      <X className="w-3.5 h-3.5" /> Clear Filters
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex items-center justify-between px-1">
            <p className="text-sm text-muted-foreground">
              <span className="font-semibold text-slate-700 dark:text-slate-200">{repoFiltered.length}</span> purchase order{repoFiltered.length !== 1 ? 's' : ''} found
              {repoHasFilters && <span> (filtered)</span>}
            </p>
            <p className="text-sm text-muted-foreground">
              Total value: <span className="font-semibold text-[#E85D04]">${repoTotalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </p>
          </div>

          {repoFiltered.length === 0 ? (
            <Card className="border-slate-200 dark:border-slate-700">
              <CardContent className="p-12 text-center">
                <Archive className="w-12 h-12 text-muted-foreground/50 mx-auto mb-3" />
                <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-1">No purchase orders found</h3>
                <p className="text-sm text-muted-foreground">
                  {repoHasFilters ? 'Try adjusting your search filters.' : 'No purchase orders have been created yet.'}
                </p>
                {repoHasFilters && (
                  <Button variant="outline" size="sm" className="mt-3" onClick={clearRepoFilters} data-testid="button-clear-repo-empty">
                    Clear Filters
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {repoFiltered.map(po => (
                <Card
                  key={po.id}
                  className="border-slate-200 dark:border-slate-700 hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => setExpandedRepoPO(expandedRepoPO === po.id ? null : po.id)}
                  data-testid={`card-repo-po-${po.id}`}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-display font-bold text-[#2D1810] dark:text-blue-300 text-sm" data-testid={`text-repo-po-number-${po.id}`}>
                            {po.poNumber}
                          </span>
                          <CategoryBadge status={po.status} />
                        </div>
                        <p className="text-sm text-slate-600 dark:text-slate-300 mt-1 truncate">{po.description}</p>
                        <div className="flex items-center gap-4 mt-1.5 text-xs text-muted-foreground flex-wrap">
                          <span className="flex items-center gap-1">
                            <Building2 className="w-3 h-3" />
                            <span className="font-medium text-slate-600 dark:text-slate-300">{po.vendor}</span>
                          </span>
                          <span className="flex items-center gap-1">
                            <UserCircle className="w-3 h-3" />
                            {po.submitterName}
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {new Date(po.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="font-display font-bold text-[#E85D04]">${parseFloat(po.totalCost).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                        {expandedRepoPO === po.id ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                      </div>
                    </div>

                    {expandedRepoPO === po.id && (
                      <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700" onClick={e => e.stopPropagation()}>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                          <div>
                            <label className="text-xs font-medium text-slate-400 uppercase">Vendor</label>
                            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{po.vendor}</p>
                          </div>
                          <div>
                            <label className="text-xs font-medium text-slate-400 uppercase">Requestor</label>
                            <p className="text-sm text-slate-700 dark:text-slate-300">{po.submitterName}</p>
                          </div>
                          <div>
                            <label className="text-xs font-medium text-slate-400 uppercase">Usage</label>
                            <p className="text-sm text-slate-700 dark:text-slate-300">{po.usage}</p>
                          </div>
                          <div>
                            <label className="text-xs font-medium text-slate-400 uppercase">Project</label>
                            <p className="text-sm text-slate-700 dark:text-slate-300">{po.projectName}</p>
                          </div>
                          <div>
                            <label className="text-xs font-medium text-slate-400 uppercase">Key Stakeholder</label>
                            <p className="text-sm text-slate-700 dark:text-slate-300">{po.keyStakeholder}</p>
                          </div>
                          <div>
                            <label className="text-xs font-medium text-slate-400 uppercase">Billing</label>
                            <p className="text-sm text-slate-700 dark:text-slate-300">
                              {po.billingFrequency}
                              {po.billingFrequency === 'Recurring' && po.recurringFrequency && ` — ${po.recurringFrequency}`}
                              {po.recurringTerm && ` (${po.recurringTerm})`}
                            </p>
                          </div>
                          <div>
                            <label className="text-xs font-medium text-slate-400 uppercase">Cost Breakdown</label>
                            <p className="text-sm text-slate-700 dark:text-slate-300">
                              Cost: ${parseFloat(po.cost).toFixed(2)} | Tax: ${parseFloat(po.tax).toFixed(2)} | Shipping: ${parseFloat(po.shipping).toFixed(2)}
                            </p>
                          </div>
                          <div>
                            <label className="text-xs font-medium text-slate-400 uppercase">Total</label>
                            <p className="font-bold text-[#E85D04]">${parseFloat(po.totalCost).toFixed(2)}</p>
                          </div>
                          <div>
                            <label className="text-xs font-medium text-slate-400 uppercase">Date Created</label>
                            <p className="text-sm text-slate-700 dark:text-slate-300">{new Date(po.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                          </div>
                        </div>
                        {po.notes && (
                          <div className="mt-3">
                            <label className="text-xs font-medium text-slate-400 uppercase">Notes</label>
                            <p className="text-sm text-slate-600 dark:text-slate-300">{po.notes}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={!!reasonDialog} onOpenChange={(open) => { if (!open) { setReasonDialog(null); setReasonText(''); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-display">
              {reasonDialog?.type === 'reject' ? (
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
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {reasonDialog?.type === 'reject'
                ? "Please provide a reason for rejecting this purchase order. This will be sent to the submitter."
                : "Please describe what additional information is needed. This will be sent to the submitter."}
            </p>
            <div>
              <Label htmlFor="reason">Reason *</Label>
              <Textarea
                id="reason"
                value={reasonText}
                onChange={e => setReasonText(e.target.value)}
                placeholder={reasonDialog?.type === 'reject'
                  ? "e.g. Budget exceeded, need alternative vendor quote..."
                  : "e.g. Please provide the vendor quote, need project justification..."}
                rows={3}
                data-testid="input-reason"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => { setReasonDialog(null); setReasonText(''); }} data-testid="button-cancel-reason">
              Cancel
            </Button>
            <Button
              onClick={submitReasonAction}
              disabled={!reasonText.trim() || statusMutation.isPending}
              className={reasonDialog?.type === 'reject' ? "bg-red-600 hover:bg-red-700 text-white" : "bg-orange-600 hover:bg-orange-700 text-white"}
              data-testid="button-submit-reason"
            >
              {statusMutation.isPending ? (
                <RefreshCw className="w-4 h-4 animate-spin mr-2" />
              ) : null}
              {reasonDialog?.type === 'reject' ? 'Reject PO' : 'Send Request'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!orderDialog} onOpenChange={(open) => { if (!open) setOrderDialog(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-display">
              <ShoppingCart className="w-5 h-5 text-emerald-600" />
              Mark as Ordered/Provisioned
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              How was this purchase order paid? This determines what type of record is created in QuickBooks.
            </p>
            <div className="grid gap-3">
              <Button
                className="w-full justify-start h-auto py-4 px-4 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200"
                variant="outline"
                onClick={() => {
                  if (orderDialog) {
                    statusMutation.mutate({ id: orderDialog, status: 'Order Placed', paymentStatus: 'paid' });
                  }
                }}
                disabled={statusMutation.isPending}
                data-testid="button-order-paid"
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
                  if (orderDialog) {
                    statusMutation.mutate({ id: orderDialog, status: 'Order Placed', paymentStatus: 'accrual' });
                  }
                }}
                disabled={statusMutation.isPending}
                data-testid="button-order-accrual"
              >
                <div className="text-left">
                  <div className="font-semibold">Not Yet Paid (Accrual)</div>
                  <div className="text-xs text-amber-700 mt-0.5">Creates a QBO Bill — vendor will invoice, payment pending</div>
                </div>
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOrderDialog(null)} data-testid="button-cancel-order">
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!historyPO} onOpenChange={(open) => { if (!open) setHistoryPO(null); }}>
        <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">PO History</DialogTitle>
          </DialogHeader>
          {poHistoryData.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No history yet</p>
          ) : (
            <div className="space-y-3">
              {poHistoryData.map((h: PoHistory) => (
                <div key={h.id} className="flex gap-3 text-sm border-b pb-3 last:border-0">
                  <div className="w-2 h-2 rounded-full bg-[#E85D04] mt-1.5 shrink-0" />
                  <div>
                    <p className="font-medium text-slate-900 dark:text-white">{h.changedBy}</p>
                    <p className="text-muted-foreground text-xs">{h.details}</p>
                    <p className="text-muted-foreground text-xs mt-0.5">{new Date(h.createdAt).toLocaleString()}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!commentsPO} onOpenChange={(open) => { if (!open) setCommentsPO(null); }}>
        <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">Comments</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mb-4">
            {poCommentsData.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No comments yet</p>
            ) : (
              poCommentsData.map((c: PoComment) => (
                <div key={c.id} className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-sm">{c.author}</span>
                    <span className="text-xs text-muted-foreground">{c.date}</span>
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-300">{c.text}</p>
                </div>
              ))
            )}
          </div>
          <div className="flex gap-2">
            <Textarea
              value={newComment}
              onChange={e => setNewComment(e.target.value)}
              placeholder="Add a comment..."
              rows={2}
              className="flex-1"
              data-testid="input-po-comment"
            />
            <Button
              onClick={() => commentsPO && commentMutation.mutate({ poId: commentsPO, text: newComment })}
              disabled={!newComment.trim() || commentMutation.isPending}
              className="bg-[#2D1810] hover:bg-[#2D1810]/90 self-end"
              data-testid="button-add-po-comment"
            >
              Send
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!previewAttachment} onOpenChange={(open) => { if (!open) setPreviewAttachment(null); }}>
        <DialogContent className="max-w-3xl max-h-[90vh] p-0 overflow-hidden">
          <DialogHeader className="p-4 pb-2">
            <DialogTitle className="text-sm font-medium truncate">{previewAttachment?.fileName}</DialogTitle>
          </DialogHeader>
          <div className="px-4 pb-4 flex items-center justify-center overflow-auto max-h-[75vh]">
            {previewAttachment && (
              <img
                src={previewAttachment.fileUrl}
                alt={previewAttachment.fileName}
                className="max-w-full max-h-[70vh] object-contain rounded"
                data-testid="img-preview-full"
              />
            )}
          </div>
          <div className="flex justify-end gap-2 px-4 pb-4">
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={() => previewAttachment && downloadAttachment(previewAttachment)}
              data-testid="button-preview-download"
            >
              <Download className="w-3.5 h-3.5" /> Download
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
