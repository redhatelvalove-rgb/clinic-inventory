import { Switch, Route, Router, Link, useLocation } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import Dashboard from "@/pages/Dashboard";
import Medications from "@/pages/Medications";
import StockIn from "@/pages/StockIn";
import StockOut from "@/pages/StockOut";
import Vendors from "@/pages/Vendors";
import Transactions from "@/pages/Transactions";
import AddMedication from "@/pages/AddMedication";
import PendingReview from "@/pages/PendingReview";
import ConsumableList from "@/pages/ConsumableList";
import InventoryCount from "@/pages/InventoryCount";
import CountHistory from "@/pages/CountHistory";
import AddConsumable from "@/pages/AddConsumable";
import ExpenseList from "@/pages/ExpenseList";
import AddExpense from "@/pages/AddExpense";
import Disposal from "@/pages/Disposal";
import MedicationDetail from "@/pages/MedicationDetail";
import NotFound from "@/pages/not-found";
import {
  LayoutDashboard, Pill, PackagePlus, PackageMinus, Building2,
  ArrowLeftRight, Bell, Sun, Moon, Activity, PlusCircle, Clock,
  Package, ClipboardList, History, Wallet, FilePlus, Trash2
} from "lucide-react";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";

// ── 側欄結構（分組）────────────────────────────────────────────────────────
const medicineItems = [
  { path: "/",              icon: LayoutDashboard, label: "儀表板" },
  { path: "/medications",   icon: Pill,            label: "藥品清單" },
  { path: "/stock-out",     icon: PackageMinus,    label: "出庫" },
  { path: "/stock-in",      icon: PackagePlus,     label: "入庫" },
  { path: "/disposal",      icon: Trash2,          label: "報廢" },
  { path: "/transactions",  icon: ArrowLeftRight,  label: "交易紀錄" },
  { path: "/vendors",       icon: Building2,       label: "廠商" },
];

const medicineManageItems = [
  { path: "/add-medication",  icon: PlusCircle, label: "新增品項" },
  { path: "/pending-review",  icon: Clock,      label: "待審核" },
];

const consumableItems = [
  { path: "/consumables",         icon: Package,       label: "衛材清單" },
  { path: "/consumables/add",     icon: PlusCircle,    label: "新增衛材品項" },
  { path: "/inventory-count",     icon: ClipboardList, label: "衛材盤點" },
  { path: "/count-history",       icon: History,       label: "盤點紀錄" },
];

const expenseItems = [
  { path: "/expenses",     icon: Wallet,    label: "費用清單" },
  { path: "/expenses/add", icon: FilePlus,  label: "記錄費用" },
];

// 手機底部 Tab（常用 5 項）
const bottomNavItems = [
  { path: "/",               icon: LayoutDashboard, label: "儀表板" },
  { path: "/medications",    icon: Pill,            label: "藥品" },
  { path: "/stock-out",      icon: PackageMinus,    label: "出庫" },
  { path: "/consumables",    icon: Package,         label: "衛材" },
  { path: "/inventory-count",icon: ClipboardList,   label: "盤點" },
];

// ── Sidebar ───────────────────────────────────────────────────────────────────
function Sidebar() {
  const [location] = useLocation();

  const { data: pendingData } = useQuery<{ count: number }>({
    queryKey: ["/api/medications/pending/count"],
    refetchInterval: 30000,
  });
  const { data: consumablesData } = useQuery({
    queryKey: ["/api/consumables/low-stock"],
    refetchInterval: 60000,
  });

  const pendingCount = pendingData?.count || 0;
  const lowSupCount = Array.isArray(consumablesData) ? (consumablesData as any[]).length : 0;

  const isActive = (path: string) => path === "/" ? location === "/" : location.startsWith(path);

  const NavLink = ({ path, icon: Icon, label, badge }: { path: string; icon: any; label: string; badge?: number }) => (
    <Link key={path} href={path}
      className={`flex items-center gap-2.5 px-3 py-2.5 rounded-md text-sm font-medium transition-colors cursor-pointer
        ${isActive(path) ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted"}`}
      data-testid={`nav-${label}`}>
      <Icon size={16} />
      <span className="truncate">{label}</span>
      {badge !== undefined && badge > 0 && (
        <span className="ml-auto bg-amber-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold flex-shrink-0">
          {badge}
        </span>
      )}
    </Link>
  );

  const SectionLabel = ({ label }: { label: string }) => (
    <div className="pt-3 pb-1 px-3">
      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{label}</div>
    </div>
  );

  return (
    <aside className="hidden md:flex w-56 shrink-0 border-r border-border bg-card flex-col h-screen sticky top-0">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-border">
        <div className="flex items-center gap-2.5">
          <svg viewBox="0 0 32 32" width="28" height="28" fill="none" aria-label="骨立診所 Logo">
            <rect x="2" y="2" width="28" height="28" rx="6" fill="hsl(199 89% 35%)"/>
            <path d="M16 8v16M8 16h16" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
            <circle cx="16" cy="16" r="4" stroke="white" strokeWidth="1.5" fill="none"/>
          </svg>
          <div>
            <div className="text-sm font-semibold text-foreground leading-tight">骨立診所</div>
            <div className="text-xs text-muted-foreground">CIMS v2.0 · Demo</div>
          </div>
        </div>
      </div>

      {/* 導覽 */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto">
        {/* 藥品模組 */}
        <SectionLabel label="💊 藥品庫存" />
        <div className="space-y-0.5">
          {medicineItems.map(({ path, icon, label }) => (
            <NavLink key={path} path={path} icon={icon} label={label} />
          ))}
        </div>

        {/* 藥品管理 */}
        <SectionLabel label="品項管理" />
        <div className="space-y-0.5">
          {medicineManageItems.map(({ path, icon, label }) => (
            <NavLink key={path} path={path} icon={icon} label={label}
              badge={path === "/pending-review" ? pendingCount : undefined}
            />
          ))}
        </div>

        {/* 衛材模組 */}
        <SectionLabel label="🏥 衛材管理" />
        <div className="space-y-0.5">
          {consumableItems.map(({ path, icon, label }) => (
            <NavLink key={path} path={path} icon={icon} label={label}
              badge={path === "/consumables" && lowSupCount > 0 ? lowSupCount : undefined}
            />
          ))}
        </div>

        {/* 費用模組 */}
        <SectionLabel label="💰 費用管理" />
        <div className="space-y-0.5">
          {expenseItems.map(({ path, icon, label }) => (
            <NavLink key={path} path={path} icon={icon} label={label} />
          ))}
        </div>
      </nav>

      <div className="px-4 py-3 border-t border-border">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Activity size={12} /><span>Phase 2 衛材模組</span>
        </div>
      </div>
    </aside>
  );
}

// ── 手機底部 Tab ─────────────────────────────────────────────────────────────────
function BottomNav() {
  const [location] = useLocation();
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-20 bg-card border-t border-border
                    flex items-stretch" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
      {bottomNavItems.map(({ path, icon: Icon, label }) => {
        const active = path === "/" ? location === "/" : location.startsWith(path);
        return (
          <Link key={path} href={path}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 text-xs font-medium transition-colors
              ${active ? "text-primary" : "text-muted-foreground"}`}
            data-testid={`bottom-nav-${label}`}>
            <Icon size={active ? 22 : 20} strokeWidth={active ? 2.2 : 1.8} />
            <span className={active ? "font-semibold" : ""}>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

// ── TopBar ──────────────────────────────────────────────────────────────────────
function TopBar() {
  const [dark, setDark] = useState(() => window.matchMedia("(prefers-color-scheme: dark)").matches);

  const { data: dashboard } = useQuery({ queryKey: ["/api/dashboard"], refetchInterval: 60000 });
  const { data: pendingData } = useQuery<{ count: number }>({
    queryKey: ["/api/medications/pending/count"],
    refetchInterval: 30000,
  });

  const alertCount = ((dashboard as any)?.stats?.expiringCount || 0) + ((dashboard as any)?.stats?.lowStockCount || 0);
  const pendingCount = pendingData?.count || 0;
  const lowSupCount = (dashboard as any)?.stats?.lowStockConsumables || 0;
  const totalAlerts = alertCount + pendingCount + lowSupCount;

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  return (
    <header className="h-12 border-b border-border bg-card/80 backdrop-blur sticky top-0 z-10 flex items-center px-4 gap-3">
      <div className="md:hidden flex items-center gap-2 mr-2">
        <svg viewBox="0 0 32 32" width="22" height="22" fill="none">
          <rect x="2" y="2" width="28" height="28" rx="6" fill="hsl(199 89% 35%)"/>
          <path d="M16 8v16M8 16h16" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
        </svg>
        <span className="text-sm font-semibold text-foreground">骨立診所</span>
      </div>
      <div className="flex-1 text-xs text-muted-foreground hidden md:block">診所庫存管理系統 CIMS</div>
      <div className="flex items-center gap-2 ml-auto">
        {pendingCount > 0 && (
          <Link href="/pending-review"
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 text-xs font-medium cursor-pointer hover:bg-amber-200 transition-colors">
            <Clock size={12} />{pendingCount} 待審核
          </Link>
        )}
        {(alertCount + lowSupCount) > 0 && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-xs font-medium">
            <Bell size={12} />{alertCount + lowSupCount} 警示
          </div>
        )}
        <button onClick={() => setDark(!dark)}
          className="w-8 h-8 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          data-testid="theme-toggle">
          {dark ? <Sun size={15} /> : <Moon size={15} />}
        </button>
      </div>
    </header>
  );
}

// ── Layout ────────────────────────────────────────────────────────────────────
function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col min-h-screen min-w-0">
        <TopBar />
        <main className="flex-1 bg-background overflow-auto pb-20 md:pb-6">
          {children}
        </main>
      </div>
      <BottomNav />
    </div>
  );
}

// ── 主 App ─────────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router hook={useHashLocation}>
        <Layout>
          <Switch>
            <Route path="/"                   component={Dashboard} />
            <Route path="/medications"        component={Medications} />
            <Route path="/medications/:id"    component={MedicationDetail} />
            <Route path="/stock-out"          component={StockOut} />
            <Route path="/stock-in"           component={StockIn} />
            <Route path="/disposal"           component={Disposal} />
            <Route path="/transactions"       component={Transactions} />
            <Route path="/vendors"            component={Vendors} />
            <Route path="/add-medication"     component={AddMedication} />
            <Route path="/pending-review"     component={PendingReview} />
            <Route path="/consumables"        component={ConsumableList} />
            <Route path="/consumables/add"    component={AddConsumable} />
            <Route path="/inventory-count"    component={InventoryCount} />
            <Route path="/count-history"      component={CountHistory} />
            <Route path="/expenses"           component={ExpenseList} />
            <Route path="/expenses/add"       component={AddExpense} />
            <Route component={NotFound} />
          </Switch>
        </Layout>
        <Toaster />
      </Router>
    </QueryClientProvider>
  );
}
