// app/admin/reports/slow-moving/page.tsx
"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import ExportModal, { ExportOptions } from "@/components/ExportModal";

interface SlowMovingProduct {
  productId: string;
  productName: string;
  productPrice: number;
  productImage: string | null;
  totalQuantitySold: number;
  currentStock: number;
  velocity: number;
  daysOfInventory: number;
  productAge: number;
  status: string;
  recommendation: string;
}

export default function SlowMovingPage() {
  const router = useRouter();
  const [products, setProducts] = useState<SlowMovingProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [days, setDays] = useState(60);
  const [showExportModal, setShowExportModal] = useState(false);
  const [summary, setSummary] = useState({
    noSalesCount: 0,
    verySlowCount: 0,
    slowCount: 0,
    totalStockValue: 0
  });

  useEffect(() => {
    fetchData();
  }, [days]);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const res = await fetch(`/api/admin/reports/slow-moving?days=${days}`);
      const result = await res.json();

      if (result.success) {
        setProducts(result.data.products);
        setSummary(result.data.summary);
      }
    } catch (error) {
      console.error("Failed to fetch slow-moving items:", error);
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

    window.location.href = `/api/admin/reports/slow-moving/export?${params.toString()}`;
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
      case "no_sales": return "bg-red-100 text-red-800";
      case "very_slow": return "bg-orange-100 text-orange-800";
      case "slow": return "bg-yellow-100 text-yellow-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "no_sales": return "No Sales";
      case "very_slow": return "Very Slow";
      case "slow": return "Slow";
      default: return status;
    }
  };

  const getRecommendationIcon = (recommendation: string) => {
    switch (recommendation) {
      case "consider_discontinuing": return "🛑";
      case "reduce_inventory": return "📉";
      case "promote_product": return "📢";
      case "monitor": return "👁️";
      default: return "📋";
    }
  };

  const getRecommendationLabel = (recommendation: string) => {
    switch (recommendation) {
      case "consider_discontinuing": return "Consider Discontinuing";
      case "reduce_inventory": return "Reduce Inventory";
      case "promote_product": return "Promote Product";
      case "monitor": return "Monitor";
      default: return recommendation;
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
          <h1 className="text-2xl font-bold">Slow-Moving Items</h1>
          <div className="flex gap-2">
            <select
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              className="px-4 py-2 border border-gray-300"
            >
              <option value="30">Last 30 Days</option>
              <option value="60">Last 60 Days</option>
              <option value="90">Last 90 Days</option>
              <option value="120">Last 120 Days</option>
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
            <div className="text-sm text-gray-600">No Sales</div>
            <div className="text-2xl font-bold mt-2 text-red-600">{summary.noSalesCount}</div>
          </div>
          <div className="bg-white p-6 border">
            <div className="text-sm text-gray-600">Very Slow</div>
            <div className="text-2xl font-bold mt-2 text-orange-600">{summary.verySlowCount}</div>
          </div>
          <div className="bg-white p-6 border">
            <div className="text-sm text-gray-600">Slow Moving</div>
            <div className="text-2xl font-bold mt-2 text-yellow-600">{summary.slowCount}</div>
          </div>
          <div className="bg-white p-6 border">
            <div className="text-sm text-gray-600">Stock Value</div>
            <div className="text-2xl font-bold mt-2">{formatCurrency(summary.totalStockValue)}</div>
          </div>
        </div>

        {/* Products Table */}
        <div className="bg-white border">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sold</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Velocity</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Stock</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Stock Value</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Age (Days)</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
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
                  <td className="px-6 py-4">
                    {product.totalQuantitySold === 0 ? (
                      <span className="text-red-600 font-semibold">0</span>
                    ) : (
                      <span>{product.totalQuantitySold}</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-gray-600">{product.velocity} /day</span>
                  </td>
                  <td className="px-6 py-4 font-semibold">{product.currentStock}</td>
                  <td className="px-6 py-4">
                    {formatCurrency(product.currentStock * product.productPrice)}
                  </td>
                  <td className="px-6 py-4 text-gray-600">{product.productAge}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(product.status)}`}>
                      {getStatusLabel(product.status)}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{getRecommendationIcon(product.recommendation)}</span>
                      <span className="text-xs text-gray-600">
                        {getRecommendationLabel(product.recommendation)}
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {products.length === 0 && (
          <div className="text-center py-12 bg-white border rounded">
            <div className="text-6xl mb-4">🚀</div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">All Products Moving Well!</h3>
            <p className="text-gray-600">No slow-moving items found for the selected period</p>
          </div>
        )}
      </div>

      {/* Export Modal */}
      <ExportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        onExport={handleExport}
        title="Export Slow-Moving Items"
        totalRecords={products.length}
        showDateRange={true}
        currentDays={days}
      />
    </>
  );
}