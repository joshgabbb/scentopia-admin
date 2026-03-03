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

  const handleExport = (options: ExportOptions) => {
    if (!data) return;

    if (reportType === "stock-levels" || reportType === "low-stock") {
      const config = createStockLevelsConfig(data.products || []);
      config.title = reportType === "low-stock" ? "Low Stock Alert Report" : "Stock Levels Report";
      config.filename = reportType === "low-stock" ? "low_stock_report" : "stock_levels_report";
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
      case "medium stock":
        return "text-yellow-400 bg-yellow-500/20";
      case "low stock":
        return "text-orange-400 bg-orange-500/20";
      case "out of stock":
        return "text-red-400 bg-red-500/20";
      default:
        return "text-[#7a6a4a] bg-[#b8a070]/20";
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
        return "text-[#7a6a4a] bg-[#b8a070]/20";
    }
  };

  const renderTableHeaders = () => {
    if (reportType === "movement") {
      return (
        <tr className="text-left text-[#7a6a4a] text-sm">
          <th className="py-3 px-4">Product</th>
          <th className="py-3 px-4">Previous</th>
          <th className="py-3 px-4">New</th>
          <th className="py-3 px-4">Change</th>
          <th className="py-3 px-4">Reason</th>
          <th className="py-3 px-4">Date</th>
        </tr>
      );
    }
    if (reportType === "low-stock") {
      return (
        <tr className="text-left text-[#7a6a4a] text-sm">
          <th className="py-3 px-4">Product</th>
          <th className="py-3 px-4">Category</th>
          <th className="py-3 px-4">Price</th>
          <th className="py-3 px-4">Stock</th>
          <th className="py-3 px-4">Status</th>
          <th className="py-3 px-4">Priority</th>
        </tr>
      );
    }
    return (
      <tr className="text-left text-[#7a6a4a] text-sm">
        <th className="py-3 px-4">Product</th>
        <th className="py-3 px-4">Category</th>
        <th className="py-3 px-4">Price</th>
        <th className="py-3 px-4">Stock</th>
        <th className="py-3 px-4">Status</th>
        <th className="py-3 px-4">Last Updated</th>
      </tr>
    );
  };

  const renderTableRow = (row: any, index: number) => {
    if (reportType === "movement") {
      const changeColor = row.change > 0 ? "text-green-400" : row.change < 0 ? "text-red-400" : "text-[#7a6a4a]";
      return (
        <tr key={index} className="border-t border-[#d4af37]/10 hover:bg-[#faf8f3]/50">
          <td className="py-3 px-4 text-[#1c1810]">{row.productName}</td>
          <td className="py-3 px-4 text-[#7a6a4a]">{row.previousStock}</td>
          <td className="py-3 px-4 text-[#7a6a4a]">{row.newStock}</td>
          <td className={`py-3 px-4 font-medium ${changeColor}`}>
            {row.change > 0 ? `+${row.change}` : row.change}
          </td>
          <td className="py-3 px-4 text-[#1c1810]">{row.reason}</td>
          <td className="py-3 px-4 text-[#7a6a4a]">{row.date}</td>
        </tr>
      );
    }
    if (reportType === "low-stock") {
      return (
        <tr key={index} className="border-t border-[#d4af37]/10 hover:bg-[#faf8f3]/50">
          <td className="py-3 px-4 text-[#1c1810]">{row.name}</td>
          <td className="py-3 px-4 text-[#7a6a4a]">{row.category}</td>
          <td className="py-3 px-4 text-[#d4af37]">{formatCurrency(row.price)}</td>
          <td className="py-3 px-4 text-[#1c1810] font-medium">{row.stock}</td>
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
      <tr key={index} className="border-t border-[#d4af37]/10 hover:bg-[#faf8f3]/50">
        <td className="py-3 px-4 text-[#1c1810]">{row.name}</td>
        <td className="py-3 px-4 text-[#7a6a4a]">{row.category}</td>
        <td className="py-3 px-4 text-[#d4af37]">{formatCurrency(row.price)}</td>
        <td className="py-3 px-4 text-[#1c1810] font-medium">{row.stock}</td>
        <td className="py-3 px-4">
          <span className={`px-2 py-1 text-xs rounded ${getStatusColor(row.status)}`}>
            {row.status}
          </span>
        </td>
        <td className="py-3 px-4 text-[#7a6a4a]">{row.lastUpdated}</td>
      </tr>
    );
  };

  return (
    <div className="space-y-6">
      {/* Compact Header with Filters */}
      <div className="bg-[#faf8f3] border border-[#e8e0d0] p-4">
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={reportType}
            onChange={(e) => setReportType(e.target.value as ReportType)}
            className="px-3 py-2 bg-white border border-[#e8e0d0] text-[#1c1810] focus:outline-none focus:border-[#d4af37] text-sm"
          >
            <option value="stock-levels">Stock Levels</option>
            <option value="low-stock">Low Stock Alert</option>
            <option value="movement">Stock Movement</option>
          </select>
          {reportType === "low-stock" && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-[#7a6a4a]">Threshold:</span>
              <input
                type="number"
                min="1"
                value={threshold}
                onChange={(e) => setThreshold(parseInt(e.target.value) || 10)}
                className="w-16 px-2 py-2 bg-white border border-[#e8e0d0] text-[#1c1810] focus:outline-none focus:border-[#d4af37] text-sm"
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
          <div className="bg-[#faf8f3] border border-[#e8e0d0] p-3 text-center">
            <p className="text-2xl font-bold text-[#d4af37]">{data?.summary?.totalMovements || 0}</p>
            <p className="text-xs text-[#7a6a4a] mt-1">Movements</p>
          </div>
        ) : (
          <>
            <div className="bg-[#faf8f3] border border-[#e8e0d0] p-3 text-center">
              <p className="text-2xl font-bold text-[#d4af37]">{data?.summary?.totalProducts || data?.summary?.totalLowStock || 0}</p>
              <p className="text-xs text-[#7a6a4a] mt-1">Products</p>
            </div>
            <div className="bg-[#faf8f3] border border-[#e8e0d0] p-3 text-center">
              <p className="text-2xl font-bold text-green-400">{data?.summary?.inStockCount || 0}</p>
              <p className="text-xs text-[#7a6a4a] mt-1">In Stock</p>
            </div>
            <div className="bg-[#faf8f3] border border-[#e8e0d0] p-3 text-center">
              <p className="text-2xl font-bold text-orange-400">{data?.summary?.lowStockCount || data?.summary?.highPriorityCount || 0}</p>
              <p className="text-xs text-[#7a6a4a] mt-1">Low Stock</p>
            </div>
            <div className="bg-[#faf8f3] border border-[#e8e0d0] p-3 text-center">
              <p className="text-2xl font-bold text-red-400">{data?.summary?.outOfStockCount || data?.summary?.criticalCount || 0}</p>
              <p className="text-xs text-[#7a6a4a] mt-1">Out of Stock</p>
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
      <div className="bg-[#faf8f3] border border-[#e8e0d0]">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#d4af37]/10">
          <p className="text-sm text-[#7a6a4a]">{getDataRows().length} records</p>
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
            <thead className="bg-white sticky top-0">{renderTableHeaders()}</thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-[#7a6a4a]">
                    Loading...
                  </td>
                </tr>
              ) : getDataRows().length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-[#7a6a4a]">
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
