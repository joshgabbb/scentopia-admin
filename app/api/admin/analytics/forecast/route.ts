// app/api/admin/analytics/forecast/route.ts

import { createClient } from "@/lib/supabase/server";

interface ForecastPeriod {
  period: string;
  months: number;
}

const FORECAST_PERIODS: Record<string, ForecastPeriod> = {
  "1_month": { period: "Next Month", months: 1 },
  "3_months": { period: "Next 3 Months", months: 3 },
  "6_months": { period: "Next 6 Months", months: 6 },
  "1_year": { period: "Next Year", months: 12 }
};

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

// Simple linear regression for trend analysis
function linearRegression(data: number[]): { slope: number; intercept: number; r2: number } {
  if (data.length < 2) {
    return { slope: 0, intercept: 0, r2: 0 };
  }

  const n = data.length;
  const x = Array.from({ length: n }, (_, i) => i);
  
  const sumX = x.reduce((a, b) => a + b, 0);
  const sumY = data.reduce((a, b) => a + b, 0);
  const sumXY = x.reduce((acc, xi, i) => acc + xi * data[i], 0);
  const sumXX = x.reduce((acc, xi) => acc + xi * xi, 0);
  const sumYY = data.reduce((acc, yi) => acc + yi * yi, 0);
  
  const denominator = n * sumXX - sumX * sumX;
  if (denominator === 0) {
    return { slope: 0, intercept: sumY / n, r2: 0 };
  }

  const slope = (n * sumXY - sumX * sumY) / denominator;
  const intercept = (sumY - slope * sumX) / n;
  
  // Calculate R-squared
  const yMean = sumY / n;
  const ssRes = data.reduce((acc, yi, i) => {
    const predicted = slope * i + intercept;
    return acc + Math.pow(yi - predicted, 2);
  }, 0);
  const ssTot = data.reduce((acc, yi) => acc + Math.pow(yi - yMean, 2), 0);
  const r2 = ssTot === 0 ? 1 : Math.max(0, Math.min(1, 1 - (ssRes / ssTot)));
  
  return { slope, intercept, r2 };
}

// Calculate seasonal adjustment
function calculateSeasonality(monthlyData: MonthlyData[]): Record<number, number> {
  const monthlyAverages: Record<number, number[]> = {};
  
  monthlyData.forEach(data => {
    try {
      const monthParts = data.month.split('-');
      if (monthParts.length !== 2) return;
      
      const month = parseInt(monthParts[1]) - 1; // 0-based month
      if (month < 0 || month > 11) return;
      
      if (!monthlyAverages[month]) {
        monthlyAverages[month] = [];
      }
      monthlyAverages[month].push(data.totalSales);
    } catch (error) {
      console.error('Error parsing month in seasonality calculation:', error);
    }
  });
  
  const seasonalFactors: Record<number, number> = {};
  const overallAverage = monthlyData.length > 0 
    ? monthlyData.reduce((sum, data) => sum + data.totalSales, 0) / monthlyData.length 
    : 0;
  
  for (let month = 0; month < 12; month++) {
    if (monthlyAverages[month] && monthlyAverages[month].length > 0) {
      const monthAverage = monthlyAverages[month].reduce((a, b) => a + b, 0) / monthlyAverages[month].length;
      seasonalFactors[month] = overallAverage > 0 ? monthAverage / overallAverage : 1;
    } else {
      seasonalFactors[month] = 1;
    }
  }
  
  return seasonalFactors;
}

// Calculate forecast confidence based on data quality
function calculateConfidence(
  r2: number, 
  dataPoints: number, 
  variance: number, 
  forecastMonths: number
): number {
  // Base confidence from R-squared
  let confidence = Math.max(0, r2) * 100;
  
  // Adjust for data quantity
  const dataQualityFactor = Math.min(1, dataPoints / 12); // Ideal: 12+ months
  confidence *= dataQualityFactor;
  
  // Penalize longer forecasts
  const forecastPenalty = Math.max(0.3, 1 - (forecastMonths / 12) * 0.3);
  confidence *= forecastPenalty;
  
  // Adjust for variance (lower variance = higher confidence)
  if (variance > 0) {
    const varianceFactor = Math.max(0.5, 1 - Math.min(variance / 10000, 0.5));
    confidence *= varianceFactor;
  }
  
  return Math.max(10, Math.min(95, confidence));
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const forecastType = searchParams.get('period') || '3_months';
    
    if (!FORECAST_PERIODS[forecastType]) {
      return Response.json(
        { error: 'Invalid forecast period' },
        { status: 400 }
      );
    }
    
    const supabase = await createClient();
    
    // Check if supabase client was created successfully
    if (!supabase) {
      throw new Error('Failed to create Supabase client');
    }
    
    // Fetch orders data from the last 2 years for better forecasting
    const twoYearsAgo = new Date();
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
    
    const { data: orders, error } = await supabase
      .from('orders')
      .select('amount, created_at')
      .gte('created_at', twoYearsAgo.toISOString())
      .neq('order_status', 'Cancelled') // Use neq instead of not + eq
      .order('created_at', { ascending: true });
    
    if (error) {
      console.error('Supabase query error:', error);
      throw new Error(`Database query failed: ${error.message}`);
    }
    
    if (!orders || orders.length === 0) {
      return Response.json({
        period: FORECAST_PERIODS[forecastType].period,
        months: FORECAST_PERIODS[forecastType].months,
        predictedSales: 0,
        predictedOrders: 0,
        predictedAOV: 0,
        confidence: 0,
        trend: 'stable' as const,
        seasonality: 1,
        historicalData: [],
        monthlyBreakdown: []
      });
    }
    
    // Group orders by month
    const monthlyData: Record<string, MonthlyData> = {};
    
    orders.forEach(order => {
      try {
        const date = new Date(order.created_at);
        if (isNaN(date.getTime())) {
          console.warn('Invalid date found:', order.created_at);
          return;
        }
        
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        const amount = Number(order.amount) || 0;
        
        if (!monthlyData[monthKey]) {
          monthlyData[monthKey] = {
            month: monthKey,
            year: date.getFullYear(),
            totalSales: 0,
            orderCount: 0,
            averageOrderValue: 0
          };
        }
        
        monthlyData[monthKey].totalSales += amount;
        monthlyData[monthKey].orderCount += 1;
      } catch (error) {
        console.error('Error processing order:', error, order);
      }
    });
    
    // Calculate average order values
    Object.values(monthlyData).forEach(data => {
      data.averageOrderValue = data.orderCount > 0 ? data.totalSales / data.orderCount : 0;
    });
    
    const historicalData = Object.values(monthlyData).sort((a, b) => {
      return new Date(a.month).getTime() - new Date(b.month).getTime();
    });
    
    if (historicalData.length < 3) {
      return Response.json({
        period: FORECAST_PERIODS[forecastType].period,
        months: FORECAST_PERIODS[forecastType].months,
        predictedSales: 0,
        predictedOrders: 0,
        predictedAOV: 0,
        confidence: 20,
        trend: 'stable' as const,
        seasonality: 1,
        historicalData,
        monthlyBreakdown: []
      });
    }
    
    // Perform linear regression on sales data
    const salesData = historicalData.map(d => d.totalSales);
    const ordersData = historicalData.map(d => d.orderCount);
    const aovData = historicalData.map(d => d.averageOrderValue);
    
    const salesRegression = linearRegression(salesData);
    const ordersRegression = linearRegression(ordersData);
    const aovRegression = linearRegression(aovData);
    
    // Calculate variance for confidence calculation
    const salesMean = salesData.reduce((a, b) => a + b, 0) / salesData.length;
    const salesVariance = salesData.reduce((acc, val) => {
      return acc + Math.pow(val - salesMean, 2);
    }, 0) / salesData.length;
    
    // Calculate seasonality
    const seasonalFactors = calculateSeasonality(historicalData);
    
    // Determine trend
    let trend: 'increasing' | 'decreasing' | 'stable' = 'stable';
    const firstSale = salesData[0] || 1;
    const slopeThreshold = firstSale * 0.05;
    
    if (salesRegression.slope > 0 && Math.abs(salesRegression.slope) > slopeThreshold) {
      trend = 'increasing';
    } else if (salesRegression.slope < 0 && Math.abs(salesRegression.slope) > slopeThreshold) {
      trend = 'decreasing';
    }
    
    // Calculate confidence
    const confidence = calculateConfidence(
      salesRegression.r2,
      historicalData.length,
      salesVariance,
      FORECAST_PERIODS[forecastType].months
    );
    
    // Generate monthly forecasts
    const currentDate = new Date();
    const monthlyBreakdown = [];
    let totalPredictedSales = 0;
    let totalPredictedOrders = 0;
    
    for (let i = 1; i <= FORECAST_PERIODS[forecastType].months; i++) {
      const futureDate = new Date(currentDate);
      futureDate.setMonth(currentDate.getMonth() + i);
      
      const nextDataPointIndex = historicalData.length + i - 1;
      const seasonalFactor = seasonalFactors[futureDate.getMonth()] || 1;
      
      // Apply trend and seasonality
      const baseSales = salesRegression.slope * nextDataPointIndex + salesRegression.intercept;
      const adjustedSales = Math.max(0, baseSales * seasonalFactor);
      
      const baseOrders = ordersRegression.slope * nextDataPointIndex + ordersRegression.intercept;
      const adjustedOrders = Math.max(0, baseOrders * seasonalFactor);
      
      // Adjust confidence for longer forecasts
      const monthConfidence = Math.max(10, confidence - (i - 1) * 5);
      
      monthlyBreakdown.push({
        month: `${futureDate.getFullYear()}-${String(futureDate.getMonth() + 1).padStart(2, '0')}`,
        predictedSales: Math.round(adjustedSales),
        confidence: Math.round(monthConfidence)
      });
      
      totalPredictedSales += adjustedSales;
      totalPredictedOrders += adjustedOrders;
    }
    
    const predictedAOV = totalPredictedOrders > 0 ? totalPredictedSales / totalPredictedOrders : 0;
    
    // Calculate average seasonality
    const seasonalityValues = Object.values(seasonalFactors);
    const avgSeasonality = seasonalityValues.length > 0 
      ? seasonalityValues.reduce((a, b) => a + b, 0) / seasonalityValues.length 
      : 1;
    
    const result: ForecastResult = {
      period: FORECAST_PERIODS[forecastType].period,
      months: FORECAST_PERIODS[forecastType].months,
      predictedSales: Math.round(totalPredictedSales),
      predictedOrders: Math.round(totalPredictedOrders),
      predictedAOV: Math.round(predictedAOV),
      confidence: Math.round(confidence),
      trend,
      seasonality: avgSeasonality,
      historicalData: historicalData.slice(-12), // Last 12 months only
      monthlyBreakdown
    };
    
    return Response.json(result);
    
  } catch (error) {
    console.error('Error generating sales forecast:', error);
    
    // Return a more detailed error response
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    return Response.json(
      { 
        error: 'Failed to generate sales forecast',
        details: errorMessage,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}