// app/admin/reports/partials/heatmap-section.tsx
"use client";

import PhilippineMap, { PhilippineMapRef } from "@/components/philippine-map";
import { useHeatmap } from "@/hooks/useHeatmap";
import { useRef, useState, useMemo, useEffect, useCallback } from "react";
import { getProvincesByRegion, RegionType, provinceNames, getRegionForProvince } from "@/utils/regions";

interface HeatmapSectionProps {
  data?: Record<string, number>;
}

interface ProvinceOrder {
  id: string;
  orderNumber: string;
  customerName: string;
  amount: number;
  status: string;
  createdAt: string;
}

export default function HeatmapSection({ data: propData }: HeatmapSectionProps) {
  const mapRef = useRef<PhilippineMapRef>(null);
  const [selectedRegion, setSelectedRegion] = useState<RegionType>('all');
  const [selectedProvince, setSelectedProvince] = useState<string | null>(null);
  const [provinceOrders, setProvinceOrders] = useState<ProvinceOrder[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [mapLoaded, setMapLoaded] = useState(false);

  // Fallback dummy data (order counts)
  const fallbackData = {
    "PH-CEB": 150,
    "PH-MNL": 320,
    "PH-SUR": 25,
    "PH-DAV": 85,
    "PH-ILI": 45,
    "PH-LAG": 180,
    "PH-CAV": 210,
    "PH-BUL": 35,
    "PH-PAM": 65,
    "PH-BTG": 55,
    "PH-RIZ": 120,
    "PH-QUE": 40,
    "PH-ALB": 30,
    "PH-CAS": 28,
    "PH-LEY": 22,
    "PH-BOH": 95,
    "PH-NEC": 18,
    "PH-ILN": 12,
    "PH-ZMB": 8,
    "PH-TAR": 48
  };

  // Use the heatmap hook - don't pass fallbackData to prevent it from being used
  const {
    data: heatmapData,
    loading,
    error,
    refreshData
  } = useHeatmap(propData, {
    autoFetch: !propData, // Only auto-fetch if no prop data provided
    apiEndpoint: '/api/admin/analytics/heatmap',
    fallbackData: {} // Empty - we'll handle fallback in the component only on error
  });

  const provinceData = useMemo(() => {
    // Only use fallback data if there's an error AND no data was fetched
    if (error && Object.keys(heatmapData || {}).length === 0) {
      return fallbackData;
    }
    // During loading or with real data, use heatmapData (or empty object)
    return heatmapData && Object.keys(heatmapData).length > 0 ? heatmapData : {};
  }, [heatmapData, error, fallbackData]);

  const filteredData = useMemo(() => {
    const regionProvinceIds = getProvincesByRegion(selectedRegion);
    return Object.entries(provinceData).filter(([id]) =>
      regionProvinceIds.includes(id)
    );
  }, [selectedRegion, provinceData]);

  const statistics = useMemo(() => {
    if (filteredData.length === 0) return { total: 0, average: 0, highest: 0, lowest: 0, totalOrders: 0, lowThreshold: 0, highThreshold: 0 };

    const values = filteredData.map(([, value]) => value);
    const total = filteredData.length;
    const totalOrders = values.reduce((sum, val) => sum + val, 0);
    const average = Math.round(totalOrders / total);
    const highest = Math.max(...values);
    const lowest = Math.min(...values);

    // Dynamic thresholds based on data range
    const range = highest - lowest;
    const lowThreshold = Math.round(lowest + range * 0.33);
    const highThreshold = Math.round(lowest + range * 0.66);

    return { total, average, highest, lowest, totalOrders, lowThreshold, highThreshold };
  }, [filteredData]);

  const sortedData = useMemo(() => {
    return [...filteredData].sort(([, a], [, b]) => b - a);
  }, [filteredData]);

  const getColorForValue = useCallback((value: number) => {
    const { lowThreshold, highThreshold } = statistics;
    if (value > highThreshold) return "#ef4444"; // Red - high orders
    if (value > lowThreshold) return "#f97316";  // Orange - medium orders
    return "#22c55e";                             // Green - low orders
  }, [statistics]);

  // Stable callback — only signals that the SVG is in the DOM and ready.
  // Coloring is handled entirely by the useEffect below.
  const handleMapLoaded = useCallback((_colorFn: (id: string, color: string) => void) => {
    setMapLoaded(true);
  }, []);

  // Single source of truth for coloring — fires when data or map readiness changes.
  // Cleanup cancels any pending timeout so stale timeouts never fire.
  useEffect(() => {
    if (!mapLoaded || !mapRef.current) return;
    const colorFn = mapRef.current.colorProvince;
    const timeoutId = setTimeout(() => {
      if (!mapRef.current) return;
      filteredData.forEach(([id, value]) => {
        colorFn(id, getColorForValue(value));
      });
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [filteredData, mapLoaded, getColorForValue]);

  const fetchProvinceOrders = useCallback(async (provinceCode: string) => {
    setLoadingOrders(true);
    try {
      const res = await fetch(`/api/admin/analytics/heatmap/orders?province=${provinceCode}`);
      const json = await res.json();
      setProvinceOrders(json.orders || []);
    } catch {
      setProvinceOrders([]);
    } finally {
      setLoadingOrders(false);
    }
  }, []);

  const handleProvinceClick = (provinceCode: string) => {
    if (selectedProvince === provinceCode) {
      setSelectedProvince(null);
      setProvinceOrders([]);
      setMapLoaded(false);
      setSelectedRegion("all");
    } else {
      setSelectedProvince(provinceCode);
      fetchProvinceOrders(provinceCode);
      setMapLoaded(false);
      setSelectedRegion(getRegionForProvince(provinceCode));
    }
  };

  const handleRegionChange = (newRegion: RegionType) => {
    setMapLoaded(false);
    setSelectedRegion(newRegion);
    setSelectedProvince(null);
    setProvinceOrders([]);
  };

  const getMapTitle = () => {
    switch (selectedRegion) {
      case 'luzon': return 'ORDERS BY PROVINCE - LUZON';
      case 'visayas': return 'ORDERS BY PROVINCE - VISAYAS';
      case 'mindanao': return 'ORDERS BY PROVINCE - MINDANAO';
      default: return 'ORDERS BY PROVINCE';
    }
  };

  return (
    <div className="space-y-5">

      {/* ── Header ───────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-[#1c1810] uppercase tracking-[2px]">
            {getMapTitle()}
          </h2>
          <p className="text-xs text-[#7a6a4a] mt-1">
            Delivery locations grouped by province · Cancelled orders excluded
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {loading && (
            <span className="text-xs text-[#7a6a4a]">Loading...</span>
          )}
          {error && (
            <span className="text-xs text-amber-600 font-medium">Using sample data</span>
          )}
          <button
            onClick={refreshData}
            disabled={loading}
            className="px-4 py-1.5 text-xs font-semibold bg-[#D4AF37] text-[#1c1810] hover:bg-[#c9a430] disabled:opacity-50 transition-colors uppercase tracking-wider"
          >
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* ── Region Tabs ──────────────────────────────────────────────── */}
      <div className="flex gap-0 border-b border-[#e8e0d0]">
        {(['all', 'luzon', 'visayas', 'mindanao'] as RegionType[]).map((r) => (
          <button
            key={r}
            onClick={() => handleRegionChange(r)}
            className={`px-5 py-2.5 text-xs font-semibold uppercase tracking-widest border-b-2 -mb-px transition-colors ${
              selectedRegion === r
                ? 'border-[#D4AF37] text-[#8B6914]'
                : 'border-transparent text-[#7a6a4a] hover:text-[#1c1810] hover:border-[#e8e0d0]'
            }`}
          >
            {r === 'all' ? 'All Regions' : r}
          </button>
        ))}
      </div>

      {/* ── Stats Row ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Orders', value: statistics.totalOrders },
          { label: 'Provinces', value: statistics.total },
          { label: 'Avg / Province', value: statistics.average },
          { label: 'Peak Province', value: statistics.highest },
        ].map(({ label, value }) => (
          <div key={label} className="bg-white border border-[#e8e0d0] px-4 py-3">
            <div className="text-[10px] font-semibold text-[#7a6a4a] uppercase tracking-wider mb-1">{label}</div>
            <div className="text-2xl font-bold text-[#D4AF37]">{value.toLocaleString()}</div>
          </div>
        ))}
      </div>

      {/* ── Main Grid: Map + Rankings ────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">

        {/* Map */}
        <div className="lg:col-span-2 bg-white border border-[#e8e0d0] flex flex-col">
          <div className="px-4 py-3 border-b border-[#e8e0d0] flex items-center justify-between shrink-0">
            <span className="text-[10px] font-semibold text-[#7a6a4a] uppercase tracking-widest">
              Geographic Distribution
            </span>
            {selectedProvince && (
              <span className="text-[10px] font-semibold text-[#D4AF37] uppercase tracking-wider">
                {provinceNames[selectedProvince]}
              </span>
            )}
          </div>
          <div className="h-[480px] overflow-hidden">
            <PhilippineMap
              key={selectedRegion}
              ref={mapRef}
              region={selectedRegion}
              onMapLoaded={handleMapLoaded}
              className="w-full h-full"
            />
          </div>
        </div>

        {/* Right panel */}
        <div className="lg:col-span-3 flex flex-col gap-4">

          {/* Rankings */}
          <div className="bg-white border border-[#e8e0d0] flex flex-col">
            <div className="px-4 py-3 border-b border-[#e8e0d0] flex items-center justify-between shrink-0">
              <span className="text-[10px] font-semibold text-[#7a6a4a] uppercase tracking-widest">
                Province Rankings
              </span>
              <div className="flex items-center gap-3 text-[10px] text-[#7a6a4a]">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
                  Low (0–{statistics.lowThreshold})
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-orange-500 inline-block" />
                  Mid ({statistics.lowThreshold + 1}–{statistics.highThreshold})
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
                  High ({statistics.highThreshold + 1}+)
                </span>
              </div>
            </div>
            <div className="overflow-y-auto" style={{ maxHeight: 260 }}>
              {sortedData.length > 0 ? (
                sortedData.map(([id, value], index) => {
                  const pct = statistics.highest > 0
                    ? Math.round((value / statistics.highest) * 100)
                    : 0;
                  return (
                    <button
                      key={id}
                      onClick={() => handleProvinceClick(id)}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors border-b border-[#e8e0d0]/60 last:border-0 ${
                        selectedProvince === id
                          ? 'bg-[#D4AF37]/10'
                          : 'hover:bg-[#faf8f3]'
                      }`}
                    >
                      <span className="text-[11px] font-mono text-[#b8a070] w-5 shrink-0 text-right">
                        {index + 1}
                      </span>
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: getColorForValue(value) }}
                      />
                      <span className="flex-1 text-xs font-medium text-[#1c1810] truncate">
                        {provinceNames[id] || id}
                      </span>
                      <div className="flex items-center gap-2 shrink-0">
                        <div className="w-16 h-1.5 bg-[#f2ede4] rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{ width: `${pct}%`, backgroundColor: getColorForValue(value) }}
                          />
                        </div>
                        <span className="text-xs font-bold text-[#D4AF37] w-20 text-right">
                          {value.toLocaleString()} orders
                        </span>
                      </div>
                    </button>
                  );
                })
              ) : (
                <div className="flex items-center justify-center h-20 text-xs text-[#7a6a4a]">
                  No data available for this region
                </div>
              )}
            </div>
          </div>

          {/* Province Orders Panel */}
          {selectedProvince && (
            <div className="bg-white border border-[#D4AF37]/40">
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#e8e0d0] shrink-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-[#D4AF37] uppercase tracking-wider">
                    {provinceNames[selectedProvince] || selectedProvince}
                  </span>
                  {!loadingOrders && (
                    <span className="text-[10px] bg-[#D4AF37]/10 text-[#8B6914] px-2 py-0.5 font-semibold">
                      {provinceOrders.length} order{provinceOrders.length !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => { setSelectedProvince(null); setProvinceOrders([]); }}
                  className="w-6 h-6 flex items-center justify-center text-[#7a6a4a] hover:text-[#1c1810] hover:bg-[#f2ede4] rounded transition-colors text-base leading-none"
                >
                  ×
                </button>
              </div>

              {loadingOrders ? (
                <div className="flex items-center justify-center py-6">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-[#D4AF37]" />
                </div>
              ) : provinceOrders.length === 0 ? (
                <div className="text-center py-5 text-xs text-[#7a6a4a]">
                  No orders found for this province
                </div>
              ) : (
                <div className="overflow-auto max-h-[200px]">
                  <table className="w-full text-xs">
                    <thead className="bg-[#faf8f3] sticky top-0">
                      <tr className="text-[10px] font-semibold text-[#7a6a4a] uppercase tracking-wider border-b border-[#e8e0d0]">
                        <th className="py-2 px-4 text-left">Order</th>
                        <th className="py-2 px-4 text-left">Customer</th>
                        <th className="py-2 px-4 text-right">Amount</th>
                        <th className="py-2 px-4 text-left">Status</th>
                        <th className="py-2 px-4 text-left">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {provinceOrders.map((order) => (
                        <tr key={order.id} className="border-b border-[#e8e0d0]/60 hover:bg-[#faf8f3]">
                          <td className="py-2 px-4 font-mono text-[#8B6914]">{order.orderNumber}</td>
                          <td className="py-2 px-4 text-[#1c1810]">{order.customerName}</td>
                          <td className="py-2 px-4 text-right font-semibold text-[#D4AF37]">
                            ₱{order.amount.toLocaleString()}
                          </td>
                          <td className="py-2 px-4">
                            <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-sm ${
                              order.status === 'Delivered'  ? 'bg-green-50 text-green-700'  :
                              order.status === 'Shipped'    ? 'bg-blue-50 text-blue-700'    :
                              order.status === 'Processing' ? 'bg-amber-50 text-amber-700'  :
                              'bg-gray-50 text-gray-600'
                            }`}>
                              {order.status}
                            </span>
                          </td>
                          <td className="py-2 px-4 text-[#7a6a4a]">
                            {new Date(order.createdAt).toLocaleDateString('en-PH', {
                              month: 'short', day: 'numeric', year: 'numeric', timeZone: 'Asia/Manila'
                            })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Data note */}
          <div className="border-l-2 border-[#D4AF37]/40 pl-3 text-[10px] text-[#7a6a4a] leading-relaxed">
            Coordinates resolved from{' '}
            <code className="bg-[#f2ede4] px-1">delivery_location</code>,{' '}
            <code className="bg-[#f2ede4] px-1">delivery_snapshot</code>, and{' '}
            <code className="bg-[#f2ede4] px-1">addresses</code>.
            Cancelled orders are excluded.
          </div>

        </div>
      </div>
    </div>
  );
}
