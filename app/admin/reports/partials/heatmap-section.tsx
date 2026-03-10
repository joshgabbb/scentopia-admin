// app/admin/reports/partials/heatmap-section.tsx
"use client";

import PhilippineMap, { PhilippineMapRef } from "@/components/philippine-map";
import { useHeatmap } from "@/hooks/useHeatmap";
import { useRef, useState, useMemo, useEffect, useCallback } from "react";
import { getProvincesByRegion, RegionType, provinceNames } from "@/utils/regions";

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
    setColorFunction,
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

  const getColorForValue = (value: number) => {
    const { lowThreshold, highThreshold } = statistics;
    if (value > highThreshold) return "#ef4444"; // Red - high orders
    if (value > lowThreshold) return "#f97316";  // Orange - medium orders
    return "#22c55e";                             // Green - low orders
  };

  // Handle map loaded - pass color function to the hook
  const handleMapLoaded = (colorFn: (id: string, color: string) => void) => {
    setColorFunction(colorFn);
    setMapLoaded(true);

    // Apply colors with a delay to ensure SVG DOM is ready
    setTimeout(() => {
      filteredData.forEach(([id, value]) => {
        try {
          const color = getColorForValue(value);
          colorFn(id, color);
        } catch (err) {
          console.warn(`Could not color province ${id}:`, err);
        }
      });
    }, 500);
  };

  // Re-apply colors when region or data changes — only after map is ready
  useEffect(() => {
    if (!mapLoaded || !mapRef.current) return;
    const colorFn = mapRef.current.colorProvince;
    setTimeout(() => {
      filteredData.forEach(([id, value]) => {
        try {
          const color = getColorForValue(value);
          colorFn(id, color);
        } catch (err) {
          console.warn(`Could not color province ${id}:`, err);
        }
      });
    }, 500);
  }, [filteredData, mapLoaded]);

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
    } else {
      setSelectedProvince(provinceCode);
      fetchProvinceOrders(provinceCode);
    }
  };

  const handleRegionChange = (newRegion: RegionType) => {
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
    <div className="bg-[#faf8f3] dark:bg-[#1c1a14] border border-[#e8e0d0] dark:border-[#2e2a1e] p-6">

      {/* ── Data Basis Banner ─────────────────────────────────────────── */}
      <div className="border-l-4 border-[#D4AF37] bg-[#fffdf5] dark:bg-[#26231a] px-4 py-3 flex flex-col sm:flex-row sm:items-start gap-3 mb-6">
        <div className="flex-shrink-0 mt-0.5">
          <svg className="w-4 h-4 text-[#8B6914] dark:text-[#D4AF37]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs">
          <div>
            <span className="font-semibold text-[#8B6914] dark:text-[#D4AF37] uppercase tracking-wide">Data Source</span>
            <span className="ml-2 text-[#1c1810] dark:text-[#f0e8d8]">
              <code className="bg-[#f2ede4] dark:bg-[#26231a] px-1 rounded">orders</code> table — delivery location field mapped to Philippine province codes
            </span>
          </div>
          <div>
            <span className="font-semibold text-[#8B6914] dark:text-[#D4AF37] uppercase tracking-wide">Basis</span>
            <span className="ml-2 text-[#1c1810] dark:text-[#f0e8d8]">Order delivery coordinates grouped by province — color intensity = order volume</span>
          </div>
          <div>
            <span className="font-semibold text-[#8B6914] dark:text-[#D4AF37] uppercase tracking-wide">Note</span>
            <span className="ml-2 text-[#1c1810] dark:text-[#f0e8d8]">Fallback sample data is displayed when live order location data is unavailable</span>
          </div>
        </div>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-semibold text-[#d4af37] uppercase tracking-[2px]">
          {getMapTitle()}
        </h2>
        <div className="flex items-center gap-3">
          {loading && (
            <span className="text-sm text-[#7a6a4a] dark:text-[#9a8a68]">Loading data...</span>
          )}
          {error && (
            <span className="text-sm text-red-400">Using fallback data</span>
          )}
          <button
            onClick={refreshData}
            disabled={loading}
            className="px-3 py-1 text-sm bg-[#d4af37] text-[#0a0a0a] hover:bg-[#d4af37]/90 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Map Section */}
        <div className="flex flex-1 h-[600px] flex-col justify-center items-center w-full bg-white dark:bg-[#26231a] border border-[#e8e0d0] dark:border-[#2e2a1e] py-8">
          <span className="text-center flex items-center text-2xl font-semibold text-[#d4af37] uppercase tracking-[2px] mb-4">
            PHILIPPINE MAP
          </span>
          <div className="w-full h-full flex items-center justify-center px-4">
            <PhilippineMap
              ref={mapRef}
              region={selectedRegion}
              onMapLoaded={handleMapLoaded}
              className="max-w-full max-h-full"
            />
          </div>
        </div>

        {/* Details Section */}
        <div className="flex flex-1 h-[600px] flex-col justify-start items-start w-full bg-white dark:bg-[#26231a] border border-[#e8e0d0] dark:border-[#2e2a1e] px-5 py-4 overflow-y-auto">
          <div className="w-full space-y-4">
            {/* Region Selector */}
            <div>
              <h2 className="text-2xl font-semibold text-[#d4af37] uppercase tracking-[2px]">
                ORDER DATA
              </h2>
              <label className="block text-sm font-medium text-[#7a6a4a] dark:text-[#9a8a68] mb-2 mt-4">
                Select Region
              </label>
              <select
                value={selectedRegion}
                onChange={(e) => handleRegionChange(e.target.value as RegionType)}
                className="w-full px-3 py-2 border border-[#e8e0d0] dark:border-[#2e2a1e] bg-[#faf8f3] dark:bg-[#1c1a14] text-[#1c1810] dark:text-[#f0e8d8] focus:outline-none focus:ring-2 focus:ring-[#d4af37]"
              >
                <option value="all">All Regions</option>
                <option value="luzon">Luzon</option>
                <option value="visayas">Visayas</option>
                <option value="mindanao">Mindanao</option>
              </select>
            </div>

            {/* Statistics */}
            <div className="bg-[#faf8f3] dark:bg-[#1c1a14] border border-[#e8e0d0] dark:border-[#2e2a1e] p-3 grid grid-cols-2 gap-3">
              <div>
                <div className="text-sm text-[#7a6a4a] dark:text-[#9a8a68]">Total Orders</div>
                <div className="text-xl font-bold text-[#d4af37]">{statistics.totalOrders}</div>
              </div>
              <div>
                <div className="text-sm text-[#7a6a4a] dark:text-[#9a8a68]">Provinces with Data</div>
                <div className="text-xl font-bold text-[#d4af37]">{statistics.total}</div>
              </div>
              <div>
                <div className="text-sm text-[#7a6a4a] dark:text-[#9a8a68]">Average per Province</div>
                <div className="text-xl font-bold text-[#d4af37]">{statistics.average}</div>
              </div>
              <div>
                <div className="text-sm text-[#7a6a4a] dark:text-[#9a8a68]">Highest / Lowest</div>
                <div className="text-xl font-bold text-[#d4af37]">{statistics.highest} / {statistics.lowest}</div>
              </div>
            </div>

            {/* Legend */}
            <div>
              <h3 className="text-sm font-medium text-[#7a6a4a] dark:text-[#9a8a68] mb-2">Legend (Orders):</h3>
              <div className="flex flex-col space-y-2">
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 bg-green-500"></div>
                  <span className="text-sm text-[#1c1810] dark:text-[#f0e8d8]">Low (0-{statistics.lowThreshold})</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 bg-orange-500"></div>
                  <span className="text-sm text-[#1c1810] dark:text-[#f0e8d8]">Medium ({statistics.lowThreshold + 1}-{statistics.highThreshold})</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 bg-red-500"></div>
                  <span className="text-sm text-[#1c1810] dark:text-[#f0e8d8]">High ({statistics.highThreshold + 1}+)</span>
                </div>
              </div>
            </div>

            {/* Province List */}
            <div className="mt-4">
              <h3 className="text-lg font-medium text-[#d4af37] mb-1">
                Province Rankings (by Orders)
              </h3>
              <p className="text-xs text-[#b8a070] italic mb-3">Click a province to see its orders</p>
              <div className="space-y-2 max-h-[220px] overflow-y-auto">
                {sortedData.length > 0 ? (
                  sortedData.map(([id, value]) => (
                    <button
                      key={id}
                      onClick={() => handleProvinceClick(id)}
                      className={`w-full flex items-center justify-between p-2 border text-sm transition-colors text-left ${
                        selectedProvince === id
                          ? 'bg-[#d4af37]/10 border-[#d4af37]/60'
                          : 'bg-[#faf8f3] dark:bg-[#1c1a14] border-[#e8e0d0] dark:border-[#2e2a1e] hover:bg-[#d4af37]/5 hover:border-[#d4af37]/30'
                      }`}
                    >
                      <div className="flex items-center space-x-2">
                        <div
                          className="w-3 h-3 rounded-full flex-shrink-0"
                          style={{ backgroundColor: getColorForValue(value) }}
                        />
                        <span className="font-medium text-[#1c1810] dark:text-[#f0e8d8]">
                          {provinceNames[id] || id}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-[#d4af37]">{value} orders</span>
                        <span className="text-[#b8a070] text-xs">
                          {selectedProvince === id ? '▲' : '▼'}
                        </span>
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="text-center text-[#7a6a4a] dark:text-[#9a8a68] mt-8">
                    No data available for this region
                  </div>
                )}
              </div>
            </div>

            {/* Province Orders Panel */}
            {selectedProvince && (
              <div className="mt-4 border border-[#d4af37]/30 bg-white dark:bg-[#1c1a14]">
                <div className="flex items-center justify-between px-3 py-2 bg-[#faf8f3] dark:bg-[#26231a] border-b border-[#d4af37]/20">
                  <div>
                    <span className="font-semibold text-[#d4af37] text-sm">
                      {provinceNames[selectedProvince] || selectedProvince}
                    </span>
                    <span className="ml-2 text-xs text-[#7a6a4a] dark:text-[#9a8a68]">
                      {loadingOrders ? 'Loading...' : `${provinceOrders.length} order${provinceOrders.length !== 1 ? 's' : ''}`}
                    </span>
                  </div>
                  <button
                    onClick={() => { setSelectedProvince(null); setProvinceOrders([]); }}
                    className="text-[#7a6a4a] dark:text-[#9a8a68] hover:text-[#1c1810] dark:hover:text-[#f0e8d8] text-lg leading-none"
                  >
                    ×
                  </button>
                </div>

                {loadingOrders ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#d4af37]" />
                  </div>
                ) : provinceOrders.length === 0 ? (
                  <div className="text-center py-6 text-sm text-[#7a6a4a] dark:text-[#9a8a68]">
                    No orders found for this province
                  </div>
                ) : (
                  <div className="overflow-x-auto max-h-[240px] overflow-y-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-[#faf8f3] dark:bg-[#26231a] sticky top-0">
                        <tr className="text-[#7a6a4a] dark:text-[#9a8a68] border-b border-[#e8e0d0] dark:border-[#2e2a1e]">
                          <th className="py-2 px-3 text-left">Order</th>
                          <th className="py-2 px-3 text-left">Customer</th>
                          <th className="py-2 px-3 text-right">Amount</th>
                          <th className="py-2 px-3 text-left">Status</th>
                          <th className="py-2 px-3 text-left">Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {provinceOrders.map((order) => (
                          <tr key={order.id} className="border-b border-[#e8e0d0]/60 dark:border-[#2e2a1e]/60 hover:bg-[#faf8f3]/50 dark:hover:bg-white/5">
                            <td className="py-2 px-3 font-mono text-[#8B6914] dark:text-[#D4AF37]">{order.orderNumber}</td>
                            <td className="py-2 px-3 text-[#1c1810] dark:text-[#f0e8d8]">{order.customerName}</td>
                            <td className="py-2 px-3 text-right font-medium text-[#d4af37]">
                              ₱{order.amount.toLocaleString()}
                            </td>
                            <td className="py-2 px-3">
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                order.status === 'Delivered' ? 'bg-green-100 dark:bg-green-950/50 text-green-700 dark:text-green-400' :
                                order.status === 'Cancelled' ? 'bg-red-100 dark:bg-red-950/50 text-red-700 dark:text-red-400' :
                                order.status === 'Shipped' ? 'bg-blue-100 dark:bg-blue-950/50 text-blue-700 dark:text-blue-400' :
                                order.status === 'Processing' ? 'bg-yellow-100 dark:bg-yellow-950/50 text-yellow-700 dark:text-yellow-400' :
                                'bg-gray-100 dark:bg-gray-800/50 text-gray-600 dark:text-gray-400'
                              }`}>
                                {order.status}
                              </span>
                            </td>
                            <td className="py-2 px-3 text-[#7a6a4a] dark:text-[#9a8a68]">
                              {new Date(order.createdAt).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
