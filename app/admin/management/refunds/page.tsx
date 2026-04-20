// app/admin/management/refunds/page.tsx
"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  RotateCcw, RefreshCw, CheckCircle, XCircle, Clock, Eye,
  X, AlertCircle, ChevronLeft, ChevronRight, AlertTriangle, ExternalLink,
} from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";

// ── Types ──────────────────────────────────────────────────────────────────

interface RefundRecord {
  id: string;
  order_id: string;
  user_id: string;
  reason: string;
  description: string | null;
  image_url: string | null;
  video_url: string | null;
  amount: number;
  status: "Pending" | "Approved" | "Declined";
  admin_note: string | null;
  created_at: string;
  updated_at: string;
  expires_at: string | null;
  is_expired: boolean;
  days_until_expiry: number | null;
  orders: {
    id: string;
    amount: number;
    order_status: string;
    email: string | null;
    contact_number: string | null;
  } | null;
  profiles: {
    id: string;
    full_name: string | null;
    email: string | null;
  } | null;
}

type StatusFilter = "All" | "Pending" | "Approved" | "Declined";

// ── Helpers ────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    Pending:  "bg-amber-50 text-amber-700 border border-amber-200",
    Approved: "bg-green-50 text-green-700 border border-green-200",
    Declined: "bg-red-50 text-red-700 border border-red-200",
  };
  return (
    <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${styles[status] ?? "bg-gray-50 text-gray-600 border border-gray-200"}`}>
      {status}
    </span>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-PH", {
    year: "numeric", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit", timeZone: "Asia/Manila",
  });
}

function shortId(id: string) {
  return id.substring(0, 8).toUpperCase();
}

// ── Main Page ──────────────────────────────────────────────────────────────

export default function RefundsPage() {
  const { themeClasses } = useTheme();

  const [refunds, setRefunds]           = useState<RefundRecord[]>([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState<string | null>(null);
  const [filter, setFilter]             = useState<StatusFilter>("All");
  const [selectedRefund, setSelected]   = useState<RefundRecord | null>(null);
  const [actionModal, setActionModal]   = useState<{ refund: RefundRecord; action: "approve" | "decline" } | null>(null);
  const [adminNote, setAdminNote]       = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [toast, setToast]               = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [page, setPage]                 = useState(1);
  const PER_PAGE = 15;

  const showToast = (type: "success" | "error", text: string) => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchRefunds = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = filter !== "All" ? `?status=${filter}` : "";
      const res = await fetch(`/api/admin/refunds${params}`);
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Failed to load refunds");
      setRefunds(data.data || []);
      setPage(1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchRefunds();
  }, [fetchRefunds]);

  const handleAction = async () => {
    if (!actionModal) return;
    if (actionModal.action === "decline" && !adminNote.trim()) {
      showToast("error", "A decline reason is required.");
      return;
    }
    setIsProcessing(true);
    try {
      const res = await fetch("/api/admin/refunds", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          refundId: actionModal.refund.id,
          action: actionModal.action,
          adminNote: adminNote.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Action failed");

      showToast(
        "success",
        actionModal.action === "approve"
          ? `Refund approved — ₱${actionModal.refund.amount.toFixed(2)} credited to wallet`
          : "Refund declined"
      );
      setActionModal(null);
      setAdminNote("");
      setSelected(null);
      fetchRefunds();
    } catch (err) {
      showToast("error", err instanceof Error ? err.message : "Action failed");
    } finally {
      setIsProcessing(false);
    }
  };

  // Counts
  const counts = {
    All:      refunds.length,
    Pending:  refunds.filter(r => r.status === "Pending").length,
    Approved: refunds.filter(r => r.status === "Approved").length,
    Declined: refunds.filter(r => r.status === "Declined").length,
  };
  const totalPendingAmount = refunds
    .filter(r => r.status === "Pending")
    .reduce((s, r) => s + r.amount, 0);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(refunds.length / PER_PAGE));
  const paginated  = refunds.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const filterTabs: StatusFilter[] = ["All", "Pending", "Approved", "Declined"];

  return (
    <div className={`min-h-screen ${themeClasses.bg} transition-colors duration-200`}>
      {/* ── Toast ─────────────────────────────────────────────────────────── */}
      {toast && (
        <div className={`fixed top-4 right-4 z-[9999] flex items-center gap-3 px-4 py-3 rounded-sm shadow-xl border max-w-sm
          ${toast.type === "success"
            ? "bg-green-50 border-green-200 text-green-800"
            : "bg-red-50 border-red-200 text-red-800"}`}>
          {toast.type === "success"
            ? <CheckCircle className="w-4 h-4 flex-shrink-0 text-green-600" />
            : <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-600" />}
          <p className="text-sm font-medium">{toast.text}</p>
        </div>
      )}

      <div className="p-4 lg:p-6 space-y-6">
        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className={`text-2xl font-bold ${themeClasses.accent} uppercase tracking-widest`}>
              Refund Requests
            </h1>
            <p className={`text-sm ${themeClasses.textMuted} mt-1`}>
              Review and process customer refund requests
            </p>
          </div>
          <button
            onClick={fetchRefunds}
            disabled={loading}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border ${themeClasses.border} ${themeClasses.textMuted} hover:${themeClasses.text} rounded-sm transition-colors disabled:opacity-50`}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        {/* ── Summary Cards ───────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Pending",          value: counts.Pending,  sub: `₱${totalPendingAmount.toFixed(2)} awaiting`, color: "amber",  icon: <Clock className="w-5 h-5 text-amber-500" /> },
            { label: "Approved",         value: counts.Approved, sub: "Wallet credited",                            color: "green",  icon: <CheckCircle className="w-5 h-5 text-green-500" /> },
            { label: "Declined",         value: counts.Declined, sub: "Requests declined",                          color: "red",    icon: <XCircle className="w-5 h-5 text-red-500" /> },
            { label: "Total Requests",   value: counts.All,      sub: "All time",                                   color: "gold",   icon: <RotateCcw className="w-5 h-5 text-[#D4AF37]" /> },
          ].map(card => (
            <div key={card.label} className={`${themeClasses.cardBg} border ${themeClasses.border} rounded-sm p-4`}>
              <div className="flex items-center justify-between mb-2">
                <span className={`text-xs font-semibold uppercase tracking-wider ${themeClasses.textMuted}`}>{card.label}</span>
                {card.icon}
              </div>
              <p className={`text-2xl font-bold ${themeClasses.text}`}>{card.value}</p>
              <p className={`text-xs ${themeClasses.textMuted} mt-0.5`}>{card.sub}</p>
            </div>
          ))}
        </div>

        {/* ── Filter Tabs ─────────────────────────────────────────────────── */}
        <div className={`flex gap-1 border-b ${themeClasses.border}`}>
          {filterTabs.map(tab => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px
                ${filter === tab
                  ? `border-[#D4AF37] ${themeClasses.accent}`
                  : `border-transparent ${themeClasses.textMuted} hover:${themeClasses.text}`}`}
            >
              {tab}
              {counts[tab] > 0 && (
                <span className={`ml-2 text-xs px-1.5 py-0.5 rounded-full font-semibold
                  ${tab === "Pending" ? "bg-amber-100 text-amber-700"
                  : tab === "Approved" ? "bg-green-100 text-green-700"
                  : tab === "Declined" ? "bg-red-100 text-red-700"
                  : "bg-[#f2ede4] text-[#7a6a4a]"}`}>
                  {counts[tab]}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── Content ─────────────────────────────────────────────────────── */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <RefreshCw className={`w-8 h-8 animate-spin ${themeClasses.textMuted} opacity-40`} />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <AlertCircle className="w-10 h-10 text-red-400 mb-3" />
            <p className={`text-sm ${themeClasses.text} font-medium`}>{error}</p>
            <button onClick={fetchRefunds} className="mt-3 text-sm text-[#8B6914] hover:underline">Try again</button>
          </div>
        ) : refunds.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <RotateCcw className={`w-10 h-10 ${themeClasses.textMuted} opacity-30 mb-3`} />
            <p className={`text-sm font-medium ${themeClasses.text}`}>No refund requests found</p>
            <p className={`text-xs ${themeClasses.textMuted} mt-1`}>
              {filter !== "All" ? `No ${filter.toLowerCase()} refunds` : "Customers haven't submitted any refund requests yet"}
            </p>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto rounded-sm border border-[#e8e0d0]">
              <table className="w-full">
                <thead>
                  <tr className={`${themeClasses.bgTertiary} border-b ${themeClasses.border}`}>
                    {["Refund ID", "Customer", "Order", "Reason", "Amount", "Status", "Refund Window", "Date", "Actions"].map(h => (
                      <th key={h} className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider ${themeClasses.textMuted}`}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className={`divide-y ${themeClasses.border}`}>
                  {paginated.map(refund => (
                    <tr key={refund.id} className={`${themeClasses.bg} hover:${themeClasses.bgSecondary} transition-colors`}>
                      <td className={`px-4 py-3 text-xs font-mono font-medium ${themeClasses.textMuted}`}>
                        #{shortId(refund.id)}
                      </td>
                      <td className="px-4 py-3">
                        <p className={`text-sm font-medium ${themeClasses.text}`}>
                          {refund.profiles?.full_name || "—"}
                        </p>
                        <p className={`text-xs ${themeClasses.textMuted}`}>
                          {refund.profiles?.email || ""}
                        </p>
                      </td>
                      <td className={`px-4 py-3 text-xs font-mono ${themeClasses.textMuted}`}>
                        #{shortId(refund.order_id)}
                      </td>
                      <td className={`px-4 py-3 text-sm ${themeClasses.text} max-w-[160px]`}>
                        <p className="truncate">{refund.reason}</p>
                      </td>
                      <td className={`px-4 py-3 text-sm font-semibold ${themeClasses.text}`}>
                        ₱{refund.amount.toFixed(2)}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={refund.status} />
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {refund.expires_at ? (
                          refund.is_expired ? (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-200 font-semibold">
                              Expired
                            </span>
                          ) : (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200 font-semibold">
                              {(refund.days_until_expiry ?? 0) <= 0 ? 'Expires today' : `${refund.days_until_expiry}d left`}
                            </span>
                          )
                        ) : (
                          <span className={`text-xs ${themeClasses.textMuted}`}>—</span>
                        )}
                      </td>
                      <td className={`px-4 py-3 text-xs ${themeClasses.textMuted} whitespace-nowrap`}>
                        {formatDate(refund.created_at)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setSelected(refund)}
                            className={`p-1.5 ${themeClasses.textMuted} hover:${themeClasses.text} transition-colors`}
                            title="View details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {refund.status === "Pending" && (
                            <>
                              <button
                                onClick={() => { setActionModal({ refund, action: "approve" }); setAdminNote(""); }}
                                className="p-1.5 text-green-600 hover:text-green-800 transition-colors"
                                title="Approve"
                              >
                                <CheckCircle className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => { setActionModal({ refund, action: "decline" }); setAdminNote(""); }}
                                className="p-1.5 text-red-500 hover:text-red-700 transition-colors"
                                title="Decline"
                              >
                                <XCircle className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden space-y-3">
              {paginated.map(refund => (
                <div key={refund.id} className={`${themeClasses.cardBg} border ${themeClasses.border} rounded-sm p-4`}>
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className={`text-sm font-semibold ${themeClasses.text}`}>
                        {refund.profiles?.full_name || "Customer"}
                      </p>
                      <p className={`text-xs ${themeClasses.textMuted}`}>Order #{shortId(refund.order_id)}</p>
                    </div>
                    <StatusBadge status={refund.status} />
                  </div>
                  <p className={`text-sm ${themeClasses.text} mb-1`}>{refund.reason}</p>
                  <p className={`text-sm font-bold ${themeClasses.accent}`}>₱{refund.amount.toFixed(2)}</p>
                  <p className={`text-xs ${themeClasses.textMuted} mt-1`}>{formatDate(refund.created_at)}</p>
                  <div className="flex items-center gap-3 mt-3 pt-3 border-t border-[#e8e0d0]">
                    <button onClick={() => setSelected(refund)} className={`flex items-center gap-1.5 text-xs ${themeClasses.textMuted} hover:${themeClasses.text}`}>
                      <Eye className="w-3.5 h-3.5" /> View
                    </button>
                    {refund.status === "Pending" && (
                      <>
                        <button
                          onClick={() => { setActionModal({ refund, action: "approve" }); setAdminNote(""); }}
                          className="flex items-center gap-1.5 text-xs text-green-600 hover:text-green-800"
                        >
                          <CheckCircle className="w-3.5 h-3.5" /> Approve
                        </button>
                        <button
                          onClick={() => { setActionModal({ refund, action: "decline" }); setAdminNote(""); }}
                          className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-700"
                        >
                          <XCircle className="w-3.5 h-3.5" /> Decline
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between">
                <p className={`text-xs ${themeClasses.textMuted}`}>
                  Showing {(page - 1) * PER_PAGE + 1}–{Math.min(page * PER_PAGE, refunds.length)} of {refunds.length}
                </p>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className={`p-1.5 rounded ${themeClasses.textMuted} disabled:opacity-30 hover:${themeClasses.text} transition-colors`}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                    .reduce<(number | "...")[]>((acc, p, i, arr) => {
                      if (i > 0 && (p as number) - (arr[i - 1] as number) > 1) acc.push("...");
                      acc.push(p);
                      return acc;
                    }, [])
                    .map((p, i) =>
                      p === "..." ? (
                        <span key={`ellipsis-${i}`} className={`px-2 text-sm ${themeClasses.textMuted}`}>…</span>
                      ) : (
                        <button
                          key={p}
                          onClick={() => setPage(p as number)}
                          className={`w-8 h-8 text-sm rounded transition-colors
                            ${page === p
                              ? "bg-[#D4AF37] text-white font-semibold"
                              : `${themeClasses.textMuted} hover:${themeClasses.text}`}`}
                        >
                          {p}
                        </button>
                      )
                    )}
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className={`p-1.5 rounded ${themeClasses.textMuted} disabled:opacity-30 hover:${themeClasses.text} transition-colors`}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Detail Modal ──────────────────────────────────────────────────── */}
      {selectedRefund && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setSelected(null)}>
          <div
            className={`w-full max-w-lg border ${themeClasses.border} rounded-sm shadow-2xl`}
            style={{ backgroundColor: '#ffffff' }}
            onClick={e => e.stopPropagation()}
          >
            <div className={`flex items-center justify-between px-6 py-4 border-b ${themeClasses.border} bg-white rounded-t-sm`}>
              <h2 className={`text-base font-semibold ${themeClasses.accent} uppercase tracking-wider`}>
                Refund Details
              </h2>
              <button onClick={() => setSelected(null)} className={`${themeClasses.textMuted} hover:${themeClasses.text}`}>
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto bg-white">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className={`text-xs font-semibold uppercase tracking-wider ${themeClasses.textMuted} mb-1`}>Refund ID</p>
                  <p className={`text-sm font-mono ${themeClasses.text}`}>#{shortId(selectedRefund.id)}</p>
                </div>
                <div>
                  <p className={`text-xs font-semibold uppercase tracking-wider ${themeClasses.textMuted} mb-1`}>Order ID</p>
                  <p className={`text-sm font-mono ${themeClasses.text}`}>#{shortId(selectedRefund.order_id)}</p>
                </div>
                <div>
                  <p className={`text-xs font-semibold uppercase tracking-wider ${themeClasses.textMuted} mb-1`}>Customer</p>
                  <p className={`text-sm ${themeClasses.text}`}>{selectedRefund.profiles?.full_name || "—"}</p>
                  <p className={`text-xs ${themeClasses.textMuted}`}>{selectedRefund.profiles?.email || ""}</p>
                </div>
                <div>
                  <p className={`text-xs font-semibold uppercase tracking-wider ${themeClasses.textMuted} mb-1`}>Amount</p>
                  <p className={`text-lg font-bold ${themeClasses.accent}`}>₱{selectedRefund.amount.toFixed(2)}</p>
                </div>
                <div>
                  <p className={`text-xs font-semibold uppercase tracking-wider ${themeClasses.textMuted} mb-1`}>Status</p>
                  <StatusBadge status={selectedRefund.status} />
                </div>
                <div>
                  <p className={`text-xs font-semibold uppercase tracking-wider ${themeClasses.textMuted} mb-1`}>Submitted</p>
                  <p className={`text-sm ${themeClasses.text}`}>{formatDate(selectedRefund.created_at)}</p>
                </div>
                {selectedRefund.expires_at && (
                  <div>
                    <p className={`text-xs font-semibold uppercase tracking-wider ${themeClasses.textMuted} mb-1`}>Refund Window</p>
                    <p className={`text-sm ${selectedRefund.is_expired ? 'text-red-500' : 'text-green-600'}`}>
                      {selectedRefund.is_expired
                        ? `Expired on ${formatDate(selectedRefund.expires_at)}`
                        : `Expires ${formatDate(selectedRefund.expires_at)}`}
                    </p>
                  </div>
                )}
              </div>

              <div>
                <p className={`text-xs font-semibold uppercase tracking-wider ${themeClasses.textMuted} mb-1`}>Reason</p>
                <p className={`text-sm ${themeClasses.text}`}>{selectedRefund.reason}</p>
              </div>

              {selectedRefund.description && (
                <div>
                  <p className={`text-xs font-semibold uppercase tracking-wider ${themeClasses.textMuted} mb-1`}>Description</p>
                  <p className={`text-sm ${themeClasses.text} leading-relaxed`}>{selectedRefund.description}</p>
                </div>
              )}

              <div>
                <p className={`text-xs font-semibold uppercase tracking-wider ${themeClasses.textMuted} mb-2`}>Unboxing Video</p>
                {selectedRefund.video_url ? (
                  <div>
                    {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                    <video
                      src={selectedRefund.video_url}
                      controls
                      className="w-full rounded-sm border border-[#e8e0d0] max-h-64 bg-black"
                    />
                    <a
                      href={selectedRefund.video_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs text-[#8B6914] mt-1 hover:underline"
                    >
                      <ExternalLink size={12} /> Open video in new tab
                    </a>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-sm">
                    <AlertTriangle size={14} className="text-amber-500 shrink-0" />
                    <p className="text-xs text-amber-700">No unboxing video attached — evidence may be insufficient to approve</p>
                  </div>
                )}
              </div>

              {selectedRefund.image_url && (
                <div>
                  <p className={`text-xs font-semibold uppercase tracking-wider ${themeClasses.textMuted} mb-2`}>Attached Photo</p>
                  <a href={selectedRefund.image_url} target="_blank" rel="noopener noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={selectedRefund.image_url}
                      alt="Refund evidence"
                      className="rounded-sm border border-[#e8e0d0] max-h-48 object-contain cursor-pointer hover:opacity-90 transition-opacity"
                    />
                    <span className="flex items-center gap-1 text-xs text-[#8B6914] mt-1 hover:underline">
                      <ExternalLink size={12} /> Open full image
                    </span>
                  </a>
                </div>
              )}

              {selectedRefund.admin_note && (
                <div className={`${themeClasses.bgTertiary} border ${themeClasses.border} rounded-sm p-3`}>
                  <p className={`text-xs font-semibold uppercase tracking-wider ${themeClasses.textMuted} mb-1`}>Admin Note</p>
                  <p className={`text-sm ${themeClasses.text}`}>{selectedRefund.admin_note}</p>
                </div>
              )}
            </div>

            <div className={`flex items-center justify-end gap-3 px-6 py-4 border-t ${themeClasses.border} bg-white`}>
              {selectedRefund.status === "Pending" && (
                <>
                  <button
                    onClick={() => { setActionModal({ refund: selectedRefund, action: "decline" }); setAdminNote(""); setSelected(null); }}
                    className="px-4 py-2 text-sm font-medium text-red-600 border border-red-200 hover:bg-red-50 rounded-sm transition-colors"
                  >
                    Decline
                  </button>
                  <button
                    onClick={() => { setActionModal({ refund: selectedRefund, action: "approve" }); setAdminNote(""); setSelected(null); }}
                    className="px-4 py-2 text-sm font-medium bg-[#D4AF37] text-white hover:bg-[#c49b28] rounded-sm transition-colors"
                  >
                    Approve Refund
                  </button>
                </>
              )}
              {selectedRefund.status !== "Pending" && (
                <button
                  onClick={() => setSelected(null)}
                  className={`px-4 py-2 text-sm font-medium border ${themeClasses.border} ${themeClasses.textMuted} hover:${themeClasses.text} rounded-sm transition-colors`}
                >
                  Close
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Approve / Decline Confirmation Modal ──────────────────────────── */}
      {actionModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setActionModal(null)}>
          <div
            className={`w-full max-w-md border ${themeClasses.border} rounded-sm shadow-2xl`}
            style={{ backgroundColor: '#ffffff' }}
            onClick={e => e.stopPropagation()}
          >
            <div className={`flex items-center justify-between px-6 py-4 border-b ${themeClasses.border} bg-white rounded-t-sm`}>
              <h2 className={`text-base font-semibold uppercase tracking-wider
                ${actionModal.action === "approve" ? "text-green-700" : "text-red-600"}`}>
                {actionModal.action === "approve" ? "Approve Refund" : "Decline Refund"}
              </h2>
              <button onClick={() => setActionModal(null)} className={`${themeClasses.textMuted} hover:${themeClasses.text}`}>
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4 bg-white">
              <div className={`${themeClasses.bgTertiary} border ${themeClasses.border} rounded-sm p-4`}>
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-xs font-semibold uppercase tracking-wider ${themeClasses.textMuted}`}>
                    {actionModal.refund.profiles?.full_name || "Customer"}
                  </span>
                  <span className={`text-base font-bold ${themeClasses.accent}`}>
                    ₱{actionModal.refund.amount.toFixed(2)}
                  </span>
                </div>
                <p className={`text-sm ${themeClasses.text}`}>{actionModal.refund.reason}</p>
              </div>

              {actionModal.action === "approve" && (
                <p className={`text-sm ${themeClasses.textMuted}`}>
                  This will credit <strong className={themeClasses.text}>₱{actionModal.refund.amount.toFixed(2)}</strong> to the customer&apos;s wallet immediately.
                </p>
              )}

              <div>
                <label className={`block text-xs font-semibold uppercase tracking-wider ${themeClasses.textMuted} mb-1.5`}>
                  {actionModal.action === "decline"
                    ? <span>Decline Reason <span className="normal-case font-normal text-red-500">(required)</span></span>
                    : <span>Admin Note <span className="normal-case font-normal">(optional)</span></span>
                  }
                </label>
                <textarea
                  value={adminNote}
                  onChange={e => setAdminNote(e.target.value)}
                  placeholder={actionModal.action === "approve"
                    ? "e.g. Refund approved after review"
                    : "e.g. Item was not defective based on submitted evidence"}
                  rows={3}
                  className={`w-full px-3 py-2 text-sm ${themeClasses.inputBg} border ${
                    actionModal.action === "decline" && !adminNote.trim()
                      ? "border-red-300 focus:ring-red-400 focus:border-red-400"
                      : `${themeClasses.border} focus:ring-[#D4AF37] focus:border-[#D4AF37]`
                  } ${themeClasses.text} rounded-sm resize-none focus:outline-none focus:ring-1 placeholder:${themeClasses.textMuted}`}
                />
                {actionModal.action === "decline" && !adminNote.trim() && (
                  <p className="text-xs text-red-500 mt-1">This reason will be included in the email sent to the customer.</p>
                )}
              </div>
            </div>

            <div className={`flex items-center justify-end gap-3 px-6 py-4 border-t ${themeClasses.border} bg-white rounded-b-sm`}>
              <button
                onClick={() => setActionModal(null)}
                disabled={isProcessing}
                className={`px-4 py-2 text-sm font-medium border ${themeClasses.border} ${themeClasses.textMuted} hover:${themeClasses.text} rounded-sm transition-colors disabled:opacity-50`}
              >
                Cancel
              </button>
              <button
                onClick={handleAction}
                disabled={isProcessing || (actionModal.action === "decline" && !adminNote.trim())}
                className={`px-4 py-2 text-sm font-medium rounded-sm transition-colors disabled:opacity-50 flex items-center gap-2
                  ${actionModal.action === "approve"
                    ? "bg-[#D4AF37] text-white hover:bg-[#c49b28]"
                    : "bg-red-600 text-white hover:bg-red-700"}`}
              >
                {isProcessing && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                {isProcessing
                  ? "Processing..."
                  : actionModal.action === "approve"
                  ? "Approve & Credit Wallet"
                  : "Decline Refund"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
