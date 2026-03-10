// app/admin/reports/page.tsx
"use client";

import { useState } from "react";
import {
  TrendingUp,
  Package,
  LineChart,
  GitBranch,
  Map
} from "lucide-react";
import HeatmapSection from "./partials/heatmap-section";
import SalesForecastingSection from "./partials/sales-forecast-section";
import ProductAssociationsSection from "./partials/product-associations-section";
import SalesReportsSection from "./partials/sales-reports-section";
import InventoryReportsSection from "./partials/inventory-reports-section";

type TabType = "sales" | "inventory" | "forecast" | "associations" | "heatmap";

interface Tab {
  id: TabType;
  label: string;
  icon: React.ReactNode;
}

const tabs: Tab[] = [
  { id: "sales", label: "Sales", icon: <TrendingUp className="w-4 h-4" /> },
  { id: "inventory", label: "Inventory", icon: <Package className="w-4 h-4" /> },
  { id: "forecast", label: "Sales Forecast", icon: <LineChart className="w-4 h-4" /> },
  { id: "associations", label: "Product Associations", icon: <GitBranch className="w-4 h-4" /> },
  { id: "heatmap", label: "Heatmap", icon: <Map className="w-4 h-4" /> },
];

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState<TabType>("sales");

  const salesData = {
    "PH-CEB": 85,
    "PH-MNL": 92,
    "PH-SUR": 45,
    "PH-DAV": 65,
    "PH-ILI": 78,
    "PH-LAG": 55,
    "PH-CAV": 88,
    "PH-BUL": 42,
    "PH-PAM": 73,
    "PH-BTG": 61,
    "PH-RIZ": 82,
    "PH-QUE": 38,
    "PH-ALB": 69,
    "PH-CAS": 76,
    "PH-LEY": 52,
    "PH-BOH": 84,
    "PH-NEC": 47,
    "PH-ILN": 91,
    "PH-ZMB": 36,
    "PH-TAR": 58
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case "sales":
        return <SalesReportsSection />;
      case "inventory":
        return <InventoryReportsSection />;
      case "forecast":
        return <SalesForecastingSection />;
      case "associations":
        return <ProductAssociationsSection />;
      case "heatmap":
        return <HeatmapSection data={salesData} />;
      default:
        return null;
    }
  };

  return (
    <div className="bg-white min-h-screen p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-[#d4af37] uppercase tracking-[2px]">
          Reports & Analytics
        </h1>
        <p className="text-[#7a6a4a] mt-1">
          Generate and export comprehensive business reports
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="mb-6">
        <div className="flex flex-wrap gap-2 border-b border-[#e8e0d0] pb-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? "bg-[#d4af37] text-[#0a0a0a]"
                  : "text-[#7a6a4a] hover:text-[#d4af37] hover:bg-[#d4af37]/10"
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div>{renderTabContent()}</div>
    </div>
  );
}
