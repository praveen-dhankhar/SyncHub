"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import {
  BarChart3,
  LogOut,
  Menu,
  Moon,
  Radar,
  Sun,
  User,
  X,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { apiRequest } from "@/lib/api";

/* ───────────────────────────────────────────────────────── */
/* Types                                                    */
/* ───────────────────────────────────────────────────────── */

interface UserData {
  id: string;
  username: string;
  email: string;
  avatar: string | null;
  createdAt: string;
}

interface AppShellProps {
  children: React.ReactNode;
}

/* ───────────────────────────────────────────────────────── */
/* Nav Links                                                */
/* ───────────────────────────────────────────────────────── */

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: BarChart3 },
  { href: "/profile", label: "Profile", icon: User },
];

/* ───────────────────────────────────────────────────────── */
/* AppShell                                                 */
/* ───────────────────────────────────────────────────────── */

export function AppShell({ children }: AppShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<UserData | null>(null);
  const [mounted, setMounted] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
    apiRequest("/auth/me", undefined, "GET")
      .then((res) => setUser(res.data ?? res))
      .catch(() => {
        router.replace("/auth/login");
      });
  }, [router]);

  const handleLogout = async () => {
    try {
      await apiRequest("/auth/logout", {}, "POST");
    } catch {
      // Best-effort logout
    }
    router.replace("/auth/login");
  };

  const initials = user?.username
    ? user.username.slice(0, 2).toUpperCase()
    : "??";

  return (
    <div className="shell-page">
      {/* ── Navigation ── */}
      <nav className="shell-nav">
        <div className="shell-nav-inner">
          {/* Left: Brand */}
          <a href="/" className="shell-brand">
            <span className="shell-brand-mark">
              <Radar className="size-3.5" />
            </span>
            <span className="hidden sm:inline">SyncHub</span>
          </a>

          {/* Center: Nav links (md+) */}
          <div className="shell-nav-links">
            {navItems.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="shell-nav-link"
                data-active={pathname === item.href ? "true" : undefined}
                onClick={(e) => {
                  e.preventDefault();
                  router.push(item.href);
                }}
              >
                <item.icon className="size-3.5" />
                {item.label}
              </a>
            ))}
          </div>

          {/* Right: Theme + Avatar + Mobile menu */}
          <div className="shell-nav-actions">
            {/* Theme toggle */}
            <ShellThemeToggle mounted={mounted} />

            {/* Avatar dropdown (md+) */}
            {user && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button type="button" className="shell-avatar-btn hidden md:flex">
                    <span className="shell-avatar-circle">{initials}</span>
                    <span className="shell-avatar-name">{user.username}</span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <DropdownMenuLabel className="font-normal">
                    <p className="text-sm font-medium">{user.username}</p>
                    <p className="text-xs text-muted-foreground">{user.email}</p>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => router.push("/profile")}>
                    <User className="size-4" />
                    Profile
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => router.push("/dashboard")}>
                    <BarChart3 className="size-4" />
                    Dashboard
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive" onClick={handleLogout}>
                    <LogOut className="size-4" />
                    Logout
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {/* Mobile hamburger */}
            <button
              type="button"
              className="shell-mobile-menu-btn"
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label="Toggle menu"
            >
              {mobileOpen ? <X className="size-4" /> : <Menu className="size-4" />}
            </button>
          </div>
        </div>

        {/* Mobile nav drawer */}
        {mobileOpen && (
          <div className="border-t border-border-subtle bg-void px-4 pb-4 pt-3 md:hidden">
            <div className="space-y-1">
              {navItems.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  className="shell-nav-link w-full"
                  data-active={pathname === item.href ? "true" : undefined}
                  onClick={(e) => {
                    e.preventDefault();
                    router.push(item.href);
                    setMobileOpen(false);
                  }}
                >
                  <item.icon className="size-4" />
                  {item.label}
                </a>
              ))}
            </div>
            {user && (
              <div className="mt-3 flex items-center justify-between border-t border-border-subtle pt-3">
                <div className="flex items-center gap-2">
                  <span className="shell-avatar-circle">{initials}</span>
                  <div>
                    <p className="text-sm font-medium text-text-primary">{user.username}</p>
                    <p className="text-xs text-text-secondary">{user.email}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="profile-btn-danger px-3 py-1.5 text-xs"
                >
                  <LogOut className="size-3.5" />
                  Logout
                </button>
              </div>
            )}
          </div>
        )}
      </nav>

      {/* ── Content ── */}
      <main className="shell-content">{children}</main>
    </div>
  );
}

/* ───────────────────────────────────────────────────────── */
/* Theme Toggle                                             */
/* ───────────────────────────────────────────────────────── */

function ShellThemeToggle({ mounted }: { mounted: boolean }) {
  const { resolvedTheme, setTheme } = useTheme();

  if (!mounted) {
    return <span className="shell-mobile-menu-btn pointer-events-none opacity-0 md:!grid" aria-hidden />;
  }

  const isDark = resolvedTheme === "dark";

  return (
    <button
      type="button"
      className="shell-mobile-menu-btn md:!grid"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </button>
  );
}
