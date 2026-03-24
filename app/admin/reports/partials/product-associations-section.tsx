// app/admin/reports/partials/product-associations-section.tsx
"use client";

import { useState, useEffect } from "react";

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

// ── Translate confidence into plain-English strength ─────────────────────────
// dark: variants are embedded in the class strings so Tailwind JIT includes them
function getStrength(confidence: number): {
  label: string;
  sublabel: string;
  bg: string;
  text: string;
  dot: string;
} {
  if (confidence >= 0.6)
    return {
      label: "Almost always",
      sublabel: "Very strong buying pattern",
      bg: "bg-green-50 dark:bg-green-950/40",
      text: "text-green-700 dark:text-green-400",
      dot: "bg-green-500",
    };
  if (confidence >= 0.35)
    return {
      label: "Often",
      sublabel: "Common buying pattern",
      bg: "bg-[#fdf8ec] dark:bg-[#26231a]",
      text: "text-[#8B6914] dark:text-[#D4AF37]",
      dot: "bg-[#D4AF37]",
    };
  if (confidence >= 0.15)
    return {
      label: "Sometimes",
      sublabel: "Occasional buying pattern",
      bg: "bg-[#faf8f3] dark:bg-[#1c1a14]",
      text: "text-[#7a6a4a] dark:text-[#9a8a68]",
      dot: "bg-[#b8a070]",
    };
  return {
    label: "Occasionally",
    sublabel: "Rare buying pattern",
    bg: "bg-gray-50 dark:bg-gray-800/50",
    text: "text-gray-500 dark:text-gray-400",
    dot: "bg-gray-400",
  };
}

// ── "X out of 10" readable confidence ────────────────────────────────────────
function toOutOf10(confidence: number): string {
  const n = Math.round(confidence * 10);
  if (n >= 10) return "almost every customer";
  if (n <= 1) return "about 1 in 10 customers";
  return `about ${n} out of 10 customers`;
}

// ── Product thumbnail ─────────────────────────────────────────────────────────
function ProductThumb({
  product,
  size = "md",
}: {
  product: ProductInfo;
  size?: "sm" | "md";
}) {
  const dim = size === "sm" ? "w-9 h-9" : "w-12 h-12";
  return (
    <div
      className={`${dim} bg-[#faf8f3] dark:bg-[#26231a] border border-[#e8e0d0] dark:border-[#2e2a1e] flex-shrink-0 overflow-hidden rounded-sm`}
    >
      {product.image ? (
        <img
          src={product.image}
          alt={product.name}
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-base">
          🧴
        </div>
      )}
    </div>
  );
}

export default function ProductAssociationsSection() {
  const [data, setData] = useState<AssociationsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState(90);
  const [activeTab, setActiveTab] = useState<
    "patterns" | "bundles" | "products"
  >("patterns");

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(
        `/api/admin/analytics/product-associations?days=${days}&t=${Date.now()}`,
        { method: "GET", cache: "no-store" }
      );
      if (!response.ok) throw new Error("Failed to fetch product associations");
      const result = await response.json();
      if (!result.success) throw new Error(result.error || "Failed to load data");
      setData(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [days]);

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);

  if (loading) {
    return (
      <div className="bg-[#faf8f3] dark:bg-[#1c1a14] border border-[#e8e0d0] dark:border-[#2e2a1e] p-6">
        <h2 className="text-2xl font-semibold text-[#d4af37] uppercase tracking-[2px] mb-6">
          BUYING PATTERNS
        </h2>
        <div className="flex items-center justify-center h-64">
          <div className="flex flex-col items-center gap-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#d4af37]" />
            <p className="text-[#7a6a4a] dark:text-[#9a8a68]">Analyzing customer purchases...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-[#faf8f3] dark:bg-[#1c1a14] border border-[#e8e0d0] dark:border-[#2e2a1e] p-6">
        <h2 className="text-2xl font-semibold text-[#d4af37] uppercase tracking-[2px] mb-6">
          BUYING PATTERNS
        </h2>
        <div className="p-4 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded text-red-700 dark:text-red-400">
          <p>
            <strong>Error:</strong> {error}
          </p>
          <button
            onClick={fetchData}
            className="mt-4 px-4 py-2 bg-[#d4af37] text-[#0a0a0a] hover:bg-[#d4af37]/90 rounded"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const tabs = [
    { key: "patterns" as const, label: "Buying Patterns" },
    { key: "bundles" as const, label: "Bundle Ideas" },
    { key: "products" as const, label: "Products" },
  ];

  return (
    <div className="bg-[#faf8f3] dark:bg-[#1c1a14] border border-[#e8e0d0] dark:border-[#2e2a1e] p-6 space-y-6">

      {/* ── Data Basis Banner ─────────────────────────────────────────── */}
      <div className="border-l-4 border-[#D4AF37] bg-[#fffdf5] dark:bg-[#26231a] px-4 py-3 flex flex-col sm:flex-row sm:items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">
          <svg className="w-4 h-4 text-[#8B6914] dark:text-[#D4AF37]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs">
          <div>
            <span className="font-semibold text-[#8B6914] dark:text-[#D4AF37] uppercase tracking-wide">Data Source</span>
            <span className="ml-2 text-[#1c1810] dark:text-[#f0e8d8]">
              <code className="bg-[#f2ede4] dark:bg-[#26231a] px-1 rounded">order_items</code> + <code className="bg-[#f2ede4] dark:bg-[#26231a] px-1 rounded">orders</code> tables — order transaction history
            </span>
          </div>
          <div>
            <span className="font-semibold text-[#8B6914] dark:text-[#D4AF37] uppercase tracking-wide">Method</span>
            <span className="ml-2 text-[#1c1810] dark:text-[#f0e8d8]">Market Basket Analysis — Support, Confidence, and Lift per product pair</span>
          </div>
          <div>
            <span className="font-semibold text-[#8B6914] dark:text-[#D4AF37] uppercase tracking-wide">Basis</span>
            <span className="ml-2 text-[#1c1810] dark:text-[#f0e8d8]">Mobile app orders within the selected time period — Cancelled and Refunded excluded</span>
          </div>
        </div>
      </div>

      {/* ── Header ───────────────────────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-[#d4af37] uppercase tracking-[2px]">
            BUYING PATTERNS
          </h2>
          <p className="text-sm text-[#7a6a4a] dark:text-[#9a8a68] mt-1">
            See which products customers buy together and what you can do about it.
          </p>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="px-3 py-2 bg-white dark:bg-[#26231a] border border-[#e8e0d0] dark:border-[#2e2a1e] text-[#1c1810] dark:text-[#f0e8d8] text-sm focus:outline-none focus:ring-2 focus:ring-[#d4af37]"
          >
            <option value="30">Last 30 days</option>
            <option value="60">Last 60 days</option>
            <option value="90">Last 90 days</option>
            <option value="180">Last 6 months</option>
            <option value="365">Last year</option>
          </select>
          <button
            onClick={fetchData}
            disabled={loading}
            className="px-4 py-2 bg-[#d4af37] text-[#0a0a0a] text-sm font-medium hover:bg-[#d4af37]/90 disabled:opacity-50"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* ── Summary pills ────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-2 bg-white dark:bg-[#26231a] border border-[#e8e0d0] dark:border-[#2e2a1e] px-4 py-2 rounded-full text-sm">
          <span className="text-[#7a6a4a] dark:text-[#9a8a68]">Orders analysed:</span>
          <span className="font-semibold text-[#1c1810] dark:text-[#f0e8d8]">
            {data.summary.totalOrders.toLocaleString()}
          </span>
        </div>
        <div className="flex items-center gap-2 bg-white dark:bg-[#26231a] border border-[#e8e0d0] dark:border-[#2e2a1e] px-4 py-2 rounded-full text-sm">
          <span className="text-[#7a6a4a] dark:text-[#9a8a68]">Product pairs found:</span>
          <span className="font-semibold text-[#1c1810] dark:text-[#f0e8d8]">
            {data.summary.rulesFound}
          </span>
        </div>
        <div className="flex items-center gap-2 bg-white dark:bg-[#26231a] border border-[#e8e0d0] dark:border-[#2e2a1e] px-4 py-2 rounded-full text-sm">
          <span className="text-[#7a6a4a] dark:text-[#9a8a68]">Avg items per order:</span>
          <span className="font-semibold text-[#1c1810] dark:text-[#f0e8d8]">
            {data.summary.averageBasketSize}
          </span>
        </div>
      </div>

      {/* ── Tabs ─────────────────────────────────────────────────────── */}
      <div className="flex border-b border-[#e8e0d0] dark:border-[#2e2a1e]">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-5 py-3 text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? "text-[#d4af37] border-b-2 border-[#d4af37]"
                : "text-[#7a6a4a] dark:text-[#9a8a68] hover:text-[#1c1810] dark:hover:text-[#f0e8d8]"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════════════ */}
      {/* TAB 1 — Buying Patterns                                        */}
      {/* ══════════════════════════════════════════════════════════════ */}
      {activeTab === "patterns" && (
        <div className="space-y-4">
          {/* Intro */}
          <div className="bg-white dark:bg-[#26231a] border border-[#e8e0d0] dark:border-[#2e2a1e] px-4 py-3 rounded-sm text-sm text-[#1c1810] dark:text-[#f0e8d8]">
            These are products that real customers bought <strong>in the same order</strong>. The
            more often a pair appears together, the stronger the buying pattern.
          </div>

          {data.associationRules.length === 0 ? (
            <div className="text-center py-14 bg-white dark:bg-[#26231a] border border-[#e8e0d0] dark:border-[#2e2a1e]">
              <div className="text-4xl mb-3">🛒</div>
              <p className="text-[#d4af37] font-semibold text-lg">No patterns found yet</p>
              <p className="text-[#7a6a4a] dark:text-[#9a8a68] text-sm mt-1">
                More order data is needed. Try selecting a longer time range.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Deduplicate by pair (show each pair once, pick the direction with higher confidence) */}
              {deduplicateRules(data.associationRules)
                .slice(0, 20)
                .map((rule, index) => {
                  const strength = getStrength(rule.confidence);
                  const outOf10 = toOutOf10(rule.confidence);
                  return (
                    <div
                      key={index}
                      className="bg-white dark:bg-[#26231a] border border-[#e8e0d0] dark:border-[#2e2a1e] p-4 hover:border-[#d4af37]/40 transition-colors"
                    >
                      {/* Products row */}
                      <div className="flex items-center gap-3">
                        {/* Product A */}
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <ProductThumb product={rule.antecedent} />
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-[#1c1810] dark:text-[#f0e8d8] truncate">
                              {rule.antecedent.name}
                            </p>
                            <p className="text-xs text-[#7a6a4a] dark:text-[#9a8a68]">
                              {formatCurrency(rule.antecedent.price)}
                            </p>
                          </div>
                        </div>

                        {/* Connector */}
                        <div className="flex flex-col items-center flex-shrink-0 px-1">
                          <div className="text-[#d4af37] font-bold text-lg leading-none">+</div>
                          <div className="text-[10px] text-[#7a6a4a] dark:text-[#9a8a68] mt-0.5 whitespace-nowrap">
                            bought together
                          </div>
                        </div>

                        {/* Product B */}
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <ProductThumb product={rule.consequent} />
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-[#1c1810] dark:text-[#f0e8d8] truncate">
                              {rule.consequent.name}
                            </p>
                            <p className="text-xs text-[#7a6a4a] dark:text-[#9a8a68]">
                              {formatCurrency(rule.consequent.price)}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Stats row */}
                      <div className="mt-3 pt-3 border-t border-[#e8e0d0] dark:border-[#2e2a1e] flex flex-wrap items-center gap-3">
                        {/* Strength badge */}
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${strength.bg} ${strength.text}`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${strength.dot}`}
                          />
                          {strength.label} together
                        </span>

                        {/* Times bought together */}
                        <span className="text-xs text-[#7a6a4a] dark:text-[#9a8a68]">
                          Bought together{" "}
                          <span className="font-semibold text-[#1c1810] dark:text-[#f0e8d8]">
                            {rule.coOccurrences} time{rule.coOccurrences !== 1 ? "s" : ""}
                          </span>
                        </span>

                        {/* Plain-English confidence */}
                        <span className="text-xs text-[#7a6a4a] dark:text-[#9a8a68]">
                          {outOf10} who bought{" "}
                          <span className="font-medium text-[#8B6914] dark:text-[#D4AF37]">
                            {rule.antecedent.name.split(" ")[0]}
                          </span>{" "}
                          also bought{" "}
                          <span className="font-medium text-[#8B6914] dark:text-[#D4AF37]">
                            {rule.consequent.name.split(" ")[0]}
                          </span>
                        </span>
                      </div>

                      {/* Why they go together */}
                      <div className="mt-2 text-xs text-[#7a6a4a] dark:text-[#9a8a68] italic">
                        {getPairNote(rule)}
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════ */}
      {/* TAB 2 — Bundle Ideas                                           */}
      {/* ══════════════════════════════════════════════════════════════ */}
      {activeTab === "bundles" && (
        <div className="space-y-4">
          {/* Intro */}
          <div className="bg-white dark:bg-[#26231a] border border-[#e8e0d0] dark:border-[#2e2a1e] px-4 py-3 rounded-sm text-sm text-[#1c1810] dark:text-[#f0e8d8]">
            These pairings are suggested to help you move{" "}
            <strong>slow-selling products</strong> by offering them together with
            your <strong>bestsellers</strong> at a small discount.
          </div>

          {data.bundleRecommendations.length === 0 ? (
            <div className="text-center py-14 bg-white dark:bg-[#26231a] border border-[#e8e0d0] dark:border-[#2e2a1e]">
              <div className="text-4xl mb-3">📦</div>
              <p className="text-[#d4af37] font-semibold text-lg">
                No bundle ideas yet
              </p>
              <p className="text-[#7a6a4a] dark:text-[#9a8a68] text-sm mt-1">
                Need more sales data to generate suggestions.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {data.bundleRecommendations.map((bundle) => {
                // Check if this pair has a real buying pattern
                const existingPattern = data.associationRules.find(
                  (r) =>
                    (r.antecedent.id === bundle.topSeller.id &&
                      r.consequent.id === bundle.slowMover.id) ||
                    (r.antecedent.id === bundle.slowMover.id &&
                      r.consequent.id === bundle.topSeller.id)
                );
                const patternStrength = existingPattern
                  ? getStrength(existingPattern.confidence)
                  : null;

                return (
                  <div
                    key={`${bundle.topSeller.id}-${bundle.slowMover.id}`}
                    className="bg-white dark:bg-[#26231a] border border-[#e8e0d0] dark:border-[#2e2a1e] p-4 hover:border-[#d4af37]/40 transition-colors"
                  >
                    <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                      {/* Products */}
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        {/* Best seller */}
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <ProductThumb product={bundle.topSeller} />
                          <div className="min-w-0">
                            <div className="text-[10px] font-semibold text-green-600 dark:text-green-400 uppercase tracking-wide mb-0.5">
                              Best seller
                            </div>
                            <p className="text-sm font-medium text-[#1c1810] dark:text-[#f0e8d8] truncate">
                              {bundle.topSeller.name}
                            </p>
                            <p className="text-xs text-[#7a6a4a] dark:text-[#9a8a68]">
                              {formatCurrency(bundle.topSeller.price)} ·{" "}
                              {bundle.topSeller.totalSold} sold
                            </p>
                          </div>
                        </div>

                        <div className="text-xl font-bold text-[#d4af37] flex-shrink-0">
                          +
                        </div>

                        {/* Slow mover */}
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <ProductThumb product={bundle.slowMover} />
                          <div className="min-w-0">
                            <div
                              className={`text-[10px] font-semibold uppercase tracking-wide mb-0.5 ${
                                bundle.slowMover.totalSold === 0
                                  ? "text-red-500 dark:text-red-400"
                                  : "text-amber-600 dark:text-amber-400"
                              }`}
                            >
                              {bundle.slowMover.totalSold === 0
                                ? "No sales yet"
                                : "Slow seller"}
                            </div>
                            <p className="text-sm font-medium text-[#1c1810] dark:text-[#f0e8d8] truncate">
                              {bundle.slowMover.name}
                            </p>
                            <p className="text-xs text-[#7a6a4a] dark:text-[#9a8a68]">
                              {formatCurrency(bundle.slowMover.price)} ·{" "}
                              {bundle.slowMover.totalSold} sold
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Price block */}
                      <div className="flex items-center gap-5 lg:border-l lg:border-[#e8e0d0] dark:lg:border-[#2e2a1e] lg:pl-5 flex-shrink-0">
                        <div>
                          <p className="text-xs text-[#7a6a4a] dark:text-[#9a8a68]">Bundle price</p>
                          <p className="text-xl font-bold text-[#d4af37]">
                            {formatCurrency(bundle.bundlePrice)}
                          </p>
                          <p className="text-xs font-medium text-green-600 dark:text-green-400">
                            Save {bundle.suggestedDiscount}%
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-[#7a6a4a] dark:text-[#9a8a68]">Est. revenue</p>
                          <p className="text-xl font-bold text-green-600 dark:text-green-400">
                            {formatCurrency(bundle.potentialRevenue)}
                          </p>
                          <p className="text-xs text-[#7a6a4a] dark:text-[#9a8a68]">if promoted</p>
                        </div>
                      </div>
                    </div>

                    {/* Pattern badge + reasoning */}
                    <div className="mt-3 pt-3 border-t border-[#e8e0d0] dark:border-[#2e2a1e] flex flex-wrap items-start gap-2">
                      {patternStrength ? (
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${patternStrength.bg} ${patternStrength.text}`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${patternStrength.dot}`}
                          />
                          Already {patternStrength.label.toLowerCase()} bought together
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-[#faf8f3] dark:bg-[#1c1a14] text-[#7a6a4a] dark:text-[#9a8a68]">
                          New pairing suggestion
                        </span>
                      )}
                      <p className="text-xs text-[#7a6a4a] dark:text-[#9a8a68] flex-1">
                        {bundle.reasoning}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════ */}
      {/* TAB 3 — Products                                               */}
      {/* ══════════════════════════════════════════════════════════════ */}
      {activeTab === "products" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top sellers */}
          <div className="bg-white dark:bg-[#26231a] border border-[#e8e0d0] dark:border-[#2e2a1e]">
            <div className="px-4 py-3 border-b border-[#e8e0d0] dark:border-[#2e2a1e]">
              <h3 className="font-semibold text-green-700 dark:text-green-400">Top Sellers</h3>
              <p className="text-xs text-[#7a6a4a] dark:text-[#9a8a68] mt-0.5">
                Products with the most units sold in this period
              </p>
            </div>
            <div className="divide-y divide-[#e8e0d0] dark:divide-[#2e2a1e]">
              {data.topSellers.length === 0 ? (
                <p className="px-4 py-6 text-sm text-[#7a6a4a] dark:text-[#9a8a68] text-center">
                  No sales data yet
                </p>
              ) : (
                data.topSellers.map((product, index) => (
                  <div
                    key={product.id}
                    className="px-4 py-3 flex items-center gap-3"
                  >
                    <span className="text-sm font-bold text-[#d4af37] w-5 text-center">
                      {index + 1}
                    </span>
                    <ProductThumb product={product} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[#1c1810] dark:text-[#f0e8d8] truncate">
                        {product.name}
                      </p>
                      <p className="text-xs text-[#7a6a4a] dark:text-[#9a8a68]">
                        {formatCurrency(product.price)}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-bold text-green-600 dark:text-green-400">
                        {product.totalSold} sold
                      </p>
                      <p className="text-xs text-[#7a6a4a] dark:text-[#9a8a68]">
                        {formatCurrency(product.revenue)}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Slow movers */}
          <div className="bg-white dark:bg-[#26231a] border border-[#e8e0d0] dark:border-[#2e2a1e]">
            <div className="px-4 py-3 border-b border-[#e8e0d0] dark:border-[#2e2a1e]">
              <h3 className="font-semibold text-amber-700 dark:text-amber-400">Needs Attention</h3>
              <p className="text-xs text-[#7a6a4a] dark:text-[#9a8a68] mt-0.5">
                Products with low or no sales — consider promoting these
              </p>
            </div>
            <div className="divide-y divide-[#e8e0d0] dark:divide-[#2e2a1e]">
              {data.slowMovers.length === 0 ? (
                <p className="px-4 py-6 text-sm text-[#7a6a4a] dark:text-[#9a8a68] text-center">
                  All products are selling well
                </p>
              ) : (
                data.slowMovers.map((product, index) => (
                  <div
                    key={product.id}
                    className="px-4 py-3 flex items-center gap-3"
                  >
                    <span className="text-sm font-bold text-[#b8a070] w-5 text-center">
                      {index + 1}
                    </span>
                    <ProductThumb product={product} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[#1c1810] dark:text-[#f0e8d8] truncate">
                        {product.name}
                      </p>
                      <p className="text-xs text-[#7a6a4a] dark:text-[#9a8a68]">
                        {formatCurrency(product.price)}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      {product.totalSold === 0 ? (
                        <p className="text-sm font-bold text-red-500 dark:text-red-400">
                          No sales
                        </p>
                      ) : (
                        <p className="text-sm font-bold text-amber-600 dark:text-amber-400">
                          {product.totalSold} sold
                        </p>
                      )}
                      <p className="text-xs text-[#7a6a4a] dark:text-[#9a8a68]">
                        {formatCurrency(product.revenue)}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Deduplicate rules: for each A↔B pair, keep only the direction with
 * higher confidence so we don't show the same pair twice.
 */
function deduplicateRules(rules: AssociationRule[]): AssociationRule[] {
  const seen = new Map<string, AssociationRule>();
  for (const rule of rules) {
    const key = [rule.antecedent.id, rule.consequent.id].sort().join("||");
    const existing = seen.get(key);
    if (!existing || rule.confidence > existing.confidence) {
      seen.set(key, rule);
    }
  }
  // Sort by co-occurrences (most bought together first), then by confidence
  return Array.from(seen.values()).sort(
    (a, b) =>
      b.coOccurrences - a.coOccurrences || b.confidence - a.confidence
  );
}

/**
 * Generate a plain-English note explaining why this pair makes sense together.
 * Based only on sales data — no technical scores.
 */
function getPairNote(rule: AssociationRule): string {
  const { antecedent: a, consequent: b, coOccurrences, confidence } = rule;

  if (coOccurrences >= 10 && confidence >= 0.6) {
    return `Customers consistently pick up ${b.name} whenever they buy ${a.name} — these two are a natural match.`;
  }
  if (coOccurrences >= 5 && confidence >= 0.35) {
    return `Many customers who bought ${a.name} went back and also picked ${b.name} — they seem to go well together.`;
  }
  if (
    Math.abs(a.price - b.price) / Math.max(a.price, b.price) < 0.3
  ) {
    return `Similar price range — customers often explore both when deciding on a fragrance.`;
  }
  if (a.price > b.price) {
    return `${b.name} is often added as a companion to the higher-priced ${a.name}.`;
  }
  return `Some customers who bought ${a.name} also picked up ${b.name} in the same order.`;
}
