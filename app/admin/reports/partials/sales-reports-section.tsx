// app/admin/reports/partials/sales-reports-section.tsx
"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Download, TrendingUp, DollarSign, ShoppingCart, Package, BarChart3, PieChart as PieChartIcon } from "lucide-react";
import ExportModal, { ExportOptions } from "@/components/ExportModal";
import {
  exportReport,
  createSalesReportConfig,
  createSalesByCategoryConfig,
  createSalesByProductConfig,
} from "@/lib/export-utils";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  ComposedChart,
} from "recharts";

type ReportType = "daily" | "weekly" | "monthly" | "by-category" | "by-product";
type ViewMode = "chart" | "table" | "both";

interface SalesData {
  sales?: any[];
  categories?: any[];
  products?: any[];
  summary: {
    totalRevenue?: number;
    totalOrders?: number;
    averageOrderValue?: number;
    periods?: number;
    categoryCount?: number;
    totalUnitsSold?: number;
    productCount?: number;
  };
}

// Chart colors matching the Scentopia theme
const CHART_COLORS = [
  "#d4af37", // Gold
  "#f5e6d3", // Light cream
  "#b8a070", // Muted gold
  "#8b7355", // Bronze
  "#c9a227", // Darker gold
  "#e6c85a", // Lighter gold
  "#a08040", // Olive gold
  "#dcc282", // Pale gold
];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[#faf8f3] border border-[#d4af37]/40 p-3 rounded shadow-lg">
        <p className="text-[#d4af37] font-medium mb-1">{label}</p>
        {payload.map((entry: any, index: number) => (
          <p key={index} className="text-sm" style={{ color: entry.color }}>
            {entry.name}: {entry.name.includes("Revenue") || entry.name.includes("Value")
              ? `₱${Number(entry.value).toLocaleString()}`
              : entry.value.toLocaleString()}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

// The server generates period strings from UTC dates (Node.js runs in UTC).
// Browsers parse bare date strings as local time, which shifts the date in UTC+ timezones.
// This helper recovers the original UTC date by inverting the timezone offset.
function localAsUtcIso(d: Date): string {
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString()
    .split('T')[0];
}

// Converts a human-readable period back to ISO date range for URL params
function periodToDateRange(period: string, type: ReportType): { from: string; to: string } | null {
  try {
    if (type === 'daily') {
      // "Jan 15, 2024" — treat as a UTC date (server generated it in UTC)
      const d = new Date(period);
      if (isNaN(d.getTime())) return null;
      const iso = localAsUtcIso(d);
      return { from: iso, to: iso };
    }
    if (type === 'weekly') {
      // "Week of Jan 14, 2024"
      const match = period.match(/^Week of (.+)$/);
      if (!match) return null;
      const start = new Date(match[1]);
      if (isNaN(start.getTime())) return null;
      const fromIso = localAsUtcIso(start);
      const endMs = new Date(fromIso).getTime() + 6 * 24 * 60 * 60 * 1000;
      const toIso = new Date(endMs).toISOString().split('T')[0];
      return { from: fromIso, to: toIso };
    }
    if (type === 'monthly') {
      // "January 2024"
      const d = new Date(period + ' 1');
      if (isNaN(d.getTime())) return null;
      const iso = localAsUtcIso(d);
      const [year, month] = iso.split('-').map(Number);
      const from = `${year}-${String(month).padStart(2, '0')}-01`;
      const to = new Date(Date.UTC(year, month, 0)).toISOString().split('T')[0];
      return { from, to };
    }
  } catch {
    return null;
  }
  return null;
}

export default function SalesReportsSection() {
  const router = useRouter();
  const [reportType, setReportType] = useState<ReportType>("daily");
  const [viewMode, setViewMode] = useState<ViewMode>("both");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [data, setData] = useState<SalesData | null>(null);
  const [loading, setLoading] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);

  const fetchReport = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ type: reportType });
      if (dateFrom) params.append("from", dateFrom);
      if (dateTo) params.append("to", dateTo);

      const response = await fetch(`/api/admin/reports/sales?${params}`);
      const result = await response.json();

      if (result.success) {
        setData(result.data);
      }
    } catch (error) {
      console.error("Failed to fetch sales report:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [reportType]);

  const handleExport = (options: ExportOptions) => {
    if (!data) return;

    const dateRange = options.dateRange || (dateFrom && dateTo ? { from: dateFrom, to: dateTo } : undefined);

    let config;
    if (reportType === "by-category" && data.categories) {
      config = createSalesByCategoryConfig(data.categories, dateRange);
    } else if (reportType === "by-product" && data.products) {
      config = createSalesByProductConfig(data.products, dateRange);
    } else if (data.sales) {
      config = createSalesReportConfig(
        data.sales,
        reportType as "daily" | "weekly" | "monthly",
        dateRange
      );
    }

    if (config) {
      exportReport(config, options.format);
    }
    setShowExportModal(false);
  };

  const formatCurrency = (amount: number) => `₱${amount.toLocaleString()}`;
  const formatShortCurrency = (amount: number) => {
    if (amount >= 1000000) return `₱${(amount / 1000000).toFixed(1)}M`;
    if (amount >= 1000) return `₱${(amount / 1000).toFixed(1)}K`;
    return `₱${amount}`;
  };

  const getDataRows = () => {
    if (reportType === "by-category") return data?.categories || [];
    if (reportType === "by-product") return data?.products || [];
    return data?.sales || [];
  };

  // Prepare chart data
  const chartData = useMemo(() => {
    const rows = getDataRows();
    if (reportType === "by-category") {
      return rows.map((item: any) => ({
        name: item.name,
        revenue: item.revenue || 0,
        productsSold: item.productsSold || 0,
      }));
    }
    if (reportType === "by-product") {
      return rows.slice(0, 10).map((item: any) => ({
        name: item.name.length > 20 ? item.name.substring(0, 20) + "..." : item.name,
        fullName: item.name,
        revenue: item.revenue || 0,
        quantitySold: item.quantitySold || 0,
      }));
    }
    // Time-based data - reverse to show chronologically
    return [...rows].reverse().map((item: any) => ({
      name: item.period,
      revenue: item.revenue || 0,
      orders: item.orderCount || 0,
      avgOrderValue: item.averageOrderValue || 0,
      itemsSold: item.itemsSold || 0,
    }));
  }, [data, reportType]);

  // Calculate pie chart data for categories
  const pieChartData = useMemo(() => {
    if (reportType !== "by-category" || !data?.categories) return [];
    const total = data.categories.reduce((sum: number, cat: any) => sum + (cat.revenue || 0), 0);
    return data.categories.map((cat: any, index: number) => ({
      name: cat.name,
      value: cat.revenue || 0,
      percentage: total > 0 ? ((cat.revenue / total) * 100).toFixed(1) : 0,
      color: CHART_COLORS[index % CHART_COLORS.length],
    }));
  }, [data, reportType]);

  const renderCharts = () => {
    if (loading || chartData.length === 0) {
      return (
        <div className="bg-[#faf8f3] border border-[#e8e0d0] p-8 flex items-center justify-center h-64">
          <p className="text-[#7a6a4a]">{loading ? "Loading..." : "No data available"}</p>
        </div>
      );
    }

    if (reportType === "by-category") {
      return (
        <div className="bg-[#faf8f3] border border-[#e8e0d0] p-4">
          <h3 className="text-sm font-medium text-[#7a6a4a] mb-4">Revenue by Category</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis type="number" tickFormatter={formatShortCurrency} stroke="#b8a070" fontSize={11} />
              <YAxis dataKey="name" type="category" width={100} stroke="#b8a070" fontSize={11} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="revenue" name="Revenue" fill="#d4af37" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      );
    }

    if (reportType === "by-product") {
      return (
        <div className="bg-[#faf8f3] border border-[#e8e0d0] p-4">
          <h3 className="text-sm font-medium text-[#7a6a4a] mb-4">Top 10 Products by Revenue</h3>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={chartData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis type="number" tickFormatter={formatShortCurrency} stroke="#b8a070" fontSize={11} />
              <YAxis dataKey="name" type="category" width={140} stroke="#b8a070" fontSize={10} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="revenue" name="Revenue" fill="#d4af37" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      );
    }

    // Time-based reports (daily, weekly, monthly) - single combined chart
    return (
      <div className="bg-[#faf8f3] border border-[#e8e0d0] p-4">
        <h3 className="text-sm font-medium text-[#7a6a4a] mb-4">Revenue & Orders Trend</h3>
        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart data={chartData}>
            <defs>
              <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
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
            <Area yAxisId="left" type="monotone" dataKey="revenue" name="Revenue" stroke="#d4af37" strokeWidth={2} fill="url(#revenueGradient)" />
            <Line yAxisId="right" type="monotone" dataKey="orders" name="Orders" stroke="#4B5563" strokeWidth={2} dot={{ fill: "#4B5563", r: 3 }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    );
  };

  const renderTableHeaders = () => {
    if (reportType === "by-category") {
      return (
        <tr className="text-left text-[#7a6a4a] text-sm">
          <th className="py-3 px-4">Category</th>
          <th className="py-3 px-4">Products Sold</th>
          <th className="py-3 px-4">Revenue</th>
          <th className="py-3 px-4">Average Price</th>
        </tr>
      );
    }
    if (reportType === "by-product") {
      return (
        <tr className="text-left text-[#7a6a4a] text-sm">
          <th className="py-3 px-4">Product</th>
          <th className="py-3 px-4">Category</th>
          <th className="py-3 px-4">Units Sold</th>
          <th className="py-3 px-4">Revenue</th>
        </tr>
      );
    }
    return (
      <tr className="text-left text-[#7a6a4a] text-sm">
        <th className="py-3 px-4">Period</th>
        <th className="py-3 px-4">Orders</th>
        <th className="py-3 px-4">Revenue</th>
        <th className="py-3 px-4">Avg Order Value</th>
        <th className="py-3 px-4">Items Sold</th>
      </tr>
    );
  };

  const renderTableRow = (row: any, index: number) => {
    if (reportType === "by-category") {
      // Navigate to orders filtered by search (no direct category filter available)
      const handleClick = () => router.push(`/admin/orders`);
      return (
        <tr
          key={index}
          onClick={handleClick}
          className="border-t border-[#d4af37]/10 hover:bg-[#d4af37]/5 cursor-pointer"
          title="View orders"
        >
          <td className="py-3 px-4 text-[#1c1810]">{row.name}</td>
          <td className="py-3 px-4 text-[#1c1810]">{row.productsSold}</td>
          <td className="py-3 px-4 text-[#d4af37] font-medium">{formatCurrency(row.revenue)}</td>
          <td className="py-3 px-4 text-[#1c1810]">{formatCurrency(row.averagePrice)}</td>
        </tr>
      );
    }
    if (reportType === "by-product") {
      const handleClick = () => router.push(`/admin/orders?search=${encodeURIComponent(row.name)}`);
      return (
        <tr
          key={index}
          onClick={handleClick}
          className="border-t border-[#d4af37]/10 hover:bg-[#d4af37]/5 cursor-pointer"
          title={`View orders for ${row.name}`}
        >
          <td className="py-3 px-4 text-[#1c1810]">{row.name}</td>
          <td className="py-3 px-4 text-[#7a6a4a]">{row.category}</td>
          <td className="py-3 px-4 text-[#1c1810]">{row.quantitySold}</td>
          <td className="py-3 px-4 text-[#d4af37] font-medium">{formatCurrency(row.revenue)}</td>
        </tr>
      );
    }
    // daily / weekly / monthly — navigate filtered by date range
    const range = periodToDateRange(row.period, reportType);
    const handleClick = () => {
      if (range) {
        router.push(`/admin/orders?from=${range.from}&to=${range.to}`);
      } else {
        router.push(`/admin/orders`);
      }
    };
    return (
      <tr
        key={index}
        onClick={handleClick}
        className="border-t border-[#d4af37]/10 hover:bg-[#d4af37]/5 cursor-pointer"
        title={`View orders for ${row.period}`}
      >
        <td className="py-3 px-4 text-[#1c1810]">{row.period}</td>
        <td className="py-3 px-4 text-[#1c1810]">{row.orderCount}</td>
        <td className="py-3 px-4 text-[#d4af37] font-medium">{formatCurrency(row.revenue)}</td>
        <td className="py-3 px-4 text-[#1c1810]">{formatCurrency(row.averageOrderValue)}</td>
        <td className="py-3 px-4 text-[#1c1810]">{row.itemsSold}</td>
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
              <code className="bg-[#f2ede4] dark:bg-[#26231a] px-1 rounded">orders</code> + <code className="bg-[#f2ede4] dark:bg-[#26231a] px-1 rounded">order_items</code> tables
            </span>
          </div>
          <div>
            <span className="font-semibold text-[#8B6914] dark:text-[#D4AF37] uppercase tracking-wide">Includes</span>
            <span className="ml-2 text-[#1c1810] dark:text-[#f0e8d8]">Mobile app orders — all statuses except Cancelled and Refunded</span>
          </div>
          <div>
            <span className="font-semibold text-[#8B6914] dark:text-[#D4AF37] uppercase tracking-wide">Calculation</span>
            <span className="ml-2 text-[#1c1810] dark:text-[#f0e8d8]">Revenue = sum of order amounts grouped by selected period</span>
          </div>
        </div>
      </div>

      {/* Compact Header with Filters */}
      <div className="bg-[#faf8f3] border border-[#e8e0d0] p-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* Left: Report Type & Filters */}
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={reportType}
              onChange={(e) => setReportType(e.target.value as ReportType)}
              className="px-3 py-2 bg-white border border-[#e8e0d0] text-[#1c1810] focus:outline-none focus:border-[#d4af37] text-sm"
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="by-category">By Category</option>
              <option value="by-product">By Product</option>
            </select>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="px-2 py-2 bg-white border border-[#e8e0d0] text-[#1c1810] focus:outline-none focus:border-[#d4af37] text-sm"
              />
              <span className="text-[#7a6a4a]">to</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="px-2 py-2 bg-white border border-[#e8e0d0] text-[#1c1810] focus:outline-none focus:border-[#d4af37] text-sm"
              />
            </div>
            <button
              onClick={fetchReport}
              disabled={loading}
              className="px-3 py-2 bg-[#d4af37] text-[#0a0a0a] font-medium hover:bg-[#d4af37]/90 disabled:opacity-50 text-sm"
            >
              {loading ? "..." : "Apply"}
            </button>
          </div>

          {/* Right: View Mode */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode("chart")}
              className={`px-3 py-1.5 text-sm border transition-colors ${viewMode === "chart" ? "bg-[#d4af37] text-[#0a0a0a] border-[#d4af37]" : "border-[#e8e0d0] text-[#7a6a4a] hover:text-[#1c1810]"}`}
            >
              Chart
            </button>
            <button
              onClick={() => setViewMode("table")}
              className={`px-3 py-1.5 text-sm border transition-colors ${viewMode === "table" ? "bg-[#d4af37] text-[#0a0a0a] border-[#d4af37]" : "border-[#e8e0d0] text-[#7a6a4a] hover:text-[#1c1810]"}`}
            >
              Table
            </button>
            <button
              onClick={() => setViewMode("both")}
              className={`px-3 py-1.5 text-sm border transition-colors ${viewMode === "both" ? "bg-[#d4af37] text-[#0a0a0a] border-[#d4af37]" : "border-[#e8e0d0] text-[#7a6a4a] hover:text-[#1c1810]"}`}
            >
              Both
            </button>
          </div>
        </div>
      </div>

      {/* Summary Stats - Horizontal Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-[#faf8f3] border border-[#e8e0d0] p-3 text-center">
          <p className="text-2xl font-bold text-[#d4af37]">{formatCurrency(data?.summary?.totalRevenue || 0)}</p>
          <p className="text-xs text-[#7a6a4a] mt-1">Total Revenue</p>
        </div>
        <div className="bg-[#faf8f3] border border-[#e8e0d0] p-3 text-center">
          <p className="text-2xl font-bold text-[#1c1810]">{data?.summary?.totalOrders?.toLocaleString() || 0}</p>
          <p className="text-xs text-[#7a6a4a] mt-1">Orders</p>
        </div>
        <div className="bg-[#faf8f3] border border-[#e8e0d0] p-3 text-center">
          <p className="text-2xl font-bold text-[#1c1810]">{formatCurrency(data?.summary?.averageOrderValue || 0)}</p>
          <p className="text-xs text-[#7a6a4a] mt-1">Avg Order</p>
        </div>
        <div className="bg-[#faf8f3] border border-[#e8e0d0] p-3 text-center">
          <p className="text-2xl font-bold text-[#1c1810]">{data?.summary?.categoryCount || data?.summary?.productCount || data?.summary?.periods || 0}</p>
          <p className="text-xs text-[#7a6a4a] mt-1">{reportType === "by-category" ? "Categories" : reportType === "by-product" ? "Products" : "Periods"}</p>
        </div>
      </div>

      {/* Charts Section */}
      {(viewMode === "chart" || viewMode === "both") && renderCharts()}

      {/* Data Table */}
      {(viewMode === "table" || viewMode === "both") && (
        <div className="bg-[#faf8f3] border border-[#e8e0d0]">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#d4af37]/10">
            <p className="text-sm text-[#7a6a4a]">
              {getDataRows().length} records
              <span className="ml-2 text-xs text-[#b8a070] italic">— click a row to view orders</span>
            </p>
            <button
              onClick={() => setShowExportModal(true)}
              disabled={getDataRows().length === 0}
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
                    <td colSpan={5} className="py-8 text-center text-[#7a6a4a]">
                      Loading...
                    </td>
                  </tr>
                ) : getDataRows().length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-[#7a6a4a]">
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
      )}

      {/* Export Modal */}
      <ExportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        onExport={handleExport}
        title="Export Sales Report"
        totalRecords={getDataRows().length}
        showDateRange={true}
      />
    </div>
  );
}
