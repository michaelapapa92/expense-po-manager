import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { MILEAGE_RATE } from "@/lib/mockData";
import { useCategories } from "@/hooks/use-categories";
import { useRole } from "@/lib/roleContext";
import { Button } from "@/components/ui/button";
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
import { useLocation } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest, getQueryFn } from "@/lib/queryClient";
import { Loader2, Upload, Camera, Scan, CheckCircle2, Car, File, X } from "lucide-react";
import { User } from "@/lib/mockData";
import { ReceiptThumbnail } from "@/components/receipt-viewer";
import burningCashFlatlay from "@/assets/burning-cash-flatlay.png";

const formSchema = z.object({
  description: z.string().min(2, { message: "Vendor name must be at least 2 characters." }),
  amount: z.coerce.number().min(0.01, { message: "Amount must be greater than 0." }),
  date: z.string().refine((val) => !isNaN(Date.parse(val)), { message: "Please enter a valid date." }),
  category: z.string({ required_error: "Please select a category." }),
  notes: z.string().min(1, { message: "Description is required." }),
  miles: z.coerce.number().min(0).optional(),
});

interface Attachment {
  fileName: string;
  fileType: string;
  fileUrl: string;
}

export default function NewExpense() {
  const { categoryNames: CATEGORIES } = useCategories();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [scanComplete, setScanComplete] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const { data: allUsers = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const { currentUser: selectedUser } = useRole();
  const currentUser = selectedUser || allUsers.find((u: User) => u.name === "Kelly Gardner") || allUsers[0];

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      description: "",
      amount: 0,
      date: new Date().toISOString().split("T")[0],
      notes: "",
    },
  });

  const createExpense = useMutation({
    mutationFn: async (values: z.infer<typeof formSchema>) => {
      const isMileage = values.category === "Mileage";
      const firstImage = attachments.find(a => a.fileType.startsWith("image/"));
      const res = await apiRequest("POST", "/api/expenses", {
        description: values.description,
        amount: isMileage ? (values.miles! * MILEAGE_RATE).toFixed(2) : values.amount.toFixed(2),
        date: values.date,
        category: values.category,
        status: "Submitted",
        employeeId: currentUser?.id || "",
        employeeName: currentUser?.name || "Unknown",
        notes: values.notes || null,
        receiptUrl: firstImage?.fileUrl || null,
        miles: isMileage ? values.miles!.toFixed(2) : null,
      });
      return res.json();
    },
    onSuccess: async (expense) => {
      for (const attachment of attachments) {
        try {
          await apiRequest("POST", `/api/expenses/${expense.id}/attachments`, {
            fileName: attachment.fileName,
            fileType: attachment.fileType,
            fileUrl: attachment.fileUrl,
          });
        } catch (e) {
          console.error("Failed to upload attachment:", e);
        }
      }
      queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
      toast({
        title: "Expense Submitted",
        description: "Your expense has been sent to your manager for approval.",
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
    createExpense.mutate(values);
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
      if (data.total) {
        form.setValue("amount", parseFloat(data.total));
        fieldsSet++;
      }
      if (data.date) {
        form.setValue("date", data.date);
        fieldsSet++;
      }
      if (data.business) {
        form.setValue("description", data.business);
        fieldsSet++;
      }
      if (data.category && CATEGORIES.includes(data.category)) {
        form.setValue("category", data.category);
        fieldsSet++;
      }

      setScanComplete(true);
      toast({
        title: "Receipt Scanned",
        description: fieldsSet > 0
          ? `Auto-filled ${fieldsSet} field${fieldsSet > 1 ? 's' : ''} from your receipt. Please review and adjust if needed.`
          : "Could not extract details from this receipt. Please fill in manually.",
        variant: "default",
        className: fieldsSet > 0 ? "bg-emerald-50 border-emerald-200 text-emerald-900" : undefined,
      });
    } catch (error) {
      toast({
        title: "Scan Failed",
        description: "Could not scan the receipt. Please fill in the details manually.",
        variant: "destructive",
      });
    } finally {
      setIsScanning(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const base64 = await fileToBase64(file);
      const newAttachment: Attachment = {
        fileName: file.name,
        fileType: file.type,
        fileUrl: base64,
      };
      setAttachments(prev => [...prev, newAttachment]);
      if (file.type.startsWith("image/")) {
        setScanComplete(false);
        scanReceipt(base64);
      }
    }
    e.target.value = "";
  };

  const handleCameraCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const base64 = await fileToBase64(file);
      const newAttachment: Attachment = {
        fileName: file.name,
        fileType: file.type,
        fileUrl: base64,
      };
      setAttachments(prev => [...prev, newAttachment]);
      if (file.type.startsWith("image/")) {
        setScanComplete(false);
        scanReceipt(base64);
      }
    }
    e.target.value = "";
  };

  const processDroppedFile = async (file: File) => {
    if (!file.type.startsWith("image/") && file.type !== "application/pdf") {
      toast({
        title: "Unsupported file",
        description: "Please upload an image or PDF file.",
        variant: "destructive",
      });
      return;
    }
    const base64 = await fileToBase64(file);
    const newAttachment: Attachment = {
      fileName: file.name,
      fileType: file.type,
      fileUrl: base64,
    };
    setAttachments(prev => [...prev, newAttachment]);
    if (file.type.startsWith("image/")) {
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
    const files = Array.from(e.dataTransfer.files);
    for (const file of files) {
      await processDroppedFile(file);
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
    if (attachments.length <= 1) {
      setScanComplete(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-in slide-in-from-bottom-4 duration-500">
      <div className="relative overflow-hidden rounded-2xl p-5 text-white shadow-lg" style={{ background: 'linear-gradient(135deg, #2D1810, #1C1917)' }}>
        <div className="absolute inset-0 opacity-20">
          <img src={burningCashFlatlay} alt="" className="w-full h-full object-cover" />
        </div>
        <div className="relative z-10">
          <h2 className="text-xl sm:text-2xl font-display font-bold">New Expense Request</h2>
          <p className="text-amber-200/70 text-sm">Submit a new receipt for reimbursement.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
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
                            form.setValue("description", "Mileage Reimbursement");
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

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                    <Button type="button" variant="outline" onClick={() => setLocation("/")} data-testid="button-cancel">Cancel</Button>
                    <Button type="submit" className="flex-1 bg-[#E85D04] hover:bg-[#C2410C]" disabled={createExpense.isPending} data-testid="button-submit">
                      {createExpense.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Submit Request
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
            <CardContent className="p-6 flex flex-col items-center justify-center text-center h-full min-h-[200px] lg:min-h-[400px]">
              <div className="w-full space-y-3">
                {attachments.length === 0 && (
                  <div className="space-y-4 mb-4">
                    <div className="relative w-32 h-32 mx-auto mb-2">
                      <img src={burningCashFlatlay} alt="" className={`w-full h-full object-cover rounded-full transition-opacity ${isDragging ? "opacity-80" : "opacity-40"}`} />
                      <div className={`absolute inset-0 rounded-full flex items-center justify-center transition-colors ${isDragging ? "bg-[#E85D04]/20" : ""}`}>
                        {isDragging ? <Upload className="w-8 h-8 text-[#E85D04]" /> : <Camera className="w-8 h-8 text-slate-500" />}
                      </div>
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-900">
                        {isDragging ? "Drop files here" : "Attachments"}
                      </h3>
                      <p className="text-sm text-slate-500 mt-1">
                        {isDragging ? "Release to upload your receipts" : "Drag & drop files or use the buttons below"}
                      </p>
                    </div>
                  </div>
                )}

                {attachments.map((attachment, index) => (
                  <div key={index} className="relative w-full" data-testid={`attachment-item-${index}`}>
                    {attachment.fileType.startsWith("image/") ? (
                      <div className="relative">
                        <ReceiptThumbnail src={attachment.fileUrl} />
                        <p className="text-xs text-slate-500 mt-1 truncate">{attachment.fileName}</p>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 p-3 bg-slate-100 rounded-lg border">
                        <File className="h-8 w-8 text-red-500 shrink-0" />
                        <div className="min-w-0 flex-1 text-left">
                          <p className="text-sm font-medium text-slate-700 truncate">{attachment.fileName}</p>
                          <p className="text-xs text-slate-400">PDF Document</p>
                        </div>
                      </div>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full mt-1"
                      onClick={() => removeAttachment(index)}
                      data-testid={`button-remove-attachment-${index}`}
                    >
                      <X className="h-3 w-3 mr-1" /> Remove
                    </Button>
                  </div>
                ))}

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

                <div className="grid grid-cols-1 gap-2 w-full pt-2">
                  <label className="cursor-pointer inline-flex items-center justify-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium shadow-sm hover:bg-accent hover:text-accent-foreground transition-colors" data-testid="label-upload-receipt">
                    <Upload className="h-4 w-4" /> Upload File
                    <input type="file" className="hidden" accept="image/*,.pdf" onChange={handleFileUpload} data-testid="input-upload-receipt" />
                  </label>
                  <label className="cursor-pointer inline-flex items-center justify-center gap-2 rounded-md bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground shadow-sm hover:bg-secondary/80 transition-colors" data-testid="label-camera-receipt">
                    <Camera className="h-4 w-4" /> Take Photo
                    <input type="file" className="hidden" accept="image/*" capture="environment" onChange={handleCameraCapture} data-testid="input-camera-receipt" />
                  </label>
                </div>
                <p className="text-xs text-slate-400">Images & PDFs accepted. AI will scan image receipts.</p>
              </div>
            </CardContent>
           </Card>
        </div>
      </div>
    </div>
  );
}
