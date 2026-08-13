import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, getQueryFn } from "@/lib/queryClient";
import { Link, useSearch } from "wouter";
import { useCategories } from "@/hooks/use-categories";
import {
  ArrowLeft, CheckCircle2, XCircle, RefreshCw, Loader2,
  Link2, Unlink, FileText, AlertTriangle, ExternalLink,
  BookOpen, Pencil, Trash2, Save, X, Plus, DollarSign, Users, Building2, Key
} from "lucide-react";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface QBOStatus {
  configured: boolean;
  connected: boolean;
  realmId: string | null;
  pendingBillsCount: number;
  lastUpdated: string | null;
}

interface GlMapping {
  id: string;
  category: string;
  accountNumber: string;
  accountName: string;
  parentAccountName: string | null;
  createdAt: string;
  updatedAt: string;
}

const DEFAULT_MAPPINGS: Record<string, { accountNumber: string; accountName: string; parentAccountName: string }> = {
  "Flights": { accountNumber: "6305", accountName: "Airfare", parentAccountName: "Travel and Entertainment" },
  "Meals": { accountNumber: "6301", accountName: "Meals & Entertainment -Standard", parentAccountName: "Travel and Entertainment" },
  "Hotel": { accountNumber: "6306", accountName: "Hotel", parentAccountName: "Travel and Entertainment" },
  "Mileage": { accountNumber: "6303", accountName: "Mileage", parentAccountName: "Travel and Entertainment" },
  "Taxi": { accountNumber: "6304", accountName: "Local Transportation", parentAccountName: "Travel and Entertainment" },
};

export default function AdminQuickbooks() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { categories: activeCategories, categoryNames: CATEGORIES } = useCategories();
  const searchString = useSearch();
  const params = new URLSearchParams(searchString);

  useEffect(() => {
    if (params.get("connected") === "true") {
      toast({
        title: "QuickBooks Connected",
        description: "Your QuickBooks Online account has been successfully connected.",
        className: "bg-emerald-50 border-emerald-200 text-emerald-900",
      });
    }
    if (params.get("error") === "auth_failed") {
      toast({
        title: "Connection Failed",
        description: "Failed to connect to QuickBooks. Please try again.",
        variant: "destructive",
      });
    }
  }, []);

  const { data: status, isLoading } = useQuery<QBOStatus>({
    queryKey: ["/api/quickbooks/status"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const connectMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("GET", "/api/quickbooks/auth");
      const data = await res.json();
      return data.url;
    },
    onSuccess: (url: string) => {
      window.location.href = url;
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/quickbooks/disconnect");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quickbooks/status"] });
      toast({
        title: "Disconnected",
        description: "QuickBooks Online has been disconnected.",
      });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/quickbooks/sync");
      return res.json();
    },
    onSuccess: (data: { synced: number; errors: number; total: number }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/quickbooks/status"] });
      if (data.synced > 0) {
        toast({
          title: "Sync Complete",
          description: `${data.synced} bill(s) marked as paid. ${data.errors > 0 ? `${data.errors} error(s).` : ""}`,
          className: "bg-emerald-50 border-emerald-200 text-emerald-900",
        });
      } else if (data.total === 0) {
        toast({
          title: "No Pending Bills",
          description: "There are no pending bills to sync.",
        });
      } else {
        toast({
          title: "Sync Complete",
          description: `Checked ${data.total} bill(s). None are paid yet.${data.errors > 0 ? ` ${data.errors} error(s).` : ""}`,
        });
      }
    },
    onError: (error: any) => {
      toast({ title: "Sync Failed", description: error.message, variant: "destructive" });
    },
  });

  const { data: glMappings = [], isLoading: glLoading } = useQuery<GlMapping[]>({
    queryKey: ["/api/gl-mappings"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const { data: qboBills = [] } = useQuery<any[]>({
    queryKey: ["/api/quickbooks/bills"],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: !!status?.connected,
  });

  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ accountNumber: "", accountName: "", parentAccountName: "" });
  const [newCategoryName, setNewCategoryName] = useState("");

  const addCategoryMutation = useMutation({
    mutationFn: async (name: string) => {
      const res = await apiRequest("POST", "/api/categories", { name });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
      setNewCategoryName("");
      toast({ title: "Category Added", description: "New expense category has been created.", className: "bg-emerald-50 border-emerald-200 text-emerald-900" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const removeCategoryMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/categories/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
      toast({ title: "Category Removed", description: "Expense category has been removed." });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const saveMappingMutation = useMutation({
    mutationFn: async (data: { category: string; accountNumber: string; accountName: string; parentAccountName: string }) => {
      const res = await apiRequest("PUT", "/api/gl-mappings", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/gl-mappings"] });
      setEditingCategory(null);
      toast({ title: "Mapping Saved", description: "GL account mapping has been updated.", className: "bg-emerald-50 border-emerald-200 text-emerald-900" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteMappingMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/gl-mappings/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/gl-mappings"] });
      toast({ title: "Mapping Removed", description: "Custom GL mapping removed. Default mapping will be used." });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  function startEditing(category: string) {
    const existing = glMappings.find(m => m.category === category);
    const defaults = DEFAULT_MAPPINGS[category];
    setEditForm({
      accountNumber: existing?.accountNumber || defaults?.accountNumber || "",
      accountName: existing?.accountName || defaults?.accountName || "",
      parentAccountName: existing?.parentAccountName || defaults?.parentAccountName || "",
    });
    setEditingCategory(category);
  }

  function getMappingForCategory(category: string): { accountNumber: string; accountName: string; parentAccountName: string; isCustom: boolean } {
    const existing = glMappings.find(m => m.category === category);
    if (existing) {
      return { accountNumber: existing.accountNumber, accountName: existing.accountName, parentAccountName: existing.parentAccountName || "", isCustom: true };
    }
    const defaults = DEFAULT_MAPPINGS[category];
    if (defaults) {
      return { ...defaults, isCustom: false };
    }
    return { accountNumber: "6300", accountName: "Travel and Entertainment", parentAccountName: "", isCustom: false };
  }

  if (isLoading) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
        Loading QuickBooks settings...
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center gap-2 sm:gap-4">
        <Link href="/admin/users">
          <Button variant="ghost" size="icon" className="shrink-0" data-testid="button-back">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h2 className="text-xl sm:text-2xl font-display font-bold text-slate-900 dark:text-slate-100" data-testid="text-page-title">
            Integration Management
          </h2>
          <p className="text-slate-500 dark:text-slate-400">Connect external services for payroll, accounting, and more.</p>
        </div>
      </div>

      <Tabs defaultValue="quickbooks" className="space-y-6">
        <TabsList>
          <TabsTrigger value="quickbooks" data-testid="tab-quickbooks">
            <BookOpen className="w-4 h-4 mr-1.5" />
            QuickBooks
          </TabsTrigger>
          <TabsTrigger value="gusto" data-testid="tab-gusto">
            <DollarSign className="w-4 h-4 mr-1.5" />
            Gusto
          </TabsTrigger>
        </TabsList>

        <TabsContent value="quickbooks" className="space-y-6 mt-0">

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Link2 className="w-4 h-4 text-[#E85D04]" />
            Connection Status
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            {status?.connected ? (
              <>
                <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <p className="font-medium text-slate-900 dark:text-slate-100">Connected</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Company ID: {status.realmId}
                    {status.lastUpdated && (
                      <span> &middot; Last updated: {new Date(status.lastUpdated).toLocaleDateString()}</span>
                    )}
                  </p>
                </div>
              </>
            ) : (
              <>
                <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                  <XCircle className="w-5 h-5 text-slate-400" />
                </div>
                <div>
                  <p className="font-medium text-slate-900 dark:text-slate-100">Not Connected</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Connect your QuickBooks Online account to enable automatic bill syncing.
                  </p>
                </div>
              </>
            )}
          </div>

          <div className="flex flex-wrap gap-3 pt-2">
            {status?.connected ? (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" className="text-red-600 border-red-200 hover:bg-red-50" data-testid="button-disconnect-qbo">
                    <Unlink className="w-4 h-4 mr-2" />
                    Disconnect
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Disconnect QuickBooks?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will stop automatic bill creation and payment syncing. Existing bills in QuickBooks will not be affected.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-red-600 hover:bg-red-700"
                      onClick={() => disconnectMutation.mutate()}
                    >
                      Disconnect
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            ) : (
              <Button
                className="bg-[#2CA01C] hover:bg-[#248a17] text-white"
                onClick={() => connectMutation.mutate()}
                disabled={connectMutation.isPending || !status?.configured}
                data-testid="button-connect-qbo"
              >
                {connectMutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <ExternalLink className="w-4 h-4 mr-2" />
                )}
                Connect to QuickBooks
              </Button>
            )}
          </div>

          {!status?.configured && (
            <Alert className="border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-700">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-800 dark:text-amber-200 text-sm">
                QuickBooks credentials are not configured. Please add <code className="bg-amber-100 dark:bg-amber-900 px-1 rounded">QBO_CLIENT_ID</code> and <code className="bg-amber-100 dark:bg-amber-900 px-1 rounded">QBO_CLIENT_SECRET</code> to your secrets.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="w-4 h-4 text-[#E85D04]" />
            Expense Categories
          </CardTitle>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Manage the expense categories available in the submission form.
          </p>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {activeCategories.map((cat) => (
                <div key={cat.id} className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 rounded-full px-3 py-1.5" data-testid={`category-tag-${cat.name.toLowerCase()}`}>
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{cat.name}</span>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <button
                        className="ml-1 text-slate-400 hover:text-red-500 transition-colors"
                        data-testid={`button-remove-category-${cat.name.toLowerCase()}`}
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Remove Category?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will remove "{cat.name}" from the expense submission form. Existing expenses with this category will not be affected.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          className="bg-red-600 hover:bg-red-700"
                          onClick={() => removeCategoryMutation.mutate(cat.id)}
                        >
                          Remove
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              ))}
            </div>
            <div className="flex gap-2 pt-2">
              <Input
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="New category name..."
                className="max-w-xs"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newCategoryName.trim()) {
                    addCategoryMutation.mutate(newCategoryName.trim());
                  }
                }}
                data-testid="input-new-category"
              />
              <Button
                size="sm"
                className="bg-[#E85D04] hover:bg-[#C2410C] text-white"
                disabled={!newCategoryName.trim() || addCategoryMutation.isPending}
                onClick={() => addCategoryMutation.mutate(newCategoryName.trim())}
                data-testid="button-add-category"
              >
                {addCategoryMutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4 mr-1" />
                )}
                Add
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-[#E85D04]" />
            GL Account Mapping
          </CardTitle>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Map each expense category to a GL account in QuickBooks Online. These mappings determine which account is used when bills are created.
          </p>
        </CardHeader>
        <CardContent>
          {glLoading ? (
            <div className="text-center py-4 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
              Loading mappings...
            </div>
          ) : (
            <div className="space-y-3">
              {CATEGORIES.map((category) => {
                const mapping = getMappingForCategory(category);
                const existingMapping = glMappings.find(m => m.category === category);
                const isEditing = editingCategory === category;

                return (
                  <div key={category} className="border rounded-lg p-4 bg-slate-50/50 dark:bg-slate-800/50" data-testid={`gl-mapping-${category.toLowerCase()}`}>
                    {isEditing ? (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="font-medium text-slate-900 dark:text-slate-100">{category}</h4>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setEditingCategory(null)}
                              data-testid={`button-cancel-edit-${category.toLowerCase()}`}
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div>
                            <Label className="text-xs text-slate-500">Account Number</Label>
                            <Input
                              value={editForm.accountNumber}
                              onChange={(e) => setEditForm(f => ({ ...f, accountNumber: e.target.value }))}
                              placeholder="e.g. 6305"
                              className="mt-1"
                              data-testid={`input-account-number-${category.toLowerCase()}`}
                            />
                          </div>
                          <div>
                            <Label className="text-xs text-slate-500">Account Name</Label>
                            <Input
                              value={editForm.accountName}
                              onChange={(e) => setEditForm(f => ({ ...f, accountName: e.target.value }))}
                              placeholder="e.g. Airfare"
                              className="mt-1"
                              data-testid={`input-account-name-${category.toLowerCase()}`}
                            />
                          </div>
                          <div>
                            <Label className="text-xs text-slate-500">Parent Account (optional)</Label>
                            <Input
                              value={editForm.parentAccountName}
                              onChange={(e) => setEditForm(f => ({ ...f, parentAccountName: e.target.value }))}
                              placeholder="e.g. Travel and Entertainment"
                              className="mt-1"
                              data-testid={`input-parent-account-${category.toLowerCase()}`}
                            />
                          </div>
                        </div>
                        <div className="flex justify-end">
                          <Button
                            size="sm"
                            className="bg-[#E85D04] hover:bg-[#C2410C] text-white"
                            disabled={!editForm.accountNumber || !editForm.accountName || saveMappingMutation.isPending}
                            onClick={() => saveMappingMutation.mutate({
                              category,
                              accountNumber: editForm.accountNumber,
                              accountName: editForm.accountName,
                              parentAccountName: editForm.parentAccountName,
                            })}
                            data-testid={`button-save-mapping-${category.toLowerCase()}`}
                          >
                            {saveMappingMutation.isPending ? (
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            ) : (
                              <Save className="w-4 h-4 mr-2" />
                            )}
                            Save Mapping
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-medium text-slate-900 dark:text-slate-100">{category}</h4>
                            {mapping.isCustom ? (
                              <Badge variant="secondary" className="bg-[#E85D04]/10 text-[#E85D04] border-[#E85D04]/20 text-xs">Custom</Badge>
                            ) : (
                              <Badge variant="secondary" className="text-xs">Default</Badge>
                            )}
                          </div>
                          <div className="text-sm text-slate-600 dark:text-slate-400">
                            <span className="font-mono text-xs bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded">{mapping.accountNumber}</span>
                            <span className="mx-2">&rarr;</span>
                            <span>
                              {mapping.parentAccountName ? `${mapping.parentAccountName} : ` : ""}
                              {mapping.accountName}
                            </span>
                          </div>
                        </div>
                        <div className="flex gap-1 ml-4">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => startEditing(category)}
                            data-testid={`button-edit-mapping-${category.toLowerCase()}`}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          {mapping.isCustom && existingMapping && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                  data-testid={`button-delete-mapping-${category.toLowerCase()}`}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Reset to Default?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This will remove the custom GL mapping for "{category}" and revert to the default mapping.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    className="bg-red-600 hover:bg-red-700"
                                    onClick={() => deleteMappingMutation.mutate(existingMapping.id)}
                                  >
                                    Reset to Default
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="w-4 h-4 text-[#E85D04]" />
            How It Works
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-[#E85D04]/10 flex items-center justify-center shrink-0 text-sm font-bold text-[#E85D04]">1</div>
              <div>
                <p className="font-medium text-slate-900 dark:text-slate-100 text-sm">Expense Gets Final Approval</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">When a GM or Executive Chairman gives final approval, the expense is ready for billing.</p>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-[#E85D04]/10 flex items-center justify-center shrink-0 text-sm font-bold text-[#E85D04]">2</div>
              <div>
                <p className="font-medium text-slate-900 dark:text-slate-100 text-sm">Bill Created in QuickBooks</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">A bill is automatically created in QuickBooks Online with the expense details, vendor (employee name), and amount.</p>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-[#E85D04]/10 flex items-center justify-center shrink-0 text-sm font-bold text-[#E85D04]">3</div>
              <div>
                <p className="font-medium text-slate-900 dark:text-slate-100 text-sm">QuickBooks User Pays the Bill</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Your bookkeeper reviews and pays the bill within QuickBooks as part of their normal payment process.</p>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center shrink-0 text-sm font-bold text-emerald-600">4</div>
              <div>
                <p className="font-medium text-slate-900 dark:text-slate-100 text-sm">Expense Marked as Reimbursed</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">When the sync runs, paid bills are detected and the corresponding expenses are automatically marked as "Reimbursed" in the app.</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {status?.connected && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-[#E85D04]" />
              Payment Sync
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-700 dark:text-slate-300">
                  <span className="font-medium">{status.pendingBillsCount}</span> pending bill{status.pendingBillsCount !== 1 ? "s" : ""} waiting for payment in QuickBooks
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Click sync to check if any bills have been paid.
                </p>
              </div>
              <Button
                variant="outline"
                onClick={() => syncMutation.mutate()}
                disabled={syncMutation.isPending}
                data-testid="button-sync-qbo"
              >
                {syncMutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4 mr-2" />
                )}
                Sync Now
              </Button>
            </div>

            {status.pendingBillsCount > 0 && (
              <Badge variant="secondary" className="bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-700">
                {status.pendingBillsCount} expense{status.pendingBillsCount !== 1 ? "s" : ""} awaiting QuickBooks payment
              </Badge>
            )}
          </CardContent>
        </Card>
      )}

      {status?.connected && qboBills.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="w-4 h-4 text-[#E85D04]" />
              QBO Sync History
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700">
                    <th className="text-left py-2 px-3 font-medium text-slate-500 text-xs uppercase">Source</th>
                    <th className="text-left py-2 px-3 font-medium text-slate-500 text-xs uppercase">Vendor</th>
                    <th className="text-left py-2 px-3 font-medium text-slate-500 text-xs uppercase">Amount</th>
                    <th className="text-left py-2 px-3 font-medium text-slate-500 text-xs uppercase">QBO Type</th>
                    <th className="text-left py-2 px-3 font-medium text-slate-500 text-xs uppercase">Status</th>
                    <th className="text-left py-2 px-3 font-medium text-slate-500 text-xs uppercase">QBO ID</th>
                    <th className="text-left py-2 px-3 font-medium text-slate-500 text-xs uppercase">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {qboBills.map((bill: any) => (
                    <tr key={bill.id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <td className="py-2 px-3">
                        {bill.purchaseOrderId ? (
                          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-xs">PO</Badge>
                        ) : (
                          <Badge variant="outline" className="bg-violet-50 text-violet-700 border-violet-200 text-xs">Expense</Badge>
                        )}
                      </td>
                      <td className="py-2 px-3 text-slate-700 dark:text-slate-300">{bill.vendorName || '—'}</td>
                      <td className="py-2 px-3 font-medium text-slate-900 dark:text-slate-100">${parseFloat(bill.amount || 0).toFixed(2)}</td>
                      <td className="py-2 px-3">
                        <Badge variant="outline" className={bill.qboType === 'expense' ? 'bg-emerald-50 text-emerald-700 border-emerald-200 text-xs' : 'bg-amber-50 text-amber-700 border-amber-200 text-xs'}>
                          {bill.qboType === 'expense' ? 'Expense' : 'Bill'}
                        </Badge>
                      </td>
                      <td className="py-2 px-3">
                        <Badge variant="outline" className={
                          bill.syncStatus === 'synced' ? 'bg-emerald-50 text-emerald-700 border-emerald-200 text-xs' :
                          bill.syncStatus === 'error' ? 'bg-red-50 text-red-700 border-red-200 text-xs' :
                          'bg-amber-50 text-amber-700 border-amber-200 text-xs'
                        }>
                          {bill.syncStatus === 'synced' ? 'Paid' : bill.syncStatus === 'error' ? 'Error' : 'Pending'}
                        </Badge>
                      </td>
                      <td className="py-2 px-3 text-xs text-slate-500 font-mono">{bill.qboBillId || '—'}</td>
                      <td className="py-2 px-3 text-xs text-slate-500">
                        {bill.createdAt ? new Date(bill.createdAt).toLocaleDateString() : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

        </TabsContent>

        <TabsContent value="gusto" className="space-y-6 mt-0">
          <GustoIntegration />
        </TabsContent>

      </Tabs>
    </div>
  );
}

interface GustoStatus {
  configured: boolean;
  connected: boolean;
  companyId: string | null;
  companyName: string | null;
  syncEnabled: boolean;
  lastSyncAt: string | null;
}

function GustoIntegration() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [connectDialogOpen, setConnectDialogOpen] = useState(false);
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");

  const { data: gustoStatus, isLoading } = useQuery<GustoStatus>({
    queryKey: ["/api/gusto/status"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const connectMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/gusto/connect", { clientId, clientSecret });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/gusto/status"] });
      setConnectDialogOpen(false);
      setClientId("");
      setClientSecret("");
      toast({
        title: "Gusto Connected",
        description: "Your Gusto account has been successfully connected.",
        className: "bg-emerald-50 border-emerald-200 text-emerald-900",
      });
    },
    onError: (error: any) => {
      toast({ title: "Connection Failed", description: error.message, variant: "destructive" });
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/gusto/disconnect");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/gusto/status"] });
      toast({ title: "Disconnected", description: "Gusto has been disconnected." });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const toggleSyncMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/gusto/toggle-sync");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/gusto/status"] });
      toast({
        title: gustoStatus?.syncEnabled ? "Auto-Sync Disabled" : "Auto-Sync Enabled",
        description: gustoStatus?.syncEnabled
          ? "Reimbursements will no longer auto-sync to Gusto payroll."
          : "Approved reimbursements will automatically sync to Gusto payroll.",
      });
    },
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/gusto/sync");
      return res.json();
    },
    onSuccess: (data: { synced: number; message: string }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/gusto/status"] });
      toast({
        title: "Sync Complete",
        description: data.message,
        className: "bg-emerald-50 border-emerald-200 text-emerald-900",
      });
    },
    onError: (error: any) => {
      toast({ title: "Sync Failed", description: error.message, variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
        Loading Gusto settings...
      </div>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Link2 className="w-4 h-4 text-[#E85D04]" />
            Gusto Connection
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            {gustoStatus?.connected ? (
              <>
                <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <p className="font-medium text-slate-900 dark:text-slate-100">Connected</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Company: {gustoStatus.companyName || "Unknown"}
                    {gustoStatus.lastSyncAt && (
                      <span> &middot; Last synced: {new Date(gustoStatus.lastSyncAt).toLocaleDateString()}</span>
                    )}
                  </p>
                </div>
              </>
            ) : (
              <>
                <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                  <XCircle className="w-5 h-5 text-slate-400" />
                </div>
                <div>
                  <p className="font-medium text-slate-900 dark:text-slate-100">Not Connected</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Connect your Gusto account to sync reimbursements with payroll.
                  </p>
                </div>
              </>
            )}
          </div>

          <div className="flex flex-wrap gap-3 pt-2">
            {gustoStatus?.connected ? (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" className="text-red-600 border-red-200 hover:bg-red-50" data-testid="button-disconnect-gusto">
                    <Unlink className="w-4 h-4 mr-2" />
                    Disconnect
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Disconnect Gusto?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will stop automatic payroll reimbursement syncing. Existing payroll entries in Gusto will not be affected.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-red-600 hover:bg-red-700"
                      onClick={() => disconnectMutation.mutate()}
                    >
                      Disconnect
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            ) : (
              <Button
                className="bg-[#E85D04] hover:bg-[#C2410C] text-white"
                onClick={() => setConnectDialogOpen(true)}
                data-testid="button-connect-gusto"
              >
                <Key className="w-4 h-4 mr-2" />
                Connect to Gusto
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {gustoStatus?.connected && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <RefreshCw className="w-4 h-4 text-[#E85D04]" />
                Payroll Sync Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm text-slate-900 dark:text-slate-100">Auto-Sync Reimbursements</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Automatically add approved expense reimbursements to the next Gusto payroll run.
                  </p>
                </div>
                <Switch
                  checked={gustoStatus.syncEnabled}
                  onCheckedChange={() => toggleSyncMutation.mutate()}
                  data-testid="toggle-gusto-sync"
                />
              </div>

              <div className="border-t pt-4 flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-700 dark:text-slate-300">
                    Manually sync all pending reimbursements to Gusto now.
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {gustoStatus.lastSyncAt
                      ? `Last synced: ${new Date(gustoStatus.lastSyncAt).toLocaleString()}`
                      : "Never synced"}
                  </p>
                </div>
                <Button
                  variant="outline"
                  onClick={() => syncMutation.mutate()}
                  disabled={syncMutation.isPending}
                  data-testid="button-sync-gusto"
                >
                  {syncMutation.isPending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4 mr-2" />
                  )}
                  Sync Now
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#E85D04]" />
                How It Works
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#E85D04]/10 flex items-center justify-center shrink-0 text-sm font-bold text-[#E85D04]">1</div>
                  <div>
                    <p className="font-medium text-slate-900 dark:text-slate-100 text-sm">Expense Gets Approved</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">When an expense receives final approval and is marked for reimbursement.</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#E85D04]/10 flex items-center justify-center shrink-0 text-sm font-bold text-[#E85D04]">2</div>
                  <div>
                    <p className="font-medium text-slate-900 dark:text-slate-100 text-sm">Synced to Gusto Payroll</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">The reimbursement amount is automatically added as a line item to the employee's next payroll run in Gusto.</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#E85D04]/10 flex items-center justify-center shrink-0 text-sm font-bold text-[#E85D04]">3</div>
                  <div>
                    <p className="font-medium text-slate-900 dark:text-slate-100 text-sm">Payroll Processes</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">When payroll runs in Gusto, the employee receives the reimbursement along with their regular pay.</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center shrink-0 text-sm font-bold text-emerald-600">4</div>
                  <div>
                    <p className="font-medium text-slate-900 dark:text-slate-100 text-sm">Expense Marked as Reimbursed</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Once payroll completes, the expense is automatically updated to "Reimbursed" in the app.</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      <Dialog open={connectDialogOpen} onOpenChange={setConnectDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Connect to Gusto</DialogTitle>
            <DialogDescription>
              Enter your Gusto API credentials to connect. You can find these in your Gusto developer dashboard.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="gusto-client-id">Client ID</Label>
              <Input
                id="gusto-client-id"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                placeholder="Enter your Gusto Client ID"
                data-testid="input-gusto-client-id"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="gusto-client-secret">Client Secret</Label>
              <Input
                id="gusto-client-secret"
                type="password"
                value={clientSecret}
                onChange={(e) => setClientSecret(e.target.value)}
                placeholder="Enter your Gusto Client Secret"
                data-testid="input-gusto-client-secret"
              />
            </div>
            <Alert className="border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-700">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-800 dark:text-amber-200 text-sm">
                You can obtain API credentials from the <a href="https://dev.gusto.com" target="_blank" rel="noopener noreferrer" className="underline font-medium">Gusto Developer Portal</a>. Make sure your app has the <code className="bg-amber-100 dark:bg-amber-900 px-1 rounded">payrolls</code> and <code className="bg-amber-100 dark:bg-amber-900 px-1 rounded">employees</code> scopes.
              </AlertDescription>
            </Alert>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConnectDialogOpen(false)}>Cancel</Button>
            <Button
              className="bg-[#E85D04] hover:bg-[#C2410C] text-white"
              onClick={() => connectMutation.mutate()}
              disabled={!clientId.trim() || !clientSecret.trim() || connectMutation.isPending}
              data-testid="button-confirm-connect-gusto"
            >
              {connectMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Link2 className="w-4 h-4 mr-2" />
              )}
              Connect
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
