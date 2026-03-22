"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Ticket,
  Plus,
  Search,
  X,
  Edit,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Copy,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Bell,
  Check,
} from "lucide-react";

// ─── Types ─────────────────────────────────────────────────────────────────

interface Voucher {
  id: string;
  code: string;
  description: string | null;
  discount_type: "percentage" | "fixed";
  discount_value: number;
  min_order_amount: number;
  max_discount_amount: number | null;
  usage_limit: number | null;
  used_count: number;
  is_active: boolean;
  valid_from: string | null;
  valid_until: string | null;
  created_at: string;
}

interface Stats {
  total: number;
  active: number;
  expired: number;
  totalRedeemed: number;
}

const EMPTY_FORM = {
  code: "",
  description: "",
  discountType: "percentage" as "percentage" | "fixed",
  discountValue: "",
  minOrderAmount: "",
  maxDiscountAmount: "",
  usageLimit: "",
  validFrom: "",
  validUntil: "",
  sendNotification: false,
};

// ─── Helpers ───────────────────────────────────────────────────────────────

// Convert a UTC ISO string to a value suitable for datetime-local input (local time)
const toLocalInput = (utcStr: string | null): string => {
  if (!utcStr) return "";
  const d = new Date(utcStr);
  const offset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - offset).toISOString().slice(0, 16);
};

// Convert a datetime-local string (no timezone) to UTC ISO string
const toUTCISO = (localStr: string): string | null => {
  if (!localStr) return null;
  return new Date(localStr).toISOString();
};

const formatDate = (s: string | null) => {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "Asia/Manila" });
};

const formatCurrency = (n: number) =>
  new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(n);

const generateCode = () => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
};

const isExpired = (v: Voucher) => !!v.valid_until && new Date(v.valid_until) < new Date();
const isUsageFull = (v: Voucher) => v.usage_limit !== null && v.used_count >= v.usage_limit;

const getStatusBadge = (v: Voucher) => {
  if (isExpired(v)) return { label: "Expired", cls: "bg-red-50 text-red-600 border border-red-200" };
  if (!v.is_active) return { label: "Inactive", cls: "bg-gray-50 text-gray-500 border border-gray-200" };
  if (isUsageFull(v)) return { label: "Limit Reached", cls: "bg-orange-50 text-orange-600 border border-orange-200" };
  return { label: "Active", cls: "bg-green-50 text-green-700 border border-green-200" };
};

// ─── Component ─────────────────────────────────────────────────────────────

export default function VouchersPage() {
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, active: 0, expired: 0, totalRedeemed: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [showModal, setShowModal] = useState(false);
  const [editingVoucher, setEditingVoucher] = useState<Voucher | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchVouchers = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: "20",
        status: statusFilter,
        search,
      });
      const res = await fetch(`/api/admin/vouchers?${params}`);
      const result = await res.json();
      if (!result.success) throw new Error(result.error);
      setVouchers(result.data.vouchers);
      setTotalPages(result.data.totalPages);
      setStats(result.data.stats);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load vouchers");
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, statusFilter, search]);

  useEffect(() => { fetchVouchers(); }, [fetchVouchers]);

  // Search debounce
  useEffect(() => {
    const t = setTimeout(() => {
      setCurrentPage(1);
      fetchVouchers();
    }, 400);
    return () => clearTimeout(t);
  }, [search]);

  const openCreate = () => {
    setEditingVoucher(null);
    setForm({ ...EMPTY_FORM, code: generateCode() });
    setFormError(null);
    setShowModal(true);
  };

  const openEdit = (v: Voucher) => {
    setEditingVoucher(v);
    setForm({
      code: v.code,
      description: v.description || "",
      discountType: v.discount_type,
      discountValue: String(v.discount_value),
      minOrderAmount: String(v.min_order_amount || ""),
      maxDiscountAmount: v.max_discount_amount != null ? String(v.max_discount_amount) : "",
      usageLimit: v.usage_limit != null ? String(v.usage_limit) : "",
      validFrom: toLocalInput(v.valid_from),
      validUntil: toLocalInput(v.valid_until),
      sendNotification: false,
    });
    setFormError(null);
    setShowModal(true);
  };

  const handleSave = async () => {
    setFormError(null);
    if (!form.code.trim()) return setFormError("Code is required.");
    if (!form.discountValue || isNaN(Number(form.discountValue))) return setFormError("Discount value is required.");
    if (form.discountType === "percentage" && Number(form.discountValue) > 100) return setFormError("Percentage cannot exceed 100.");

    setIsSaving(true);
    try {
      const payload = {
        code: form.code.toUpperCase().trim(),
        description: form.description || null,
        discountType: form.discountType,
        discountValue: Number(form.discountValue),
        minOrderAmount: Number(form.minOrderAmount) || 0,
        maxDiscountAmount: form.maxDiscountAmount ? Number(form.maxDiscountAmount) : null,
        usageLimit: form.usageLimit ? Number(form.usageLimit) : null,
        validFrom: toUTCISO(form.validFrom),
        validUntil: toUTCISO(form.validUntil),
        sendNotification: form.sendNotification,
      };

      const res = await fetch("/api/admin/vouchers", {
        method: editingVoucher ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingVoucher ? { id: editingVoucher.id, ...payload } : payload),
      });
      const result = await res.json();
      if (!result.success) throw new Error(result.error);

      showToast(editingVoucher ? "Voucher updated." : `Voucher ${payload.code} created.${form.sendNotification ? " Notification sent." : ""}`);
      setShowModal(false);
      fetchVouchers();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Failed to save voucher.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleActive = async (v: Voucher) => {
    try {
      const res = await fetch("/api/admin/vouchers", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: v.id, isActive: !v.is_active }),
      });
      const result = await res.json();
      if (!result.success) throw new Error(result.error);
      showToast(`Voucher ${v.is_active ? "deactivated" : "activated"}.`);
      fetchVouchers();
    } catch (e) {
      showToast("Failed to update voucher.", false);
    }
  };

  const handleDelete = async (v: Voucher) => {
    if (!confirm(`Delete voucher "${v.code}"? This cannot be undone.`)) return;
    try {
      const res = await fetch("/api/admin/vouchers", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: v.id }),
      });
      const result = await res.json();
      if (!result.success) throw new Error(result.error);
      showToast(result.message || "Voucher deleted.");
      fetchVouchers();
    } catch (e) {
      showToast("Failed to delete voucher.", false);
    }
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 1500);
  };

  const selectCls = "px-3 py-2 border border-[#e8e0d0] bg-white text-[#1c1810] text-sm focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/40 focus:border-[#D4AF37] rounded-sm transition-colors";
  const inputCls = "w-full px-3 py-2 border border-[#e8e0d0] bg-white text-[#1c1810] text-sm focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/40 focus:border-[#D4AF37] rounded-sm transition-colors placeholder-[#b0a080]";

  return (
    <>
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded shadow-lg text-sm font-medium transition-all ${toast.ok ? "bg-green-600 text-white" : "bg-red-600 text-white"}`}>
          {toast.msg}
        </div>
      )}

      <div className="space-y-5">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-[#1c1810]">Vouchers & Promos</h1>
            <span className="inline-flex items-center justify-center h-6 min-w-[24px] px-2 bg-[#D4AF37]/12 border border-[#D4AF37]/30 rounded-full">
              <span className="text-xs text-[#8B6914] font-bold">{stats.total}</span>
            </span>
          </div>
          <button
            onClick={openCreate}
            className="px-4 py-2 bg-[#D4AF37] text-[#1c1810] font-semibold text-sm hover:bg-[#C4A030] transition-colors rounded-sm flex items-center gap-2 shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Create Voucher
          </button>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-[#faf8f3] border border-[#e8e0d0] p-4">
            <p className="text-sm text-[#7a6a4a]">Total Vouchers</p>
            <p className="text-2xl font-bold text-[#d4af37]">{stats.total}</p>
          </div>
          <div className="bg-[#faf8f3] border border-[#e8e0d0] p-4">
            <p className="text-sm text-[#7a6a4a]">Active</p>
            <p className="text-2xl font-bold text-green-600">{stats.active}</p>
          </div>
          <div className="bg-[#faf8f3] border border-[#e8e0d0] p-4">
            <p className="text-sm text-[#7a6a4a]">Expired</p>
            <p className="text-2xl font-bold text-red-500">{stats.expired}</p>
          </div>
          <div className="bg-[#faf8f3] border border-[#e8e0d0] p-4">
            <p className="text-sm text-[#7a6a4a]">Total Redeemed</p>
            <p className="text-2xl font-bold text-purple-600">{stats.totalRedeemed}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 min-w-[200px] sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9a8a6a] w-4 h-4" />
            <input
              type="text"
              placeholder="Search code..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={`${inputCls} pl-9`}
            />
          </div>
          <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }} className={selectCls}>
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="expired">Expired</option>
          </select>
          <button onClick={fetchVouchers} className="p-2 border border-[#e8e0d0] rounded-sm hover:bg-[#faf8f3] text-[#7a6a4a] transition-colors">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {/* Table */}
        <div className="bg-white border border-[#e8e0d0] rounded-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#faf8f3] border-b border-[#e8e0d0]">
                  <th className="px-5 py-3 text-left text-xs font-semibold text-[#7a6a4a] uppercase tracking-wide">Code</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-[#7a6a4a] uppercase tracking-wide">Discount</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-[#7a6a4a] uppercase tracking-wide">Min Order</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-[#7a6a4a] uppercase tracking-wide">Usage</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-[#7a6a4a] uppercase tracking-wide">Validity</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-[#7a6a4a] uppercase tracking-wide">Status</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-[#7a6a4a] uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f0ebe0]">
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}>
                      {Array.from({ length: 7 }).map((_, j) => (
                        <td key={j} className="px-5 py-4">
                          <div className="animate-pulse bg-[#D4AF37]/10 h-4 rounded w-24" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : error ? (
                  <tr><td colSpan={7} className="px-5 py-8 text-center text-red-500">{error}</td></tr>
                ) : vouchers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-12 text-center">
                      <Ticket className="w-10 h-10 text-[#D4AF37]/30 mx-auto mb-2" />
                      <p className="text-[#7a6a4a] text-sm">No vouchers found</p>
                      <button onClick={openCreate} className="mt-3 text-xs text-[#8B6914] underline">Create your first voucher</button>
                    </td>
                  </tr>
                ) : (
                  vouchers.map((v) => {
                    const badge = getStatusBadge(v);
                    return (
                      <tr key={v.id} className="hover:bg-[#faf8f3] transition-colors">
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-semibold text-[#1c1810] tracking-wider">{v.code}</span>
                            <button
                              onClick={() => copyCode(v.code)}
                              className="p-1 rounded hover:bg-[#D4AF37]/10 text-[#9a8a6a] hover:text-[#8B6914] transition-colors"
                              title="Copy code"
                            >
                              {copiedCode === v.code ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                          {v.description && <p className="text-xs text-[#9a8a6a] mt-0.5 max-w-[180px] truncate">{v.description}</p>}
                        </td>
                        <td className="px-5 py-3.5">
                          <span className="font-semibold text-[#1c1810]">
                            {v.discount_type === "percentage" ? `${v.discount_value}%` : formatCurrency(v.discount_value)}
                          </span>
                          <span className="text-xs text-[#9a8a6a] ml-1">{v.discount_type === "percentage" ? "off" : "flat"}</span>
                          {v.max_discount_amount != null && (
                            <p className="text-xs text-[#9a8a6a]">max {formatCurrency(v.max_discount_amount)}</p>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-sm text-[#1c1810]">
                          {v.min_order_amount > 0 ? formatCurrency(v.min_order_amount) : <span className="text-[#9a8a6a]">None</span>}
                        </td>
                        <td className="px-5 py-3.5">
                          <span className="text-sm text-[#1c1810]">{v.used_count}</span>
                          {v.usage_limit != null && (
                            <span className="text-xs text-[#9a8a6a]"> / {v.usage_limit}</span>
                          )}
                          {v.usage_limit == null && <span className="text-xs text-[#9a8a6a]"> uses</span>}
                        </td>
                        <td className="px-5 py-3.5 text-xs text-[#7a6a4a]">
                          <div>{v.valid_from ? `From ${formatDate(v.valid_from)}` : <span className="text-[#b0a080]">No start</span>}</div>
                          <div>{v.valid_until ? `Until ${formatDate(v.valid_until)}` : <span className="text-[#b0a080]">No expiry</span>}</div>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${badge.cls}`}>{badge.label}</span>
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleToggleActive(v)}
                              className="p-1.5 rounded-sm hover:bg-[#D4AF37]/10 text-[#9a8a6a] hover:text-[#8B6914] transition-colors"
                              title={v.is_active ? "Deactivate" : "Activate"}
                            >
                              {v.is_active ? <ToggleRight className="w-4 h-4 text-green-600" /> : <ToggleLeft className="w-4 h-4" />}
                            </button>
                            <button
                              onClick={() => openEdit(v)}
                              className="p-1.5 rounded-sm hover:bg-[#D4AF37]/10 text-[#9a8a6a] hover:text-[#8B6914] transition-colors"
                              title="Edit"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(v)}
                              className="p-1.5 rounded-sm hover:bg-red-50 text-[#9a8a6a] hover:text-red-500 transition-colors"
                              title="Delete"
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
            <div className="px-5 py-4 border-t border-[#e8e0d0] flex items-center justify-between">
              <p className="text-xs text-[#7a6a4a]">Page {currentPage} of {totalPages}</p>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="p-1.5 rounded-sm border border-[#e8e0d0] disabled:opacity-40 hover:bg-[#faf8f3] transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="p-1.5 rounded-sm border border-[#e8e0d0] disabled:opacity-40 hover:bg-[#faf8f3] transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Create / Edit Modal */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setShowModal(false); }}
        >
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto border border-[#e8e0d0]">
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#e8e0d0]">
              <h2 className="text-base font-semibold text-[#1c1810]">
                {editingVoucher ? "Edit Voucher" : "Create Voucher"}
              </h2>
              <button onClick={() => setShowModal(false)} className="p-1.5 rounded hover:bg-[#f2ede4] text-[#7a6a4a] transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {formError && (
                <div className="px-4 py-3 bg-red-50 border border-red-200 text-red-600 text-sm rounded">
                  {formError}
                </div>
              )}

              {/* Code */}
              <div>
                <label className="block text-xs font-semibold text-[#7a6a4a] uppercase tracking-wide mb-1.5">Voucher Code</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={form.code}
                    onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
                    placeholder="e.g. SUMMER20"
                    className={`${inputCls} font-mono`}
                    disabled={!!editingVoucher}
                  />
                  {!editingVoucher && (
                    <button
                      onClick={() => setForm((f) => ({ ...f, code: generateCode() }))}
                      className="px-3 py-2 border border-[#e8e0d0] rounded-sm text-xs text-[#7a6a4a] hover:bg-[#faf8f3] transition-colors whitespace-nowrap"
                      title="Auto-generate code"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-semibold text-[#7a6a4a] uppercase tracking-wide mb-1.5">Description <span className="text-[#b0a080] font-normal normal-case">(optional)</span></label>
                <input
                  type="text"
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="e.g. Summer sale 20% off"
                  className={inputCls}
                />
              </div>

              {/* Discount Type + Value */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#7a6a4a] uppercase tracking-wide mb-1.5">Discount Type</label>
                  <select
                    value={form.discountType}
                    onChange={(e) => setForm((f) => ({ ...f, discountType: e.target.value as "percentage" | "fixed" }))}
                    className={`${inputCls} bg-white`}
                  >
                    <option value="percentage">Percentage (%)</option>
                    <option value="fixed">Fixed Amount (₱)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#7a6a4a] uppercase tracking-wide mb-1.5">
                    {form.discountType === "percentage" ? "Percentage" : "Amount (₱)"}
                  </label>
                  <input
                    type="number"
                    min="0"
                    max={form.discountType === "percentage" ? "100" : undefined}
                    value={form.discountValue}
                    onChange={(e) => setForm((f) => ({ ...f, discountValue: e.target.value }))}
                    placeholder={form.discountType === "percentage" ? "e.g. 20" : "e.g. 100"}
                    className={inputCls}
                  />
                </div>
              </div>

              {/* Min Order / Max Discount */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#7a6a4a] uppercase tracking-wide mb-1.5">Min Order (₱) <span className="text-[#b0a080] font-normal normal-case">(optional)</span></label>
                  <input
                    type="number"
                    min="0"
                    value={form.minOrderAmount}
                    onChange={(e) => setForm((f) => ({ ...f, minOrderAmount: e.target.value }))}
                    placeholder="e.g. 500"
                    className={inputCls}
                  />
                </div>
                {form.discountType === "percentage" && (
                  <div>
                    <label className="block text-xs font-semibold text-[#7a6a4a] uppercase tracking-wide mb-1.5">Max Discount (₱) <span className="text-[#b0a080] font-normal normal-case">(optional)</span></label>
                    <input
                      type="number"
                      min="0"
                      value={form.maxDiscountAmount}
                      onChange={(e) => setForm((f) => ({ ...f, maxDiscountAmount: e.target.value }))}
                      placeholder="e.g. 200"
                      className={inputCls}
                    />
                  </div>
                )}
              </div>

              {/* Usage Limit */}
              <div>
                <label className="block text-xs font-semibold text-[#7a6a4a] uppercase tracking-wide mb-1.5">Usage Limit <span className="text-[#b0a080] font-normal normal-case">(leave blank for unlimited)</span></label>
                <input
                  type="number"
                  min="1"
                  value={form.usageLimit}
                  onChange={(e) => setForm((f) => ({ ...f, usageLimit: e.target.value }))}
                  placeholder="e.g. 100"
                  className={inputCls}
                />
              </div>

              {/* Validity */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#7a6a4a] uppercase tracking-wide mb-1.5">Valid From <span className="text-[#b0a080] font-normal normal-case">(optional)</span></label>
                  <input
                    type="datetime-local"
                    value={form.validFrom}
                    onChange={(e) => setForm((f) => ({ ...f, validFrom: e.target.value }))}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#7a6a4a] uppercase tracking-wide mb-1.5">Valid Until <span className="text-[#b0a080] font-normal normal-case">(optional)</span></label>
                  <input
                    type="datetime-local"
                    value={form.validUntil}
                    onChange={(e) => setForm((f) => ({ ...f, validUntil: e.target.value }))}
                    className={inputCls}
                  />
                </div>
              </div>

              {/* Send Notification (create only) */}
              {!editingVoucher && (
                <label className="flex items-start gap-3 p-3 bg-[#faf8f3] border border-[#e8e0d0] rounded cursor-pointer hover:bg-[#f2ede4] transition-colors">
                  <input
                    type="checkbox"
                    checked={form.sendNotification}
                    onChange={(e) => setForm((f) => ({ ...f, sendNotification: e.target.checked }))}
                    className="mt-0.5 accent-[#D4AF37]"
                  />
                  <div>
                    <div className="flex items-center gap-1.5 text-sm font-medium text-[#1c1810]">
                      <Bell className="w-3.5 h-3.5 text-[#8B6914]" />
                      Send notification to all users
                    </div>
                    <p className="text-xs text-[#7a6a4a] mt-0.5">Sends a promotion notification with the voucher code to all customers and admins immediately.</p>
                  </div>
                </label>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2.5 border border-[#e8e0d0] text-sm text-[#7a6a4a] rounded-sm hover:bg-[#faf8f3] transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="flex-1 px-4 py-2.5 bg-[#D4AF37] text-[#1c1810] font-semibold text-sm rounded-sm hover:bg-[#C4A030] transition-colors disabled:opacity-60"
                >
                  {isSaving ? "Saving..." : editingVoucher ? "Save Changes" : "Create Voucher"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
