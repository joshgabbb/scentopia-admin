// app/admin/analytics/page.tsx
"use client";

import HeatmapSection from "./partials/heatmap-section";
import SalesForecastingSection from "./partials/sales-forecast-section";


export default function AnalyticsPage() {
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

  return (
    <div className="space-y-8 bg-[#0a0a0a] min-h-screen p-6">
      <HeatmapSection data={salesData} />

      <SalesForecastingSection />

      <div className="p-6 bg-[#1a1a1a] border border-[#d4af37]/20">
        <h2 className="text-2xl font-semibold text-[#d4af37] uppercase tracking-[2px] mb-4">
          PERFORMANCE METRICS
        </h2>
        <p className="text-[#b8a070]">Performance metrics section will be added here...</p>
      </div>
    </div>
  );
}