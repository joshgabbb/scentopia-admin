// app/admin/reports/page.tsx
// This is the Reports Hub page — the main entry point for all analytics and reporting sections.
// It does NOT fetch any data itself. It only manages which tab is currently active
// and renders the matching section component inside the tab content area.

"use client"; // Marks this as a Client Component so useState works (React hooks need the browser)

import { useState } from "react"; // useState is used to track which tab is currently selected
import {
  TrendingUp,   // Icon for Sales tab
  Package,      // Icon for Inventory tab
  LineChart,    // Icon for Sales Forecast tab
  GitBranch,    // Icon for Product Associations tab
  Map,          // Icon for Heatmap tab
  Store,        // Icon for Physical Store tab
  BarChart2,    // Icon for Combined Sales tab
} from "lucide-react";

// Each tab's content is a separate component imported from the partials folder.
// This keeps the page file small — it only handles navigation, not the actual report data.
import HeatmapSection from "./partials/heatmap-section";                       // Geographic sales heatmap by region
import SalesForecastingSection from "./partials/sales-forecast-section";       // AI-based sales forecast chart
import ProductAssociationsSection from "./partials/product-associations-section"; // Shows which products are often bought together
import SalesReportsSection from "./partials/sales-reports-section";            // Online/app sales data and charts
import InventoryReportsSection from "./partials/inventory-reports-section";    // Stock levels and movement reports
import PhysicalStoreReportsSection from "./partials/physical-store-reports-section"; // POS/walk-in store sales
import CombinedReportsSection from "./partials/combined-reports-section";      // Combined online + physical store sales

// TabType defines the allowed values for the active tab.
// TypeScript uses this to prevent typos when setting or reading the active tab.
type TabType = "sales" | "physical-store" | "combined" | "inventory" | "forecast" | "associations" | "heatmap";

// Tab interface defines the shape of each tab object in the tabs array below.
interface Tab {
  id: TabType;           // Unique identifier used to match the active tab
  label: string;         // Text displayed on the tab button
  icon: React.ReactNode; // Icon displayed beside the label
}

// tabs is a static array — it never changes, so it's defined outside the component.
// Each entry becomes one clickable tab button in the navigation bar.
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
  // activeTab stores which tab is currently selected. Defaults to "sales" on first load.
  // setActiveTab is called when the user clicks a tab button.
  const [activeTab, setActiveTab] = useState<TabType>("sales");

  // renderTabContent returns the correct section component based on the active tab.
  // Only one section is shown at a time — the rest are not rendered at all.
  const renderTabContent = () => {
    switch (activeTab) {
      case "sales":
        return <SalesReportsSection />;        // Shows online app sales charts
      case "physical-store":
        return <PhysicalStoreReportsSection />; // Shows walk-in/POS sales charts
      case "combined":
        return <CombinedReportsSection />;     // Shows both online + physical combined
      case "inventory":
        return <InventoryReportsSection />;    // Shows stock levels and movements
      case "forecast":
        return <SalesForecastingSection />;    // Shows predicted future sales
      case "associations":
        return <ProductAssociationsSection />; // Shows product bundles / frequent pairs
      case "heatmap":
        return <HeatmapSection />;             // Shows a map of sales by Philippine region
      default:
        return null; // Fallback — should never be reached
    }
  };

  return (
    <div className="bg-white min-h-screen p-6">
      {/* Header — static title and subtitle, no data needed */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-[#d4af37] uppercase tracking-[2px]">
          Reports & Analytics
        </h1>
        <p className="text-[#7a6a4a] mt-1">
          Generate and export comprehensive business reports
        </p>
      </div>

      {/* Tab Navigation — loops through the tabs array and renders a button for each.
          The active tab gets a gold background; inactive tabs are muted with a hover effect. */}
      <div className="mb-6">
        <div className="flex flex-wrap gap-2 border-b border-[#e8e0d0] pb-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}                          // React needs a unique key when rendering a list
              onClick={() => setActiveTab(tab.id)}  // Updates activeTab when clicked
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? "bg-[#d4af37] text-[#0a0a0a]"                        // Active: gold background
                  : "text-[#7a6a4a] hover:text-[#d4af37] hover:bg-[#d4af37]/10" // Inactive: muted with hover
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content — renders only the section that matches the active tab */}
      <div>{renderTabContent()}</div>
    </div>
  );
}
