import { useEffect, useRef, useState, useCallback } from "react";

type ProvinceData = Record<string, number>; // { "PH-CEB": 75, "PH-MNL": 90 }

interface UseHeatmapOptions {
  autoFetch?: boolean;
  apiEndpoint?: string;
  fallbackData?: ProvinceData;
}

export function useHeatmap(
  initialData?: ProvinceData, 
  options: UseHeatmapOptions = {}
) {
  const {
    autoFetch = true,
    apiEndpoint = '/api/admin/analytics/heatmap',
    fallbackData = {}
  } = options;

  const colorFunctionRef = useRef<((id: string, color: string) => void) | null>(null);
  const [data, setData] = useState<ProvinceData>(initialData || {});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setColorFunction = (colorFn: (id: string, color: string) => void) => {
    colorFunctionRef.current = colorFn;
  };

  const applyHeatmap = useCallback(() => {
    if (!colorFunctionRef.current) return;

    Object.entries(data).forEach(([id, value]) => {
      // Simple threshold coloring - you can customize these thresholds
      const color =
        value > 80 ? "#ef4444" :  // Red for high values
        value > 50 ? "#f97316" :  // Orange for medium values
        "#22c55e";                // Green for low values

      colorFunctionRef.current!(id, color);
    });
  }, [data]);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(apiEndpoint, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      
      if (result.error) {
        throw new Error(result.error);
      }

      setData(result);
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch heatmap data';
      console.error('Heatmap fetch error:', errorMessage);
      setError(errorMessage);
      
      // Use fallback data if available
      if (Object.keys(fallbackData).length > 0) {
        setData(fallbackData);
      }
      
      throw err;
    } finally {
      setLoading(false);
    }
  }, [apiEndpoint, fallbackData]);

  const refreshData = useCallback(() => {
    return fetchData();
  }, [fetchData]);

  // Auto-fetch data on mount if enabled and no initial data provided
  useEffect(() => {
    if (autoFetch && !initialData) {
      fetchData().catch(() => {
        // Error already handled in fetchData
      });
    }
  }, [autoFetch, initialData, fetchData]);

  // Update data when initialData prop changes
  useEffect(() => {
    if (initialData) {
      setData(initialData);
    }
  }, [initialData]);

  // Apply heatmap when data changes
  useEffect(() => {
    if (Object.keys(data).length > 0) {
      applyHeatmap();
    }
  }, [data, applyHeatmap]);

  return { 
    data,
    setColorFunction, 
    applyHeatmap,
    fetchData,
    refreshData,
    loading,
    error,
    setData
  };
}