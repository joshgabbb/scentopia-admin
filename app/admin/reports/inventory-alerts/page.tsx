// app/admin/reports/inventory-alerts/page.tsx
"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import ExportModal, { ExportOptions } from "@/components/ExportModal";

interface InventoryAlert {
  id: string;
  productId: string;
  productName: string;
  productImage: string | null;
  type: string;
  severity: string;
  message: string;
  currentStock: number;
  velocity: number;
  daysUntilStockout: number;
  unitsSoldLast30Days: number;
}

export default function InventoryAlertsPage() {
  const router = useRouter();
  const [alerts, setAlerts] = useState<InventoryAlert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState("all");
  const [showExportModal, setShowExportModal] = useState(false);
  const [summary, setSummary] = useState({
    total: 0,
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    alertTypes: {
      lowStock: 0,
      fastMoving: 0,
      slowMoving: 0,
      stockoutRisk: 0
    }
  });

  useEffect(() => {
    fetchAlerts();
  }, [typeFilter]);

  const fetchAlerts = async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams({
        filter: typeFilter
      });

      const res = await fetch(`/api/admin/reports/inventory-alerts?${params}`);
      const result = await res.json();

      if (result.success) {
        setAlerts(result.data.alerts);
        setSummary(result.data.summary);
      }
    } catch (error) {
      console.error("Failed to fetch inventory alerts:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportClick = () => {
    setShowExportModal(true);
  };

  const handleExport = (options: ExportOptions) => {
    // Build query parameters
    const params = new URLSearchParams();
    
    if (options.exportType === "filtered") {
      params.append("filter", typeFilter);
    }
    
    if (options.dateRange) {
      params.append("dateFrom", options.dateRange.from);
      params.append("dateTo", options.dateRange.to);
    }
    
    params.append("includeDetails", options.includeDetails.toString());

    // Trigger download
    window.location.href = `/api/admin/reports/inventory-alerts/export?${params.toString()}`;
    setShowExportModal(false);
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical": return "bg-red-100 text-red-800 border-red-300";
      case "high": return "bg-orange-100 text-orange-800 border-orange-300";
      case "medium": return "bg-yellow-100 text-yellow-800 border-yellow-300";
      case "low": return "bg-blue-100 text-blue-800 border-blue-300";
      default: return "bg-gray-100 text-gray-800 border-gray-300";
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case "critical": return "🚨";
      case "high": return "⚠️";
      case "medium": return "⚡";
      case "low": return "ℹ️";
      default: return "📋";
    }
  };

  const getAlertTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      low_stock: "Low Stock",
      fast_moving: "Fast Moving",
      slow_moving: "Slow Moving",
      stockout_risk: "Stockout Risk"
    };
    return labels[type] || type;
  };

  const getRecommendation = (alert: InventoryAlert) => {
    if (alert.currentStock === 0) {
      return "Restock immediately - product is out of stock";
    } else if (alert.type === "stockout_risk") {
      return `Restock within ${alert.daysUntilStockout} days to prevent stockout`;
    } else if (alert.type === "fast_moving") {
      return "Consider increasing inventory levels for this fast-selling product";
    } else if (alert.type === "slow_moving") {
      return "Consider promotions or reducing future orders";
    } else if (alert.currentStock <= 20) {
      return "Monitor stock levels and reorder when necessary";
    }
    return "Continue monitoring stock levels";
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
          <h1 className="text-2xl font-bold">Inventory Alerts</h1>
          <div className="flex gap-2">
            <button 
              onClick={fetchAlerts}
              className="px-4 py-2 border border-gray-300 hover:bg-gray-50"
            >
              Refresh
            </button>
            <button 
              onClick={handleExportClick}
              className="px-4 py-2 bg-black text-white hover:bg-gray-800"
            >
              Export Report
            </button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="bg-white p-6 border">
            <div className="text-sm text-gray-600">Total Alerts</div>
            <div className="text-2xl font-bold mt-2">{summary.total}</div>
          </div>
          <div className="bg-red-50 p-6 border border-red-200">
            <div className="text-sm text-red-700">Critical</div>
            <div className="text-2xl font-bold mt-2 text-red-600">{summary.critical}</div>
          </div>
          <div className="bg-orange-50 p-6 border border-orange-200">
            <div className="text-sm text-orange-700">High</div>
            <div className="text-2xl font-bold mt-2 text-orange-600">{summary.high}</div>
          </div>
          <div className="bg-yellow-50 p-6 border border-yellow-200">
            <div className="text-sm text-yellow-700">Medium</div>
            <div className="text-2xl font-bold mt-2 text-yellow-600">{summary.medium}</div>
          </div>
          <div className="bg-blue-50 p-6 border border-blue-200">
            <div className="text-sm text-blue-700">Low</div>
            <div className="text-2xl font-bold mt-2 text-blue-600">{summary.low}</div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-2">
          <button
            onClick={() => setTypeFilter("all")}
            className={`px-4 py-2 border ${typeFilter === "all" ? "bg-black text-white" : "bg-white hover:bg-gray-50"}`}
          >
            All ({summary.total})
          </button>
          <button
            onClick={() => setTypeFilter("low_stock")}
            className={`px-4 py-2 border ${typeFilter === "low_stock" ? "bg-black text-white" : "bg-white hover:bg-gray-50"}`}
          >
            Low Stock ({summary.alertTypes.lowStock})
          </button>
          <button
            onClick={() => setTypeFilter("fast_moving")}
            className={`px-4 py-2 border ${typeFilter === "fast_moving" ? "bg-black text-white" : "bg-white hover:bg-gray-50"}`}
          >
            Fast Moving ({summary.alertTypes.fastMoving})
          </button>
          <button
            onClick={() => setTypeFilter("slow_moving")}
            className={`px-4 py-2 border ${typeFilter === "slow_moving" ? "bg-black text-white" : "bg-white hover:bg-gray-50"}`}
          >
            Slow Moving ({summary.alertTypes.slowMoving})
          </button>
          <button
            onClick={() => setTypeFilter("stockout_risk")}
            className={`px-4 py-2 border ${typeFilter === "stockout_risk" ? "bg-black text-white" : "bg-white hover:bg-gray-50"}`}
          >
            Stockout Risk ({summary.alertTypes.stockoutRisk})
          </button>
        </div>

        {/* Alerts List */}
        <div className="space-y-3">
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className={`bg-white border-l-4 p-6 ${getSeverityColor(alert.severity)}`}
            >
              <div className="flex items-start gap-4">
                <div className="text-3xl">{getSeverityIcon(alert.severity)}</div>
                
                <div className="flex-1">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-bold text-lg">{alert.productName}</h3>
                        <span className="text-xs px-2 py-1 bg-gray-100 rounded-full capitalize">
                          {alert.severity}
                        </span>
                      </div>
                      <div className="text-sm text-gray-600">{getAlertTypeLabel(alert.type)}</div>
                    </div>
                    
                    {alert.productImage && (
                      <img
                        src={alert.productImage}
                        alt={alert.productName}
                        className="w-16 h-16 object-cover rounded border"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    )}
                  </div>

                  <div className="flex items-center gap-6 mb-3">
                    <div>
                      <div className="text-xs text-gray-600">Current Stock</div>
                      <div className="font-semibold">{alert.currentStock} units</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-600">Velocity</div>
                      <div className="font-semibold">{alert.velocity} /day</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-600">Sold (30 days)</div>
                      <div className="font-semibold">{alert.unitsSoldLast30Days} units</div>
                    </div>
                    {alert.daysUntilStockout !== 999 && (
                      <div>
                        <div className="text-xs text-gray-600">Days Until Stockout</div>
                        <div className="font-semibold">{alert.daysUntilStockout} days</div>
                      </div>
                    )}
                  </div>

                  <div className="bg-white bg-opacity-50 p-3 rounded mb-3">
                    <div className="text-sm font-medium mb-1">Alert Message:</div>
                    <div className="text-sm">{alert.message}</div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="text-sm">
                      <span className="font-medium">💡 Recommendation:</span>{" "}
                      <span className="text-gray-700">{getRecommendation(alert)}</span>
                    </div>
                    <button className="px-4 py-2 bg-black text-white text-sm hover:bg-gray-800">
                      Take Action
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {alerts.length === 0 && (
          <div className="text-center py-12 bg-white border rounded">
            <div className="text-6xl mb-4">✅</div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">All Clear!</h3>
            <p className="text-gray-600">No inventory alerts at this time</p>
          </div>
        )}
      </div>

      {/* Export Modal */}
      <ExportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        onExport={handleExport}
        title="Export Inventory Alerts"
        totalRecords={summary.total}
        filteredRecords={alerts.length}
        showDateRange={false}
      />
    </>
  );
}