// app/admin/reports/partials/customers-reports-section.tsx
"use client";

import { useState, useEffect } from "react";
import { Download, Users, TrendingUp, DollarSign, ShoppingCart } from "lucide-react";
import ExportModal, { ExportOptions } from "@/components/ExportModal";
import {
  exportReport,
  createCustomerListConfig,
  createTopCustomersConfig,
} from "@/lib/export-utils";

type ReportType = "list" | "top";

interface CustomersData {
  customers: any[];
  summary: {
    totalCustomers?: number;
    customersWithOrders?: number;
    totalOrders?: number;
    totalRevenue?: number;
    averageOrdersPerCustomer?: number;
    customersShown?: number;
    combinedSpending?: number;
    combinedOrders?: number;
    averageSpendingPerCustomer?: number;
  };
}

export default function CustomersReportsSection() {
  const [reportType, setReportType] = useState<ReportType>("list");
  const [limit, setLimit] = useState(50);
  const [data, setData] = useState<CustomersData | null>(null);
  const [loading, setLoading] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);

  const fetchReport = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        type: reportType,
        limit: limit.toString(),
      });

      const response = await fetch(`/api/admin/reports/customers?${params}`);
      const result = await response.json();

      if (result.success) {
        setData(result.data);
      }
    } catch (error) {
      console.error("Failed to fetch customers report:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [reportType]);

  const handleExport = (options: ExportOptions) => {
    if (!data) return;

    let config;
    if (reportType === "top") {
      config = createTopCustomersConfig(data.customers, limit);
    } else {
      config = createCustomerListConfig(data.customers);
    }

    exportReport(config, options.format);
    setShowExportModal(false);
  };

  const formatCurrency = (amount: number) => `₱${amount.toLocaleString()}`;

  const renderTableHeaders = () => {
    if (reportType === "top") {
      return (
        <tr className="text-left text-[#7a6a4a] text-sm">
          <th className="py-3 px-4">Rank</th>
          <th className="py-3 px-4">Customer</th>
          <th className="py-3 px-4">Email</th>
          <th className="py-3 px-4">Orders</th>
          <th className="py-3 px-4">Total Spent</th>
          <th className="py-3 px-4">Avg Order</th>
        </tr>
      );
    }
    return (
      <tr className="text-left text-[#7a6a4a] text-sm">
        <th className="py-3 px-4">Customer</th>
        <th className="py-3 px-4">Email</th>
        <th className="py-3 px-4">Orders</th>
        <th className="py-3 px-4">Total Spent</th>
        <th className="py-3 px-4">Avg Order</th>
        <th className="py-3 px-4">Last Order</th>
      </tr>
    );
  };

  const renderTableRow = (row: any, index: number) => {
    if (reportType === "top") {
      return (
        <tr key={index} className="border-t border-[#d4af37]/10 hover:bg-[#faf8f3]/50">
          <td className="py-3 px-4">
            <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full ${
              index === 0 ? "bg-yellow-500/20 text-yellow-400" :
              index === 1 ? "bg-gray-400/20 text-gray-400" :
              index === 2 ? "bg-orange-600/20 text-orange-400" :
              "bg-[#d4af37]/10 text-[#d4af37]"
            }`}>
              {index + 1}
            </span>
          </td>
          <td className="py-3 px-4 text-[#1c1810] font-medium">{row.name}</td>
          <td className="py-3 px-4 text-[#7a6a4a]">{row.email}</td>
          <td className="py-3 px-4 text-[#1c1810]">{row.orderCount}</td>
          <td className="py-3 px-4 text-[#d4af37] font-medium">{formatCurrency(row.totalSpent)}</td>
          <td className="py-3 px-4 text-[#1c1810]">{formatCurrency(row.averageOrderValue)}</td>
        </tr>
      );
    }
    return (
      <tr key={index} className="border-t border-[#d4af37]/10 hover:bg-[#faf8f3]/50">
        <td className="py-3 px-4 text-[#1c1810] font-medium">{row.name}</td>
        <td className="py-3 px-4 text-[#7a6a4a]">{row.email}</td>
        <td className="py-3 px-4 text-[#1c1810]">{row.orderCount}</td>
        <td className="py-3 px-4 text-[#d4af37] font-medium">{formatCurrency(row.totalSpent)}</td>
        <td className="py-3 px-4 text-[#1c1810]">{formatCurrency(row.averageOrderValue)}</td>
        <td className="py-3 px-4 text-[#7a6a4a]">{row.lastOrderDate}</td>
      </tr>
    );
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-[#faf8f3] border border-[#e8e0d0] p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#d4af37]/10 rounded">
              <Users className="w-5 h-5 text-[#d4af37]" />
            </div>
            <div>
              <p className="text-sm text-[#7a6a4a]">
                {reportType === "top" ? "Customers Shown" : "Total Customers"}
              </p>
              <p className="text-xl font-bold text-[#d4af37]">
                {data?.summary?.totalCustomers || data?.summary?.customersShown || 0}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-[#faf8f3] border border-[#e8e0d0] p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#d4af37]/10 rounded">
              <ShoppingCart className="w-5 h-5 text-[#d4af37]" />
            </div>
            <div>
              <p className="text-sm text-[#7a6a4a]">Total Orders</p>
              <p className="text-xl font-bold text-[#d4af37]">
                {(data?.summary?.totalOrders || data?.summary?.combinedOrders || 0).toLocaleString()}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-[#faf8f3] border border-[#e8e0d0] p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#d4af37]/10 rounded">
              <DollarSign className="w-5 h-5 text-[#d4af37]" />
            </div>
            <div>
              <p className="text-sm text-[#7a6a4a]">Total Revenue</p>
              <p className="text-xl font-bold text-[#d4af37]">
                {formatCurrency(data?.summary?.totalRevenue || data?.summary?.combinedSpending || 0)}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-[#faf8f3] border border-[#e8e0d0] p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#d4af37]/10 rounded">
              <TrendingUp className="w-5 h-5 text-[#d4af37]" />
            </div>
            <div>
              <p className="text-sm text-[#7a6a4a]">
                {reportType === "top" ? "Avg Spending" : "Avg Orders/Customer"}
              </p>
              <p className="text-xl font-bold text-[#d4af37]">
                {reportType === "top"
                  ? formatCurrency(data?.summary?.averageSpendingPerCustomer || 0)
                  : (data?.summary?.averageOrdersPerCustomer || 0).toFixed(1)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-[#faf8f3] border border-[#e8e0d0] p-4">
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-sm text-[#7a6a4a] mb-2">Report Type</label>
            <select
              value={reportType}
              onChange={(e) => setReportType(e.target.value as ReportType)}
              className="px-3 py-2 bg-white border border-[#e8e0d0] text-[#1c1810] focus:outline-none focus:border-[#d4af37]"
            >
              <option value="list">Customer List</option>
              <option value="top">Top Customers</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-[#7a6a4a] mb-2">Limit</label>
            <select
              value={limit}
              onChange={(e) => setLimit(parseInt(e.target.value))}
              className="px-3 py-2 bg-white border border-[#e8e0d0] text-[#1c1810] focus:outline-none focus:border-[#d4af37]"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
          <button
            onClick={fetchReport}
            disabled={loading}
            className="px-4 py-2 bg-[#d4af37] text-[#0a0a0a] font-medium hover:bg-[#d4af37]/90 disabled:opacity-50"
          >
            {loading ? "Loading..." : "Apply Filter"}
          </button>
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-[#faf8f3] border border-[#e8e0d0]">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-white">{renderTableHeaders()}</thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-[#7a6a4a]">
                    Loading...
                  </td>
                </tr>
              ) : (data?.customers || []).length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-[#7a6a4a]">
                    No data available
                  </td>
                </tr>
              ) : (
                (data?.customers || []).map((row, index) => renderTableRow(row, index))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-[#d4af37]/10">
          <p className="text-sm text-[#7a6a4a]">
            Total Records: {(data?.customers || []).length}
          </p>
          <button
            onClick={() => setShowExportModal(true)}
            disabled={(data?.customers || []).length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-[#d4af37] text-[#0a0a0a] font-medium hover:bg-[#d4af37]/90 disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            Export Report
          </button>
        </div>
      </div>

      {/* Export Modal */}
      <ExportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        onExport={handleExport}
        title="Export Customers Report"
        totalRecords={(data?.customers || []).length}
        showDateRange={false}
      />
    </div>
  );
}
