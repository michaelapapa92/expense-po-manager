import { useState, useRef, useEffect } from "react";
import { useRole } from "@/lib/roleContext";
import { User } from "@/lib/mockData";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Loader2, Camera, Info, Shield, Bell, Mail, MessageSquare, Save, LogOut } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, getQueryFn } from "@/lib/queryClient";
import { DepartmentBadge, RoleBadge } from "@/pages/admin-users";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function MyProfile() {
  const { currentUser, logout } = useRole();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: allUsers = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const user = currentUser ? allUsers.find((u: User) => u.id === currentUser.id) || currentUser : null;
  const manager = user?.managerId ? allUsers.find((u: User) => u.id === user.managerId) : null;

  const profilePictureMutation = useMutation({
    mutationFn: async ({ id, profilePicture }: { id: string; profilePicture: string | null }) => {
      await apiRequest("PATCH", `/api/users/${id}/profile-picture`, { profilePicture });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ title: "Profile Picture Updated", description: "Your profile picture has been saved." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update profile picture.", variant: "destructive" });
    },
  });

  const [notifyEmail, setNotifyEmail] = useState(false);
  const [notifyText, setNotifyText] = useState(false);
  const [notifyWebex, setNotifyWebex] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState("");

  useEffect(() => {
    if (user) {
      setNotifyEmail(user.notifyEmail);
      setNotifyText(user.notifyText);
      setNotifyWebex(user.notifyWebex);
      setPhoneNumber(user.phoneNumber || "");
    }
  }, [user?.id, user?.notifyEmail, user?.notifyText, user?.notifyWebex, user?.phoneNumber]);

  const notifPrefsMutation = useMutation({
    mutationFn: async ({ id, notifyEmail, notifyText, notifyWebex, phoneNumber }: { id: string; notifyEmail: boolean; notifyText: boolean; notifyWebex: boolean; phoneNumber: string | null }) => {
      await apiRequest("PATCH", `/api/users/${id}/notification-prefs`, { notifyEmail, notifyText, notifyWebex, phoneNumber });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ title: "Notification Preferences Saved", description: "Your notification settings have been updated." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to save notification preferences.", variant: "destructive" });
    },
  });

  const notifPrefsChanged = user && (
    notifyEmail !== user.notifyEmail || notifyWebex !== user.notifyWebex
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (file.size > 2 * 1024 * 1024) {
      toast({ title: "File Too Large", description: "Please choose an image under 2MB.", variant: "destructive" });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      profilePictureMutation.mutate({ id: user.id, profilePicture: base64 });
    };
    reader.readAsDataURL(file);
  };

  if (!user) {
    return (
      <div className="p-8 text-center text-muted-foreground">Loading profile...</div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row items-start sm:justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-display font-bold text-slate-900" data-testid="text-page-title">My Profile</h2>
          <p className="text-slate-500">View your account settings and update your profile.</p>
        </div>
        <Button
          variant="outline"
          className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
          onClick={logout}
          data-testid="button-logout"
        >
          <LogOut className="w-4 h-4 mr-2" />
          Sign Out
        </Button>
      </div>

      <div className="flex items-center gap-3 sm:gap-5">
        <div className="relative group">
          <Avatar className="h-20 w-20 border-2">
            {(user.profilePicture || user.profileImageUrl) ? (
              <img src={user.profilePicture || user.profileImageUrl || ''} alt={user.name} className="h-full w-full object-cover rounded-full" />
            ) : (
              <AvatarFallback className="bg-slate-100 text-slate-600 font-bold text-xl">
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
          <h3 className="text-xl font-semibold text-slate-900 flex items-center gap-2" data-testid="text-user-name">
            {user.name}
            {user.isAdmin && <Shield className="w-4 h-4 text-purple-500" />}
          </h3>
          <p className="text-slate-500">{user.email}</p>
          <div className="flex items-center gap-2 mt-1">
            <RoleBadge role={user.role} />
            <DepartmentBadge department={user.department} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Account</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <Label className="text-sm text-slate-500">Full Name</Label>
              <p className="text-sm font-medium text-slate-900" data-testid="text-display-name">{user.name}</p>
            </div>
            <div className="space-y-1">
              <Label className="text-sm text-slate-500">Email Address</Label>
              <p className="text-sm font-medium text-slate-900" data-testid="text-display-email">{user.email}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Organization</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <Label className="text-sm text-slate-500">Role</Label>
              <div><RoleBadge role={user.role} /></div>
            </div>
            <div className="space-y-1">
              <Label className="text-sm text-slate-500">Department</Label>
              <div><DepartmentBadge department={user.department} /></div>
            </div>
            <div className="space-y-1">
              <Label className="text-sm text-slate-500">Reports To</Label>
              <p className="text-sm font-medium text-slate-900" data-testid="text-display-manager">
                {manager ? manager.name : (
                  <span className="text-slate-400 italic font-normal">
                    No manager assigned
                  </span>
                )}
              </p>
            </div>
            <div className="space-y-1">
              <Label className="text-sm text-slate-500">Admin Access</Label>
              <p className="text-sm font-medium text-slate-900" data-testid="text-display-admin">
                {user.isAdmin ? 'Yes' : 'No'}
              </p>
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
          <p className="text-sm text-slate-500">Get notified when your expense requests are approved, rejected, or updated.</p>

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

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full flex items-center justify-center bg-[#E85D04]/10 text-[#E85D04]">
                <MessageSquare className="w-4 h-4" />
              </div>
              <div className="space-y-0.5">
                <Label className="text-sm text-slate-700">Webex Notifications</Label>
                <p className="text-xs text-muted-foreground">Receive direct messages via Cisco Webex</p>
              </div>
            </div>
            <Switch
              checked={notifyWebex}
              onCheckedChange={setNotifyWebex}
              data-testid="switch-notify-webex"
            />
          </div>

          <div className="pt-2 border-t">
            <Button
              size="sm"
              className="bg-[#E85D04] hover:bg-[#C2410C]"
              disabled={!notifPrefsChanged || notifPrefsMutation.isPending}
              onClick={() => user && notifPrefsMutation.mutate({
                id: user.id,
                notifyEmail,
                notifyWebex,
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

      <Alert className="border-slate-200 bg-slate-50">
        <Info className="h-4 w-4 text-slate-500" />
        <AlertDescription className="text-slate-600 text-sm">
          To update your name, email, role, department, or other account settings, please contact your administrator.
        </AlertDescription>
      </Alert>

    </div>
  );
}
