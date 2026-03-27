// app/admin/products/fast-moving/page.tsx
"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Download, RefreshCw, TrendingUp, Info } from "lucide-react";
import ExportModal, { ExportOptions } from "@/components/ExportModal";
import { exportReport, createInventoryExportConfig } from "@/lib/export-utils";

// ── Types ─────────────────────────────────────────────────────────────────

interface FastMovingProduct {
  productId:    string;
  productName:  string;
  productPrice: number;
  productImage: string | null;
  unitsSold:    number;
  totalRevenue: number;
  orderCount:   number;
  currentStock: number;
  restockStatus: "out" | "critical" | "low" | "ok";
  avgDailySales: number;
  daysRemaining: number | null;
  classification: "very_fast" | "fast";
}

interface Summary {
  fastCount:         number;
  veryFastCount:     number;
  totalUnitsSold:    number;
  totalRevenue:      number;
  needsRestockCount: number;
}

interface Thresholds { fast: number; veryFast: number; }

// ── Helpers ───────────────────────────────────────────────────────────────

const formatCurrency = (n: number) =>
  new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(n);

function RestockBadge({ status }: { status: FastMovingProduct["restockStatus"] }) {
  const styles: Record<string, string> = {
    out:      "bg-red-50 text-red-700 border border-red-200",
    critical: "bg-red-50 text-red-600 border border-red-200",
    low:      "bg-amber-50 text-amber-700 border border-amber-200",
    ok:       "bg-emerald-50 text-emerald-700 border border-emerald-200",
  };
  const labels: Record<string, string> = {
    out:      "Out of Stock",
    critical: "Critical",
    low:      "Low Stock",
    ok:       "In Stock",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}

function ClassificationBadge({ c }: { c: "very_fast" | "fast" }) {
  return c === "very_fast"
    ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-[#D4AF37]/15 text-[#8B6914] border border-[#D4AF37]/30">⚡ Very Fast</span>
    : <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">↑ Fast</span>;
}

// ── Main Page ─────────────────────────────────────────────────────────────

export default function FastMovingPage() {
  const router = useRouter();
  const [products, setProducts]   = useState<FastMovingProduct[]>([]);
  const [summary,  setSummary]    = useState<Summary>({ fastCount: 0, veryFastCount: 0, totalUnitsSold: 0, totalRevenue: 0, needsRestockCount: 0 });
  const [thresholds, setThresholds] = useState<Thresholds>({ fast: 10, veryFast: 30 });
  const [days,     setDays]       = useState(30);
  const [isLoading, setIsLoading] = useState(true);
  const [showExport, setShowExport] = useState(false);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const res    = await fetch(`/api/admin/reports/fast-moving?days=${days}`);
      const result = await res.json();
      if (result.success) {
        setProducts(result.data.products);
        setSummary(result.data.summary);
        setThresholds(result.data.thresholds);
      }
    } catch (err) {
      console.error("Failed to fetch fast-moving items:", err);
    } finally {
      setIsLoading(false);
    }
  }, [days]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleExport = (options: ExportOptions) => {
    const config = createInventoryExportConfig(
      products.map((p) => ({
        name:     p.productName,
        price:    p.productPrice,
        sold:     p.unitsSold,
        revenue:  p.totalRevenue,
        stock:    p.currentStock,
        velocity: p.avgDailySales.toFixed(2),
        daysLeft: p.daysRemaining ?? "N/A",
        status:   p.restockStatus.toUpperCase(),
        type:     p.classification === "very_fast" ? "Very Fast" : "Fast",
      })),
      "fast-moving",
      days
    );
    config.additionalInfo = [
      { label: "Analysis Period",        value: `Last ${days} days` },
      { label: "Classification Rule",    value: `Fast: >=${thresholds.fast} units | Very Fast: >=${thresholds.veryFast} units` },
      { label: "Total Units Sold",       value: summary.totalUnitsSold.toLocaleString() },
      { label: "Total Revenue",          value: `PHP ${summary.totalRevenue.toLocaleString()}` },
      { label: "Items Needing Restock",  value: summary.needsRestockCount.toString() },
    ];
    exportReport(config, options.format);
    setShowExport(false);
  };

  return (
    <>
      <div className="space-y-6">

        {/* Back nav */}
        <button
          onClick={() => router.push("/admin/products")}
          className="inline-flex items-center gap-2 text-sm text-[#7a6a4a] hover:text-[#8B6914] transition-colors font-medium"
        >
          <ChevronLeft className="w-4 h-4" />
          Back to Products
        </button>

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-[#D4AF37]/10 border border-[#D4AF37]/25 rounded-sm flex items-center justify-center">
              <TrendingUp className="w-4.5 h-4.5 text-[#8B6914]" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-[#1c1810]">Fast-Moving Items</h1>
              <p className="text-sm text-[#7a6a4a] mt-0.5">
                {products.length} product{products.length !== 1 ? "s" : ""} selling quickly in the last {days} days
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              className="px-3 py-2 border border-[#e8e0d0] bg-white text-[#1c1810] text-sm rounded-sm focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/40 focus:border-[#D4AF37]"
            >
              <option value="7">Last 7 Days</option>
              <option value="14">Last 14 Days</option>
              <option value="30">Last 30 Days</option>
              <option value="60">Last 60 Days</option>
              <option value="90">Last 90 Days</option>
            </select>
            <button
              onClick={fetchData}
              className="p-2 border border-[#e8e0d0] text-[#7a6a4a] hover:bg-[#faf8f3] hover:text-[#8B6914] hover:border-[#D4AF37]/40 rounded-sm transition-colors"
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4" />
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

        {/* Classification Rule Banner */}
        <div className="flex items-start gap-3 bg-[#faf8f3] border border-[#D4AF37]/30 rounded-sm px-4 py-3">
          <Info className="w-4 h-4 text-[#8B6914] mt-0.5 flex-shrink-0" />
          <p className="text-sm text-[#7a6a4a]">
            <span className="font-semibold text-[#1c1810]">How this works: </span>
            <span className="font-medium text-[#8B6914]">Fast</span> = sold ≥ <strong>{thresholds.fast}</strong> units in the last {days} days.{" "}
            <span className="font-medium text-[#8B6914]">Very Fast</span> = sold ≥ <strong>{thresholds.veryFast}</strong> units.
            Products below these thresholds appear in Slow-Moving.
          </p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Very Fast",        value: summary.veryFastCount,            color: "text-[#8B6914]" },
            { label: "Fast",             value: summary.fastCount,                color: "text-emerald-700" },
            { label: "Units Sold",       value: summary.totalUnitsSold.toLocaleString(), color: "text-[#1c1810]" },
            { label: "Needs Restock",    value: summary.needsRestockCount,        color: "text-red-600" },
          ].map((card) => (
            <div key={card.label} className="bg-white border border-[#e8e0d0] rounded-sm p-4 shadow-sm">
              <div className="text-xs text-[#7a6a4a] uppercase tracking-wider font-medium">{card.label}</div>
              <div className={`text-2xl font-bold mt-2 ${card.color}`}>{card.value}</div>
            </div>
          ))}
        </div>

        {/* Table */}
        <div className="bg-white border border-[#e8e0d0] rounded-sm shadow-sm overflow-x-auto">
          {isLoading ? (
            <div className="py-16 text-center">
              <div className="w-8 h-8 border-2 border-[#D4AF37] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-sm text-[#7a6a4a]">Loading fast-moving items…</p>
            </div>
          ) : products.length === 0 ? (
            <div className="py-16 text-center">
              <TrendingUp className="w-12 h-12 text-[#D4AF37]/40 mx-auto mb-3" />
              <h3 className="text-base font-semibold text-[#1c1810] mb-1">No Fast-Moving Items</h3>
              <p className="text-sm text-[#7a6a4a]">
                No products sold ≥ {thresholds.fast} units in the last {days} days.
                Try a longer period.
              </p>
            </div>
          ) : (
            <table className="w-full min-w-[720px]">
              <thead className="bg-[#faf8f3] border-b border-[#e8e0d0]">
                <tr>
                  {["Product", `Sold (${days}d)`, "Revenue", "Avg / Day", "Stock", "Est. Days Left", "Restock", "Speed"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-bold text-[#7a6a4a] uppercase tracking-wider whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f5f0e8]">
                {products.map((p) => (
                  <tr key={p.productId} className="hover:bg-[#faf8f3] transition-colors">
                    {/* Product */}
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-3">
                        {p.productImage ? (
                          <img src={p.productImage} alt={p.productName} className="w-10 h-10 object-cover rounded-sm border border-[#e8e0d0] flex-shrink-0" />
                        ) : (
                          <div className="w-10 h-10 bg-[#f5f0e8] border border-[#e8e0d0] rounded-sm flex items-center justify-center flex-shrink-0">
                            <span className="text-lg">📦</span>
                          </div>
                        )}
                        <div>
                          <div className="font-semibold text-sm text-[#1c1810]">{p.productName}</div>
                          <div className="text-xs text-[#9a8a6a]">{formatCurrency(p.productPrice)}</div>
                        </div>
                      </div>
                    </td>
                    {/* Sold */}
                    <td className="px-4 py-3.5 font-bold text-[#8B6914] text-sm">{p.unitsSold}</td>
                    {/* Revenue */}
                    <td className="px-4 py-3.5 text-sm text-[#1c1810]">{formatCurrency(p.totalRevenue)}</td>
                    {/* Avg per day */}
                    <td className="px-4 py-3.5 text-sm text-[#7a6a4a]">{p.avgDailySales}</td>
                    {/* Stock */}
                    <td className="px-4 py-3.5">
                      <span className={`font-semibold text-sm ${p.currentStock <= 5 ? "text-red-600" : p.currentStock <= 20 ? "text-amber-600" : "text-[#1c1810]"}`}>
                        {p.currentStock}
                      </span>
                    </td>
                    {/* Days remaining */}
                    <td className="px-4 py-3.5 text-sm">
                      {p.daysRemaining !== null ? (
                        <span className={p.daysRemaining <= 7 ? "font-semibold text-red-600" : p.daysRemaining <= 14 ? "font-semibold text-amber-600" : "text-[#7a6a4a]"}>
                          {p.daysRemaining}d
                        </span>
                      ) : (
                        <span className="text-[#b0a080]">—</span>
                      )}
                    </td>
                    {/* Restock */}
                    <td className="px-4 py-3.5"><RestockBadge status={p.restockStatus} /></td>
                    {/* Classification */}
                    <td className="px-4 py-3.5"><ClassificationBadge c={p.classification} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <ExportModal
        isOpen={showExport}
        onClose={() => setShowExport(false)}
        onExport={handleExport}
        title="Export Fast-Moving Items"
        totalRecords={products.length}
        showDateRange={true}
        currentDays={days}
      />
    </>
  );
}
