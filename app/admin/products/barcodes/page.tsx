"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Barcode,
  Plus,
  Trash2,
  RefreshCw,
  Printer,
  History,
  Package,
  TrendingUp,
  Search,
  ChevronLeft,
  ChevronRight,
  X,
  CheckCircle,
  Clock,
  Wifi,
  WifiOff,
} from "lucide-react";
import { generateEAN13SVG } from "@/lib/barcode";
import { createClient } from "@/lib/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

/* ─── Types ─────────────────────────────────────────────────── */
interface Product {
  id: string;
  name: string;
  price: number;
  stocks: Record<string, number>;
}

interface BarcodeRecord {
  id: string;
  product_id: string;
  size: string;
  barcode_value: string;
  is_active: boolean;
  created_at: string;
  products: Product | null;
}

interface ScanRecord {
  id: string;
  product_id: string;
  size: string;
  scan_type: string;
  quantity: number;
  scanned_at: string;
  product_name: string;
  notes: string | null;
}

type Tab = "barcodes" | "history";

/* ─── Component ──────────────────────────────────────────────── */
export default function BarcodesPage() {
  const [tab, setTab] = useState<Tab>("barcodes");

  /* Barcodes tab state */
  const [barcodes, setBarcodes] = useState<BarcodeRecord[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedBarcode, setSelectedBarcode] = useState<BarcodeRecord | null>(null);

  /* Generate modal state */
  const [showGenerate, setShowGenerate] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [genProductId, setGenProductId] = useState("");
  const [genSize, setGenSize] = useState("");
  const [generating, setGenerating] = useState(false);
  const [genResult, setGenResult] = useState<string | null>(null);
  const [genError, setGenError] = useState<string | null>(null);

  /* Scan history tab state */
  const [scans, setScans] = useState<ScanRecord[]>([]);
  const [scanPage, setScanPage] = useState(1);
  const [scanTotalPages, setScanTotalPages] = useState(1);
  const [scanTotalCount, setScanTotalCount] = useState(0);
  const [scanFilter, setScanFilter] = useState("");

  /* Real-time state */
  const [isLive, setIsLive] = useState(false);
  const [liveToast, setLiveToast] = useState<string | null>(null);
  const liveToastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [scansLoading, setScansLoading] = useState(false);

  /* Print ref */
  const printRef = useRef<HTMLDivElement>(null);

  /* ── Fetch barcodes ───────────────────────────────────────── */
  const fetchBarcodes = useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/barcodes?page=${p}`);
      const json = await res.json();
      if (json.success) {
        setBarcodes(json.data.barcodes);
        setTotalCount(json.data.totalCount);
        setTotalPages(json.data.totalPages);
        setPage(p);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  /* ── Fetch scan history ───────────────────────────────────── */
  const fetchScans = useCallback(async (p = 1, type = "") => {
    setScansLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p) });
      if (type) params.set("scan_type", type);
      const res = await fetch(`/api/admin/barcodes/scans?${params}`);
      const json = await res.json();
      if (json.success) {
        setScans(json.data.scans);
        setScanTotalCount(json.data.totalCount);
        setScanTotalPages(json.data.totalPages);
        setScanPage(p);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setScansLoading(false);
    }
  }, []);

  /* ── Fetch products (for generate dropdown) ─────────────── */
  const fetchProducts = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/products");
      const json = await res.json();
      if (json.success) setProducts(json.data.products ?? []);
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    fetchBarcodes(1);
  }, [fetchBarcodes]);

  useEffect(() => {
    if (tab === "history") fetchScans(1, scanFilter);
  }, [tab, fetchScans, scanFilter]);

  /* ── Real-time: listen for mobile scans & stock updates ─── */
  useEffect(() => {
    const supabase = createClient();
    let channel: RealtimeChannel;

    const showToast = (msg: string) => {
      setLiveToast(msg);
      if (liveToastTimer.current) clearTimeout(liveToastTimer.current);
      liveToastTimer.current = setTimeout(() => setLiveToast(null), 4000);
    };

    channel = supabase
      .channel("barcode-live-updates")
      // New scan from mobile → refresh scan list + stock counts
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "barcode_scans" },
        (payload) => {
          const scan = payload.new as ScanRecord;
          const label = scan.scan_type === "stock_in" ? "Stock In" : "Sale";
          showToast(`📱 Mobile scan: ${scan.product_name} (${scan.size}ml) — ${label} +${scan.quantity}`);
          // Prepend new scan to history list
          setScans((prev) => [scan, ...prev.slice(0, 29)]);
          setScanTotalCount((prev) => prev + 1);
          // Refresh barcodes list to reflect updated stock counts
          fetchBarcodes(page);
        }
      )
      // Product stock updated → refresh barcodes to show new count
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "products" },
        () => {
          fetchBarcodes(page);
        }
      )
      // New barcode generated from another session
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "product_barcodes" },
        () => {
          fetchBarcodes(1);
        }
      )
      .subscribe((status) => {
        setIsLive(status === "SUBSCRIBED");
      });

    return () => {
      supabase.removeChannel(channel);
      if (liveToastTimer.current) clearTimeout(liveToastTimer.current);
    };
  }, [fetchBarcodes, page]);

  /* ── Generate barcode ────────────────────────────────────── */
  const handleGenerate = async () => {
    if (!genProductId || !genSize.trim()) {
      setGenError("Please select a product and enter a size.");
      return;
    }
    setGenerating(true);
    setGenError(null);
    setGenResult(null);
    try {
      const res = await fetch("/api/admin/barcodes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product_id: genProductId, size: genSize.trim() }),
      });
      const json = await res.json();
      if (json.success) {
        setGenResult(json.data?.barcode_value ?? "Generated");
        fetchBarcodes(1); // refresh list
      } else {
        setGenError(json.error ?? "Failed to generate barcode.");
      }
    } catch (e) {
      setGenError("Network error. Please try again.");
    } finally {
      setGenerating(false);
    }
  };

  /* ── Deactivate barcode ──────────────────────────────────── */
  const handleDelete = async (id: string) => {
    if (!confirm("Deactivate this barcode? The mobile scanner will no longer recognise it.")) return;
    try {
      await fetch(`/api/admin/barcodes?id=${id}`, { method: "DELETE" });
      fetchBarcodes(page);
      if (selectedBarcode?.id === id) setSelectedBarcode(null);
    } catch (e) {
      console.error(e);
    }
  };

  /* ── Print selected barcode ──────────────────────────────── */
  const handlePrint = () => {
    if (!selectedBarcode) return;
    const svg = generateEAN13SVG(selectedBarcode.barcode_value, { moduleWidth: 3, height: 100, fontSize: 13 });
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`
      <!DOCTYPE html><html><head>
        <title>Barcode – ${selectedBarcode.products?.name ?? ""} ${selectedBarcode.size}ml</title>
        <style>
          body { margin: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; font-family: sans-serif; }
          .label { font-size: 14px; margin-top: 8px; color: #333; }
          @media print { button { display: none; } }
        </style>
      </head><body>
        ${svg}
        <div class="label">${selectedBarcode.products?.name ?? ""} &mdash; ${selectedBarcode.size}ml</div>
        <button onclick="window.print()" style="margin-top:16px;padding:8px 20px;cursor:pointer;">Print</button>
      </body></html>
    `);
    win.document.close();
  };

  /* ── Filtered barcodes (client-side search) ──────────────── */
  const filtered = search
    ? barcodes.filter(
        (b) =>
          b.products?.name.toLowerCase().includes(search.toLowerCase()) ||
          b.barcode_value.includes(search) ||
          b.size.includes(search)
      )
    : barcodes;

  /* ── Sizes available for selected generate product ───────── */
  const selectedProduct = products.find((p) => p.id === genProductId);
  const availableSizes = selectedProduct
    ? Object.keys(selectedProduct.stocks ?? {})
    : [];

  /* ─── Render ─────────────────────────────────────────────── */
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-[#d4af37] tracking-widest uppercase">
            Barcode Management
          </h1>
          <p className="text-sm text-[#7a6a4a] dark:text-[#9a8a68] mt-1 flex items-center gap-2">
            Generate &amp; print EAN-13 barcodes. Scan on mobile to update stock instantly.
            <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${isLive ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400" : "bg-[#f2ede4] text-[#7a6a4a] dark:bg-[#26231a] dark:text-[#9a8a68]"}`}>
              {isLive ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
              {isLive ? "Live" : "Connecting…"}
            </span>
          </p>
        </div>
        <button
          onClick={() => {
            fetchProducts();
            setShowGenerate(true);
            setGenResult(null);
            setGenError(null);
            setGenProductId("");
            setGenSize("");
          }}
          className="flex items-center gap-2 px-4 py-2.5 bg-[#d4af37] text-white font-medium hover:bg-[#c09b2a] transition-colors rounded"
        >
          <Plus className="w-4 h-4" />
          Generate Barcode
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <StatCard icon={<Barcode className="w-5 h-5" />} label="Active Barcodes" value={totalCount} />
        <StatCard icon={<TrendingUp className="w-5 h-5" />} label="Scan History" value={scanTotalCount || "—"} />
        <StatCard icon={<Package className="w-5 h-5" />} label="Products Covered" value={new Set(barcodes.map((b) => b.product_id)).size} />
      </div>

      {/* Tabs */}
      <div className="border-b border-[#e8e0d0] dark:border-[#2e2a1e] flex gap-6">
        <TabBtn active={tab === "barcodes"} onClick={() => setTab("barcodes")}>
          <Barcode className="w-4 h-4" /> Barcodes
        </TabBtn>
        <TabBtn active={tab === "history"} onClick={() => { setTab("history"); fetchScans(1, scanFilter); }}>
          <History className="w-4 h-4" /> Scan History
        </TabBtn>
      </div>

      {/* ── BARCODES TAB ──────────────────────────────────────── */}
      {tab === "barcodes" && (
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Left: list */}
          <div className="flex-1 space-y-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#7a6a4a] dark:text-[#9a8a68]" />
              <input
                type="text"
                placeholder="Search product name, size or barcode…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-[#e8e0d0] dark:border-[#2e2a1e] rounded text-sm bg-white dark:bg-[#26231a] text-[#1c1810] dark:text-[#f0e8d8] placeholder-[#7a6a4a] dark:placeholder-[#9a8a68] focus:outline-none focus:ring-2 focus:ring-[#d4af37]"
              />
            </div>

            {/* Refresh */}
            <div className="flex justify-end">
              <button
                onClick={() => fetchBarcodes(page)}
                className="flex items-center gap-1.5 text-sm text-[#7a6a4a] dark:text-[#9a8a68] hover:text-[#d4af37] transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Refresh
              </button>
            </div>

            {/* Table */}
            <div className="border border-[#e8e0d0] dark:border-[#2e2a1e] rounded overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-[#faf8f3] dark:bg-[#26231a] text-[#7a6a4a] dark:text-[#9a8a68] uppercase text-xs">
                  <tr>
                    <th className="px-4 py-3 text-left">Product</th>
                    <th className="px-4 py-3 text-left">Size</th>
                    <th className="px-4 py-3 text-left">Barcode</th>
                    <th className="px-4 py-3 text-left">Stock</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e8e0d0] dark:divide-[#2e2a1e]">
                  {loading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i}>
                        {Array.from({ length: 5 }).map((__, j) => (
                          <td key={j} className="px-4 py-3">
                            <div className="h-4 bg-[#f2ede4] dark:bg-[#26231a] rounded animate-pulse" />
                          </td>
                        ))}
                      </tr>
                    ))
                  ) : filtered.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-12 text-center text-[#7a6a4a] dark:text-[#9a8a68]">
                        No barcodes found. Generate one to get started.
                      </td>
                    </tr>
                  ) : (
                    filtered.map((bc) => {
                      const stock = bc.products?.stocks?.[bc.size] ?? 0;
                      const isSelected = selectedBarcode?.id === bc.id;
                      return (
                        <tr
                          key={bc.id}
                          onClick={() => setSelectedBarcode(isSelected ? null : bc)}
                          className={`cursor-pointer transition-colors ${
                            isSelected
                              ? "bg-[#d4af37]/10"
                              : "hover:bg-[#faf8f3] dark:hover:bg-[#26231a]/50"
                          }`}
                        >
                          <td className="px-4 py-3 font-medium text-[#1c1810] dark:text-[#f0e8d8] max-w-[180px] truncate">
                            {bc.products?.name ?? "—"}
                          </td>
                          <td className="px-4 py-3 text-[#7a6a4a] dark:text-[#9a8a68]">{bc.size}ml</td>
                          <td className="px-4 py-3 font-mono text-xs text-[#7a6a4a] dark:text-[#9a8a68]">
                            {bc.barcode_value}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                stock === 0
                                  ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400"
                                  : stock < 5
                                  ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400"
                                  : "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400"
                              }`}
                            >
                              {stock}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedBarcode(bc);
                                  setTimeout(handlePrint, 50);
                                }}
                                title="Print barcode"
                                className="p-1.5 text-[#7a6a4a] dark:text-[#9a8a68] hover:text-[#d4af37] transition-colors"
                              >
                                <Printer className="w-4 h-4" />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDelete(bc.id);
                                }}
                                title="Deactivate barcode"
                                className="p-1.5 text-[#7a6a4a] dark:text-[#9a8a68] hover:text-red-500 transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between text-sm text-[#7a6a4a] dark:text-[#9a8a68]">
                <span>{totalCount} barcodes</span>
                <div className="flex gap-2">
                  <button
                    disabled={page <= 1}
                    onClick={() => fetchBarcodes(page - 1)}
                    className="p-1.5 border border-[#e8e0d0] dark:border-[#2e2a1e] rounded hover:bg-[#faf8f3] dark:hover:bg-[#26231a] disabled:opacity-40"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="px-3 py-1 border border-[#e8e0d0] dark:border-[#2e2a1e] rounded text-[#1c1810] dark:text-[#f0e8d8]">
                    {page} / {totalPages}
                  </span>
                  <button
                    disabled={page >= totalPages}
                    onClick={() => fetchBarcodes(page + 1)}
                    className="p-1.5 border border-[#e8e0d0] dark:border-[#2e2a1e] rounded hover:bg-[#faf8f3] dark:hover:bg-[#26231a] disabled:opacity-40"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Right: barcode preview */}
          <div className="w-full lg:w-72 xl:w-80 shrink-0">
            {selectedBarcode ? (
              <div className="border border-[#e8e0d0] dark:border-[#2e2a1e] rounded p-6 space-y-4 sticky top-6 bg-white dark:bg-[#1c1a14]">
                <div className="flex items-start justify-between">
                  <h3 className="text-sm font-semibold text-[#1c1810] dark:text-[#f0e8d8] uppercase tracking-wide">
                    Barcode Preview
                  </h3>
                  <button onClick={() => setSelectedBarcode(null)} className="text-[#7a6a4a] dark:text-[#9a8a68] hover:text-[#1c1810] dark:hover:text-[#f0e8d8]">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* SVG barcode — always white bg so bars are visible */}
                <div
                  className="bg-white border border-[#e8e0d0] dark:border-[#2e2a1e] rounded p-4 flex justify-center"
                  dangerouslySetInnerHTML={{
                    __html: generateEAN13SVG(selectedBarcode.barcode_value, {
                      moduleWidth: 2,
                      height: 70,
                      fontSize: 11,
                    }),
                  }}
                />

                <div className="space-y-2 text-sm">
                  <InfoRow label="Product" value={selectedBarcode.products?.name ?? "—"} />
                  <InfoRow label="Size" value={`${selectedBarcode.size}ml`} />
                  <InfoRow label="Barcode" value={selectedBarcode.barcode_value} mono />
                  <InfoRow
                    label="Current Stock"
                    value={String(selectedBarcode.products?.stocks?.[selectedBarcode.size] ?? 0)}
                  />
                  <InfoRow
                    label="Generated"
                    value={new Date(selectedBarcode.created_at).toLocaleDateString()}
                  />
                </div>

                <button
                  onClick={handlePrint}
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-[#d4af37] text-white rounded font-medium hover:bg-[#c09b2a] transition-colors text-sm"
                >
                  <Printer className="w-4 h-4" /> Print Barcode
                </button>

                <p className="text-xs text-[#7a6a4a] dark:text-[#9a8a68] text-center leading-relaxed">
                  Scan this barcode with the Scentopia mobile app to update stock automatically.
                </p>
              </div>
            ) : (
              <div className="border border-dashed border-[#e8e0d0] dark:border-[#2e2a1e] rounded p-10 flex flex-col items-center justify-center text-[#7a6a4a] dark:text-[#9a8a68] text-center gap-3 h-64">
                <Barcode className="w-10 h-10 opacity-30" />
                <p className="text-sm">Click a barcode row to preview and print</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── SCAN HISTORY TAB ─────────────────────────────────── */}
      {tab === "history" && (
        <div className="space-y-4">
          {/* Filter */}
          <div className="flex gap-3">
            {(["", "stock_in", "sale"] as const).map((f) => (
              <button
                key={f}
                onClick={() => { setScanFilter(f); fetchScans(1, f); }}
                className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                  scanFilter === f
                    ? "bg-[#d4af37] text-white"
                    : "border border-[#e8e0d0] dark:border-[#2e2a1e] text-[#7a6a4a] dark:text-[#9a8a68] hover:bg-[#faf8f3] dark:hover:bg-[#26231a]"
                }`}
              >
                {f === "" ? "All" : f === "stock_in" ? "Stock In" : "Sales"}
              </button>
            ))}
            <button
              onClick={() => fetchScans(scanPage, scanFilter)}
              className="ml-auto flex items-center gap-1.5 text-sm text-[#7a6a4a] dark:text-[#9a8a68] hover:text-[#d4af37] transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </button>
          </div>

          {/* Table */}
          <div className="border border-[#e8e0d0] dark:border-[#2e2a1e] rounded overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-[#faf8f3] dark:bg-[#26231a] text-[#7a6a4a] dark:text-[#9a8a68] uppercase text-xs">
                <tr>
                  <th className="px-4 py-3 text-left">Product</th>
                  <th className="px-4 py-3 text-left">Size</th>
                  <th className="px-4 py-3 text-left">Type</th>
                  <th className="px-4 py-3 text-left">Qty</th>
                  <th className="px-4 py-3 text-left">When</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e8e0d0] dark:divide-[#2e2a1e]">
                {scansLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}>
                      {Array.from({ length: 5 }).map((__, j) => (
                        <td key={j} className="px-4 py-3">
                          <div className="h-4 bg-[#f2ede4] dark:bg-[#26231a] rounded animate-pulse" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : scans.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center text-[#7a6a4a] dark:text-[#9a8a68]">
                      No scan history yet. Scans from the mobile app will appear here.
                    </td>
                  </tr>
                ) : (
                  scans.map((scan) => (
                    <tr key={scan.id} className="hover:bg-[#faf8f3] dark:hover:bg-[#26231a]/50 transition-colors">
                      <td className="px-4 py-3 font-medium text-[#1c1810] dark:text-[#f0e8d8] max-w-[180px] truncate">
                        {scan.product_name || "—"}
                      </td>
                      <td className="px-4 py-3 text-[#7a6a4a] dark:text-[#9a8a68]">{scan.size}ml</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${
                            scan.scan_type === "stock_in"
                              ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400"
                              : "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400"
                          }`}
                        >
                          {scan.scan_type === "stock_in" ? (
                            <><CheckCircle className="w-3 h-3" /> Stock In</>
                          ) : (
                            <><TrendingUp className="w-3 h-3" /> Sale</>
                          )}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-semibold text-[#1c1810] dark:text-[#f0e8d8]">+{scan.quantity}</td>
                      <td className="px-4 py-3 text-[#7a6a4a] dark:text-[#9a8a68] text-xs">
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(scan.scanned_at).toLocaleString()}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {scanTotalPages > 1 && (
            <div className="flex items-center justify-between text-sm text-[#7a6a4a] dark:text-[#9a8a68]">
              <span>{scanTotalCount} scans</span>
              <div className="flex gap-2">
                <button
                  disabled={scanPage <= 1}
                  onClick={() => fetchScans(scanPage - 1, scanFilter)}
                  className="p-1.5 border border-[#e8e0d0] dark:border-[#2e2a1e] rounded hover:bg-[#faf8f3] dark:hover:bg-[#26231a] disabled:opacity-40"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="px-3 py-1 border border-[#e8e0d0] dark:border-[#2e2a1e] rounded text-[#1c1810] dark:text-[#f0e8d8]">
                  {scanPage} / {scanTotalPages}
                </span>
                <button
                  disabled={scanPage >= scanTotalPages}
                  onClick={() => fetchScans(scanPage + 1, scanFilter)}
                  className="p-1.5 border border-[#e8e0d0] dark:border-[#2e2a1e] rounded hover:bg-[#faf8f3] dark:hover:bg-[#26231a] disabled:opacity-40"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── LIVE SCAN TOAST ─────────────────────────────────── */}
      {liveToast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-start gap-3 bg-[#1c1a14] border border-[#2e2a1e] text-[#f0e8d8] px-5 py-4 rounded-xl shadow-2xl max-w-sm animate-fade-in">
          <CheckCircle className="w-5 h-5 text-green-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium">Mobile Scan Detected</p>
            <p className="text-xs text-[#9a8a68] mt-0.5">{liveToast.replace("📱 Mobile scan: ", "")}</p>
          </div>
          <button onClick={() => setLiveToast(null)} className="ml-2 text-[#9a8a68] hover:text-[#f0e8d8] shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ── GENERATE MODAL ────────────────────────────────────── */}
      {showGenerate && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#1c1a14] rounded-xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#e8e0d0] dark:border-[#2e2a1e]">
              <h2 className="text-base font-semibold text-[#1c1810] dark:text-[#f0e8d8]">Generate New Barcode</h2>
              <button onClick={() => setShowGenerate(false)} className="text-[#7a6a4a] dark:text-[#9a8a68] hover:text-[#1c1810] dark:hover:text-[#f0e8d8]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Product select */}
              <div>
                <label className="block text-sm font-medium text-[#1c1810] dark:text-[#f0e8d8] mb-1.5">Product</label>
                <select
                  value={genProductId}
                  onChange={(e) => { setGenProductId(e.target.value); setGenSize(""); }}
                  className="w-full px-3 py-2.5 border border-[#e8e0d0] dark:border-[#2e2a1e] rounded text-sm bg-white dark:bg-[#26231a] text-[#1c1810] dark:text-[#f0e8d8] focus:outline-none focus:ring-2 focus:ring-[#d4af37]"
                >
                  <option value="">— Select a product —</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              {/* Size */}
              <div>
                <label className="block text-sm font-medium text-[#1c1810] dark:text-[#f0e8d8] mb-1.5">Size (ml)</label>
                {availableSizes.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {availableSizes.map((s) => (
                      <button
                        key={s}
                        onClick={() => setGenSize(s)}
                        className={`px-3 py-1.5 rounded border text-sm transition-colors ${
                          genSize === s
                            ? "border-[#d4af37] bg-[#d4af37]/10 text-[#d4af37] font-medium"
                            : "border-[#e8e0d0] dark:border-[#2e2a1e] text-[#7a6a4a] dark:text-[#9a8a68] hover:border-[#d4af37]"
                        }`}
                      >
                        {s}ml
                      </button>
                    ))}
                  </div>
                ) : (
                  <input
                    type="text"
                    placeholder="e.g. 30"
                    value={genSize}
                    onChange={(e) => setGenSize(e.target.value)}
                    className="w-full px-3 py-2.5 border border-[#e8e0d0] dark:border-[#2e2a1e] rounded text-sm bg-white dark:bg-[#26231a] text-[#1c1810] dark:text-[#f0e8d8] placeholder-[#7a6a4a] dark:placeholder-[#9a8a68] focus:outline-none focus:ring-2 focus:ring-[#d4af37]"
                  />
                )}
              </div>

              {/* Result */}
              {genResult && (
                <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded space-y-3">
                  <p className="text-sm text-green-700 dark:text-green-400 font-medium flex items-center gap-2">
                    <CheckCircle className="w-4 h-4" /> Barcode generated successfully!
                  </p>
                  <div
                    className="flex justify-center bg-white rounded p-4 border border-[#e8e0d0]"
                    dangerouslySetInnerHTML={{
                      __html: generateEAN13SVG(genResult, { moduleWidth: 2, height: 70, fontSize: 11 }),
                    }}
                  />
                  <p className="text-xs text-center text-[#7a6a4a] dark:text-[#9a8a68] font-mono">{genResult}</p>
                </div>
              )}

              {genError && (
                <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded px-4 py-3">
                  {genError}
                </p>
              )}
            </div>

            <div className="px-6 py-4 border-t border-[#e8e0d0] dark:border-[#2e2a1e] flex justify-end gap-3">
              <button
                onClick={() => setShowGenerate(false)}
                className="px-4 py-2 border border-[#e8e0d0] dark:border-[#2e2a1e] rounded text-sm text-[#7a6a4a] dark:text-[#9a8a68] hover:bg-[#faf8f3] dark:hover:bg-[#26231a] transition-colors"
              >
                Close
              </button>
              <button
                onClick={handleGenerate}
                disabled={generating || !genProductId || !genSize}
                className="px-5 py-2 bg-[#d4af37] text-white rounded text-sm font-medium hover:bg-[#c09b2a] transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {generating ? (
                  <><RefreshCw className="w-4 h-4 animate-spin" /> Generating…</>
                ) : (
                  <><Plus className="w-4 h-4" /> Generate</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Small helpers ──────────────────────────────────────────── */
function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
}) {
  return (
    <div className="border border-[#e8e0d0] dark:border-[#2e2a1e] rounded p-4 flex items-center gap-4 bg-white dark:bg-[#1c1a14]">
      <div className="w-10 h-10 bg-[#d4af37]/10 rounded flex items-center justify-center text-[#d4af37]">
        {icon}
      </div>
      <div>
        <p className="text-xs text-[#7a6a4a] dark:text-[#9a8a68] uppercase tracking-wide">{label}</p>
        <p className="text-xl font-semibold text-[#1c1810] dark:text-[#f0e8d8]">{value}</p>
      </div>
    </div>
  );
}

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 pb-3 text-sm font-medium border-b-2 transition-colors ${
        active
          ? "border-[#d4af37] text-[#d4af37]"
          : "border-transparent text-[#7a6a4a] dark:text-[#9a8a68] hover:text-[#1c1810] dark:hover:text-[#f0e8d8]"
      }`}
    >
      {children}
    </button>
  );
}

function InfoRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex justify-between items-start gap-2">
      <span className="text-[#7a6a4a] dark:text-[#9a8a68] shrink-0">{label}</span>
      <span
        className={`text-[#1c1810] dark:text-[#f0e8d8] text-right break-all ${mono ? "font-mono text-xs" : ""}`}
      >
        {value}
      </span>
    </div>
  );
}
