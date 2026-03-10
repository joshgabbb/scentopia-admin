// app/admin/reports/partials/orders-reports-section.tsx
"use client";

import { useState, useEffect } from "react";
import { Download, Package, XCircle, CheckCircle, Clock } from "lucide-react";
import ExportModal, { ExportOptions } from "@/components/ExportModal";
import {
  exportReport,
  createOrderFulfillmentConfig,
  createCancellationsConfig,
} from "@/lib/export-utils";

type ReportType = "all" | "fulfillment" | "cancellations";

interface OrdersData {
  orders?: any[];
  cancellations?: any[];
  summary: {
    totalOrders?: number;
    totalRevenue?: number;
    statusCounts?: Record<string, number>;
    totalCancellations?: number;
    totalRefundedAmount?: number;
  };
}

export default function OrdersReportsSection() {
  const [reportType, setReportType] = useState<ReportType>("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [data, setData] = useState<OrdersData | null>(null);
  const [loading, setLoading] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);

  const fetchReport = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ type: reportType });
      if (dateFrom) params.append("from", dateFrom);
      if (dateTo) params.append("to", dateTo);
      if (statusFilter !== "all") params.append("status", statusFilter);

      const response = await fetch(`/api/admin/reports/orders-report?${params}`);
      const result = await response.json();

      if (result.success) {
        setData(result.data);
      }
    } catch (error) {
      console.error("Failed to fetch orders report:", error);
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
    if (reportType === "cancellations" && data.cancellations) {
      config = createCancellationsConfig(data.cancellations, dateRange);
    } else if (data.orders) {
      config = createOrderFulfillmentConfig(data.orders, dateRange);
    }

    if (config) {
      exportReport(config, options.format);
    }
    setShowExportModal(false);
  };

  const formatCurrency = (amount: number) => `₱${amount.toLocaleString()}`;

  const getDataRows = () => {
    if (reportType === "cancellations") return data?.cancellations || [];
    return data?.orders || [];
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case "completed":
      case "delivered":
        return "text-green-400";
      case "pending":
      case "processing":
        return "text-yellow-400";
      case "shipped":
        return "text-blue-400";
      case "cancelled":
        return "text-red-400";
      default:
        return "text-[#7a6a4a]";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status?.toLowerCase()) {
      case "completed":
      case "delivered":
        return <CheckCircle className="w-4 h-4" />;
      case "pending":
      case "processing":
        return <Clock className="w-4 h-4" />;
      case "cancelled":
        return <XCircle className="w-4 h-4" />;
      default:
        return <Package className="w-4 h-4" />;
    }
  };

  const renderTableHeaders = () => {
    if (reportType === "cancellations") {
      return (
        <tr className="text-left text-[#7a6a4a] text-sm">
          <th className="py-3 px-4">Order #</th>
          <th className="py-3 px-4">Customer</th>
          <th className="py-3 px-4">Amount</th>
          <th className="py-3 px-4">Reason</th>
          <th className="py-3 px-4">Refund Status</th>
          <th className="py-3 px-4">Cancelled Date</th>
        </tr>
      );
    }
    return (
      <tr className="text-left text-[#7a6a4a] text-sm">
        <th className="py-3 px-4">Order #</th>
        <th className="py-3 px-4">Customer</th>
        <th className="py-3 px-4">Amount</th>
        <th className="py-3 px-4">Status</th>
        <th className="py-3 px-4">Payment</th>
        <th className="py-3 px-4">Date</th>
      </tr>
    );
  };

  const renderTableRow = (row: any, index: number) => {
    if (reportType === "cancellations") {
      return (
        <tr key={index} className="border-t border-[#d4af37]/10 hover:bg-[#faf8f3]/50">
          <td className="py-3 px-4 text-[#d4af37] font-medium">{row.orderNumber}</td>
          <td className="py-3 px-4">
            <div className="text-[#1c1810]">{row.customerName}</div>
            <div className="text-xs text-[#7a6a4a]">{row.customerEmail}</div>
          </td>
          <td className="py-3 px-4 text-[#d4af37] font-medium">{formatCurrency(row.amount)}</td>
          <td className="py-3 px-4 text-[#1c1810]">{row.reason}</td>
          <td className="py-3 px-4">
            <span className={`px-2 py-1 text-xs rounded ${
              row.refundStatus === "Completed" ? "bg-green-500/20 text-green-400" :
              row.refundStatus === "Processing" ? "bg-yellow-500/20 text-yellow-400" :
              "bg-[#d4af37]/20 text-[#d4af37]"
            }`}>
              {row.refundStatus}
            </span>
          </td>
          <td className="py-3 px-4 text-[#7a6a4a]">
            {new Date(row.cancelledAt).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </td>
        </tr>
      );
    }
    return (
      <tr key={index} className="border-t border-[#d4af37]/10 hover:bg-[#faf8f3]/50">
        <td className="py-3 px-4 text-[#d4af37] font-medium">{row.orderNumber}</td>
        <td className="py-3 px-4">
          <div className="text-[#1c1810]">{row.customerName}</div>
          <div className="text-xs text-[#7a6a4a]">{row.customerEmail}</div>
        </td>
        <td className="py-3 px-4 text-[#d4af37] font-medium">{formatCurrency(row.amount)}</td>
        <td className="py-3 px-4">
          <span className={`flex items-center gap-1 ${getStatusColor(row.status)}`}>
            {getStatusIcon(row.status)}
            {row.status}
          </span>
        </td>
        <td className="py-3 px-4 text-[#7a6a4a]">{row.paymentStatus}</td>
        <td className="py-3 px-4 text-[#7a6a4a]">
          {new Date(row.createdAt).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </td>
      </tr>
    );
  };

  return (
    <div className="space-y-6">
      {/* Compact Header with Filters */}
      <div className="bg-[#faf8f3] border border-[#e8e0d0] p-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={reportType}
              onChange={(e) => setReportType(e.target.value as ReportType)}
              className="px-3 py-2 bg-white border border-[#e8e0d0] text-[#1c1810] focus:outline-none focus:border-[#d4af37] text-sm"
            >
              <option value="all">All Orders</option>
              <option value="fulfillment">Fulfillment</option>
              <option value="cancellations">Cancellations</option>
            </select>
            {reportType === "fulfillment" && (
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 bg-white border border-[#e8e0d0] text-[#1c1810] focus:outline-none focus:border-[#d4af37] text-sm"
              >
                <option value="all">All Status</option>
                <option value="Pending">Pending</option>
                <option value="Processing">Processing</option>
                <option value="Shipped">Shipped</option>
                <option value="Delivered">Delivered</option>
              </select>
            )}
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
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {reportType === "cancellations" ? (
          <>
            <div className="bg-[#faf8f3] border border-[#e8e0d0] p-3 text-center">
              <p className="text-2xl font-bold text-red-400">{data?.summary?.totalCancellations || 0}</p>
              <p className="text-xs text-[#7a6a4a] mt-1">Cancellations</p>
            </div>
            <div className="bg-[#faf8f3] border border-[#e8e0d0] p-3 text-center">
              <p className="text-2xl font-bold text-[#d4af37]">{formatCurrency(data?.summary?.totalRefundedAmount || 0)}</p>
              <p className="text-xs text-[#7a6a4a] mt-1">Refunded</p>
            </div>
          </>
        ) : (
          <>
            <div className="bg-[#faf8f3] border border-[#e8e0d0] p-3 text-center">
              <p className="text-2xl font-bold text-[#d4af37]">{data?.summary?.totalOrders || 0}</p>
              <p className="text-xs text-[#7a6a4a] mt-1">Orders</p>
            </div>
            <div className="bg-[#faf8f3] border border-[#e8e0d0] p-3 text-center">
              <p className="text-2xl font-bold text-green-400">{data?.summary?.statusCounts?.Completed || data?.summary?.statusCounts?.Delivered || 0}</p>
              <p className="text-xs text-[#7a6a4a] mt-1">Completed</p>
            </div>
            <div className="bg-[#faf8f3] border border-[#e8e0d0] p-3 text-center">
              <p className="text-2xl font-bold text-yellow-400">{data?.summary?.statusCounts?.Pending || 0}</p>
              <p className="text-xs text-[#7a6a4a] mt-1">Pending</p>
            </div>
            <div className="bg-[#faf8f3] border border-[#e8e0d0] p-3 text-center">
              <p className="text-2xl font-bold text-[#d4af37]">{formatCurrency(data?.summary?.totalRevenue || 0)}</p>
              <p className="text-xs text-[#7a6a4a] mt-1">Revenue</p>
            </div>
          </>
        )}
      </div>

      {/* Data Table */}
      <div className="bg-[#faf8f3] border border-[#e8e0d0]">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#d4af37]/10">
          <p className="text-sm text-[#7a6a4a]">{getDataRows().length} records</p>
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
        title="Export Orders Report"
        totalRecords={getDataRows().length}
        showDateRange={true}
      />
    </div>
  );
}
