"use client";
import React, { useState, useEffect, useRef, useCallback } from "react";
import { ArrowUpFromLine, CheckCircle, AlertCircle, Loader2, Search, X } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";

interface Product {
  id: string;
  name: string;
  sizes: Record<string, number>;
  stocks: Record<string, number>;
  isActive: boolean;
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
  };

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

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
          {selectedProduct && (
            <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1 mt-2">
              Selected: <span className="font-semibold">{selectedProduct.name}</span>
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
