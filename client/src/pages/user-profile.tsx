import { useState, useEffect, useRef } from "react";
import { useRole } from "@/lib/roleContext";
import { User, Role } from "@/lib/mockData";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { ShieldAlert, ArrowLeft, Shield, Save, Loader2, Camera, Bell, Mail, Phone, Trash2, AlertTriangle, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, getQueryFn } from "@/lib/queryClient";
import { Link, useParams, useLocation } from "wouter";
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
import { DepartmentBadge, RoleBadge } from "@/pages/admin-users";

const DEPARTMENTS = [
  "Executive",
  "NOC",
  "TAC",
  "Operations",
  "Accounting",
  "Billing",
  "Administrative",
  "Account Management",
  "Sales",
];

export default function UserProfile() {
  const { isAdmin, currentUser } = useRole();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const params = useParams<{ id: string }>();
  const userId = params.id;
  const isSelf = currentUser?.id === userId;

  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [notifyEmail, setNotifyEmail] = useState(false);
  const [notifyText, setNotifyText] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: allUsers = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const user = allUsers.find((u: User) => u.id === userId);
  const managers = allUsers.filter((u: User) => (u.role === 'Manager' || u.role === 'General Manager' || u.role === 'Executive Chairman') && u.id !== userId);
  const directReports = allUsers.filter((u: User) => u.managerId === userId);

  useEffect(() => {
    if (user) {
      setEditName(user.name);
      setEditEmail(user.email);
      setNotifyEmail(user.notifyEmail);
      setNotifyText(user.notifyText);
      setPhoneNumber(user.phoneNumber || "");
    }
  }, [user?.id, user?.name, user?.email, user?.notifyEmail, user?.notifyText, user?.phoneNumber]);

  const profileHasChanges = user && (editName.trim() !== user.name || editEmail.trim() !== user.email);

  const profileMutation = useMutation({
    mutationFn: async ({ id, name, email }: { id: string; name: string; email: string }) => {
      await apiRequest("PATCH", `/api/users/${id}/profile`, { name, email });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ title: "Profile Updated", description: "Name and email have been saved." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update profile. The email may already be in use.", variant: "destructive" });
    },
  });

  const roleMutation = useMutation({
    mutationFn: async ({ id, role }: { id: string; role: string }) => {
      await apiRequest("PATCH", `/api/users/${id}/role`, { role });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ title: "Role Updated", description: "User role has been updated." });
    },
  });

  const adminMutation = useMutation({
    mutationFn: async ({ id, isAdmin }: { id: string; isAdmin: boolean }) => {
      await apiRequest("PATCH", `/api/users/${id}/admin`, { isAdmin });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ title: "Admin Status Updated", description: "Admin privileges have been updated." });
    },
  });

  const apMutation = useMutation({
    mutationFn: async ({ id, isAccountsPayable }: { id: string; isAccountsPayable: boolean }) => {
      await apiRequest("PATCH", `/api/users/${id}/accounts-payable`, { isAccountsPayable });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ title: "Accounts Payable Updated", description: "Accounts Payable permission has been updated." });
    },
  });

  const poAdminMutation = useMutation({
    mutationFn: async ({ id, isPOAdmin }: { id: string; isPOAdmin: boolean }) => {
      await apiRequest("PATCH", `/api/users/${id}/po-admin`, { isPOAdmin });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ title: "PO Admin Updated", description: "PO Administrator permission has been updated." });
    },
  });

  const managerMutation = useMutation({
    mutationFn: async ({ id, managerId }: { id: string; managerId: string | null }) => {
      await apiRequest("PATCH", `/api/users/${id}/manager`, { managerId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ title: "Manager Updated", description: "Reporting structure has been updated." });
    },
  });

  const departmentMutation = useMutation({
    mutationFn: async ({ id, department }: { id: string; department: string | null }) => {
      await apiRequest("PATCH", `/api/users/${id}/department`, { department });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ title: "Department Updated", description: "Department has been updated." });
    },
  });

  const notifPrefsMutation = useMutation({
    mutationFn: async ({ id, notifyEmail, notifyText, phoneNumber }: { id: string; notifyEmail: boolean; notifyText: boolean; phoneNumber: string | null }) => {
      await apiRequest("PATCH", `/api/users/${id}/notification-prefs`, { notifyEmail, notifyText, phoneNumber });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ title: "Notification Preferences Saved", description: "Notification settings have been updated." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to save notification preferences.", variant: "destructive" });
    },
  });

  const notifPrefsChanged = user && (
    notifyEmail !== user.notifyEmail
  );

  const profilePictureMutation = useMutation({
    mutationFn: async ({ id, profilePicture }: { id: string; profilePicture: string | null }) => {
      await apiRequest("PATCH", `/api/users/${id}/profile-picture`, { profilePicture });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ title: "Profile Picture Updated", description: "Profile picture has been saved." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update profile picture.", variant: "destructive" });
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: "File Too Large", description: "Please choose an image under 2MB.", variant: "destructive" });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      profilePictureMutation.mutate({ id: user.id, profilePicture: reader.result as string });
    };
    reader.readAsDataURL(file);
  };

  const [showReassignDialog, setShowReassignDialog] = useState(false);
  const [reassignManagerId, setReassignManagerId] = useState<string>("");
  const [pendingDirectReports, setPendingDirectReports] = useState<User[]>([]);

  const reassignAndDeleteMutation = useMutation({
    mutationFn: async ({ userId, newManagerId }: { userId: string; newManagerId: string }) => {
      await apiRequest("POST", `/api/users/${userId}/reassign-reports`, { newManagerId });
      await apiRequest("DELETE", `/api/users/${userId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ title: "User Deleted", description: "Direct reports were reassigned and the user has been removed." });
      setShowReassignDialog(false);
      navigate("/admin/users");
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error?.message || "Failed to reassign and delete.", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      const res = await fetch(`/api/users/${id}`, { method: "DELETE", credentials: "include" });
      const data = await res.json();
      if (res.status === 409 && data.directReports) {
        throw { hasDirectReports: true, directReports: data.directReports, message: data.message };
      }
      if (!res.ok) {
        throw { message: data.message || "Failed to delete user" };
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ title: "User Deleted", description: "The user has been removed." });
      navigate("/admin/users");
    },
    onError: (error: any) => {
      if (error?.hasDirectReports) {
        setPendingDirectReports(error.directReports);
        setReassignManagerId("");
        setShowReassignDialog(true);
      } else {
        toast({ title: "Error", description: error?.message || "Cannot delete this user. They may have associated records.", variant: "destructive" });
      }
    },
  });

  const reassignCandidates = allUsers.filter(
    (u: User) =>
      u.id !== userId &&
      (u.role === "Manager" || u.role === "General Manager" || u.role === "Executive Chairman")
  );

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] text-center space-y-4">
        <div className="bg-slate-100 p-4 rounded-full">
          <ShieldAlert className="w-8 h-8 text-slate-400" />
        </div>
        <h2 className="text-xl font-semibold" data-testid="text-access-restricted">Access Restricted</h2>
        <p className="text-muted-foreground max-w-sm">
          Only administrators can edit user profiles.
        </p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="space-y-6">
        <Link href="/admin/users">
          <Button variant="ghost" size="sm" data-testid="button-back">
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Users
          </Button>
        </Link>
        <div className="p-8 text-center text-muted-foreground">User not found.</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <Link href="/admin/users">
        <Button variant="ghost" size="sm" data-testid="button-back">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Users
        </Button>
      </Link>

      <div className="flex items-center gap-5">
        <div className="relative group">
          <Avatar className="h-16 w-16 border-2">
            {user.profilePicture ? (
              <img src={user.profilePicture} alt={user.name} className="h-full w-full object-cover rounded-full" />
            ) : (
              <AvatarFallback className="bg-slate-100 text-slate-600 font-bold text-lg">
                {user.avatarInitials}
              </AvatarFallback>
            )}
          </Avatar>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
            data-testid="button-upload-photo"
          >
            <Camera className="w-5 h-5 text-white" />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
            data-testid="input-profile-picture"
          />
        </div>
        <div>
          <h2 className="text-2xl font-display font-bold text-slate-900 flex items-center gap-2" data-testid="text-user-name">
            {user.name}
            {user.isAdmin && <Shield className="w-5 h-5 text-purple-500" />}
          </h2>
          <p className="text-slate-500">{user.email}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Personal Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm text-slate-600">Full Name</Label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                data-testid="input-name"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm text-slate-600">Email Address</Label>
              <Input
                type="email"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                data-testid="input-email"
              />
            </div>
            <div className="flex items-center gap-3">
              <Button
                size="sm"
                disabled={!profileHasChanges || profileMutation.isPending}
                onClick={() => profileMutation.mutate({ id: user.id, name: editName, email: editEmail })}
                data-testid="button-save-profile"
              >
                {profileMutation.isPending ? (
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                ) : (
                  <Save className="w-3.5 h-3.5 mr-1.5" />
                )}
                Save Changes
              </Button>
            </div>
            {!isSelf && (
              <div className="border-t pt-4 mt-2">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-sm text-red-600">Delete User</Label>
                    <p className="text-xs text-muted-foreground">Permanently remove this user from the system</p>
                  </div>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="destructive"
                        size="sm"
                        data-testid="button-delete-user"
                      >
                        <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                        Delete User
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete {user.name}?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This action cannot be undone. This will permanently remove the user from the system. If the user has associated expenses or other records, the deletion will fail.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          className="bg-red-600 hover:bg-red-700"
                          onClick={() => deleteMutation.mutate({ id: user.id })}
                          disabled={deleteMutation.isPending}
                          data-testid="button-confirm-delete"
                        >
                          {deleteMutation.isPending ? (
                            <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                          ) : (
                            <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                          )}
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Role & Permissions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label className="text-sm text-slate-600">Role</Label>
              <Select
                value={user.role}
                onValueChange={(val) => roleMutation.mutate({ id: user.id, role: val })}
              >
                <SelectTrigger data-testid="select-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Employee">Employee</SelectItem>
                  <SelectItem value="Manager">Manager</SelectItem>
                  <SelectItem value="General Manager">General Manager</SelectItem>
                  <SelectItem value="Executive Chairman">Executive Chairman</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-sm text-slate-600">Admin Privileges</Label>
                <p className="text-xs text-muted-foreground">Grants access to user management</p>
              </div>
              <Switch
                checked={user.isAdmin}
                onCheckedChange={(checked) => adminMutation.mutate({ id: user.id, isAdmin: checked })}
                data-testid="switch-admin"
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-sm text-slate-600">Accounts Payable</Label>
                <p className="text-xs text-muted-foreground">Can process expenses at the Accounts Payable stage</p>
              </div>
              <Switch
                checked={user.isAccountsPayable}
                onCheckedChange={(checked) => apMutation.mutate({ id: user.id, isAccountsPayable: checked })}
                data-testid="switch-accounts-payable"
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-sm text-slate-600">PO Administrator</Label>
                <p className="text-xs text-muted-foreground">Reviews incoming purchase orders and places approved orders</p>
              </div>
              <Switch
                checked={user.isPOAdmin}
                onCheckedChange={(checked) => poAdminMutation.mutate({ id: user.id, isPOAdmin: checked })}
                data-testid="switch-po-admin"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Organization</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label className="text-sm text-slate-600">Department</Label>
              <Select
                value={user.department || "unassigned"}
                onValueChange={(val) => departmentMutation.mutate({ id: user.id, department: val === "unassigned" ? null : val })}
              >
                <SelectTrigger data-testid="select-department">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {DEPARTMENTS.map((dept) => (
                    <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-sm text-slate-600">Reports To</Label>
              <Select
                  value={user.managerId || "none"}
                  onValueChange={(val) => managerMutation.mutate({ id: user.id, managerId: val === "none" ? null : val })}
                >
                  <SelectTrigger data-testid="select-manager">
                    <SelectValue placeholder="Select manager" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Manager</SelectItem>
                    {managers.map((m: User) => (
                      <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Bell className="w-4 h-4 text-[#E85D04]" />
            Notification Preferences
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <p className="text-sm text-slate-500">Manage how this user receives notifications when their expense requests are updated.</p>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full flex items-center justify-center bg-[#E85D04]/10 text-[#E85D04]">
                <Mail className="w-4 h-4" />
              </div>
              <div className="space-y-0.5">
                <Label className="text-sm text-slate-700">Email Notifications</Label>
                <p className="text-xs text-muted-foreground">Receive updates at {user.email}</p>
              </div>
            </div>
            <Switch
              checked={notifyEmail}
              onCheckedChange={setNotifyEmail}
              data-testid="switch-notify-email"
            />
          </div>

          <div className="flex items-center justify-between opacity-50">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full flex items-center justify-center bg-slate-100 text-slate-400">
                <Phone className="w-4 h-4" />
              </div>
              <div className="space-y-0.5">
                <Label className="text-sm text-slate-400">Text Message Notifications</Label>
                <p className="text-xs text-slate-400">This feature is currently under development</p>
              </div>
            </div>
            <Switch
              checked={false}
              disabled
              data-testid="switch-notify-text"
            />
          </div>

          <div className="pt-2 border-t">
            <Button
              size="sm"
              className="bg-[#E85D04] hover:bg-[#C2410C]"
              disabled={!notifPrefsChanged || notifPrefsMutation.isPending}
              onClick={() => notifPrefsMutation.mutate({
                id: user.id,
                notifyEmail,
                notifyText: user.notifyText,
                phoneNumber: user.phoneNumber || null,
              })}
              data-testid="button-save-notifications"
            >
              {notifPrefsMutation.isPending ? (
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
              ) : (
                <Save className="w-3.5 h-3.5 mr-1.5" />
              )}
              Save Preferences
            </Button>
          </div>
        </CardContent>
      </Card>

      {directReports.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Direct Reports ({directReports.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {directReports.map((report: User) => (
                <Link key={report.id} href={`/admin/users/${report.id}`}>
                  <div className="flex items-center gap-3 p-3 rounded-lg border hover:bg-slate-50 transition-colors cursor-pointer" data-testid={`link-report-${report.id}`}>
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="bg-slate-100 text-slate-600 font-medium text-xs">
                        {report.avatarInitials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{report.name}</p>
                      <div className="flex items-center gap-1.5">
                        <DepartmentBadge department={report.department} />
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={showReassignDialog} onOpenChange={setShowReassignDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              Reassign Direct Reports
            </DialogTitle>
            <DialogDescription>
              <span className="font-medium text-slate-700">{user.name}</span> has {pendingDirectReports.length} direct report{pendingDirectReports.length !== 1 ? "s" : ""}. You must reassign them to a new manager before deleting this user.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="bg-slate-50 rounded-lg border p-3 space-y-2">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5" />
                Affected Employees
              </p>
              <div className="space-y-2">
                {pendingDirectReports.map((report: User) => (
                  <div key={report.id} className="flex items-center gap-2.5 py-1" data-testid={`reassign-report-${report.id}`}>
                    <Avatar className="h-7 w-7">
                      <AvatarFallback className="bg-white text-slate-600 font-medium text-xs border">
                        {report.avatarInitials || report.name?.split(" ").map((n: string) => n[0]).join("").toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{report.name}</p>
                      <p className="text-xs text-muted-foreground">{report.role}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm text-slate-600">New Manager</Label>
              <Select value={reassignManagerId} onValueChange={setReassignManagerId}>
                <SelectTrigger data-testid="select-reassign-manager">
                  <SelectValue placeholder="Select a new manager..." />
                </SelectTrigger>
                <SelectContent>
                  {reassignCandidates.map((m: User) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name} ({m.role})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setShowReassignDialog(false)}
              data-testid="button-cancel-reassign"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={!reassignManagerId || reassignAndDeleteMutation.isPending}
              onClick={() => reassignAndDeleteMutation.mutate({ userId: user.id, newManagerId: reassignManagerId })}
              data-testid="button-reassign-and-delete"
            >
              {reassignAndDeleteMutation.isPending ? (
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
              ) : (
                <Trash2 className="w-3.5 h-3.5 mr-1.5" />
              )}
              Reassign & Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
