import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { RoleProvider, useRole } from "@/lib/roleContext";
import { Layout } from "@/components/layout";
import Dashboard from "@/pages/dashboard";
import NewExpense from "@/pages/new-expense";
import EditExpense from "@/pages/edit-expense";
import Approvals from "@/pages/approvals";
import Expenses from "@/pages/expenses";
import AdminUsers from "@/pages/admin-users";
import UserProfile from "@/pages/user-profile";
import MyProfile from "@/pages/my-profile";
import Login from "@/pages/login";
import Reports from "@/pages/reports";
import PurchaseOrders from "@/pages/purchase-orders";
import NewPurchaseOrder from "@/pages/new-purchase-order";
import AdminQuickbooks from "@/pages/admin-quickbooks";
import Documents from "@/pages/documents";
import EULA from "@/pages/eula";
import PrivacyPolicy from "@/pages/privacy-policy";
import NotFound from "@/pages/not-found";
import { Loader2 } from "lucide-react";

function AuthenticatedRoutes() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={Dashboard}/>
        <Route path="/expenses" component={Expenses}/>
        <Route path="/new-expense" component={NewExpense}/>
        <Route path="/edit-expense/:id" component={EditExpense}/>
        <Route path="/approvals" component={Approvals}/>
        <Route path="/reports" component={Reports}/>
        <Route path="/purchase-orders" component={PurchaseOrders}/>
        <Route path="/new-purchase-order" component={NewPurchaseOrder}/>
        <Route path="/documents" component={Documents}/>
        <Route path="/profile" component={MyProfile}/>
        <Route path="/admin/users" component={AdminUsers}/>
        <Route path="/admin/users/:id" component={UserProfile}/>
        <Route path="/admin/quickbooks" component={AdminQuickbooks}/>
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function Router() {
  const { isAuthenticated, isLoading } = useRole();

  return (
    <Switch>
      <Route path="/eula" component={EULA} />
      <Route path="/privacy" component={PrivacyPolicy} />
      <Route>
        {() => {
          if (isLoading) {
            return (
              <div className="min-h-screen flex items-center justify-center bg-[#FAF8F5]">
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="w-8 h-8 animate-spin text-[#2D1810]" />
                  <p className="text-sm text-slate-500">Loading...</p>
                </div>
              </div>
            );
          }

          if (!isAuthenticated) {
            return <Login />;
          }

          return <AuthenticatedRoutes />;
        }}
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <RoleProvider>
            <Router />
            <Toaster />
          </RoleProvider>
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
