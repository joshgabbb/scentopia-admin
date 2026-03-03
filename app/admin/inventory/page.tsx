"use client";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDownToLine, ArrowUpFromLine, ClipboardList, TrendingUp, TrendingDown, Activity } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";

interface TodayStats {
  inCount: number;
  outCount: number;
  totalMovements: number;
}

async function fetchTodayStats(): Promise<TodayStats> {
  const today = new Date().toISOString().split("T")[0];
  const [inRes, outRes] = await Promise.all([
    fetch(`/api/admin/stock/history?type=IN&dateFrom=${today}&dateTo=${today}&page=1`),
    fetch(`/api/admin/stock/history?type=OUT&dateFrom=${today}&dateTo=${today}&page=1`),
  ]);
  const [inData, outData] = await Promise.all([inRes.json(), outRes.json()]);
  const inCount = inData.success ? inData.data.totalCount : 0;
  const outCount = outData.success ? outData.data.totalCount : 0;
  return { inCount, outCount, totalMovements: inCount + outCount };
}

const modules = [
  {
    id: "stock-in",
    label: "Stock In",
    description: "Record incoming stock. Add units to product inventory by size.",
    icon: ArrowDownToLine,
    iconColor: "text-green-600",
    borderColor: "border-green-200",
    bgColor: "bg-green-50",
    buttonClass: "bg-green-600 hover:bg-green-700 text-white",
  },
  {
    id: "stock-out",
    label: "Stock Out",
    description: "Record outgoing stock. Remove units due to sale, damage, or adjustment.",
    icon: ArrowUpFromLine,
    iconColor: "text-red-500",
    borderColor: "border-red-200",
    bgColor: "bg-red-50",
    buttonClass: "bg-red-500 hover:bg-red-600 text-white",
  },
  {
    id: "stock-history",
    label: "Stock History",
    description: "View the full audit log of all stock movements with filters and CSV export.",
    icon: ClipboardList,
    iconColor: "text-[#8B6914]",
    borderColor: "border-[#d4af37]/30",
    bgColor: "bg-[#d4af37]/10",
    buttonClass: "bg-[#d4af37] hover:bg-[#d4af37]/90 text-[#0a0a0a]",
  },
];

export default function InventoryPage() {
  const router = useRouter();
  const { themeClasses } = useTheme();
  const [stats, setStats] = useState<TodayStats | null>(null);

  useEffect(() => {
    fetchTodayStats().then(setStats).catch(console.error);
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className={`text-2xl font-semibold ${themeClasses.accent} tracking-wide`}>Inventory Management</h1>
        <p className={`text-sm ${themeClasses.textMuted} mt-1`}>
          Manage stock levels, record movements, and view the full audit trail.
        </p>
      </div>

      {/* Today's Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white border border-[#e8e0d0] rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Activity className="w-4 h-4 text-[#d4af37]" />
            <span className="text-xs font-semibold text-[#7a6a4a] uppercase tracking-wide">Today's Total</span>
          </div>
          <p className="text-2xl font-bold text-[#1c1810]">
            {stats === null ? "—" : stats.totalMovements}
          </p>
          <p className="text-xs text-[#7a6a4a] mt-1">movements recorded</p>
        </div>
        <div className="bg-white border border-[#e8e0d0] rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-green-600" />
            <span className="text-xs font-semibold text-[#7a6a4a] uppercase tracking-wide">Stock In</span>
          </div>
          <p className="text-2xl font-bold text-green-600">
            {stats === null ? "—" : stats.inCount}
          </p>
          <p className="text-xs text-[#7a6a4a] mt-1">additions today</p>
        </div>
        <div className="bg-white border border-[#e8e0d0] rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingDown className="w-4 h-4 text-red-500" />
            <span className="text-xs font-semibold text-[#7a6a4a] uppercase tracking-wide">Stock Out</span>
          </div>
          <p className="text-2xl font-bold text-red-500">
            {stats === null ? "—" : stats.outCount}
          </p>
          <p className="text-xs text-[#7a6a4a] mt-1">removals today</p>
        </div>
      </div>

      {/* Module Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {modules.map(mod => {
          const Icon = mod.icon;
          return (
            <div
              key={mod.id}
              className="bg-white border border-[#e8e0d0] rounded-lg p-6 flex flex-col gap-5 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => router.push(`/admin/inventory/${mod.id}`)}
            >
              <div className={`w-12 h-12 ${mod.bgColor} ${mod.borderColor} border rounded-lg flex items-center justify-center`}>
                <Icon className={`w-6 h-6 ${mod.iconColor}`} />
              </div>

              <div className="flex-1">
                <h2 className={`text-lg font-semibold ${themeClasses.text} mb-1`}>{mod.label}</h2>
                <p className={`text-sm ${themeClasses.textMuted} leading-relaxed`}>{mod.description}</p>
              </div>

              <button
                onClick={e => { e.stopPropagation(); router.push(`/admin/inventory/${mod.id}`); }}
                className={`w-full py-2.5 px-4 ${mod.buttonClass} text-sm font-semibold rounded-lg transition-colors`}
              >
                Go to {mod.label} →
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
