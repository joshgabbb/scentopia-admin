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


export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const forecastType = searchParams.get('period') || '3_months';

    if (!FORECAST_PERIODS[forecastType]) {
      return Response.json({ error: 'Invalid forecast period' }, { status: 400 });
    }

    const supabase = await createClient();

    // Fetch last 12 months of non-cancelled orders — enough for a realistic moving average
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

    const { data: orders, error } = await supabase
      .from('orders')
      .select('amount, created_at, order_status')
      .gte('created_at', twelveMonthsAgo.toISOString())
      .neq('order_status', 'Cancelled')
      .order('created_at', { ascending: true });

    if (error) throw new Error(`Database query failed: ${error.message}`);

    const emptyResult = {
      period: FORECAST_PERIODS[forecastType].period,
      months: FORECAST_PERIODS[forecastType].months,
      predictedSales: 0,
      predictedOrders: 0,
      predictedAOV: 0,
      confidence: 0,
      trend: 'stable' as const,
      seasonality: 1,
      historicalData: [],
      monthlyBreakdown: [],
    };

    if (!orders || orders.length === 0) return Response.json(emptyResult);

    // ── Group orders into calendar months ────────────────────────────────
    const monthlyMap: Record<string, MonthlyData> = {};

    for (const order of orders) {
      if (order.order_status === 'Refunded') continue;
      const date = new Date(order.created_at);
      if (isNaN(date.getTime())) continue;

      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const amount = Number(order.amount) || 0;

      if (!monthlyMap[key]) {
        monthlyMap[key] = { month: key, year: date.getFullYear(), totalSales: 0, orderCount: 0, averageOrderValue: 0 };
      }
      monthlyMap[key].totalSales += amount;
      monthlyMap[key].orderCount += 1;
    }

    const historicalData = Object.values(monthlyMap)
      .sort((a, b) => a.month.localeCompare(b.month))
      .map(d => ({ ...d, averageOrderValue: d.orderCount > 0 ? d.totalSales / d.orderCount : 0 }));

    if (historicalData.length < 2) return Response.json({ ...emptyResult, historicalData, confidence: 15 });

    // ── Weighted Moving Average (WMA) — recent months matter more ────────
    // Use up to last 6 months; weights: [1, 2, 3, 4, 5, 6] (oldest → newest)
    const WINDOW = Math.min(6, historicalData.length);
    const recentMonths = historicalData.slice(-WINDOW);
    const weights = Array.from({ length: WINDOW }, (_, i) => i + 1); // [1,2,3,4,5,6]
    const weightSum = weights.reduce((a, b) => a + b, 0);

    const wmaSales = recentMonths.reduce((sum, m, i) => sum + m.totalSales * weights[i], 0) / weightSum;
    const wmaOrders = recentMonths.reduce((sum, m, i) => sum + m.orderCount * weights[i], 0) / weightSum;

    // ── Trend: compare last 3 months avg vs previous 3 months avg ────────
    let trend: 'increasing' | 'decreasing' | 'stable' = 'stable';
    if (historicalData.length >= 4) {
      const half = Math.floor(Math.min(historicalData.length, 6) / 2);
      const older = historicalData.slice(-half * 2, -half);
      const newer = historicalData.slice(-half);
      const olderAvg = older.reduce((s, m) => s + m.totalSales, 0) / older.length;
      const newerAvg = newer.reduce((s, m) => s + m.totalSales, 0) / newer.length;
      const changePct = olderAvg > 0 ? (newerAvg - olderAvg) / olderAvg : 0;

      if (changePct > 0.05) trend = 'increasing';
      else if (changePct < -0.05) trend = 'decreasing';
    }

    // ── Confidence: higher with more data, lower for longer forecasts ─────
    const baseConfidence = Math.min(80, 40 + historicalData.length * 3);
    const forecastMonths = FORECAST_PERIODS[forecastType].months;

    // ── Monthly breakdown: WMA as the flat baseline (realistic) ──────────
    const currentDate = new Date();
    let totalPredictedSales = 0;
    let totalPredictedOrders = 0;

    const monthlyBreakdown = Array.from({ length: forecastMonths }, (_, i) => {
      const futureDate = new Date(currentDate);
      futureDate.setMonth(currentDate.getMonth() + i + 1);
      const monthKey = `${futureDate.getFullYear()}-${String(futureDate.getMonth() + 1).padStart(2, '0')}`;
      const monthConfidence = Math.max(15, baseConfidence - i * 4);

      totalPredictedSales += wmaSales;
      totalPredictedOrders += wmaOrders;

      return { month: monthKey, predictedSales: Math.round(wmaSales), confidence: Math.round(monthConfidence) };
    });

    const predictedAOV = totalPredictedOrders > 0 ? totalPredictedSales / totalPredictedOrders : 0;

    const result: ForecastResult = {
      period: FORECAST_PERIODS[forecastType].period,
      months: forecastMonths,
      predictedSales: Math.round(totalPredictedSales),
      predictedOrders: Math.round(totalPredictedOrders),
      predictedAOV: Math.round(predictedAOV),
      confidence: Math.round(baseConfidence),
      trend,
      seasonality: 1,
      historicalData,
      monthlyBreakdown,
    };

    return Response.json(result);

  } catch (error) {
    console.error('Error generating sales forecast:', error);
    return Response.json(
      { error: 'Failed to generate sales forecast', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}