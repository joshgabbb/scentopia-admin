"use client";
import React, { useState, useEffect, useRef, useCallback } from "react";
import { ArrowUpFromLine, CheckCircle, AlertCircle, Loader2, Search, X, Package, ChevronDown } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";

interface Product {
  id: string;
  name: string;
  sizes: Record<string, number>;
  stocks: Record<string, number>;
  isActive: boolean;
  category?: { id: string; name: string } | null;
}

interface Toast {
  type: "success" | "error";
  message: string;
}

const REASON_OPTIONS = ["Sale", "Damage", "Adjustment", "Expiry", "Other"];

export default function StockOutPage() {
  const { themeClasses } = useTheme();

  // Product search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Browse modal state
  const [browseOpen, setBrowseOpen] = useState(false);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [isLoadingAll, setIsLoadingAll] = useState(false);
  const [browseSearch, setBrowseSearch] = useState("");
  const [browseCategory, setBrowseCategory] = useState("all");

  const [selectedSize, setSelectedSize] = useState("");
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");
  const [remarks, setRemarks] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);

  const searchProducts = useCallback(async (q: string) => {
    if (!q.trim()) { setSearchResults([]); return; }
    setIsSearching(true);
    try {
      const res = await fetch(`/api/admin/products?search=${encodeURIComponent(q)}&status=active&limit=10`);
      const result = await res.json();
      if (result.success) {
        setSearchResults((result.data.products as Product[]).filter(p => p.isActive));
      }
    } catch {
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value;
    setSearchQuery(q);
    setShowDropdown(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchProducts(q), 300);
  };

  const handleSelectProduct = (product: Product) => {
    setSelectedProduct(product);
    setSearchQuery(product.name);
    setShowDropdown(false);
    setSelectedSize("");
    setQuantity("");
  };

  const handleClearProduct = () => {
    setSelectedProduct(null);
    setSearchQuery("");
    setSearchResults([]);
    setSelectedSize("");
    setQuantity("");
    setBrowseOpen(false);
  };

  // Paginate through ALL products
  const loadAllProducts = useCallback(async () => {
    if (allProducts.length > 0) { setBrowseOpen(true); return; }
    setIsLoadingAll(true);
    try {
      let page = 1;
      const accumulated: Product[] = [];
      while (true) {
        const res = await fetch(`/api/admin/products?status=active&page=${page}`);
        const result = await res.json();
        if (!result.success) break;
        const batch = (result.data.products as Product[]).filter(p => p.isActive);
        accumulated.push(...batch);
        if (page >= (result.data.totalPages || 1)) break;
        page++;
      }
      setAllProducts(accumulated);
    } catch {
      setAllProducts([]);
    } finally {
      setIsLoadingAll(false);
      setBrowseOpen(true);
    }
  }, [allProducts.length]);

  const handleToggleBrowse = () => {
    if (browseOpen) { setBrowseOpen(false); return; }
    loadAllProducts();
  };

  // Close search dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Lock body scroll when browse modal is open
  useEffect(() => {
    if (browseOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [browseOpen]);

  const currentSizeStock = selectedProduct && selectedSize
    ? (selectedProduct.stocks?.[selectedSize] ?? 0)
    : null;

  const showToast = (type: "success" | "error", message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  const handleReset = () => {
    handleClearProduct();
    setReason("");
    setRemarks("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const qty = parseInt(quantity);
    if (!selectedProduct || !selectedSize || !qty || qty <= 0 || !reason) return;

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/admin/stock/out", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: selectedProduct.id,
          size: selectedSize,
          quantity: qty,
          reason,
          remarks: remarks || null,
        }),
      });

      const result = await res.json();

      if (result.success) {
        setSelectedProduct(prev => prev
          ? { ...prev, stocks: { ...prev.stocks, [selectedSize]: result.newStock } }
          : prev
        );
        showToast("success", `Removed ${qty} unit${qty !== 1 ? "s" : ""} from ${selectedSize}. New stock: ${result.newStock}.`);
        setQuantity("");
        setRemarks("");
        setSelectedSize("");
        setReason("");
      } else {
        showToast("error", result.error || "Failed to remove stock.");
      }
    } catch {
      showToast("error", "Network error. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const qtyNum = parseInt(quantity) || 0;
  const insufficientStock = currentSizeStock !== null && qtyNum > 0 && qtyNum > currentSizeStock;
  const isFormValid = !!(selectedProduct && selectedSize && qtyNum > 0 && reason && !insufficientStock);

  // Derived browse list
  const browseCategories = ["all", ...Array.from(
    new Set(allProducts.map(p => p.category?.name ?? "Uncategorized"))
  ).sort()];

  const filteredBrowse = allProducts.filter(p => {
    const matchesSearch = !browseSearch.trim() ||
      p.name.toLowerCase().includes(browseSearch.toLowerCase());
    const matchesCategory = browseCategory === "all" ||
      (p.category?.name ?? "Uncategorized") === browseCategory;
    return matchesSearch && matchesCategory;
  });

  const grouped = filteredBrowse.reduce<Record<string, Product[]>>((acc, p) => {
    const cat = p.category?.name ?? "Uncategorized";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(p);
    return acc;
  }, {});

  return (
    <div className="max-w-lg space-y-6">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-6 right-6 z-50 flex items-start gap-3 p-4 rounded-lg shadow-lg border max-w-sm ${
          toast.type === "success" ? "bg-green-50 border-green-200 text-green-800" : "bg-red-50 border-red-200 text-red-800"
        }`}>
          {toast.type === "success"
            ? <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-green-600" />
            : <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-red-500" />}
          <p className="text-sm font-medium">{toast.message}</p>
        </div>
      )}

      {/* Browse All Products Modal */}
      {browseOpen && (
        <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setBrowseOpen(false)}
          />
          {/* Panel */}
          <div className="relative z-10 bg-white w-full sm:max-w-2xl sm:mx-4 rounded-t-2xl sm:rounded-xl shadow-2xl flex flex-col"
            style={{ maxHeight: "85vh" }}>
            {/* Modal header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#e8e0d0]">
              <div className="flex items-center gap-2">
                <Package className="w-5 h-5 text-[#d4af37]" />
                <h2 className="text-base font-semibold text-[#1c1810]">Browse All Products</h2>
                {!isLoadingAll && (
                  <span className="text-xs text-[#7a6a4a] bg-[#f2ede4] px-2 py-0.5 rounded-full">
                    {allProducts.length} products
                  </span>
                )}
              </div>
              <button
                onClick={() => setBrowseOpen(false)}
                className="p-1.5 rounded-lg hover:bg-[#faf8f3] text-[#7a6a4a] hover:text-[#1c1810] transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {isLoadingAll ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <Loader2 className="w-6 h-6 animate-spin text-[#d4af37]" />
                <p className="text-sm text-[#7a6a4a]">Loading all products…</p>
              </div>
            ) : (
              <>
                {/* Search + category filter */}
                <div className="px-4 pt-3 pb-2 space-y-2 border-b border-[#e8e0d0]">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#7a6a4a] pointer-events-none" />
                    <input
                      type="text"
                      value={browseSearch}
                      onChange={e => setBrowseSearch(e.target.value)}
                      placeholder="Filter by product name…"
                      className="w-full pl-9 pr-8 py-2 bg-[#faf8f3] border border-[#e8e0d0] rounded-lg text-sm text-[#1c1810] placeholder-[#b0a080] focus:outline-none focus:ring-2 focus:ring-[#d4af37]"
                    />
                    {browseSearch && (
                      <button
                        onClick={() => setBrowseSearch("")}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#7a6a4a] hover:text-[#1c1810]"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  {/* Category tabs */}
                  <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                    {browseCategories.map(cat => (
                      <button
                        key={cat}
                        onClick={() => setBrowseCategory(cat)}
                        className={`shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                          browseCategory === cat
                            ? "bg-[#d4af37] text-[#0a0a0a]"
                            : "bg-[#f2ede4] text-[#7a6a4a] hover:bg-[#e8e0d0]"
                        }`}
                      >
                        {cat === "all" ? `All (${allProducts.length})` : cat}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Product list */}
                <div className="overflow-y-auto flex-1">
                  {filteredBrowse.length === 0 ? (
                    <div className="py-12 text-center text-sm text-[#7a6a4a]">
                      No products match your filters.
                    </div>
                  ) : (
                    Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)).map(([cat, products]) => (
                      <div key={cat}>
                        {/* Category header — only shown when showing all categories */}
                        {browseCategory === "all" && (
                          <div className="sticky top-0 bg-[#faf8f3] border-b border-[#e8e0d0] px-4 py-2">
                            <span className="text-xs font-semibold text-[#7a6a4a] uppercase tracking-wider">{cat}</span>
                            <span className="ml-2 text-xs text-[#b0a080]">{products.length}</span>
                          </div>
                        )}
                        {products.map(p => {
                          const totalStock = Object.values(p.stocks ?? {}).reduce((sum, v) => sum + v, 0);
                          const sizeCount = Object.keys(p.sizes ?? {}).length;
                          const isSelected = selectedProduct?.id === p.id;
                          return (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => {
                                handleSelectProduct(p);
                                setBrowseOpen(false);
                                setBrowseSearch("");
                                setBrowseCategory("all");
                              }}
                              className={`w-full text-left px-4 py-3 border-b border-[#e8e0d0] last:border-0 transition-colors ${
                                isSelected
                                  ? "bg-[#d4af37]/10"
                                  : "hover:bg-[#faf8f3]"
                              }`}
                            >
                              <div className="flex items-center justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-medium text-[#1c1810] truncate">{p.name}</span>
                                    {isSelected && (
                                      <span className="shrink-0 text-xs bg-[#d4af37] text-[#0a0a0a] px-1.5 py-0.5 rounded font-semibold">
                                        Selected
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                                    {browseCategory === "all" ? null : (
                                      <span className="text-xs text-[#8B6914] bg-[#f2ede4] px-1.5 py-0.5 rounded">
                                        {p.category?.name ?? "Uncategorized"}
                                      </span>
                                    )}
                                    <span className="text-xs text-[#7a6a4a]">
                                      {sizeCount} size{sizeCount !== 1 ? "s" : ""}
                                    </span>
                                    <span className={`text-xs font-medium ${totalStock === 0 ? "text-red-600" : "text-green-700"}`}>
                                      {totalStock} in stock
                                    </span>
                                  </div>
                                </div>
                                {/* Size stock pills */}
                                <div className="shrink-0 flex flex-wrap gap-1 justify-end max-w-[160px]">
                                  {Object.entries(p.stocks ?? {}).map(([size, stock]) => (
                                    <span
                                      key={size}
                                      className={`text-xs px-1.5 py-0.5 rounded border font-mono ${
                                        stock === 0
                                          ? "border-red-200 bg-red-50 text-red-600"
                                          : "border-[#e8e0d0] bg-white text-[#7a6a4a]"
                                      }`}
                                    >
                                      {size}: {stock}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    ))
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-1">
          <div className="w-9 h-9 bg-red-50 border border-red-200 rounded-lg flex items-center justify-center">
            <ArrowUpFromLine className="w-5 h-5 text-red-500" />
          </div>
          <h1 className={`text-xl font-semibold ${themeClasses.accent} tracking-wide`}>Stock Out</h1>
        </div>
        <p className={`text-sm ${themeClasses.textMuted} ml-12`}>Remove units from product inventory.</p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white border border-[#e8e0d0] rounded-lg p-6 space-y-5">

        {/* Product — Searchable Autocomplete */}
        <div>
          <label className="block text-sm font-medium text-[#d4af37] mb-2 uppercase tracking-wide">Product</label>
          <div ref={searchRef} className="relative">
            <div className="relative flex items-center">
              <Search className="absolute left-3 w-4 h-4 text-[#7a6a4a] pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={handleSearchChange}
                onFocus={() => searchQuery && setShowDropdown(true)}
                placeholder="Search product name..."
                className="w-full pl-9 pr-9 py-3 bg-[#faf8f3] border border-[#e8e0d0] rounded-lg text-[#1c1810] placeholder-[#b0a080] focus:outline-none focus:ring-2 focus:ring-[#d4af37]"
              />
              {(searchQuery || isSearching) && (
                <button type="button" onClick={handleClearProduct} className="absolute right-3 text-[#7a6a4a] hover:text-[#1c1810]">
                  {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
                </button>
              )}
            </div>

            {showDropdown && searchResults.length > 0 && (
              <div className="absolute z-20 w-full mt-1 bg-white border border-[#e8e0d0] rounded-lg shadow-lg max-h-52 overflow-y-auto">
                {searchResults.map(p => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleSelectProduct(p)}
                    className="w-full text-left px-4 py-2.5 hover:bg-[#faf8f3] text-[#1c1810] text-sm border-b border-[#e8e0d0] last:border-0"
                  >
                    <span className="font-medium">{p.name}</span>
                    <span className="text-[#7a6a4a] ml-2 text-xs">
                      {Object.entries(p.stocks ?? {}).map(([s, q]) => `${s}: ${q}`).join(' · ')}
                    </span>
                  </button>
                ))}
              </div>
            )}
            {showDropdown && !isSearching && searchQuery && searchResults.length === 0 && (
              <div className="absolute z-20 w-full mt-1 bg-white border border-[#e8e0d0] rounded-lg shadow-lg px-4 py-3 text-sm text-[#7a6a4a]">
                No products found for &quot;{searchQuery}&quot;
              </div>
            )}
          </div>

          {/* Browse button */}
          <button
            type="button"
            onClick={handleToggleBrowse}
            disabled={isLoadingAll}
            className="mt-2 flex items-center gap-1.5 text-xs text-[#8B6914] hover:text-[#d4af37] transition-colors disabled:opacity-60"
          >
            {isLoadingAll
              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : <Package className="w-3.5 h-3.5" />
            }
            {isLoadingAll ? "Loading products…" : "Browse all products"}
            {!isLoadingAll && <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          {selectedProduct && (
            <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1 mt-2">
              Selected: <span className="font-semibold">{selectedProduct.name}</span>
              {selectedProduct.category && (
                <span className="text-red-500 ml-1">· {selectedProduct.category.name}</span>
              )}
            </p>
          )}
        </div>

        {/* Size */}
        <div>
          <label className="block text-sm font-medium text-[#d4af37] mb-2 uppercase tracking-wide">Size</label>
          <select
            value={selectedSize}
            onChange={e => { setSelectedSize(e.target.value); setQuantity(""); }}
            className="w-full p-3 bg-[#faf8f3] border border-[#e8e0d0] rounded-lg text-[#1c1810] focus:outline-none focus:ring-2 focus:ring-[#d4af37] disabled:opacity-50"
            required
            disabled={!selectedProduct}
          >
            <option value="">Select a size...</option>
            {selectedProduct && Object.entries(selectedProduct.sizes ?? {}).map(([size]) => {
              const stock = selectedProduct.stocks?.[size] ?? 0;
              return (
                <option key={size} value={size} disabled={stock === 0}>
                  {size} — {stock} units{stock === 0 ? " (out of stock)" : ""}
                </option>
              );
            })}
          </select>
          {currentSizeStock !== null && (
            <p className="text-xs text-[#7a6a4a] mt-1.5">
              Current stock: <span className="font-semibold text-[#1c1810]">{currentSizeStock} units</span>
            </p>
          )}
        </div>

        {/* Quantity */}
        <div>
          <label className="block text-sm font-medium text-[#d4af37] mb-2 uppercase tracking-wide">Quantity to Remove</label>
          <input
            type="number"
            min="1"
            max={currentSizeStock ?? undefined}
            value={quantity}
            onChange={e => setQuantity(e.target.value)}
            placeholder="Enter quantity"
            className={`w-full p-3 bg-[#faf8f3] border rounded-lg text-[#1c1810] placeholder-[#b0a080] focus:outline-none focus:ring-2 focus:ring-[#d4af37] disabled:opacity-50 ${
              insufficientStock ? "border-red-400 bg-red-50" : "border-[#e8e0d0]"
            }`}
            required
            disabled={!selectedSize}
          />
          {insufficientStock && (
            <p className="text-xs text-red-500 mt-1.5 font-medium">
              Insufficient stock. Maximum available: {currentSizeStock} units.
            </p>
          )}
          {!insufficientStock && selectedSize && currentSizeStock !== null && qtyNum > 0 && (
            <p className="text-xs text-orange-600 mt-1.5 font-medium">
              Remaining stock will be: <span className="font-semibold">{currentSizeStock - qtyNum}</span> units
            </p>
          )}
        </div>

        {/* Reason */}
        <div>
          <label className="block text-sm font-medium text-[#d4af37] mb-2 uppercase tracking-wide">Reason</label>
          <select
            value={reason}
            onChange={e => setReason(e.target.value)}
            className="w-full p-3 bg-[#faf8f3] border border-[#e8e0d0] rounded-lg text-[#1c1810] focus:outline-none focus:ring-2 focus:ring-[#d4af37]"
            required
          >
            <option value="">Select a reason...</option>
            {REASON_OPTIONS.map(r => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>

        {/* Remarks */}
        <div>
          <label className="block text-sm font-medium text-[#d4af37] mb-2 uppercase tracking-wide">
            Remarks <span className="text-[#7a6a4a] font-normal normal-case">(optional)</span>
          </label>
          <textarea
            value={remarks}
            onChange={e => setRemarks(e.target.value)}
            placeholder="e.g. Damaged during shipping, order #1234..."
            rows={2}
            className="w-full p-3 bg-[#faf8f3] border border-[#e8e0d0] rounded-lg text-[#1c1810] placeholder-[#b0a080] focus:outline-none focus:ring-2 focus:ring-[#d4af37] resize-none"
          />
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-1">
          <button
            type="button"
            onClick={handleReset}
            className="px-5 py-2.5 border border-[#e8e0d0] text-[#1c1810] rounded-lg hover:bg-[#faf8f3] transition-colors text-sm font-medium"
          >
            Reset
          </button>
          <button
            type="submit"
            disabled={!isFormValid || isSubmitting}
            className="flex-1 py-2.5 px-4 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
          >
            {isSubmitting
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Processing...</>
              : <><ArrowUpFromLine className="w-4 h-4" /> Remove Stock</>
            }
          </button>
        </div>
      </form>
    </div>
  );
}
