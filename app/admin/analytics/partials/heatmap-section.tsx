// app/admin/analytics/partials/heatmap-section.tsx
"use client";

import PhilippineMap, { PhilippineMapRef } from "@/components/philippine-map";
import { useHeatmap } from "@/hooks/useHeatmap";
import { useRef, useState, useMemo, useEffect } from "react";
import { getProvincesByRegion, RegionType, provinceNames } from "@/utils/regions";

interface HeatmapSectionProps {
  data?: Record<string, number>;
}

export default function HeatmapSection({ data: propData }: HeatmapSectionProps) {
  const mapRef = useRef<PhilippineMapRef>(null);
  const [selectedRegion, setSelectedRegion] = useState<RegionType>('all');

  // Fallback dummy data
  const fallbackData = {
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

  // Use the heatmap hook
  const { 
    data: heatmapData, 
    setColorFunction, 
    loading, 
    error,
    refreshData 
  } = useHeatmap(propData, {
    autoFetch: !propData, // Only auto-fetch if no prop data provided
    apiEndpoint: '/api/admin/analytics/heatmap',
    fallbackData: fallbackData
  });

  const provinceData = useMemo(() => {
    return heatmapData || fallbackData;
  }, [heatmapData]);

  const filteredData = useMemo(() => {
    const regionProvinceIds = getProvincesByRegion(selectedRegion);
    return Object.entries(provinceData).filter(([id]) => 
      regionProvinceIds.includes(id)
    );
  }, [selectedRegion, provinceData]);

  const statistics = useMemo(() => {
    if (filteredData.length === 0) return { total: 0, average: 0, highest: 0, lowest: 0 };
    
    const values = filteredData.map(([, value]) => value);
    const total = filteredData.length;
    const average = Math.round(values.reduce((sum, val) => sum + val, 0) / total);
    const highest = Math.max(...values);
    const lowest = Math.min(...values);
    
    return { total, average, highest, lowest };
  }, [filteredData]);

  const sortedData = useMemo(() => {
    return [...filteredData].sort(([, a], [, b]) => b - a);
  }, [filteredData]);

  const getColorForValue = (value: number) => {
    return value > 80 ? "#ef4444" : value > 50 ? "#f97316" : "#22c55e";
  };

  // Handle map loaded - pass color function to the hook
  const handleMapLoaded = (colorFn: (id: string, color: string) => void) => {
    console.log("Map loaded, setting color function");
    setColorFunction(colorFn);
    
    // Apply colors with a delay to ensure map is ready
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

  // Re-apply colors when region or data changes
  useEffect(() => {
    if (mapRef.current) {
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
    }
  }, [filteredData]);

  const handleRegionChange = (newRegion: RegionType) => {
    setSelectedRegion(newRegion);
  };

  const getMapTitle = () => {
    switch (selectedRegion) {
      case 'luzon': return 'HEATMAP SALES - LUZON';
      case 'visayas': return 'HEATMAP SALES - VISAYAS';
      case 'mindanao': return 'HEATMAP SALES - MINDANAO';
      default: return 'HEATMAP SALES';
    }
  };

  return (
    <div className="bg-[#1a1a1a] border border-[#d4af37]/20 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-semibold text-[#d4af37] uppercase tracking-[2px]">
          {getMapTitle()}
        </h2>
        <div className="flex items-center gap-3">
          {loading && (
            <span className="text-sm text-[#b8a070]">Loading data...</span>
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
        <div className="flex flex-1 h-[600px] flex-col justify-center items-center w-full bg-[#0a0a0a] border border-[#d4af37]/20 py-8">
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
        <div className="flex flex-1 h-[600px] flex-col justify-start items-start w-full bg-[#0a0a0a] border border-[#d4af37]/20 px-5 py-4 overflow-y-auto">
          <div className="w-full space-y-4">
            {/* Region Selector */}
            <div>
              <h2 className="text-2xl font-semibold text-[#d4af37] uppercase tracking-[2px]">
                SALES DATA
              </h2>
              <label className="block text-sm font-medium text-[#b8a070] mb-2 mt-4">
                Select Region
              </label>
              <select
                value={selectedRegion}
                onChange={(e) => handleRegionChange(e.target.value as RegionType)}
                className="w-full px-3 py-2 border border-[#d4af37]/20 bg-[#1a1a1a] text-[#f5e6d3] focus:outline-none focus:ring-2 focus:ring-[#d4af37]"
              >
                <option value="all">All Regions</option>
                <option value="luzon">Luzon</option>
                <option value="visayas">Visayas</option>
                <option value="mindanao">Mindanao</option>
              </select>
            </div>

            {/* Statistics */}
            <div className="bg-[#1a1a1a] border border-[#d4af37]/20 p-3 grid grid-cols-2 gap-3">
              <div>
                <div className="text-sm text-[#b8a070]">Total Provinces</div>
                <div className="text-xl font-bold text-[#d4af37]">{statistics.total}</div>
              </div>
              <div>
                <div className="text-sm text-[#b8a070]">Average Score</div>
                <div className="text-xl font-bold text-[#d4af37]">{statistics.average}</div>
              </div>
              <div>
                <div className="text-sm text-[#b8a070]">Highest Score</div>
                <div className="text-xl font-bold text-[#d4af37]">{statistics.highest}</div>
              </div>
              <div>
                <div className="text-sm text-[#b8a070]">Lowest Score</div>
                <div className="text-xl font-bold text-[#d4af37]">{statistics.lowest}</div>
              </div>
            </div>

            {/* Legend */}
            <div>
              <h3 className="text-sm font-medium text-[#b8a070] mb-2">Legend:</h3>
              <div className="flex flex-col space-y-2">
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 bg-green-500"></div>
                  <span className="text-sm text-[#f5e6d3]">Low (0-50)</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 bg-orange-500"></div>
                  <span className="text-sm text-[#f5e6d3]">Medium (51-80)</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 bg-red-500"></div>
                  <span className="text-sm text-[#f5e6d3]">High (81+)</span>
                </div>
              </div>
            </div>

            {/* Province List */}
            <div className="mt-4">
              <h3 className="text-lg font-medium text-[#d4af37] mb-3">
                Province Rankings
              </h3>
              <div className="space-y-2 max-h-[250px] overflow-y-auto">
                {sortedData.length > 0 ? (
                  sortedData.map(([id, value]) => (
                    <div key={id} className="flex items-center justify-between p-2 bg-[#1a1a1a] border border-[#d4af37]/20 text-sm">
                      <div className="flex items-center space-x-2">
                        <div 
                          className="w-3 h-3 rounded-full" 
                          style={{ backgroundColor: getColorForValue(value) }}
                        ></div>
                        <div className="font-medium text-[#f5e6d3]">
                          {provinceNames[id] || id}
                        </div>
                      </div>
                      <span className="font-bold text-[#d4af37]">{value}</span>
                    </div>
                  ))
                ) : (
                  <div className="text-center text-[#b8a070] mt-8">
                    No data available for this region
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}