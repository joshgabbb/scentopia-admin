// app/admin/page.tsx
"use client";

import React, { useState, useEffect } from "react";
import { Users, ShoppingBag, BarChart3, Package } from "lucide-react";

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

// BLACK & GOLD Skeleton components
const Skeleton = ({ className }: { className?: string }) => (
  <div className={`animate-pulse bg-[#d4af37]/10 rounded ${className}`}/>
);

const StatsCardSkeleton = () => (
  <div className="bg-[#1a1a1a] p-6 border border-[#d4af37]/20">
    <div className="flex items-center justify-between">
      <div className="flex-1">
        <Skeleton className="h-4 w-20 mb-3" />
        <Skeleton className="h-8 w-16" />
      </div>
      <div className="p-3 bg-[#d4af37]/10">
        <Skeleton className="w-6 h-6" />
      </div>
    </div>
    <div className="mt-4">
      <Skeleton className="h-4 w-32" />
    </div>
  </div>
);

const OrderItemSkeleton = () => (
  <div className="flex items-center justify-between py-3 border-b border-[#d4af37]/10 last:border-b-0">
    <div className="flex items-center space-x-4">
      <Skeleton className="w-10 h-10" />
      <div>
        <Skeleton className="h-4 w-20 mb-2" />
        <Skeleton className="h-3 w-24" />
      </div>
    </div>
    <div className="text-right">
      <Skeleton className="h-4 w-16 mb-2" />
      <Skeleton className="h-3 w-12" />
    </div>
  </div>
);

const ProductItemSkeleton = () => (
  <div className="flex items-center justify-between py-3 border-b border-[#d4af37]/10 last:border-b-0">
    <div className="flex items-center space-x-4">
      <Skeleton className="w-10 h-10" />
      <div>
        <Skeleton className="h-4 w-28 mb-2" />
        <Skeleton className="h-3 w-16" />
      </div>
    </div>
    <div className="text-right">
      <Skeleton className="h-4 w-20" />
    </div>
  </div>
);

// Utility functions
const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP'
  }).format(amount);
};

const formatTimeAgo = (dateString: string) => {
  const date = new Date(dateString);
  const now = new Date();
  const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
  
  if (diffInMinutes < 1) return 'Just now';
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
  if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
  return `${Math.floor(diffInMinutes / 1440)}d ago`;
};

export default function DashboardPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        const response = await fetch('/api/admin/dashboard');
        const result = await response.json();
        
        if (!result.success) {
          throw new Error(result.error || 'Failed to fetch data');
        }
        
        setData(result.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error occurred');
        console.error('Dashboard fetch error:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  if (isLoading) {
    return (
      <div className="space-y-8 bg-[#0a0a0a] min-h-screen">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((item) => (
            <StatsCardSkeleton key={item} />
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-[#1a1a1a] p-6 border border-[#d4af37]/20">
            <div className="flex items-center justify-between mb-6">
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-4 w-16" />
            </div>
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map((item) => (
                <OrderItemSkeleton key={item} />
              ))}
            </div>
          </div>

          <div className="bg-[#1a1a1a] p-6 border border-[#d4af37]/20">
            <div className="flex items-center justify-between mb-6">
              <Skeleton className="h-6 w-28" />
              <Skeleton className="h-4 w-20" />
            </div>
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map((item) => (
                <ProductItemSkeleton key={item} />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="text-red-400 text-lg mb-2">Error loading dashboard</div>
          <div className="text-[#b8a070] text-sm">{error}</div>
          <button 
            onClick={() => window.location.reload()} 
            className="mt-4 px-4 py-2 bg-[#d4af37] text-[#0a0a0a] hover:bg-[#d4af37]/90 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!data) {
    return <div className="text-center py-8 text-[#b8a070]">No data available</div>;
  }

  return (
    <div className="space-y-8 bg-[#0a0a0a] min-h-screen">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-[#1a1a1a] p-6 border border-[#d4af37]/20 hover:border-[#d4af37]/40 transition-colors">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[#b8a070] text-sm font-medium">Total Users</p>
              <p className="text-3xl font-bold text-[#d4af37] mt-2">{data.stats.totalUsers.toLocaleString()}</p>
            </div>
            <div className="p-3 bg-[#d4af37]">
              <Users className="w-6 h-6 text-[#0a0a0a]" />
            </div>
          </div>
          <div className="mt-4 hidden">
            <span className={`text-sm ${data.stats.userGrowth >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {data.stats.userGrowth >= 0 ? '+' : ''}{data.stats.userGrowth}% from last month
            </span>
          </div>
        </div>

        <div className="bg-[#1a1a1a] p-6 border border-[#d4af37]/20 hover:border-[#d4af37]/40 transition-colors">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[#b8a070] text-sm font-medium">Total Orders</p>
              <p className="text-3xl font-bold text-[#d4af37] mt-2">{data.stats.totalOrders.toLocaleString()}</p>
            </div>
            <div className="p-3 bg-[#d4af37]">
              <ShoppingBag className="w-6 h-6 text-[#0a0a0a]" />
            </div>
          </div>
          <div className="mt-4 hidden">
            <span className={`text-sm ${data.stats.orderGrowth >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {data.stats.orderGrowth >= 0 ? '+' : ''}{data.stats.orderGrowth}% from last month
            </span>
          </div>
        </div>

        <div className="bg-[#1a1a1a] p-6 border border-[#d4af37]/20 hover:border-[#d4af37]/40 transition-colors">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[#b8a070] text-sm font-medium">Revenue</p>
              <p className="text-3xl font-bold text-[#d4af37] mt-2">{formatCurrency(data.stats.revenue)}</p>
            </div>
            <div className="p-3 bg-[#d4af37]">
              <BarChart3 className="w-6 h-6 text-[#0a0a0a]" />
            </div>
          </div>
          <div className="mt-4 hidden">
            <span className={`text-sm ${data.stats.revenueGrowth >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {data.stats.revenueGrowth >= 0 ? '+' : ''}{data.stats.revenueGrowth}% from last month
            </span>
          </div>
        </div>

        <div className="bg-[#1a1a1a] p-6 border border-[#d4af37]/20 hover:border-[#d4af37]/40 transition-colors">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[#b8a070] text-sm font-medium">Products</p>
              <p className="text-3xl font-bold text-[#d4af37] mt-2">{data.stats.totalProducts.toLocaleString()}</p>
            </div>
            <div className="p-3 bg-[#d4af37]">
              <Package className="w-6 h-6 text-[#0a0a0a]" />
            </div>
          </div>
          <div className="mt-4 hidden">
            <span className={`text-sm ${data.stats.productGrowth >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {data.stats.productGrowth >= 0 ? '+' : ''}{data.stats.productGrowth}% from last month
            </span>
          </div>
        </div>
      </div>

      {/* Orders and Top Products */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-[#1a1a1a] p-6 border border-[#d4af37]/20">
          <h3 className="text-xl font-bold text-[#d4af37] mb-6">Recent Orders</h3>
          <div className="space-y-4">
            {data.recentOrders.length > 0 ? (
              data.recentOrders.map((order) => (
                <div
                  key={order.id}
                  className="flex items-center justify-between py-3 border-b border-[#d4af37]/10 last:border-b-0"
                >
                  <div className="flex items-center space-x-4">
                    <div className="w-10 h-10 bg-[#d4af37]/10 border border-[#d4af37]/20 flex items-center justify-center">
                      <Package className="w-5 h-5 text-[#d4af37]" />
                    </div>
                    <div>
                      <p className="font-medium text-[#f5e6d3] line-clamp-1">Order #{order.id}</p>
                      <p className="text-sm text-[#b8a070]">{order.customerName}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-[#d4af37]">{formatCurrency(order.amount)}</p>
                    <p className="text-sm text-[#b8a070]">{formatTimeAgo(order.createdAt)}</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-[#b8a070]">No recent orders</div>
            )}
          </div>
        </div>

        <div className="bg-[#1a1a1a] p-6 border border-[#d4af37]/20">
          <h3 className="text-xl font-bold text-[#d4af37] mb-6">Top Products</h3>
          <div className="space-y-4">
            {data.topProducts.length > 0 ? (
              data.topProducts.map((product, index) => (
                <div
                  key={product.id}
                  className="flex items-center justify-between py-3 border-b border-[#d4af37]/10 last:border-b-0"
                >
                  <div className="flex items-center space-x-4">
                    <div className="w-10 h-10 bg-[#d4af37] flex items-center justify-center text-[#0a0a0a] font-bold">
                      {index + 1}
                    </div>
                    <div>
                      <p className="font-medium text-[#f5e6d3]">{product.name}</p>
                      <p className="text-sm text-[#b8a070]">{product.soldCount} sold</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-[#d4af37]">{formatCurrency(product.price)}</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-[#b8a070]">No product data</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}