// app/admin/layout.tsx
"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  LayoutDashboard,
  FileText,
  Package,
  BarChart3,
  ShoppingBag,
  Bell,
  User,
  Users,
  Settings,
  LogOut,
  CreditCard,
  Shield,
  ChevronRight,
  ChevronDown,
  X,
  Save,
  Loader2,
  Tag,
  Ruler,
  Archive,
  TrendingUp,
  TrendingDown,
  Cog,
  MessageSquare,
  AlertTriangle,
  Barcode,
  Layers,
  PackageOpen,
  ArrowDownToLine,
  ArrowUpFromLine,
  ClipboardList,
  RefreshCw,
  X as XIcon,
  RotateCcw,
  Ticket,
  PackageCheck,
} from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import logo from "@/public/assets/images/general/stp-transparent-logo-light.png";
import mbtLogo from "@/public/assets/images/general/MBT.jpg";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { ThemeProvider, useTheme } from "@/contexts/ThemeContext";
import { ThemeSwitcher } from "@/components/theme-switcher";

interface MenuItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  children?: MenuItem[];
}

const menuItems: MenuItem[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  {
    id: "products",
    label: "Products",
    icon: Package,
    children: [
      { id: "products", label: "All Products", icon: Package },
      { id: "categories", label: "Categories", icon: Tag },
      { id: "tags", label: "Tags", icon: Tag },
      { id: "sizes", label: "Sizes", icon: Ruler },
      { id: "fast-moving", label: "Fast-Moving", icon: TrendingUp },
      { id: "slow-moving", label: "Slow-Moving", icon: TrendingDown },
      { id: "archived", label: "Archived", icon: Archive },
      { id: "barcodes", label: "Barcodes", icon: Barcode },
      { id: "bundles", label: "Bundles", icon: PackageOpen },
    ],
  },
  { id: "reports", label: "Reports", icon: BarChart3 },
  { id: "orders", label: "Orders", icon: ShoppingBag },
  { id: "payments", label: "Payments", icon: CreditCard },
  {
    id: "inventory",
    label: "Inventory",
    icon: Layers,
    children: [
      { id: "stock-in", label: "Stock In", icon: ArrowDownToLine },
      { id: "stock-out", label: "Stock Out", icon: ArrowUpFromLine },
      { id: "stock-history", label: "Stock History", icon: ClipboardList },
      { id: "pos", label: "POS / Store Sales", icon: ShoppingBag },
      { id: "purchase-orders", label: "Purchase Orders", icon: FileText },
    ],
  },
  {
    id: "management",
    label: "Management",
    icon: Cog,
    children: [
      { id: "audit-trails", label: "Audit Trails", icon: FileText },
      { id: "feedback", label: "Feedback", icon: MessageSquare },
      { id: "notifications", label: "Notifications", icon: Bell },
      { id: "inventory-alerts", label: "Inventory Alerts", icon: AlertTriangle },
      { id: "refunds", label: "Refunds", icon: RotateCcw },
      { id: "vouchers", label: "Vouchers & Promos", icon: Ticket },
    ],
  },
  {
    id: "clients",
    label: "Clients",
    icon: Users,
    children: [
      { id: "users", label: "All Clients", icon: Users },
    ],
  },
];

function AdminLayoutContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { themeClasses } = useTheme();

  const [optimisticActive, setOptimisticActive] = useState<string | null>(null);
  const [isNavigating, setIsNavigating] = useState(false);
  const [expandedMenus, setExpandedMenus] = useState<Set<string>>(new Set(["products"]));
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [user, setUser] = useState<{ id: string; email: string; firstName: string; lastName: string; phone: string } | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // ── Real inventory alert bell ─────────────────────────────────────────
  type BellAlert = { id: string; productName: string; message: string; severity: "critical" | "high"; stock: number };
  const [bellCount,    setBellCount]    = useState(0);
  const [bellCritical, setBellCritical] = useState(0);
  const [bellAlerts,   setBellAlerts]   = useState<BellAlert[]>([]);
  const [toasts,       setToasts]       = useState<{ id: string; title: string; body: string }[]>([]);
  const toastShownRef = useRef(false);

  // ── Refund alert bell ─────────────────────────────────────────────────
  type RefundBellItem = { id: string; orderId: string; userName: string; reason: string; amount: number; createdAt: string };
  const [refundBellCount,   setRefundBellCount]   = useState(0);
  const [refundBellItems,   setRefundBellItems]   = useState<RefundBellItem[]>([]);
  const [isRefundBellOpen,  setIsRefundBellOpen]  = useState(false);
  const refundBellRef = useRef<HTMLDivElement>(null);

  // ── Delivery notification bell ────────────────────────────────────────
  type DeliveryBellItem = { id: string; orderId: string; orderNumber: string | null; userName: string; amount: number; deliveredAt: string };
  const [deliveryBellCount,   setDeliveryBellCount]   = useState(0);
  const [deliveryBellItems,   setDeliveryBellItems]   = useState<DeliveryBellItem[]>([]);
  const [isDeliveryBellOpen,  setIsDeliveryBellOpen]  = useState(false);
  const deliveryBellRef = useRef<HTMLDivElement>(null);

  const fetchBellAlerts = useCallback(async () => {
    try {
      const res    = await fetch("/api/admin/alerts/bell");
      const result = await res.json();
      setBellCount(result.count    ?? 0);
      setBellCritical(result.criticalCount ?? 0);
      setBellAlerts(result.alerts  ?? []);

      // Show a one-time toast per session if there are critical alerts
      if ((result.criticalCount ?? 0) > 0 && !toastShownRef.current) {
        toastShownRef.current = true;
        const id = Date.now().toString();
        setToasts((prev) => [
          ...prev,
          {
            id,
            title: `🚨 ${result.criticalCount} Critical Stock Alert${result.criticalCount === 1 ? "" : "s"}`,
            body:  result.alerts
              .filter((a: BellAlert) => a.severity === "critical")
              .slice(0, 2)
              .map((a: BellAlert) => a.productName)
              .join(", "),
          },
        ]);
        setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 8000);
      }
    } catch {
      // silent — never crash the layout
    }
  }, []);

  // Fetch on mount, then every 90 seconds
  useEffect(() => {
    fetchBellAlerts();
    const interval = setInterval(fetchBellAlerts, 90_000);
    return () => clearInterval(interval);
  }, [fetchBellAlerts]);

  const fetchRefundBell = useCallback(async () => {
    try {
      const res    = await fetch("/api/admin/refunds/bell");
      const result = await res.json();
      setRefundBellCount(result.count ?? 0);
      setRefundBellItems(result.refunds ?? []);
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    fetchRefundBell();
    const interval = setInterval(fetchRefundBell, 60_000);
    return () => clearInterval(interval);
  }, [fetchRefundBell]);

  const fetchDeliveryBell = useCallback(async () => {
    try {
      const res    = await fetch("/api/admin/orders/delivered-bell");
      const result = await res.json();
      setDeliveryBellCount(result.count ?? 0);
      setDeliveryBellItems(result.items ?? []);
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    fetchDeliveryBell();
    const interval = setInterval(fetchDeliveryBell, 60_000);
    return () => clearInterval(interval);
  }, [fetchDeliveryBell]);

  const userMenuRef = useRef<HTMLDivElement>(null);
  const notificationsRef = useRef<HTMLDivElement>(null);
  // refundBellRef declared above with state

  // Fetch user data
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const supabase = createClient();
        const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();

        if (authError || !authUser) {
          console.log('No authenticated user found');
          return;
        }

        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('first_name, last_name, email, phone')
          .eq('id', authUser.id)
          .single();

        if (profileError) {
          console.log('Profile fetch error:', profileError);
        }

        const userData = {
          id: authUser.id,
          email: authUser.email || '',
          firstName: profile?.first_name || '',
          lastName: profile?.last_name || '',
          phone: profile?.phone || '',
        };

        setUser(userData);
      } catch (error) {
        console.error('Error fetching user:', error);
      }
    };
    fetchUser();
  }, []);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
      if (notificationsRef.current && !notificationsRef.current.contains(event.target as Node)) {
        setIsNotificationsOpen(false);
      }
      if (refundBellRef.current && !refundBellRef.current.contains(event.target as Node)) {
        setIsRefundBellOpen(false);
      }
      if (deliveryBellRef.current && !deliveryBellRef.current.contains(event.target as Node)) {
        setIsDeliveryBellOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Escape key to close modals
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsUserMenuOpen(false);
        setIsNotificationsOpen(false);
        setIsRefundBellOpen(false);
        setIsDeliveryBellOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      const supabase = createClient();
      // Log logout before signing out (fire-and-forget)
      fetch("/api/admin/auth/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "logout" }),
      }).catch(() => {});
      await supabase.auth.signOut();
      router.push("/admin/login");
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setIsLoggingOut(false);
      setIsUserMenuOpen(false);
    }
  };

  const currentPageId = useMemo(() => {
    if (pathname === "/admin" || pathname === "/admin/") {
      return "dashboard";
    }
    // Handle nested routes like /admin/users/archived
    if (pathname === "/admin/users/archived") {
      return "users-archived";
    }
    const segments = pathname.split('/');
    return segments[segments.length - 1] || "dashboard";
  }, [pathname]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setOptimisticActive(null);
      setIsNavigating(false);
    }, 50);

    return () => clearTimeout(timer);
  }, [pathname]);

  // Auto-expand parent menu when on a child page
  useEffect(() => {
    const productChildIds = ["products", "categories", "tags", "sizes", "archived", "fast-moving", "slow-moving", "barcodes", "bundles"];
    const clientChildIds = ["users", "users-archived"];
    const managementChildIds = ["audit-trails", "feedback", "notifications", "inventory-alerts", "refunds", "vouchers"];
    const inventoryChildIds = ["stock-in", "stock-out", "stock-history", "pos"];
    if (productChildIds.includes(currentPageId)) {
      setExpandedMenus(prev => new Set([...prev, "products"]));
    }
    if (clientChildIds.includes(currentPageId)) {
      setExpandedMenus(prev => new Set([...prev, "clients"]));
    }
    if (managementChildIds.includes(currentPageId)) {
      setExpandedMenus(prev => new Set([...prev, "management"]));
    }
    if (inventoryChildIds.includes(currentPageId)) {
      setExpandedMenus(prev => new Set([...prev, "inventory"]));
    }
  }, [currentPageId]);

  const handleNavigation = useCallback((itemId: string, href: string) => {
    if (currentPageId === itemId) {
      return;
    }

    setOptimisticActive(itemId);
    setIsNavigating(true);
    router.push(href);
  }, [router, currentPageId]);

  const getIsActive = useCallback((itemId: string) => {
    if (optimisticActive === itemId) return true;
    if (optimisticActive && optimisticActive !== itemId) return false;

    return currentPageId === itemId;
  }, [optimisticActive, currentPageId]);

  const currentPageTitle = useMemo(() => {
    const activeId = optimisticActive || currentPageId;

    // Check top-level items first
    const activeItem = menuItems.find(item => item.id === activeId);
    if (activeItem) return activeItem.label;

    // Check children items
    for (const item of menuItems) {
      if (item.children) {
        const childItem = item.children.find(child => child.id === activeId);
        if (childItem) return childItem.label;
      }
    }

    return "Admin";
  }, [optimisticActive, currentPageId]);

  const shouldShowNavDetails = useMemo(() => {
    return pathname.includes("/admin") && !pathname.includes("/login");
  }, [pathname]);

  return (
    <div className={`min-h-screen ${themeClasses.bg} flex transition-colors duration-200`}>
      {shouldShowNavDetails && (
        <div className={`w-16 lg:w-64 ${themeClasses.bgSecondary} border-r ${themeClasses.border} flex-shrink-0 transition-colors duration-200`}>
          <div className={`hidden h-[74px] lg:flex items-center justify-start p-6 border-b ${themeClasses.border} gap-3`}>
            <Image
              src={mbtLogo}
              alt="MBT Logo"
              className="w-9 h-9 object-contain rounded-full"
            />
            <h1 className={`text-lg font-semibold ${themeClasses.accent} tracking-[3px]`}>SCENTOPIA</h1>
          </div>
          <div className={`lg:hidden flex items-center justify-center p-4 border-b ${themeClasses.border}`}>
            <div className={`w-32 h-9 flex items-center justify-center ${themeClasses.accent} font-bold text-sm`}>
              <Image
                src={logo}
                alt="Scentopia Logo"
                className="w-8 h-16 object-contain"
              />
            </div>
          </div>

          <nav className="p-2 lg:p-4">
            <ul className="space-y-1 lg:space-y-1">
              {menuItems.map((item) => {
                const IconComponent = item.icon;
                const hasChildren = item.children && item.children.length > 0;
                const isExpanded = expandedMenus.has(item.id);
                const isParentActive = hasChildren && item.children?.some(child => getIsActive(child.id));

                // For items without children
                if (!hasChildren) {
                  const href = item.id === "dashboard" ? "/admin" : `/admin/${item.id}`;
                  const isActive = getIsActive(item.id);

                  return (
                    <li key={item.id}>
                      <button
                        onClick={() => handleNavigation(item.id, href)}
                        disabled={isNavigating}
                        className={`w-full flex items-center justify-center lg:justify-start space-x-0 lg:space-x-3 px-2 lg:px-4 py-3 text-left font-medium transition-all duration-150 ease-out transform group relative disabled:opacity-50 ${
                          isActive
                            ? `${themeClasses.accentBg} ${themeClasses.accentText}`
                            : `${themeClasses.text} ${themeClasses.hoverBg}`
                        }`}
                      >
                        <IconComponent className="w-5 h-5 flex-shrink-0" />
                        <span className="hidden lg:block uppercase">{item.label}</span>
                        {isNavigating && optimisticActive === item.id && (
                          <div className={`ml-2 w-2 h-2 ${themeClasses.accentText} rounded-full animate-pulse`} />
                        )}
                      </button>
                    </li>
                  );
                }

                // For items with children (expandable)
                return (
                  <li key={item.id}>
                    <button
                      onClick={() => {
                        const newExpanded = new Set(expandedMenus);
                        if (isExpanded) {
                          newExpanded.delete(item.id);
                        } else {
                          newExpanded.add(item.id);
                        }
                        setExpandedMenus(newExpanded);
                      }}
                      className={`w-full flex items-center justify-center lg:justify-between px-2 lg:px-4 py-3 text-left font-medium transition-all duration-150 ease-out ${
                        isParentActive
                          ? `${themeClasses.accent}`
                          : `${themeClasses.text} ${themeClasses.hoverBg}`
                      }`}
                    >
                      <div className="flex items-center space-x-0 lg:space-x-3">
                        <IconComponent className="w-5 h-5 flex-shrink-0" />
                        <span className="hidden lg:block uppercase">{item.label}</span>
                      </div>
                      <ChevronDown
                        className={`hidden lg:block w-4 h-4 transition-transform duration-200 ${
                          isExpanded ? "rotate-180" : ""
                        }`}
                      />
                    </button>

                    {/* Children */}
                    <ul
                      className={`overflow-hidden transition-all duration-200 ${
                        isExpanded ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
                      }`}
                    >
                      {item.children?.map((child) => {
                        const ChildIcon = child.icon;
                        // Handle special routes
                        let childHref = `/admin/${child.id}`;
                        if (child.id === "products") childHref = "/admin/products";
                        if (child.id === "users") childHref = "/admin/users";
                        if (child.id === "users-archived") childHref = "/admin/users/archived";
                        // Products children routes
                        if (item.id === "products" && child.id === "fast-moving") childHref = "/admin/products/fast-moving";
                        if (item.id === "products" && child.id === "slow-moving") childHref = "/admin/products/slow-moving";
                        if (item.id === "products" && child.id === "barcodes") childHref = "/admin/products/barcodes";
                        if (item.id === "products" && child.id === "bundles") childHref = "/admin/products/bundles";
                        // Management children routes
                        if (item.id === "management") childHref = `/admin/management/${child.id}`;
                        if (item.id === "inventory") childHref = `/admin/inventory/${child.id}`;
                        const isChildActive = getIsActive(child.id);

                        return (
                          <li key={child.id}>
                            <button
                              onClick={() => handleNavigation(child.id, childHref)}
                              disabled={isNavigating}
                              className={`w-full flex items-center justify-center lg:justify-start space-x-0 lg:space-x-3 px-2 lg:pl-8 lg:pr-4 py-2.5 text-left text-sm font-medium transition-all duration-150 ease-out disabled:opacity-50 ${
                                isChildActive
                                  ? `${themeClasses.accentBg} ${themeClasses.accentText}`
                                  : `${themeClasses.text} ${themeClasses.hoverBg}`
                              }`}
                            >
                              <ChildIcon className="w-4 h-4 flex-shrink-0" />
                              <span className="hidden lg:block uppercase text-xs">{child.label}</span>
                              {isNavigating && optimisticActive === child.id && (
                                <div className={`ml-2 w-2 h-2 ${themeClasses.accentText} rounded-full animate-pulse`} />
                              )}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </li>
                );
              })}
            </ul>
          </nav>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        {shouldShowNavDetails && (
          <header className={`${themeClasses.bgSecondary} border-b ${themeClasses.border} px-4 lg:px-6 py-4 transition-colors duration-200`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <h2 className={`text-xl font-semibold ${themeClasses.accent} uppercase tracking-[2px]`}>
                  {currentPageTitle}
                </h2>
                {isNavigating && (
                  <div className="flex space-x-1">
                    <div className={`w-2 h-2 ${themeClasses.accentBg} rounded-full animate-bounce`}></div>
                    <div className={`w-2 h-2 ${themeClasses.accentBg} rounded-full animate-bounce`} style={{animationDelay: '0.1s'}}></div>
                    <div className={`w-2 h-2 ${themeClasses.accentBg} rounded-full animate-bounce`} style={{animationDelay: '0.2s'}}></div>
                  </div>
                )}
              </div>

              <div className="flex items-center space-x-2 lg:space-x-4">
                {/* Theme Toggle */}
                <ThemeSwitcher />

                {/* Refund Alert Bell */}
                <div className="relative" ref={refundBellRef}>
                  <button
                    onClick={() => {
                      setIsRefundBellOpen(!isRefundBellOpen);
                      setIsNotificationsOpen(false);
                      setIsUserMenuOpen(false);
                    }}
                    className={`relative p-2 ${themeClasses.hoverBg} transition-colors duration-150 rounded-md active:scale-95 ${themeClasses.text}`}
                    title="Refund requests"
                  >
                    <RotateCcw className="w-5 h-5" />
                    {refundBellCount > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-0.5 flex items-center justify-center rounded-full text-[10px] font-bold text-white leading-none bg-blue-500">
                        {refundBellCount > 99 ? "99+" : refundBellCount}
                      </span>
                    )}
                  </button>

                  {isRefundBellOpen && (
                    <div className={`absolute right-0 mt-2 w-80 ${themeClasses.bgSecondary} border ${themeClasses.border} shadow-xl z-50`}>
                      <div className={`px-4 py-3 border-b ${themeClasses.border} flex items-center justify-between`}>
                        <h3 className={`text-sm font-semibold ${themeClasses.accent}`}>Refund Requests</h3>
                        {refundBellCount > 0 && (
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                            {refundBellCount} pending
                          </span>
                        )}
                      </div>

                      <div className="max-h-72 overflow-y-auto">
                        {refundBellItems.length === 0 ? (
                          <div className="px-4 py-8 text-center">
                            <RotateCcw className={`w-8 h-8 mx-auto mb-2 ${themeClasses.textMuted} opacity-40`} />
                            <p className={`text-sm ${themeClasses.textMuted}`}>No pending refund requests</p>
                          </div>
                        ) : (
                          refundBellItems.map((item) => (
                            <button
                              key={item.id}
                              onClick={() => {
                                router.push("/admin/management/refunds");
                                setIsRefundBellOpen(false);
                              }}
                              className={`w-full text-left px-4 py-3 bg-transparent hover:bg-[#f5f0e8] border-b ${themeClasses.border} last:border-b-0 transition-colors`}
                            >
                              <div className="flex items-start gap-3">
                                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                                  <RotateCcw className="w-4 h-4 text-blue-600" />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className={`text-sm font-medium ${themeClasses.text} truncate`}>{item.userName}</p>
                                  <p className="text-xs text-[#7a6a4a] mt-0.5 truncate">{item.reason}</p>
                                  <p className="text-xs font-semibold text-[#8B6914] mt-0.5">₱{item.amount.toFixed(2)}</p>
                                </div>
                              </div>
                            </button>
                          ))
                        )}
                      </div>

                      <div className={`px-4 py-3 border-t ${themeClasses.border} flex items-center gap-2`}>
                        <button
                          onClick={() => {
                            router.push("/admin/management/refunds");
                            setIsRefundBellOpen(false);
                          }}
                          className={`flex-1 text-sm ${themeClasses.accent} hover:opacity-80 text-center font-medium`}
                        >
                          View all refunds
                        </button>
                        <button
                          onClick={() => { fetchRefundBell(); setIsRefundBellOpen(false); }}
                          className={`p-1.5 ${themeClasses.textMuted} hover:${themeClasses.text} transition-colors`}
                          title="Refresh"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Inventory Alert Bell — real data from /api/admin/alerts/bell */}
                <div className="relative" ref={notificationsRef}>
                  <button
                    onClick={() => {
                      setIsNotificationsOpen(!isNotificationsOpen);
                      setIsUserMenuOpen(false);
                      setIsRefundBellOpen(false);
                    }}
                    className={`relative p-2 ${themeClasses.hoverBg} transition-colors duration-150 rounded-md active:scale-95 ${themeClasses.text}`}
                    title="Inventory alerts"
                  >
                    <Bell className="w-5 h-5" />
                    {bellCount > 0 && (
                      <span className={`absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-0.5 flex items-center justify-center rounded-full text-[10px] font-bold text-white leading-none ${bellCritical > 0 ? "bg-red-500" : "bg-amber-500"}`}>
                        {bellCount > 99 ? "99+" : bellCount}
                      </span>
                    )}
                  </button>

                  {/* Bell Dropdown */}
                  {isNotificationsOpen && (
                    <div className={`absolute right-0 mt-2 w-80 ${themeClasses.bgSecondary} border ${themeClasses.border} shadow-xl z-50`}>
                      <div className={`px-4 py-3 border-b ${themeClasses.border} flex items-center justify-between`}>
                        <h3 className={`text-sm font-semibold ${themeClasses.accent}`}>
                          Inventory Alerts
                        </h3>
                        {bellCount > 0 && (
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${bellCritical > 0 ? "bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-900" : "bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-900"}`}>
                            {bellCount} active
                          </span>
                        )}
                      </div>

                      <div className="max-h-72 overflow-y-auto">
                        {bellAlerts.length === 0 ? (
                          <div className="px-4 py-8 text-center">
                            <Package className={`w-8 h-8 mx-auto mb-2 ${themeClasses.textMuted} opacity-40`} />
                            <p className={`text-sm ${themeClasses.textMuted}`}>All stock levels are healthy</p>
                          </div>
                        ) : (
                          bellAlerts.map((alert) => (
                            <button
                              key={alert.id}
                              onClick={() => {
                                router.push("/admin/management/inventory-alerts");
                                setIsNotificationsOpen(false);
                              }}
                              className={`w-full text-left px-4 py-3 bg-transparent dark:bg-[#26231a] hover:bg-[#f5f0e8] dark:hover:bg-[#2e2a1e] border-b ${themeClasses.border} last:border-b-0 transition-colors`}
                            >
                              <div className="flex items-start gap-3">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${alert.severity === "critical" ? "bg-red-100 dark:bg-red-900/70" : "bg-amber-100 dark:bg-amber-900/70"}`}>
                                  <Package className={`w-4 h-4 ${alert.severity === "critical" ? "text-red-600 dark:text-red-300" : "text-amber-600 dark:text-amber-300"}`} />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className={`text-sm font-medium ${themeClasses.text} truncate`}>{alert.productName}</p>
                                  <p className="text-xs text-[#7a6a4a] dark:text-[#c4a96a] mt-0.5">{alert.message}</p>
                                </div>
                              </div>
                            </button>
                          ))
                        )}
                      </div>

                      <div className={`px-4 py-3 border-t ${themeClasses.border} flex items-center gap-2`}>
                        <button
                          onClick={() => {
                            router.push("/admin/management/inventory-alerts");
                            setIsNotificationsOpen(false);
                          }}
                          className={`flex-1 text-sm ${themeClasses.accent} hover:opacity-80 text-center font-medium`}
                        >
                          View all alerts
                        </button>
                        <button
                          onClick={() => { fetchBellAlerts(); setIsNotificationsOpen(false); }}
                          className={`p-1.5 ${themeClasses.textMuted} hover:${themeClasses.text} transition-colors`}
                          title="Refresh"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Delivery Notification Bell */}
                <div className="relative" ref={deliveryBellRef}>
                  <button
                    onClick={() => {
                      setIsDeliveryBellOpen(!isDeliveryBellOpen);
                      setIsNotificationsOpen(false);
                      setIsRefundBellOpen(false);
                      setIsUserMenuOpen(false);
                    }}
                    className={`relative p-2 ${themeClasses.hoverBg} transition-colors duration-150 rounded-md active:scale-95 ${themeClasses.text}`}
                    title="Delivered orders"
                  >
                    <PackageCheck className="w-5 h-5" />
                    {deliveryBellCount > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-0.5 flex items-center justify-center rounded-full text-[10px] font-bold text-white leading-none bg-green-500">
                        {deliveryBellCount > 99 ? "99+" : deliveryBellCount}
                      </span>
                    )}
                  </button>

                  {isDeliveryBellOpen && (
                    <div className={`absolute right-0 mt-2 w-80 ${themeClasses.bgSecondary} border ${themeClasses.border} shadow-xl z-50`}>
                      <div className={`px-4 py-3 border-b ${themeClasses.border} flex items-center justify-between`}>
                        <h3 className={`text-sm font-semibold ${themeClasses.accent}`}>Delivered Orders</h3>
                        {deliveryBellCount > 0 && (
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200">
                            {deliveryBellCount} in last 48h
                          </span>
                        )}
                      </div>

                      <div className="max-h-72 overflow-y-auto">
                        {deliveryBellItems.length === 0 ? (
                          <div className="px-4 py-8 text-center">
                            <PackageCheck className={`w-8 h-8 mx-auto mb-2 ${themeClasses.textMuted} opacity-40`} />
                            <p className={`text-sm ${themeClasses.textMuted}`}>No deliveries in the last 48 hours</p>
                          </div>
                        ) : (
                          deliveryBellItems.map((item) => (
                            <button
                              key={item.id}
                              onClick={() => {
                                router.push("/admin/orders");
                                setIsDeliveryBellOpen(false);
                              }}
                              className={`w-full text-left px-4 py-3 bg-transparent hover:bg-[#f5f0e8] border-b ${themeClasses.border} last:border-b-0 transition-colors`}
                            >
                              <div className="flex items-start gap-3">
                                <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                                  <PackageCheck className="w-4 h-4 text-green-600" />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className={`text-sm font-medium ${themeClasses.text} truncate`}>{item.userName}</p>
                                  <p className="text-xs text-[#7a6a4a] mt-0.5 truncate">
                                    {item.orderNumber ? `Order #${item.orderNumber}` : `Order ${item.orderId.slice(0, 8)}…`}
                                  </p>
                                  <p className="text-xs font-semibold text-green-700 mt-0.5">₱{item.amount.toFixed(2)} · Delivered</p>
                                </div>
                              </div>
                            </button>
                          ))
                        )}
                      </div>

                      <div className={`px-4 py-3 border-t ${themeClasses.border} flex items-center gap-2`}>
                        <button
                          onClick={() => {
                            router.push("/admin/orders");
                            setIsDeliveryBellOpen(false);
                          }}
                          className={`flex-1 text-sm ${themeClasses.accent} hover:opacity-80 text-center font-medium`}
                        >
                          View all orders
                        </button>
                        <button
                          onClick={() => { fetchDeliveryBell(); setIsDeliveryBellOpen(false); }}
                          className={`p-1.5 ${themeClasses.textMuted} hover:${themeClasses.text} transition-colors`}
                          title="Refresh"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* User Menu */}
                <div className="relative" ref={userMenuRef}>
                  <button
                    onClick={() => {
                      setIsUserMenuOpen(!isUserMenuOpen);
                      setIsNotificationsOpen(false);
                      setIsRefundBellOpen(false);
                      setIsDeliveryBellOpen(false);
                    }}
                    className={`w-8 h-8 ${themeClasses.accentBg} rounded-full flex items-center justify-center hover:opacity-80 transition-all duration-150 cursor-pointer active:scale-95`}
                  >
                    <span className={`text-sm font-medium ${themeClasses.accentText}`}>
                      {user?.firstName?.charAt(0).toUpperCase() || 'A'}
                    </span>
                  </button>

                  {/* User Dropdown Menu */}
                  {isUserMenuOpen && (
                    <div className={`absolute right-0 mt-2 w-72 ${themeClasses.bgSecondary} border ${themeClasses.border} shadow-xl z-50 transition-colors duration-200`}>
                      {/* User Info */}
                      <div className={`px-4 py-4 border-b ${themeClasses.border}`}>
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 ${themeClasses.accentBg} rounded-full flex items-center justify-center`}>
                            <span className={`text-lg font-semibold ${themeClasses.accentText}`}>
                              {user?.firstName?.charAt(0).toUpperCase() || 'A'}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-medium ${themeClasses.text} truncate`}>
                              {user?.firstName && user?.lastName
                                ? `${user.firstName} ${user.lastName}`
                                : 'Admin User'}
                            </p>
                            <p className={`text-xs ${themeClasses.textMuted} truncate`}>
                              {user?.email || 'admin@scentopia.com'}
                            </p>
                          </div>
                          <div className="flex items-center gap-1 px-2 py-1 bg-[#d4af37]/10 rounded">
                            <Shield className={`w-3 h-3 ${themeClasses.accent}`} />
                            <span className={`text-xs font-medium ${themeClasses.accent}`}>Admin</span>
                          </div>
                        </div>
                      </div>

                      {/* Menu Items */}
                      <div className="py-2">
                        <div className={`border-t ${themeClasses.border} my-2`}></div>

                        <button
                          onClick={handleLogout}
                          disabled={isLoggingOut}
                          className="w-full px-4 py-2.5 flex items-center gap-3 text-left hover:bg-red-500/10 transition-colors disabled:opacity-50"
                        >
                          <LogOut className="w-4 h-4 text-red-500" />
                          <span className="text-sm text-red-500 font-medium">
                            {isLoggingOut ? 'Logging out...' : 'Log Out'}
                          </span>
                        </button>
                      </div>

                      {/* Footer */}
                      <div className={`px-4 py-2 border-t ${themeClasses.border} ${themeClasses.bgTertiary}`}>
                        <p className={`text-xs ${themeClasses.textMuted} text-center`}>
                          Scentopia Admin v1.0
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </header>
        )}

        <main className={`flex-1 p-2 sm:p-4 lg:p-6 overflow-y-auto ${themeClasses.bg} transition-colors duration-200`}>
          {isNavigating && (
            <div className={`absolute inset-0 ${themeClasses.bg} bg-opacity-50 z-10 flex items-center justify-center`}>
              <div className={`text-lg font-medium ${themeClasses.accent}`}>Loading...</div>
            </div>
          )}
          {children}
        </main>
      </div>

      {/* Critical Stock Toast Notifications */}
      <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="pointer-events-auto flex items-start gap-3 bg-white border border-red-200 shadow-xl rounded-sm px-4 py-3 max-w-xs animate-slide-in-right"
          >
            <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
              <Package className="w-4 h-4 text-red-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-[#1c1810]">{toast.title}</p>
              {toast.body && (
                <p className="text-xs text-[#7a6a4a] mt-0.5 truncate">{toast.body}</p>
              )}
              <button
                onClick={() => router.push("/admin/management/inventory-alerts")}
                className="text-xs text-[#8B6914] font-semibold mt-1 hover:underline"
              >
                View alerts →
              </button>
            </div>
            <button
              onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
              className="text-[#9a8a6a] hover:text-[#1c1810] transition-colors flex-shrink-0"
            >
              <XIcon className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

    </div>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <AdminLayoutContent>{children}</AdminLayoutContent>
    </ThemeProvider>
  );
}
