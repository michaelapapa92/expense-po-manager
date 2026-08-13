import { useState, useRef, useCallback } from "react";
import { useRole } from "@/lib/roleContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, getQueryFn } from "@/lib/queryClient";
import {
  Upload, FileText, Download, Trash2, Search, Plus, File,
  FileImage, FileSpreadsheet, Loader2, X, FolderOpen
} from "lucide-react";

const DOCUMENT_TYPES = ['Invoice', 'W9', 'W8', 'Contract', 'Receipt', 'Quote', 'Insurance', 'License', 'Other'] as const;

const TYPE_COLORS: Record<string, string> = {
  Invoice: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  W9: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  W8: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
  Contract: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  Receipt: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  Quote: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400",
  Insurance: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400",
  License: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400",
  Other: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400",
};

interface DocumentItem {
  id: string;
  name: string;
  documentType: string;
  fileName: string;
  fileType: string;
  fileSize: string | null;
  vendor: string | null;
  description: string | null;
  uploadedById: string;
  uploadedByName: string;
  createdAt: string;
}

function getFileIcon(fileType: string) {
  if (fileType.startsWith("image/")) return <FileImage className="w-5 h-5 text-pink-500" />;
  if (fileType.includes("spreadsheet") || fileType.includes("csv") || fileType.includes("excel"))
    return <FileSpreadsheet className="w-5 h-5 text-emerald-500" />;
  if (fileType.includes("pdf")) return <FileText className="w-5 h-5 text-red-500" />;
  return <File className="w-5 h-5 text-slate-500" />;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

export default function Documents() {
  const { currentUser } = useRole();
  const isAdmin = currentUser?.isAdmin;
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [showUpload, setShowUpload] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const [uploadName, setUploadName] = useState("");
  const [uploadType, setUploadType] = useState<string>("");
  const [uploadVendor, setUploadVendor] = useState("");
  const [uploadDescription, setUploadDescription] = useState("");
  const [uploadFile, setUploadFile] = useState<{ name: string; type: string; data: string; size: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const { data: documents = [], isLoading } = useQuery<DocumentItem[]>({
    queryKey: ["/api/documents"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const uploadMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/documents", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      toast({ title: "Document uploaded", description: "Your document has been saved." });
      resetUploadForm();
    },
    onError: (err: any) => {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/documents/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      toast({ title: "Document deleted" });
      setDeleteConfirm(null);
    },
    onError: (err: any) => {
      toast({ title: "Delete failed", description: err.message, variant: "destructive" });
    },
  });

  const resetUploadForm = () => {
    setShowUpload(false);
    setUploadName("");
    setUploadType("");
    setUploadVendor("");
    setUploadDescription("");
    setUploadFile(null);
  };

  const processFile = useCallback((file: globalThis.File) => {
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: "File too large", description: "Maximum file size is 10MB.", variant: "destructive" });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setUploadFile({
        name: file.name,
        type: file.type || "application/octet-stream",
        data: reader.result as string,
        size: file.size,
      });
      if (!uploadName) {
        setUploadName(file.name.replace(/\.[^/.]+$/, ""));
      }
    };
    reader.readAsDataURL(file);
  }, [uploadName, toast]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  }, [processFile]);

  const handleSubmitUpload = () => {
    if (!uploadFile || !uploadName.trim() || !uploadType) return;
    uploadMutation.mutate({
      name: uploadName.trim(),
      documentType: uploadType,
      fileName: uploadFile.name,
      fileType: uploadFile.type,
      fileData: uploadFile.data,
      fileSize: uploadFile.size,
      vendor: uploadVendor.trim() || null,
      description: uploadDescription.trim() || null,
    });
  };

  const handleDownload = (doc: DocumentItem) => {
    const a = document.createElement("a");
    a.href = `/api/documents/${doc.id}/download`;
    a.download = doc.fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const filtered = documents.filter(doc => {
    if (filterType !== "all" && doc.documentType !== filterType) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      return doc.name.toLowerCase().includes(term) ||
        doc.fileName.toLowerCase().includes(term) ||
        doc.vendor?.toLowerCase().includes(term) ||
        doc.uploadedByName.toLowerCase().includes(term);
    }
    return true;
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#2D1810]"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-display font-bold text-slate-900 dark:text-white" data-testid="text-documents-title">Documents</h2>
          <p className="text-sm text-muted-foreground mt-1">Upload and manage invoices, W9s, and other documents</p>
        </div>
        <Button
          onClick={() => setShowUpload(true)}
          className="gap-2 bg-[#2D1810] hover:bg-[#2D1810]/90"
          data-testid="button-upload-document"
        >
          <Plus className="w-4 h-4" />
          Upload Document
        </Button>
      </div>

      <Card className="border-slate-200 dark:border-slate-700">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search documents..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-9"
                data-testid="input-search-documents"
              />
            </div>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-full sm:w-[180px]" data-testid="select-filter-type">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {DOCUMENT_TYPES.map(type => (
                  <SelectItem key={type} value={type}>{type}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {filtered.length === 0 ? (
        <Card className="border-slate-200 dark:border-slate-700">
          <CardContent className="p-12 text-center">
            <FolderOpen className="w-12 h-12 text-muted-foreground/50 mx-auto mb-3" />
            <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-1">No documents found</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {documents.length === 0
                ? "Upload your first document to get started."
                : "No documents match your search criteria."}
            </p>
            {documents.length === 0 && (
              <Button
                onClick={() => setShowUpload(true)}
                className="gap-2 bg-[#2D1810] hover:bg-[#2D1810]/90"
                data-testid="button-upload-first"
              >
                <Upload className="w-4 h-4" />
                Upload Document
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="hidden md:block">
            <Card className="border-slate-200 dark:border-slate-700">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Document</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Vendor</TableHead>
                    <TableHead>Uploaded By</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Size</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(doc => (
                    <TableRow key={doc.id} data-testid={`row-document-${doc.id}`}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          {getFileIcon(doc.fileType)}
                          <div className="min-w-0">
                            <p className="font-medium text-sm text-slate-900 dark:text-white truncate">{doc.name}</p>
                            <p className="text-xs text-muted-foreground truncate">{doc.fileName}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={`text-xs font-medium ${TYPE_COLORS[doc.documentType] || TYPE_COLORS.Other}`} variant="secondary">
                          {doc.documentType}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{doc.vendor || "—"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{doc.uploadedByName}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(doc.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {doc.fileSize ? formatFileSize(parseInt(doc.fileSize)) : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDownload(doc)}
                            className="h-8 w-8 p-0"
                            data-testid={`button-download-${doc.id}`}
                          >
                            <Download className="w-4 h-4" />
                          </Button>
                          {(isAdmin || doc.uploadedById === currentUser?.id) && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setDeleteConfirm(doc.id)}
                              className="h-8 w-8 p-0 text-red-500 hover:text-red-700"
                              data-testid={`button-delete-${doc.id}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </div>

          <div className="md:hidden space-y-3">
            {filtered.map(doc => (
              <Card key={doc.id} className="border-slate-200 dark:border-slate-700" data-testid={`card-document-${doc.id}`}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="shrink-0 mt-0.5">
                      {getFileIcon(doc.fileType)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-medium text-sm text-slate-900 dark:text-white truncate">{doc.name}</p>
                          <p className="text-xs text-muted-foreground truncate">{doc.fileName}</p>
                        </div>
                        <Badge className={`text-xs font-medium shrink-0 ${TYPE_COLORS[doc.documentType] || TYPE_COLORS.Other}`} variant="secondary">
                          {doc.documentType}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground flex-wrap">
                        {doc.vendor && <span>{doc.vendor}</span>}
                        <span>{doc.uploadedByName}</span>
                        <span>{new Date(doc.createdAt).toLocaleDateString()}</span>
                        {doc.fileSize && <span>{formatFileSize(parseInt(doc.fileSize))}</span>}
                      </div>
                      <div className="flex items-center gap-2 mt-3">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDownload(doc)}
                          className="gap-1.5 h-8 text-xs"
                          data-testid={`button-download-mobile-${doc.id}`}
                        >
                          <Download className="w-3.5 h-3.5" />
                          Download
                        </Button>
                        {(isAdmin || doc.uploadedById === currentUser?.id) && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setDeleteConfirm(doc.id)}
                            className="gap-1.5 h-8 text-xs text-red-500 hover:text-red-700"
                            data-testid={`button-delete-mobile-${doc.id}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Delete
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      <Dialog open={showUpload} onOpenChange={(open) => { if (!open) resetUploadForm(); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display">Upload Document</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div
              className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                isDragging ? "border-[#E85D04] bg-[#E85D04]/5" : uploadFile ? "border-emerald-300 bg-emerald-50 dark:bg-emerald-900/10" : "border-slate-300 dark:border-slate-600 hover:border-[#E85D04]"
              }`}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              data-testid="dropzone-upload"
            >
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.png,.jpg,.jpeg,.gif,.txt"
                onChange={handleFileSelect}
                data-testid="input-file-upload"
              />
              {uploadFile ? (
                <div className="flex items-center justify-center gap-3">
                  {getFileIcon(uploadFile.type)}
                  <div className="text-left">
                    <p className="text-sm font-medium text-slate-900 dark:text-white">{uploadFile.name}</p>
                    <p className="text-xs text-muted-foreground">{formatFileSize(uploadFile.size)}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={(e) => { e.stopPropagation(); setUploadFile(null); }}
                    data-testid="button-remove-file"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <>
                  <Upload className="w-8 h-8 text-muted-foreground/50 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">
                    Drag & drop a file here, or <span className="text-[#E85D04] font-medium">browse</span>
                  </p>
                  <p className="text-xs text-muted-foreground/70 mt-1">PDF, Word, Excel, Images up to 10MB</p>
                </>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="doc-name">Document Name *</Label>
                <Input
                  id="doc-name"
                  value={uploadName}
                  onChange={e => setUploadName(e.target.value)}
                  placeholder="e.g. Vendor Invoice #1234"
                  data-testid="input-document-name"
                />
              </div>
              <div>
                <Label htmlFor="doc-type">Document Type *</Label>
                <Select value={uploadType} onValueChange={setUploadType}>
                  <SelectTrigger data-testid="select-document-type">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {DOCUMENT_TYPES.map(type => (
                      <SelectItem key={type} value={type}>{type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="doc-vendor">Vendor / Company</Label>
              <Input
                id="doc-vendor"
                value={uploadVendor}
                onChange={e => setUploadVendor(e.target.value)}
                placeholder="e.g. Acme Corp"
                data-testid="input-document-vendor"
              />
            </div>

            <div>
              <Label htmlFor="doc-description">Description</Label>
              <Textarea
                id="doc-description"
                value={uploadDescription}
                onChange={e => setUploadDescription(e.target.value)}
                placeholder="Optional notes about this document"
                rows={2}
                data-testid="input-document-description"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={resetUploadForm} data-testid="button-cancel-upload">Cancel</Button>
            <Button
              onClick={handleSubmitUpload}
              disabled={!uploadFile || !uploadName.trim() || !uploadType || uploadMutation.isPending}
              className="gap-2 bg-[#2D1810] hover:bg-[#2D1810]/90"
              data-testid="button-submit-upload"
            >
              {uploadMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              Upload
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteConfirm} onOpenChange={(open) => { if (!open) setDeleteConfirm(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Document</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete this document? This action cannot be undone.
          </p>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDeleteConfirm(null)} data-testid="button-cancel-delete">Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirm && deleteMutation.mutate(deleteConfirm)}
              disabled={deleteMutation.isPending}
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
