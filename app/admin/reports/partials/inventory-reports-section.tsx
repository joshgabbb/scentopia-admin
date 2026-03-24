// app/admin/reports/partials/inventory-reports-section.tsx
"use client";

import { useState, useEffect } from "react";
import { Download, Package, AlertTriangle, CheckCircle, XCircle } from "lucide-react";
import ExportModal, { ExportOptions } from "@/components/ExportModal";
import { exportReport, createStockLevelsConfig } from "@/lib/export-utils";

type ReportType = "stock-levels" | "low-stock" | "movement";

interface InventoryData {
  products?: any[];
  movements?: any[];
  summary: {
    totalProducts?: number;
    totalStock?: number;
    lowStockCount?: number;
    outOfStockCount?: number;
    inStockCount?: number;
    totalLowStock?: number;
    criticalCount?: number;
    highPriorityCount?: number;
    threshold?: number;
    totalMovements?: number;
    note?: string;
  };
}

export default function InventoryReportsSection() {
  const [reportType, setReportType] = useState<ReportType>("stock-levels");
  const [threshold, setThreshold] = useState(10);
  const [data, setData] = useState<InventoryData | null>(null);
  const [loading, setLoading] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);

  const fetchReport = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        type: reportType,
        threshold: threshold.toString(),
      });

      const response = await fetch(`/api/admin/reports/inventory-report?${params}`);
      const result = await response.json();

      if (result.success) {
        setData(result.data);
      }
    } catch (error) {
      console.error("Failed to fetch inventory report:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [reportType]);

  useEffect(() => {
    if (reportType !== "stock-levels" && reportType !== "low-stock") return;
    const timer = setTimeout(() => { fetchReport(); }, 600);
    return () => clearTimeout(timer);
  }, [threshold]);

  const handleExport = (options: ExportOptions) => {
    if (!data) return;

    if (reportType === "stock-levels" || reportType === "low-stock") {
      const config = createStockLevelsConfig(data.products || [], reportType);
      exportReport(config, options.format);
    }
    setShowExportModal(false);
  };

  const formatCurrency = (amount: number) => `₱${amount.toLocaleString()}`;

  const getDataRows = () => {
    if (reportType === "movement") return data?.movements || [];
    return data?.products || [];
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case "in stock":
        return "text-green-400 bg-green-500/20";
      case "low stock":
        return "text-orange-400 bg-orange-500/20";
      case "out of stock":
        return "text-red-400 bg-red-500/20";
      default:
        return "text-[#7a6a4a] dark:text-[#9a8a68] bg-[#b8a070]/20";
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority?.toLowerCase()) {
      case "critical":
        return "text-red-400 bg-red-500/20";
      case "high":
        return "text-orange-400 bg-orange-500/20";
      case "medium":
        return "text-yellow-400 bg-yellow-500/20";
      default:
        return "text-[#7a6a4a] dark:text-[#9a8a68] bg-[#b8a070]/20";
    }
  };

  const renderTableHeaders = () => {
    if (reportType === "movement") {
      return (
        <tr className="text-left text-[#7a6a4a] dark:text-[#9a8a68] text-sm">
          <th className="py-3 px-4">Product</th>
          <th className="py-3 px-4">Size</th>
          <th className="py-3 px-4">Type</th>
          <th className="py-3 px-4">Qty</th>
          <th className="py-3 px-4">Before → After</th>
          <th className="py-3 px-4">Reason</th>
          <th className="py-3 px-4">Date</th>
        </tr>
      );
    }
    if (reportType === "low-stock") {
      return (
        <tr className="text-left text-[#7a6a4a] dark:text-[#9a8a68] text-sm">
          <th className="py-3 px-4">Product</th>
          <th className="py-3 px-4">Category</th>
          <th className="py-3 px-4">Type</th>
          <th className="py-3 px-4">Size</th>
          <th className="py-3 px-4">Price</th>
          <th className="py-3 px-4">Stock</th>
          <th className="py-3 px-4">Status</th>
          <th className="py-3 px-4">Priority</th>
        </tr>
      );
    }
    return (
      <tr className="text-left text-[#7a6a4a] dark:text-[#9a8a68] text-sm">
        <th className="py-3 px-4">Product</th>
        <th className="py-3 px-4">Category</th>
        <th className="py-3 px-4">Type</th>
        <th className="py-3 px-4">Sizes</th>
        <th className="py-3 px-4">Price</th>
        <th className="py-3 px-4">Stock</th>
        <th className="py-3 px-4">Status</th>
        <th className="py-3 px-4">Last Updated</th>
      </tr>
    );
  };

  const renderTableRow = (row: any, index: number) => {
    if (reportType === "movement") {
      const isIn = row.type === 'IN';
      return (
        <tr key={index} className="border-t border-[#d4af37]/10 hover:bg-[#faf8f3]/50 dark:hover:bg-white/5">
          <td className="py-3 px-4 text-[#1c1810] dark:text-[#f0e8d8] font-medium">{row.productName}</td>
          <td className="py-3 px-4 text-[#7a6a4a] dark:text-[#9a8a68] text-sm">{row.size}</td>
          <td className="py-3 px-4">
            <span className={`px-2 py-0.5 text-xs font-semibold rounded ${isIn ? 'bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-400' : 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400'}`}>
              {row.type}
            </span>
          </td>
          <td className={`py-3 px-4 font-medium ${isIn ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
            {isIn ? '+' : '-'}{Math.abs(row.change)}
          </td>
          <td className="py-3 px-4 text-[#7a6a4a] dark:text-[#9a8a68] text-sm">
            {row.previousStock} → {row.newStock}
          </td>
          <td className="py-3 px-4 text-[#1c1810] dark:text-[#f0e8d8]">{row.reason}</td>
          <td className="py-3 px-4 text-[#7a6a4a] dark:text-[#9a8a68] text-sm">{row.date}</td>
        </tr>
      );
    }
    if (reportType === "low-stock") {
      return (
        <tr key={index} className="border-t border-[#d4af37]/10 hover:bg-[#faf8f3]/50 dark:hover:bg-white/5">
          <td className="py-3 px-4 text-[#1c1810] dark:text-[#f0e8d8]">{row.name}</td>
          <td className="py-3 px-4 text-[#7a6a4a] dark:text-[#9a8a68]">{row.category}</td>
          <td className="py-3 px-4">
            <span className={`px-2 py-1 text-xs rounded ${row.perfumeType === 'Premium' ? 'bg-purple-500/20 text-purple-400' : 'bg-blue-500/20 text-blue-400'}`}>
              {row.perfumeType}
            </span>
          </td>
          <td className="py-3 px-4 text-[#7a6a4a] dark:text-[#9a8a68] text-sm">{row.size || '—'}</td>
          <td className="py-3 px-4 text-[#d4af37]">{formatCurrency(row.price)}</td>
          <td className="py-3 px-4 text-[#1c1810] dark:text-[#f0e8d8] font-medium">{row.stock}</td>
          <td className="py-3 px-4">
            <span className={`px-2 py-1 text-xs rounded ${getStatusColor(row.status)}`}>
              {row.status}
            </span>
          </td>
          <td className="py-3 px-4">
            <span className={`px-2 py-1 text-xs rounded ${getPriorityColor(row.priority)}`}>
              {row.priority}
            </span>
          </td>
        </tr>
      );
    }
    return (
      <tr key={index} className="border-t border-[#d4af37]/10 hover:bg-[#faf8f3]/50 dark:hover:bg-white/5">
        <td className="py-3 px-4 text-[#1c1810] dark:text-[#f0e8d8]">{row.name}</td>
        <td className="py-3 px-4 text-[#7a6a4a] dark:text-[#9a8a68]">{row.category}</td>
        <td className="py-3 px-4">
          <span className={`px-2 py-1 text-xs rounded ${row.perfumeType === 'Premium' ? 'bg-purple-500/20 text-purple-400' : 'bg-blue-500/20 text-blue-400'}`}>
            {row.perfumeType}
          </span>
        </td>
        <td className="py-3 px-4 text-[#7a6a4a] dark:text-[#9a8a68] text-sm">{row.size || '—'}</td>
        <td className="py-3 px-4 text-[#d4af37]">{formatCurrency(row.price)}</td>
        <td className="py-3 px-4 text-[#1c1810] dark:text-[#f0e8d8] font-medium">{row.stock}</td>
        <td className="py-3 px-4">
          <span className={`px-2 py-1 text-xs rounded ${getStatusColor(row.status)}`}>
            {row.status}
          </span>
        </td>
        <td className="py-3 px-4 text-[#7a6a4a] dark:text-[#9a8a68]">{row.lastUpdated}</td>
      </tr>
    );
  };

  return (
    <div className="space-y-6">

      {/* ── Data Basis Banner ─────────────────────────────────────────── */}
      <div className="border-l-4 border-[#D4AF37] bg-[#fffdf5] dark:bg-[#1c1a14] px-4 py-3 flex flex-col sm:flex-row sm:items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">
          <svg className="w-4 h-4 text-[#8B6914] dark:text-[#D4AF37]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs">
          <div>
            <span className="font-semibold text-[#8B6914] dark:text-[#D4AF37] uppercase tracking-wide">Data Source</span>
            <span className="ml-2 text-[#1c1810] dark:text-[#f0e8d8]">
              <code className="bg-[#f2ede4] dark:bg-[#26231a] px-1 rounded">products</code> table + <code className="bg-[#f2ede4] dark:bg-[#26231a] px-1 rounded">stock_movements</code> table
            </span>
          </div>
          <div>
            <span className="font-semibold text-[#8B6914] dark:text-[#D4AF37] uppercase tracking-wide">Includes</span>
            <span className="ml-2 text-[#1c1810] dark:text-[#f0e8d8]">Active, non-archived products only — stock totalled across all sizes</span>
          </div>
          <div>
            <span className="font-semibold text-[#8B6914] dark:text-[#D4AF37] uppercase tracking-wide">Thresholds</span>
            <span className="ml-2 text-[#1c1810] dark:text-[#f0e8d8]">
              {reportType === "stock-levels"
                ? `Out of Stock = 0 · Low Stock ≤ ${threshold} · In Stock > ${threshold}`
                : reportType === "low-stock"
                ? `Showing products with stock ≤ ${threshold} · Priority: Critical = 0, High ≤ 5, Medium = rest`
                : "Last 200 stock movements — IN and OUT operations"}
            </span>
          </div>
        </div>
      </div>

      {/* Compact Header with Filters */}
      <div className="bg-[#faf8f3] dark:bg-[#1c1a14] border border-[#e8e0d0] dark:border-[#2e2a1e] p-4">
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={reportType}
            onChange={(e) => setReportType(e.target.value as ReportType)}
            className="px-3 py-2 bg-white dark:bg-[#26231a] border border-[#e8e0d0] dark:border-[#2e2a1e] text-[#1c1810] dark:text-[#f0e8d8] focus:outline-none focus:border-[#d4af37] text-sm"
          >
            <option value="stock-levels">Stock Levels</option>
            <option value="low-stock">Low Stock Alert</option>
            <option value="movement">Stock Movement</option>
          </select>
          {(reportType === "low-stock" || reportType === "stock-levels") && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-[#7a6a4a] dark:text-[#9a8a68]">Threshold:</span>
              <input
                type="number"
                min="1"
                value={threshold}
                onChange={(e) => setThreshold(parseInt(e.target.value) || 10)}
                className="w-16 px-2 py-2 bg-white dark:bg-[#26231a] border border-[#e8e0d0] dark:border-[#2e2a1e] text-[#1c1810] dark:text-[#f0e8d8] focus:outline-none focus:border-[#d4af37] text-sm"
              />
            </div>
          )}
          <button
            onClick={fetchReport}
            disabled={loading}
            className="px-3 py-2 bg-[#d4af37] text-[#0a0a0a] font-medium hover:bg-[#d4af37]/90 disabled:opacity-50 text-sm"
          >
            {loading ? "..." : "Refresh"}
          </button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {reportType === "movement" ? (
          <div className="bg-[#faf8f3] dark:bg-[#1c1a14] border border-[#e8e0d0] dark:border-[#2e2a1e] p-3 text-center">
            <p className="text-2xl font-bold text-[#d4af37]">{data?.summary?.totalMovements || 0}</p>
            <p className="text-xs text-[#7a6a4a] dark:text-[#9a8a68] mt-1">Movements</p>
          </div>
        ) : (
          <>
            <div className="bg-[#faf8f3] dark:bg-[#1c1a14] border border-[#e8e0d0] dark:border-[#2e2a1e] p-3 text-center">
              <p className="text-2xl font-bold text-[#d4af37]">{data?.summary?.totalProducts || data?.summary?.totalLowStock || 0}</p>
              <p className="text-xs text-[#7a6a4a] dark:text-[#9a8a68] mt-1">Products</p>
            </div>
            <div className="bg-[#faf8f3] dark:bg-[#1c1a14] border border-[#e8e0d0] dark:border-[#2e2a1e] p-3 text-center">
              <p className="text-2xl font-bold text-green-400">{data?.summary?.inStockCount || 0}</p>
              <p className="text-xs text-[#7a6a4a] dark:text-[#9a8a68] mt-1">In Stock</p>
            </div>
            <div className="bg-[#faf8f3] dark:bg-[#1c1a14] border border-[#e8e0d0] dark:border-[#2e2a1e] p-3 text-center">
              <p className="text-2xl font-bold text-orange-400">{data?.summary?.lowStockCount || data?.summary?.highPriorityCount || 0}</p>
              <p className="text-xs text-[#7a6a4a] dark:text-[#9a8a68] mt-1">Low Stock</p>
            </div>
            <div className="bg-[#faf8f3] dark:bg-[#1c1a14] border border-[#e8e0d0] dark:border-[#2e2a1e] p-3 text-center">
              <p className="text-2xl font-bold text-red-400">{data?.summary?.outOfStockCount || data?.summary?.criticalCount || 0}</p>
              <p className="text-xs text-[#7a6a4a] dark:text-[#9a8a68] mt-1">Out of Stock</p>
            </div>
          </>
        )}
      </div>

      {/* Note for movement report */}
      {reportType === "movement" && data?.summary?.note && (
        <div className="bg-yellow-500/10 border border-yellow-500/20 p-3 text-yellow-400 text-sm">
          {data.summary.note}
        </div>
      )}

      {/* Data Table */}
      <div className="bg-[#faf8f3] dark:bg-[#1c1a14] border border-[#e8e0d0] dark:border-[#2e2a1e]">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#d4af37]/10">
          <p className="text-sm text-[#7a6a4a] dark:text-[#9a8a68]">{getDataRows().length} records</p>
          <button
            onClick={() => setShowExportModal(true)}
            disabled={getDataRows().length === 0 || reportType === "movement"}
            className="flex items-center gap-2 px-3 py-1.5 text-sm bg-[#d4af37] text-[#0a0a0a] font-medium hover:bg-[#d4af37]/90 disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>
        <div className="overflow-x-auto max-h-80 overflow-y-auto">
          <table className="w-full">
            <thead className="bg-white dark:bg-[#26231a] sticky top-0">{renderTableHeaders()}</thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={reportType === "movement" ? 7 : 8} className="py-8 text-center text-[#7a6a4a] dark:text-[#9a8a68]">
                    Loading...
                  </td>
                </tr>
              ) : getDataRows().length === 0 ? (
                <tr>
                  <td colSpan={reportType === "movement" ? 7 : 8} className="py-8 text-center text-[#7a6a4a] dark:text-[#9a8a68]">
                    No data available
                  </td>
                </tr>
              ) : (
                getDataRows().map((row, index) => renderTableRow(row, index))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Export Modal */}
      <ExportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        onExport={handleExport}
        title="Export Inventory Report"
        totalRecords={getDataRows().length}
        showDateRange={false}
      />
    </div>
  );
}
