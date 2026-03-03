"use client";
import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  ClipboardList, Filter, ChevronLeft, ChevronRight,
  Loader2, Package, RefreshCw, Download, X,
} from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";

interface StockMovement {
  id: string;
  productId: string;
  productName: string;
  productImage: string | null;
  size: string;
  type: "IN" | "OUT";
  quantity: number;
  previousStock: number;
  newStock: number;
  reason: string | null;
  remarks: string | null;
  createdBy: string | null;
  createdByName: string | null;
  createdAt: string;
}

interface Product {
  id: string;
  name: string;
}

const formatDateTime = (dateString: string) =>
  new Date(dateString).toLocaleString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

function getPageNumbers(currentPage: number, totalPages: number): (number | "...")[] {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
  const pages: (number | "...")[] = [1];
  if (currentPage > 3) pages.push("...");
  const start = Math.max(2, currentPage - 1);
  const end = Math.min(totalPages - 1, currentPage + 1);
  for (let i = start; i <= end; i++) pages.push(i);
  if (currentPage < totalPages - 2) pages.push("...");
  pages.push(totalPages);
  return pages;
}

function toDateInputValue(date: Date): string {
  return date.toISOString().split("T")[0];
}

async function fetchAllProductsForFilter(): Promise<Product[]> {
  const all: Product[] = [];
  let page = 1;
  while (true) {
    const res = await fetch(`/api/admin/products?page=${page}`);
    const result = await res.json();
    if (!result.success) break;
    all.push(...result.data.products.map((p: { id: string; name: string }) => ({ id: p.id, name: p.name })));
    if (page >= result.data.totalPages) break;
    page++;
  }
  return all;
}

function exportToCSV(movements: StockMovement[]) {
  const headers = ["Date/Time", "Product", "Size", "Type", "Qty", "Prev Stock", "New Stock", "Reason", "Remarks", "By"];
  const rows = movements.map(m => [
    formatDateTime(m.createdAt),
    m.productName,
    m.size,
    m.type,
    m.quantity,
    m.previousStock,
    m.newStock,
    m.reason || "",
    m.remarks || "",
    m.createdByName || "",
  ]);
  const csv = [headers, ...rows]
    .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `stock-history-${new Date().toISOString().split("T")[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

const DATE_PRESETS = [
  { label: "Today", getDates: () => { const d = toDateInputValue(new Date()); return { from: d, to: d }; } },
  {
    label: "This Week", getDates: () => {
      const now = new Date();
      const day = now.getDay();
      const mon = new Date(now); mon.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
      return { from: toDateInputValue(mon), to: toDateInputValue(now) };
    }
  },
  {
    label: "This Month", getDates: () => {
      const now = new Date();
      const first = new Date(now.getFullYear(), now.getMonth(), 1);
      return { from: toDateInputValue(first), to: toDateInputValue(now) };
    }
  },
  {
    label: "Last Month", getDates: () => {
      const now = new Date();
      const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const last = new Date(now.getFullYear(), now.getMonth(), 0);
      return { from: toDateInputValue(first), to: toDateInputValue(last) };
    }
  },
];

export default function StockHistoryPage() {
  const { themeClasses } = useTheme();

  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  const [products, setProducts] = useState<Product[]>([]);
  const [filterProduct, setFilterProduct] = useState("");
  const [filterType, setFilterType] = useState<"all" | "IN" | "OUT">("all");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [activePreset, setActivePreset] = useState<string | null>(null);

  const isInitialMount = useRef(true);

  useEffect(() => {
    fetchAllProductsForFilter().then(setProducts).catch(console.error);
  }, []);

  const fetchMovements = useCallback(async (page = 1) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page) });
      if (filterProduct) params.set("productId", filterProduct);
      if (filterType !== "all") params.set("type", filterType);
      if (filterDateFrom) params.set("dateFrom", filterDateFrom);
      if (filterDateTo) params.set("dateTo", filterDateTo);

      const res = await fetch(`/api/admin/stock/history?${params}`);
      const result = await res.json();

      if (result.success) {
        setMovements(result.data.movements);
        setTotalCount(result.data.totalCount);
        setTotalPages(result.data.totalPages);
        setCurrentPage(result.data.currentPage);
      }
    } catch {
      console.error("Failed to fetch history");
    } finally {
      setIsLoading(false);
    }
  }, [filterProduct, filterType, filterDateFrom, filterDateTo]);

  // Auto-fetch when type filter changes; skip first render
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      fetchMovements(1);
      return;
    }
    fetchMovements(1);
  }, [filterType, fetchMovements]);

  const handleApplyFilters = () => fetchMovements(1);

  const handleClearFilters = () => {
    setFilterProduct("");
    setFilterType("all");
    setFilterDateFrom("");
    setFilterDateTo("");
    setActivePreset(null);
  };

  const handlePreset = (preset: typeof DATE_PRESETS[number]) => {
    const { from, to } = preset.getDates();
    setFilterDateFrom(from);
    setFilterDateTo(to);
    setActivePreset(preset.label);
  };

  const handleExportCurrentPage = () => {
    if (movements.length === 0) return;
    exportToCSV(movements);
  };

  const handleExportAll = async () => {
    setIsExporting(true);
    try {
      // Fetch all pages with current filters
      const params = new URLSearchParams();
      if (filterProduct) params.set("productId", filterProduct);
      if (filterType !== "all") params.set("type", filterType);
      if (filterDateFrom) params.set("dateFrom", filterDateFrom);
      if (filterDateTo) params.set("dateTo", filterDateTo);

      const allMovements: StockMovement[] = [];
      let page = 1;
      while (true) {
        params.set("page", String(page));
        const res = await fetch(`/api/admin/stock/history?${params}`);
        const result = await res.json();
        if (!result.success) break;
        allMovements.push(...result.data.movements);
        if (page >= result.data.totalPages) break;
        page++;
      }
      exportToCSV(allMovements);
    } catch {
      console.error("Export failed");
    } finally {
      setIsExporting(false);
    }
  };

  const pageNumbers = getPageNumbers(currentPage, totalPages);
  const hasActiveFilters = filterProduct || filterType !== "all" || filterDateFrom || filterDateTo;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-9 h-9 bg-[#d4af37]/10 border border-[#d4af37]/30 rounded-lg flex items-center justify-center">
              <ClipboardList className="w-5 h-5 text-[#8B6914]" />
            </div>
            <h1 className={`text-xl font-semibold ${themeClasses.accent} tracking-wide`}>Stock History</h1>
          </div>
          <p className={`text-sm ${themeClasses.textMuted} ml-12`}>
            {totalCount > 0 ? `${totalCount} total movement${totalCount !== 1 ? "s" : ""}` : "All stock movements"}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative group">
            <button
              disabled={movements.length === 0 || isExporting}
              className={`flex items-center gap-2 px-3 py-2 border ${themeClasses.border} ${themeClasses.text} ${themeClasses.hoverBg} rounded-lg text-sm transition-colors disabled:opacity-40`}
            >
              {isExporting
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <Download className="w-4 h-4" />
              }
              Export CSV
            </button>
            {/* Dropdown */}
            <div className="absolute right-0 top-full mt-1 w-44 bg-white border border-[#e8e0d0] rounded-lg shadow-lg z-20 hidden group-hover:block">
              <button
                onClick={handleExportCurrentPage}
                className="w-full text-left px-4 py-2.5 text-sm text-[#1c1810] hover:bg-[#faf8f3] transition-colors"
              >
                Export this page
              </button>
              <button
                onClick={handleExportAll}
                disabled={isExporting}
                className="w-full text-left px-4 py-2.5 text-sm text-[#1c1810] hover:bg-[#faf8f3] transition-colors disabled:opacity-50 border-t border-[#e8e0d0]"
              >
                {isExporting ? "Exporting..." : "Export all results"}
              </button>
            </div>
          </div>

          <button
            onClick={() => fetchMovements(currentPage)}
            className={`flex items-center gap-2 px-3 py-2 border ${themeClasses.border} ${themeClasses.text} ${themeClasses.hoverBg} rounded-lg text-sm transition-colors`}
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border border-[#e8e0d0] rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-[#7a6a4a]" />
            <span className="text-sm font-medium text-[#1c1810] uppercase tracking-wide">Filters</span>
            {hasActiveFilters && (
              <span className="px-2 py-0.5 bg-[#d4af37] text-[#0a0a0a] text-xs font-bold rounded-full">Active</span>
            )}
          </div>
          {hasActiveFilters && (
            <button
              onClick={handleClearFilters}
              className="flex items-center gap-1 text-xs text-[#7a6a4a] hover:text-red-500 transition-colors"
            >
              <X className="w-3 h-3" /> Clear all
            </button>
          )}
        </div>

        {/* Date presets */}
        <div className="flex flex-wrap gap-2">
          {DATE_PRESETS.map(preset => (
            <button
              key={preset.label}
              onClick={() => handlePreset(preset)}
              className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${
                activePreset === preset.label
                  ? "bg-[#d4af37] border-[#d4af37] text-[#0a0a0a]"
                  : "border-[#e8e0d0] text-[#7a6a4a] hover:border-[#d4af37] hover:text-[#8B6914]"
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Product filter */}
          <select
            value={filterProduct}
            onChange={e => setFilterProduct(e.target.value)}
            className="p-2.5 bg-[#faf8f3] border border-[#e8e0d0] rounded-lg text-sm text-[#1c1810] focus:outline-none focus:ring-2 focus:ring-[#d4af37]"
          >
            <option value="">All Products</option>
            {products.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>

          {/* Type toggle — auto-applies on click */}
          <div className="flex rounded-lg border border-[#e8e0d0] overflow-hidden h-[42px]">
            {(["all", "IN", "OUT"] as const).map(t => (
              <button
                key={t}
                onClick={() => setFilterType(t)}
                className={`flex-1 text-xs font-semibold uppercase transition-colors ${
                  filterType === t
                    ? "bg-[#d4af37] text-[#0a0a0a]"
                    : "bg-[#faf8f3] text-[#7a6a4a] hover:bg-[#f2ede4]"
                }`}
              >
                {t === "all" ? "All" : t}
              </button>
            ))}
          </div>

          {/* Date from */}
          <div className="relative">
            <input
              type="date"
              value={filterDateFrom}
              onChange={e => { setFilterDateFrom(e.target.value); setActivePreset(null); }}
              className="w-full p-2.5 bg-[#faf8f3] border border-[#e8e0d0] rounded-lg text-sm text-[#1c1810] focus:outline-none focus:ring-2 focus:ring-[#d4af37]"
            />
            {!filterDateFrom && (
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-[#b0a080] pointer-events-none">From date</span>
            )}
          </div>

          {/* Date to */}
          <div className="relative">
            <input
              type="date"
              value={filterDateTo}
              onChange={e => { setFilterDateTo(e.target.value); setActivePreset(null); }}
              className="w-full p-2.5 bg-[#faf8f3] border border-[#e8e0d0] rounded-lg text-sm text-[#1c1810] focus:outline-none focus:ring-2 focus:ring-[#d4af37]"
            />
            {!filterDateTo && (
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-[#b0a080] pointer-events-none">To date</span>
            )}
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleApplyFilters}
            className="px-4 py-2 bg-[#d4af37] text-[#0a0a0a] text-sm font-semibold rounded-lg hover:bg-[#d4af37]/90 transition-colors"
          >
            Apply Filters
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-[#e8e0d0] rounded-lg overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16 gap-3">
            <Loader2 className="w-5 h-5 animate-spin text-[#d4af37]" />
            <span className="text-sm text-[#7a6a4a]">Loading movements...</span>
          </div>
        ) : movements.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
            <Package className="w-12 h-12 text-[#d4af37]/40" />
            <p className="text-[#7a6a4a] font-medium">No stock movements found</p>
            <p className="text-sm text-[#7a6a4a]/70">
              {hasActiveFilters ? "Try adjusting your filters." : "Record a Stock In or Stock Out to get started."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#faf8f3] border-b border-[#e8e0d0]">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-[#7a6a4a] uppercase tracking-wide whitespace-nowrap">Date/Time</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-[#7a6a4a] uppercase tracking-wide">Product</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-[#7a6a4a] uppercase tracking-wide">Size</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-[#7a6a4a] uppercase tracking-wide">Type</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-[#7a6a4a] uppercase tracking-wide">Qty</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-[#7a6a4a] uppercase tracking-wide whitespace-nowrap">Before</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-[#7a6a4a] uppercase tracking-wide whitespace-nowrap">After</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-[#7a6a4a] uppercase tracking-wide">Reason</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-[#7a6a4a] uppercase tracking-wide">Remarks</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-[#7a6a4a] uppercase tracking-wide whitespace-nowrap">By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e8e0d0]">
                {movements.map(m => (
                  <tr key={m.id} className="hover:bg-[#faf8f3]/60 transition-colors">
                    <td className="px-4 py-3 text-[#7a6a4a] whitespace-nowrap text-xs">{formatDateTime(m.createdAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {m.productImage ? (
                          <img src={m.productImage} alt={m.productName} className="w-7 h-7 rounded object-cover border border-[#e8e0d0] flex-shrink-0" />
                        ) : (
                          <div className="w-7 h-7 rounded bg-[#faf8f3] border border-[#e8e0d0] flex items-center justify-center flex-shrink-0">
                            <Package className="w-3.5 h-3.5 text-[#d4af37]" />
                          </div>
                        )}
                        <span className="text-[#1c1810] font-medium truncate max-w-[140px]">{m.productName}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[#1c1810] font-medium whitespace-nowrap">{m.size}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex px-2.5 py-1 text-xs font-bold rounded-full ${
                        m.type === "IN"
                          ? "bg-green-100 text-green-700 border border-green-200"
                          : "bg-red-100 text-red-600 border border-red-200"
                      }`}>
                        {m.type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-[#1c1810]">{m.quantity}</td>
                    <td className="px-4 py-3 text-right text-[#7a6a4a]">{m.previousStock}</td>
                    <td className="px-4 py-3 text-right font-semibold text-[#d4af37]">{m.newStock}</td>
                    <td className="px-4 py-3 text-[#7a6a4a] whitespace-nowrap">{m.reason || "—"}</td>
                    <td className="px-4 py-3 text-[#7a6a4a] max-w-[140px]">
                      <span className="truncate block" title={m.remarks || undefined}>{m.remarks || "—"}</span>
                    </td>
                    <td className="px-4 py-3 text-[#7a6a4a] whitespace-nowrap text-xs">{m.createdByName || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {!isLoading && totalPages > 1 && (
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <p className="text-sm text-[#7a6a4a]">
            Page {currentPage} of {totalPages} · {totalCount} records
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => fetchMovements(currentPage - 1)}
              disabled={currentPage === 1}
              className="p-2 border border-[#e8e0d0] rounded-lg text-[#1c1810] hover:bg-[#faf8f3] disabled:opacity-40 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            {pageNumbers.map((pg, idx) =>
              pg === "..." ? (
                <span key={`ellipsis-${idx}`} className="px-2 text-[#7a6a4a] text-sm select-none">…</span>
              ) : (
                <button
                  key={pg}
                  onClick={() => fetchMovements(pg as number)}
                  className={`min-w-[36px] h-9 px-2 border rounded-lg text-sm font-medium transition-colors ${
                    currentPage === pg
                      ? "bg-[#d4af37] border-[#d4af37] text-[#0a0a0a]"
                      : "border-[#e8e0d0] text-[#1c1810] hover:bg-[#faf8f3]"
                  }`}
                >
                  {pg}
                </button>
              )
            )}
            <button
              onClick={() => fetchMovements(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="p-2 border border-[#e8e0d0] rounded-lg text-[#1c1810] hover:bg-[#faf8f3] disabled:opacity-40 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
