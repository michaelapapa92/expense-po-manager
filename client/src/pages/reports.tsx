import { useState, useMemo } from "react";
import { useRole } from "@/lib/roleContext";
import { Expense, User } from "@/lib/mockData";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/queryClient";
import { useCategories } from "@/hooks/use-categories";
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip,
  ResponsiveContainer, Legend, CartesianGrid, AreaChart, Area, LineChart, Line,
  RadialBarChart, RadialBar
} from "recharts";
import {
  DollarSign, TrendingUp, FileText, Users, Download, Calendar,
  ArrowUp, ArrowDown, Minus, BarChart3, PieChart as PieChartIcon, Activity
} from "lucide-react";
import burningCashRain from "@/assets/burning-cash-rain.png";

const COLORS = ["#2D1810", "#E85D04", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16", "#f97316"];

const STATUS_COLORS: Record<string, string> = {
  "Draft": "#94a3b8",
  "Submitted": "#3b82f6",
  "Manager Approved": "#06b6d4",
  "GM Approved": "#0ea5e9",
  "EC Approved": "#14b8a6",
  "Reimbursed": "#10b981",
  "Manager Rejected": "#ef4444",
  "GM Rejected": "#f97316",
  "EC Rejected": "#dc2626",
  "Accounts Payable": "#6366f1",
  "AP Rejected": "#dc2626",
  "Cancelled": "#6b7280",
};

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg p-3 text-sm">
      <p className="font-medium text-slate-900 dark:text-white mb-1">{label}</p>
      {payload.map((entry: any, i: number) => (
        <div key={i} className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-slate-500 dark:text-slate-400">{entry.name}:</span>
          <span className="font-medium text-slate-900 dark:text-white">
            {typeof entry.value === 'number' ? `$${entry.value.toFixed(2)}` : entry.value}
          </span>
        </div>
      ))}
    </div>
  );
}

function CountTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg p-3 text-sm">
      <p className="font-medium text-slate-900 dark:text-white mb-1">{label}</p>
      {payload.map((entry: any, i: number) => (
        <div key={i} className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-slate-500 dark:text-slate-400">{entry.name}:</span>
          <span className="font-medium text-slate-900 dark:text-white">{entry.value}</span>
        </div>
      ))}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, subtext, color, trend }: {
  icon: any; label: string; value: string; subtext: string;
  color: string; trend?: { value: number; label: string };
}) {
  return (
    <Card className="border-slate-200 dark:border-slate-700">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${color}`}>
            <Icon className="w-5 h-5" />
          </div>
          {trend && (
            <div className={`flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
              trend.value > 0 ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400' :
              trend.value < 0 ? 'bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400' :
              'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
            }`}>
              {trend.value > 0 ? <ArrowUp className="w-3 h-3" /> : trend.value < 0 ? <ArrowDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
              {Math.abs(trend.value)}%
            </div>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-3">{label}</p>
        <p className="text-xl font-bold font-display mt-0.5">{value}</p>
        <p className="text-[11px] text-muted-foreground">{subtext}</p>
      </CardContent>
    </Card>
  );
}

export default function Reports() {
  const { categoryNames: CATEGORIES } = useCategories();
  const { role, currentUser, isViewingAs, viewAsUser } = useRole();
  const isAdmin = currentUser?.isAdmin;
  const isManager = role === "Manager" || role === "General Manager" || role === "Executive Chairman";

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedEmployee, setSelectedEmployee] = useState<string>("all");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [reportScope, setReportScope] = useState<string>("auto");
  const [activeChart, setActiveChart] = useState("overview");

  const reportParams = useMemo(() => {
    const params = new URLSearchParams();
    if (reportScope !== "auto") params.set("scope", reportScope);
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);
    if (selectedCategory !== "all") params.set("category", selectedCategory);
    if (selectedEmployee !== "all") params.set("employeeId", selectedEmployee);
    if (isViewingAs && viewAsUser) params.set("viewAsUserId", viewAsUser.id);
    return params.toString();
  }, [reportScope, dateFrom, dateTo, selectedCategory, selectedEmployee, isViewingAs, viewAsUser]);

  const reportUrl = `/api/expenses/report${reportParams ? `?${reportParams}` : ""}`;
  const { data: filteredExpenses = [], isLoading: expensesLoading } = useQuery<Expense[]>({
    queryKey: [reportUrl],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const { data: allUsers = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const availableEmployees = useMemo(() => {
    if (isAdmin) return allUsers;
    if (isManager) {
      const subordinateIds = new Set<string>();
      const queue = allUsers.filter(u => u.managerId === currentUser?.id).map(u => u.id);
      while (queue.length > 0) {
        const current = queue.shift()!;
        subordinateIds.add(current);
        const reports = allUsers.filter(u => u.managerId === current).map(u => u.id);
        queue.push(...reports);
      }
      return allUsers.filter(u => u.id === currentUser?.id || subordinateIds.has(u.id));
    }
    return currentUser ? [currentUser as unknown as User] : [];
  }, [allUsers, currentUser, isAdmin, isManager]);

  const totalAmount = filteredExpenses.reduce((sum, e) => sum + parseFloat(e.amount), 0);
  const totalReimbursed = filteredExpenses.filter(e => e.status === "Reimbursed").reduce((sum, e) => sum + parseFloat(e.amount), 0);
  const totalPending = filteredExpenses.filter(e => ["Submitted", "Manager Approved", "GM Approved", "EC Approved", "Accounts Payable"].includes(e.status)).reduce((sum, e) => sum + parseFloat(e.amount), 0);
  const avgExpense = filteredExpenses.length > 0 ? totalAmount / filteredExpenses.length : 0;

  const monthlyTrend = useMemo(() => {
    const sortedExpenses = [...filteredExpenses].sort((a, b) => a.date.localeCompare(b.date));
    if (sortedExpenses.length === 0) return { value: 0, label: "No data" };
    const months = new Set(sortedExpenses.map(e => e.date.substring(0, 7)));
    const monthArr = Array.from(months).sort();
    if (monthArr.length < 2) return { value: 0, label: "Not enough data" };
    const lastMonth = monthArr[monthArr.length - 1];
    const prevMonth = monthArr[monthArr.length - 2];
    const lastTotal = sortedExpenses.filter(e => e.date.startsWith(lastMonth)).reduce((s, e) => s + parseFloat(e.amount), 0);
    const prevTotal = sortedExpenses.filter(e => e.date.startsWith(prevMonth)).reduce((s, e) => s + parseFloat(e.amount), 0);
    if (prevTotal === 0) return { value: 0, label: "N/A" };
    const pct = Math.round(((lastTotal - prevTotal) / prevTotal) * 100);
    return { value: pct, label: `vs prev month` };
  }, [filteredExpenses]);

  const categoryData = useMemo(() => {
    const map: Record<string, number> = {};
    filteredExpenses.forEach(e => {
      map[e.category] = (map[e.category] || 0) + parseFloat(e.amount);
    });
    return Object.entries(map).map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 })).sort((a, b) => b.value - a.value);
  }, [filteredExpenses]);

  const statusData = useMemo(() => {
    const map: Record<string, number> = {};
    filteredExpenses.forEach(e => {
      map[e.status] = (map[e.status] || 0) + 1;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [filteredExpenses]);

  const monthlyData = useMemo(() => {
    const map: Record<string, { month: string; total: number; count: number; reimbursed: number; pending: number; rejected: number }> = {};
    filteredExpenses.forEach(e => {
      const month = e.date.substring(0, 7);
      if (!map[month]) map[month] = { month, total: 0, count: 0, reimbursed: 0, pending: 0, rejected: 0 };
      const amt = parseFloat(e.amount);
      map[month].total += amt;
      map[month].count += 1;
      if (e.status === "Reimbursed") map[month].reimbursed += amt;
      else if (e.status.includes("Rejected") || e.status === "Cancelled") map[month].rejected += amt;
      else map[month].pending += amt;
    });
    return Object.values(map).sort((a, b) => a.month.localeCompare(b.month)).map(d => ({
      ...d,
      total: Math.round(d.total * 100) / 100,
      reimbursed: Math.round(d.reimbursed * 100) / 100,
      pending: Math.round(d.pending * 100) / 100,
      rejected: Math.round(d.rejected * 100) / 100,
      label: new Date(d.month + "-01").toLocaleDateString("en-US", { month: "short", year: "2-digit" }),
    }));
  }, [filteredExpenses]);

  const categoryTrendData = useMemo(() => {
    const months = new Set<string>();
    const catSet = new Set<string>();
    filteredExpenses.forEach(e => {
      months.add(e.date.substring(0, 7));
      catSet.add(e.category);
    });
    const sortedMonths = Array.from(months).sort();
    const cats = Array.from(catSet);
    return sortedMonths.map(month => {
      const row: Record<string, any> = {
        month,
        label: new Date(month + "-01").toLocaleDateString("en-US", { month: "short", year: "2-digit" }),
      };
      cats.forEach(cat => {
        row[cat] = Math.round(filteredExpenses.filter(e => e.date.startsWith(month) && e.category === cat).reduce((s, e) => s + parseFloat(e.amount), 0) * 100) / 100;
      });
      return row;
    });
  }, [filteredExpenses]);

  const categoryNames = useMemo(() => {
    const cats = new Set<string>();
    filteredExpenses.forEach(e => cats.add(e.category));
    return Array.from(cats);
  }, [filteredExpenses]);

  const dayOfWeekData = useMemo(() => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const map: Record<string, { total: number; count: number }> = {};
    days.forEach(d => { map[d] = { total: 0, count: 0 }; });
    filteredExpenses.forEach(e => {
      const dayIdx = new Date(e.date).getDay();
      const day = days[dayIdx];
      map[day].total += parseFloat(e.amount);
      map[day].count += 1;
    });
    return days.map(day => ({
      day,
      total: Math.round(map[day].total * 100) / 100,
      count: map[day].count,
      avg: map[day].count > 0 ? Math.round((map[day].total / map[day].count) * 100) / 100 : 0,
    }));
  }, [filteredExpenses]);

  const departmentData = useMemo(() => {
    if (reportScope === "mine" || (!isAdmin && !isManager)) return [];
    const map: Record<string, { department: string; total: number; count: number }> = {};
    filteredExpenses.forEach(e => {
      const user = allUsers.find(u => u.id === e.employeeId);
      const dept = user?.department || "Unassigned";
      if (!map[dept]) map[dept] = { department: dept, total: 0, count: 0 };
      map[dept].total += parseFloat(e.amount);
      map[dept].count += 1;
    });
    return Object.values(map).sort((a, b) => b.total - a.total).map(d => ({
      ...d,
      total: Math.round(d.total * 100) / 100,
    }));
  }, [filteredExpenses, allUsers, reportScope, isAdmin, isManager]);

  const employeeData = useMemo(() => {
    if (reportScope === "mine" || (!isAdmin && !isManager)) return [];
    const map: Record<string, { name: string; total: number; count: number }> = {};
    filteredExpenses.forEach(e => {
      if (!map[e.employeeId]) map[e.employeeId] = { name: e.employeeName, total: 0, count: 0 };
      map[e.employeeId].total += parseFloat(e.amount);
      map[e.employeeId].count += 1;
    });
    return Object.values(map).sort((a, b) => b.total - a.total).slice(0, 10).map(d => ({
      ...d,
      total: Math.round(d.total * 100) / 100,
    }));
  }, [filteredExpenses, reportScope, isAdmin, isManager]);

  const handleExportCsv = () => {
    const params = new URLSearchParams();
    if (reportScope !== "auto") params.set("scope", reportScope);
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);
    if (selectedCategory !== "all") params.set("category", selectedCategory);
    if (selectedEmployee !== "all") params.set("employeeId", selectedEmployee);
    if (isViewingAs && viewAsUser) params.set("viewAsUserId", viewAsUser.id);
    const url = `/api/expenses/export/csv${params.toString() ? `?${params.toString()}` : ""}`;
    const a = document.createElement("a");
    a.href = url;
    a.download = "";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const scopeOptions = [
    { value: "mine", label: "My Expenses" },
    ...(isManager ? [{ value: "team", label: "My Team" }] : []),
    ...(isAdmin ? [{ value: "everyone", label: "All Employees" }] : []),
  ];

  if (expensesLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#2D1810]"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="relative overflow-hidden rounded-2xl p-6 text-white shadow-lg" style={{ background: 'linear-gradient(135deg, #2D1810, #1C1917)' }}>
        <div className="absolute inset-0 opacity-20">
          <img src={burningCashRain} alt="" className="w-full h-full object-cover" />
        </div>
        <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-display font-bold" data-testid="text-reports-title">Reports & Analytics</h2>
            <p className="text-sm text-amber-200/70 mt-1">Interactive spending analysis and trends</p>
          </div>
          <Button
            variant="outline"
            onClick={handleExportCsv}
            className="gap-2 border-white/30 text-white hover:bg-white/10"
            data-testid="button-export-report"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </Button>
        </div>
      </div>

      <Card className="border-slate-200 dark:border-slate-700">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Scope</label>
              <Select value={reportScope} onValueChange={setReportScope} data-testid="select-report-scope">
                <SelectTrigger data-testid="select-report-scope-trigger">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Auto ({isAdmin ? "Everyone" : isManager ? "My Team" : "My Expenses"})</SelectItem>
                  {scopeOptions.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">From</label>
              <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} data-testid="input-report-date-from" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">To</label>
              <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} data-testid="input-report-date-to" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Employee</label>
              <Select value={selectedEmployee} onValueChange={setSelectedEmployee} data-testid="select-report-employee">
                <SelectTrigger data-testid="select-report-employee-trigger">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Employees</SelectItem>
                  {availableEmployees.map(u => (
                    <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Category</label>
              <Select value={selectedCategory} onValueChange={setSelectedCategory} data-testid="select-report-category">
                <SelectTrigger data-testid="select-report-category-trigger">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {CATEGORIES.map(cat => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {(dateFrom || dateTo || selectedEmployee !== "all" || selectedCategory !== "all") && (
            <div className="flex items-center gap-2 mt-3 pt-3 border-t flex-wrap">
              <span className="text-xs text-muted-foreground">Active filters:</span>
              {dateFrom && <Badge variant="secondary" className="text-xs">{dateFrom} →</Badge>}
              {dateTo && <Badge variant="secondary" className="text-xs">→ {dateTo}</Badge>}
              {selectedEmployee !== "all" && (
                <Badge variant="secondary" className="text-xs">
                  {availableEmployees.find(u => u.id === selectedEmployee)?.name || "Employee"}
                </Badge>
              )}
              {selectedCategory !== "all" && <Badge variant="secondary" className="text-xs">{selectedCategory}</Badge>}
              <Button variant="ghost" size="sm" className="h-6 text-xs px-2" onClick={() => { setDateFrom(""); setDateTo(""); setSelectedEmployee("all"); setSelectedCategory("all"); }} data-testid="button-clear-report-filters">
                Clear all
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={FileText}
          label="Total Expenses"
          value={`$${totalAmount.toFixed(2)}`}
          subtext={`${filteredExpenses.length} expenses`}
          color="bg-[#2D1810]/10 text-[#2D1810] dark:bg-[#2D1810]/30 dark:text-blue-300"
          trend={monthlyTrend}
        />
        <StatCard
          icon={DollarSign}
          label="Reimbursed"
          value={`$${totalReimbursed.toFixed(2)}`}
          subtext={`${filteredExpenses.filter(e => e.status === "Reimbursed").length} expenses`}
          color="bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400"
        />
        <StatCard
          icon={Calendar}
          label="Pending"
          value={`$${totalPending.toFixed(2)}`}
          subtext="In progress"
          color="bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400"
        />
        <StatCard
          icon={TrendingUp}
          label="Average Expense"
          value={`$${avgExpense.toFixed(2)}`}
          subtext="Per expense"
          color="bg-[#E85D04]/10 text-[#E85D04] dark:bg-[#E85D04]/30 dark:text-cyan-300"
        />
      </div>

      <Tabs value={activeChart} onValueChange={setActiveChart} className="space-y-4">
        <TabsList className="bg-slate-100 dark:bg-slate-800 p-1 flex-wrap h-auto gap-1" data-testid="tabs-chart-view">
          <TabsTrigger value="overview" className="gap-1.5 text-xs sm:text-sm" data-testid="tab-overview">
            <BarChart3 className="w-3.5 h-3.5" /> Overview
          </TabsTrigger>
          <TabsTrigger value="categories" className="gap-1.5 text-xs sm:text-sm" data-testid="tab-categories">
            <PieChartIcon className="w-3.5 h-3.5" /> Categories
          </TabsTrigger>
          <TabsTrigger value="trends" className="gap-1.5 text-xs sm:text-sm" data-testid="tab-trends">
            <Activity className="w-3.5 h-3.5" /> Trends
          </TabsTrigger>
          {(isAdmin || isManager) && (
            <TabsTrigger value="people" className="gap-1.5 text-xs sm:text-sm" data-testid="tab-people">
              <Users className="w-3.5 h-3.5" /> People
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="border-slate-200 dark:border-slate-700" data-testid="chart-monthly-spending">
              <CardHeader>
                <CardTitle className="text-base font-display">Monthly Spending</CardTitle>
              </CardHeader>
              <CardContent>
                {monthlyData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={monthlyData}>
                      <defs>
                        <linearGradient id="gradTotal" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#2D1810" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#2D1810" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="gradReimbursed" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                      <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `$${v}`} />
                      <RechartsTooltip content={<CustomTooltip />} />
                      <Legend />
                      <Area type="monotone" dataKey="total" name="Total" stroke="#2D1810" fill="url(#gradTotal)" strokeWidth={2} />
                      <Area type="monotone" dataKey="reimbursed" name="Reimbursed" stroke="#10b981" fill="url(#gradReimbursed)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">No data for selected period</div>
                )}
              </CardContent>
            </Card>

            <Card className="border-slate-200 dark:border-slate-700" data-testid="chart-status-breakdown">
              <CardHeader>
                <CardTitle className="text-base font-display">Status Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                {statusData.length > 0 ? (
                  <div className="flex flex-col sm:flex-row items-center gap-4">
                    <div className="w-full sm:w-1/2">
                      <ResponsiveContainer width="100%" height={240}>
                        <PieChart>
                          <Pie
                            data={statusData}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            outerRadius={90}
                            innerRadius={55}
                            paddingAngle={2}
                            animationBegin={0}
                            animationDuration={800}
                          >
                            {statusData.map((entry) => (
                              <Cell key={entry.name} fill={STATUS_COLORS[entry.name] || "#6b7280"} />
                            ))}
                          </Pie>
                          <RechartsTooltip
                            formatter={(value: number, name: string) => [`${value} (${filteredExpenses.length > 0 ? Math.round((value / filteredExpenses.length) * 100) : 0}%)`, name]}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="flex-1 space-y-1.5 w-full sm:w-auto">
                      {statusData.map(item => (
                        <div key={item.name} className="flex items-center justify-between text-sm p-1.5 rounded hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: STATUS_COLORS[item.name] || "#6b7280" }} />
                            <span className="text-slate-700 dark:text-slate-300 truncate text-xs">{item.name}</span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="font-medium text-xs">{item.value}</span>
                            <span className="text-[11px] text-muted-foreground w-8 text-right">
                              {filteredExpenses.length > 0 ? Math.round((item.value / filteredExpenses.length) * 100) : 0}%
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">No data for selected period</div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card className="border-slate-200 dark:border-slate-700" data-testid="chart-day-of-week">
            <CardHeader>
              <CardTitle className="text-base font-display">Spending by Day of Week</CardTitle>
            </CardHeader>
            <CardContent>
              {dayOfWeekData.some(d => d.count > 0) ? (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={dayOfWeekData}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                    <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `$${v}`} />
                    <RechartsTooltip content={<CustomTooltip />} />
                    <Bar dataKey="total" name="Total Spent" fill="#E85D04" radius={[6, 6, 0, 0]}>
                      {dayOfWeekData.map((entry, i) => (
                        <Cell key={i} fill={entry.total === Math.max(...dayOfWeekData.map(d => d.total)) ? "#2D1810" : "#E85D04"} opacity={entry.count === 0 ? 0.2 : 1} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">No data for selected period</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="categories" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="border-slate-200 dark:border-slate-700" data-testid="chart-category-breakdown">
              <CardHeader>
                <CardTitle className="text-base font-display">Spending by Category</CardTitle>
              </CardHeader>
              <CardContent>
                {categoryData.length > 0 ? (
                  <div className="flex flex-col items-center">
                    <ResponsiveContainer width="100%" height={280}>
                      <PieChart>
                        <Pie
                          data={categoryData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          outerRadius={110}
                          innerRadius={60}
                          paddingAngle={3}
                          animationBegin={0}
                          animationDuration={800}
                          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                          labelLine={{ strokeWidth: 1 }}
                        >
                          {categoryData.map((_, i) => (
                            <Cell key={i} fill={COLORS[i % COLORS.length]} />
                          ))}
                        </Pie>
                        <RechartsTooltip formatter={(value: number) => `$${value.toFixed(2)}`} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">No data</div>
                )}
              </CardContent>
            </Card>

            <Card className="border-slate-200 dark:border-slate-700" data-testid="chart-category-comparison">
              <CardHeader>
                <CardTitle className="text-base font-display">Category Comparison</CardTitle>
              </CardHeader>
              <CardContent>
                {categoryData.length > 0 ? (
                  <div className="space-y-3">
                    {categoryData.map((item, i) => {
                      const pct = totalAmount > 0 ? (item.value / totalAmount) * 100 : 0;
                      return (
                        <div key={item.name} data-testid={`bar-category-${item.name}`}>
                          <div className="flex items-center justify-between text-sm mb-1">
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                              <span className="text-slate-700 dark:text-slate-300 font-medium">{item.name}</span>
                            </div>
                            <span className="font-bold text-slate-900 dark:text-white">${item.value.toFixed(2)}</span>
                          </div>
                          <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2.5 overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-700 ease-out"
                              style={{ width: `${pct}%`, backgroundColor: COLORS[i % COLORS.length] }}
                            />
                          </div>
                          <p className="text-[11px] text-muted-foreground mt-0.5">{pct.toFixed(1)}% of total</p>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">No data</div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="trends" className="space-y-6">
          <Card className="border-slate-200 dark:border-slate-700" data-testid="chart-spending-breakdown">
            <CardHeader>
              <CardTitle className="text-base font-display">Monthly Breakdown (Reimbursed / Pending / Rejected)</CardTitle>
            </CardHeader>
            <CardContent>
              {monthlyData.length > 0 ? (
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `$${v}`} />
                    <RechartsTooltip content={<CustomTooltip />} />
                    <Legend />
                    <Bar dataKey="reimbursed" name="Reimbursed" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="pending" name="Pending" stackId="a" fill="#f59e0b" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="rejected" name="Rejected" stackId="a" fill="#ef4444" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">No data</div>
              )}
            </CardContent>
          </Card>

          <Card className="border-slate-200 dark:border-slate-700" data-testid="chart-category-trends">
            <CardHeader>
              <CardTitle className="text-base font-display">Category Spending Over Time</CardTitle>
            </CardHeader>
            <CardContent>
              {categoryTrendData.length > 0 ? (
                <ResponsiveContainer width="100%" height={320}>
                  <LineChart data={categoryTrendData}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `$${v}`} />
                    <RechartsTooltip content={<CustomTooltip />} />
                    <Legend />
                    {categoryNames.map((cat, i) => (
                      <Line
                        key={cat}
                        type="monotone"
                        dataKey={cat}
                        name={cat}
                        stroke={COLORS[i % COLORS.length]}
                        strokeWidth={2}
                        dot={{ r: 4 }}
                        activeDot={{ r: 6 }}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">No data</div>
              )}
            </CardContent>
          </Card>

          <Card className="border-slate-200 dark:border-slate-700" data-testid="chart-volume-trend">
            <CardHeader>
              <CardTitle className="text-base font-display">Expense Volume Over Time</CardTitle>
            </CardHeader>
            <CardContent>
              {monthlyData.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <AreaChart data={monthlyData}>
                    <defs>
                      <linearGradient id="gradCount" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <RechartsTooltip content={<CountTooltip />} />
                    <Area type="monotone" dataKey="count" name="Expenses" stroke="#8b5cf6" fill="url(#gradCount)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">No data</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {(isAdmin || isManager) && (
          <TabsContent value="people" className="space-y-6">
            {departmentData.length > 0 && (
              <Card className="border-slate-200 dark:border-slate-700" data-testid="chart-department-spending">
                <CardHeader>
                  <CardTitle className="text-base font-display">Spending by Department</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={Math.max(200, departmentData.length * 45)}>
                    <BarChart data={departmentData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                      <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={v => `$${v}`} />
                      <YAxis dataKey="department" type="category" width={110} tick={{ fontSize: 12 }} />
                      <RechartsTooltip content={<CustomTooltip />} />
                      <Bar dataKey="total" name="Total" fill="#2D1810" radius={[0, 6, 6, 0]}>
                        {departmentData.map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            {employeeData.length > 0 && (
              <Card className="border-slate-200 dark:border-slate-700" data-testid="chart-employee-spending">
                <CardHeader>
                  <CardTitle className="text-base font-display flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    Top Spenders
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={Math.max(200, employeeData.length * 40)}>
                    <BarChart data={employeeData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                      <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={v => `$${v}`} />
                      <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 12 }} />
                      <RechartsTooltip content={<CustomTooltip />} />
                      <Bar dataKey="total" name="Total" fill="#E85D04" radius={[0, 6, 6, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                  <div className="mt-4 border-t pt-4 overflow-x-auto">
                    <table className="w-full text-sm min-w-[400px]" data-testid="table-top-spenders">
                      <thead>
                        <tr className="text-left text-muted-foreground">
                          <th className="pb-2 font-medium">Employee</th>
                          <th className="pb-2 font-medium text-right">Expenses</th>
                          <th className="pb-2 font-medium text-right">Total</th>
                          <th className="pb-2 font-medium text-right">Average</th>
                        </tr>
                      </thead>
                      <tbody>
                        {employeeData.map(emp => (
                          <tr key={emp.name} className="border-t border-slate-100 dark:border-slate-800">
                            <td className="py-2 text-slate-700 dark:text-slate-300 whitespace-nowrap">{emp.name}</td>
                            <td className="py-2 text-right">{emp.count}</td>
                            <td className="py-2 text-right font-medium">${emp.total.toFixed(2)}</td>
                            <td className="py-2 text-right text-muted-foreground">${(emp.total / emp.count).toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
