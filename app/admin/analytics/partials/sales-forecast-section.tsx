// components/partials/sales-forecasting-section.tsx
"use client";

import { useState, useEffect, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';

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

const FORECAST_OPTIONS = [
  { value: '1_month', label: 'Next Month' },
  { value: '3_months', label: 'Next 3 Months' },
  { value: '6_months', label: 'Next 6 Months' },
  { value: '1_year', label: 'Next Year' }
];

export default function SalesForecastingSection() {
  const [selectedPeriod, setSelectedPeriod] = useState('3_months');
  const [forecastData, setForecastData] = useState<ForecastResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      <div className="bg-[#1a1a1a] border border-[#d4af37]/20 p-6">
        <h2 className="text-2xl font-semibold text-[#d4af37] uppercase tracking-[2px] mb-6">
          SALES FORECAST
        </h2>
        <div className="flex items-center justify-center h-64">
          <div className="flex flex-col items-center gap-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#d4af37]"></div>
            <p className="text-[#b8a070]">Generating forecast...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#1a1a1a] border border-[#d4af37]/20 p-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between mb-6">
        <h2 className="text-2xl font-semibold text-[#d4af37] uppercase tracking-[2px] mb-4 lg:mb-0">
          SALES FORECAST
        </h2>

        <div className="flex items-center gap-3">
          <select
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value)}
            className="px-4 py-2 bg-[#0a0a0a] border border-[#d4af37]/20 text-[#f5e6d3] focus:outline-none focus:ring-2 focus:ring-[#d4af37]"
            disabled={loading}
          >
            {FORECAST_OPTIONS.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

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
        <div className="mb-6 p-4 bg-red-900/20 border border-red-500/30">
          <p className="text-red-400">
            <strong>Error:</strong> {error}
          </p>
          <p className="text-red-400/70 text-sm mt-2">
            Make sure you have order data in your database.
          </p>
        </div>
      )}

      {forecastData && (
        <div className="space-y-6">
          {/* Simple Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Expected Sales */}
            <div className="bg-[#0a0a0a] border border-[#d4af37]/20 p-5">
              <div className="text-sm text-[#b8a070] mb-2">Expected Sales</div>
              <div className="text-2xl font-bold text-[#d4af37]">
                {formatCurrency(forecastData.predictedSales)}
              </div>
              <div className="text-xs text-[#b8a070] mt-1">{forecastData.period}</div>
            </div>

            {/* Expected Orders */}
            <div className="bg-[#0a0a0a] border border-[#d4af37]/20 p-5">
              <div className="text-sm text-[#b8a070] mb-2">Expected Orders</div>
              <div className="text-2xl font-bold text-[#d4af37]">
                {forecastData.predictedOrders.toLocaleString()}
              </div>
              <div className="text-xs text-[#b8a070] mt-1">{forecastData.period}</div>
            </div>

            {/* Trend */}
            <div className="bg-[#0a0a0a] border border-[#d4af37]/20 p-5">
              <div className="text-sm text-[#b8a070] mb-2">Sales Trend</div>
              <div
                className="text-2xl font-bold"
                style={{ color: getTrendLabel(forecastData.trend).color }}
              >
                {getTrendLabel(forecastData.trend).text}
              </div>
              <div className="text-xs text-[#b8a070] mt-1">Based on history</div>
            </div>
          </div>

          {/* What This Means - Simple Explanation */}
          <div className="bg-[#0a0a0a] border border-[#d4af37]/20 p-5">
            <h3 className="text-lg font-semibold text-[#d4af37] mb-3">What This Means</h3>
            <div className="space-y-2 text-[#f5e6d3]">
              <p>
                Based on your past {forecastData.historicalData.length} months of sales,
                we expect you to earn approximately <strong className="text-[#d4af37]">{formatCurrency(forecastData.predictedSales)}</strong> from
                around <strong className="text-[#d4af37]">{forecastData.predictedOrders} orders</strong> in the {forecastData.period.toLowerCase()}.
              </p>
              {forecastData.trend === 'increasing' && (
                <p className="text-green-400">
                  Your sales are showing growth. Keep up the good work!
                </p>
              )}
              {forecastData.trend === 'decreasing' && (
                <p className="text-red-400">
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
          <div className="bg-[#0a0a0a] border border-[#d4af37]/20 p-5">
            <h3 className="text-lg font-semibold text-[#d4af37] mb-4">Sales History & Forecast</h3>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 11, fill: '#b8a070' }}
                    angle={-45}
                    textAnchor="end"
                    height={60}
                    stroke="#444"
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#b8a070' }}
                    tickFormatter={(value) => `₱${(value / 1000).toFixed(0)}k`}
                    stroke="#444"
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1a1a1a',
                      border: '1px solid #d4af37',
                      color: '#f5e6d3'
                    }}
                    formatter={(value: any, name: any, props: any) => [
                      formatCurrency(value),
                      props.payload.type === 'historical' ? 'Actual Sales' : 'Predicted Sales'
                    ]}
                    labelFormatter={(label) => label}
                    labelStyle={{ color: '#d4af37' }}
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
                <span className="text-[#f5e6d3]">Past Sales</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-green-500"></div>
                <span className="text-[#f5e6d3]">Predicted Sales</span>
              </div>
            </div>
          </div>

          {/* Monthly Breakdown */}
          <div className="bg-[#0a0a0a] border border-[#d4af37]/20 p-5">
            <h3 className="text-lg font-semibold text-[#d4af37] mb-4">Monthly Predictions</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={forecastData.monthlyBreakdown}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 11, fill: '#b8a070' }}
                    stroke="#444"
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#b8a070' }}
                    tickFormatter={(value) => `₱${(value / 1000).toFixed(0)}k`}
                    stroke="#444"
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1a1a1a',
                      border: '1px solid #d4af37',
                      color: '#f5e6d3'
                    }}
                    formatter={(value: any) => [formatCurrency(value), 'Expected Sales']}
                    labelStyle={{ color: '#d4af37' }}
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
                  <tr className="border-b border-[#d4af37]/20">
                    <th className="text-left py-2 text-[#b8a070]">Month</th>
                    <th className="text-right py-2 text-[#b8a070]">Expected Sales</th>
                  </tr>
                </thead>
                <tbody>
                  {forecastData.monthlyBreakdown.map((item, index) => (
                    <tr key={index} className="border-b border-[#d4af37]/10">
                      <td className="py-2 text-[#f5e6d3]">{item.month}</td>
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
