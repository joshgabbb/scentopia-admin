// app/admin/reports/page.tsx
"use client";

import { useState } from "react";
import {
  TrendingUp,
  Package,
  LineChart,
  GitBranch,
  Map,
  Store,
  BarChart2,
} from "lucide-react";
import HeatmapSection from "./partials/heatmap-section";
import SalesForecastingSection from "./partials/sales-forecast-section";
import ProductAssociationsSection from "./partials/product-associations-section";
import SalesReportsSection from "./partials/sales-reports-section";
import InventoryReportsSection from "./partials/inventory-reports-section";
import PhysicalStoreReportsSection from "./partials/physical-store-reports-section";
import CombinedReportsSection from "./partials/combined-reports-section";

type TabType = "sales" | "physical-store" | "combined" | "inventory" | "forecast" | "associations" | "heatmap";

interface Tab {
  id: TabType;
  label: string;
  icon: React.ReactNode;
}

const tabs: Tab[] = [
  { id: "sales", label: "Sales (App)", icon: <TrendingUp className="w-4 h-4" /> },
  { id: "physical-store", label: "Physical Store Sales", icon: <Store className="w-4 h-4" /> },
  { id: "combined", label: "Combined Sales", icon: <BarChart2 className="w-4 h-4" /> },
  { id: "inventory", label: "Inventory", icon: <Package className="w-4 h-4" /> },
  { id: "forecast", label: "Sales Forecast", icon: <LineChart className="w-4 h-4" /> },
  { id: "associations", label: "Product Associations", icon: <GitBranch className="w-4 h-4" /> },
  { id: "heatmap", label: "Heatmap", icon: <Map className="w-4 h-4" /> },
];

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState<TabType>("sales");

  const renderTabContent = () => {
    switch (activeTab) {
      case "sales":
        return <SalesReportsSection />;
      case "physical-store":
        return <PhysicalStoreReportsSection />;
      case "combined":
        return <CombinedReportsSection />;
      case "inventory":
        return <InventoryReportsSection />;
      case "forecast":
        return <SalesForecastingSection />;
      case "associations":
        return <ProductAssociationsSection />;
      case "heatmap":
        return <HeatmapSection />;
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
