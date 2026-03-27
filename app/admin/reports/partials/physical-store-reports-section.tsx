// app/admin/reports/partials/physical-store-reports-section.tsx
"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
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

// Server generates period strings from UTC dates — recover the original UTC date
// by inverting the browser timezone offset before converting to ISO.
function localAsUtcIso(d: Date): string {
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString()
    .split("T")[0];
}

function periodToDateRange(
  period: string,
  type: "daily" | "weekly" | "monthly"
): { from: string; to: string } | null {
  try {
    if (type === "daily") {
      const d = new Date(period);
      if (isNaN(d.getTime())) return null;
      const iso = localAsUtcIso(d);
      return { from: iso, to: iso };
    }
    if (type === "weekly") {
      const match = period.match(/^Week of (.+)$/);
      if (!match) return null;
      const start = new Date(match[1]);
      if (isNaN(start.getTime())) return null;
      const fromIso = localAsUtcIso(start);
      const toIso = new Date(new Date(fromIso).getTime() + 6 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];
      return { from: fromIso, to: toIso };
    }
    if (type === "monthly") {
      const d = new Date(period + " 1");
      if (isNaN(d.getTime())) return null;
      const iso = localAsUtcIso(d);
      const [year, month] = iso.split("-").map(Number);
      const from = `${year}-${String(month).padStart(2, "0")}-01`;
      const to = new Date(Date.UTC(year, month, 0)).toISOString().split("T")[0];
      return { from, to };
    }
  } catch {
    return null;
  }
  return null;
}

type ReportType = "daily" | "weekly" | "monthly" | "by-product";
type ViewMode = "chart" | "table" | "both";

interface StoreData {
  sales?: any[];
  products?: any[];
  summary: {
    totalRevenue?: number;
    totalOrders?: number;
    averageOrderValue?: number;
    periods?: number;
    totalUnitsSold?: number;
    productCount?: number;
  };
}

const CHART_COLORS = [
  "#d4af37", "#f5e6d3", "#b8a070", "#8b7355", "#c9a227", "#e6c85a", "#a08040", "#dcc282",
];

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

export default function PhysicalStoreReportsSection() {
  const router = useRouter();
  const [reportType, setReportType] = useState<ReportType>("daily");
  const [viewMode, setViewMode] = useState<ViewMode>("both");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [data, setData] = useState<StoreData | null>(null);
  const [loading, setLoading] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);

  const fetchReport = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ type: reportType });
      if (dateFrom) params.append("from", dateFrom);
      if (dateTo) params.append("to", dateTo);

      const response = await fetch(`/api/admin/reports/physical-store?${params}`);
      const result = await response.json();
      if (result.success) setData(result.data);
    } catch (error) {
      console.error("Failed to fetch physical store report:", error);
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
        quantitySold: item.quantitySold || 0,
      }));
    }
    return [...rows].reverse().map((item: any) => ({
      name: item.period,
      revenue: item.revenue || 0,
      orders: item.orderCount || 0,
      avgOrderValue: item.averageOrderValue || 0,
      itemsSold: item.itemsSold || 0,
    }));
  }, [data, reportType]);

  const handleExport = (options: ExportOptions) => {
    if (!data) return;
    const exportFmt = (n: number) => `PHP ${n.toLocaleString()}`;
    const dateRange =
      options.dateRange || (dateFrom && dateTo ? { from: dateFrom, to: dateTo } : undefined);
    const rows = getDataRows();

    let config;
    if (reportType === "by-product") {
      config = {
        title: "Physical Store Sales — By Product",
        subtitle: "Top products sold in-store",
        filename: "physical_store_by_product",
        headers: ["Product", "Units Sold", "Revenue"],
        rows: rows.map((p: any) => [p.name, p.quantitySold, exportFmt(p.revenue)]),
        dateRange,
        additionalInfo: [
          { label: "Total Revenue", value: exportFmt(data.summary.totalRevenue || 0) },
          { label: "Total Units Sold", value: String(data.summary.totalUnitsSold || 0) },
          { label: "Products", value: String(data.summary.productCount || 0) },
        ],
      };
    } else {
      config = {
        title: `Physical Store Sales — ${reportType.charAt(0).toUpperCase() + reportType.slice(1)}`,
        subtitle: "Revenue from physical store (POS) transactions",
        filename: `physical_store_${reportType}`,
        headers: ["Period", "Transactions", "Revenue", "Avg Transaction", "Items Sold"],
        rows: rows.map((s: any) => [
          s.period,
          s.orderCount,
          exportFmt(s.revenue),
          exportFmt(s.averageOrderValue),
          s.itemsSold,
        ]),
        dateRange,
        additionalInfo: [
          { label: "Total Revenue", value: exportFmt(data.summary.totalRevenue || 0) },
          { label: "Total Transactions", value: String(data.summary.totalOrders || 0) },
          { label: "Avg Transaction", value: exportFmt(data.summary.averageOrderValue || 0) },
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

    return (
      <div className="bg-[#faf8f3] border border-[#e8e0d0] p-4">
        <h3 className="text-sm font-medium text-[#7a6a4a] mb-4">Revenue & Transactions Trend</h3>
        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart data={chartData}>
            <defs>
              <linearGradient id="storeRevenueGradient" x1="0" y1="0" x2="0" y2="1">
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
            <Area yAxisId="left" type="monotone" dataKey="revenue" name="Revenue" stroke="#d4af37" strokeWidth={2} fill="url(#storeRevenueGradient)" />
            <Line yAxisId="right" type="monotone" dataKey="orders" name="Transactions" stroke="#4B5563" strokeWidth={2} dot={{ fill: "#4B5563", r: 3 }} />
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
          <th className="py-3 px-4">Units Sold</th>
          <th className="py-3 px-4">Revenue</th>
        </tr>
      );
    }
    return (
      <tr className="text-left text-[#7a6a4a] text-sm">
        <th className="py-3 px-4">Period</th>
        <th className="py-3 px-4">Transactions</th>
        <th className="py-3 px-4">Revenue</th>
        <th className="py-3 px-4">Avg Transaction</th>
        <th className="py-3 px-4">Items Sold</th>
      </tr>
    );
  };

  const renderTableRow = (row: any, index: number) => {
    if (reportType === "by-product") {
      return (
        <tr key={index} className="border-t border-[#d4af37]/10 hover:bg-[#d4af37]/5">
          <td className="py-3 px-4 text-[#1c1810]">{row.name}</td>
          <td className="py-3 px-4 text-[#1c1810]">{row.quantitySold}</td>
          <td className="py-3 px-4 text-[#d4af37] font-medium">{formatCurrency(row.revenue)}</td>
        </tr>
      );
    }
    // daily / weekly / monthly — navigate to orders filtered by date range (physical store tab)
    const range = periodToDateRange(row.period, reportType as "daily" | "weekly" | "monthly");
    const handleClick = () => {
      if (range) {
        router.push(`/admin/orders?source=store&from=${range.from}&to=${range.to}`);
      } else {
        router.push(`/admin/orders?source=store`);
      }
    };
    return (
      <tr
        key={index}
        onClick={handleClick}
        className="border-t border-[#d4af37]/10 hover:bg-[#d4af37]/5 cursor-pointer"
        title={`View transactions for ${row.period}`}
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

      {/* Data Basis Banner */}
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
              <code className="bg-[#f2ede4] dark:bg-[#26231a] px-1 rounded">pos_transactions</code> + <code className="bg-[#f2ede4] dark:bg-[#26231a] px-1 rounded">pos_transaction_items</code> tables
            </span>
          </div>
          <div>
            <span className="font-semibold text-[#8B6914] dark:text-[#D4AF37] uppercase tracking-wide">Includes</span>
            <span className="ml-2 text-[#1c1810] dark:text-[#f0e8d8]">Physical store (POS) transactions only — all transactions, no status filter</span>
          </div>
          <div>
            <span className="font-semibold text-[#8B6914] dark:text-[#D4AF37] uppercase tracking-wide">Calculation</span>
            <span className="ml-2 text-[#1c1810] dark:text-[#f0e8d8]">Revenue = sum of POS transaction amounts grouped by selected period</span>
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
          <p className="text-xs text-[#7a6a4a] mt-1">Transactions</p>
        </div>
        <div className="bg-[#faf8f3] border border-[#e8e0d0] p-3 text-center">
          <p className="text-2xl font-bold text-[#1c1810]">{formatCurrency(data?.summary?.averageOrderValue || 0)}</p>
          <p className="text-xs text-[#7a6a4a] mt-1">Avg Transaction</p>
        </div>
        <div className="bg-[#faf8f3] border border-[#e8e0d0] p-3 text-center">
          <p className="text-2xl font-bold text-[#1c1810]">
            {data?.summary?.productCount ?? data?.summary?.totalUnitsSold ?? data?.summary?.periods ?? 0}
          </p>
          <p className="text-xs text-[#7a6a4a] mt-1">
            {reportType === "by-product" ? "Products" : "Periods"}
          </p>
        </div>
      </div>

      {/* Chart */}
      {(viewMode === "chart" || viewMode === "both") && renderCharts()}

      {/* Table */}
      {(viewMode === "table" || viewMode === "both") && (
        <div className="bg-[#faf8f3] border border-[#e8e0d0]">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#d4af37]/10">
            <p className="text-sm text-[#7a6a4a]">
            {getDataRows().length} records
            {reportType !== "by-product" && (
              <span className="ml-2 text-xs text-[#b8a070] italic">— click a row to view transactions</span>
            )}
          </p>
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
                  <tr><td colSpan={5} className="py-8 text-center text-[#7a6a4a]">Loading...</td></tr>
                ) : getDataRows().length === 0 ? (
                  <tr><td colSpan={5} className="py-8 text-center text-[#7a6a4a]">No data available</td></tr>
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
        title="Export Physical Store Report"
        totalRecords={getDataRows().length}
        showDateRange={true}
      />
    </div>
  );
}
