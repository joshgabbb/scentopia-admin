// app/admin/reports/page.tsx
"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface Stats {
  pendingFeedback: number;
  fastMovingItems: number;
  slowMovingItems: number;
  lowStockAlerts: number;
  pendingNotifications: number;
  auditLogs: number;
}

export default function ReportsPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState<Stats>({
    pendingFeedback: 0,
    fastMovingItems: 0,
    slowMovingItems: 0,
    lowStockAlerts: 0,
    pendingNotifications: 0,
    auditLogs: 0,
  });

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/admin/reports/stats');
      const result = await response.json();
      
      if (result.success) {
        setStats(result.data);
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const modules = [
    {
      id: "feedback",
      title: "Feedback Management",
      description: "Review and respond to customer feedback and support queries",
      icon: "💬",
      color: "bg-blue-500",
      count: stats.pendingFeedback,
      path: "/admin/reports/feedback",
      trendValue: stats.pendingFeedback > 0 ? `${stats.pendingFeedback} pending` : "All clear"
    },
    {
      id: "fast-moving",
      title: "Fast-Moving Items",
      description: "Monitor high-demand products and inventory levels",
      icon: "📈",
      color: "bg-green-500",
      count: stats.fastMovingItems,
      path: "/admin/reports/fast-moving",
      trendValue: "Top performers"
    },
    {
      id: "slow-moving",
      title: "Slow-Moving Items",
      description: "Identify low-demand products and adjust inventory",
      icon: "📉",
      color: "bg-orange-500",
      count: stats.slowMovingItems,
      path: "/admin/reports/slow-moving",
      trendValue: stats.slowMovingItems > 0 ? "Needs attention" : "All good"
    },
    {
      id: "audit-trails",
      title: "Audit Trails",
      description: "Track admin actions and system changes for accountability",
      icon: "📋",
      color: "bg-purple-500",
      count: stats.auditLogs,
      path: "/admin/reports/audit-trails",
      trendValue: "Last 30 days"
    },
    {
      id: "notifications",
      title: "Notifications Management",
      description: "Send alerts, promotions, and updates to users",
      icon: "🔔",
      color: "bg-indigo-500",
      count: stats.pendingNotifications,
      path: "/admin/reports/notifications",
      trendValue: stats.pendingNotifications > 0 ? "Draft messages" : "No drafts"
    },
    {
      id: "inventory-alerts",
      title: "Inventory Notifications",
      description: "Receive alerts for low stock and inventory changes",
      icon: "📦",
      color: "bg-red-500",
      count: stats.lowStockAlerts,
      path: "/admin/reports/inventory-alerts",
      trendValue: stats.lowStockAlerts > 0 ? "Urgent" : "Stock healthy"
    },
  ];

  const handleModuleClick = (path: string) => {
    router.push(path);
  };

  const Skeleton = ({ className }: { className?: string }) => (
    <div className={`animate-pulse bg-gray-200 rounded ${className}`} />
  );

  if (isLoading) {
    return (
      <div className="space-y-8">
        <div>
          <Skeleton className="h-8 w-64 mb-2" />
          <Skeleton className="h-4 w-96" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="bg-white border border-gray-200 rounded-lg p-6">
              <div className="flex items-start justify-between mb-4">
                <Skeleton className="w-12 h-12 rounded" />
                <Skeleton className="w-16 h-6 rounded-full" />
              </div>
              <Skeleton className="h-6 w-3/4 mb-2" />
              <Skeleton className="h-4 w-full mb-4" />
              <Skeleton className="h-3 w-20" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-black mb-2">Reports & Management</h1>
        <p className="text-gray-600">
          Monitor feedback, inventory, and system activities across all modules
        </p>
      </div>

      {stats.lowStockAlerts > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <span className="text-2xl">⚠️</span>
          <div className="flex-1">
            <h3 className="font-semibold text-red-900">Urgent: Low Stock Alert</h3>
            <p className="text-red-800 text-sm mt-1">
              {stats.lowStockAlerts} product(s) are running low on inventory. Take action to prevent stockouts.
            </p>
          </div>
          <button 
            onClick={() => handleModuleClick('/admin/reports/inventory-alerts')}
            className="text-red-600 hover:text-red-800 font-medium text-sm whitespace-nowrap"
          >
            View Details →
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {modules.map((module) => (
          <button
            key={module.id}
            onClick={() => handleModuleClick(module.path)}
            className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-lg transition-all duration-200 hover:border-gray-300 text-left group"
          >
            <div className="flex items-start justify-between mb-4">
              <div className={`${module.color} p-3 rounded-lg text-white text-2xl`}>
                {module.icon}
              </div>
              <span className="bg-gray-100 text-gray-900 px-3 py-1 rounded-full text-sm font-semibold">
                {module.count}
              </span>
            </div>

            <h3 className="text-lg font-semibold text-gray-900 mb-2 group-hover:text-black">
              {module.title}
            </h3>
            <p className="text-gray-600 text-sm mb-4">{module.description}</p>

            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">{module.trendValue}</span>
              <span className="text-gray-400 group-hover:text-black group-hover:translate-x-1 transition-transform">→</span>
            </div>
          </button>
        ))}
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Overview</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">{stats.pendingFeedback}</div>
            <div className="text-xs text-gray-600 mt-1">Pending Feedback</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{stats.fastMovingItems}</div>
            <div className="text-xs text-gray-600 mt-1">Fast Moving</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-orange-600">{stats.slowMovingItems}</div>
            <div className="text-xs text-gray-600 mt-1">Slow Moving</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-red-600">{stats.lowStockAlerts}</div>
            <div className="text-xs text-gray-600 mt-1">Low Stock</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-indigo-600">{stats.pendingNotifications}</div>
            <div className="text-xs text-gray-600 mt-1">Notifications</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-600">{stats.auditLogs}</div>
            <div className="text-xs text-gray-600 mt-1">Audit Logs (30d)</div>
          </div>
        </div>
      </div>
    </div>
  );
}