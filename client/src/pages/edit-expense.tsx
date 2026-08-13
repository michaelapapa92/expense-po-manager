import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { MILEAGE_RATE, Expense, Comment } from "@/lib/mockData";
import { useCategories } from "@/hooks/use-categories";
import { useRole } from "@/lib/roleContext";
import { Button } from "@/components/ui/button";
import burningCash3 from "@/assets/burning-cash-3.png";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useLocation, useParams } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest, getQueryFn } from "@/lib/queryClient";
import { Loader2, Upload, Camera, Scan, CheckCircle2, AlertTriangle, ArrowLeft, Info, Car } from "lucide-react";
import { ReceiptThumbnail } from "@/components/receipt-viewer";

const formSchema = z.object({
  description: z.string().min(2, { message: "Vendor name must be at least 2 characters." }),
  amount: z.coerce.number().min(0.01, { message: "Amount must be greater than 0." }),
  date: z.string().refine((val) => !isNaN(Date.parse(val)), { message: "Please enter a valid date." }),
  category: z.string({ required_error: "Please select a category." }),
  notes: z.string().min(1, { message: "Description is required." }),
  miles: z.coerce.number().min(0).optional(),
});

const APPROVED_STATUSES = ['Manager Approved', 'GM Approved', 'EC Approved'];
const REJECTED_STATUSES = ['Manager Rejected', 'GM Rejected', 'EC Rejected', 'AP Rejected'];

export default function EditExpense() {
  const { categoryNames: CATEGORIES } = useCategories();
  const { currentUser } = useRole();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const params = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [receiptImage, setReceiptImage] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanComplete, setScanComplete] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [formLoaded, setFormLoaded] = useState(false);

  const { data: expense } = useQuery<Expense>({
    queryKey: [`/api/expenses/${params.id}`],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: !!params.id,
  });

  const { data: comments = [] } = useQuery<Comment[]>({
    queryKey: [`/api/expenses/${params.id}/comments`],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: !!params.id,
  });

  const isRejected = expense ? REJECTED_STATUSES.includes(expense.status) : false;
  const isApproved = expense ? APPROVED_STATUSES.includes(expense.status) : false;
  const isSubmitted = expense?.status === 'Submitted';

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      description: "",
      amount: 0,
      date: new Date().toISOString().split("T")[0],
      notes: "",
    },
  });

  useEffect(() => {
    if (expense && !formLoaded) {
      form.reset({
        description: expense.description,
        amount: parseFloat(expense.amount),
        date: expense.date,
        category: expense.category,
        notes: expense.notes || "",
        miles: expense.miles ? parseFloat(expense.miles) : undefined,
      });
      setReceiptImage(expense.receiptUrl || null);
      setFormLoaded(true);
    }
  }, [expense, form, formLoaded]);

  const updateExpense = useMutation({
    mutationFn: async (values: z.infer<typeof formSchema>) => {
      const isMileage = values.category === "Mileage";
      await apiRequest("PATCH", `/api/expenses/${params.id}`, {
        description: values.description,
        amount: isMileage ? (values.miles! * MILEAGE_RATE).toFixed(2) : values.amount.toFixed(2),
        date: values.date,
        category: values.category,
        status: "Submitted",
        notes: values.notes || null,
        receiptUrl: receiptImage || null,
        userId: currentUser?.id,
        miles: isMileage ? values.miles!.toFixed(2) : null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
      queryClient.invalidateQueries({ queryKey: [`/api/expenses/${params.id}`] });
      const message = isApproved
        ? "Your edited expense has been sent back through the full approval process."
        : isRejected
        ? "Your revised expense has been sent back for approval."
        : "Your expense has been updated and submitted for approval.";
      toast({
        title: isApproved ? "Expense Updated — Approval Restarted" : "Expense Resubmitted",
        description: message,
        className: "bg-emerald-50 border-emerald-200 text-emerald-900",
      });
      setLocation("/");
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    updateExpense.mutate(values);
  }

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const compressImageForScan = (dataUrl: string, maxWidth = 1200): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.7));
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    });
  };

  const scanReceipt = async (imageDataUrl: string) => {
    setIsScanning(true);
    setScanComplete(false);
    try {
      const compressedImage = await compressImageForScan(imageDataUrl);
      const response = await apiRequest("POST", "/api/scan-receipt", { image: compressedImage });
      const data = await response.json();

      let fieldsSet = 0;
      if (data.total) { form.setValue("amount", parseFloat(data.total)); fieldsSet++; }
      if (data.date) { form.setValue("date", data.date); fieldsSet++; }
      if (data.business) { form.setValue("description", data.business); fieldsSet++; }
      if (data.category && CATEGORIES.includes(data.category)) { form.setValue("category", data.category); fieldsSet++; }

      setScanComplete(true);
      toast({
        title: "Receipt Scanned",
        description: fieldsSet > 0
          ? `Auto-filled ${fieldsSet} field${fieldsSet > 1 ? 's' : ''} from your receipt.`
          : "Could not extract details. Please fill in manually.",
        className: fieldsSet > 0 ? "bg-emerald-50 border-emerald-200 text-emerald-900" : undefined,
      });
    } catch {
      toast({ title: "Scan Failed", description: "Could not scan the receipt.", variant: "destructive" });
    } finally {
      setIsScanning(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const base64 = await fileToBase64(file);
      setReceiptImage(base64);
      setScanComplete(false);
      scanReceipt(base64);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && (file.type.startsWith("image/") || file.type === "application/pdf")) {
      const base64 = await fileToBase64(file);
      setReceiptImage(base64);
      setScanComplete(false);
      if (file.type.startsWith("image/")) {
        scanReceipt(base64);
      }
    } else if (file) {
      toast({
        title: "Unsupported file",
        description: "Please upload an image or PDF file.",
        variant: "destructive",
      });
    }
  };

  if (!expense) {
    return <div className="p-8 text-center text-muted-foreground">Loading...</div>;
  }

  const pageTitle = isRejected ? "Edit & Resubmit" : "Edit Expense";
  const pageSubtitle = isRejected
    ? "Revise this rejected expense and send it back for approval."
    : isApproved
    ? "Editing this expense will restart the approval process from the beginning."
    : "Update this expense and resubmit for approval.";
  const submitLabel = isRejected ? "Resubmit for Approval" : isApproved ? "Save & Restart Approval" : "Save & Submit";
  const backPath = isRejected ? "/expenses?filter=rejected" : "/expenses?filter=pending";

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-in slide-in-from-bottom-4 duration-500">
      <div className="relative overflow-hidden rounded-2xl p-5 text-white shadow-lg" style={{ background: 'linear-gradient(135deg, #2D1810, #1C1917)' }}>
        <div className="absolute inset-0 opacity-15">
          <img src={burningCash3} alt="" className="w-full h-full object-cover" />
        </div>
        <div className="relative z-10 flex items-center gap-4">
          <Button variant="ghost" size="icon" className="shrink-0 text-white/70 hover:text-white hover:bg-white/10" onClick={() => setLocation(backPath)} data-testid="button-back">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h2 className="text-2xl font-display font-bold" data-testid="text-page-title">{pageTitle}</h2>
            <p className="text-amber-200/70 text-sm">{pageSubtitle}</p>
          </div>
        </div>
      </div>

      {isApproved && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-amber-800">Approval will restart</p>
              <p className="text-sm text-amber-700 mt-1">
                This expense is currently at "<strong>{expense.status}</strong>" stage. Saving changes will reset it back to "Submitted" and it will need to go through the full approval process again.
              </p>
            </div>
          </div>
        </div>
      )}

      {isRejected && comments.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 space-y-2">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="w-4 h-4 text-red-600" />
            <p className="text-sm font-medium text-red-700">Rejection Feedback</p>
          </div>
          {comments.map((c: Comment) => (
            <div key={c.id} className="text-sm text-red-800 bg-white/60 rounded p-3 border border-red-100">
              <p>{c.text}</p>
              <p className="text-xs text-red-500 mt-1">— {c.author} on {c.date}</p>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Expense Details</CardTitle>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Vendor Name <span className="text-red-500">*</span></FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. TechCorp, Delta Airlines" {...field} data-testid="input-description" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="category"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Category <span className="text-red-500">*</span></FormLabel>
                        <Select onValueChange={(val) => {
                          field.onChange(val);
                          if (val === "Mileage") {
                            const currentMiles = form.getValues("miles") || 0;
                            form.setValue("amount", parseFloat((currentMiles * MILEAGE_RATE).toFixed(2)));
                          }
                        }} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-category">
                              <SelectValue placeholder="Select a category" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {CATEGORIES.map((cat) => (
                              <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {form.watch("category") === "Mileage" && (
                    <div className="bg-[#E85D04]/5 border border-[#E85D04]/20 rounded-lg p-4 space-y-3">
                      <div className="flex items-center gap-2 text-sm font-medium text-[#E85D04]">
                        <Car className="h-4 w-4" />
                        Mileage Reimbursement — ${MILEAGE_RATE}/mile
                      </div>
                      <FormField
                        control={form.control}
                        name="miles"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Miles Driven <span className="text-red-500">*</span></FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                step="0.1"
                                placeholder="0"
                                {...field}
                                onChange={(e) => {
                                  field.onChange(e);
                                  const miles = parseFloat(e.target.value) || 0;
                                  form.setValue("amount", parseFloat((miles * MILEAGE_RATE).toFixed(2)));
                                }}
                                data-testid="input-miles"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <div className="text-sm text-slate-600">
                        Calculated Amount: <span className="font-bold text-slate-900">${((form.watch("miles") || 0) * MILEAGE_RATE).toFixed(2)}</span>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    {form.watch("category") !== "Mileage" && (
                      <FormField
                        control={form.control}
                        name="amount"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Amount ($) <span className="text-red-500">*</span></FormLabel>
                            <FormControl>
                              <Input type="number" step="0.01" placeholder="0.00" {...field} data-testid="input-amount" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}

                    <FormField
                      control={form.control}
                      name="date"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Date <span className="text-red-500">*</span></FormLabel>
                          <FormControl>
                            <Input type="date" {...field} data-testid="input-date" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description <span className="text-red-500">*</span></FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Include details specifying who the expense was for and the purpose of the expense."
                            className="resize-none"
                            {...field}
                            data-testid="input-notes"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="pt-4 flex gap-4">
                    <Button type="button" variant="outline" onClick={() => setLocation(backPath)} data-testid="button-cancel">Cancel</Button>
                    <Button
                      type="submit"
                      className={`flex-1 ${isApproved ? 'bg-amber-600 hover:bg-amber-700' : 'bg-[#E85D04] hover:bg-[#C2410C]'}`}
                      disabled={updateExpense.isPending}
                      data-testid="button-resubmit"
                    >
                      {updateExpense.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      {submitLabel}
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
           <Card
             className={`h-full border-dashed border-2 transition-colors ${isDragging ? "border-[#E85D04] bg-[#E85D04]/5" : ""}`}
             onDragOver={handleDragOver}
             onDragLeave={handleDragLeave}
             onDrop={handleDrop}
             data-testid="dropzone-receipt"
           >
            <CardContent className="p-6 flex flex-col items-center justify-center text-center h-full min-h-[400px]">
              {isDragging ? (
                <div className="space-y-4">
                  <div className="w-16 h-16 bg-[#E85D04]/10 rounded-full flex items-center justify-center mx-auto text-[#E85D04]">
                    <Upload className="w-8 h-8" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900">Drop files here</h3>
                    <p className="text-sm text-slate-500 mt-1">Release to upload your receipts</p>
                  </div>
                </div>
              ) : receiptImage ? (
                <div className="relative w-full h-full group space-y-3">
                  <ReceiptThumbnail src={receiptImage} />
                  {isScanning && (
                    <div className="flex items-center justify-center gap-2 text-sm text-[#E85D04] bg-[#E85D04]/10 rounded-md p-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Scanning receipt...
                    </div>
                  )}
                  {scanComplete && !isScanning && (
                    <div className="flex items-center justify-center gap-2 text-sm text-emerald-600 bg-emerald-50 rounded-md p-2">
                      <CheckCircle2 className="h-4 w-4" />
                      Fields auto-filled from receipt
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => { setReceiptImage(null); setScanComplete(false); }}
                      data-testid="button-remove-receipt"
                    >
                      Remove
                    </Button>
                    {!isScanning && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 text-[#E85D04] border-[#E85D04]/20 hover:bg-[#E85D04]/10"
                        onClick={() => scanReceipt(receiptImage)}
                        data-testid="button-rescan"
                      >
                        <Scan className="h-4 w-4 mr-1" /> Re-scan
                      </Button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto text-slate-400">
                    <Camera className="w-8 h-8" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900">Receipt Image</h3>
                    <p className="text-sm text-slate-500 mt-1">Drag & drop files or use the buttons below</p>
                  </div>
                  <div className="grid grid-cols-1 gap-2 w-full">
                    <label className="cursor-pointer inline-flex items-center justify-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium shadow-sm hover:bg-accent hover:text-accent-foreground transition-colors" data-testid="label-upload-receipt">
                      <Upload className="h-4 w-4" /> Upload File
                      <input type="file" className="hidden" accept="image/*" onChange={handleFileUpload} data-testid="input-upload-receipt" />
                    </label>
                    <label className="cursor-pointer inline-flex items-center justify-center gap-2 rounded-md bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground shadow-sm hover:bg-secondary/80 transition-colors" data-testid="label-camera-receipt">
                      <Camera className="h-4 w-4" /> Take Photo
                      <input type="file" className="hidden" accept="image/*" capture="environment" onChange={handleFileUpload} data-testid="input-camera-receipt" />
                    </label>
                  </div>
                </div>
              )}
            </CardContent>
           </Card>
        </div>
      </div>
    </div>
  );
}
