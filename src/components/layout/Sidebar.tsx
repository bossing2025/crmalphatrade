import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useSidebarState } from "@/hooks/useSidebarState";
import { useCRMSettings } from "@/hooks/useCRMSettings";
import {
  LayoutDashboard,
  Users,
  UserPlus,
  Building2,
  Send,
  Sliders,
  XCircle,
  TestTube2,
  BarChart3,
  Settings,
  LogOut,
  Menu,
  X,
  FileText,
  TrendingUp,
  ChevronDown,
  ChevronRight,
  DollarSign,
  Globe,
  UsersRound,
  PanelLeftClose,
  PanelLeft,
  Activity,
  Syringe,
  Box,
  Clock,
  ScrollText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
interface NavItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  roles?: string[];
  children?: NavItem[];
}

const navItems: NavItem[] = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { title: "Leads", href: "/leads", icon: Users },
  { 
    title: "Affiliates", 
    href: "/affiliates", 
    icon: UserPlus, 
    roles: ["super_admin", "manager"],
    children: [
      { title: "Performance", href: "/affiliate-performance", icon: TrendingUp, roles: ["super_admin", "manager"] },
    ]
  },
  { 
    title: "Advertisers", 
    href: "/advertisers", 
    icon: Building2, 
    roles: ["super_admin", "manager"],
    children: [
      { title: "Performance", href: "/advertiser-performance", icon: TrendingUp, roles: ["super_admin", "manager"] },
    ]
  },
  { title: "Distribution Settings", href: "/distribution-settings", icon: Sliders, roles: ["super_admin", "manager"] },
  { title: "Distributions", href: "/distributions", icon: Send, roles: ["super_admin", "manager"] },
  { 
    title: "Rejected Leads", 
    href: "/rejected-leads", 
    icon: XCircle, 
    roles: ["super_admin", "manager"],
    children: [
      { title: "Affiliate Rejections", href: "/affiliate-rejected", icon: XCircle, roles: ["super_admin", "manager"] },
    ]
  },
  { title: "Test Logs", href: "/test-logs", icon: TestTube2, roles: ["super_admin", "manager"] },
  { 
    title: "Reports", 
    href: "/reports", 
    icon: BarChart3, 
    roles: ["super_admin", "manager"],
    children: [
      { title: "Conversions", href: "/conversions", icon: DollarSign, roles: ["super_admin", "manager"] },
      { title: "Country Performance", href: "/country-performance", icon: Globe, roles: ["super_admin", "manager"] },
      
    ]
  },
  { title: "API Docs", href: "/api-docs", icon: FileText },
  { 
    title: "Injections", 
    href: "/injections", 
    icon: Syringe, 
    roles: ["super_admin", "manager"],
    children: [
      { title: "Injection Jobs", href: "/injections/jobs", icon: Syringe, roles: ["super_admin", "manager"] },
      { title: "Lead Pools", href: "/lead-pools", icon: Box, roles: ["super_admin", "manager"] },
      { title: "All Injection Leads", href: "/injections/leads", icon: Users, roles: ["super_admin", "manager"] },
      { title: "Send History", href: "/injections/send-history", icon: Clock, roles: ["super_admin", "manager"] },
      { title: "Failed Leads", href: "/injections/failed", icon: XCircle, roles: ["super_admin", "manager"] },
    ]
  },
  { title: "Monitoring", href: "/monitoring", icon: Activity, roles: ["super_admin", "manager"] },
  { title: "Audit Logs", href: "/audit-logs", icon: ScrollText, roles: ["super_admin"] },
  { title: "Users", href: "/users", icon: UsersRound, roles: ["super_admin", "manager"] },
  { title: "Settings", href: "/settings", icon: Settings, roles: ["super_admin"] },
];

export function Sidebar() {
  const location = useLocation();
  const { signOut, roles, user, username } = useAuth();
  const { isCollapsed, toggleCollapsed } = useSidebarState();
  const { formatDate } = useCRMSettings();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [openMenus, setOpenMenus] = useState<string[]>([]);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Update time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const hasAccess = (item: NavItem) => {
    if (!item.roles) return true;
    return item.roles.some((role) => roles.includes(role as any));
  };

  const filteredNavItems = navItems.filter(hasAccess);

  const isChildActive = (item: NavItem) => {
    if (!item.children) return false;
    return item.children.some(child => location.pathname === child.href);
  };

  // Auto-expand menu when child is active
  useEffect(() => {
    navItems.forEach(item => {
      if (item.children && isChildActive(item) && !openMenus.includes(item.href)) {
        setOpenMenus(prev => [...prev, item.href]);
      }
    });
  }, [location.pathname]);

  const toggleMenu = (href: string) => {
    setOpenMenus(prev => 
      prev.includes(href) 
        ? prev.filter(h => h !== href)
        : [...prev, href]
    );
  };

  const NavContent = () => (
    <>
      <div className="border-b px-4 py-3">
        <div className="flex items-center justify-between">
          <Link to="/dashboard" className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
              <span className="text-primary-foreground font-bold text-sm">MT</span>
            </div>
            {!isCollapsed && <span className="font-semibold text-lg">MegaTronCrm</span>}
          </Link>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 flex-shrink-0"
            onClick={toggleCollapsed}
            title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {isCollapsed ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </Button>
        </div>
        {!isCollapsed && (
          <div className="mt-2 text-xs text-muted-foreground font-mono">
            {formatDate(currentTime)}
          </div>
        )}
      </div>

      <nav className="flex-1 space-y-1 p-2 overflow-y-auto">
        {filteredNavItems.map((item) => {
          const isActive = location.pathname === item.href;
          const hasChildren = item.children && item.children.length > 0;
          const isOpen = openMenus.includes(item.href);

          if (hasChildren && !isCollapsed) {
            return (
              <div key={item.href} className="space-y-1">
                <div className="flex items-center">
                  <Link
                    to={item.href}
                    onClick={() => setIsMobileOpen(false)}
                    className={cn(
                      "flex-1 flex items-center gap-3 rounded-l-lg px-3 py-2 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <item.icon className="h-4 w-4 flex-shrink-0" />
                    {item.title}
                  </Link>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleMenu(item.href)}
                    className={cn(
                      "h-9 w-9 p-0 rounded-l-none",
                      isActive ? "bg-primary text-primary-foreground hover:bg-primary/90" : "text-muted-foreground"
                    )}
                  >
                    {isOpen ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                {isOpen && (
                  <div className="pl-4 space-y-1">
                    {item.children?.filter(hasAccess).map((child) => {
                      const isChildActiveNow = location.pathname === child.href;
                      return (
                        <Link
                          key={child.href}
                          to={child.href}
                          onClick={() => setIsMobileOpen(false)}
                          className={cn(
                            "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                            isChildActiveNow
                              ? "bg-primary text-primary-foreground"
                              : "text-muted-foreground hover:bg-muted hover:text-foreground"
                          )}
                        >
                          <child.icon className="h-4 w-4 flex-shrink-0" />
                          {child.title}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          }

          return (
            <Link
              key={item.href}
              to={item.href}
              onClick={() => setIsMobileOpen(false)}
              title={isCollapsed ? item.title : undefined}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
                isCollapsed && "justify-center px-2"
              )}
            >
              <item.icon className="h-4 w-4 flex-shrink-0" />
              {!isCollapsed && item.title}
            </Link>
          );
        })}
      </nav>

      <div className="border-t p-2">
        {!isCollapsed && (
          <div className="mb-4 px-3">
            <p className="text-sm font-medium truncate">{username || user?.email}</p>
            <p className="text-xs text-muted-foreground capitalize">
              {roles.map(r => r.replace('_', ' ')).join(", ") || "No role assigned"}
            </p>
          </div>
        )}
        <Button
          variant="ghost"
          className={cn("w-full gap-3", isCollapsed ? "justify-center px-2" : "justify-start")}
          onClick={signOut}
          title={isCollapsed ? "Sign Out" : undefined}
        >
          <LogOut className="h-4 w-4 flex-shrink-0" />
          {!isCollapsed && "Sign Out"}
        </Button>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile menu button */}
      <Button
        variant="ghost"
        size="icon"
        className="fixed top-4 left-4 z-50 lg:hidden"
        onClick={() => setIsMobileOpen(!isMobileOpen)}
      >
        {isMobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </Button>

      {/* Mobile overlay */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm lg:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex flex-col border-r bg-card transition-all duration-300 lg:translate-x-0",
          isCollapsed ? "w-16" : "w-64",
          isMobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <NavContent />
      </aside>
    </>
  );
}
