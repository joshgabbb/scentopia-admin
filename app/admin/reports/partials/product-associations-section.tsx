// app/admin/reports/partials/product-associations-section.tsx
"use client";

import { useState, useEffect } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

interface ProductInfo {
  id: string;
  name: string;
  price: number;
  image: string | null;
  totalSold: number;
  revenue: number;
  orderCount: number;
}

interface AssociationRule {
  antecedent: ProductInfo;
  consequent: ProductInfo;
  support: number;
  confidence: number;
  lift: number;
  coOccurrences: number;
}

interface BundleRecommendation {
  topSeller: ProductInfo;
  slowMover: ProductInfo;
  confidence: number;
  lift: number;
  potentialRevenue: number;
  suggestedDiscount: number;
  bundlePrice: number;
  reasoning: string;
}

interface AssociationsData {
  associationRules: AssociationRule[];
  bundleRecommendations: BundleRecommendation[];
  topSellers: ProductInfo[];
  slowMovers: ProductInfo[];
  summary: {
    totalOrders: number;
    totalProducts: number;
    averageBasketSize: number;
    rulesFound: number;
    periodDays: number;
  };
}

export default function ProductAssociationsSection() {
  const [data, setData] = useState<AssociationsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState(90);
  const [activeTab, setActiveTab] = useState<"bundles" | "rules" | "products">("bundles");

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(
        `/api/admin/analytics/product-associations?days=${days}&t=${Date.now()}`,
        {
          method: "GET",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
        }
      );

      if (!response.ok) {
        throw new Error("Failed to fetch product associations");
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || "Failed to load data");
      }

      setData(result.data);
    } catch (err) {
      console.error("Failed to fetch associations:", err);
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [days]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getLiftColor = (lift: number) => {
    if (lift >= 2) return "#22c55e"; // Strong positive
    if (lift >= 1.5) return "#84cc16"; // Moderate positive
    if (lift >= 1) return "#d4af37"; // Slight positive
    return "#ef4444"; // Negative
  };

  const getLiftLabel = (lift: number) => {
    if (lift >= 2) return "Strong Association";
    if (lift >= 1.5) return "Good Association";
    if (lift >= 1) return "Weak Association";
    return "Negative Association";
  };

  if (loading) {
    return (
      <div className="bg-[#faf8f3] border border-[#e8e0d0] p-6">
        <h2 className="text-2xl font-semibold text-[#d4af37] uppercase tracking-[2px] mb-6">
          PRODUCT ASSOCIATIONS & BUNDLE RECOMMENDATIONS
        </h2>
        <div className="flex items-center justify-center h-64">
          <div className="flex flex-col items-center gap-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#d4af37]"></div>
            <p className="text-[#7a6a4a]">Analyzing purchasing patterns...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-[#faf8f3] border border-[#e8e0d0] p-6">
        <h2 className="text-2xl font-semibold text-[#d4af37] uppercase tracking-[2px] mb-6">
          PRODUCT ASSOCIATIONS & BUNDLE RECOMMENDATIONS
        </h2>
        <div className="p-4 bg-red-900/20 border border-red-500/30 text-red-400">
          <p><strong>Error:</strong> {error}</p>
          <button
            onClick={fetchData}
            className="mt-4 px-4 py-2 bg-[#d4af37] text-[#0a0a0a] hover:bg-[#d4af37]/90"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  // Prepare chart data for top associations
  const chartData = data.associationRules.slice(0, 10).map((rule, index) => ({
    name: `${rule.antecedent.name.substring(0, 15)}...`,
    fullName: `${rule.antecedent.name} -> ${rule.consequent.name}`,
    lift: Math.round(rule.lift * 100) / 100,
    confidence: Math.round(rule.confidence * 100),
    coOccurrences: rule.coOccurrences,
  }));

  return (
    <div className="bg-[#faf8f3] border border-[#e8e0d0] p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-[#d4af37] uppercase tracking-[2px]">
            PRODUCT ASSOCIATIONS & BUNDLE RECOMMENDATIONS
          </h2>
          <p className="text-sm text-[#7a6a4a] mt-1">
            Discover products frequently bought together and strategic bundle opportunities
          </p>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="px-4 py-2 bg-white border border-[#e8e0d0] text-[#1c1810] focus:outline-none focus:ring-2 focus:ring-[#d4af37]"
          >
            <option value="30">Last 30 Days</option>
            <option value="60">Last 60 Days</option>
            <option value="90">Last 90 Days</option>
            <option value="180">Last 6 Months</option>
            <option value="365">Last Year</option>
          </select>
          <button
            onClick={fetchData}
            disabled={loading}
            className="px-4 py-2 bg-[#d4af37] text-[#0a0a0a] font-medium hover:bg-[#d4af37]/90 disabled:opacity-50"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border border-[#e8e0d0] p-4">
          <div className="text-sm text-[#7a6a4a]">Orders Analyzed</div>
          <div className="text-2xl font-bold text-[#d4af37] mt-1">
            {data.summary.totalOrders.toLocaleString()}
          </div>
        </div>
        <div className="bg-white border border-[#e8e0d0] p-4">
          <div className="text-sm text-[#7a6a4a]">Products Tracked</div>
          <div className="text-2xl font-bold text-[#d4af37] mt-1">
            {data.summary.totalProducts}
          </div>
        </div>
        <div className="bg-white border border-[#e8e0d0] p-4">
          <div className="text-sm text-[#7a6a4a]">Avg Basket Size</div>
          <div className="text-2xl font-bold text-[#d4af37] mt-1">
            {data.summary.averageBasketSize} items
          </div>
        </div>
        <div className="bg-white border border-[#e8e0d0] p-4">
          <div className="text-sm text-[#7a6a4a]">Associations Found</div>
          <div className="text-2xl font-bold text-[#d4af37] mt-1">
            {data.summary.rulesFound}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[#e8e0d0]">
        <button
          onClick={() => setActiveTab("bundles")}
          className={`px-6 py-3 text-sm font-medium transition-colors ${
            activeTab === "bundles"
              ? "text-[#d4af37] border-b-2 border-[#d4af37]"
              : "text-[#7a6a4a] hover:text-[#1c1810]"
          }`}
        >
          Bundle Recommendations
        </button>
        <button
          onClick={() => setActiveTab("rules")}
          className={`px-6 py-3 text-sm font-medium transition-colors ${
            activeTab === "rules"
              ? "text-[#d4af37] border-b-2 border-[#d4af37]"
              : "text-[#7a6a4a] hover:text-[#1c1810]"
          }`}
        >
          Association Rules
        </button>
        <button
          onClick={() => setActiveTab("products")}
          className={`px-6 py-3 text-sm font-medium transition-colors ${
            activeTab === "products"
              ? "text-[#d4af37] border-b-2 border-[#d4af37]"
              : "text-[#7a6a4a] hover:text-[#1c1810]"
          }`}
        >
          Product Performance
        </button>
      </div>

      {/* Bundle Recommendations Tab */}
      {activeTab === "bundles" && (
        <div className="space-y-6">
          {/* Explanation */}
          <div className="bg-white border border-[#e8e0d0] p-4">
            <h3 className="text-lg font-semibold text-[#d4af37] mb-2">Strategic Bundle Opportunities</h3>
            <p className="text-[#1c1810] text-sm">
              These recommendations pair your <strong className="text-green-400">top-selling perfumes</strong> with{" "}
              <strong className="text-orange-400">slow-moving or less-recognized products</strong> to boost visibility
              and sales of underperforming items while leveraging the popularity of bestsellers.
            </p>
          </div>

          {data.bundleRecommendations.length === 0 ? (
            <div className="text-center py-12 bg-white border border-[#e8e0d0]">
              <div className="text-4xl mb-4">📦</div>
              <h3 className="text-lg font-semibold text-[#d4af37] mb-2">No Bundle Recommendations Yet</h3>
              <p className="text-[#7a6a4a]">More order data is needed to generate recommendations</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {data.bundleRecommendations.map((bundle, index) => (
                <div
                  key={`${bundle.topSeller.id}-${bundle.slowMover.id}`}
                  className="bg-white border border-[#e8e0d0] p-4 hover:border-[#d4af37]/40 transition-colors"
                >
                  <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                    {/* Bundle Products */}
                    <div className="flex items-center gap-4 flex-1">
                      {/* Top Seller */}
                      <div className="flex items-center gap-3 flex-1">
                        <div className="w-14 h-14 bg-[#faf8f3] border border-green-500/30 flex-shrink-0 overflow-hidden">
                          {bundle.topSeller.image ? (
                            <img
                              src={bundle.topSeller.image}
                              alt={bundle.topSeller.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-2xl">🌟</div>
                          )}
                        </div>
                        <div>
                          <div className="text-xs text-green-400 font-medium">TOP SELLER</div>
                          <div className="text-sm font-medium text-[#1c1810] line-clamp-1">
                            {bundle.topSeller.name}
                          </div>
                          <div className="text-xs text-[#7a6a4a]">
                            {formatCurrency(bundle.topSeller.price)} | {bundle.topSeller.totalSold} sold
                          </div>
                        </div>
                      </div>

                      {/* Plus Sign */}
                      <div className="text-2xl text-[#d4af37] font-bold">+</div>

                      {/* Slow Mover */}
                      <div className="flex items-center gap-3 flex-1">
                        <div className="w-14 h-14 bg-[#faf8f3] border border-orange-500/30 flex-shrink-0 overflow-hidden">
                          {bundle.slowMover.image ? (
                            <img
                              src={bundle.slowMover.image}
                              alt={bundle.slowMover.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-2xl">📦</div>
                          )}
                        </div>
                        <div>
                          <div className="text-xs text-orange-400 font-medium">
                            {bundle.slowMover.totalSold === 0 ? "NO SALES" : "SLOW MOVER"}
                          </div>
                          <div className="text-sm font-medium text-[#1c1810] line-clamp-1">
                            {bundle.slowMover.name}
                          </div>
                          <div className="text-xs text-[#7a6a4a]">
                            {formatCurrency(bundle.slowMover.price)} | {bundle.slowMover.totalSold} sold
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Bundle Metrics */}
                    <div className="flex items-center gap-6 lg:border-l lg:border-[#e8e0d0] lg:pl-6">
                      <div className="text-center">
                        <div className="text-xs text-[#7a6a4a]">Bundle Price</div>
                        <div className="text-lg font-bold text-[#d4af37]">
                          {formatCurrency(bundle.bundlePrice)}
                        </div>
                        <div className="text-xs text-green-400">-{bundle.suggestedDiscount}% OFF</div>
                      </div>
                      <div className="text-center">
                        <div className="text-xs text-[#7a6a4a]">Potential Revenue</div>
                        <div className="text-lg font-bold text-green-400">
                          {formatCurrency(bundle.potentialRevenue)}
                        </div>
                      </div>
                      {bundle.lift > 1 && (
                        <div className="text-center">
                          <div className="text-xs text-[#7a6a4a]">Association</div>
                          <div
                            className="text-lg font-bold"
                            style={{ color: getLiftColor(bundle.lift) }}
                          >
                            {bundle.lift.toFixed(1)}x
                          </div>
                          <div className="text-xs text-[#7a6a4a]">lift</div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Reasoning */}
                  <div className="mt-3 pt-3 border-t border-[#d4af37]/10">
                    <p className="text-sm text-[#7a6a4a]">
                      <span className="text-[#d4af37]">💡</span> {bundle.reasoning}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Association Rules Tab */}
      {activeTab === "rules" && (
        <div className="space-y-6">
          {/* Chart */}
          {chartData.length > 0 && (
            <div className="bg-white border border-[#e8e0d0] p-4">
              <h3 className="text-lg font-semibold text-[#d4af37] mb-4">Top Product Associations by Lift</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                    <XAxis type="number" tick={{ fontSize: 11, fill: "#b8a070" }} stroke="#444" />
                    <YAxis
                      type="category"
                      dataKey="name"
                      tick={{ fontSize: 10, fill: "#b8a070" }}
                      stroke="#444"
                      width={120}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#1a1a1a",
                        border: "1px solid #d4af37",
                        color: "#f5e6d3",
                      }}
                      formatter={(value: any, name: string) => [
                        name === "lift" ? `${value}x` : `${value}%`,
                        name === "lift" ? "Lift Score" : "Confidence",
                      ]}
                      labelFormatter={(label, payload) => payload?.[0]?.payload?.fullName || label}
                    />
                    <Bar dataKey="lift" name="lift" radius={[0, 4, 4, 0]}>
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={getLiftColor(entry.lift)} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Rules Table */}
          <div className="bg-white border border-[#e8e0d0]">
            <div className="px-4 py-3 border-b border-[#e8e0d0]">
              <h3 className="text-lg font-semibold text-[#d4af37]">Association Rules</h3>
              <p className="text-xs text-[#7a6a4a] mt-1">
                When customers buy the first product, they also tend to buy the second
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-[#faf8f3]">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#7a6a4a] uppercase">
                      If Customer Buys
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#7a6a4a] uppercase">
                      They Also Buy
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-[#7a6a4a] uppercase">
                      Times Together
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-[#7a6a4a] uppercase">
                      Confidence
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-[#7a6a4a] uppercase">
                      Lift
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#d4af37]/10">
                  {data.associationRules.slice(0, 20).map((rule, index) => (
                    <tr key={index} className="hover:bg-[#faf8f3]/50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-[#faf8f3] border border-[#e8e0d0] flex-shrink-0 overflow-hidden">
                            {rule.antecedent.image ? (
                              <img
                                src={rule.antecedent.image}
                                alt=""
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-xs">📦</div>
                            )}
                          </div>
                          <span className="text-sm text-[#1c1810] line-clamp-1">
                            {rule.antecedent.name}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-[#faf8f3] border border-[#e8e0d0] flex-shrink-0 overflow-hidden">
                            {rule.consequent.image ? (
                              <img
                                src={rule.consequent.image}
                                alt=""
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-xs">📦</div>
                            )}
                          </div>
                          <span className="text-sm text-[#1c1810] line-clamp-1">
                            {rule.consequent.name}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center text-sm text-[#d4af37] font-medium">
                        {rule.coOccurrences}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-sm text-[#1c1810]">
                          {(rule.confidence * 100).toFixed(1)}%
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className="px-2 py-1 text-xs font-medium"
                          style={{
                            color: getLiftColor(rule.lift),
                            backgroundColor: `${getLiftColor(rule.lift)}20`,
                          }}
                        >
                          {rule.lift.toFixed(2)}x
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {data.associationRules.length === 0 && (
              <div className="text-center py-12 text-[#7a6a4a]">
                No association rules found. More order data is needed.
              </div>
            )}
          </div>

          {/* Legend */}
          <div className="bg-white border border-[#e8e0d0] p-4">
            <h4 className="text-sm font-semibold text-[#d4af37] mb-3">Understanding the Metrics</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-[#1c1810] font-medium">Confidence</span>
                <p className="text-[#7a6a4a] text-xs mt-1">
                  Probability that customers who buy product A also buy product B. Higher is better.
                </p>
              </div>
              <div>
                <span className="text-[#1c1810] font-medium">Lift</span>
                <p className="text-[#7a6a4a] text-xs mt-1">
                  How much more likely products are bought together vs. independently. Lift {">"} 1 means positive
                  association.
                </p>
              </div>
              <div>
                <span className="text-[#1c1810] font-medium">Support</span>
                <p className="text-[#7a6a4a] text-xs mt-1">
                  Frequency of the product pair appearing together in all transactions.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Product Performance Tab */}
      {activeTab === "products" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top Sellers */}
          <div className="bg-white border border-[#e8e0d0]">
            <div className="px-4 py-3 border-b border-[#e8e0d0] flex items-center gap-2">
              <span className="text-xl">🌟</span>
              <h3 className="text-lg font-semibold text-green-400">Top Sellers</h3>
            </div>
            <div className="divide-y divide-[#d4af37]/10">
              {data.topSellers.map((product, index) => (
                <div key={product.id} className="px-4 py-3 flex items-center gap-3">
                  <div className="text-lg font-bold text-[#d4af37] w-6">{index + 1}</div>
                  <div className="w-10 h-10 bg-[#faf8f3] border border-[#e8e0d0] flex-shrink-0 overflow-hidden">
                    {product.image ? (
                      <img src={product.image} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-sm">📦</div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-[#1c1810] truncate">{product.name}</div>
                    <div className="text-xs text-[#7a6a4a]">{formatCurrency(product.price)}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-green-400">{product.totalSold} sold</div>
                    <div className="text-xs text-[#7a6a4a]">{formatCurrency(product.revenue)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Slow Movers */}
          <div className="bg-white border border-[#e8e0d0]">
            <div className="px-4 py-3 border-b border-[#e8e0d0] flex items-center gap-2">
              <span className="text-xl">📉</span>
              <h3 className="text-lg font-semibold text-orange-400">Slow Movers & No Sales</h3>
            </div>
            <div className="divide-y divide-[#d4af37]/10">
              {data.slowMovers.map((product, index) => (
                <div key={product.id} className="px-4 py-3 flex items-center gap-3">
                  <div className="text-lg font-bold text-[#7a6a4a] w-6">{index + 1}</div>
                  <div className="w-10 h-10 bg-[#faf8f3] border border-[#e8e0d0] flex-shrink-0 overflow-hidden">
                    {product.image ? (
                      <img src={product.image} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-sm">📦</div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-[#1c1810] truncate">{product.name}</div>
                    <div className="text-xs text-[#7a6a4a]">{formatCurrency(product.price)}</div>
                  </div>
                  <div className="text-right">
                    {product.totalSold === 0 ? (
                      <div className="text-sm font-bold text-red-400">No sales</div>
                    ) : (
                      <div className="text-sm font-bold text-orange-400">{product.totalSold} sold</div>
                    )}
                    <div className="text-xs text-[#7a6a4a]">{formatCurrency(product.revenue)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Actionable Insights */}
      <div className="bg-white border border-[#e8e0d0] p-4">
        <h3 className="text-lg font-semibold text-[#d4af37] mb-3">Actionable Insights</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex gap-3">
            <div className="text-2xl">🎯</div>
            <div>
              <div className="text-sm font-medium text-[#1c1810]">Create Bundle Promotions</div>
              <p className="text-xs text-[#7a6a4a] mt-1">
                Use the recommended bundles to create promotional offers that pair bestsellers with slow-moving items.
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <div className="text-2xl">📧</div>
            <div>
              <div className="text-sm font-medium text-[#1c1810]">Personalized Recommendations</div>
              <p className="text-xs text-[#7a6a4a] mt-1">
                Send targeted emails suggesting complementary products based on past purchases.
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <div className="text-2xl">🛒</div>
            <div>
              <div className="text-sm font-medium text-[#1c1810]">Cross-Sell at Checkout</div>
              <p className="text-xs text-[#7a6a4a] mt-1">
                Display associated products during checkout to increase average order value.
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <div className="text-2xl">📍</div>
            <div>
              <div className="text-sm font-medium text-[#1c1810]">Strategic Product Placement</div>
              <p className="text-xs text-[#7a6a4a] mt-1">
                Place frequently associated products near each other in your store layout.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
