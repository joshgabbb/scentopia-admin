"use client";
import React, { useState, useEffect } from "react";
import { ArrowUpFromLine, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
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

async function fetchAllProducts(): Promise<Product[]> {
  const allProducts: Product[] = [];
  let page = 1;
  while (true) {
    const res = await fetch(`/api/admin/products?page=${page}&status=active`);
    const result = await res.json();
    if (!result.success) break;
    const active = (result.data.products as Product[]).filter(p => p.isActive);
    allProducts.push(...active);
    if (page >= result.data.totalPages) break;
    page++;
  }
  return allProducts;
}

export default function StockOutPage() {
  const { themeClasses } = useTheme();
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);

  const [selectedProductId, setSelectedProductId] = useState("");
  const [selectedSize, setSelectedSize] = useState("");
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");
  const [remarks, setRemarks] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);

  useEffect(() => {
    fetchAllProducts()
      .then(setProducts)
      .catch(() => console.error("Failed to fetch products"))
      .finally(() => setLoadingProducts(false));
  }, []);

  const selectedProduct = products.find(p => p.id === selectedProductId);
  const currentSizeStock = selectedProduct && selectedSize
    ? (selectedProduct.stocks[selectedSize] ?? 0)
    : null;

  const showToast = (type: "success" | "error", message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  const handleReset = () => {
    setSelectedProductId("");
    setSelectedSize("");
    setQuantity("");
    setReason("");
    setRemarks("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const qty = parseInt(quantity);
    if (!selectedProductId || !selectedSize || !qty || qty <= 0 || !reason) return;

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/admin/stock/out", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: selectedProductId,
          size: selectedSize,
          quantity: qty,
          reason,
          remarks: remarks || null,
        }),
      });

      const result = await res.json();

      if (result.success) {
        setProducts(prev =>
          prev.map(p =>
            p.id !== selectedProductId
              ? p
              : { ...p, stocks: { ...p.stocks, [selectedSize]: result.newStock } }
          )
        );
        showToast(
          "success",
          `Removed ${qty} unit${qty !== 1 ? "s" : ""} from ${selectedSize}. New stock: ${result.newStock}.`
        );
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
  const isFormValid = !!(selectedProductId && selectedSize && qtyNum > 0 && reason && !insufficientStock);

  return (
    <div className="max-w-lg space-y-6">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-6 right-6 z-50 flex items-start gap-3 p-4 rounded-lg shadow-lg border max-w-sm ${
            toast.type === "success"
              ? "bg-green-50 border-green-200 text-green-800"
              : "bg-red-50 border-red-200 text-red-800"
          }`}
        >
          {toast.type === "success"
            ? <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-green-600" />
            : <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-red-500" />
          }
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

        {/* Product */}
        <div>
          <label className="block text-sm font-medium text-[#d4af37] mb-2 uppercase tracking-wide">Product</label>
          {loadingProducts ? (
            <div className="flex items-center gap-2 text-[#7a6a4a] text-sm">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading products...
            </div>
          ) : (
            <select
              value={selectedProductId}
              onChange={e => { setSelectedProductId(e.target.value); setSelectedSize(""); setQuantity(""); }}
              className="w-full p-3 bg-[#faf8f3] border border-[#e8e0d0] rounded-lg text-[#1c1810] focus:outline-none focus:ring-2 focus:ring-[#d4af37]"
              required
            >
              <option value="">Select a product...</option>
              {products.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
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
            {selectedProduct && Object.entries(selectedProduct.sizes).map(([size]) => {
              const stock = selectedProduct.stocks[size] ?? 0;
              return (
                <option key={size} value={size} disabled={stock === 0}>
                  {size} — {stock} units{stock === 0 ? " (out of stock)" : ""}
                </option>
              );
            })}
          </select>
          {currentSizeStock !== null && (
            <p className="text-xs text-[#7a6a4a] mt-1.5">
              Current: <span className="font-semibold text-[#1c1810]">{currentSizeStock} units</span>
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
            <p className="text-xs text-[#7a6a4a] mt-1.5">
              New stock will be: <span className="font-semibold text-[#1c1810]">{currentSizeStock - qtyNum}</span> units
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
