"use client";

import React, { useState, useEffect, useCallback } from "react";
import { CheckCircle, Loader2, AlertCircle, SlidersHorizontal } from "lucide-react";

const PRICE_OPTIONS = [250, 350, 450];

interface AffectedRow {
  productId: string;
  productName: string;
  size: string;
  currentPrice: number;
}

interface Product {
  id: string;
  name: string;
  sizes: Record<string, number>;
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(amount);

const Skeleton = ({ className }: { className?: string }) => (
  <div className={`animate-pulse bg-[#d4af37]/10 rounded ${className}`} />
);

export default function NormalizePricesPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // All fetched products — needed to merge sizes before PATCH
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  // Flat list of rows with non-standard prices
  const [affected, setAffected] = useState<AffectedRow[]>([]);
  // Local edits: productId -> { sizeName -> chosenPrice }
  const [pending, setPending] = useState<Map<string, Record<string, number>>>(new Map());

  const fetchAllProducts = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      let page = 1;
      const accumulated: Product[] = [];

      while (true) {
        const res = await fetch(`/api/admin/products?page=${page}&status=all`);
        const result = await res.json();
        if (!result.success) throw new Error(result.error || "Failed to fetch products");

        const products: Product[] = (result.data.products || []).map((p: any) => ({
          id: p.id,
          name: p.name,
          sizes: p.sizes || {},
        }));

        accumulated.push(...products);

        if (page >= (result.data.totalPages || 1)) break;
        page++;
      }

      setAllProducts(accumulated);

      // Build affected rows: one row per size with a non-standard price
      const rows: AffectedRow[] = [];
      for (const product of accumulated) {
        for (const [size, price] of Object.entries(product.sizes)) {
          if (!PRICE_OPTIONS.includes(price)) {
            rows.push({
              productId: product.id,
              productName: product.name,
              size,
              currentPrice: price,
            });
          }
        }
      }
      setAffected(rows);

      // Default each pending selection to the nearest standard price
      const initialPending = new Map<string, Record<string, number>>();
      for (const row of rows) {
        const nearest = PRICE_OPTIONS.reduce((prev, curr) =>
          Math.abs(curr - row.currentPrice) < Math.abs(prev - row.currentPrice) ? curr : prev
        );
        const existing = initialPending.get(row.productId) || {};
        initialPending.set(row.productId, { ...existing, [row.size]: nearest });
      }
      setPending(initialPending);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAllProducts();
  }, [fetchAllProducts]);

  const handlePriceChange = (productId: string, size: string, price: number) => {
    setPending(prev => {
      const next = new Map(prev);
      const existing = next.get(productId) || {};
      next.set(productId, { ...existing, [size]: price });
      return next;
    });
  };

  const handleSaveAll = async () => {
    setIsSaving(true);
    setError(null);
    try {
      const productIds = [...pending.keys()];

      await Promise.all(
        productIds.map(async (productId) => {
          const product = allProducts.find(p => p.id === productId);
          if (!product) return;

          const changes = pending.get(productId) || {};
          // Merge pending changes over the full existing sizes
          const fullSizes = { ...product.sizes, ...changes };
          const lowestPrice = Math.min(...Object.values(fullSizes));

          const res = await fetch(`/api/admin/products/${productId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sizes: fullSizes, price: lowestPrice }),
          });

          if (!res.ok) {
            const data = await res.json();
            throw new Error(`${product.name}: ${data.error || "Failed to save"}`);
          }
        })
      );

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
      // Re-fetch to recompute affected rows
      await fetchAllProducts();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setIsSaving(false);
    }
  };

  const getChosenPrice = (productId: string, size: string) =>
    pending.get(productId)?.[size] ?? PRICE_OPTIONS[0];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-[#1c1810]">Normalize Prices</h1>
          {!isLoading && (
            <div className="h-5 px-2 bg-[#d4af37]/10 rounded-full flex items-center justify-center">
              <span className="text-xs text-[#7a6a4a] font-semibold">
                {affected.length} {affected.length === 1 ? "size" : "sizes"}
              </span>
            </div>
          )}
        </div>
        {!isLoading && affected.length > 0 && (
          <button
            onClick={handleSaveAll}
            disabled={isSaving}
            className="px-5 py-2 bg-[#d4af37] text-[#0a0a0a] font-semibold hover:bg-[#d4af37]/90 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Save All Changes"
            )}
          </button>
        )}
      </div>

      {/* Info banner */}
      <div className="border-l-4 border-[#d4af37] bg-amber-50 px-4 py-3">
        <p className="text-sm text-amber-800">
          Standard prices are <strong>₱250</strong>, <strong>₱350</strong>, and <strong>₱450</strong>.
          The table below shows every product size that has a non-standard price.
          Assign the correct price for each row, then click <strong>Save All Changes</strong>.
        </p>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Success flash */}
      {saveSuccess && (
        <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded">
          <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
          <p className="text-sm text-green-700 font-medium">All prices saved successfully.</p>
        </div>
      )}

      {/* Table */}
      <div className="bg-[#faf8f3] border border-[#e8e0d0]">
        <div className="px-6 py-4 border-b border-[#e8e0d0]">
          <h2 className="text-base font-medium text-[#1c1810]">Products with Non-Standard Prices</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-white border-b border-[#e8e0d0]">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-[#7a6a4a] uppercase tracking-wider">
                  Product
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-[#7a6a4a] uppercase tracking-wider">
                  Size
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-[#7a6a4a] uppercase tracking-wider">
                  Current Price
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-[#7a6a4a] uppercase tracking-wider">
                  New Price
                </th>
              </tr>
            </thead>
            <tbody className="bg-[#faf8f3] divide-y divide-[#d4af37]/10">
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="border-b border-[#d4af37]/10">
                    <td className="px-6 py-4"><Skeleton className="h-4 w-40" /></td>
                    <td className="px-6 py-4"><Skeleton className="h-4 w-12" /></td>
                    <td className="px-6 py-4"><Skeleton className="h-4 w-16" /></td>
                    <td className="px-6 py-4"><Skeleton className="h-8 w-24" /></td>
                  </tr>
                ))
              ) : affected.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-16 text-center">
                    <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
                    <p className="text-[#1c1810] font-medium">All product prices are already standard.</p>
                    <p className="text-sm text-[#7a6a4a] mt-1">Every size is priced at ₱250, ₱350, or ₱450.</p>
                  </td>
                </tr>
              ) : (
                affected.map((row, i) => (
                  <tr key={`${row.productId}-${row.size}-${i}`} className="hover:bg-[#d4af37]/5 transition-colors">
                    <td className="px-6 py-4 text-sm font-medium text-[#1c1810]">
                      {row.productName}
                    </td>
                    <td className="px-6 py-4 text-sm text-[#7a6a4a]">
                      {row.size}
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-semibold text-red-600">
                        {formatCurrency(row.currentPrice)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <select
                        value={getChosenPrice(row.productId, row.size)}
                        onChange={(e) =>
                          handlePriceChange(row.productId, row.size, Number(e.target.value))
                        }
                        className="px-3 py-1.5 bg-white border border-[#e8e0d0] text-[#1c1810] text-sm focus:outline-none focus:ring-2 focus:ring-[#d4af37] focus:border-transparent"
                      >
                        {PRICE_OPTIONS.map(p => (
                          <option key={p} value={p}>₱{p}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer save button (repeated for long tables) */}
        {!isLoading && affected.length > 5 && (
          <div className="px-6 py-4 border-t border-[#e8e0d0] flex justify-end">
            <button
              onClick={handleSaveAll}
              disabled={isSaving}
              className="px-5 py-2 bg-[#d4af37] text-[#0a0a0a] font-semibold hover:bg-[#d4af37]/90 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save All Changes"
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
