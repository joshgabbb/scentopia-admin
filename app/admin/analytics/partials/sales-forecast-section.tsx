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
  const [debugInfo, setDebugInfo] = useState<any>(null);

  // Fetch forecast data
  const fetchForecastData = async (period: string) => {
    try {
      setLoading(true);
      setError(null);
      setDebugInfo(null);

      console.log(`Fetching forecast data for period: ${period}`);

      const response = await fetch(`/api/admin/analytics/forecast?period=${period}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
      });

      console.log(`Response status: ${response.status}`);

      if (!response.ok) {
        // Try to get error details from response
        let errorDetails = `HTTP ${response.status}: ${response.statusText}`;
        try {
          const errorData = await response.json();
          if (errorData.error) {
            errorDetails = errorData.error;
            if (errorData.details) {
              errorDetails += ` - ${errorData.details}`;
            }
          }
          setDebugInfo(errorData);
        } catch (parseError) {
          console.error('Could not parse error response:', parseError);
          // Try to get response text
          try {
            const errorText = await response.text();
            if (errorText) {
              errorDetails += ` - ${errorText.substring(0, 200)}`;
            }
          } catch (textError) {
            console.error('Could not get error text:', textError);
          }
        }
        throw new Error(errorDetails);
      }

      const result = await response.json();
      console.log('Forecast result:', result);
      
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
      confidence: 100,
      id: `historical-${index}`
    }));

    const forecast = forecastData.monthlyBreakdown.map((data, index) => ({
      month: data.month,
      sales: data.predictedSales,
      type: 'forecast' as const,
      confidence: data.confidence,
      id: `forecast-${index}`
    }));

    return [...historical, ...forecast];
  }, [forecastData]);

  // Custom dot component with proper key handling
  const CustomDot = (props: any) => {
    const { cx, cy, payload, index } = props;
    return (
      <circle
        key={`dot-${payload.id || index}`}
        cx={cx}
        cy={cy}
        r={4}
        fill={payload.type === 'historical' ? '#3b82f6' : '#ef4444'}
        stroke={payload.type === 'historical' ? '#1d4ed8' : '#dc2626'}
        strokeWidth={2}
      />
    );
  };

  // Get confidence level styling
  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 70) return '#22c55e'; // Green
    if (confidence >= 50) return '#f59e0b'; // Yellow
    return '#ef4444'; // Red
  };

  const getConfidenceText = (confidence: number) => {
    if (confidence >= 70) return 'High Confidence';
    if (confidence >= 50) return 'Medium Confidence';
    return 'Low Confidence';
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'increasing':
        return '📈';
      case 'decreasing':
        return '📉';
      default:
        return '➡️';
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP'
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="p-6 bg-[#1a1a1a] border">
        <h2 className="text-2xl font-semibold text-[#f5e6d3] uppercase tracking-[2px] mb-4">
          SALES FORECASTING
        </h2>
        <div className="flex items-center justify-center h-64">
          <div className="flex flex-col items-center gap-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black"></div>
            <p className="text-[#b8a070]">Generating sales forecast...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-[#1a1a1a] border">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between mb-6">
        <h2 className="text-2xl font-semibold text-[#f5e6d3] uppercase tracking-[2px] mb-4 lg:mb-0">
          SALES FORECASTING
        </h2>
        
        <div className="flex items-center gap-4">
          <select
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value)}
            className="px-4 py-2 border border-[#d4af37]/20 focus:outline-none focus:ring-2 focus:ring-[#d4af37] focus:border-transparent"
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
            className="px-4 py-2 bg-black text-white hover:bg-[#d4af37]/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Loading...' : 'Refresh'}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md">
          <p className="text-red-800 mb-2">
            <strong>Error:</strong> {error}
          </p>
          {debugInfo && (
            <details className="mt-2">
              <summary className="cursor-pointer text-red-600 text-sm hover:text-red-800">
                Show Debug Information
              </summary>
              <pre className="mt-2 p-2 bg-red-100 text-xs overflow-auto max-h-40 text-red-700">
                {JSON.stringify(debugInfo, null, 2)}
              </pre>
            </details>
          )}
          <div className="mt-3 text-sm text-red-600">
            <p><strong>Troubleshooting Tips:</strong></p>
            <ul className="list-disc list-inside mt-1 space-y-1">
              <li>Check if you have orders data in your database</li>
              <li>Verify your Supabase connection is working</li>
              <li>Ensure the orders table has the correct structure</li>
              <li>Check browser console for additional error details</li>
            </ul>
          </div>
        </div>
      )}

      {forecastData && (
        <div className="space-y-8">
          {/* Forecast Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-blue-50 p-6 border">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-[#b8a070]">PREDICTED SALES</h3>
                <span className="text-2xl">{getTrendIcon(forecastData.trend)}</span>
              </div>
              <div className="text-3xl font-bold text-blue-600 mb-1">
                {formatCurrency(forecastData.predictedSales)}
              </div>
              <div className="text-sm text-gray-500">{forecastData.period}</div>
            </div>

            <div className="bg-green-50 p-6 border">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-[#b8a070]">PREDICTED ORDERS</h3>
                <span className="text-2xl">📦</span>
              </div>
              <div className="text-3xl font-bold text-green-600 mb-1">
                {forecastData.predictedOrders.toLocaleString()}
              </div>
              <div className="text-sm text-gray-500">{forecastData.period}</div>
            </div>

            <div className="bg-purple-50 p-6 border">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-[#b8a070]">AVG ORDER VALUE</h3>
                <span className="text-2xl">💰</span>
              </div>
              <div className="text-3xl font-bold text-purple-600 mb-1">
                {formatCurrency(forecastData.predictedAOV)}
              </div>
              <div className="text-sm text-gray-500">Predicted AOV</div>
            </div>

            <div 
              className="p-6 border"
              style={{ backgroundColor: `${getConfidenceColor(forecastData.confidence)}15` }}
            >
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-[#b8a070]">CONFIDENCE LEVEL</h3>
                <span className="text-2xl">🎯</span>
              </div>
              <div 
                className="text-3xl font-bold mb-1"
                style={{ color: getConfidenceColor(forecastData.confidence) }}
              >
                {forecastData.confidence}%
              </div>
              <div className="text-sm text-gray-500">
                {getConfidenceText(forecastData.confidence)}
              </div>
            </div>
          </div>

          {/* Data Quality Information */}
          <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
            <div className="flex items-center">
              <span className="text-blue-500 text-xl mr-3">ℹ️</span>
              <div>
                <h4 className="font-semibold text-blue-800">Forecast Information</h4>
                <p className="text-blue-700 text-sm">
                  This forecast is based on {forecastData.historicalData.length} months of historical data.
                  {forecastData.historicalData.length < 6 && " More historical data will improve forecast accuracy."}
                </p>
              </div>
            </div>
          </div>

          {/* Confidence Warning */}
          {forecastData.confidence < 50 && (
            <div className="bg-amber-50 border border-amber-200 rounded-md p-4">
              <div className="flex items-center">
                <span className="text-amber-500 text-xl mr-3">⚠️</span>
                <div>
                  <h4 className="font-semibold text-amber-800">Low Confidence Forecast</h4>
                  <p className="text-amber-700 text-sm">
                    This forecast has low confidence ({forecastData.confidence}%). 
                    Results may be significantly different from actual outcomes. 
                    Consider gathering more historical data for better predictions.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Sales Trend Chart */}
          <div className="bg-gray-100 p-6 border">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">
              Sales Trend & Forecast
            </h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="month" 
                    tick={{ fontSize: 12 }}
                    angle={-45}
                    textAnchor="end"
                    height={80}
                  />
                  <YAxis 
                    tick={{ fontSize: 12 }}
                    tickFormatter={(value) => `₱${(value / 1000).toFixed(0)}k`}
                  />
                  <Tooltip 
                    formatter={(value: any, name: any, props: any) => [
                      formatCurrency(value),
                      props.payload.type === 'historical' ? 'Actual Sales' : 'Predicted Sales'
                    ]}
                    labelFormatter={(label) => `Month: ${label}`}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="sales" 
                    stroke="#3b82f6"
                    strokeWidth={3}
                    dot={CustomDot}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            
            <div className="mt-4 flex items-center justify-center gap-6 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-blue-500 rounded"></div>
                <span>Historical Sales</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-red-500 rounded"></div>
                <span>Forecasted Sales</span>
              </div>
            </div>
          </div>

          {/* Monthly Breakdown */}
          <div className="bg-gray-100 p-6 border">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">
              Monthly Forecast Breakdown
            </h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={forecastData.monthlyBreakdown}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="month" 
                    tick={{ fontSize: 12 }}
                    angle={-45}
                    textAnchor="end"
                    height={80}
                  />
                  <YAxis 
                    tick={{ fontSize: 12 }}
                    tickFormatter={(value) => `₱${(value / 1000).toFixed(0)}k`}
                  />
                  <Tooltip 
                    formatter={(value: any, name: any, props: any) => [
                      formatCurrency(value),
                      `Predicted Sales (${props.payload.confidence}% confidence)`
                    ]}
                    labelFormatter={(label) => `Month: ${label}`}
                  />
                  <Bar 
                    dataKey="predictedSales" 
                    fill="#3b82f6"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Analysis Summary */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-gray-100 p-6 border">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Trend Analysis</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-[#b8a070]">Trend Direction:</span>
                  <span className="font-medium capitalize flex items-center gap-2">
                    {getTrendIcon(forecastData.trend)}
                    {forecastData.trend}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#b8a070]">Seasonality Factor:</span>
                  <span className="font-medium">
                    {(forecastData.seasonality * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#b8a070]">Data Points Used:</span>
                  <span className="font-medium">{forecastData.historicalData.length} months</span>
                </div>
              </div>
            </div>

            <div className="bg-gray-100 p-6 border">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Forecast Insights</h3>
              <div className="space-y-3 text-sm text-[#f5e6d3]">
                {forecastData.confidence >= 70 && (
                  <p>✅ High confidence forecast - reliable for planning</p>
                )}
                {forecastData.confidence >= 50 && forecastData.confidence < 70 && (
                  <p>⚠️ Medium confidence - use with caution</p>
                )}
                {forecastData.confidence < 50 && (
                  <p>❌ Low confidence - results may vary significantly</p>
                )}
                
                {forecastData.trend === 'increasing' && (
                  <p>📈 Sales showing positive growth trend</p>
                )}
                {forecastData.trend === 'decreasing' && (
                  <p>📉 Sales showing declining trend - consider action</p>
                )}
                {forecastData.trend === 'stable' && (
                  <p>➡️ Sales showing stable performance</p>
                )}
                
                <p>
                  📊 Based on {forecastData.historicalData.length} months of historical data
                </p>
                
                {forecastData.historicalData.length < 12 && (
                  <p>
                    💡 Collecting more historical data will improve forecast accuracy
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}