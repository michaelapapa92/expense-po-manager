import { useState, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { getQueryFn, apiRequest } from '@/lib/queryClient';
import { useRole } from '@/lib/roleContext';
import { useLocation } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Save, Send, ShoppingCart, Upload, File, X, Loader2 } from 'lucide-react';
import { User } from '@/lib/mockData';
import burningCash2 from "@/assets/burning-cash-2.png";

interface PendingFile {
  name: string;
  type: string;
  dataUrl: string;
  size: number;
}

export default function NewPurchaseOrder() {
  const { currentUser, effectiveUser } = useRole();
  const activeUser = effectiveUser || currentUser;
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [vendor, setVendor] = useState('');
  const [usage, setUsage] = useState('Internal');
  const [description, setDescription] = useState('');
  const [cost, setCost] = useState('');
  const [tax, setTax] = useState('0');
  const [shipping, setShipping] = useState('0');
  const [billingFrequency, setBillingFrequency] = useState('One-Time');
  const [recurringFrequency, setRecurringFrequency] = useState('');
  const [recurringTerm, setRecurringTerm] = useState('');
  const [projectName, setProjectName] = useState('');
  const [keyStakeholder, setKeyStakeholder] = useState('');
  const [notes, setNotes] = useState('');
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  const { data: nextPoNumber } = useQuery<{ poNumber: string }>({
    queryKey: ['/api/purchase-orders/next-number'],
    queryFn: getQueryFn({ on401: 'returnNull' }),
  });

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ['/api/users'],
    queryFn: getQueryFn({ on401: 'returnNull' }),
  });

  const totalCost = (parseFloat(cost || '0') + parseFloat(tax || '0') + parseFloat(shipping || '0')).toFixed(2);

  const MAX_FILE_SIZE = 10 * 1024 * 1024;

  const readFileAsDataUrl = (file: globalThis.File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleFiles = async (files: FileList | globalThis.File[]) => {
    const newFiles: PendingFile[] = [];
    for (const file of Array.from(files)) {
      if (file.size > MAX_FILE_SIZE) {
        toast({ title: 'File too large', description: `${file.name} exceeds the 10MB limit`, variant: 'destructive' });
        continue;
      }
      const dataUrl = await readFileAsDataUrl(file);
      newFiles.push({ name: file.name, type: file.type || 'application/octet-stream', dataUrl, size: file.size });
    }
    setPendingFiles(prev => [...prev, ...newFiles]);
  };

  const removePendingFile = (index: number) => {
    setPendingFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const createMutation = useMutation({
    mutationFn: async (status: string) => {
      const res = await apiRequest('POST', '/api/purchase-orders', {
        poNumber: nextPoNumber?.poNumber || 'PO-00001',
        vendor,
        usage,
        description,
        cost: parseFloat(cost || '0').toFixed(2),
        tax: parseFloat(tax || '0').toFixed(2),
        shipping: parseFloat(shipping || '0').toFixed(2),
        totalCost,
        billingFrequency,
        recurringFrequency: billingFrequency === 'Recurring' ? recurringFrequency : null,
        recurringTerm: billingFrequency === 'Recurring' ? recurringTerm : null,
        projectName,
        keyStakeholder,
        status,
        submitterId: activeUser?.id || '',
        submitterName: activeUser?.name || '',
        notes: notes || null,
      });
      const po = await res.json();

      if (pendingFiles.length > 0) {
        for (const file of pendingFiles) {
          await apiRequest('POST', `/api/purchase-orders/${po.id}/attachments`, {
            fileName: file.name,
            fileType: file.type,
            fileUrl: file.dataUrl,
          });
        }
      }

      return po;
    },
    onSuccess: () => {
      toast({ title: 'Purchase order created' });
      navigate('/purchase-orders');
    },
    onError: (err: any) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  const isValid = vendor.trim() && description.trim() && cost && parseFloat(cost) > 0 && projectName.trim() && keyStakeholder.trim()
    && (billingFrequency === 'One-Time' || (recurringFrequency.trim() && recurringTerm.trim()));

  return (
    <div className="p-4 sm:p-8 max-w-3xl mx-auto">
      <Button
        variant="ghost"
        className="mb-4 text-slate-500"
        onClick={() => navigate('/purchase-orders')}
        data-testid="button-back"
      >
        <ArrowLeft className="w-4 h-4 mr-2" /> Back to Purchase Orders
      </Button>

      <div className="relative overflow-hidden rounded-2xl p-5 mb-6 text-white shadow-lg" style={{ background: 'linear-gradient(135deg, #2D1810, #1C1917)' }}>
        <div className="absolute inset-0 opacity-20">
          <img src={burningCash2} alt="" className="w-full h-full object-cover" />
        </div>
        <div className="relative z-10 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
            <ShoppingCart className="w-5 h-5 text-[#FB923C]" />
          </div>
          <div>
            <h1 className="text-2xl font-display font-bold" data-testid="text-page-title">
              New Purchase Order
            </h1>
            {nextPoNumber && (
              <p className="text-sm text-amber-200/70 font-mono">{nextPoNumber.poNumber}</p>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Vendor & Usage</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="vendor">Vendor *</Label>
              <Input
                id="vendor"
                value={vendor}
                onChange={(e) => setVendor(e.target.value)}
                placeholder="Enter vendor name"
                data-testid="input-vendor"
              />
            </div>
            <div>
              <Label>Usage *</Label>
              <RadioGroup value={usage} onValueChange={setUsage} className="flex gap-4 mt-2">
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="Internal" id="usage-internal" data-testid="radio-usage-internal" />
                  <Label htmlFor="usage-internal" className="font-normal cursor-pointer">Internal</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="Customer" id="usage-customer" data-testid="radio-usage-customer" />
                  <Label htmlFor="usage-customer" className="font-normal cursor-pointer">Customer</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="Other" id="usage-other" data-testid="radio-usage-other" />
                  <Label htmlFor="usage-other" className="font-normal cursor-pointer">Other</Label>
                </div>
              </RadioGroup>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Description & Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="description">Description *</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the purchase..."
                className="min-h-[80px]"
                data-testid="input-description"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="project">Project Name *</Label>
                <Input
                  id="project"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="Enter project name"
                  data-testid="input-project"
                />
              </div>
              <div>
                <Label htmlFor="stakeholder">Key Stakeholder *</Label>
                <Select value={keyStakeholder} onValueChange={setKeyStakeholder}>
                  <SelectTrigger data-testid="select-stakeholder">
                    <SelectValue placeholder="Select stakeholder" />
                  </SelectTrigger>
                  <SelectContent>
                    {users.map(u => (
                      <SelectItem key={u.id} value={u.name}>{u.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Cost Breakdown</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="cost">Cost *</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>
                  <Input
                    id="cost"
                    type="number"
                    min="0"
                    step="0.01"
                    value={cost}
                    onChange={(e) => setCost(e.target.value)}
                    className="pl-7"
                    placeholder="0.00"
                    data-testid="input-cost"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="tax">Tax</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>
                  <Input
                    id="tax"
                    type="number"
                    min="0"
                    step="0.01"
                    value={tax}
                    onChange={(e) => setTax(e.target.value)}
                    className="pl-7"
                    placeholder="0.00"
                    data-testid="input-tax"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="shipping">Shipping</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>
                  <Input
                    id="shipping"
                    type="number"
                    min="0"
                    step="0.01"
                    value={shipping}
                    onChange={(e) => setShipping(e.target.value)}
                    className="pl-7"
                    placeholder="0.00"
                    data-testid="input-shipping"
                  />
                </div>
              </div>
            </div>
            <div className="p-3 bg-[#E85D04]/5 rounded-lg border border-[#E85D04]/20 flex items-center justify-between">
              <span className="text-sm font-medium text-slate-600 dark:text-slate-300">Total Cost</span>
              <span className="text-xl font-display font-bold text-[#E85D04]" data-testid="text-total-cost">${totalCost}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Billing Frequency</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <RadioGroup value={billingFrequency} onValueChange={setBillingFrequency} className="flex gap-4">
              <div className="flex items-center gap-2">
                <RadioGroupItem value="One-Time" id="freq-onetime" data-testid="radio-freq-onetime" />
                <Label htmlFor="freq-onetime" className="font-normal cursor-pointer">One-Time</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="Recurring" id="freq-recurring" data-testid="radio-freq-recurring" />
                <Label htmlFor="freq-recurring" className="font-normal cursor-pointer">Recurring</Label>
              </div>
            </RadioGroup>

            {billingFrequency === 'Recurring' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                <div>
                  <Label htmlFor="recFreq">Frequency *</Label>
                  <Select value={recurringFrequency} onValueChange={setRecurringFrequency}>
                    <SelectTrigger data-testid="select-recurring-frequency">
                      <SelectValue placeholder="Select frequency" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Weekly">Weekly</SelectItem>
                      <SelectItem value="Bi-Weekly">Bi-Weekly</SelectItem>
                      <SelectItem value="Monthly">Monthly</SelectItem>
                      <SelectItem value="Quarterly">Quarterly</SelectItem>
                      <SelectItem value="Semi-Annually">Semi-Annually</SelectItem>
                      <SelectItem value="Annually">Annually</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="recTerm">Term Length *</Label>
                  <Input
                    id="recTerm"
                    value={recurringTerm}
                    onChange={(e) => setRecurringTerm(e.target.value)}
                    placeholder="e.g. 12 months, 2 years"
                    data-testid="input-recurring-term"
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Documents & Attachments</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div
              className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer ${
                isDragging
                  ? 'border-[#E85D04] bg-[#E85D04]/5'
                  : 'border-slate-200 dark:border-slate-700 hover:border-[#E85D04]/50'
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              data-testid="dropzone-po-files"
            >
              <Upload className="w-8 h-8 mx-auto mb-2 text-slate-400" />
              <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
                Drag & drop files here, or click to browse
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Quotes, invoices, contracts, receipts — up to 10MB each
              </p>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => { if (e.target.files) handleFiles(e.target.files); e.target.value = ''; }}
                data-testid="input-po-files"
              />
            </div>

            {pendingFiles.length > 0 && (
              <div className="space-y-2">
                {pendingFiles.map((file, index) => {
                  const isImage = file.type.startsWith('image/');
                  return (
                  <div
                    key={index}
                    className="bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden"
                  >
                    {isImage && (
                      <div className="w-full h-28">
                        <img src={file.dataUrl} alt={file.name} className="w-full h-full object-cover" />
                      </div>
                    )}
                    <div className="flex items-center gap-3 p-3">
                      <File className="w-4 h-4 text-[#E85D04] shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate">{file.name}</p>
                        <p className="text-xs text-slate-400">{formatFileSize(file.size)}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-slate-400 hover:text-red-500"
                        onClick={(e) => { e.stopPropagation(); removePendingFile(index); }}
                        data-testid={`button-remove-file-${index}`}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Additional Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any additional notes or justification..."
              className="min-h-[80px]"
              data-testid="input-notes"
            />
          </CardContent>
        </Card>

        <div className="flex flex-col sm:flex-row gap-3 pb-8">
          <Button
            variant="outline"
            onClick={() => navigate('/purchase-orders')}
            data-testid="button-cancel"
          >
            Cancel
          </Button>
          <Button
            variant="outline"
            disabled={!isValid || createMutation.isPending}
            onClick={() => createMutation.mutate('Draft')}
            data-testid="button-save-draft"
          >
            {createMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Save as Draft
          </Button>
          <Button
            className="bg-[#E85D04] hover:bg-[#E85D04]/90 text-white"
            disabled={!isValid || createMutation.isPending}
            onClick={() => createMutation.mutate('Submitted')}
            data-testid="button-submit-po"
          >
            {createMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
            Submit for Approval
          </Button>
        </div>
      </div>
    </div>
  );
}
