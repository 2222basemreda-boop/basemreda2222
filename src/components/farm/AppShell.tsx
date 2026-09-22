import { useState, type ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard, Beef, Search, Receipt, Menu, Warehouse, Users, Scale, Wheat,
  Stethoscope, ShieldCheck, History, LogOut, Wifi, WifiOff,
} from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useAuth } from "@/hooks/useAuth";
import { useRealtimeSync } from "@/hooks/useRealtime";
import { ROLE_LABELS } from "@/lib/labels";
import { cn } from "@/lib/utils";

type NavItem = { to: string; label: string; icon: typeof Beef; show?: boolean };

export function AppShell({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const connected = useRealtimeSync();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [moreOpen, setMoreOpen] = useState(false);

  const primary: NavItem[] = [
    { to: "/dashboard", label: "الرئيسية", icon: LayoutDashboard },
    { to: "/animals", label: "الماشية", icon: Beef },
    { to: "/search", label: "البحث", icon: Search },
    { to: "/sales", label: "المبيعات", icon: Receipt, show: auth.can("sales.read") },
  ].filter((i) => i.show !== false);

  const secondary: NavItem[] = [
    { to: "/barns", label: "الحظائر", icon: Warehouse },
    { to: "/customers", label: "العملاء", icon: Users },
    { to: "/weights", label: "الأوزان", icon: Scale },
    { to: "/feeding", label: "التغذية", icon: Wheat },
    { to: "/treatments", label: "العلاج والتحصين", icon: Stethoscope },
    { to: "/activity", label: "سجل النشاط", icon: History, show: auth.can("logs.read") },
    { to: "/users", label: "المستخدمون", icon: ShieldCheck, show: auth.can("users.manage") },
  ].filter((i) => i.show !== false);

  const isActive = (to: string) => pathname === to || pathname.startsWith(to + "/");
  const moreActive = secondary.some((i) => isActive(i.to));

  const userBlock = (
    <div className="glass flex items-center gap-3 rounded-2xl p-3">
      <div className="grid size-10 shrink-0 place-items-center rounded-xl tile-brand font-display text-base font-extrabold">
        {(auth.profile?.full_name ?? auth.user.email ?? "؟").slice(0, 1)}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold">{auth.profile?.full_name ?? auth.user.email}</p>
        <p className="text-[11px] text-muted-foreground">{auth.role ? ROLE_LABELS[auth.role] : "بدون صلاحية"}</p>
      </div>
      <button onClick={() => auth.signOut()} className="grid size-10 place-items-center rounded-xl text-muted-foreground hover:bg-destructive/10 hover:text-destructive" aria-label="تسجيل الخروج">
        <LogOut className="size-5" />
      </button>
    </div>
  );

  const syncBadge = (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold", connected ? "bg-available/15 text-available" : "bg-muted text-muted-foreground")}>
      {connected ? <Wifi className="size-3" /> : <WifiOff className="size-3" />}
      {connected ? "مزامنة مباشرة" : "جارٍ الاتصال"}
    </span>
  );

  return (
    <div className="min-h-dvh md:flex">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col gap-3 p-4 md:flex">
        <div className="glass-strong flex items-center gap-3 rounded-3xl p-4">
          <img src="/elemam-farm-icon.png" alt="" width={1024} height={1024} className="size-11 rounded-2xl object-cover" />
          <div>
            <p className="font-display text-lg font-extrabold leading-tight">Elemam Farm</p>
            {syncBadge}
          </div>
        </div>
        <nav className="glass flex-1 space-y-1 overflow-y-auto rounded-3xl p-2">
          {[...primary, ...secondary].map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "tap flex items-center gap-3 rounded-2xl px-3 text-sm font-bold transition-colors",
                isActive(item.to) ? "bg-brand text-primary-foreground shadow-float" : "text-foreground/80 hover:bg-brand/10",
              )}
            >
              <item.icon className="size-5" />
              {item.label}
            </Link>
          ))}
        </nav>
        {userBlock}
      </aside>

      {/* Mobile header */}
      <header className="glass-strong sticky top-0 z-30 flex items-center justify-between px-4 py-3 md:hidden">
        <div className="flex items-center gap-2">
          <img src="/elemam-farm-icon.png" alt="" width={1024} height={1024} className="size-9 rounded-xl object-cover" />
          <span className="font-display text-base font-extrabold">Elemam Farm</span>
        </div>
        {syncBadge}
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-28 pt-4 md:px-8 md:pb-10 md:pt-6">{children}</main>

      {/* Mobile bottom nav */}
      <nav className="glass-strong fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 rounded-t-3xl px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 md:hidden">
        {primary.map((item) => (
          <Link key={item.to} to={item.to} className={cn("flex flex-col items-center gap-1 rounded-2xl py-1.5 text-[11px] font-bold", isActive(item.to) ? "text-brand" : "text-muted-foreground")}>
            <span className={cn("grid size-10 place-items-center rounded-2xl transition-colors", isActive(item.to) && "bg-brand/12")}>
              <item.icon className="size-5" />
            </span>
            {item.label}
          </Link>
        ))}
        <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
          <SheetTrigger asChild>
            <button className={cn("flex flex-col items-center gap-1 rounded-2xl py-1.5 text-[11px] font-bold", moreActive ? "text-brand" : "text-muted-foreground")}>
              <span className={cn("grid size-10 place-items-center rounded-2xl", moreActive && "bg-brand/12")}>
                <Menu className="size-5" />
              </span>
              المزيد
            </button>
          </SheetTrigger>
          <SheetContent side="bottom" className="glass-strong rounded-t-3xl border-0 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <SheetHeader className="text-right">
              <SheetTitle className="font-display">الأقسام</SheetTitle>
            </SheetHeader>
            <div className="mt-4 grid grid-cols-3 gap-2">
              {secondary.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setMoreOpen(false)}
                  className={cn("glass flex flex-col items-center gap-2 rounded-2xl py-4 text-xs font-bold", isActive(item.to) ? "text-brand" : "text-foreground/80")}
                >
                  <item.icon className="size-6" />
                  {item.label}
                </Link>
              ))}
            </div>
            <div className="mt-4">{userBlock}</div>
          </SheetContent>
        </Sheet>
      </nav>
    </div>
  );
}
