// app/admin/reports/fast-moving/page.tsx
"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import ExportModal, { ExportOptions } from "@/components/ExportModal";

interface FastMovingProduct {
  productId: string;
  productName: string;
  productPrice: number;
  productImage: string | null;
  totalQuantitySold: number;
  totalRevenue: number;
  orderCount: number;
  currentStock: number;
  velocity: number;
  daysUntilStockout: number;
  needsRestock: boolean;
  status: string;
}

export default function FastMovingPage() {
  const router = useRouter();
  const [products, setProducts] = useState<FastMovingProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [days, setDays] = useState(30);
  const [showExportModal, setShowExportModal] = useState(false);
  const [summary, setSummary] = useState({
    totalUnitsSold: 0,
    totalRevenue: 0,
    needsRestockCount: 0,
    outOfStockCount: 0
  });

  useEffect(() => {
    fetchData();
  }, [days]);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const res = await fetch(`/api/admin/reports/fast-moving?days=${days}`);
      const result = await res.json();

      if (result.success) {
        setProducts(result.data.products);
        setSummary(result.data.summary);
      }
    } catch (error) {
      console.error("Failed to fetch fast-moving items:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportClick = () => {
    setShowExportModal(true);
  };

  const handleExport = (options: ExportOptions) => {
    const params = new URLSearchParams();
    params.append("days", days.toString());
    
    if (options.dateRange) {
      params.append("dateFrom", options.dateRange.from);
      params.append("dateTo", options.dateRange.to);
    }
    
    params.append("includeDetails", options.includeDetails.toString());

    window.location.href = `/api/admin/reports/fast-moving/export?${params.toString()}`;
    setShowExportModal(false);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP'
    }).format(amount);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "out_of_stock": return "bg-red-100 text-red-800";
      case "low_stock": return "bg-orange-100 text-orange-800";
      case "healthy": return "bg-green-100 text-green-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "out_of_stock": return "Out of Stock";
      case "low_stock": return "Low Stock";
      case "healthy": return "Healthy";
      default: return status;
    }
  };

  if (isLoading) {
    return <div className="p-6">Loading...</div>;
  }

  return (
    <>
      <div className="space-y-6">
        {/* BACK NAVIGATION */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/admin/reports")}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 hover:bg-gray-50 transition-colors"
          >
            <span>←</span>
            <span>Back to Reports</span>
          </button>
        </div>

        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Fast-Moving Items</h1>
          <div className="flex gap-2">
            <select
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              className="px-4 py-2 border border-gray-300"
            >
              <option value="7">Last 7 Days</option>
              <option value="14">Last 14 Days</option>
              <option value="30">Last 30 Days</option>
              <option value="60">Last 60 Days</option>
              <option value="90">Last 90 Days</option>
            </select>
            <button 
              onClick={handleExportClick}
              className="px-4 py-2 bg-black text-white hover:bg-gray-800"
            >
              Export Report
            </button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white p-6 border">
            <div className="text-sm text-gray-600">Total Units Sold</div>
            <div className="text-2xl font-bold mt-2">{summary.totalUnitsSold.toLocaleString()}</div>
          </div>
          <div className="bg-white p-6 border">
            <div className="text-sm text-gray-600">Total Revenue</div>
            <div className="text-2xl font-bold mt-2">{formatCurrency(summary.totalRevenue)}</div>
          </div>
          <div className="bg-white p-6 border">
            <div className="text-sm text-gray-600">Needs Restock</div>
            <div className="text-2xl font-bold mt-2 text-orange-600">{summary.needsRestockCount}</div>
          </div>
          <div className="bg-white p-6 border">
            <div className="text-sm text-gray-600">Out of Stock</div>
            <div className="text-2xl font-bold mt-2 text-red-600">{summary.outOfStockCount}</div>
          </div>
        </div>

        {/* Products Table */}
        <div className="bg-white border">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sold</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Revenue</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Velocity</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Stock</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Days Left</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {products.map((product) => (
                <tr key={product.productId} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      {product.productImage ? (
                        <img 
                          src={product.productImage} 
                          alt={product.productName} 
                          className="w-12 h-12 object-cover rounded" 
                        />
                      ) : (
                        <div className="w-12 h-12 bg-gray-200 rounded flex items-center justify-center">
                          📦
                        </div>
                      )}
                      <div>
                        <div className="font-medium">{product.productName}</div>
                        <div className="text-sm text-gray-500">{formatCurrency(product.productPrice)}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 font-semibold">{product.totalQuantitySold}</td>
                  <td className="px-6 py-4">{formatCurrency(product.totalRevenue)}</td>
                  <td className="px-6 py-4">
                    <span className="text-sm font-medium text-green-600">{product.velocity} /day</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={product.currentStock < 10 ? "text-red-600 font-semibold" : ""}>
                      {product.currentStock}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {product.daysUntilStockout > 0 ? (
                      <span className={product.daysUntilStockout < 7 ? "text-orange-600 font-semibold" : ""}>
                        {product.daysUntilStockout} days
                      </span>
                    ) : (
                      <span className="text-gray-400">N/A</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(product.status)}`}>
                      {getStatusLabel(product.status)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {products.length === 0 && (
          <div className="text-center py-12 bg-white border rounded">
            <div className="text-6xl mb-4">📊</div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Fast-Moving Items</h3>
            <p className="text-gray-600">No products with sales found for the selected period</p>
          </div>
        )}
      </div>

      {/* Export Modal */}
      <ExportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        onExport={handleExport}
        title="Export Fast-Moving Items"
        totalRecords={products.length}
        showDateRange={true}
        currentDays={days}
      />
    </>
  );
}