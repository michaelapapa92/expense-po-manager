import { useState, useMemo } from "react";
import { useRole } from "@/lib/roleContext";
import { User } from "@/lib/mockData";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ShieldAlert, Search, Shield, Pencil, ArrowUpDown, ArrowUp, ArrowDown, UserPlus, Loader2, Banknote, ShoppingCart } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, getQueryFn } from "@/lib/queryClient";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";

const ROLES = ["Employee", "Manager", "General Manager", "Executive Chairman"];
const DEPARTMENTS = [
  "Executive", "NOC", "TAC", "Operations", "Accounting",
  "Billing", "Administrative", "Account Management", "Sales",
];

type SortKey = "name" | "email" | "department" | "role" | "reportsTo";
type SortDir = "asc" | "desc";

export default function AdminUsers() {
  const { isAdmin } = useRole();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [dialogOpen, setDialogOpen] = useState(false);

  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState("Employee");
  const [newDepartment, setNewDepartment] = useState("");
  const [newIsAdmin, setNewIsAdmin] = useState(false);
  const [newIsAP, setNewIsAP] = useState(false);
  const [newManagerId, setNewManagerId] = useState("none");

  const { data: users = [], isLoading } = useQuery<User[]>({
    queryKey: ["/api/users"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const managers = users.filter((u: User) => u.role === 'Manager' || u.role === 'General Manager' || u.role === 'Executive Chairman');

  const createUserMutation = useMutation({
    mutationFn: async (data: { name: string; email: string; role: string; isAdmin: boolean; isAccountsPayable: boolean; department: string | null; managerId: string | null; avatarInitials: string }) => {
      await apiRequest("POST", "/api/users", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ title: "User Created", description: "New user has been added." });
      resetForm();
      setDialogOpen(false);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create user. Email may already be in use.", variant: "destructive" });
    },
  });

  const resetForm = () => {
    setNewName("");
    setNewEmail("");
    setNewRole("Employee");
    setNewDepartment("");
    setNewIsAdmin(false);
    setNewIsAP(false);
    setNewManagerId("none");
  };

  const handleCreateUser = () => {
    if (!newName.trim() || !newEmail.trim()) return;
    const nameParts = newName.trim().split(/\s+/);
    const avatarInitials = nameParts.length >= 2
      ? (nameParts[0][0] + nameParts[nameParts.length - 1][0]).toUpperCase()
      : newName.trim().slice(0, 2).toUpperCase();
    createUserMutation.mutate({
      name: newName.trim(),
      email: newEmail.trim(),
      role: newRole,
      isAdmin: newIsAdmin,
      isAccountsPayable: newIsAP,
      department: newDepartment || null,
      managerId: newManagerId === "none" ? null : newManagerId,
      avatarInitials,
    });
  };

  const getManagerName = (managerId: string | null) => {
    if (!managerId) return "";
    const manager = users.find((u: User) => u.id === managerId);
    return manager?.name || "";
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const sortedUsers = useMemo(() => {
    const filtered = users.filter((user: User) =>
      user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return [...filtered].sort((a, b) => {
      let valA = "";
      let valB = "";

      switch (sortKey) {
        case "name":
          valA = a.name.toLowerCase();
          valB = b.name.toLowerCase();
          break;
        case "email":
          valA = a.email.toLowerCase();
          valB = b.email.toLowerCase();
          break;
        case "department":
          valA = (a.department || "zzz").toLowerCase();
          valB = (b.department || "zzz").toLowerCase();
          break;
        case "role":
          const roleOrder: Record<string, number> = { "Executive Chairman": 0, "General Manager": 1, "Manager": 2, "Employee": 3 };
          return sortDir === "asc"
            ? (roleOrder[a.role] ?? 4) - (roleOrder[b.role] ?? 4)
            : (roleOrder[b.role] ?? 4) - (roleOrder[a.role] ?? 4);
        case "reportsTo":
          valA = getManagerName(a.managerId).toLowerCase();
          valB = getManagerName(b.managerId).toLowerCase();
          if (!valA && valB) return sortDir === "asc" ? 1 : -1;
          if (valA && !valB) return sortDir === "asc" ? -1 : 1;
          break;
      }

      if (valA < valB) return sortDir === "asc" ? -1 : 1;
      if (valA > valB) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
  }, [users, searchQuery, sortKey, sortDir]);

  const SortIcon = ({ column }: { column: SortKey }) => {
    if (sortKey !== column) return <ArrowUpDown className="w-3.5 h-3.5 ml-1 text-slate-300" />;
    return sortDir === "asc"
      ? <ArrowUp className="w-3.5 h-3.5 ml-1 text-[#E85D04]" />
      : <ArrowDown className="w-3.5 h-3.5 ml-1 text-[#E85D04]" />;
  };

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] text-center space-y-4">
        <div className="bg-slate-100 p-4 rounded-full">
          <ShieldAlert className="w-8 h-8 text-slate-400" />
        </div>
        <h2 className="text-xl font-semibold" data-testid="text-access-restricted">Access Restricted</h2>
        <p className="text-muted-foreground max-w-sm">
          Only administrators can access user management.
          Switch to an admin user in the sidebar to proceed.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-display font-bold text-slate-900" data-testid="text-page-title">User Management</h2>
          <p className="text-slate-500">View and manage team members.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative w-full md:w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              type="search"
              placeholder="Search users..."
              className="pl-9"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              data-testid="input-search-users"
            />
          </div>
          <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-user">
                <UserPlus className="w-4 h-4 mr-2" />
                Add User
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Add New User</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label className="text-sm">Full Name</Label>
                  <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Jane Smith" data-testid="input-new-name" />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm">Email Address</Label>
                  <Input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="e.g. jsmith@company.com" data-testid="input-new-email" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm">Role</Label>
                    <Select value={newRole} onValueChange={setNewRole}>
                      <SelectTrigger data-testid="select-new-role"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm">Department</Label>
                    <Select value={newDepartment || "unassigned"} onValueChange={(v) => setNewDepartment(v === "unassigned" ? "" : v)}>
                      <SelectTrigger data-testid="select-new-department"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unassigned">Unassigned</SelectItem>
                        {DEPARTMENTS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm">Reports To</Label>
                  <Select value={newManagerId} onValueChange={setNewManagerId}>
                    <SelectTrigger data-testid="select-new-manager"><SelectValue placeholder="Select manager" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No Manager</SelectItem>
                      {managers.map((m: User) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-sm">Admin Privileges</Label>
                    <p className="text-xs text-muted-foreground">Grants access to user management</p>
                  </div>
                  <Switch checked={newIsAdmin} onCheckedChange={setNewIsAdmin} data-testid="switch-new-admin" />
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-sm">Accounts Payable</Label>
                    <p className="text-xs text-muted-foreground">Can process AP-stage expenses</p>
                  </div>
                  <Switch checked={newIsAP} onCheckedChange={setNewIsAP} data-testid="switch-new-ap" />
                </div>
                <Button
                  className="w-full"
                  disabled={!newName.trim() || !newEmail.trim() || createUserMutation.isPending}
                  onClick={handleCreateUser}
                  data-testid="button-submit-new-user"
                >
                  {createUserMutation.isPending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <UserPlus className="w-4 h-4 mr-2" />
                  )}
                  Create User
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="hidden md:block">
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-8 text-center text-muted-foreground">Loading...</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>
                      <button onClick={() => handleSort("name")} className="flex items-center hover:text-slate-900 transition-colors cursor-pointer" data-testid="sort-name">
                        Name <SortIcon column="name" />
                      </button>
                    </TableHead>
                    <TableHead>
                      <button onClick={() => handleSort("email")} className="flex items-center hover:text-slate-900 transition-colors cursor-pointer" data-testid="sort-email">
                        Email <SortIcon column="email" />
                      </button>
                    </TableHead>
                    <TableHead>
                      <button onClick={() => handleSort("department")} className="flex items-center hover:text-slate-900 transition-colors cursor-pointer" data-testid="sort-department">
                        Department <SortIcon column="department" />
                      </button>
                    </TableHead>
                    <TableHead>
                      <button onClick={() => handleSort("role")} className="flex items-center hover:text-slate-900 transition-colors cursor-pointer" data-testid="sort-role">
                        Role <SortIcon column="role" />
                      </button>
                    </TableHead>
                    <TableHead>
                      <button onClick={() => handleSort("reportsTo")} className="flex items-center hover:text-slate-900 transition-colors cursor-pointer" data-testid="sort-reports-to">
                        Reports To <SortIcon column="reportsTo" />
                      </button>
                    </TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedUsers.map((user: User) => (
                    <TableRow key={user.id} data-testid={`row-user-${user.id}`}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            {user.profilePicture ? (
                              <img src={user.profilePicture} alt={user.name} className="h-full w-full object-cover rounded-full" />
                            ) : (
                              <AvatarFallback className="bg-slate-100 text-slate-600 font-medium text-xs">
                                {user.avatarInitials}
                              </AvatarFallback>
                            )}
                          </Avatar>
                          <div className="flex items-center gap-2">
                            {user.name}
                            {user.isAdmin && <Shield className="w-3.5 h-3.5 text-purple-500" />}
                            {user.isAccountsPayable && <Banknote className="w-3.5 h-3.5 text-emerald-500" />}
                            {user.isPOAdmin && <ShoppingCart className="w-3.5 h-3.5 text-[#E85D04]" />}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{user.email}</TableCell>
                      <TableCell>
                        <DepartmentBadge department={user.department} />
                      </TableCell>
                      <TableCell>
                        <RoleBadge role={user.role} />
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {getManagerName(user.managerId) || (
                          <span className="text-xs text-slate-400 italic">None</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Link href={`/admin/users/${user.id}`}>
                          <Button variant="outline" size="sm" data-testid={`button-edit-${user.id}`}>
                            <Pencil className="w-3.5 h-3.5 mr-1.5" />
                            Edit
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="md:hidden space-y-3">
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground">Loading...</div>
        ) : (
          sortedUsers.map((user: User) => (
            <Link key={user.id} href={`/admin/users/${user.id}`}>
              <Card className="shadow-sm hover:shadow-md transition-shadow cursor-pointer" data-testid={`row-user-${user.id}`}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10 shrink-0">
                      {user.profilePicture ? (
                        <img src={user.profilePicture} alt={user.name} className="h-full w-full object-cover rounded-full" />
                      ) : (
                        <AvatarFallback className="bg-slate-100 text-slate-600 font-medium text-sm">
                          {user.avatarInitials}
                        </AvatarFallback>
                      )}
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="font-medium text-sm text-slate-900 truncate">{user.name}</p>
                        {user.isAdmin && <Shield className="w-3.5 h-3.5 text-purple-500 shrink-0" />}
                        {user.isAccountsPayable && <Banknote className="w-3.5 h-3.5 text-emerald-500 shrink-0" />}
                        {user.isPOAdmin && <ShoppingCart className="w-3.5 h-3.5 text-[#E85D04] shrink-0" />}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        <RoleBadge role={user.role} />
                        <DepartmentBadge department={user.department} />
                      </div>
                      {getManagerName(user.managerId) && (
                        <p className="text-xs text-slate-400 mt-1">Reports to {getManagerName(user.managerId)}</p>
                      )}
                    </div>
                    <Button variant="outline" size="sm" className="shrink-0" data-testid={`button-edit-${user.id}`}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}

export function DepartmentBadge({ department }: { department: string | null }) {
  const styles: Record<string, string> = {
    'Executive': 'bg-purple-100 text-purple-700 border-purple-200',
    'NOC': 'bg-amber-100 text-amber-700 border-amber-200',
    'TAC': 'bg-teal-100 text-teal-700 border-teal-200',
    'Operations': 'bg-orange-100 text-orange-700 border-orange-200',
    'Accounting': 'bg-emerald-100 text-emerald-700 border-emerald-200',
    'Billing': 'bg-pink-100 text-pink-700 border-pink-200',
    'Administrative': 'bg-cyan-100 text-cyan-700 border-cyan-200',
    'Account Management': 'bg-violet-100 text-violet-700 border-violet-200',
    'Sales': 'bg-lime-100 text-lime-700 border-lime-200',
  };

  const dept = department || 'Unassigned';
  return (
    <Badge variant="outline" className={`${styles[dept] || 'bg-slate-100 text-slate-600 border-slate-200'} font-normal border text-xs`}>
      {dept}
    </Badge>
  );
}

export function RoleBadge({ role }: { role: string }) {
  const styles: Record<string, string> = {
    'Executive Chairman': 'bg-purple-100 text-purple-700 border-purple-200',
    'General Manager': 'bg-[#E85D04]/10 text-[#E85D04] border-[#E85D04]/20',
    'Manager': 'bg-blue-100 text-blue-700 border-blue-200',
    'Employee': 'bg-slate-100 text-slate-600 border-slate-200',
  };

  return (
    <Badge variant="outline" className={`${styles[role] || styles['Employee']} font-normal border`}>
      {role}
    </Badge>
  );
}
