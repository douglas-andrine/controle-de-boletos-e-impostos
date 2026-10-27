import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router";
import { Building2, Landmark, LayoutDashboard, LogOut, Menu, Receipt, X } from "lucide-react";
import { Logo } from "../components/Logo";
import { useCurrentUser, useLogout } from "../lib/auth";

const navItems = [
  { to: "/", label: "Dashboard", Icon: LayoutDashboard, end: true },
  { to: "/impostos", label: "Impostos", Icon: Landmark },
  { to: "/boletos", label: "Boletos", Icon: Receipt },
  { to: "/fornecedores", label: "Fornecedores", Icon: Building2 },
];

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { data: user } = useCurrentUser();
  const logout = useLogout();
  const navigate = useNavigate();

  return (
    <div className="flex h-full flex-col bg-navy text-slate-300">
      <div className="px-6 py-6">
        <Logo />
      </div>

      <nav className="flex-1 space-y-1 px-3" aria-label="Principal">
        {navItems.map(({ to, label, Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={onNavigate}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg border-l-4 px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive ? "border-gold bg-navy-light text-white" : "border-transparent hover:bg-navy-light/60 hover:text-white"
              }`
            }
          >
            <Icon className="size-5" aria-hidden />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-white/10 p-4">
        <p className="truncate text-sm font-medium text-white">{user?.name}</p>
        <p className="truncate text-xs text-slate-400">{user?.email}</p>
        <button
          type="button"
          onClick={() => logout.mutate(undefined, { onSuccess: () => navigate("/login", { replace: true }) })}
          disabled={logout.isPending}
          className="mt-3 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-navy-light hover:text-white disabled:opacity-60"
        >
          <LogOut className="size-4" aria-hidden />
          Sair
        </button>
      </div>
    </div>
  );
}

export function AppLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  // Fecha o menu mobile ao trocar de página
  useEffect(() => setMobileOpen(false), [location.pathname]);

  return (
    <div className="min-h-screen lg:pl-64">
      <aside className="fixed inset-y-0 left-0 hidden w-64 lg:block">
        <Sidebar />
      </aside>

      <header className="sticky top-0 z-20 flex items-center justify-between bg-navy px-4 py-3 lg:hidden">
        <Logo />
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="rounded-lg p-2 text-white hover:bg-navy-light"
          aria-label="Abrir menu"
        >
          <Menu className="size-6" />
        </button>
      </header>

      {mobileOpen && (
        <div className="fixed inset-0 z-30 lg:hidden" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-72 max-w-[85%]">
            <Sidebar onNavigate={() => setMobileOpen(false)} />
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="absolute top-5 right-3 rounded-lg p-1.5 text-slate-300 hover:bg-navy-light"
              aria-label="Fechar menu"
            >
              <X className="size-5" />
            </button>
          </div>
        </div>
      )}

      <main className="mx-auto max-w-6xl p-4 sm:p-8">
        <Outlet />
      </main>
    </div>
  );
}
