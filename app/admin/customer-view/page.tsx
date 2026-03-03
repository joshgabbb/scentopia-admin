// app/admin/customer-view/page.tsx
// Simulates the mobile-app product browsing experience inside the admin panel.
"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Search, X, ChevronLeft, ChevronRight,
  Smartphone, RotateCcw, ShoppingBag,
} from "lucide-react";
import Image from "next/image";

// ─── Types ────────────────────────────────────────────────────────────────

interface Category {
  id: string;
  name: string;
}

interface Product {
  id: string;
  name: string;
  description: string;
  images: string[];
  price: number;
  totalStock: number;
  category: { id: string; name: string } | null;
  perfumeType: string;
  isActive: boolean;
  sizes: Record<string, number>;
  stocks: Record<string, number>;
}

type StockStatus = "in_stock" | "low_stock" | "out_of_stock";

// ─── Helpers ──────────────────────────────────────────────────────────────

function getStockStatus(total: number): StockStatus {
  if (total === 0) return "out_of_stock";
  if (total <= 5)  return "low_stock";
  return "in_stock";
}

function StockBadge({ total }: { total: number }) {
  const status = getStockStatus(total);
  const map = {
    in_stock:      { label: "In Stock",    cls: "bg-emerald-100 text-emerald-700" },
    low_stock:     { label: "Low Stock",   cls: "bg-amber-100 text-amber-700" },
    out_of_stock:  { label: "Out of Stock", cls: "bg-red-100 text-red-600" },
  };
  const { label, cls } = map[status];
  return (
    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${cls}`}>
      {label}
    </span>
  );
}

function getPageNumbers(current: number, total: number): (number | "...")[] {
  if (total <= 5) return Array.from({ length: total }, (_, i) => i + 1);
  const result: (number | "...")[] = [1];
  if (current > 3) result.push("...");
  for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) {
    result.push(i);
  }
  if (current < total - 2) result.push("...");
  if (total > 1) result.push(total);
  return result;
}

// ─── Product Card (mobile-style) ─────────────────────────────────────────

function ProductCard({ product }: { product: Product }) {
  const [imgError, setImgError] = useState(false);
  const imageUrl = !imgError && product.images?.[0] ? product.images[0] : null;

  return (
    <div className="bg-white rounded-xl overflow-hidden shadow-sm border border-gray-100 active:scale-95 transition-transform duration-150 cursor-pointer">
      {/* Image */}
      <div className="relative w-full aspect-square bg-[#f8f6f2]">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={product.name}
            fill
            className="object-cover"
            sizes="(max-width: 400px) 50vw, 200px"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-4xl opacity-20">🌸</div>
          </div>
        )}

        {/* Out of stock overlay */}
        {product.totalStock === 0 && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <span className="text-white text-xs font-bold bg-black/60 px-2 py-1 rounded-full">
              Out of Stock
            </span>
          </div>
        )}

        {/* Category tag */}
        {product.category && (
          <div className="absolute top-2 left-2">
            <span className="text-[9px] font-semibold bg-white/90 text-[#7a6a4a] px-1.5 py-0.5 rounded-full">
              {product.category.name}
            </span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-2.5 space-y-1">
        <p className="text-xs font-bold text-[#1c1810] leading-tight line-clamp-2">
          {product.name}
        </p>
        {product.description && (
          <p className="text-[10px] text-[#9a8a6a] line-clamp-2 leading-snug">
            {product.description}
          </p>
        )}
        <div className="flex items-center justify-between pt-0.5">
          <span className="text-sm font-bold text-[#8B6914]">
            ₱{product.price.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
          </span>
          <StockBadge total={product.totalStock} />
        </div>
        {/* Sizes */}
        {Object.keys(product.sizes).length > 0 && (
          <div className="flex flex-wrap gap-1 pt-0.5">
            {Object.keys(product.sizes).map((size) => {
              const inStock = (product.stocks[size] ?? 0) > 0;
              return (
                <span
                  key={size}
                  className={`text-[9px] font-semibold px-1.5 py-0.5 rounded border ${
                    inStock
                      ? "bg-[#faf8f3] border-[#e8e0d0] text-[#7a6a4a]"
                      : "bg-gray-50 border-gray-200 text-gray-300 line-through"
                  }`}
                >
                  {size}
                </span>
              );
            })}
          </div>
        )}
        {/* Add to cart button */}
        <button
          disabled={product.totalStock === 0}
          className={`w-full mt-1 py-1.5 rounded-lg text-[10px] font-bold transition-colors flex items-center justify-center gap-1 ${
            product.totalStock > 0
              ? "bg-[#D4AF37] text-[#1c1810] active:bg-[#C4A030]"
              : "bg-gray-100 text-gray-400 cursor-not-allowed"
          }`}
        >
          <ShoppingBag className="w-3 h-3" />
          {product.totalStock > 0 ? "Add to Cart" : "Unavailable"}
        </button>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────

export default function CustomerViewPage() {
  const [products, setProducts]       = useState<Product[]>([]);
  const [categories, setCategories]   = useState<Category[]>([]);
  const [isLoading, setIsLoading]     = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages]   = useState(1);
  const [totalCount, setTotalCount]   = useState(0);

  // Filters
  const [search, setSearch]         = useState("");
  const [categoryId, setCategoryId] = useState("all");

  // Mobile frame toggle
  const [showFrame, setShowFrame] = useState(true);

  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch categories once
  useEffect(() => {
    fetch("/api/admin/categories")
      .then((r) => r.json())
      .then((data) => {
        if (data.success) setCategories(data.data);
      })
      .catch(console.error);
  }, []);

  const fetchProducts = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page:     currentPage.toString(),
        search,
        category: categoryId,
        status:   "active",
        sort_by:  "created_at",
      });
      const res    = await fetch(`/api/admin/products?${params}`);
      const result = await res.json();
      if (result.success) {
        setProducts(result.data.products);
        setTotalPages(result.data.totalPages);
        setTotalCount(result.data.totalCount);
      }
    } catch (err) {
      console.error("Failed to fetch products:", err);
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, search, categoryId]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  // Debounced search
  const handleSearch = (value: string) => {
    setSearch(value);
    setCurrentPage(1);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
  };

  function resetFilters() {
    setSearch("");
    setCategoryId("all");
    setCurrentPage(1);
  }

  const hasFilters = search || categoryId !== "all";

  // ── Phone frame inner content ────────────────────────────────────────────
  const mobileContent = (
    <div className="flex flex-col h-full bg-gray-50 font-sans">
      {/* Status bar mock */}
      <div className="bg-white px-4 pt-3 pb-1 flex items-center justify-between shrink-0">
        <span className="text-[10px] font-bold text-[#1c1810]">9:41</span>
        <div className="flex items-center gap-1.5 text-[#1c1810]">
          <div className="flex gap-0.5 items-end">
            <div className="w-0.5 h-1 bg-current rounded-sm" />
            <div className="w-0.5 h-1.5 bg-current rounded-sm" />
            <div className="w-0.5 h-2 bg-current rounded-sm" />
            <div className="w-0.5 h-2.5 bg-current rounded-sm" />
          </div>
          <span className="text-[9px]">●●●</span>
          <span className="text-[9px]">🔋</span>
        </div>
      </div>

      {/* App header */}
      <div className="bg-white px-4 py-2 border-b border-gray-100 shrink-0">
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs font-bold text-[#1c1810] tracking-wide">Scentopia</div>
          <div className="w-6 h-6 rounded-full bg-[#D4AF37]/20 flex items-center justify-center">
            <ShoppingBag className="w-3 h-3 text-[#8B6914]" />
          </div>
        </div>
        {/* Search bar */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" />
          <input
            type="text"
            placeholder="Search fragrances…"
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            className="w-full pl-7 pr-7 py-1.5 bg-gray-100 rounded-lg text-[11px] text-[#1c1810] placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-[#D4AF37]/50"
          />
          {search && (
            <button onClick={() => handleSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2">
              <X className="w-3 h-3 text-gray-400" />
            </button>
          )}
        </div>
      </div>

      {/* Category pills */}
      <div className="bg-white px-3 py-2 border-b border-gray-100 shrink-0">
        <div className="flex gap-1.5 overflow-x-auto scrollbar-hide pb-0.5">
          {[{ id: "all", name: "All" }, ...categories].map((cat) => (
            <button
              key={cat.id}
              onClick={() => { setCategoryId(cat.id); setCurrentPage(1); }}
              className={`shrink-0 text-[10px] font-semibold px-3 py-1 rounded-full transition-colors ${
                categoryId === cat.id
                  ? "bg-[#D4AF37] text-[#1c1810]"
                  : "bg-gray-100 text-gray-600 active:bg-gray-200"
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* Products grid */}
      <div className="flex-1 overflow-y-auto px-3 py-3">
        {isLoading ? (
          <div className="grid grid-cols-2 gap-2">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-white rounded-xl overflow-hidden shadow-sm border border-gray-100 animate-pulse">
                <div className="aspect-square bg-gray-200" />
                <div className="p-2.5 space-y-1.5">
                  <div className="h-3 bg-gray-200 rounded w-4/5" />
                  <div className="h-2.5 bg-gray-200 rounded w-3/5" />
                  <div className="h-3.5 bg-gray-200 rounded w-2/5" />
                </div>
              </div>
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-center">
            <div className="text-3xl mb-2">🌸</div>
            <p className="text-xs font-semibold text-[#7a6a4a]">No products found</p>
            {hasFilters && (
              <button onClick={resetFilters} className="mt-1.5 text-[10px] text-[#8B6914] font-semibold">
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {products.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="bg-white border-t border-gray-100 px-3 py-2 flex items-center justify-between shrink-0">
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="p-1 rounded-full bg-gray-100 text-gray-500 disabled:opacity-30 active:bg-gray-200"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <span className="text-[10px] text-gray-500 font-medium">
            {currentPage} / {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="p-1 rounded-full bg-gray-100 text-gray-500 disabled:opacity-30 active:bg-gray-200"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Tab bar mock */}
      <div className="bg-white border-t border-gray-100 px-6 py-2 flex items-center justify-around shrink-0">
        {[
          { icon: "🏠", label: "Home" },
          { icon: "🔍", label: "Search" },
          { icon: "🛒", label: "Cart" },
          { icon: "👤", label: "Profile" },
        ].map(({ icon, label }) => (
          <div key={label} className="flex flex-col items-center gap-0.5">
            <span className="text-base">{icon}</span>
            <span className="text-[8px] text-gray-400 font-medium">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-[#D4AF37]/10 border border-[#D4AF37]/25 rounded-sm flex items-center justify-center shrink-0">
            <Smartphone className="w-4.5 h-4.5 text-[#8B6914]" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-[#1c1810]">Customer View</h1>
            <p className="text-sm text-[#7a6a4a] mt-0.5">
              Mobile app simulation —{" "}
              <span className="font-semibold text-[#8B6914]">{totalCount}</span> active products
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFrame((v) => !v)}
            className="inline-flex items-center gap-2 px-3 py-2 border border-[#e8e0d0] text-[#7a6a4a] hover:bg-[#faf8f3] hover:text-[#8B6914] rounded-sm text-sm font-medium transition-colors"
          >
            <Smartphone className="w-4 h-4" />
            {showFrame ? "Hide Frame" : "Show Frame"}
          </button>
          {hasFilters && (
            <button
              onClick={resetFilters}
              className="inline-flex items-center gap-1.5 px-3 py-2 border border-[#e8e0d0] text-[#7a6a4a] hover:bg-[#faf8f3] rounded-sm text-sm transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Admin-level filter bar (outside phone frame for convenience) */}
      <div className="bg-white border border-[#e8e0d0] rounded-sm p-4">
        <p className="text-xs font-bold text-[#7a6a4a] uppercase tracking-wider mb-3">Admin Filters</p>
        <div className="flex flex-wrap gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9a8a6a]" />
            <input
              type="text"
              placeholder="Product name or description…"
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              className="pl-9 pr-4 py-2 border border-[#e8e0d0] bg-white text-[#1c1810] text-sm placeholder-[#b0a080] rounded-sm focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/40 focus:border-[#D4AF37] transition-colors w-64"
            />
          </div>
          <select
            value={categoryId}
            onChange={(e) => { setCategoryId(e.target.value); setCurrentPage(1); }}
            className="px-3 py-2 border border-[#e8e0d0] bg-white text-[#1c1810] text-sm rounded-sm focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/40 focus:border-[#D4AF37] transition-colors"
          >
            <option value="all">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Simulator container */}
      <div className="flex justify-center">
        {showFrame ? (
          /* Phone frame */
          <div className="relative" style={{ width: 375 }}>
            {/* Outer shell */}
            <div className="relative bg-[#1c1810] rounded-[3rem] p-3 shadow-2xl" style={{ paddingTop: 16, paddingBottom: 16 }}>
              {/* Speaker */}
              <div className="absolute top-6 left-1/2 -translate-x-1/2 w-16 h-1.5 bg-[#3a3028] rounded-full" />
              {/* Camera */}
              <div className="absolute top-5 right-[38%] w-2.5 h-2.5 bg-[#2a221c] rounded-full border border-[#3a3028]" />

              {/* Screen bezel */}
              <div className="bg-white rounded-[2.5rem] overflow-hidden" style={{ height: 720 }}>
                {mobileContent}
              </div>

              {/* Home indicator */}
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 w-24 h-1 bg-[#3a3028] rounded-full" />
            </div>

            {/* Side buttons */}
            <div className="absolute left-[-6px] top-28 w-1.5 h-8 bg-[#2a221c] rounded-l-sm" />
            <div className="absolute left-[-6px] top-44 w-1.5 h-12 bg-[#2a221c] rounded-l-sm" />
            <div className="absolute left-[-6px] top-60 w-1.5 h-12 bg-[#2a221c] rounded-l-sm" />
            <div className="absolute right-[-6px] top-36 w-1.5 h-16 bg-[#2a221c] rounded-r-sm" />
          </div>
        ) : (
          /* Flat view (no frame) */
          <div
            className="border border-[#e8e0d0] rounded-sm shadow-sm overflow-hidden bg-gray-50"
            style={{ width: 375, height: 720 }}
          >
            {mobileContent}
          </div>
        )}
      </div>

      {/* Pagination (admin level, below frame) */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="p-1.5 border border-[#e8e0d0] text-[#7a6a4a] hover:bg-[#f5f0e8] hover:text-[#8B6914] disabled:opacity-40 disabled:cursor-not-allowed rounded-sm transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          {getPageNumbers(currentPage, totalPages).map((page, idx) =>
            page === "..." ? (
              <span key={`e-${idx}`} className="px-2 text-xs text-[#9a8a6a]">…</span>
            ) : (
              <button
                key={page}
                onClick={() => setCurrentPage(page as number)}
                className={`min-w-[32px] h-8 px-2 text-xs font-semibold border rounded-sm transition-colors ${
                  currentPage === page
                    ? "bg-[#D4AF37] text-[#1c1810] border-[#D4AF37]"
                    : "border-[#e8e0d0] text-[#7a6a4a] hover:bg-[#f5f0e8] hover:text-[#8B6914]"
                }`}
              >
                {page}
              </button>
            )
          )}
          <button
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="p-1.5 border border-[#e8e0d0] text-[#7a6a4a] hover:bg-[#f5f0e8] hover:text-[#8B6914] disabled:opacity-40 disabled:cursor-not-allowed rounded-sm transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Legend */}
      <div className="bg-[#faf8f3] border border-[#e8e0d0] rounded-sm p-4 text-xs text-[#7a6a4a] space-y-1">
        <p className="font-semibold text-[#8B6914] mb-2">Stock Status Legend</p>
        <div className="flex flex-wrap gap-3">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            In Stock (6+ units)
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            Low Stock (1–5 units)
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-red-400" />
            Out of Stock (0 units)
          </span>
        </div>
        <p className="mt-2 text-[#9a8a6a]">
          This view shows only active (non-archived) products, identical to what customers see in the mobile app.
        </p>
      </div>
    </div>
  );
}
