import React from 'react';
import { Link, useLocation } from 'wouter';
import { useRole } from '@/lib/roleContext';
import { User } from '@/lib/mockData';
import { useQuery } from '@tanstack/react-query';
import { getQueryFn } from '@/lib/queryClient';
import { 
  LayoutDashboard, 
  CheckCircle, 
  Settings, 
  Users,
  Shield,
  LogOut,
  Eye,
  XCircle,
  BarChart3,
  BookOpen,
  ShoppingCart,
  FolderOpen
} from 'lucide-react';
import burningCash2 from "@/assets/burning-cash-2.png";
import { NotificationBell } from '@/components/notification-bell';
import { ThemeToggle } from '@/components/theme-toggle';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarProvider,
  SidebarTrigger
} from '@/components/ui/sidebar';
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { role, isAdmin, currentUser, realUser, isViewingAs, setViewAsUser, logout } = useRole();

  const isApprover = role === 'Manager' || role === 'General Manager' || role === 'Executive Chairman';

  const { data: allUsers = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: !!realUser?.isAdmin,
  });

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-[#FAF8F5] dark:bg-slate-950">
        <AppSidebar
          currentUser={currentUser}
          location={location}
          isApprover={isApprover}
          isAdmin={isAdmin}
          isViewingAs={isViewingAs}
          realUser={realUser}
          onLogout={logout}
        />
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {isViewingAs && (
            <div className="bg-amber-500 text-white px-3 sm:px-4 py-2 flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4" />
                <span>Viewing as <strong>{currentUser?.name}</strong> ({currentUser?.role})</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-white hover:bg-amber-600 h-7 px-2"
                onClick={() => setViewAsUser(null)}
                data-testid="button-stop-view-as"
              >
                <XCircle className="w-4 h-4 mr-1" />
                Back to my account
              </Button>
            </div>
          )}
          <header className="flex items-center h-16 px-3 sm:px-6 border-b bg-white dark:bg-slate-900 sticky top-0 z-10 justify-between">
            <div className="flex items-center gap-4">
              <SidebarTrigger />
              <Link href="/">
                <h1 className="text-xl font-display font-bold text-slate-800 dark:text-white cursor-pointer hover:text-[#E85D04] dark:hover:text-[#E85D04] transition-colors">
                  <span className="hidden sm:inline">Aseva Expense Management</span>
                  <span className="sm:hidden">Aseva</span>
                </h1>
              </Link>
            </div>
            <div className="flex items-center gap-3">
              {realUser?.isAdmin && !isViewingAs && (
                <div className="flex items-center gap-2">
                  <Eye className="w-4 h-4 text-slate-400 hidden sm:block" />
                  <Select
                    value="self"
                    onValueChange={(val) => {
                      if (val === "self") {
                        setViewAsUser(null);
                      } else {
                        const user = allUsers.find((u: User) => u.id === val);
                        if (user) setViewAsUser(user);
                      }
                    }}
                  >
                    <SelectTrigger className="w-[120px] sm:w-[180px] h-8 text-xs" data-testid="select-view-as">
                      <SelectValue placeholder="View as..." />
                    </SelectTrigger>
                    <SelectContent className="max-h-[250px]">
                      <SelectItem value="self">My View</SelectItem>
                      {allUsers
                        .filter((u: User) => u.id !== realUser?.id)
                        .sort((a: User, b: User) => a.name.localeCompare(b.name))
                        .map((u: User) => (
                          <SelectItem key={u.id} value={u.id}>
                            {u.name} ({u.role})
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <ThemeToggle />
              <NotificationBell />
              <div className="hidden md:flex flex-col items-end mr-2">
                <span className="text-sm font-medium text-slate-900 dark:text-white">
                  {currentUser?.name || 'Loading...'}
                </span>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-slate-500">{role}</span>
                  {isAdmin && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 bg-purple-50 text-purple-600 border-purple-200">
                      Admin
                    </Badge>
                  )}
                </div>
              </div>
              <Link href="/profile" data-testid="link-my-profile">
                <Avatar className="h-8 w-8 border cursor-pointer hover:ring-2 hover:ring-primary/30 transition-all">
                  {(currentUser?.profilePicture || currentUser?.profileImageUrl) ? (
                    <img src={currentUser.profilePicture || currentUser.profileImageUrl || ''} alt={currentUser.name} className="h-full w-full object-cover rounded-full" />
                  ) : (
                    <AvatarFallback className="bg-primary/10 text-primary text-xs">
                      {currentUser?.avatarInitials || '??'}
                    </AvatarFallback>
                  )}
                </Avatar>
              </Link>
            </div>
          </header>
          <div className="flex-1 overflow-auto p-3 sm:p-6">
            <div className="max-w-5xl mx-auto w-full">
              {children}
            </div>
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}

interface AppSidebarProps {
  currentUser: User | null;
  location: string;
  isApprover: boolean;
  isAdmin: boolean;
  isViewingAs: boolean;
  realUser: User | null;
  onLogout: () => void;
}

function AppSidebar({ currentUser, location, isApprover, isAdmin, isViewingAs, realUser, onLogout }: AppSidebarProps) {
  return (
    <Sidebar className="border-r">
      <SidebarHeader className="h-16 flex items-center justify-center border-b px-6">
        <div className="flex items-center gap-2 font-display font-bold text-xl text-primary">
          <img src="/logo-aseva.svg" alt="Aseva" className="w-8 h-8" />
          <span>Aseva</span>
        </div>
      </SidebarHeader>
      
      <SidebarContent className="p-4 gap-6">
        <div className="space-y-1">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-2">Menu</h4>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={location === '/'}>
                <Link href="/">
                  <LayoutDashboard />
                  <span>Dashboard</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            
            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={location === '/reports'}>
                <Link href="/reports" data-testid="link-reports">
                  <BarChart3 />
                  <span>Reports</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>

            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={location === '/purchase-orders' || location === '/new-purchase-order'}>
                <Link href="/purchase-orders" data-testid="link-purchase-orders">
                  <ShoppingCart />
                  <span>Purchase Orders</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>

            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={location === '/documents'}>
                <Link href="/documents" data-testid="link-documents">
                  <FolderOpen />
                  <span>Documents</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>

            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={location === '/approvals'}>
                <Link href="/approvals" data-testid="link-action-needed">
                  <CheckCircle />
                  <span>Action Needed</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>

            {isAdmin && (
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={location === '/admin/users'}>
                  <Link href="/admin/users">
                    <Users />
                    <span>User Management</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )}
            {isAdmin && (
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={location === '/admin/quickbooks'}>
                  <Link href="/admin/quickbooks">
                    <BookOpen />
                    <span>Integrations</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )}
          </SidebarMenu>
        </div>

        <div className="mt-auto">
          {currentUser && (
            <div className={`relative rounded-lg p-4 mb-4 overflow-hidden ${isViewingAs ? 'bg-amber-600' : 'bg-[#2D1810] dark:bg-slate-800'}`}>
              {!isViewingAs && (
                <div className="absolute inset-0 opacity-15">
                  <img src={burningCash2} alt="" className="w-full h-full object-cover" />
                </div>
              )}
              <h4 className={`relative z-10 text-xs font-semibold uppercase tracking-wider mb-3 ${isViewingAs ? 'text-amber-100/70' : 'text-amber-200/70'}`}>
                {isViewingAs ? 'Viewing As' : 'Signed In As'}
              </h4>
              <div className="relative z-10 flex items-center gap-3">
                <Avatar className="h-9 w-9 border border-white/20">
                  {(currentUser.profilePicture || currentUser.profileImageUrl) ? (
                    <img src={currentUser.profilePicture || currentUser.profileImageUrl || ''} alt={currentUser.name} className="h-full w-full object-cover rounded-full" />
                  ) : (
                    <AvatarFallback className="bg-white/10 text-white text-xs font-medium">
                      {currentUser.avatarInitials}
                    </AvatarFallback>
                  )}
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-white truncate">{currentUser.name}</p>
                  <p className={`text-[11px] truncate ${isViewingAs ? 'text-amber-100/60' : 'text-amber-200/60'}`}>{currentUser.email}</p>
                </div>
              </div>
              <div className="relative z-10 mt-2 flex items-center gap-1.5 flex-wrap">
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 bg-white/10 text-white border-white/20">{currentUser.role}</Badge>
                {currentUser.isAdmin && (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 bg-purple-500/20 text-purple-200 border-purple-400/30">Admin</Badge>
                )}
                {isViewingAs && (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 bg-amber-300/20 text-amber-100 border-amber-300/30">
                    <Eye className="w-2.5 h-2.5 mr-0.5" /> Impersonating
                  </Badge>
                )}
              </div>
            </div>
          )}
        </div>
      </SidebarContent>

      <SidebarFooter className="p-4 border-t">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={onLogout} data-testid="button-logout">
              <LogOut />
              <span>Sign Out</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
