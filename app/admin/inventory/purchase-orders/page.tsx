// app/admin/inventory/purchase-orders/page.tsx
"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Plus, RefreshCw, ChevronDown, ChevronUp, X, Check, Clock,
  Package, Truck, AlertCircle, Users, Phone, Mail, MapPin,
  FileText, Send, Calendar, Edit2, Trash2, RotateCcw
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Supplier { id: string; name: string; phone: string; email?: string; address?: string; notes?: string; }
interface ProductSize { productId: string; productName: string; category: string; perfumeType: string; size: string; currentStock: number; }
interface POItem { productId: string; productName: string; size: string; quantity: number; currentStock: number; }
interface PurchaseOrder {
  id: string; poNumber: string; status: string;
  scheduledAt: string | null; sentAt: string | null; receivedAt: string | null;
  notes: string | null; createdAt: string;
  supplier: { id: string; name: string; phone: string };
  itemCount: number; items?: POItem[];
}

// ─── Status helpers ────────────────────────────────────────────────────────────
const STATUS_COLORS: Record<string, string> = {
  draft:     "bg-gray-100 text-gray-600 border-gray-200",
  scheduled: "bg-blue-50 text-blue-700 border-blue-200",
  sent:      "bg-green-50 text-green-700 border-green-200",
  received:  "bg-purple-50 text-purple-700 border-purple-200",
  cancelled: "bg-gray-100 text-gray-400 border-gray-200",
  failed:    "bg-red-50 text-red-700 border-red-200",
};

const STATUS_ICONS: Record<string, React.ReactNode> = {
  draft:     <FileText className="w-3 h-3" />,
  scheduled: <Clock className="w-3 h-3" />,
  sent:      <Send className="w-3 h-3" />,
  received:  <Check className="w-3 h-3" />,
  cancelled: <X className="w-3 h-3" />,
  failed:    <AlertCircle className="w-3 h-3" />,
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded border ${STATUS_COLORS[status] ?? "bg-gray-100 text-gray-600 border-gray-200"}`}>
      {STATUS_ICONS[status]}
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function PurchaseOrdersPage() {
  const [activeTab, setActiveTab] = useState<"pos" | "suppliers">("pos");

  // PO state
  const [pos, setPos] = useState<PurchaseOrder[]>([]);
  const [poLoading, setPoLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [expandedPO, setExpandedPO] = useState<string | null>(null);
  const [expandedDetail, setExpandedDetail] = useState<PurchaseOrder | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  // Supplier state
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [supplierLoading, setSupplierLoading] = useState(false);
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [supplierForm, setSupplierForm] = useState({ name: "", phone: "", email: "", address: "", notes: "" });

  // Create PO modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createStep, setCreateStep] = useState<1 | 2 | 3>(1);
  const [productSizes, setProductSizes] = useState<ProductSize[]>([]);
  const [productLoading, setProductLoading] = useState(false);
  const [selectedItems, setSelectedItems] = useState<POItem[]>([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState("");
  const [sendNow, setSendNow] = useState(true);
  const [scheduledAt, setScheduledAt] = useState("");
  const [poNotes, setPoNotes] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  // Action loading states
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  function showToast(msg: string, type: "success" | "error" = "success") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }

  // ── Data fetching ────────────────────────────────────────────────────────────
  const fetchPOs = useCallback(async () => {
    setPoLoading(true);
    try {
      const params = new URLSearchParams({ status: statusFilter });
      const res = await fetch(`/api/admin/purchase-orders?${params}`);
      const json = await res.json();
      if (json.success) setPos(json.data);
    } catch { /* silent */ }
    finally { setPoLoading(false); }
  }, [statusFilter]);

  const fetchSuppliers = useCallback(async () => {
    setSupplierLoading(true);
    try {
      const res = await fetch("/api/admin/suppliers");
      const json = await res.json();
      if (json.success) setSuppliers(json.data);
    } catch { /* silent */ }
    finally { setSupplierLoading(false); }
  }, []);

  const fetchProductSizes = useCallback(async () => {
    setProductLoading(true);
    try {
      // Reuse inventory-report API which returns per-size rows sorted by stock
      const res = await fetch("/api/admin/reports/inventory-report?type=stock-levels&threshold=10");
      const json = await res.json();
      if (json.success) {
        const rows: ProductSize[] = (json.data.products || []).map((p: any) => ({
          productId: p.productId || p.id,
          productName: p.name,
          category: p.category,
          perfumeType: p.perfumeType,
          size: p.size,
          currentStock: p.stock,
        }));
        // Sort: Out of Stock → Low Stock → In Stock
        rows.sort((a, b) => a.currentStock - b.currentStock);
        setProductSizes(rows);
      }
    } catch { /* silent */ }
    finally { setProductLoading(false); }
  }, []);

  useEffect(() => { fetchPOs(); }, [fetchPOs]);
  useEffect(() => { fetchSuppliers(); }, [fetchSuppliers]);

  // Poll for scheduled POs every 30s (also runs immediately on mount)
  useEffect(() => {
    async function processScheduled() {
      try {
        const res = await fetch("/api/admin/purchase-orders/scheduled", { method: "POST" });
        const json = await res.json();
        if (json.success && (json.processed > 0 || json.failed > 0)) {
          fetchPOs();
          if (json.processed > 0) showToast(`${json.processed} scheduled PO(s) sent via SMS.`);
          if (json.failed > 0) showToast(`${json.failed} scheduled PO(s) failed to send.`, "error");
        }
      } catch { /* silent */ }
    }
    processScheduled();
    const interval = setInterval(processScheduled, 30000);
    return () => clearInterval(interval);
  }, [fetchPOs]);

  // ── PO Detail expand ─────────────────────────────────────────────────────────
  async function toggleExpand(poId: string) {
    if (expandedPO === poId) { setExpandedPO(null); setExpandedDetail(null); setDetailError(null); return; }
    setExpandedPO(poId);
    setExpandedDetail(null);
    setDetailError(null);
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/admin/purchase-orders/${poId}`);
      const json = await res.json();
      if (json.success) setExpandedDetail(json.data);
      else setDetailError(json.error || "Failed to load details");
    } catch (e) { setDetailError("Failed to load details"); }
    finally { setDetailLoading(false); }
  }

  // ── PO Actions ───────────────────────────────────────────────────────────────
  async function handleAction(poId: string, action: "cancel" | "retry" | "send") {
    setActionLoading(poId + action);
    try {
      const res = await fetch(`/api/admin/purchase-orders/${poId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const json = await res.json();
      if (json.success) {
        const msg = action === "cancel" ? "PO cancelled." : action === "send" ? "SMS sent successfully." : "SMS retry sent.";
        showToast(msg);
        fetchPOs();
        setExpandedPO(null);
      } else showToast(json.error || "Action failed.", "error");
    } catch { showToast("Action failed.", "error"); }
    finally { setActionLoading(null); }
  }

  async function handleReceive(poId: string) {
    setActionLoading(poId + "receive");
    try {
      const res = await fetch(`/api/admin/purchase-orders/${poId}/receive`, { method: "POST" });
      const json = await res.json();
      if (json.success) { showToast(json.message || "PO marked as received. Stock updated."); fetchPOs(); setExpandedPO(null); }
      else showToast(json.error || "Failed to receive PO.", "error");
    } catch { showToast("Failed to receive PO.", "error"); }
    finally { setActionLoading(null); }
  }

  async function handleDeletePO(poId: string) {
    if (!confirm("Delete this purchase order? This cannot be undone.")) return;
    setActionLoading(poId + "delete");
    try {
      const res = await fetch(`/api/admin/purchase-orders/${poId}`, { method: "DELETE" });
      const json = await res.json();
      if (json.success) { showToast("PO deleted."); fetchPOs(); setExpandedPO(null); }
      else showToast(json.error || "Cannot delete PO.", "error");
    } catch { showToast("Failed to delete PO.", "error"); }
    finally { setActionLoading(null); }
  }

  // ── Create PO ────────────────────────────────────────────────────────────────
  function openCreateModal() {
    setCreateStep(1);
    setSelectedItems([]);
    setSelectedSupplierId("");
    setSendNow(true);
    setScheduledAt("");
    setPoNotes("");
    setCreateError("");
    fetchProductSizes();
    setShowCreateModal(true);
  }

  function toggleItem(ps: ProductSize) {
    setSelectedItems(prev => {
      const exists = prev.find(i => i.productId === ps.productId && i.size === ps.size);
      if (exists) return prev.filter(i => !(i.productId === ps.productId && i.size === ps.size));
      return [...prev, { productId: ps.productId, productName: ps.productName, size: ps.size, quantity: 1, currentStock: ps.currentStock }];
    });
  }

  function updateQty(productId: string, size: string, qty: number) {
    setSelectedItems(prev => prev.map(i =>
      i.productId === productId && i.size === size ? { ...i, quantity: Math.max(1, qty) } : i
    ));
  }

  function buildSmsPreview() {
    const supplier = suppliers.find(s => s.id === selectedSupplierId);
    if (!supplier || selectedItems.length === 0) return "";
    const lines = selectedItems.map(i => `- ${i.productName} (${i.size}): ${i.quantity} units`).join("\n");
    return `Hello ${supplier.name}, this is SCENTOPIA. Purchase Order #PO-XXXXXXXX-XXX:\n${lines}\nPlease confirm availability. Thank you.`;
  }

  async function handleCreatePO() {
    setCreateError("");
    const hasInvalid = selectedItems.some(i => !i.quantity || i.quantity < 1);
    if (hasInvalid) { setCreateError("All quantities must be at least 1."); return; }
    if (!selectedSupplierId) { setCreateError("Please select a supplier."); return; }
    if (!sendNow && !scheduledAt) { setCreateError("Please set a schedule date/time."); return; }

    setCreating(true);
    try {
      const res = await fetch("/api/admin/purchase-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplierId: selectedSupplierId,
          items: selectedItems.map(i => ({ productId: i.productId, productName: i.productName, size: i.size, quantity: i.quantity })),
          sendNow,
          scheduledAt: sendNow ? null : (scheduledAt ? new Date(scheduledAt).toISOString() : null),
          notes: poNotes,
        }),
      });
      const json = await res.json();
      if (json.success) {
        showToast(sendNow ? `PO created and SMS sent!` : `PO scheduled successfully.`);
        setShowCreateModal(false);
        fetchPOs();
      } else {
        setCreateError((json.details ? `${json.error}: ${json.details}` : json.error) || "Failed to create PO.");
      }
    } catch { setCreateError("Failed to create purchase order."); }
    finally { setCreating(false); }
  }

  // ── Supplier management ──────────────────────────────────────────────────────
  function openAddSupplier() { setEditingSupplier(null); setSupplierForm({ name: "", phone: "", email: "", address: "", notes: "" }); setShowSupplierModal(true); }
  function openEditSupplier(s: Supplier) { setEditingSupplier(s); setSupplierForm({ name: s.name, phone: s.phone, email: s.email || "", address: s.address || "", notes: s.notes || "" }); setShowSupplierModal(true); }

  async function handleSaveSupplier() {
    if (!supplierForm.name.trim() || !supplierForm.phone.trim()) { showToast("Name and phone are required.", "error"); return; }
    try {
      const url = editingSupplier ? `/api/admin/suppliers/${editingSupplier.id}` : "/api/admin/suppliers";
      const method = editingSupplier ? "PATCH" : "POST";
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(supplierForm) });
      const json = await res.json();
      if (json.success) { showToast(editingSupplier ? "Supplier updated." : "Supplier added."); setShowSupplierModal(false); fetchSuppliers(); }
      else showToast(json.error || "Failed to save supplier.", "error");
    } catch { showToast("Failed to save supplier.", "error"); }
  }

  async function handleDeactivateSupplier(id: string) {
    if (!confirm("Deactivate this supplier?")) return;
    try {
      const res = await fetch(`/api/admin/suppliers/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (json.success) { showToast("Supplier deactivated."); fetchSuppliers(); }
      else showToast(json.error || "Failed to deactivate.", "error");
    } catch { showToast("Failed to deactivate.", "error"); }
  }

  // ── Stock status helpers ─────────────────────────────────────────────────────
  function stockBadge(stock: number) {
    if (stock === 0) return <span className="px-1.5 py-0.5 text-xs rounded bg-red-100 text-red-700">Out of Stock</span>;
    if (stock <= 10) return <span className="px-1.5 py-0.5 text-xs rounded bg-orange-100 text-orange-700">{stock} ⚠</span>;
    return <span className="text-sm text-[#1c1810]">{stock}</span>;
  }

  const STATUS_FILTERS = ["all", "draft", "scheduled", "sent", "received", "failed", "cancelled"];

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded shadow-lg text-sm font-medium ${toast.type === "success" ? "bg-green-600 text-white" : "bg-red-600 text-white"}`}>
          {toast.msg}
        </div>
      )}

      {/* Page header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-[#1c1810]">Purchase Orders</h1>
          <p className="text-sm text-[#7a6a4a] mt-0.5">Restock products and notify suppliers via SMS</p>
        </div>
        <button onClick={openCreateModal} className="flex items-center gap-2 px-4 py-2 bg-[#D4AF37] text-[#1c1810] font-semibold text-sm rounded-sm hover:bg-[#D4AF37]/90">
          <Plus className="w-4 h-4" /> Create PO
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-[#e8e0d0]">
        {(["pos", "suppliers"] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === tab ? "border-[#D4AF37] text-[#1c1810]" : "border-transparent text-[#7a6a4a] hover:text-[#1c1810]"}`}>
            {tab === "pos" ? "Purchase Orders" : "Suppliers"}
          </button>
        ))}
      </div>

      {/* ── Purchase Orders Tab ──────────────────────────────────────────────── */}
      {activeTab === "pos" && (
        <div className="space-y-4">
          {/* Status filter chips */}
          <div className="flex flex-wrap gap-2">
            {STATUS_FILTERS.map(s => (
              <button key={s} onClick={() => setStatusFilter(s)}
                className={`px-3 py-1 text-xs font-medium rounded-sm border transition-colors ${statusFilter === s ? "bg-[#D4AF37] text-[#1c1810] border-[#D4AF37]" : "bg-white text-[#7a6a4a] border-[#e8e0d0] hover:border-[#D4AF37]/50"}`}>
                {s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
            <button onClick={fetchPOs} className="ml-auto flex items-center gap-1 px-3 py-1 text-xs text-[#7a6a4a] border border-[#e8e0d0] rounded-sm hover:border-[#D4AF37]/50">
              <RefreshCw className={`w-3 h-3 ${poLoading ? "animate-spin" : ""}`} /> Refresh
            </button>
          </div>

          {/* PO Table */}
          <div className="bg-white border border-[#e8e0d0] rounded-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-[#faf8f3] border-b border-[#e8e0d0]">
                <tr className="text-left text-[#7a6a4a] text-xs uppercase tracking-wide">
                  <th className="py-3 px-4">PO Number</th>
                  <th className="py-3 px-4">Supplier</th>
                  <th className="py-3 px-4">Items</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4"></th>
                </tr>
              </thead>
              <tbody>
                {poLoading ? (
                  <tr><td colSpan={6} className="py-10 text-center text-[#7a6a4a]">Loading...</td></tr>
                ) : pos.length === 0 ? (
                  <tr><td colSpan={6} className="py-10 text-center text-[#7a6a4a]">No purchase orders found.</td></tr>
                ) : pos.map(po => (
                  <React.Fragment key={po.id}>
                    <tr onClick={() => toggleExpand(po.id)} className="border-t border-[#e8e0d0] hover:bg-[#faf8f3]/60 cursor-pointer">
                      <td className="py-3 px-4 font-mono text-xs font-semibold text-[#1c1810]">{po.poNumber}</td>
                      <td className="py-3 px-4">
                        <div className="text-[#1c1810] font-medium">{po.supplier?.name}</div>
                        <div className="text-xs text-[#7a6a4a]">{po.supplier?.phone}</div>
                      </td>
                      <td className="py-3 px-4 text-[#1c1810]">{po.itemCount} item{po.itemCount !== 1 ? "s" : ""}</td>
                      <td className="py-3 px-4"><StatusBadge status={po.status} /></td>
                      <td className="py-3 px-4 text-xs text-[#7a6a4a]">
                        {po.sentAt ? `Sent ${formatDate(po.sentAt)}` : po.scheduledAt ? `Scheduled ${formatDate(po.scheduledAt)}` : formatDate(po.createdAt)}
                      </td>
                      <td className="py-3 px-4 text-[#7a6a4a]">
                        {expandedPO === po.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </td>
                    </tr>
                    {expandedPO === po.id && (
                      <tr className="border-t border-[#e8e0d0]">
                        <td colSpan={6} className="px-4 py-4 bg-[#faf8f3]">
                          <div className="space-y-3">
                            {/* Items table */}
                            {detailLoading ? (
                              <p className="text-sm text-[#7a6a4a]">Loading details...</p>
                            ) : detailError ? (
                              <p className="text-sm text-red-500">{detailError}</p>
                            ) : expandedDetail ? (
                              <>
                                <table className="w-full text-sm border border-[#e8e0d0] rounded-sm overflow-hidden">
                                  <thead className="bg-white">
                                    <tr className="text-left text-xs text-[#7a6a4a] uppercase">
                                      <th className="py-2 px-3">Product</th>
                                      <th className="py-2 px-3">Size</th>
                                      <th className="py-2 px-3">Order Qty</th>
                                      <th className="py-2 px-3">Current Stock</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {(expandedDetail.items || []).map((item, idx) => (
                                      <tr key={idx} className="border-t border-[#e8e0d0]">
                                        <td className="py-2 px-3 text-[#1c1810]">{item.productName}</td>
                                        <td className="py-2 px-3 text-[#7a6a4a]">{item.size}</td>
                                        <td className="py-2 px-3 font-semibold text-[#1c1810]">{item.quantity}</td>
                                        <td className="py-2 px-3">{stockBadge(item.currentStock)}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                                {expandedDetail.notes && <p className="text-xs text-[#7a6a4a]"><span className="font-semibold">Notes:</span> {expandedDetail.notes}</p>}
                              </>
                            ) : null}
                            {/* Action buttons — always visible based on status */}
                            <div className="flex flex-wrap gap-2 pt-1">
                              {po.status === "draft" && (
                                <button onClick={(e) => { e.stopPropagation(); handleAction(po.id, "send"); }} disabled={actionLoading === po.id + "send"}
                                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-[#D4AF37] text-white rounded-sm hover:bg-[#b8962e] disabled:opacity-50">
                                  <Send className="w-3 h-3" /> {actionLoading === po.id + "send" ? "Sending..." : "Send SMS Now"}
                                </button>
                              )}
                              {po.status === "sent" && (
                                <button onClick={(e) => { e.stopPropagation(); handleReceive(po.id); }} disabled={actionLoading === po.id + "receive"}
                                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-purple-600 text-white rounded-sm hover:bg-purple-700 disabled:opacity-50">
                                  <Truck className="w-3 h-3" /> {actionLoading === po.id + "receive" ? "Processing..." : "Mark as Received"}
                                </button>
                              )}
                              {po.status === "failed" && (
                                <button onClick={(e) => { e.stopPropagation(); handleAction(po.id, "retry"); }} disabled={actionLoading === po.id + "retry"}
                                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-orange-500 text-white rounded-sm hover:bg-orange-600 disabled:opacity-50">
                                  <RotateCcw className="w-3 h-3" /> {actionLoading === po.id + "retry" ? "Retrying..." : "Retry SMS"}
                                </button>
                              )}
                              {["draft", "scheduled", "failed"].includes(po.status) && (
                                <button onClick={(e) => { e.stopPropagation(); handleAction(po.id, "cancel"); }} disabled={actionLoading === po.id + "cancel"}
                                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-[#faf8f3] text-[#7a6a4a] border border-[#e8e0d0] rounded-sm hover:border-red-300 hover:text-red-600 disabled:opacity-50">
                                  <X className="w-3 h-3" /> Cancel
                                </button>
                              )}
                              {["draft", "cancelled"].includes(po.status) && (
                                <button onClick={(e) => { e.stopPropagation(); handleDeletePO(po.id); }} disabled={actionLoading === po.id + "delete"}
                                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-red-500 border border-red-200 rounded-sm hover:bg-red-50 disabled:opacity-50">
                                  <Trash2 className="w-3 h-3" /> Delete
                                </button>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Suppliers Tab ────────────────────────────────────────────────────── */}
      {activeTab === "suppliers" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-[#7a6a4a]">{suppliers.length} active supplier{suppliers.length !== 1 ? "s" : ""}</p>
            <button onClick={openAddSupplier} className="flex items-center gap-2 px-3 py-2 bg-[#D4AF37] text-[#1c1810] font-semibold text-sm rounded-sm hover:bg-[#D4AF37]/90">
              <Plus className="w-4 h-4" /> Add Supplier
            </button>
          </div>
          <div className="bg-white border border-[#e8e0d0] rounded-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-[#faf8f3] border-b border-[#e8e0d0]">
                <tr className="text-left text-[#7a6a4a] text-xs uppercase tracking-wide">
                  <th className="py-3 px-4">Name</th>
                  <th className="py-3 px-4">Phone</th>
                  <th className="py-3 px-4">Email</th>
                  <th className="py-3 px-4">Address</th>
                  <th className="py-3 px-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {supplierLoading ? (
                  <tr><td colSpan={5} className="py-8 text-center text-[#7a6a4a]">Loading...</td></tr>
                ) : suppliers.length === 0 ? (
                  <tr><td colSpan={5} className="py-8 text-center text-[#7a6a4a]">No suppliers yet. Add your first supplier.</td></tr>
                ) : suppliers.map(s => (
                  <tr key={s.id} className="border-t border-[#e8e0d0] hover:bg-[#faf8f3]/60">
                    <td className="py-3 px-4 font-medium text-[#1c1810]">{s.name}</td>
                    <td className="py-3 px-4 text-[#7a6a4a]">{s.phone}</td>
                    <td className="py-3 px-4 text-[#7a6a4a]">{s.email || "—"}</td>
                    <td className="py-3 px-4 text-[#7a6a4a] text-xs">{s.address || "—"}</td>
                    <td className="py-3 px-4">
                      <div className="flex gap-2">
                        <button onClick={() => openEditSupplier(s)} className="p-1 text-[#7a6a4a] hover:text-[#1c1810]"><Edit2 className="w-4 h-4" /></button>
                        <button onClick={() => handleDeactivateSupplier(s.id)} className="p-1 text-[#7a6a4a] hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Create PO Modal ──────────────────────────────────────────────────── */}
      {showCreateModal && (
        <div className="fixed inset-0 z-40 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-sm shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#e8e0d0]">
              <div>
                <h2 className="text-lg font-bold text-[#1c1810]">Create Purchase Order</h2>
                <div className="flex gap-3 mt-1">
                  {([1, 2, 3] as const).map(n => (
                    <span key={n} className={`text-xs px-2 py-0.5 rounded-full ${createStep === n ? "bg-[#D4AF37] text-[#1c1810] font-semibold" : createStep > n ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-400"}`}>
                      {n === 1 ? "1. Select Products" : n === 2 ? "2. Supplier & Schedule" : "3. Review & Confirm"}
                    </span>
                  ))}
                </div>
              </div>
              <button onClick={() => setShowCreateModal(false)} className="p-2 text-[#7a6a4a] hover:text-[#1c1810]"><X className="w-5 h-5" /></button>
            </div>

            {/* Modal body */}
            <div className="flex-1 overflow-y-auto px-6 py-4">

              {/* Step 1: Product selection */}
              {createStep === 1 && (
                <div className="space-y-3">
                  <p className="text-sm text-[#7a6a4a]">Select products and sizes to restock. Low/out-of-stock items are shown first.</p>
                  {productLoading ? <p className="text-sm text-[#7a6a4a]">Loading products...</p> : (
                    <div className="border border-[#e8e0d0] rounded-sm overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-[#faf8f3] border-b border-[#e8e0d0]">
                          <tr className="text-left text-xs text-[#7a6a4a] uppercase tracking-wide">
                            <th className="py-2 px-3 w-8"></th>
                            <th className="py-2 px-3">Product</th>
                            <th className="py-2 px-3">Type</th>
                            <th className="py-2 px-3">Size</th>
                            <th className="py-2 px-3">Stock</th>
                            <th className="py-2 px-3">Order Qty</th>
                          </tr>
                        </thead>
                        <tbody>
                          {productSizes.map((ps, idx) => {
                            const selected = selectedItems.find(i => i.productId === ps.productId && i.size === ps.size);
                            return (
                              <tr key={idx} onClick={() => toggleItem(ps)} className={`border-t border-[#e8e0d0] cursor-pointer ${selected ? "bg-[#D4AF37]/10" : "hover:bg-[#faf8f3]/60"}`}>
                                <td className="py-2 px-3">
                                  <div className={`w-4 h-4 rounded border ${selected ? "bg-[#D4AF37] border-[#D4AF37]" : "border-gray-300"} flex items-center justify-center`}>
                                    {selected && <Check className="w-3 h-3 text-white" />}
                                  </div>
                                </td>
                                <td className="py-2 px-3 font-medium text-[#1c1810]">{ps.productName}</td>
                                <td className="py-2 px-3">
                                  <span className={`px-1.5 py-0.5 text-xs rounded ${ps.perfumeType === "Premium" ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"}`}>{ps.perfumeType}</span>
                                </td>
                                <td className="py-2 px-3 text-[#7a6a4a]">{ps.size}</td>
                                <td className="py-2 px-3">{stockBadge(ps.currentStock)}</td>
                                <td className="py-2 px-3" onClick={e => e.stopPropagation()}>
                                  {selected ? (
                                    <input type="number" min={1} value={selected.quantity}
                                      onChange={e => updateQty(ps.productId, ps.size, parseInt(e.target.value) || 1)}
                                      className="w-16 px-2 py-1 border border-[#e8e0d0] rounded text-sm text-center focus:outline-none focus:border-[#D4AF37]" />
                                  ) : <span className="text-[#7a6a4a] text-xs">—</span>}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                  {selectedItems.length > 0 && (
                    <p className="text-xs text-[#7a6a4a]">{selectedItems.length} item{selectedItems.length !== 1 ? "s" : ""} selected</p>
                  )}
                </div>
              )}

              {/* Step 2: Supplier & Schedule */}
              {createStep === 2 && (
                <div className="space-y-5">
                  <div>
                    <label className="block text-sm font-semibold text-[#1c1810] mb-1.5">Supplier <span className="text-red-500">*</span></label>
                    <select value={selectedSupplierId} onChange={e => setSelectedSupplierId(e.target.value)}
                      className="w-full px-3 py-2 border border-[#e8e0d0] rounded-sm text-sm focus:outline-none focus:border-[#D4AF37] bg-white text-[#1c1810]">
                      <option value="">— Select a supplier —</option>
                      {suppliers.map(s => <option key={s.id} value={s.id}>{s.name} ({s.phone})</option>)}
                    </select>
                    {suppliers.length === 0 && <p className="text-xs text-orange-600 mt-1">No suppliers found. Add one in the Suppliers tab first.</p>}
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-[#1c1810] mb-1.5">Send Option</label>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="radio" checked={sendNow} onChange={() => setSendNow(true)} className="accent-[#D4AF37]" />
                        <span className="text-sm text-[#1c1810]">Send Now</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="radio" checked={!sendNow} onChange={() => setSendNow(false)} className="accent-[#D4AF37]" />
                        <span className="text-sm text-[#1c1810]">Schedule</span>
                      </label>
                    </div>
                    {!sendNow && (
                      <input type="datetime-local" value={scheduledAt} onChange={e => setScheduledAt(e.target.value)}
                        className="mt-2 w-full px-3 py-2 border border-[#e8e0d0] rounded-sm text-sm focus:outline-none focus:border-[#D4AF37]"
                        min={new Date().toISOString().slice(0, 16)} />
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-[#1c1810] mb-1.5">Notes (optional)</label>
                    <textarea value={poNotes} onChange={e => setPoNotes(e.target.value)} rows={3}
                      placeholder="Additional notes for this purchase order..."
                      className="w-full px-3 py-2 border border-[#e8e0d0] rounded-sm text-sm focus:outline-none focus:border-[#D4AF37] resize-none" />
                  </div>
                </div>
              )}

              {/* Step 3: Review */}
              {createStep === 3 && (
                <div className="space-y-4">
                  <div className="bg-[#faf8f3] border border-[#e8e0d0] rounded-sm p-4 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-[#7a6a4a]">Supplier</span>
                      <span className="font-medium text-[#1c1810]">{suppliers.find(s => s.id === selectedSupplierId)?.name}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-[#7a6a4a]">Send</span>
                      <span className="font-medium text-[#1c1810]">{sendNow ? "Immediately" : formatDate(scheduledAt)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-[#7a6a4a]">Items</span>
                      <span className="font-medium text-[#1c1810]">{selectedItems.length}</span>
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-semibold text-[#7a6a4a] uppercase tracking-wide mb-2">Items</p>
                    <div className="border border-[#e8e0d0] rounded-sm overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-[#faf8f3]">
                          <tr className="text-xs text-[#7a6a4a] uppercase">
                            <th className="py-2 px-3 text-left">Product</th>
                            <th className="py-2 px-3 text-left">Size</th>
                            <th className="py-2 px-3 text-right">Qty</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedItems.map((item, idx) => (
                            <tr key={idx} className="border-t border-[#e8e0d0]">
                              <td className="py-2 px-3 text-[#1c1810]">{item.productName}</td>
                              <td className="py-2 px-3 text-[#7a6a4a]">{item.size}</td>
                              <td className="py-2 px-3 text-right font-semibold text-[#1c1810]">{item.quantity}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-semibold text-[#7a6a4a] uppercase tracking-wide mb-2">SMS Preview</p>
                    <pre className="bg-[#faf8f3] border border-[#e8e0d0] rounded-sm p-3 text-xs text-[#1c1810] whitespace-pre-wrap font-sans">{buildSmsPreview()}</pre>
                  </div>

                  {createError && <p className="text-sm text-red-600">{createError}</p>}
                </div>
              )}
            </div>

            {/* Modal footer */}
            <div className="px-6 py-4 border-t border-[#e8e0d0] flex justify-between items-center">
              <button onClick={() => createStep > 1 ? setCreateStep((createStep - 1) as 1 | 2 | 3) : setShowCreateModal(false)}
                className="px-4 py-2 text-sm text-[#7a6a4a] border border-[#e8e0d0] rounded-sm hover:border-[#1c1810]">
                {createStep === 1 ? "Cancel" : "Back"}
              </button>
              {createStep < 3 ? (
                <button
                  onClick={() => {
                    if (createStep === 1 && selectedItems.length === 0) { showToast("Select at least one item.", "error"); return; }
                    if (createStep === 2 && !selectedSupplierId) { showToast("Please select a supplier.", "error"); return; }
                    if (createStep === 2 && !sendNow && !scheduledAt) { showToast("Please set a schedule date/time.", "error"); return; }
                    setCreateStep((createStep + 1) as 2 | 3);
                  }}
                  className="px-4 py-2 text-sm bg-[#D4AF37] text-[#1c1810] font-semibold rounded-sm hover:bg-[#D4AF37]/90">
                  Next
                </button>
              ) : (
                <button onClick={handleCreatePO} disabled={creating || !selectedSupplierId || selectedItems.length === 0}
                  className="flex items-center gap-2 px-4 py-2 text-sm bg-[#D4AF37] text-[#1c1810] font-semibold rounded-sm hover:bg-[#D4AF37]/90 disabled:opacity-50 disabled:cursor-not-allowed">
                  {creating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  {creating ? "Creating..." : sendNow ? "Confirm & Send SMS" : "Confirm & Schedule"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Supplier Modal ───────────────────────────────────────────────────── */}
      {showSupplierModal && (
        <div className="fixed inset-0 z-40 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-sm shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#e8e0d0]">
              <h2 className="text-lg font-bold text-[#1c1810]">{editingSupplier ? "Edit Supplier" : "Add Supplier"}</h2>
              <button onClick={() => setShowSupplierModal(false)} className="p-2 text-[#7a6a4a] hover:text-[#1c1810]"><X className="w-5 h-5" /></button>
            </div>
            <div className="px-6 py-4 space-y-4">
              {[
                { label: "Name", key: "name", required: true, icon: <Users className="w-4 h-4" />, placeholder: "Supplier company name" },
                { label: "Phone", key: "phone", required: true, icon: <Phone className="w-4 h-4" />, placeholder: "e.g. 09XXXXXXXXX" },
                { label: "Email", key: "email", required: false, icon: <Mail className="w-4 h-4" />, placeholder: "supplier@email.com" },
                { label: "Address", key: "address", required: false, icon: <MapPin className="w-4 h-4" />, placeholder: "Business address" },
                { label: "Notes", key: "notes", required: false, icon: <FileText className="w-4 h-4" />, placeholder: "Payment terms, notes..." },
              ].map(field => (
                <div key={field.key}>
                  <label className="block text-sm font-semibold text-[#1c1810] mb-1">{field.label} {field.required && <span className="text-red-500">*</span>}</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#7a6a4a]">{field.icon}</span>
                    <input value={(supplierForm as any)[field.key]} onChange={e => setSupplierForm(f => ({ ...f, [field.key]: e.target.value }))}
                      placeholder={field.placeholder}
                      className="w-full pl-9 pr-3 py-2 border border-[#e8e0d0] rounded-sm text-sm focus:outline-none focus:border-[#D4AF37]" />
                  </div>
                </div>
              ))}
            </div>
            <div className="px-6 py-4 border-t border-[#e8e0d0] flex justify-end gap-3">
              <button onClick={() => setShowSupplierModal(false)} className="px-4 py-2 text-sm text-[#7a6a4a] border border-[#e8e0d0] rounded-sm hover:border-[#1c1810]">Cancel</button>
              <button onClick={handleSaveSupplier} className="px-4 py-2 text-sm bg-[#D4AF37] text-[#1c1810] font-semibold rounded-sm hover:bg-[#D4AF37]/90">
                {editingSupplier ? "Save Changes" : "Add Supplier"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
