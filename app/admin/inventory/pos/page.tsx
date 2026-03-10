"use client";
import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Search, Plus, Minus, Trash2, ShoppingCart, X,
  Loader2, CheckCircle, AlertCircle, Printer,
  Package, Banknote, CreditCard, Smartphone as SmartphoneIcon,
  Store, ReceiptText, RefreshCw, ShoppingBag,
} from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";

// ─── Types ──────────────────────────────────────────────────────────────────

interface Product {
  id: string;
  name: string;
  sizes: Record<string, number>;
  stocks: Record<string, number>;
  prices?: Record<string, number>;
  price?: number;
  isActive: boolean;
}

interface CartItem {
  key: string;           // productId-size
  productId: string;
  productName: string;
  size: string;
  quantity: number;
  unitPrice: number;
  maxStock: number;
}

interface CompletedTransaction {
  transactionNumber: string;
  items: CartItem[];
  totalAmount: number;
  cashReceived: number;
  changeAmount: number;
  paymentMethod: string;
  createdAt: string;
}

type PaymentMethod = "cash" | "gcash" | "card";

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatPeso(amount: number): string {
  return `₱${amount.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

const PAYMENT_METHODS: {
  value: PaymentMethod;
  label: string;
  icon: React.ReactNode;
}[] = [
  { value: "cash",  label: "Cash",  icon: <Banknote       className="w-4 h-4" /> },
  { value: "gcash", label: "GCash", icon: <SmartphoneIcon className="w-4 h-4" /> },
  { value: "card",  label: "Card",  icon: <CreditCard     className="w-4 h-4" /> },
];

// ─── Receipt Modal ───────────────────────────────────────────────────────────

function buildReceiptHTML(transaction: CompletedTransaction): string {
  const date = new Date(transaction.createdAt).toLocaleDateString("en-PH", {
    year: "numeric", month: "long", day: "numeric",
  });
  const time = new Date(transaction.createdAt).toLocaleTimeString("en-PH", {
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });

  const itemRows = transaction.items.map((item) => `
    <div class="item">
      <div class="item-name">${item.productName} <span class="item-size">(${item.size})</span></div>
      <div class="item-detail">
        <span>${item.quantity} &times; ${formatPeso(item.unitPrice)}</span>
        <span class="item-subtotal">${formatPeso(item.quantity * item.unitPrice)}</span>
      </div>
    </div>`).join("");

  const cashRows = transaction.paymentMethod === "cash" ? `
    <div class="summary-row">
      <span>Cash Received</span>
      <span>${formatPeso(transaction.cashReceived)}</span>
    </div>
    <div class="summary-row change">
      <span>Change</span>
      <span>${formatPeso(transaction.changeAmount)}</span>
    </div>` : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Receipt ${transaction.transactionNumber}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Courier New', Courier, monospace;
      font-size: 12px;
      color: #111;
      background: #fff;
      width: 80mm;
      margin: 0 auto;
      padding: 6mm 4mm;
    }

    /* ── HEADER ── */
    .header { text-align: center; margin-bottom: 10px; }
    .store-name {
      font-size: 20px;
      font-weight: 900;
      letter-spacing: 6px;
      text-transform: uppercase;
      margin-bottom: 2px;
    }
    .store-tagline { font-size: 10px; color: #555; margin-bottom: 1px; }
    .store-address { font-size: 9px; color: #666; margin-bottom: 1px; }
    .store-contact { font-size: 9px; color: #666; }
    .receipt-label {
      font-size: 11px;
      font-weight: bold;
      letter-spacing: 2px;
      text-transform: uppercase;
      margin-top: 6px;
      border: 1px solid #111;
      display: inline-block;
      padding: 2px 10px;
    }

    /* ── DIVIDERS ── */
    .divider-solid  { border-top: 1px solid #111;  margin: 8px 0; }
    .divider-dashed { border-top: 1px dashed #999; margin: 8px 0; }

    /* ── TRANSACTION INFO ── */
    .info-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 3px;
      font-size: 11px;
    }
    .info-label { color: #555; }
    .info-value { font-weight: bold; }

    /* ── ITEMS ── */
    .section-label {
      font-size: 10px;
      font-weight: bold;
      letter-spacing: 1px;
      text-transform: uppercase;
      color: #555;
      margin-bottom: 5px;
    }
    .item { margin-bottom: 6px; }
    .item-name { font-weight: bold; font-size: 11px; }
    .item-size { font-weight: normal; color: #555; }
    .item-detail {
      display: flex;
      justify-content: space-between;
      padding-left: 8px;
      font-size: 11px;
      color: #444;
    }
    .item-subtotal { font-weight: bold; color: #111; }

    /* ── SUMMARY ── */
    .summary-row {
      display: flex;
      justify-content: space-between;
      font-size: 11px;
      margin-bottom: 3px;
      color: #444;
    }
    .summary-total {
      display: flex;
      justify-content: space-between;
      font-size: 15px;
      font-weight: 900;
      margin-bottom: 3px;
    }
    .change { font-weight: bold; color: #111; }

    /* ── FOOTER ── */
    .footer { text-align: center; margin-top: 4px; }
    .footer-main { font-size: 11px; font-weight: bold; margin-bottom: 3px; }
    .footer-sub { font-size: 9px; color: #555; margin-bottom: 2px; }
    .footer-policy {
      font-size: 9px;
      color: #666;
      border-top: 1px dashed #bbb;
      padding-top: 5px;
      margin-top: 5px;
    }

    @page { margin: 0; size: 80mm auto; }
    @media print { body { width: 80mm; } }
  </style>
</head>
<body>

  <!-- HEADER -->
  <div class="header">
    <div class="store-name">Scentopia</div>
    <div class="store-tagline">MBT Perfume Boutique</div>
    <div class="store-address">Antipolo City, Philippines</div>
    <div class="store-contact">scentopia.ph@gmail.com</div>
    <div class="receipt-label">Official Receipt</div>
  </div>

  <div class="divider-solid"></div>

  <!-- TRANSACTION INFO -->
  <div class="info-row">
    <span class="info-label">Transaction #</span>
    <span class="info-value">${transaction.transactionNumber}</span>
  </div>
  <div class="info-row">
    <span class="info-label">Date</span>
    <span class="info-value">${date}</span>
  </div>
  <div class="info-row">
    <span class="info-label">Time</span>
    <span class="info-value">${time}</span>
  </div>
  <div class="info-row">
    <span class="info-label">Payment</span>
    <span class="info-value" style="text-transform:capitalize">${transaction.paymentMethod}</span>
  </div>

  <div class="divider-dashed"></div>

  <!-- ITEMS -->
  <div class="section-label">Items Purchased</div>
  ${itemRows}

  <div class="divider-solid"></div>

  <!-- TOTALS -->
  <div class="summary-total">
    <span>TOTAL</span>
    <span>${formatPeso(transaction.totalAmount)}</span>
  </div>
  ${cashRows}

  <div class="divider-dashed"></div>

  <!-- FOOTER -->
  <div class="footer">
    <div class="footer-main">Thank you for shopping at Scentopia!</div>
    <div class="footer-sub">We hope to see you again soon.</div>
    <div class="footer-policy">
      Items are non-refundable once purchased.<br/>
      For concerns, please visit us in-store<br/>
      or contact us at scentopia.ph@gmail.com
    </div>
  </div>

</body>
</html>`;
}

function ReceiptModal({
  transaction,
  onClose,
  onNewTransaction,
}: {
  transaction: CompletedTransaction;
  onClose: () => void;
  onNewTransaction: () => void;
}) {
  const handlePrint = () => {
    const html = buildReceiptHTML(transaction);
    const win = window.open("", "_blank", "width=420,height=700");
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.focus();
    // Slight delay so the browser fully renders before print dialog opens
    setTimeout(() => {
      win.print();
      win.close();
    }, 300);
  };

  const date = new Date(transaction.createdAt).toLocaleDateString("en-PH", {
    year: "numeric", month: "short", day: "numeric",
  });
  const time = new Date(transaction.createdAt).toLocaleTimeString("en-PH", {
    hour: "2-digit", minute: "2-digit",
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm flex flex-col max-h-[90vh]">

        {/* Modal header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#e8e0d0]">
          <h2 className="font-semibold text-[#1c1810] text-base flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
            Transaction Complete
          </h2>
          <button onClick={onClose} className="text-[#7a6a4a] hover:text-[#1c1810]">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Receipt preview */}
        <div className="overflow-y-auto px-5 py-4 font-mono text-xs text-[#1c1810]">

          {/* ── Receipt Header ── */}
          <div className="text-center mb-3">
            <div className="text-lg font-black tracking-[6px] uppercase">Scentopia</div>
            <div className="text-[10px] text-[#7a6a4a]">MBT Perfume Boutique</div>
            <div className="text-[10px] text-[#7a6a4a]">Antipolo City, Philippines</div>
            <div className="text-[10px] text-[#7a6a4a]">scentopia.ph@gmail.com</div>
            <div className="mt-2 inline-block border border-[#1c1810] px-3 py-0.5 text-[10px] font-bold tracking-widest uppercase">
              Official Receipt
            </div>
          </div>

          <div className="border-t border-[#1c1810] my-2" />

          {/* Transaction info */}
          <div className="space-y-1 mb-2">
            {[
              ["Transaction #", transaction.transactionNumber],
              ["Date", date],
              ["Time", time],
              ["Payment", transaction.paymentMethod],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between">
                <span className="text-[#7a6a4a]">{label}</span>
                <span className="font-bold capitalize">{value}</span>
              </div>
            ))}
          </div>

          <div className="border-t border-dashed border-[#b0a080] my-2" />

          {/* Items */}
          <div className="text-[10px] font-bold uppercase tracking-wider text-[#7a6a4a] mb-2">
            Items Purchased
          </div>
          <div className="space-y-2 mb-2">
            {transaction.items.map((item, i) => (
              <div key={i}>
                <div className="font-bold">
                  {item.productName}{" "}
                  <span className="font-normal text-[#7a6a4a]">({item.size})</span>
                </div>
                <div className="flex justify-between pl-2 text-[#555]">
                  <span>{item.quantity} × {formatPeso(item.unitPrice)}</span>
                  <span className="font-bold text-[#1c1810]">
                    {formatPeso(item.quantity * item.unitPrice)}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="border-t border-[#1c1810] my-2" />

          {/* Totals */}
          <div className="flex justify-between font-black text-sm mb-1">
            <span>TOTAL</span>
            <span>{formatPeso(transaction.totalAmount)}</span>
          </div>
          {transaction.paymentMethod === "cash" && (
            <>
              <div className="flex justify-between text-[#555]">
                <span>Cash Received</span>
                <span>{formatPeso(transaction.cashReceived)}</span>
              </div>
              <div className="flex justify-between font-bold">
                <span>Change</span>
                <span>{formatPeso(transaction.changeAmount)}</span>
              </div>
            </>
          )}

          <div className="border-t border-dashed border-[#b0a080] my-3" />

          {/* ── Receipt Footer ── */}
          <div className="text-center space-y-0.5">
            <div className="font-bold text-[11px]">Thank you for shopping at Scentopia!</div>
            <div className="text-[10px] text-[#7a6a4a]">We hope to see you again soon.</div>
            <div className="border-t border-dashed border-[#d4c9b0] mt-2 pt-2 text-[9px] text-[#888] leading-relaxed">
              Items are non-refundable once purchased.<br />
              For concerns, please visit us in-store or<br />
              contact us at scentopia.ph@gmail.com
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-3 px-5 py-4 border-t border-[#e8e0d0]">
          <button
            onClick={handlePrint}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 border border-[#D4AF37] text-[#8B6914] rounded-lg hover:bg-[#D4AF37]/10 transition-colors text-sm font-medium"
          >
            <Printer className="w-4 h-4" /> Print Receipt
          </button>
          <button
            onClick={onNewTransaction}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-[#D4AF37] hover:bg-[#c9a227] text-[#1c1810] rounded-lg transition-colors text-sm font-semibold"
          >
            <RefreshCw className="w-4 h-4" /> New Sale
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main POS Page ───────────────────────────────────────────────────────────

export default function POSPage() {
  const { themeClasses } = useTheme();

  // Product search state
  const [searchQuery, setSearchQuery]     = useState("");
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [isSearching, setIsSearching]     = useState(false);
  const [showDropdown, setShowDropdown]   = useState(false);
  const searchRef  = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cart state
  const [cart, setCart] = useState<CartItem[]>([]);

  // Payment state
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [cashReceived, setCashReceived]   = useState("");
  const [notes, setNotes]                 = useState("");

  // Transaction state
  const [isCheckingOut, setIsCheckingOut]           = useState(false);
  const [completedTransaction, setCompletedTransaction] =
    useState<CompletedTransaction | null>(null);

  // Toast state
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const showToast = (type: "success" | "error", message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  // ── Search ─────────────────────────────────────────────────────────────────

  const searchProducts = useCallback(async (q: string) => {
    if (!q.trim()) { setSearchResults([]); return; }
    setIsSearching(true);
    try {
      const res = await fetch(
        `/api/admin/products?search=${encodeURIComponent(q)}&status=active&limit=10`
      );
      const result = await res.json();
      if (result.success) {
        setSearchResults(
          (result.data.products as Product[]).filter((p) => p.isActive)
        );
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

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ── Cart operations ────────────────────────────────────────────────────────

  const addToCart = (product: Product, size: string) => {
    const stock = product.stocks?.[size] ?? 0;
    if (stock === 0) {
      showToast("error", `${product.name} (${size}) is out of stock.`);
      return;
    }

    const unitPrice = product.prices?.[size] ?? product.price ?? 0;
    const key = `${product.id}-${size}`;

    setCart((prev) => {
      const existing = prev.find((i) => i.key === key);
      if (existing) {
        if (existing.quantity >= existing.maxStock) {
          showToast("error", `Maximum stock reached for ${product.name} (${size}).`);
          return prev;
        }
        return prev.map((i) =>
          i.key === key ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [
        ...prev,
        {
          key,
          productId: product.id,
          productName: product.name,
          size,
          quantity: 1,
          unitPrice,
          maxStock: stock,
        },
      ];
    });
  };

  const updateQuantity = (key: string, delta: number) => {
    setCart((prev) =>
      prev.map((item) => {
        if (item.key !== key) return item;
        const newQty = item.quantity + delta;
        if (newQty <= 0) return item;
        if (newQty > item.maxStock) {
          showToast("error", `Only ${item.maxStock} units available.`);
          return item;
        }
        return { ...item, quantity: newQty };
      })
    );
  };

  const updatePrice = (key: string, value: string) => {
    const p = parseFloat(value) || 0;
    setCart((prev) =>
      prev.map((item) => (item.key === key ? { ...item, unitPrice: p } : item))
    );
  };

  const removeFromCart = (key: string) => {
    setCart((prev) => prev.filter((item) => item.key !== key));
  };

  const clearCart = () => {
    setCart([]);
    setCashReceived("");
    setNotes("");
    setPaymentMethod("cash");
  };

  // ── Derived values ─────────────────────────────────────────────────────────

  const total           = cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const cashReceivedNum = parseFloat(cashReceived) || 0;
  const change          = cashReceivedNum - total;

  const canCheckout =
    cart.length > 0 &&
    !isCheckingOut &&
    (paymentMethod !== "cash" || (cashReceived !== "" && cashReceivedNum >= total));

  // ── Checkout ───────────────────────────────────────────────────────────────

  const handleCheckout = async () => {
    if (!canCheckout) return;

    setIsCheckingOut(true);
    try {
      const res = await fetch("/api/admin/pos/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: cart.map(({ key: _k, maxStock: _m, ...item }) => item),
          paymentMethod,
          cashReceived: paymentMethod === "cash" ? cashReceivedNum : total,
          notes: notes || null,
        }),
      });

      const result = await res.json();

      if (result.success) {
        setCompletedTransaction({
          transactionNumber: result.transaction.transactionNumber,
          items: [...cart],
          totalAmount:    result.transaction.totalAmount,
          cashReceived:   result.transaction.cashReceived,
          changeAmount:   result.transaction.changeAmount,
          paymentMethod:  result.transaction.paymentMethod,
          createdAt:      result.transaction.createdAt,
        });
        clearCart();
        setSearchQuery("");
        setSearchResults([]);
        setShowDropdown(false);
      } else {
        showToast("error", result.error || "Transaction failed. Please try again.");
      }
    } catch {
      showToast("error", "Network error. Please try again.");
    } finally {
      setIsCheckingOut(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col">
      {/* Toast notification */}
      {toast && (
        <div
          className={`fixed top-6 right-6 z-50 flex items-start gap-3 p-4 rounded-lg shadow-lg border max-w-sm ${
            toast.type === "success"
              ? "bg-green-50 border-green-200 text-green-800"
              : "bg-red-50 border-red-200 text-red-800"
          }`}
        >
          {toast.type === "success" ? (
            <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-green-600" />
          ) : (
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-red-500" />
          )}
          <p className="text-sm font-medium">{toast.message}</p>
        </div>
      )}

      {/* Receipt modal */}
      {completedTransaction && (
        <ReceiptModal
          transaction={completedTransaction}
          onClose={() => setCompletedTransaction(null)}
          onNewTransaction={() => setCompletedTransaction(null)}
        />
      )}

      {/* Page header */}
      <div className="mb-5 flex-shrink-0">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-9 h-9 bg-[#D4AF37]/10 border border-[#D4AF37]/30 rounded-lg flex items-center justify-center">
            <Store className="w-5 h-5 text-[#D4AF37]" />
          </div>
          <h1 className={`text-xl font-semibold ${themeClasses.accent} tracking-wide`}>
            POS / Physical Store Sales
          </h1>
        </div>
        <p className={`text-sm ${themeClasses.textMuted} ml-12`}>
          Process in-store purchases and generate receipts for walk-in customers.
        </p>
      </div>

      {/* Two-panel POS layout */}
      <div className="flex gap-4" style={{ height: "calc(100vh - 200px)" }}>

        {/* ─── LEFT PANEL: Product Search ────────────────────────────────── */}
        <div className="flex-1 flex flex-col bg-white border border-[#e8e0d0] rounded-lg overflow-hidden">

          {/* Search bar */}
          <div className="p-4 border-b border-[#e8e0d0] flex-shrink-0">
            <div className="text-xs font-semibold text-[#D4AF37] uppercase tracking-wide mb-3 flex items-center gap-2">
              <Package className="w-3.5 h-3.5" /> Products
            </div>
            <div ref={searchRef} className="relative">
              <div className="relative flex items-center">
                <Search className="absolute left-3 w-4 h-4 text-[#7a6a4a] pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={handleSearchChange}
                  onFocus={() => searchQuery && setShowDropdown(true)}
                  placeholder="Search product name to add to cart..."
                  className="w-full pl-9 pr-9 py-2.5 bg-[#faf8f3] border border-[#e8e0d0] rounded-lg text-[#1c1810] placeholder-[#b0a080] focus:outline-none focus:ring-2 focus:ring-[#d4af37] text-sm"
                />
                {(searchQuery || isSearching) && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery("");
                      setSearchResults([]);
                      setShowDropdown(false);
                    }}
                    className="absolute right-3 text-[#7a6a4a] hover:text-[#1c1810]"
                  >
                    {isSearching ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <X className="w-4 h-4" />
                    )}
                  </button>
                )}
              </div>

              {showDropdown && searchQuery && !isSearching && searchResults.length === 0 && (
                <div className="absolute z-20 w-full mt-1 bg-white border border-[#e8e0d0] rounded-lg shadow-lg px-4 py-3 text-sm text-[#7a6a4a]">
                  No products found for &quot;{searchQuery}&quot;
                </div>
              )}
            </div>
          </div>

          {/* Product cards */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {isSearching && (
              <div className="flex items-center justify-center py-12 text-[#7a6a4a]">
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
                Searching products...
              </div>
            )}

            {!isSearching && !searchQuery && (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Package className="w-14 h-14 text-[#e8e0d0] mb-3" />
                <p className="text-sm font-medium text-[#7a6a4a]">Search for a product</p>
                <p className="text-xs text-[#b0a080] mt-1">
                  Type the product name in the search bar above
                </p>
              </div>
            )}

            {!isSearching &&
              searchResults.map((product) => (
                <div
                  key={product.id}
                  className="bg-[#faf8f3] border border-[#e8e0d0] rounded-lg p-4"
                >
                  <div className="font-semibold text-[#1c1810] text-sm mb-3">
                    {product.name}
                  </div>

                  {/* Size/stock buttons */}
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(product.sizes ?? {}).map(([size]) => {
                      const stock   = product.stocks?.[size] ?? 0;
                      const price   = product.prices?.[size] ?? product.price;
                      const inCart  = cart.find((i) => i.key === `${product.id}-${size}`)?.quantity ?? 0;
                      const available = stock - inCart;

                      return (
                        <button
                          key={size}
                          onClick={() => addToCart(product, size)}
                          disabled={available <= 0}
                          className={`flex flex-col items-start p-2.5 rounded-lg border text-left transition-all text-xs ${
                            available > 0
                              ? "border-[#D4AF37]/40 hover:bg-[#D4AF37]/10 hover:border-[#D4AF37] cursor-pointer"
                              : "border-[#e8e0d0] opacity-50 cursor-not-allowed bg-white"
                          }`}
                        >
                          <div className="font-bold text-[#1c1810]">{size}</div>
                          <div className="text-[#7a6a4a]">
                            Stock: {available}{available === 0 ? " (out)" : ""}
                          </div>
                          {price !== undefined && (
                            <div className="text-[#8B6914] font-semibold mt-0.5">
                              {formatPeso(price)}
                            </div>
                          )}
                          <div
                            className={`flex items-center gap-1 mt-1.5 font-medium ${
                              available > 0 ? "text-[#D4AF37]" : "text-[#b0a080]"
                            }`}
                          >
                            <Plus className="w-3 h-3" />
                            {inCart > 0 ? `Add more (${inCart} in cart)` : "Add to Cart"}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
          </div>
        </div>

        {/* ─── RIGHT PANEL: Cart & Payment ───────────────────────────────── */}
        <div className="w-80 flex flex-col bg-white border border-[#e8e0d0] rounded-lg overflow-hidden flex-shrink-0" style={{ minHeight: 0 }}>

          {/* Cart header */}
          <div className="p-4 border-b border-[#e8e0d0] flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-2">
              <ShoppingCart className="w-4 h-4 text-[#D4AF37]" />
              <span className="text-xs font-semibold text-[#D4AF37] uppercase tracking-wide">
                Cart
              </span>
              {cart.length > 0 && (
                <span className="bg-[#D4AF37] text-[#1c1810] text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                  {cart.length}
                </span>
              )}
            </div>
            {cart.length > 0 && (
              <button
                onClick={clearCart}
                className="text-xs text-red-500 hover:text-red-700 font-medium"
              >
                Clear All
              </button>
            )}
          </div>

          {/* Cart items */}
          <div className="flex-1 overflow-y-auto min-h-0">
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full py-8 text-center px-4">
                <ShoppingBag className="w-10 h-10 text-[#e8e0d0] mb-2" />
                <p className="text-sm font-medium text-[#7a6a4a]">Cart is empty</p>
                <p className="text-xs text-[#b0a080] mt-1">
                  Add products from the left panel
                </p>
              </div>
            ) : (
              <div className="divide-y divide-[#e8e0d0]">
                {cart.map((item) => (
                  <div key={item.key} className="p-3">
                    {/* Item header */}
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-[#1c1810] leading-tight truncate">
                          {item.productName}
                        </div>
                        <div className="text-xs text-[#7a6a4a]">{item.size}</div>
                      </div>
                      <button
                        onClick={() => removeFromCart(item.key)}
                        className="text-red-400 hover:text-red-600 flex-shrink-0 mt-0.5"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Price input */}
                    <div className="flex items-center gap-1.5 mb-2">
                      <span className="text-xs text-[#7a6a4a]">₱</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.unitPrice || ""}
                        onChange={(e) => updatePrice(item.key, e.target.value)}
                        placeholder="0.00"
                        className="w-24 px-2 py-1 bg-[#faf8f3] border border-[#e8e0d0] rounded text-xs text-[#1c1810] focus:outline-none focus:ring-1 focus:ring-[#d4af37]"
                      />
                      <span className="text-xs text-[#7a6a4a]">/ unit</span>
                    </div>

                    {/* Quantity + subtotal */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => {
                            if (item.quantity === 1) removeFromCart(item.key);
                            else updateQuantity(item.key, -1);
                          }}
                          className="w-6 h-6 rounded border border-[#e8e0d0] flex items-center justify-center hover:bg-[#faf8f3] text-[#7a6a4a]"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="w-8 text-center text-sm font-semibold text-[#1c1810]">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => updateQuantity(item.key, 1)}
                          disabled={item.quantity >= item.maxStock}
                          className="w-6 h-6 rounded border border-[#e8e0d0] flex items-center justify-center hover:bg-[#faf8f3] text-[#7a6a4a] disabled:opacity-40"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                      <div className="text-sm font-semibold text-[#8B6914]">
                        {formatPeso(item.unitPrice * item.quantity)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Payment section */}
          <div className="border-t border-[#e8e0d0] p-4 space-y-3 flex-shrink-0">

            {/* Order total */}
            <div className="flex justify-between items-center">
              <span className="text-sm font-semibold text-[#1c1810]">Order Total</span>
              <span className="text-xl font-bold text-[#8B6914]">{formatPeso(total)}</span>
            </div>

            {/* Payment method selector */}
            <div>
              <div className="text-xs text-[#7a6a4a] mb-1.5 font-medium">Payment Method</div>
              <div className="grid grid-cols-3 gap-1.5">
                {PAYMENT_METHODS.map((pm) => (
                  <button
                    key={pm.value}
                    onClick={() => {
                      setPaymentMethod(pm.value);
                      setCashReceived("");
                    }}
                    className={`flex flex-col items-center gap-1 py-2 rounded-lg border text-xs font-medium transition-all ${
                      paymentMethod === pm.value
                        ? "border-[#D4AF37] bg-[#D4AF37]/10 text-[#8B6914]"
                        : "border-[#e8e0d0] text-[#7a6a4a] hover:bg-[#faf8f3]"
                    }`}
                  >
                    {pm.icon}
                    {pm.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Cash received input (cash only) */}
            {paymentMethod === "cash" && (
              <div>
                <label className="text-xs text-[#7a6a4a] mb-1.5 block font-medium">
                  Cash Received
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#7a6a4a] text-sm font-medium">
                    ₱
                  </span>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={cashReceived}
                    onChange={(e) => setCashReceived(e.target.value)}
                    placeholder={total.toFixed(2)}
                    className={`w-full pl-7 pr-3 py-2 bg-[#faf8f3] border rounded-lg text-[#1c1810] text-sm focus:outline-none focus:ring-2 focus:ring-[#d4af37] ${
                      cashReceived && cashReceivedNum < total
                        ? "border-red-400"
                        : "border-[#e8e0d0]"
                    }`}
                  />
                </div>
                {cashReceived && (
                  <div
                    className={`text-xs mt-1 font-semibold ${
                      change >= 0 ? "text-green-600" : "text-red-500"
                    }`}
                  >
                    {change >= 0
                      ? `Change: ${formatPeso(change)}`
                      : `Short by: ${formatPeso(Math.abs(change))}`}
                  </div>
                )}
              </div>
            )}

            {/* Optional notes */}
            <div>
              <label className="text-xs text-[#7a6a4a] mb-1.5 block font-medium">
                Notes{" "}
                <span className="font-normal">(optional)</span>
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Customer name, promo..."
                className="w-full px-3 py-2 bg-[#faf8f3] border border-[#e8e0d0] rounded-lg text-[#1c1810] text-xs focus:outline-none focus:ring-2 focus:ring-[#d4af37]"
              />
            </div>

            {/* Checkout button */}
            <button
              onClick={handleCheckout}
              disabled={!canCheckout}
              className="w-full py-3 bg-[#D4AF37] hover:bg-[#c9a227] text-[#1c1810] font-bold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm"
            >
              {isCheckingOut ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <ReceiptText className="w-4 h-4" />
                  Checkout {cart.length > 0 ? formatPeso(total) : ""}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
