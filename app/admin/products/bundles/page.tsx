// app/admin/products/bundles/page.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { PackageOpen, Plus, Trash2, ToggleLeft, ToggleRight, Lightbulb, Settings2 } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ProductOption {
  id: string;
  name: string;
  price: number;
  images: string[] | null;
  is_active: boolean;
  is_archived: boolean;
}

interface PublishedBundle {
  id: string;
  name: string;
  product_1_id: string;
  product_2_id: string;
  bundle_price: number;
  original_price: number;
  discount_percentage: number;
  is_active: boolean;
  reasoning: string | null;
  published_at: string;
  product1: { id: string; name: string; price: number; images: string[] | null } | null;
  product2: { id: string; name: string; price: number; images: string[] | null } | null;
}

interface BundleIdea {
  topSeller: { id: string; name: string; price: number; image: string | null; totalSold: number };
  slowMover: { id: string; name: string; price: number; image: string | null; totalSold: number };
  bundlePrice: number;
  suggestedDiscount: number;
  potentialRevenue: number;
  reasoning: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", minimumFractionDigits: 0 }).format(n);

function ProductThumb({ src, name }: { src?: string | null; name?: string }) {
  return (
    <div className="w-10 h-10 bg-[#faf8f3] border border-[#e8e0d0] flex-shrink-0 overflow-hidden rounded-sm">
      {src ? (
        <img src={src} alt={name} className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-base">🧴</div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function BundlesPage() {
  const [activeTab, setActiveTab] = useState<"manage" | "ideas" | "create">("manage");
  const [bundles, setBundles] = useState<PublishedBundle[]>([]);
  const [bundleIdeas, setBundleIdeas] = useState<BundleIdea[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [loadingBundles, setLoadingBundles] = useState(true);
  const [loadingIdeas, setLoadingIdeas] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [publishingKey, setPublishingKey] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  // Create form state
  const [form, setForm] = useState({
    product1Id: "",
    product2Id: "",
    discountPercentage: 15,
  });
  const [creating, setCreating] = useState(false);

  const showToast = (msg: string, type: "success" | "error") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  // ── Fetch bundles ───────────────────────────────────────────────────────────

  const fetchBundles = useCallback(async () => {
    setLoadingBundles(true);
    try {
      const res = await fetch("/api/admin/bundles");
      const result = await res.json();
      if (result.success) setBundles(result.data ?? []);
    } finally {
      setLoadingBundles(false);
    }
  }, []);

  // ── Fetch bundle ideas ──────────────────────────────────────────────────────

  const fetchIdeas = useCallback(async () => {
    setLoadingIdeas(true);
    try {
      const res = await fetch("/api/admin/analytics/product-associations?days=90");
      const result = await res.json();
      if (result.success) setBundleIdeas(result.data?.bundleRecommendations ?? []);
    } finally {
      setLoadingIdeas(false);
    }
  }, []);

  // ── Fetch products for create form ─────────────────────────────────────────

  const fetchProducts = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("products")
      .select("id, name, price, images, is_active, is_archived")
      .eq("is_active", true)
      .eq("is_archived", false)
      .order("name");
    setProducts((data as ProductOption[]) ?? []);
  }, []);

  useEffect(() => {
    fetchBundles();
  }, [fetchBundles]);

  useEffect(() => {
    if (activeTab === "ideas" && bundleIdeas.length === 0) fetchIdeas();
    if (activeTab === "create" && products.length === 0) fetchProducts();
  }, [activeTab, bundleIdeas.length, products.length, fetchIdeas, fetchProducts]);

  // Realtime — refresh bundles when product_bundles changes
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("bundles-page")
      .on("postgres_changes", { event: "*", schema: "public", table: "product_bundles" }, () => {
        fetchBundles();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchBundles]);

  // ── Actions ─────────────────────────────────────────────────────────────────

  const toggleBundle = async (id: string, isActive: boolean) => {
    setTogglingId(id);
    try {
      const res = await fetch("/api/admin/bundles", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, isActive }),
      });
      const result = await res.json();
      if (!result.success) throw new Error(result.error);
      setBundles((prev) => prev.map((b) => (b.id === id ? { ...b, is_active: isActive } : b)));
      showToast(isActive ? "Bundle activated" : "Bundle deactivated", "success");
    } catch (e: any) {
      showToast(e?.message ?? "Failed to update bundle", "error");
    } finally {
      setTogglingId(null);
    }
  };

  const deleteBundle = async (id: string) => {
    if (!confirm("Remove this bundle? It will no longer appear on the mobile app.")) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/admin/bundles?id=${id}`, { method: "DELETE" });
      const result = await res.json();
      if (!result.success) throw new Error(result.error);
      setBundles((prev) => prev.filter((b) => b.id !== id));
      showToast("Bundle removed", "success");
    } catch (e: any) {
      showToast(e?.message ?? "Failed to delete bundle", "error");
    } finally {
      setDeletingId(null);
    }
  };

  const publishIdea = async (idea: BundleIdea) => {
    const key = `${idea.topSeller.id}-${idea.slowMover.id}`;
    setPublishingKey(key);
    try {
      const res = await fetch("/api/admin/bundles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `${idea.topSeller.name} + ${idea.slowMover.name}`,
          product1Id: idea.topSeller.id,
          product2Id: idea.slowMover.id,
          bundlePrice: idea.bundlePrice,
          originalPrice: idea.topSeller.price + idea.slowMover.price,
          discountPercentage: idea.suggestedDiscount,
          reasoning: idea.reasoning,
        }),
      });
      const result = await res.json();
      if (!result.success) throw new Error(result.error);
      await fetchBundles();
      showToast("Bundle published to mobile app!", "success");
      setActiveTab("manage");
    } catch (e: any) {
      showToast(e?.message ?? "Failed to publish bundle", "error");
    } finally {
      setPublishingKey(null);
    }
  };

  const createBundle = async () => {
    if (!form.product1Id || !form.product2Id) {
      showToast("Please select both products", "error");
      return;
    }
    if (form.product1Id === form.product2Id) {
      showToast("Please select two different products", "error");
      return;
    }
    const p1 = products.find((p) => p.id === form.product1Id);
    const p2 = products.find((p) => p.id === form.product2Id);
    if (!p1 || !p2) return;

    const originalPrice = p1.price + p2.price;
    const bundlePrice = originalPrice * (1 - form.discountPercentage / 100);

    setCreating(true);
    try {
      const res = await fetch("/api/admin/bundles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `${p1.name} + ${p2.name}`,
          product1Id: p1.id,
          product2Id: p2.id,
          bundlePrice: Math.round(bundlePrice * 100) / 100,
          originalPrice,
          discountPercentage: form.discountPercentage,
          reasoning: null,
        }),
      });
      const result = await res.json();
      if (!result.success) throw new Error(result.error);
      await fetchBundles();
      setForm({ product1Id: "", product2Id: "", discountPercentage: 15 });
      showToast("Bundle created and published to mobile app!", "success");
      setActiveTab("manage");
    } catch (e: any) {
      showToast(e?.message ?? "Failed to create bundle", "error");
    } finally {
      setCreating(false);
    }
  };

  // ── Derived stats ────────────────────────────────────────────────────────────

  const totalBundles = bundles.length;
  const activeBundles = bundles.filter((b) => b.is_active).length;
  const inactiveBundles = totalBundles - activeBundles;

  const isAlreadyPublished = (id1: string, id2: string) =>
    bundles.some(
      (b) =>
        (b.product_1_id === id1 && b.product_2_id === id2) ||
        (b.product_1_id === id2 && b.product_2_id === id1)
    );

  // ── Compute derived bundle price from form ───────────────────────────────────

  const selectedP1 = products.find((p) => p.id === form.product1Id);
  const selectedP2 = products.find((p) => p.id === form.product2Id);
  const computedOriginal = (selectedP1?.price ?? 0) + (selectedP2?.price ?? 0);
  const computedBundle = computedOriginal * (1 - form.discountPercentage / 100);

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 space-y-6 bg-[#faf8f3] dark:bg-[#1c1a14] min-h-screen">

      {/* Toast */}
      {toast && (
        <div className={`fixed top-5 right-5 z-50 px-5 py-3 rounded shadow-lg text-sm font-medium text-white transition-all ${
          toast.type === "success" ? "bg-green-600" : "bg-red-600"
        }`}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <PackageOpen className="w-6 h-6 text-[#d4af37]" />
          <div>
            <h1 className="text-2xl font-semibold text-[#d4af37] uppercase tracking-[2px]">
              Bundle Deals
            </h1>
            <p className="text-sm text-[#7a6a4a] dark:text-[#9a8a68] mt-0.5">
              Create and manage product bundles shown on the mobile app.
            </p>
          </div>
        </div>
        <button
          onClick={() => setActiveTab("create")}
          className="inline-flex items-center gap-2 px-4 py-2 bg-[#d4af37] hover:bg-[#c9a62e] text-[#0a0a0a] text-sm font-bold transition-colors"
        >
          <Plus className="w-4 h-4" />
          Create Bundle
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total Bundles", value: totalBundles, color: "text-[#1c1810] dark:text-[#f0e8d8]" },
          { label: "Active", value: activeBundles, color: "text-green-600 dark:text-green-400" },
          { label: "Inactive", value: inactiveBundles, color: "text-[#7a6a4a] dark:text-[#9a8a68]" },
        ].map((s) => (
          <div key={s.label} className="bg-white dark:bg-[#26231a] border border-[#e8e0d0] dark:border-[#2e2a1e] p-4">
            <p className="text-xs text-[#7a6a4a] dark:text-[#9a8a68] uppercase tracking-wide">{s.label}</p>
            <p className={`text-3xl font-bold mt-1 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[#e8e0d0] dark:border-[#2e2a1e]">
        {[
          { key: "manage" as const, label: "Manage Bundles", icon: Settings2 },
          { key: "ideas" as const, label: "Bundle Ideas", icon: Lightbulb },
          { key: "create" as const, label: "Create Bundle", icon: Plus },
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`px-5 py-3 text-sm font-medium transition-colors flex items-center gap-2 ${
              activeTab === key
                ? "text-[#d4af37] border-b-2 border-[#d4af37]"
                : "text-[#7a6a4a] dark:text-[#9a8a68] hover:text-[#1c1810] dark:hover:text-[#f0e8d8]"
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* ── TAB: Manage Bundles ───────────────────────────────────────────────── */}
      {activeTab === "manage" && (
        <div className="space-y-3">
          {loadingBundles ? (
            <div className="flex justify-center py-16">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#d4af37]" />
            </div>
          ) : bundles.length === 0 ? (
            <div className="text-center py-16 bg-white dark:bg-[#26231a] border border-[#e8e0d0] dark:border-[#2e2a1e]">
              <PackageOpen className="w-12 h-12 text-[#d4af37] mx-auto mb-3 opacity-50" />
              <p className="text-[#d4af37] font-semibold text-lg">No bundles yet</p>
              <p className="text-[#7a6a4a] dark:text-[#9a8a68] text-sm mt-1">
                Create a bundle or publish one from Bundle Ideas.
              </p>
            </div>
          ) : (
            bundles.map((b) => (
              <div
                key={b.id}
                className={`bg-white dark:bg-[#26231a] border rounded-sm p-4 transition-all ${
                  b.is_active
                    ? "border-[#e8e0d0] dark:border-[#2e2a1e]"
                    : "border-dashed border-[#d0c8b0] dark:border-[#3a3628] opacity-70"
                }`}
              >
                <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                  {/* Products */}
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <ProductThumb src={b.product1?.images?.[0]} name={b.product1?.name} />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[#1c1810] dark:text-[#f0e8d8] truncate">
                        {b.product1?.name ?? "—"}
                      </p>
                      <p className="text-xs text-[#7a6a4a] dark:text-[#9a8a68]">
                        {fmt(b.product1?.price ?? 0)}
                      </p>
                    </div>
                    <span className="text-[#d4af37] font-bold text-xl flex-shrink-0">+</span>
                    <ProductThumb src={b.product2?.images?.[0]} name={b.product2?.name} />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[#1c1810] dark:text-[#f0e8d8] truncate">
                        {b.product2?.name ?? "—"}
                      </p>
                      <p className="text-xs text-[#7a6a4a] dark:text-[#9a8a68]">
                        {fmt(b.product2?.price ?? 0)}
                      </p>
                    </div>
                  </div>

                  {/* Price + actions */}
                  <div className="flex items-center gap-4 lg:border-l lg:border-[#e8e0d0] dark:lg:border-[#2e2a1e] lg:pl-4 flex-shrink-0">
                    <div>
                      <p className="text-xs text-[#7a6a4a] dark:text-[#9a8a68]">Bundle Price</p>
                      <p className="text-lg font-bold text-[#d4af37]">{fmt(b.bundle_price)}</p>
                      <p className="text-xs text-green-600 dark:text-green-400">
                        Save {b.discount_percentage}% · was {fmt(b.original_price)}
                      </p>
                    </div>

                    {/* Toggle */}
                    <button
                      onClick={() => toggleBundle(b.id, !b.is_active)}
                      disabled={togglingId === b.id}
                      title={b.is_active ? "Deactivate" : "Activate"}
                      className="disabled:opacity-50"
                    >
                      {b.is_active ? (
                        <ToggleRight className="w-8 h-8 text-green-500" />
                      ) : (
                        <ToggleLeft className="w-8 h-8 text-gray-400" />
                      )}
                    </button>

                    {/* Delete */}
                    <button
                      onClick={() => deleteBundle(b.id)}
                      disabled={deletingId === b.id}
                      className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                      title="Remove bundle"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Status badge + reasoning */}
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${
                    b.is_active
                      ? "bg-green-50 text-green-700 border border-green-200"
                      : "bg-gray-50 text-gray-500 border border-gray-200"
                  }`}>
                    {b.is_active ? "Live on App" : "Hidden"}
                  </span>
                  {b.reasoning && (
                    <p className="text-xs text-[#7a6a4a] dark:text-[#9a8a68] italic">{b.reasoning}</p>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ── TAB: Bundle Ideas ─────────────────────────────────────────────────── */}
      {activeTab === "ideas" && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-[#26231a] border border-[#e8e0d0] dark:border-[#2e2a1e] px-4 py-3 text-sm text-[#1c1810] dark:text-[#f0e8d8]">
            These pairings are auto-generated from your order history — top sellers paired with slow movers to help boost visibility. Publish any idea to make it live on the mobile app.
          </div>

          {loadingIdeas ? (
            <div className="flex justify-center py-16">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#d4af37]" />
            </div>
          ) : bundleIdeas.length === 0 ? (
            <div className="text-center py-14 bg-white dark:bg-[#26231a] border border-[#e8e0d0] dark:border-[#2e2a1e]">
              <Lightbulb className="w-12 h-12 text-[#d4af37] mx-auto mb-3 opacity-50" />
              <p className="text-[#d4af37] font-semibold text-lg">No ideas yet</p>
              <p className="text-[#7a6a4a] dark:text-[#9a8a68] text-sm mt-1">
                More sales data is needed to generate suggestions.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {bundleIdeas.map((idea) => {
                const key = `${idea.topSeller.id}-${idea.slowMover.id}`;
                const alreadyPublished = isAlreadyPublished(idea.topSeller.id, idea.slowMover.id);
                const isPublishing = publishingKey === key;

                return (
                  <div
                    key={key}
                    className="bg-white dark:bg-[#26231a] border border-[#e8e0d0] dark:border-[#2e2a1e] p-4 hover:border-[#d4af37]/40 transition-colors"
                  >
                    <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                      {/* Products */}
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <ProductThumb src={idea.topSeller.image} name={idea.topSeller.name} />
                          <div className="min-w-0">
                            <div className="text-[10px] font-semibold text-green-600 dark:text-green-400 uppercase tracking-wide mb-0.5">
                              Best seller
                            </div>
                            <p className="text-sm font-medium text-[#1c1810] dark:text-[#f0e8d8] truncate">
                              {idea.topSeller.name}
                            </p>
                            <p className="text-xs text-[#7a6a4a] dark:text-[#9a8a68]">
                              {fmt(idea.topSeller.price)} · {idea.topSeller.totalSold} sold
                            </p>
                          </div>
                        </div>
                        <span className="text-xl font-bold text-[#d4af37] flex-shrink-0">+</span>
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <ProductThumb src={idea.slowMover.image} name={idea.slowMover.name} />
                          <div className="min-w-0">
                            <div className={`text-[10px] font-semibold uppercase tracking-wide mb-0.5 ${
                              idea.slowMover.totalSold === 0
                                ? "text-red-500 dark:text-red-400"
                                : "text-amber-600 dark:text-amber-400"
                            }`}>
                              {idea.slowMover.totalSold === 0 ? "No sales yet" : "Slow seller"}
                            </div>
                            <p className="text-sm font-medium text-[#1c1810] dark:text-[#f0e8d8] truncate">
                              {idea.slowMover.name}
                            </p>
                            <p className="text-xs text-[#7a6a4a] dark:text-[#9a8a68]">
                              {fmt(idea.slowMover.price)} · {idea.slowMover.totalSold} sold
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Price block */}
                      <div className="flex items-center gap-5 lg:border-l lg:border-[#e8e0d0] dark:lg:border-[#2e2a1e] lg:pl-5 flex-shrink-0">
                        <div>
                          <p className="text-xs text-[#7a6a4a] dark:text-[#9a8a68]">Bundle price</p>
                          <p className="text-xl font-bold text-[#d4af37]">{fmt(idea.bundlePrice)}</p>
                          <p className="text-xs font-medium text-green-600 dark:text-green-400">
                            Save {idea.suggestedDiscount}%
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Reasoning + action */}
                    <div className="mt-3 pt-3 border-t border-[#e8e0d0] dark:border-[#2e2a1e] flex flex-wrap items-center justify-between gap-3">
                      <p className="text-xs text-[#7a6a4a] dark:text-[#9a8a68] italic flex-1">
                        {idea.reasoning}
                      </p>

                      {alreadyPublished ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-green-50 text-green-700 border border-green-200 rounded">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                          Already Published
                        </span>
                      ) : (
                        <button
                          onClick={() => publishIdea(idea)}
                          disabled={isPublishing}
                          className="inline-flex items-center gap-2 px-4 py-1.5 bg-[#d4af37] hover:bg-[#c9a62e] text-[#0a0a0a] text-xs font-bold rounded transition-colors disabled:opacity-60"
                        >
                          {isPublishing ? (
                            <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                            </svg>
                          ) : (
                            <PackageOpen className="w-3.5 h-3.5" />
                          )}
                          {isPublishing ? "Publishing…" : "Publish to Mobile App"}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── TAB: Create Bundle ────────────────────────────────────────────────── */}
      {activeTab === "create" && (
        <div className="max-w-2xl space-y-6">
          <div className="bg-white dark:bg-[#26231a] border border-[#e8e0d0] dark:border-[#2e2a1e] p-6 space-y-5">
            <h2 className="text-base font-semibold text-[#1c1810] dark:text-[#f0e8d8] uppercase tracking-wide">
              New Bundle
            </h2>

            {/* Product 1 */}
            <div>
              <label className="block text-xs font-semibold text-[#7a6a4a] dark:text-[#9a8a68] uppercase tracking-wide mb-1.5">
                Product 1 — Best Seller
              </label>
              <select
                value={form.product1Id}
                onChange={(e) => setForm((f) => ({ ...f, product1Id: e.target.value }))}
                className="w-full px-3 py-2 bg-[#faf8f3] dark:bg-[#1c1a14] border border-[#e8e0d0] dark:border-[#2e2a1e] text-[#1c1810] dark:text-[#f0e8d8] text-sm focus:outline-none focus:ring-2 focus:ring-[#d4af37]"
              >
                <option value="">Select a product…</option>
                {products
                  .filter((p) => p.id !== form.product2Id)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} — {fmt(p.price)}
                    </option>
                  ))}
              </select>
            </div>

            {/* Product 2 */}
            <div>
              <label className="block text-xs font-semibold text-[#7a6a4a] dark:text-[#9a8a68] uppercase tracking-wide mb-1.5">
                Product 2 — Paired With
              </label>
              <select
                value={form.product2Id}
                onChange={(e) => setForm((f) => ({ ...f, product2Id: e.target.value }))}
                className="w-full px-3 py-2 bg-[#faf8f3] dark:bg-[#1c1a14] border border-[#e8e0d0] dark:border-[#2e2a1e] text-[#1c1810] dark:text-[#f0e8d8] text-sm focus:outline-none focus:ring-2 focus:ring-[#d4af37]"
              >
                <option value="">Select a product…</option>
                {products
                  .filter((p) => p.id !== form.product1Id)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} — {fmt(p.price)}
                    </option>
                  ))}
              </select>
            </div>

            {/* Discount */}
            <div>
              <label className="block text-xs font-semibold text-[#7a6a4a] dark:text-[#9a8a68] uppercase tracking-wide mb-1.5">
                Discount Percentage
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={form.discountPercentage}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, discountPercentage: Math.min(50, Math.max(1, Number(e.target.value))) }))
                  }
                  className="w-24 px-3 py-2 bg-[#faf8f3] dark:bg-[#1c1a14] border border-[#e8e0d0] dark:border-[#2e2a1e] text-[#1c1810] dark:text-[#f0e8d8] text-sm focus:outline-none focus:ring-2 focus:ring-[#d4af37]"
                />
                <span className="text-sm text-[#7a6a4a] dark:text-[#9a8a68]">%</span>
              </div>
            </div>

            {/* Price preview */}
            {selectedP1 && selectedP2 && (
              <div className="bg-[#fdf8ec] dark:bg-[#26231a] border border-[#e8e0d0] dark:border-[#2e2a1e] p-4 space-y-1">
                <p className="text-xs font-semibold text-[#8B6914] dark:text-[#D4AF37] uppercase tracking-wide">
                  Price Preview
                </p>
                <div className="flex items-baseline gap-3 mt-1">
                  <span className="text-2xl font-bold text-[#d4af37]">{fmt(computedBundle)}</span>
                  <span className="text-sm text-[#7a6a4a] dark:text-[#9a8a68] line-through">{fmt(computedOriginal)}</span>
                  <span className="text-xs font-semibold text-green-600 dark:text-green-400">
                    Save {form.discountPercentage}%
                  </span>
                </div>
                <p className="text-xs text-[#7a6a4a] dark:text-[#9a8a68]">
                  {selectedP1.name} + {selectedP2.name}
                </p>
              </div>
            )}

            <button
              onClick={createBundle}
              disabled={creating || !form.product1Id || !form.product2Id}
              className="w-full py-2.5 bg-[#d4af37] hover:bg-[#c9a62e] text-[#0a0a0a] text-sm font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {creating ? "Creating…" : "Create & Publish Bundle"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
