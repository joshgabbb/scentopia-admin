// app/admin/reports/partials/combined-reports-section.tsx
"use client";

import { useState, useEffect, useMemo } from "react";
import { Download } from "lucide-react";
import ExportModal, { ExportOptions } from "@/components/ExportModal";
import { exportReport } from "@/lib/export-utils";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
} from "recharts";

type ReportType = "daily" | "weekly" | "monthly" | "by-product";
type ViewMode = "chart" | "table" | "both";

interface CombinedData {
  sales?: any[];
  products?: any[];
  summary: {
    totalRevenue?: number;
    totalOrders?: number;
    averageOrderValue?: number;
    periods?: number;
    appOrders?: number;
    storeOrders?: number;
    totalUnitsSold?: number;
    productCount?: number;
  };
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[#faf8f3] border border-[#d4af37]/40 p-3 rounded shadow-lg">
        <p className="text-[#d4af37] font-medium mb-1">{label}</p>
        {payload.map((entry: any, index: number) => (
          <p key={index} className="text-sm" style={{ color: entry.color }}>
            {entry.name}:{" "}
            {entry.name.includes("Revenue") || entry.name.includes("Value")
              ? `₱${Number(entry.value).toLocaleString()}`
              : entry.value.toLocaleString()}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export default function CombinedReportsSection() {
  const [reportType, setReportType] = useState<ReportType>("daily");
  const [viewMode, setViewMode] = useState<ViewMode>("both");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [data, setData] = useState<CombinedData | null>(null);
  const [loading, setLoading] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);

  const fetchReport = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ type: reportType });
      if (dateFrom) params.append("from", dateFrom);
      if (dateTo) params.append("to", dateTo);

      const response = await fetch(`/api/admin/reports/combined?${params}`);
      const result = await response.json();
      if (result.success) setData(result.data);
    } catch (error) {
      console.error("Failed to fetch combined report:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [reportType]);

  const formatCurrency = (amount: number) => `₱${amount.toLocaleString()}`;
  const formatShortCurrency = (amount: number) => {
    if (amount >= 1000000) return `₱${(amount / 1000000).toFixed(1)}M`;
    if (amount >= 1000) return `₱${(amount / 1000).toFixed(1)}K`;
    return `₱${amount}`;
  };

  const getDataRows = () => {
    if (reportType === "by-product") return data?.products || [];
    return data?.sales || [];
  };

  const chartData = useMemo(() => {
    const rows = getDataRows();
    if (reportType === "by-product") {
      return rows.slice(0, 10).map((item: any) => ({
        name: item.name.length > 20 ? item.name.substring(0, 20) + "..." : item.name,
        fullName: item.name,
        revenue: item.revenue || 0,
        appQty: item.appQty || 0,
        storeQty: item.storeQty || 0,
      }));
    }
    return [...rows].reverse().map((item: any) => ({
      name: item.period,
      revenue: item.revenue || 0,
      appOrders: item.appOrders || 0,
      storeOrders: item.storeOrders || 0,
      itemsSold: item.itemsSold || 0,
    }));
  }, [data, reportType]);

  const handleExport = (options: ExportOptions) => {
    if (!data) return;
    const dateRange =
      options.dateRange || (dateFrom && dateTo ? { from: dateFrom, to: dateTo } : undefined);
    const rows = getDataRows();

    let config;
    if (reportType === "by-product") {
      config = {
        title: "Combined Sales — By Product",
        subtitle: "App + Physical Store product sales",
        filename: "combined_by_product",
        headers: ["Product", "App Units", "Store Units", "Total Units", "Revenue"],
        rows: rows.map((p: any) => [
          p.name,
          p.appQty || 0,
          p.storeQty || 0,
          p.quantitySold,
          formatCurrency(p.revenue),
        ]),
        dateRange,
        additionalInfo: [
          { label: "Total Revenue", value: formatCurrency(data.summary.totalRevenue || 0) },
          { label: "Total Units Sold", value: String(data.summary.totalUnitsSold || 0) },
          { label: "Products", value: String(data.summary.productCount || 0) },
        ],
      };
    } else {
      config = {
        title: `Combined Sales Report — ${reportType.charAt(0).toUpperCase() + reportType.slice(1)}`,
        subtitle: "Mobile App + Physical Store (POS)",
        filename: `combined_sales_${reportType}`,
        headers: ["Period", "Total", "App Orders", "Store Tx", "Revenue", "Avg Value", "Items Sold"],
        rows: rows.map((s: any) => [
          s.period,
          s.orderCount,
          s.appOrders || 0,
          s.storeOrders || 0,
          formatCurrency(s.revenue),
          formatCurrency(s.averageOrderValue),
          s.itemsSold,
        ]),
        dateRange,
        additionalInfo: [
          { label: "Total Revenue", value: formatCurrency(data.summary.totalRevenue || 0) },
          { label: "Total Transactions", value: String(data.summary.totalOrders || 0) },
          { label: "App Orders", value: String(data.summary.appOrders || 0) },
          { label: "Store Transactions", value: String(data.summary.storeOrders || 0) },
        ],
      };
    }

    exportReport(config, options.format);
    setShowExportModal(false);
  };

  const renderCharts = () => {
    if (loading || chartData.length === 0) {
      return (
        <div className="bg-[#faf8f3] border border-[#e8e0d0] p-8 flex items-center justify-center h-64">
          <p className="text-[#7a6a4a]">{loading ? "Loading..." : "No data available"}</p>
        </div>
      );
    }

    if (reportType === "by-product") {
      return (
        <div className="bg-[#faf8f3] border border-[#e8e0d0] p-4">
          <h3 className="text-sm font-medium text-[#7a6a4a] mb-4">Top 10 Products — App vs Store Units Sold</h3>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={chartData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis type="number" stroke="#b8a070" fontSize={11} />
              <YAxis dataKey="name" type="category" width={140} stroke="#b8a070" fontSize={10} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ color: "#1c1810", fontSize: 12 }} />
              <Bar dataKey="appQty" name="App Units" fill="#d4af37" radius={[0, 0, 0, 0]} stackId="a" />
              <Bar dataKey="storeQty" name="Store Units" fill="#4B5563" radius={[0, 4, 4, 0]} stackId="a" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      );
    }

    return (
      <div className="bg-[#faf8f3] border border-[#e8e0d0] p-4">
        <h3 className="text-sm font-medium text-[#7a6a4a] mb-4">Combined Revenue Trend — App vs Store</h3>
        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart data={chartData}>
            <defs>
              <linearGradient id="combinedRevenueGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#d4af37" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#d4af37" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#333" />
            <XAxis dataKey="name" stroke="#b8a070" fontSize={10} angle={-45} textAnchor="end" height={60} />
            <YAxis yAxisId="left" stroke="#d4af37" fontSize={11} tickFormatter={formatShortCurrency} />
            <YAxis yAxisId="right" orientation="right" stroke="#b8a070" fontSize={11} />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ color: "#1c1810", fontSize: 12 }} />
            <Area yAxisId="left" type="monotone" dataKey="revenue" name="Total Revenue" stroke="#d4af37" strokeWidth={2} fill="url(#combinedRevenueGradient)" />
            <Line yAxisId="right" type="monotone" dataKey="appOrders" name="App Orders" stroke="#4B5563" strokeWidth={2} dot={{ fill: "#4B5563", r: 3 }} />
            <Line yAxisId="right" type="monotone" dataKey="storeOrders" name="Store Tx" stroke="#b8a070" strokeWidth={2} strokeDasharray="4 2" dot={{ fill: "#b8a070", r: 3 }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    );
  };

  const renderTableHeaders = () => {
    if (reportType === "by-product") {
      return (
        <tr className="text-left text-[#7a6a4a] text-sm">
          <th className="py-3 px-4">Product</th>
          <th className="py-3 px-4">App Units</th>
          <th className="py-3 px-4">Store Units</th>
          <th className="py-3 px-4">Total Units</th>
          <th className="py-3 px-4">Revenue</th>
        </tr>
      );
    }
    return (
      <tr className="text-left text-[#7a6a4a] text-sm">
        <th className="py-3 px-4">Period</th>
        <th className="py-3 px-4">Total</th>
        <th className="py-3 px-4">App Orders</th>
        <th className="py-3 px-4">Store Tx</th>
        <th className="py-3 px-4">Revenue</th>
        <th className="py-3 px-4">Avg Value</th>
        <th className="py-3 px-4">Items Sold</th>
      </tr>
    );
  };

  const renderTableRow = (row: any, index: number) => {
    if (reportType === "by-product") {
      return (
        <tr key={index} className="border-t border-[#d4af37]/10 hover:bg-[#d4af37]/5">
          <td className="py-3 px-4 text-[#1c1810]">{row.name}</td>
          <td className="py-3 px-4 text-[#1c1810]">{row.appQty || 0}</td>
          <td className="py-3 px-4 text-[#1c1810]">{row.storeQty || 0}</td>
          <td className="py-3 px-4 text-[#1c1810] font-medium">{row.quantitySold}</td>
          <td className="py-3 px-4 text-[#d4af37] font-medium">{formatCurrency(row.revenue)}</td>
        </tr>
      );
    }
    return (
      <tr key={index} className="border-t border-[#d4af37]/10 hover:bg-[#d4af37]/5">
        <td className="py-3 px-4 text-[#1c1810]">{row.period}</td>
        <td className="py-3 px-4 text-[#1c1810] font-medium">{row.orderCount}</td>
        <td className="py-3 px-4 text-[#1c1810]">{row.appOrders || 0}</td>
        <td className="py-3 px-4 text-[#1c1810]">{row.storeOrders || 0}</td>
        <td className="py-3 px-4 text-[#d4af37] font-medium">{formatCurrency(row.revenue)}</td>
        <td className="py-3 px-4 text-[#1c1810]">{formatCurrency(row.averageOrderValue)}</td>
        <td className="py-3 px-4 text-[#1c1810]">{row.itemsSold}</td>
      </tr>
    );
  };

  return (
    <div className="space-y-6">

      {/* Data Basis Banner */}
      <div className="border-l-4 border-[#D4AF37] bg-[#fffdf5] dark:bg-[#1c1a14] px-4 py-3 flex flex-col sm:flex-row sm:items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">
          <svg className="w-4 h-4 text-[#8B6914] dark:text-[#D4AF37]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs">
          <div>
            <span className="font-semibold text-[#8B6914] dark:text-[#D4AF37] uppercase tracking-wide">App Source</span>
            <span className="ml-2 text-[#1c1810] dark:text-[#f0e8d8]">
              <code className="bg-[#f2ede4] dark:bg-[#26231a] px-1 rounded">orders</code> + <code className="bg-[#f2ede4] dark:bg-[#26231a] px-1 rounded">order_items</code> — non-Cancelled
            </span>
          </div>
          <div>
            <span className="font-semibold text-[#8B6914] dark:text-[#D4AF37] uppercase tracking-wide">Store Source</span>
            <span className="ml-2 text-[#1c1810] dark:text-[#f0e8d8]">
              <code className="bg-[#f2ede4] dark:bg-[#26231a] px-1 rounded">pos_transactions</code> + <code className="bg-[#f2ede4] dark:bg-[#26231a] px-1 rounded">pos_transaction_items</code>
            </span>
          </div>
          <div>
            <span className="font-semibold text-[#8B6914] dark:text-[#D4AF37] uppercase tracking-wide">Calculation</span>
            <span className="ml-2 text-[#1c1810] dark:text-[#f0e8d8]">Revenue = app order amounts + POS transaction amounts, merged by period — no double counting</span>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-[#faf8f3] border border-[#e8e0d0] p-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={reportType}
              onChange={(e) => setReportType(e.target.value as ReportType)}
              className="px-3 py-2 bg-white border border-[#e8e0d0] text-[#1c1810] focus:outline-none focus:border-[#d4af37] text-sm"
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="by-product">By Product</option>
            </select>
            <div className="flex items-center gap-2">
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
                className="px-2 py-2 bg-white border border-[#e8e0d0] text-[#1c1810] focus:outline-none focus:border-[#d4af37] text-sm" />
              <span className="text-[#7a6a4a]">to</span>
              <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
                className="px-2 py-2 bg-white border border-[#e8e0d0] text-[#1c1810] focus:outline-none focus:border-[#d4af37] text-sm" />
            </div>
            <button onClick={fetchReport} disabled={loading}
              className="px-3 py-2 bg-[#d4af37] text-[#0a0a0a] font-medium hover:bg-[#d4af37]/90 disabled:opacity-50 text-sm">
              {loading ? "..." : "Apply"}
            </button>
          </div>
          <div className="flex items-center gap-2">
            {(["chart", "table", "both"] as ViewMode[]).map((mode) => (
              <button key={mode} onClick={() => setViewMode(mode)}
                className={`px-3 py-1.5 text-sm border transition-colors ${viewMode === mode ? "bg-[#d4af37] text-[#0a0a0a] border-[#d4af37]" : "border-[#e8e0d0] text-[#7a6a4a] hover:text-[#1c1810]"}`}>
                {mode.charAt(0).toUpperCase() + mode.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-[#faf8f3] border border-[#e8e0d0] p-3 text-center">
          <p className="text-2xl font-bold text-[#d4af37]">{formatCurrency(data?.summary?.totalRevenue || 0)}</p>
          <p className="text-xs text-[#7a6a4a] mt-1">Total Revenue</p>
        </div>
        <div className="bg-[#faf8f3] border border-[#e8e0d0] p-3 text-center">
          <p className="text-2xl font-bold text-[#1c1810]">{(data?.summary?.totalOrders ?? 0).toLocaleString()}</p>
          <p className="text-xs text-[#7a6a4a] mt-1">Total Transactions</p>
        </div>
        <div className="bg-[#faf8f3] border border-[#e8e0d0] p-3 text-center">
          <p className="text-2xl font-bold text-[#1c1810]">{(data?.summary?.appOrders ?? 0).toLocaleString()}</p>
          <p className="text-xs text-[#7a6a4a] mt-1">App Orders</p>
        </div>
        <div className="bg-[#faf8f3] border border-[#e8e0d0] p-3 text-center">
          <p className="text-2xl font-bold text-[#1c1810]">{(data?.summary?.storeOrders ?? 0).toLocaleString()}</p>
          <p className="text-xs text-[#7a6a4a] mt-1">Store Transactions</p>
        </div>
      </div>

      {/* Chart */}
      {(viewMode === "chart" || viewMode === "both") && renderCharts()}

      {/* Table */}
      {(viewMode === "table" || viewMode === "both") && (
        <div className="bg-[#faf8f3] border border-[#e8e0d0]">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#d4af37]/10">
            <p className="text-sm text-[#7a6a4a]">{getDataRows().length} records</p>
            <button onClick={() => setShowExportModal(true)} disabled={getDataRows().length === 0}
              className="flex items-center gap-2 px-3 py-1.5 text-sm bg-[#d4af37] text-[#0a0a0a] font-medium hover:bg-[#d4af37]/90 disabled:opacity-50">
              <Download className="w-4 h-4" />
              Export
            </button>
          </div>
          <div className="overflow-x-auto max-h-80 overflow-y-auto">
            <table className="w-full">
              <thead className="bg-white sticky top-0">{renderTableHeaders()}</thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} className="py-8 text-center text-[#7a6a4a]">Loading...</td></tr>
                ) : getDataRows().length === 0 ? (
                  <tr><td colSpan={7} className="py-8 text-center text-[#7a6a4a]">No data available</td></tr>
                ) : (
                  getDataRows().map((row, index) => renderTableRow(row, index))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <ExportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        onExport={handleExport}
        title="Export Combined Sales Report"
        totalRecords={getDataRows().length}
        showDateRange={true}
      />
    </div>
  );
}
