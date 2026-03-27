// app/admin/products/slow-moving/page.tsx
"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Download, RefreshCw, TrendingDown, Info } from "lucide-react";
import ExportModal, { ExportOptions } from "@/components/ExportModal";
import { exportReport, type ExportConfig } from "@/lib/export-utils";

// ── Types ─────────────────────────────────────────────────────────────────

interface SlowMovingProduct {
  productId:      string;
  productName:    string;
  productPrice:   number;
  productImage:   string | null;
  unitsSold:      number;
  currentStock:   number;
  stockValue:     number;
  productAgeDays: number;
  status:         "no_sales" | "very_slow" | "slow" | "moderate";
  recommendation: string;
}

interface Summary {
  noSalesCount:    number;
  verySlowCount:   number;
  slowCount:       number;
  moderateCount:   number;
  totalStockValue: number;
}

interface Thresholds { verySlowMax: number; slowMax: number; fastMin: number; }

// ── Helpers ───────────────────────────────────────────────────────────────

const formatCurrency = (n: number) =>
  new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(n);

const STATUS_STYLES: Record<string, string> = {
  no_sales:  "bg-red-50 text-red-700 border border-red-200",
  very_slow: "bg-orange-50 text-orange-700 border border-orange-200",
  slow:      "bg-amber-50 text-amber-700 border border-amber-200",
  moderate:  "bg-blue-50 text-blue-700 border border-blue-200",
};

const STATUS_LABELS: Record<string, string> = {
  no_sales:  "No Sales",
  very_slow: "Very Slow",
  slow:      "Slow",
  moderate:  "Moderate",
};

const RECOMMENDATION_ICONS: Record<string, string> = {
  "Review product viability — consider promotions or discontinuing": "🛑",
  "Run a promotion or reduce future purchase orders":                "📉",
  "Consider a discount or bundling with a faster product":           "📢",
  "Monitor sales trend — no action needed yet":                      "👁️",
};

// ── Main Page ─────────────────────────────────────────────────────────────

export default function SlowMovingPage() {
  const router = useRouter();
  const [products, setProducts]     = useState<SlowMovingProduct[]>([]);
  const [summary,  setSummary]      = useState<Summary>({ noSalesCount: 0, verySlowCount: 0, slowCount: 0, moderateCount: 0, totalStockValue: 0 });
  const [thresholds, setThresholds] = useState<Thresholds>({ verySlowMax: 5, slowMax: 9, fastMin: 10 });
  const [days,     setDays]         = useState(30);
  const [isLoading, setIsLoading]   = useState(true);
  const [showExport, setShowExport] = useState(false);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const res    = await fetch(`/api/admin/reports/slow-moving?days=${days}`);
      const result = await res.json();
      if (result.success) {
        setProducts(result.data.products);
        setSummary(result.data.summary);
        setThresholds(result.data.thresholds);
      }
    } catch (err) {
      console.error("Failed to fetch slow-moving items:", err);
    } finally {
      setIsLoading(false);
    }
  }, [days]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleExport = (options: ExportOptions) => {
    const exportFmt = (n: number) => `PHP ${n.toLocaleString()}`;
    const config: ExportConfig = {
      title:    "Slow-Moving Items Report",
      subtitle: `Products requiring attention — last ${days} days`,
      filename: "slow_moving_report",
      headers:  ["Product", "Price", "Units Sold", "Stock", "Stock Value", "Age (Days)", "Status", "Recommendation"],
      rows: products.map((p) => [
        p.productName,
        exportFmt(p.productPrice),
        p.unitsSold,
        p.currentStock,
        exportFmt(p.stockValue),
        p.productAgeDays,
        STATUS_LABELS[p.status] ?? p.status,
        p.recommendation,
      ]),
      additionalInfo: [
        { label: "Analysis Period",     value: `Last ${days} days` },
        { label: "Classification Rule", value: `Very Slow = 1-${thresholds.verySlowMax} units | Slow = ${thresholds.verySlowMax + 1}-${thresholds.slowMax} units` },
        { label: "No Sales Items",      value: summary.noSalesCount.toString() },
        { label: "Very Slow Items",     value: summary.verySlowCount.toString() },
        { label: "Slow Items",          value: summary.slowCount.toString() },
        { label: "Stock Value at Risk", value: exportFmt(summary.totalStockValue) },
      ],
    };
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
            <div className="w-9 h-9 bg-orange-50 border border-orange-200 rounded-sm flex items-center justify-center">
              <TrendingDown className="w-4.5 h-4.5 text-orange-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-[#1c1810]">Slow-Moving Items</h1>
              <p className="text-sm text-[#7a6a4a] mt-0.5">
                {products.length} product{products.length !== 1 ? "s" : ""} with low or no sales in the last {days} days
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              className="px-3 py-2 border border-[#e8e0d0] bg-white text-[#1c1810] text-sm rounded-sm focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/40 focus:border-[#D4AF37]"
            >
              <option value="30">Last 30 Days</option>
              <option value="60">Last 60 Days</option>
              <option value="90">Last 90 Days</option>
              <option value="120">Last 120 Days</option>
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
            Products sold fewer than <strong>{thresholds.fastMin}</strong> units in the last {days} days are shown here.{" "}
            <span className="font-medium text-red-700">No Sales</span> = 0 units.{" "}
            <span className="font-medium text-orange-700">Very Slow</span> = 1–{thresholds.verySlowMax} units.{" "}
            <span className="font-medium text-amber-700">Slow</span> = {thresholds.verySlowMax + 1}–{thresholds.slowMax} units.
          </p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-red-50 border border-red-200 rounded-sm p-4 shadow-sm">
            <div className="text-xs text-red-600 uppercase tracking-wider font-medium">No Sales</div>
            <div className="text-2xl font-bold text-red-700 mt-2">{summary.noSalesCount}</div>
          </div>
          <div className="bg-orange-50 border border-orange-200 rounded-sm p-4 shadow-sm">
            <div className="text-xs text-orange-600 uppercase tracking-wider font-medium">Very Slow</div>
            <div className="text-2xl font-bold text-orange-700 mt-2">{summary.verySlowCount}</div>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-sm p-4 shadow-sm">
            <div className="text-xs text-amber-600 uppercase tracking-wider font-medium">Slow</div>
            <div className="text-2xl font-bold text-amber-700 mt-2">{summary.slowCount}</div>
          </div>
          <div className="bg-white border border-[#e8e0d0] rounded-sm p-4 shadow-sm">
            <div className="text-xs text-[#7a6a4a] uppercase tracking-wider font-medium">Stock Value at Risk</div>
            <div className="text-xl font-bold text-[#8B6914] mt-2">{formatCurrency(summary.totalStockValue)}</div>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white border border-[#e8e0d0] rounded-sm shadow-sm overflow-x-auto">
          {isLoading ? (
            <div className="py-16 text-center">
              <div className="w-8 h-8 border-2 border-[#D4AF37] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-sm text-[#7a6a4a]">Loading slow-moving items…</p>
            </div>
          ) : products.length === 0 ? (
            <div className="py-16 text-center">
              <TrendingDown className="w-12 h-12 text-emerald-400/50 mx-auto mb-3" />
              <h3 className="text-base font-semibold text-[#1c1810] mb-1">All Products Moving Well!</h3>
              <p className="text-sm text-[#7a6a4a]">
                Every product sold ≥ {thresholds.fastMin} units in the last {days} days.
              </p>
            </div>
          ) : (
            <table className="w-full min-w-[760px]">
              <thead className="bg-[#faf8f3] border-b border-[#e8e0d0]">
                <tr>
                  {["Product", `Sold (${days}d)`, "Stock", "Stock Value", "Age", "Status", "Recommendation"].map((h) => (
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
                    <td className="px-4 py-3.5">
                      {p.unitsSold === 0
                        ? <span className="font-bold text-red-600 text-sm">0</span>
                        : <span className="font-semibold text-sm text-[#1c1810]">{p.unitsSold}</span>
                      }
                    </td>
                    {/* Stock */}
                    <td className="px-4 py-3.5 font-semibold text-sm text-[#1c1810]">{p.currentStock}</td>
                    {/* Stock Value */}
                    <td className="px-4 py-3.5 text-sm text-[#7a6a4a]">{formatCurrency(p.stockValue)}</td>
                    {/* Age */}
                    <td className="px-4 py-3.5 text-sm text-[#9a8a6a]">{p.productAgeDays}d</td>
                    {/* Status badge */}
                    <td className="px-4 py-3.5">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_STYLES[p.status]}`}>
                        {STATUS_LABELS[p.status]}
                      </span>
                    </td>
                    {/* Recommendation */}
                    <td className="px-4 py-3.5">
                      <div className="flex items-start gap-1.5">
                        <span className="text-base leading-none mt-0.5">{RECOMMENDATION_ICONS[p.recommendation] ?? "📋"}</span>
                        <span className="text-xs text-[#7a6a4a] leading-snug">{p.recommendation}</span>
                      </div>
                    </td>
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
        title="Export Slow-Moving Items"
        totalRecords={products.length}
        showDateRange={true}
        currentDays={days}
      />
    </>
  );
}
