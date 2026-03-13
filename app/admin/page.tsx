// app/admin/page.tsx
"use client";

import React, { useState, useEffect } from "react";
import { ShoppingBag, BarChart3, Package, TrendingUp, TrendingDown, ArrowRight, AlertTriangle, CheckCircle, XCircle, Activity } from "lucide-react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  AreaChart,
  Area,
} from "recharts";
import { useRouter } from "next/navigation";
import { useTheme } from "@/contexts/ThemeContext";

interface DashboardStats {
  totalUsers: number;
  totalOrders: number;
  revenue: number;
  totalProducts: number;
  userGrowth: number;
  orderGrowth: number;
  revenueGrowth: number;
  productGrowth: number;
}

interface RecentOrder {
  id: string;
  amount: number;
  customerName: string;
  status: string;
  createdAt: string;
}

interface TopProduct {
  id: string;
  name: string;
  soldCount: number;
  price: number;
}

interface DashboardData {
  stats: DashboardStats;
  recentOrders: RecentOrder[];
  topProducts: TopProduct[];
}

interface AnalyticsData {
  revenueTrend: { date: string; label: string; revenue: number; orders: number }[];
  ordersByStatus: { status: string; count: number; color: string }[];
  salesByCategory: { category: string; revenue: number; quantity: number }[];
  revenueByDay: { day: string; revenue: number; orders: number }[];
  monthlyComparison: { month: string; revenue: number; orders: number }[];
  inventoryStatus: {
    total: number;
    healthy: number;
    lowStock: number;
    outOfStock: number;
    healthyPercent: number;
  };
  fulfillmentRate: number;
  peakHours: { hour: number; orders: number }[];
  performanceMetrics: {
    conversionRate: number;
    avgItemsPerOrder: number;
    repeatCustomerRate: number;
  };
  summary: {
    thisWeekRevenue: number;
    lastWeekRevenue: number;
    revenueGrowth: number;
    thisWeekOrders: number;
    lastWeekOrders: number;
    ordersGrowth: number;
    avgOrderValue: number;
    totalOrdersLast30Days: number;
    thisMonthRevenue: number;
    lastMonthRevenue: number;
    monthlyGrowth: number;
  };
}

// Utility functions
const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

const formatTimeAgo = (dateString: string) => {
  const date = new Date(dateString);
  const now = new Date();
  const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));

  if (diffInMinutes < 1) return "Just now";
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
  if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
  return `${Math.floor(diffInMinutes / 1440)}d ago`;
};

// Skeleton components — module-level, use dark: Tailwind variants
const Skeleton = ({ className }: { className?: string }) => (
  <div className={`animate-pulse bg-[#D4AF37]/10 rounded ${className}`} />
);

const StatsCardSkeleton = () => (
  <div className="bg-[#faf8f3] dark:bg-[#1c1a14] p-6 border border-[#e8e0d0] dark:border-[#2e2a1e] rounded-sm shadow-sm">
    <div className="flex items-center justify-between">
      <div className="flex-1">
        <Skeleton className="h-4 w-20 mb-3" />
        <Skeleton className="h-8 w-16" />
      </div>
      <div className="p-3 bg-[#D4AF37]/10 rounded-sm">
        <Skeleton className="w-6 h-6" />
      </div>
    </div>
    <div className="mt-4">
      <Skeleton className="h-4 w-32" />
    </div>
  </div>
);

const ChartSkeleton = () => (
  <div className="bg-[#faf8f3] dark:bg-[#1c1a14] p-6 border border-[#e8e0d0] dark:border-[#2e2a1e] rounded-sm shadow-sm">
    <Skeleton className="h-6 w-40 mb-6" />
    <Skeleton className="h-64 w-full" />
  </div>
);

// Custom chart tooltip — module-level, use dark: Tailwind variants
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white dark:bg-[#1c1a14] border border-[#e8e0d0] dark:border-[#2e2a1e] shadow-lg rounded-sm p-3">
        <p className="text-[#8B6914] dark:text-[#D4AF37] font-semibold mb-1 text-sm">{label}</p>
        {payload.map((entry: any, index: number) => (
          <p key={index} className="text-sm text-[#1c1810] dark:text-[#f0e8d8]">
            {entry.name}:{" "}
            {entry.name === "revenue" ? formatCurrency(entry.value) : entry.value}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export default function DashboardPage() {
  const router = useRouter();
  const { themeClasses, isDark } = useTheme();
  const [isLoading, setIsLoading] = useState(true);
  const [data, setData] = useState<DashboardData | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Chart color constants — must be JS values for Recharts SVG props, so driven by isDark
  const CHART_AXIS_COLOR = isDark ? "#9a8a68" : "#9a8a6a";
  const CHART_GRID_COLOR = isDark ? "#2e2a1e" : "#ede8df";
  const CHART_TOOLTIP_STYLE = {
    backgroundColor: isDark ? "#1c1a14" : "#ffffff",
    border: `1px solid ${isDark ? "#2e2a1e" : "#e8e0d0"}`,
    color: isDark ? "#f0e8d8" : "#1c1810",
    borderRadius: "2px",
    boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const [dashboardRes, analyticsRes] = await Promise.all([
          fetch("/api/admin/dashboard"),
          fetch("/api/admin/dashboard/analytics"),
        ]);

        const dashboardResult = await dashboardRes.json();
        const analyticsResult = await analyticsRes.json();

        if (!dashboardResult.success) {
          throw new Error(dashboardResult.error || "Failed to fetch dashboard data");
        }

        setData(dashboardResult.data);

        if (analyticsResult.success) {
          setAnalytics(analyticsResult.data);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error occurred");
        console.error("Dashboard fetch error:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  if (isLoading) {
    return (
      <div className="space-y-8 min-h-screen">
        <div className="grid grid-cols-2 gap-6">
          <StatsCardSkeleton />
          <StatsCardSkeleton />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className={`${themeClasses.bgSecondary} p-6 border ${themeClasses.border} rounded-sm shadow-sm`}>
            <Skeleton className="h-6 w-40 mb-6" />
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map((item) => (
                <div key={item} className={`flex items-center justify-between py-3 border-b ${themeClasses.border}`}>
                  <div className="flex items-center space-x-4">
                    <Skeleton className="w-10 h-10 rounded-sm" />
                    <div>
                      <Skeleton className="h-4 w-32 mb-2" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                  </div>
                  <div className="text-right">
                    <Skeleton className="h-4 w-20 mb-2" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className={`${themeClasses.bgSecondary} p-6 border ${themeClasses.border} rounded-sm shadow-sm`}>
            <Skeleton className="h-6 w-40 mb-6" />
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map((item) => (
                <div key={item} className={`flex items-center justify-between py-3 border-b ${themeClasses.border}`}>
                  <div className="flex items-center space-x-4">
                    <Skeleton className="w-10 h-10 rounded-sm" />
                    <div>
                      <Skeleton className="h-4 w-32 mb-2" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                  </div>
                  <Skeleton className="h-4 w-20" />
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ChartSkeleton />
          <ChartSkeleton />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <ChartSkeleton />
          <ChartSkeleton />
          <ChartSkeleton />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="text-red-500 text-lg mb-2 font-medium">Error loading dashboard</div>
          <div className={`${themeClasses.textMuted} text-sm`}>{error}</div>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-5 py-2.5 bg-[#D4AF37] text-[#1c1810] font-semibold hover:bg-[#C4A030] transition-colors rounded-sm text-sm"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!data) {
    return <div className={`text-center py-8 ${themeClasses.textMuted}`}>No data available</div>;
  }

  return (
    <div className="space-y-8 min-h-screen">

      {/* Summary Stats */}
      <div className="grid grid-cols-2 gap-6">
        <div className={`${themeClasses.bgSecondary} p-6 border ${themeClasses.border} rounded-sm shadow-sm hover:shadow-md hover:border-[#D4AF37]/30 transition-all duration-200`}>
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-sm ${themeClasses.textMuted} mb-1 font-medium`}>Total Revenue</p>
              <p className={`text-3xl font-bold ${themeClasses.accent}`}>{formatCurrency(data.stats.revenue)}</p>
            </div>
            <div className="p-3 bg-[#D4AF37]/10 border border-[#D4AF37]/25 rounded-sm">
              <BarChart3 className={`w-6 h-6 ${themeClasses.accent}`} />
            </div>
          </div>
        </div>
        <div className={`${themeClasses.bgSecondary} p-6 border ${themeClasses.border} rounded-sm shadow-sm hover:shadow-md hover:border-[#D4AF37]/30 transition-all duration-200`}>
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-sm ${themeClasses.textMuted} mb-1 font-medium`}>Total Orders</p>
              <p className={`text-3xl font-bold ${themeClasses.accent}`}>{data.stats.totalOrders.toLocaleString()}</p>
            </div>
            <div className="p-3 bg-[#D4AF37]/10 border border-[#D4AF37]/25 rounded-sm">
              <ShoppingBag className={`w-6 h-6 ${themeClasses.accent}`} />
            </div>
          </div>
        </div>
      </div>

      {/* Recent Orders and Top Products */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className={`${themeClasses.bgSecondary} p-6 border ${themeClasses.border} rounded-sm shadow-sm`}>
          <div className="flex items-center justify-between mb-6">
            <h3 className={`text-lg font-bold ${themeClasses.text}`}>Recent Orders</h3>
            <button
              onClick={() => router.push("/admin/orders")}
              className={`text-sm ${themeClasses.textMuted} hover:text-[#8B6914] dark:hover:text-[#D4AF37] flex items-center gap-1 transition-colors font-medium`}
            >
              View All <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="space-y-1">
            {data.recentOrders.length > 0 ? (
              data.recentOrders.map((order) => (
                <div
                  key={order.id}
                  className={`flex items-center justify-between py-3 border-b ${themeClasses.border} last:border-b-0 ${themeClasses.hoverBg} rounded-sm px-2 transition-colors`}
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-9 h-9 bg-[#D4AF37]/10 border border-[#D4AF37]/25 rounded-sm flex items-center justify-center">
                      <Package className={`w-4 h-4 ${themeClasses.accent}`} />
                    </div>
                    <div>
                      <p className={`font-semibold ${themeClasses.text} text-sm line-clamp-1`}>
                        Order #{order.id.slice(0, 8)}
                      </p>
                      <p className={`text-xs ${themeClasses.textMuted}`}>{order.customerName}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`font-semibold ${themeClasses.accent} text-sm`}>{formatCurrency(order.amount)}</p>
                    <p className={`text-xs ${themeClasses.textMuted}`}>{formatTimeAgo(order.createdAt)}</p>
                  </div>
                </div>
              ))
            ) : (
              <div className={`text-center py-8 ${themeClasses.textMuted}`}>No recent orders</div>
            )}
          </div>
        </div>

        <div className={`${themeClasses.bgSecondary} p-6 border ${themeClasses.border} rounded-sm shadow-sm`}>
          <div className="flex items-center justify-between mb-6">
            <h3 className={`text-lg font-bold ${themeClasses.text}`}>Top Products</h3>
            <button
              onClick={() => router.push("/admin/products")}
              className={`text-sm ${themeClasses.textMuted} hover:text-[#8B6914] dark:hover:text-[#D4AF37] flex items-center gap-1 transition-colors font-medium`}
            >
              View All <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="space-y-1">
            {data.topProducts.length > 0 ? (
              data.topProducts.map((product, index) => (
                <div
                  key={product.id}
                  className={`flex items-center justify-between py-3 border-b ${themeClasses.border} last:border-b-0 ${themeClasses.hoverBg} rounded-sm px-2 transition-colors`}
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-9 h-9 bg-[#D4AF37] rounded-sm flex items-center justify-center text-[#1c1810] font-bold text-sm flex-shrink-0">
                      {index + 1}
                    </div>
                    <div>
                      <p className={`font-semibold ${themeClasses.text} text-sm`}>{product.name}</p>
                      <p className={`text-xs ${themeClasses.textMuted}`}>{product.soldCount} sold</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`font-semibold ${themeClasses.accent} text-sm`}>{formatCurrency(product.price)}</p>
                  </div>
                </div>
              ))
            ) : (
              <div className={`text-center py-8 ${themeClasses.textMuted}`}>No product data</div>
            )}
          </div>
        </div>
      </div>

      {/* Analytics Charts Row */}
      {analytics && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Revenue Trend */}
          <div className={`${themeClasses.bgSecondary} p-6 border ${themeClasses.border} rounded-sm shadow-sm`}>
            <div className="flex items-center justify-between mb-6">
              <h3 className={`text-lg font-bold ${themeClasses.text}`}>Revenue Trend</h3>
              <span className={`text-xs ${themeClasses.textMuted} ${themeClasses.bgTertiary} px-2.5 py-1 rounded-full font-medium`}>Last 14 days</span>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={analytics.revenueTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_COLOR} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: CHART_AXIS_COLOR }} stroke={CHART_GRID_COLOR} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: CHART_AXIS_COLOR }} stroke={CHART_GRID_COLOR} tickLine={false} tickFormatter={(v) => `₱${(v / 1000).toFixed(0)}k`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Line type="monotone" dataKey="revenue" name="revenue" stroke="#D4AF37" strokeWidth={2.5} dot={{ fill: "#D4AF37", strokeWidth: 0, r: 4 }} activeDot={{ r: 6, fill: "#8B6914" }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Orders by Status */}
          <div className={`${themeClasses.bgSecondary} p-6 border ${themeClasses.border} rounded-sm shadow-sm`}>
            <div className="flex items-center justify-between mb-6">
              <h3 className={`text-lg font-bold ${themeClasses.text}`}>Orders by Status</h3>
              <span className={`text-xs ${themeClasses.textMuted} ${themeClasses.bgTertiary} px-2.5 py-1 rounded-full font-medium`}>All time</span>
            </div>
            <div className="h-64 flex items-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={analytics.ordersByStatus}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="count"
                    nameKey="status"
                    label={({ status, percent }) => `${status} ${(percent * 100).toFixed(0)}%`}
                    labelLine={{ stroke: CHART_AXIS_COLOR, strokeWidth: 1 }}
                  >
                    {analytics.ordersByStatus.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={(value: number, name: string) => [`${value} orders`, name]} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Category Sales + Quick Stats */}
      {analytics && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className={`lg:col-span-2 ${themeClasses.bgSecondary} p-6 border ${themeClasses.border} rounded-sm shadow-sm`}>
            <div className="flex items-center justify-between mb-6">
              <h3 className={`text-lg font-bold ${themeClasses.text}`}>Sales by Category</h3>
              <button onClick={() => router.push("/admin/reports")} className={`text-sm ${themeClasses.textMuted} hover:text-[#8B6914] dark:hover:text-[#D4AF37] flex items-center gap-1 transition-colors font-medium`}>
                View Details <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analytics.salesByCategory} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_COLOR} />
                  <XAxis type="number" tick={{ fontSize: 11, fill: CHART_AXIS_COLOR }} stroke={CHART_GRID_COLOR} tickFormatter={(v) => `₱${(v / 1000).toFixed(0)}k`} />
                  <YAxis type="category" dataKey="category" tick={{ fontSize: 11, fill: CHART_AXIS_COLOR }} stroke={CHART_GRID_COLOR} width={100} />
                  <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={(value: number) => [formatCurrency(value), "Revenue"]} />
                  <Bar dataKey="revenue" fill="#D4AF37" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className={`${themeClasses.bgSecondary} p-6 border ${themeClasses.border} rounded-sm shadow-sm`}>
            <h3 className={`text-lg font-bold ${themeClasses.text} mb-6`}>Quick Stats</h3>
            <div className="space-y-4">
              <div className={`p-4 ${themeClasses.bg} border ${themeClasses.border} rounded-sm`}>
                <div className={`text-xs ${themeClasses.textMuted} mb-1 font-medium uppercase tracking-wide`}>This Week Revenue</div>
                <div className={`text-xl font-bold ${themeClasses.text}`}>{formatCurrency(analytics.summary.thisWeekRevenue)}</div>
                <div className={`text-xs ${themeClasses.textMuted} mt-1`}>vs {formatCurrency(analytics.summary.lastWeekRevenue)} last week</div>
              </div>
              <div className={`p-4 ${themeClasses.bg} border ${themeClasses.border} rounded-sm`}>
                <div className={`text-xs ${themeClasses.textMuted} mb-1 font-medium uppercase tracking-wide`}>This Week Orders</div>
                <div className={`text-xl font-bold ${themeClasses.text}`}>{analytics.summary.thisWeekOrders}</div>
                <div className={`text-xs ${themeClasses.textMuted} mt-1`}>vs {analytics.summary.lastWeekOrders} last week</div>
              </div>
              <div className={`p-4 ${themeClasses.bg} border ${themeClasses.border} rounded-sm`}>
                <div className={`text-xs ${themeClasses.textMuted} mb-1 font-medium uppercase tracking-wide`}>Last 30 Days</div>
                <div className={`text-xl font-bold ${themeClasses.text}`}>{analytics.summary.totalOrdersLast30Days} orders</div>
                <div className={`text-xs ${themeClasses.textMuted} mt-1`}>Avg. {formatCurrency(analytics.summary.avgOrderValue)} per order</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Analytics Summary */}
      {analytics && (
        <div className={`${isDark ? themeClasses.bgSecondary : 'bg-gradient-to-r from-[#faf8f3] to-[#f5f0e8]'} p-6 border ${themeClasses.border} rounded-sm shadow-sm`}>
          <div className="flex items-center gap-3 mb-6">
            <Activity className={`w-5 h-5 ${themeClasses.accent}`} />
            <h3 className={`text-lg font-bold ${themeClasses.text}`}>Analytics Summary</h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {[
              { value: String(analytics.summary.totalOrdersLast30Days), label: "Orders (30 days)", gold: true },
              { value: formatCurrency(analytics.summary.avgOrderValue), label: "Avg Order Value", gold: false },
              { value: `${analytics.fulfillmentRate}%`, label: "Fulfillment Rate", green: true },
              { value: String(analytics.performanceMetrics.avgItemsPerOrder), label: "Items per Order", gold: false },
              { value: analytics.peakHours[0] ? `${analytics.peakHours[0].hour}:00` : "N/A", label: "Peak Hour", gold: true },
              {
                value: `${analytics.summary.monthlyGrowth >= 0 ? "+" : ""}${analytics.summary.monthlyGrowth}%`,
                label: "Monthly Growth",
                growth: analytics.summary.monthlyGrowth,
              },
            ].map((item, i) => (
              <div key={i} className={`${themeClasses.bg} p-4 border ${themeClasses.border} rounded-sm text-center hover:border-[#D4AF37]/40 transition-colors`}>
                <div className={`text-xl font-bold mb-1 ${
                  item.green ? "text-green-600 dark:text-green-400" :
                  item.growth !== undefined ? (item.growth >= 0 ? "text-green-600 dark:text-green-400" : "text-red-500 dark:text-red-400") :
                  item.gold ? themeClasses.accent : themeClasses.text
                }`}>
                  {item.value}
                </div>
                <div className={`text-xs ${themeClasses.textMuted} font-medium`}>{item.label}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Revenue by Day + Monthly Comparison + Inventory */}
      {analytics && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className={`${themeClasses.bgSecondary} p-6 border ${themeClasses.border} rounded-sm shadow-sm`}>
            <div className="flex items-center justify-between mb-6">
              <h3 className={`text-base font-bold ${themeClasses.text}`}>Revenue by Day</h3>
              <span className={`text-xs ${themeClasses.textMuted} ${themeClasses.bgTertiary} px-2 py-1 rounded-full font-medium`}>Last 30 days</span>
            </div>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analytics.revenueByDay}>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_COLOR} />
                  <XAxis dataKey="day" tick={{ fontSize: 11, fill: CHART_AXIS_COLOR }} stroke={CHART_GRID_COLOR} />
                  <YAxis tick={{ fontSize: 10, fill: CHART_AXIS_COLOR }} stroke={CHART_GRID_COLOR} tickFormatter={(v) => `₱${(v / 1000).toFixed(0)}k`} />
                  <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={(value: number) => [formatCurrency(value), "Revenue"]} />
                  <Bar dataKey="revenue" fill="#D4AF37" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className={`${themeClasses.bgSecondary} p-6 border ${themeClasses.border} rounded-sm shadow-sm`}>
            <div className="flex items-center justify-between mb-6">
              <h3 className={`text-base font-bold ${themeClasses.text}`}>Monthly Comparison</h3>
              <div className={`flex items-center gap-1 text-sm font-semibold ${analytics.summary.monthlyGrowth >= 0 ? "text-green-600 dark:text-green-400" : "text-red-500 dark:text-red-400"}`}>
                {analytics.summary.monthlyGrowth >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                {analytics.summary.monthlyGrowth >= 0 ? "+" : ""}{analytics.summary.monthlyGrowth}%
              </div>
            </div>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analytics.monthlyComparison} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_COLOR} />
                  <XAxis type="number" tick={{ fontSize: 10, fill: CHART_AXIS_COLOR }} stroke={CHART_GRID_COLOR} tickFormatter={(v) => `₱${(v / 1000).toFixed(0)}k`} />
                  <YAxis type="category" dataKey="month" tick={{ fontSize: 11, fill: CHART_AXIS_COLOR }} stroke={CHART_GRID_COLOR} width={80} />
                  <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={(value: number, name: string) => [name === "revenue" ? formatCurrency(value) : value, name === "revenue" ? "Revenue" : "Orders"]} />
                  <Bar dataKey="revenue" fill="#D4AF37" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className={`${themeClasses.bgSecondary} p-6 border ${themeClasses.border} rounded-sm shadow-sm`}>
            <div className="flex items-center justify-between mb-6">
              <h3 className={`text-base font-bold ${themeClasses.text}`}>Inventory Status</h3>
              <button onClick={() => router.push("/admin/management/inventory-alerts")} className={`text-sm ${themeClasses.textMuted} hover:text-[#8B6914] dark:hover:text-[#D4AF37] flex items-center gap-1 transition-colors font-medium`}>
                Details <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-900 rounded-sm">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
                  <span className={`${themeClasses.text} text-sm font-medium`}>Healthy Stock</span>
                </div>
                <span className="text-lg font-bold text-green-600 dark:text-green-400">{analytics.inventoryStatus.healthy}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-sm">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  <span className={`${themeClasses.text} text-sm font-medium`}>Low Stock</span>
                </div>
                <span className="text-lg font-bold text-amber-600 dark:text-amber-400">{analytics.inventoryStatus.lowStock}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-sm">
                <div className="flex items-center gap-2">
                  <XCircle className="w-4 h-4 text-red-500 dark:text-red-400" />
                  <span className={`${themeClasses.text} text-sm font-medium`}>Out of Stock</span>
                </div>
                <span className="text-lg font-bold text-red-500 dark:text-red-400">{analytics.inventoryStatus.outOfStock}</span>
              </div>
              <div className={`mt-3 pt-3 border-t ${themeClasses.border}`}>
                <div className="flex justify-between text-sm mb-2">
                  <span className={`${themeClasses.textMuted} font-medium`}>Total Products</span>
                  <span className={`${themeClasses.text} font-bold`}>{analytics.inventoryStatus.total}</span>
                </div>
                <div className={`h-2 rounded-full overflow-hidden ${isDark ? 'bg-[#2e2a1e]' : 'bg-[#e8e0d0]'}`}>
                  <div
                    className="h-full bg-gradient-to-r from-green-500 to-[#D4AF37] rounded-full transition-all duration-500"
                    style={{ width: `${analytics.inventoryStatus.healthyPercent}%` }}
                  />
                </div>
                <div className={`text-xs ${themeClasses.textMuted} mt-1`}>{analytics.inventoryStatus.healthyPercent}% healthy</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Orders & Revenue Trend (Area) */}
      {analytics && (
        <div className={`${themeClasses.bgSecondary} p-6 border ${themeClasses.border} rounded-sm shadow-sm`}>
          <div className="flex items-center justify-between mb-6">
            <h3 className={`text-lg font-bold ${themeClasses.text}`}>Orders & Revenue Trend</h3>
            <span className={`text-xs ${themeClasses.textMuted} ${themeClasses.bgTertiary} px-2.5 py-1 rounded-full font-medium`}>Last 14 days</span>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={analytics.revenueTrend}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#D4AF37" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#D4AF37" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorOrders" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4B5563" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#4B5563" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_COLOR} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: CHART_AXIS_COLOR }} stroke={CHART_GRID_COLOR} />
                <YAxis yAxisId="left" tick={{ fontSize: 11, fill: CHART_AXIS_COLOR }} stroke={CHART_GRID_COLOR} tickFormatter={(v) => `₱${(v / 1000).toFixed(0)}k`} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: CHART_AXIS_COLOR }} stroke={CHART_GRID_COLOR} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ paddingTop: "20px" }} formatter={(value) => <span className={`${themeClasses.text} text-sm font-medium`}>{value}</span>} />
                <Area yAxisId="left" type="monotone" dataKey="revenue" name="Revenue" stroke="#D4AF37" strokeWidth={2.5} fill="url(#colorRevenue)" />
                <Area yAxisId="right" type="monotone" dataKey="orders" name="Orders" stroke="#4B5563" strokeWidth={2.5} fill="url(#colorOrders)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

    </div>
  );
}
