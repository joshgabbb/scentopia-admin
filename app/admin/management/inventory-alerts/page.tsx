// app/admin/management/inventory-alerts/page.tsx
"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronLeft, RefreshCw, Download, AlertTriangle, AlertCircle,
  Info, Zap, Package, Bell, CheckCircle,
} from "lucide-react";
import ExportModal, { ExportOptions } from "@/components/ExportModal";
import { exportReport, type ExportConfig } from "@/lib/export-utils";

// ── Types ─────────────────────────────────────────────────────────────────

interface InventoryAlert {
  id:           string;
  productId:    string;
  productName:  string;
  productImage: string | null;
  type:         "out_of_stock" | "critical_stock" | "low_stock" | "fast_moving" | "slow_moving";
  severity:     "critical" | "high" | "medium" | "low";
  message:      string;
  currentStock: number;
  unitsSold30d: number;
  avgDailySales: number;
  daysRemaining: number | null;
}

interface Summary {
  total: number; critical: number; high: number; medium: number; low: number;
  alertTypes: {
    outOfStock: number; criticalStock: number; lowStock: number;
    fastMoving: number; slowMoving: number;
  };
  thresholds: { outOfStock: number; critical: number; low: number; moderate: number; fastMin30d: number };
}

// ── Helpers ───────────────────────────────────────────────────────────────

function SeverityIcon({ severity }: { severity: string }) {
  const cls = "w-5 h-5 flex-shrink-0";
  switch (severity) {
    case "critical": return <AlertCircle   className={`${cls} text-red-500`} />;
    case "high":     return <AlertTriangle className={`${cls} text-orange-500`} />;
    case "medium":   return <Zap           className={`${cls} text-amber-500`} />;
    default:         return <Info          className={`${cls} text-blue-500`} />;
  }
}

function SeverityBadge({ severity }: { severity: string }) {
  const styles: Record<string, string> = {
    critical: "bg-red-50 text-red-700 border border-red-200",
    high:     "bg-orange-50 text-orange-700 border border-orange-200",
    medium:   "bg-amber-50 text-amber-700 border border-amber-200",
    low:      "bg-blue-50 text-blue-700 border border-blue-200",
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold capitalize ${styles[severity] ?? "bg-gray-50 text-gray-600 border border-gray-200"}`}>
      {severity}
    </span>
  );
}

function TypeBadge({ type }: { type: string }) {
  const labels: Record<string, string> = {
    out_of_stock:   "Out of Stock",
    critical_stock: "Critical Stock",
    low_stock:      "Low Stock",
    fast_moving:    "Fast Moving",
    slow_moving:    "Slow Moving",
  };
  return (
    <span className="text-xs px-2 py-0.5 rounded-full bg-[#f2ede4] text-[#7a6a4a] border border-[#e8e0d0] font-medium">
      {labels[type] ?? type}
    </span>
  );
}

function borderColor(severity: string) {
  switch (severity) {
    case "critical": return "border-l-red-500";
    case "high":     return "border-l-orange-500";
    case "medium":   return "border-l-amber-400";
    default:         return "border-l-blue-400";
  }
}

function getRecommendation(alert: InventoryAlert): string {
  if (alert.type === "out_of_stock")   return "Restock immediately — product is unavailable to customers";
  if (alert.type === "critical_stock") return `Restock within the next 1–2 days to avoid stockout`;
  if (alert.type === "low_stock")      return `Reorder soon — stock is below the minimum level (${20} units)`;
  if (alert.type === "fast_moving")    return "Increase inventory — this product is selling quickly";
  if (alert.type === "slow_moving")    return "Consider running a promotion or reducing future orders";
  return "Continue monitoring stock levels";
}

// ── Main Page ─────────────────────────────────────────────────────────────

const EMPTY_SUMMARY: Summary = {
  total: 0, critical: 0, high: 0, medium: 0, low: 0,
  alertTypes: { outOfStock: 0, criticalStock: 0, lowStock: 0, fastMoving: 0, slowMoving: 0 },
  thresholds: { outOfStock: 0, critical: 5, low: 20, moderate: 50, fastMin30d: 10 },
};

export default function InventoryAlertsPage() {
  const router = useRouter();
  const [alerts,      setAlerts]      = useState<InventoryAlert[]>([]);
  const [summary,     setSummary]     = useState<Summary>(EMPTY_SUMMARY);
  const [typeFilter,  setTypeFilter]  = useState("all");
  const [isLoading,   setIsLoading]   = useState(true);
  const [showExport,  setShowExport]  = useState(false);
  const [notifyState, setNotifyState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [notifyMsg,   setNotifyMsg]   = useState("");

  const fetchAlerts = useCallback(async () => {
    setIsLoading(true);
    try {
      const res    = await fetch(`/api/admin/reports/inventory-alerts?filter=${typeFilter}`);
      const result = await res.json();
      if (result.success) {
        setAlerts(result.data.alerts);
        setSummary(result.data.summary);
      }
    } catch (err) {
      console.error("Failed to fetch inventory alerts:", err);
    } finally {
      setIsLoading(false);
    }
  }, [typeFilter]);

  useEffect(() => { fetchAlerts(); }, [fetchAlerts]);

  // Push critical/low-stock alerts into admin_notifications (24 h cooldown)
  const handleNotify = async () => {
    setNotifyState("loading");
    setNotifyMsg("");
    try {
      const res    = await fetch("/api/admin/reports/inventory-alerts", { method: "POST" });
      const result = await res.json();
      if (result.success) {
        setNotifyState("done");
        setNotifyMsg(result.data.message);
        setTimeout(() => setNotifyState("idle"), 5000);
      } else {
        setNotifyState("error");
        setNotifyMsg(result.error ?? "Failed to send notifications");
        setTimeout(() => setNotifyState("idle"), 5000);
      }
    } catch {
      setNotifyState("error");
      setNotifyMsg("Network error — could not send notifications");
      setTimeout(() => setNotifyState("idle"), 5000);
    }
  };

  const handleExport = (options: ExportOptions) => {
    const config: ExportConfig = {
      title:    "Inventory Alerts Report",
      subtitle: "Stock levels and items requiring attention",
      filename: "inventory_alerts_report",
      headers:  ["Product", "Type", "Severity", "Message", "Stock", "Sold (30d)", "Avg/Day", "Days Left"],
      rows: alerts.map((a) => [
        a.productName,
        a.type.replace(/_/g, " ").toUpperCase(),
        a.severity.toUpperCase(),
        a.message,
        a.currentStock,
        a.unitsSold30d,
        a.avgDailySales.toFixed(2),
        a.daysRemaining ?? "N/A",
      ]),
      additionalInfo: [
        { label: "Total Alerts",    value: summary.total.toString() },
        { label: "Critical",        value: summary.critical.toString() },
        { label: "High",            value: summary.high.toString() },
        { label: "Thresholds",      value: `Out=0, Critical≤${summary.thresholds.critical}, Low≤${summary.thresholds.low}` },
      ],
    };
    exportReport(config, options.format);
    setShowExport(false);
  };

  const filterTabs = [
    { key: "all",         label: "All",           count: summary.total },
    { key: "critical",    label: "Critical",       count: summary.alertTypes.outOfStock + summary.alertTypes.criticalStock },
    { key: "low_stock",   label: "Low Stock",      count: summary.alertTypes.lowStock },
    { key: "fast_moving", label: "Fast Moving",    count: summary.alertTypes.fastMoving },
    { key: "slow_moving", label: "Slow Moving",    count: summary.alertTypes.slowMoving },
  ];

  return (
    <>
      <div className="space-y-6">

        {/* Back nav */}
        <button
          onClick={() => router.push("/admin/management")}
          className="inline-flex items-center gap-2 text-sm text-[#7a6a4a] hover:text-[#8B6914] transition-colors font-medium"
        >
          <ChevronLeft className="w-4 h-4" />
          Back to Management
        </button>

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-red-50 border border-red-200 rounded-sm flex items-center justify-center">
              <AlertTriangle className="w-4.5 h-4.5 text-red-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-[#1c1810]">Inventory Alerts</h1>
              <p className="text-sm text-[#7a6a4a] mt-0.5">Stock levels and items needing your attention</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={fetchAlerts}
              className="p-2 border border-[#e8e0d0] text-[#7a6a4a] hover:bg-[#faf8f3] hover:text-[#8B6914] hover:border-[#D4AF37]/40 rounded-sm transition-colors"
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            {/* Notify button — creates admin_notifications for critical/low stock */}
            <button
              onClick={handleNotify}
              disabled={notifyState === "loading"}
              className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-sm transition-colors border ${
                notifyState === "done"
                  ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                  : notifyState === "error"
                  ? "bg-red-50 text-red-700 border-red-300"
                  : "bg-white text-[#7a6a4a] border-[#e8e0d0] hover:bg-[#faf8f3] hover:text-[#8B6914] hover:border-[#D4AF37]/40"
              } disabled:opacity-60`}
              title="Create notification entries for all critical and low-stock products (24 h cooldown per product)"
            >
              {notifyState === "loading" ? (
                <><div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" /> Notifying…</>
              ) : notifyState === "done" ? (
                <><CheckCircle className="w-4 h-4" /> Notified</>
              ) : (
                <><Bell className="w-4 h-4" /> Notify Team</>
              )}
            </button>
            <button
              onClick={() => setShowExport(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#D4AF37] text-[#1c1810] font-semibold text-sm rounded-sm hover:bg-[#C4A030] transition-colors shadow-sm"
            >
              <Download className="w-4 h-4" />
              Export
            </button>
          </div>
        </div>

        {/* Notify feedback */}
        {notifyMsg && (
          <div className={`px-4 py-3 rounded-sm text-sm border ${
            notifyState === "done" || notifyState === "idle"
              ? "bg-emerald-50 text-emerald-800 border-emerald-200"
              : "bg-red-50 text-red-800 border-red-200"
          }`}>
            {notifyMsg}
          </div>
        )}

        {/* Threshold explanation */}
        <div className="flex items-start gap-3 bg-[#faf8f3] border border-[#D4AF37]/30 rounded-sm px-4 py-3">
          <Info className="w-4 h-4 text-[#8B6914] mt-0.5 flex-shrink-0" />
          <p className="text-sm text-[#7a6a4a]">
            <span className="font-semibold text-[#1c1810]">Stock thresholds: </span>
            <span className="text-red-700 font-medium">Out of Stock</span> = 0 units.{" "}
            <span className="text-red-600 font-medium">Critical</span> = 1–{summary.thresholds.critical} units.{" "}
            <span className="text-orange-700 font-medium">Low Stock</span> = 6–{summary.thresholds.low} units.{" "}
            <span className="text-amber-700 font-medium">Fast Moving</span> = sold ≥{summary.thresholds.fastMin30d} units in 30 days with stock ≤{summary.thresholds.moderate}.
          </p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          <div className="bg-white border border-[#e8e0d0] rounded-sm shadow-sm p-4">
            <div className="text-xs text-[#7a6a4a] uppercase tracking-wider font-medium">Total Alerts</div>
            <div className="text-2xl font-bold text-[#1c1810] mt-2">{summary.total}</div>
          </div>
          <div className="bg-red-50 border border-red-200 rounded-sm shadow-sm p-4">
            <div className="text-xs text-red-600 uppercase tracking-wider font-medium">Critical</div>
            <div className="text-2xl font-bold text-red-700 mt-2">{summary.critical}</div>
          </div>
          <div className="bg-orange-50 border border-orange-200 rounded-sm shadow-sm p-4">
            <div className="text-xs text-orange-600 uppercase tracking-wider font-medium">High</div>
            <div className="text-2xl font-bold text-orange-700 mt-2">{summary.high}</div>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-sm shadow-sm p-4">
            <div className="text-xs text-amber-600 uppercase tracking-wider font-medium">Medium</div>
            <div className="text-2xl font-bold text-amber-700 mt-2">{summary.medium}</div>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-sm shadow-sm p-4">
            <div className="text-xs text-blue-600 uppercase tracking-wider font-medium">Low</div>
            <div className="text-2xl font-bold text-blue-700 mt-2">{summary.low}</div>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex flex-wrap gap-2">
          {filterTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setTypeFilter(tab.key)}
              className={`px-4 py-2 text-sm font-medium rounded-sm border transition-all ${
                typeFilter === tab.key
                  ? "bg-[#D4AF37] text-[#1c1810] border-[#D4AF37] shadow-sm"
                  : "bg-white text-[#7a6a4a] border-[#e8e0d0] hover:bg-[#faf8f3] hover:text-[#1c1810] hover:border-[#D4AF37]/30"
              }`}
            >
              {tab.label}
              <span className={`ml-1.5 text-xs ${typeFilter === tab.key ? "text-[#1c1810]/70" : "text-[#9a8a6a]"}`}>
                ({tab.count})
              </span>
            </button>
          ))}
        </div>

        {/* Alerts List */}
        {isLoading ? (
          <div className="py-16 text-center">
            <div className="w-8 h-8 border-2 border-[#D4AF37] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm text-[#7a6a4a]">Loading inventory alerts…</p>
          </div>
        ) : alerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 bg-white border border-[#e8e0d0] rounded-sm shadow-sm">
            <div className="w-16 h-16 rounded-sm bg-[#f2ede4] flex items-center justify-center mb-4">
              <Package className="w-8 h-8 text-[#D4AF37]" />
            </div>
            <h3 className="text-base font-semibold text-[#1c1810] mb-1">All Clear</h3>
            <p className="text-sm text-[#7a6a4a]">No inventory alerts for the current filter</p>
          </div>
        ) : (
          <div className="space-y-3">
            {alerts.map((alert) => (
              <div
                key={alert.id}
                className={`bg-white border border-[#e8e0d0] border-l-4 ${borderColor(alert.severity)} rounded-sm shadow-sm p-5 hover:shadow-md transition-shadow`}
              >
                <div className="flex items-start gap-4">
                  <div className="mt-0.5">
                    <SeverityIcon severity={alert.severity} />
                  </div>

                  <div className="flex-1 min-w-0">
                    {/* Header row */}
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold text-[#1c1810] text-base leading-tight">{alert.productName}</h3>
                        <SeverityBadge severity={alert.severity} />
                        <TypeBadge type={alert.type} />
                      </div>
                      {alert.productImage && (
                        <img
                          src={alert.productImage}
                          alt={alert.productName}
                          className="w-12 h-12 object-cover rounded-sm border border-[#e8e0d0] flex-shrink-0"
                          onError={(e) => { e.currentTarget.style.display = "none"; }}
                        />
                      )}
                    </div>

                    {/* Stats row — plain language, no "velocity" */}
                    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mb-3">
                      <div>
                        <div className="text-xs text-[#9a8a6a] uppercase tracking-wider">Current Stock</div>
                        <div className="font-semibold text-[#1c1810] text-sm mt-0.5">{alert.currentStock} units</div>
                      </div>
                      <div>
                        <div className="text-xs text-[#9a8a6a] uppercase tracking-wider">Sold (30 days)</div>
                        <div className="font-semibold text-[#1c1810] text-sm mt-0.5">{alert.unitsSold30d} units</div>
                      </div>
                      <div>
                        <div className="text-xs text-[#9a8a6a] uppercase tracking-wider">Avg per Day</div>
                        <div className="font-semibold text-[#1c1810] text-sm mt-0.5">{alert.avgDailySales}</div>
                      </div>
                      {alert.daysRemaining !== null && (
                        <div>
                          <div className="text-xs text-[#9a8a6a] uppercase tracking-wider">Est. Days Left</div>
                          <div className={`font-semibold text-sm mt-0.5 ${alert.daysRemaining <= 7 ? "text-red-600" : "text-[#1c1810]"}`}>
                            {alert.daysRemaining} days
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Alert message */}
                    <div className="bg-[#faf8f3] border border-[#e8e0d0] rounded-sm px-3 py-2 mb-3">
                      <div className="text-xs text-[#9a8a6a] uppercase tracking-wider mb-1">Alert</div>
                      <div className="text-sm text-[#1c1810]">{alert.message}</div>
                    </div>

                    {/* Recommendation */}
                    <div className="text-sm text-[#7a6a4a]">
                      <span className="font-medium text-[#8B6914]">Recommendation: </span>
                      {getRecommendation(alert)}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <ExportModal
        isOpen={showExport}
        onClose={() => setShowExport(false)}
        onExport={handleExport}
        title="Export Inventory Alerts"
        totalRecords={summary.total}
        filteredRecords={alerts.length}
        showDateRange={false}
      />
    </>
  );
}
