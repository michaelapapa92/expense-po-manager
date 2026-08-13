import { Button } from "@/components/ui/button";
import { Shield, FileText, CheckCircle, ArrowRight } from "lucide-react";
import burningBill from "@/assets/burning-cash-3.png";

export default function Login() {
  const currentPath = window.location.pathname + window.location.search;
  const loginUrl = currentPath && currentPath !== "/" ? `/api/login?returnTo=${encodeURIComponent(currentPath)}` : "/api/login";

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      <div className="lg:w-1/2 relative bg-gradient-to-br from-[#1C1917] via-[#2D1810] to-[#E85D04] p-8 lg:p-16 flex flex-col justify-between min-h-[40vh] lg:min-h-screen overflow-hidden">
        <div className="absolute inset-0 opacity-20">
          <img src={burningBill} alt="" className="w-full h-full object-cover" />
        </div>
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-12">
            <img src="/logo-aseva.svg" alt="Aseva" className="w-10 h-10" />
            <span className="text-white text-xl font-display font-bold">Aseva</span>
          </div>
          <h1 className="text-3xl lg:text-5xl font-display font-bold text-white leading-tight mb-6">
            Expense Management,<br />
            <span className="text-[#FB923C]">Simplified.</span>
          </h1>
          <p className="text-amber-200/80 text-lg max-w-md">
            Submit, track, and approve expenses through a streamlined multi-tier workflow. From submission to reimbursement, all in one place.
          </p>
        </div>

        <div className="relative z-10 mt-8 lg:mt-0 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
            <FileText className="w-6 h-6 text-[#FB923C] mb-2" />
            <h3 className="text-white text-sm font-semibold mb-1">AI Receipt Scanning</h3>
            <p className="text-amber-200/60 text-xs">Auto-fill expenses from receipt photos</p>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
            <CheckCircle className="w-6 h-6 text-[#FB923C] mb-2" />
            <h3 className="text-white text-sm font-semibold mb-1">Multi-Tier Approval</h3>
            <p className="text-amber-200/60 text-xs">Manager, GM, and AP approval workflow</p>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
            <Shield className="w-6 h-6 text-[#FB923C] mb-2" />
            <h3 className="text-white text-sm font-semibold mb-1">Role-Based Access</h3>
            <p className="text-amber-200/60 text-xs">Secure, permission-based controls</p>
          </div>
        </div>

        <p className="relative z-10 text-amber-200/40 text-xs mt-8 hidden lg:block">&copy; {new Date().getFullYear()} Aseva. All rights reserved.</p>
      </div>

      <div className="lg:w-1/2 flex items-center justify-center p-8 lg:p-16 bg-white">
        <div className="w-full max-w-md text-center">
          <div className="flex items-center justify-center gap-3 mb-6 lg:hidden">
            <img src="/logo-aseva.svg" alt="Aseva" className="w-10 h-10" />
          </div>
          <h2 className="text-2xl font-display font-bold text-slate-900 mb-2">
            Welcome Back
          </h2>
          <p className="text-slate-500 mb-8">
            Sign in to manage your expenses and approvals.
          </p>

          <Button
            asChild
            className="w-full bg-[#2D1810] hover:bg-[#1C1917] text-white h-12 text-base shadow-lg"
            data-testid="button-login"
          >
            <a href={loginUrl}>
              Sign In
              <ArrowRight className="w-5 h-5 ml-2" />
            </a>
          </Button>

          <p className="text-xs text-slate-400 mt-6">
            Sign in with your OneLogin account.
          </p>
        </div>
      </div>
    </div>
  );
}
