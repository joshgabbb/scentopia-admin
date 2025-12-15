// app/admin/layout.tsx
"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  LayoutDashboard,
  FileText,
  Package,
  BarChart3,
  ShoppingBag,
  Bell,
  Search,
} from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import logo from "@/public/assets/images/general/stp-transparent-logo-light.png";
import Image from "next/image";

const menuItems = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "products", label: "Products", icon: Package },
  { id: "reports", label: "Reports", icon: FileText },
  { id: "orders", label: "Orders", icon: ShoppingBag },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const [optimisticActive, setOptimisticActive] = useState<string | null>(null);
  const [isNavigating, setIsNavigating] = useState(false);

  const currentPageId = useMemo(() => {
    if (pathname === "/admin" || pathname === "/admin/") {
      return "dashboard";
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
    const activeItem = menuItems.find(item => item.id === activeId);
    return activeItem?.label || "Admin";
  }, [optimisticActive, currentPageId]);

  const shouldShowNavDetails = useMemo(() => {
    return pathname.includes("/admin") && !pathname.includes("/login");
  }, [pathname]);

  useEffect(() => {
    console.log('Navigation Debug:', {
      pathname,
      currentPageId,
      optimisticActive,
      isNavigating,
      title: currentPageTitle
    });
  }, [pathname, currentPageId, optimisticActive, isNavigating, currentPageTitle]);

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex">
      {shouldShowNavDetails && (
        <div className="w-16 lg:w-64 bg-[#1a1a1a] border-r border-[#d4af37]/20 flex-shrink-0">
          <div className="hidden h-[74px] lg:flex items-center justify-start p-6 border-b border-[#d4af37]/20">
            <h1 className="text-lg font-semibold text-[#d4af37] tracking-[3]">SCENTOPIA</h1>
          </div>
          <div className="lg:hidden flex items-center justify-center p-4 border-b border-[#d4af37]/20">
            <div className="w-32 h-9 flex items-center justify-center text-[#d4af37] font-bold text-sm">
              <Image
                src={logo}
                alt="Scentopia Logo"
                className="w-8 h-16 object-contain"
              />
            </div>
          </div>

          <nav className="p-2 lg:p-4">
            <ul className="space-y-1 lg:space-y-2">
              {menuItems.map((item) => {
                const IconComponent = item.icon;
                const href = item.id === "dashboard" ? "/admin" : `/admin/${item.id}`;
                const isActive = getIsActive(item.id);
                
                return (
                  <li key={item.id}>
                    <button
                      onClick={() => handleNavigation(item.id, href)}
                      disabled={isNavigating}
                      className={`w-full flex items-center justify-center lg:justify-start space-x-0 lg:space-x-3 px-2 lg:px-4 py-3 text-left font-medium transition-all duration-75 ease-out transform group relative disabled:opacity-50 ${
                        isActive
                          ? "bg-[#d4af37] text-[#0a0a0a]"
                          : "text-[#f5e6d3] hover:bg-[#d4af37]/10 active:bg-[#d4af37]/20"
                      }`}
                    >
                      <IconComponent className="w-5 h-5 flex-shrink-0" />
                      <span className="hidden lg:block uppercase">{item.label}</span>
                      {isNavigating && optimisticActive === item.id && (
                        <div className="ml-2 w-2 h-2 bg-[#0a0a0a] rounded-full animate-pulse" />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        {shouldShowNavDetails && (
          <header className="bg-[#1a1a1a] border-b border-[#d4af37]/20 px-4 lg:px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <h2 className="text-xl font-semibold text-[#d4af37] uppercase tracking-[2]">
                  {currentPageTitle}
                </h2>
                {isNavigating && (
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-[#d4af37] rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-[#d4af37] rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                    <div className="w-2 h-2 bg-[#d4af37] rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                  </div>
                )}
              </div>

              <div className="flex items-center space-x-2 lg:space-x-4">
                <div className="relative hidden sm:block">
                  <Search className="w-5 h-5 text-[#b8a070] absolute left-3 top-1/2 transform -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Search..."
                    className="pl-10 pr-4 py-2 border border-[#d4af37]/20 bg-[#0a0a0a] text-[#f5e6d3] w-48 lg:w-80 focus:outline-none focus:border-[#d4af37] transition-colors duration-150 placeholder-[#b8a070]"
                  />
                </div>
                <button className="relative p-2 hover:bg-[#d4af37]/10 transition-colors duration-150 rounded-md active:scale-95 text-[#f5e6d3]">
                  <Bell className="w-5 h-5" />
                  <span className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full"></span>
                </button>
                <div className="w-8 h-8 bg-[#d4af37] rounded-full flex items-center justify-center hover:bg-[#d4af37]/80 transition-colors duration-150 cursor-pointer active:scale-95">
                  <span className="text-sm font-medium text-[#0a0a0a]">A</span>
                </div>
              </div>
            </div>
          </header>
        )}

        <main className="flex-1 p-2 sm:p-4 lg:p-6 overflow-y-auto bg-[#0a0a0a]">
          {isNavigating && (
            <div className="absolute inset-0 bg-[#0a0a0a] bg-opacity-50 z-10 flex items-center justify-center">
              <div className="text-lg font-medium text-[#d4af37]">Loading...</div>
            </div>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}