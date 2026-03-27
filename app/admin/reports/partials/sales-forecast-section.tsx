// components/partials/sales-forecasting-section.tsx
"use client";

import { useState, useEffect, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { useTheme } from '@/contexts/ThemeContext';

interface MonthlyData {
  month: string;
  year: number;
  totalSales: number;
  orderCount: number;
  averageOrderValue: number;
}

interface ForecastResult {
  period: string;
  months: number;
  predictedSales: number;
  predictedOrders: number;
  predictedAOV: number;
  confidence: number;
  trend: 'increasing' | 'decreasing' | 'stable';
  seasonality: number;
  historicalData: MonthlyData[];
  monthlyBreakdown: Array<{
    month: string;
    predictedSales: number;
    confidence: number;
  }>;
}

export default function SalesForecastingSection() {
  const { themeClasses, isDark } = useTheme();
  const [selectedPeriod, setSelectedPeriod] = useState('1_month');
  const [forecastData, setForecastData] = useState<ForecastResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Chart color constants — driven by isDark so Recharts SVG props update with theme
  const CHART_GRID_COLOR = isDark ? '#2e2a1e' : '#e8e0d0';
  const CHART_AXIS_COLOR = isDark ? '#9a8a68' : '#7a6a4a';
  const CHART_TOOLTIP_STYLE = {
    backgroundColor: isDark ? '#1c1a14' : '#ffffff',
    border: `1px solid ${isDark ? '#2e2a1e' : '#e8e0d0'}`,
    color: isDark ? '#f0e8d8' : '#1c1810',
    borderRadius: '4px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
  };
  const CHART_LABEL_STYLE = { color: isDark ? '#D4AF37' : '#8B6914', fontWeight: 600 };

  // Fetch forecast data
  const fetchForecastData = async (period: string) => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/admin/analytics/forecast?period=${period}&t=${Date.now()}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch forecast`);
      }

      const result = await response.json();

      if (result.error) {
        throw new Error(result.error);
      }

      setForecastData(result);
    } catch (err) {
      console.error('Failed to fetch forecast data:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch forecast data';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchForecastData(selectedPeriod);
  }, [selectedPeriod]);

  // Prepare chart data combining historical and forecast
  const chartData = useMemo(() => {
    if (!forecastData) return [];

    const historical = forecastData.historicalData.map((data, index) => ({
      month: data.month,
      sales: data.totalSales,
      type: 'historical' as const,
      id: `historical-${index}`
    }));

    const forecast = forecastData.monthlyBreakdown.map((data, index) => ({
      month: data.month,
      sales: data.predictedSales,
      type: 'forecast' as const,
      id: `forecast-${index}`
    }));

    return [...historical, ...forecast];
  }, [forecastData]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const getTrendLabel = (trend: string) => {
    switch (trend) {
      case 'increasing': return { text: 'Growing', color: '#22c55e' };
      case 'decreasing': return { text: 'Declining', color: '#ef4444' };
      default: return { text: 'Stable', color: '#d4af37' };
    }
  };

  if (loading) {
    return (
      <div className="bg-[#faf8f3] dark:bg-[#1c1a14] border border-[#e8e0d0] dark:border-[#2e2a1e] p-6">
        <h2 className="text-2xl font-semibold text-[#d4af37] uppercase tracking-[2px] mb-6">
          SALES FORECAST
        </h2>
        <div className="flex items-center justify-center h-64">
          <div className="flex flex-col items-center gap-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#d4af37]"></div>
            <p className="text-[#7a6a4a] dark:text-[#9a8a68]">Generating forecast...</p>
          </div>
        </div>
      </div>
    );
  }

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
              <code className="bg-[#f2ede4] dark:bg-[#26231a] px-1 rounded">orders</code> table — past 6 months of order history
            </span>
          </div>
          <div>
            <span className="font-semibold text-[#8B6914] dark:text-[#D4AF37] uppercase tracking-wide">Method</span>
            <span className="ml-2 text-[#1c1810] dark:text-[#f0e8d8]">Weighted Moving Average (WMA) — recent months carry higher weight</span>
          </div>
          <div>
            <span className="font-semibold text-[#8B6914] dark:text-[#D4AF37] uppercase tracking-wide">Basis</span>
            <span className="ml-2 text-[#1c1810] dark:text-[#f0e8d8]">Past sales trend from mobile app orders — Cancelled and Refunded excluded</span>
          </div>
        </div>
      </div>

      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between mb-6">
        <h2 className="text-2xl font-semibold text-[#d4af37] uppercase tracking-[2px] mb-4 lg:mb-0">
          SALES FORECAST
        </h2>

        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchForecastData(selectedPeriod)}
            disabled={loading}
            className="px-4 py-2 bg-[#d4af37] text-[#0a0a0a] font-medium hover:bg-[#d4af37]/90 disabled:opacity-50 transition-colors"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded">
          <p className="text-red-700 dark:text-red-400">
            <strong>Error:</strong> {error}
          </p>
          <p className="text-red-500 dark:text-red-400 text-sm mt-2">
            Make sure you have order data in your database.
          </p>
        </div>
      )}

      {forecastData && (
        <div className="space-y-6">
          {/* Simple Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Expected Sales */}
            <div className="bg-white dark:bg-[#26231a] border border-[#e8e0d0] dark:border-[#2e2a1e] p-5">
              <div className="text-sm text-[#7a6a4a] dark:text-[#9a8a68] mb-2">Expected Sales</div>
              <div className="text-2xl font-bold text-[#d4af37]">
                {formatCurrency(forecastData.predictedSales)}
              </div>
              <div className="text-xs text-[#7a6a4a] dark:text-[#9a8a68] mt-1">{forecastData.period}</div>
            </div>

            {/* Expected Orders */}
            <div className="bg-white dark:bg-[#26231a] border border-[#e8e0d0] dark:border-[#2e2a1e] p-5">
              <div className="text-sm text-[#7a6a4a] dark:text-[#9a8a68] mb-2">Expected Orders</div>
              <div className="text-2xl font-bold text-[#d4af37]">
                {forecastData.predictedOrders.toLocaleString()}
              </div>
              <div className="text-xs text-[#7a6a4a] dark:text-[#9a8a68] mt-1">{forecastData.period}</div>
            </div>

            {/* Trend */}
            <div className="bg-white dark:bg-[#26231a] border border-[#e8e0d0] dark:border-[#2e2a1e] p-5">
              <div className="text-sm text-[#7a6a4a] dark:text-[#9a8a68] mb-2">Sales Trend</div>
              <div
                className="text-2xl font-bold"
                style={{ color: getTrendLabel(forecastData.trend).color }}
              >
                {getTrendLabel(forecastData.trend).text}
              </div>
              <div className="text-xs text-[#7a6a4a] dark:text-[#9a8a68] mt-1">Based on history</div>
            </div>
          </div>

          {/* What This Means - Simple Explanation */}
          <div className="bg-white dark:bg-[#26231a] border border-[#e8e0d0] dark:border-[#2e2a1e] p-5">
            <h3 className="text-lg font-semibold text-[#d4af37] mb-3">What This Means</h3>
            <div className="space-y-2 text-[#1c1810] dark:text-[#f0e8d8]">
              <p>
                Based on your past {forecastData.historicalData.length} months of sales,
                we expect you to earn approximately <strong className="text-[#d4af37]">{formatCurrency(forecastData.predictedSales)}</strong> from
                around <strong className="text-[#d4af37]">{forecastData.predictedOrders} orders</strong> in the {forecastData.period.toLowerCase()}.
              </p>
              {forecastData.trend === 'increasing' && (
                <p className="text-green-500 dark:text-green-400">
                  Your sales are showing growth. Keep up the good work!
                </p>
              )}
              {forecastData.trend === 'decreasing' && (
                <p className="text-red-500 dark:text-red-400">
                  Your sales are declining. Consider promotions or marketing to boost sales.
                </p>
              )}
              {forecastData.trend === 'stable' && (
                <p className="text-[#d4af37]">
                  Your sales are steady. This is a good foundation to build on.
                </p>
              )}
            </div>
          </div>

          {/* Sales Chart */}
          <div className="bg-white dark:bg-[#26231a] border border-[#e8e0d0] dark:border-[#2e2a1e] p-5">
            <h3 className="text-lg font-semibold text-[#d4af37] mb-4">Sales History & Forecast</h3>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_COLOR} />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 11, fill: CHART_AXIS_COLOR }}
                    angle={-45}
                    textAnchor="end"
                    height={60}
                    stroke={CHART_GRID_COLOR}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: CHART_AXIS_COLOR }}
                    tickFormatter={(value) => `₱${(value / 1000).toFixed(0)}k`}
                    stroke={CHART_GRID_COLOR}
                  />
                  <Tooltip
                    contentStyle={CHART_TOOLTIP_STYLE}
                    formatter={(value: any, name: any, props: any) => [
                      formatCurrency(value),
                      props.payload.type === 'historical' ? 'Actual Sales' : 'Predicted Sales'
                    ]}
                    labelFormatter={(label) => label}
                    labelStyle={CHART_LABEL_STYLE}
                  />
                  <Line
                    type="monotone"
                    dataKey="sales"
                    stroke="#d4af37"
                    strokeWidth={2}
                    dot={(props: any) => {
                      const { cx, cy, payload } = props;
                      return (
                        <circle
                          key={payload.id}
                          cx={cx}
                          cy={cy}
                          r={5}
                          fill={payload.type === 'historical' ? '#d4af37' : '#22c55e'}
                          stroke={payload.type === 'historical' ? '#b8942e' : '#16a34a'}
                          strokeWidth={2}
                        />
                      );
                    }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Legend */}
            <div className="mt-4 flex items-center justify-center gap-6 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-[#d4af37]"></div>
                <span className="text-[#1c1810] dark:text-[#f0e8d8]">Past Sales</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-green-500"></div>
                <span className="text-[#1c1810] dark:text-[#f0e8d8]">Predicted Sales</span>
              </div>
            </div>
          </div>

          {/* Monthly Breakdown */}
          <div className="bg-white dark:bg-[#26231a] border border-[#e8e0d0] dark:border-[#2e2a1e] p-5">
            <h3 className="text-lg font-semibold text-[#d4af37] mb-4">Monthly Predictions</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={forecastData.monthlyBreakdown}>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_COLOR} />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 11, fill: CHART_AXIS_COLOR }}
                    stroke={CHART_GRID_COLOR}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: CHART_AXIS_COLOR }}
                    tickFormatter={(value) => `₱${(value / 1000).toFixed(0)}k`}
                    stroke={CHART_GRID_COLOR}
                  />
                  <Tooltip
                    contentStyle={CHART_TOOLTIP_STYLE}
                    formatter={(value: any) => [formatCurrency(value), 'Expected Sales']}
                    labelStyle={CHART_LABEL_STYLE}
                  />
                  <Bar
                    dataKey="predictedSales"
                    fill="#d4af37"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Simple Table */}
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#e8e0d0] dark:border-[#2e2a1e]">
                    <th className="text-left py-2 text-[#7a6a4a] dark:text-[#9a8a68]">Month</th>
                    <th className="text-right py-2 text-[#7a6a4a] dark:text-[#9a8a68]">Expected Sales</th>
                  </tr>
                </thead>
                <tbody>
                  {forecastData.monthlyBreakdown.map((item, index) => (
                    <tr key={index} className="border-b border-[#d4af37]/10">
                      <td className="py-2 text-[#1c1810] dark:text-[#f0e8d8]">{item.month}</td>
                      <td className="py-2 text-right text-[#d4af37] font-medium">
                        {formatCurrency(item.predictedSales)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
