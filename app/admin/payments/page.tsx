// app/admin/payments/page.tsx
"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  CreditCard, Wallet, TrendingUp, Download, RefreshCw,
  ChevronLeft, ChevronRight, CheckCircle, AlertCircle, Plus, X,
  Smartphone, Globe,
} from "lucide-react";
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { useTheme } from "@/contexts/ThemeContext";

// ── Types ───────────────────────────────────────────────────────────────────

interface PaymentRecord {
  id: string;
  paymentMethod: string;
  amount: number;
  status: string;
  currency: string;
  createdAt: string;
  orderId: string;
  orderNumber: string;
  orderStatus: string;
  customerName: string;
  customerEmail: string;
}

interface PaymentSummary {
  totalCollected: number;
  byMethod: Record<string, number>;
  onlineCollected: number;
  totalCashedOut: number;
  uncashedOnline: number;
}

interface PaymentsData {
  payments: PaymentRecord[];
  summary: PaymentSummary;
  totalCount: number;
  totalPages: number;
  currentPage: number;
}

interface CashoutRecord {
  id: string;
  method: string;
  amount: number;
  note: string | null;
  cashed_out_at: string;
}

type MethodFilter = "all" | "gcash" | "paypal" | "wallet" | "paymaya" | "card";
type StatusFilter = "all" | "paid" | "completed" | "successful" | "pending" | "failed";

// ── Helpers ─────────────────────────────────────────────────────────────────

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(amount);

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-PH", {
    year: "numeric", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit", timeZone: "Asia/Manila",
  });

const METHOD_LABELS: Record<string, string> = {
  gcash: "GCash",
  paypal: "PayPal",
  wallet: "Wallet",
  paymaya: "Maya",
  card: "Card",
};

const METHOD_COLORS: Record<string, string> = {
  gcash: "#0070f3",
  paypal: "#003087",
  wallet: "#D4AF37",
  paymaya: "#00b14f",
  card: "#6366f1",
};

function MethodBadge({ method }: { method: string }) {
  const m = method.toLowerCase();
  const label = METHOD_LABELS[m] || method.toUpperCase();
  const color = METHOD_COLORS[m] || "#7a6a4a";
  return (
    <span
      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold text-white"
      style={{ backgroundColor: color }}
    >
      {label}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const s = (status || "").toLowerCase();
  const styles: Record<string, string> = {
    paid:       "bg-green-500/20 text-green-400 border border-green-500/30",
    completed:  "bg-green-500/20 text-green-400 border border-green-500/30",
    successful: "bg-green-500/20 text-green-400 border border-green-500/30",
    pending:    "bg-amber-500/20 text-amber-400 border border-amber-500/30",
    failed:     "bg-red-500/20 text-red-400 border border-red-500/30",
  };
  return (
    <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${styles[s] ?? "bg-[#D4AF37]/10 text-[#D4AF37] border border-[#D4AF37]/30"}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

// ── Summary Card ─────────────────────────────────────────────────────────────

function SummaryCard({
  label, value, sub, icon: Icon, accent,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ComponentType<{ className?: string }>;
  accent?: string;
}) {
  const { themeClasses } = useTheme();
  return (
    <div className={`${themeClasses.cardBg} border ${themeClasses.border} rounded-sm p-5 flex items-start gap-4 shadow-sm`}>
      <div className={`p-2.5 rounded-sm ${accent ?? "bg-[#D4AF37]/10"}`}>
        <Icon className={`w-5 h-5 ${accent ? "text-white" : "text-[#D4AF37]"}`} />
      </div>
      <div>
        <p className={`text-xs ${themeClasses.textMuted} uppercase tracking-wide font-semibold`}>{label}</p>
        <p className={`text-xl font-bold ${themeClasses.text} mt-0.5`}>{value}</p>
        {sub && <p className={`text-xs ${themeClasses.textMuted} mt-0.5`}>{sub}</p>}
      </div>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function PaymentsPage() {
  const { themeClasses, isDark } = useTheme();

  const [data, setData] = useState<PaymentsData | null>(null);
  const [cashouts, setCashouts] = useState<CashoutRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Filters
  const [methodFilter, setMethodFilter] = useState<MethodFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);

  // Cashout modal
  const [showCashoutModal, setShowCashoutModal] = useState(false);
  const [cashoutForm, setCashoutForm] = useState({
    method: "gcash",
    amount: "",
    note: "",
    cashed_out_at: new Date().toISOString().slice(0, 16),
  });
  const [submitting, setSubmitting] = useState(false);

  const showToast = (type: "success" | "error", text: string) => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchPayments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page) });
      if (methodFilter !== "all") params.set("method", methodFilter);
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (dateFrom) params.set("date_from", dateFrom);
      if (dateTo) params.set("date_to", dateTo);

      const res = await fetch(`/api/admin/payments?${params}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Failed to load payments");
      setData(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [page, methodFilter, statusFilter, dateFrom, dateTo]);

  const fetchCashouts = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/payments/cashouts");
      const json = await res.json();
      if (json.success) setCashouts(json.data || []);
    } catch { /* silent */ }
  }, []);

  useEffect(() => { fetchPayments(); }, [fetchPayments]);
  useEffect(() => { fetchCashouts(); }, [fetchCashouts]);

  const handleCashoutSubmit = async () => {
    if (!cashoutForm.amount || Number(cashoutForm.amount) <= 0) {
      showToast("error", "Enter a valid amount.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/payments/cashouts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          method: cashoutForm.method,
          amount: Number(cashoutForm.amount),
          note: cashoutForm.note || null,
          cashed_out_at: cashoutForm.cashed_out_at
            ? new Date(cashoutForm.cashed_out_at).toISOString()
            : new Date().toISOString(),
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Failed to record cashout");
      showToast("success", "Cashout recorded successfully.");
      setShowCashoutModal(false);
      setCashoutForm({ method: "gcash", amount: "", note: "", cashed_out_at: new Date().toISOString().slice(0, 16) });
      fetchCashouts();
      fetchPayments();
    } catch (err) {
      showToast("error", err instanceof Error ? err.message : "Failed to record cashout");
    } finally {
      setSubmitting(false);
    }
  };

  const exportCSV = () => {
    if (!data?.payments.length) return;
    const headers = ["Date", "Order #", "Customer", "Email", "Method", "Amount", "Status", "Order Status"];
    const rows = data.payments.map((p) => [
      formatDate(p.createdAt),
      p.orderNumber,
      p.customerName,
      p.customerEmail,
      p.paymentMethod,
      p.amount.toFixed(2),
      p.status,
      p.orderStatus,
    ]);
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `payments-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const summary = data?.summary;

  const chartData = summary
    ? Object.entries(summary.byMethod).map(([key, val]) => ({
        name: METHOD_LABELS[key] || key,
        amount: val,
        fill: METHOD_COLORS[key] || "#D4AF37",
      }))
    : [];

  const methodTabs: { value: MethodFilter; label: string }[] = [
    { value: "all", label: "All" },
    { value: "gcash", label: "GCash" },
    { value: "paypal", label: "PayPal" },
    { value: "wallet", label: "Wallet" },
    { value: "paymaya", label: "Maya" },
    { value: "card", label: "Card" },
  ];

  const chartTickColor = isDark ? "#9a8a68" : "#7a6a4a";
  const chartGridColor = isDark ? "#2e2a1e" : "#f0ebe0";
  const chartTooltipStyle = {
    border: `1px solid ${isDark ? "#2e2a1e" : "#e8e0d0"}`,
    borderRadius: 4,
    fontSize: 12,
    backgroundColor: isDark ? "#1c1a14" : "#ffffff",
    color: isDark ? "#f0e8d8" : "#1c1810",
  };

  const inputClass = `text-xs border ${themeClasses.border} rounded-sm px-2 py-1.5 ${themeClasses.textMuted} ${themeClasses.inputBg} focus:outline-none focus:border-[#D4AF37]`;

  return (
    <div className={`min-h-screen ${themeClasses.bg} transition-colors duration-200`}>
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-[9999] flex items-center gap-3 px-4 py-3 rounded-sm shadow-xl border max-w-sm
          ${toast.type === "success" ? "bg-green-50 border-green-200 text-green-800" : "bg-red-50 border-red-200 text-red-800"}`}>
          {toast.type === "success"
            ? <CheckCircle className="w-4 h-4 flex-shrink-0 text-green-600" />
            : <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-600" />}
          <p className="text-sm font-medium">{toast.text}</p>
        </div>
      )}

      <div className="p-6 max-w-[1400px] mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className={`text-2xl font-bold ${themeClasses.text} tracking-wide`}>Payments</h1>
            <p className={`text-sm ${themeClasses.textMuted} mt-1`}>Track customer payments and record bank cashouts</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { fetchPayments(); fetchCashouts(); }}
              className={`p-2 ${themeClasses.textMuted} ${themeClasses.hoverBg} rounded-sm transition-colors`}
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={exportCSV}
              disabled={!data?.payments.length}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm border ${themeClasses.border} ${themeClasses.textMuted} ${themeClasses.hoverBg} rounded-sm transition-colors disabled:opacity-40`}
            >
              <Download className="w-3.5 h-3.5" /> Export CSV
            </button>
            <button
              onClick={() => setShowCashoutModal(true)}
              className="flex items-center gap-1.5 px-4 py-2 text-sm bg-[#D4AF37] hover:bg-[#c49b2a] text-white rounded-sm font-semibold transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> Record Cashout
            </button>
          </div>
        </div>

        {/* Summary Cards */}
        {summary && (
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
            <SummaryCard
              label="Total Revenue"
              value={formatCurrency(summary.totalCollected)}
              sub="All completed payments"
              icon={TrendingUp}
            />
            <SummaryCard
              label="Online Collected"
              value={formatCurrency(summary.onlineCollected)}
              sub="GCash + PayPal + Maya + Card"
              icon={Globe}
              accent="bg-blue-600"
            />
            <SummaryCard
              label="Wallet"
              value={formatCurrency(summary.byMethod.wallet || 0)}
              sub="Internal wallet payments"
              icon={Wallet}
              accent="bg-[#D4AF37]"
            />
            <SummaryCard
              label="Total Cashed Out"
              value={formatCurrency(summary.totalCashedOut)}
              sub="Recorded bank transfers"
              icon={CreditCard}
              accent="bg-green-600"
            />
            <SummaryCard
              label="Net Uncashed"
              value={formatCurrency(summary.uncashedOnline)}
              sub="Online balance to withdraw"
              icon={Smartphone}
              accent={summary.uncashedOnline > 0 ? "bg-amber-500" : "bg-gray-500"}
            />
          </div>
        )}

        {/* Charts */}
        {summary && chartData.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
            <div className={`${themeClasses.cardBg} border ${themeClasses.border} rounded-sm p-5 shadow-sm`}>
              <h3 className={`text-sm font-bold ${themeClasses.text} uppercase tracking-wide mb-4`}>Revenue by Method</h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={chartData} margin={{ top: 0, right: 10, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={chartGridColor} />
                  <XAxis dataKey="name" tick={{ fontSize: 12, fill: chartTickColor }} />
                  <YAxis tick={{ fontSize: 11, fill: chartTickColor }} tickFormatter={(v) => `₱${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: number) => [formatCurrency(v), "Amount"]} contentStyle={chartTooltipStyle} />
                  <Bar dataKey="amount" radius={[3, 3, 0, 0]}>
                    {chartData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className={`${themeClasses.cardBg} border ${themeClasses.border} rounded-sm p-5 shadow-sm`}>
              <h3 className={`text-sm font-bold ${themeClasses.text} uppercase tracking-wide mb-4`}>Payment Split</h3>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={chartData.filter((d) => d.amount > 0)}
                    dataKey="amount"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {chartData.filter((d) => d.amount > 0).map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={chartTooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Payments Table */}
        <div className={`${themeClasses.cardBg} border ${themeClasses.border} rounded-sm shadow-sm mb-6`}>
          <div className={`px-6 pt-5 pb-4 border-b ${themeClasses.border}`}>
            <h2 className={`text-sm font-bold ${themeClasses.text} uppercase tracking-wide mb-3`}>Payment Transactions</h2>
            <div className="flex flex-wrap gap-2 items-center">
              {/* Method tabs */}
              <div className={`flex gap-1 ${themeClasses.bg} border ${themeClasses.border} rounded-sm p-1`}>
                {methodTabs.map((tab) => (
                  <button
                    key={tab.value}
                    onClick={() => { setMethodFilter(tab.value); setPage(1); }}
                    className={`px-3 py-1 text-xs font-semibold rounded-sm transition-colors ${
                      methodFilter === tab.value
                        ? "bg-[#D4AF37] text-white"
                        : `${themeClasses.textMuted} ${themeClasses.hoverBg}`
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Status filter */}
              <select
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value as StatusFilter); setPage(1); }}
                className={inputClass}
              >
                <option value="all">All Statuses</option>
                <option value="paid">Paid</option>
                <option value="completed">Completed</option>
                <option value="pending">Pending</option>
                <option value="failed">Failed</option>
              </select>

              {/* Date range */}
              <input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} className={inputClass} />
              <span className={`${themeClasses.textMuted} text-xs`}>to</span>
              <input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} className={inputClass} />

              {(dateFrom || dateTo || methodFilter !== "all" || statusFilter !== "all") && (
                <button
                  onClick={() => { setMethodFilter("all"); setStatusFilter("all"); setDateFrom(""); setDateTo(""); setPage(1); }}
                  className={`text-xs ${themeClasses.textMuted} hover:text-red-500 flex items-center gap-1`}
                >
                  <X className="w-3 h-3" /> Clear
                </button>
              )}
            </div>
          </div>

          {/* Table */}
          {loading ? (
            <div className={`flex items-center justify-center py-16 ${themeClasses.textMuted} text-sm`}>Loading payments…</div>
          ) : error ? (
            <div className="flex items-center justify-center py-16 text-red-500 text-sm">{error}</div>
          ) : !data?.payments.length ? (
            <div className={`flex items-center justify-center py-16 ${themeClasses.textMuted} text-sm`}>No payments found.</div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className={`border-b ${themeClasses.border} ${themeClasses.bgSecondary}`}>
                      <th className={`px-5 py-3 text-left text-xs font-bold ${themeClasses.textMuted} uppercase tracking-wide`}>Date</th>
                      <th className={`px-5 py-3 text-left text-xs font-bold ${themeClasses.textMuted} uppercase tracking-wide`}>Order</th>
                      <th className={`px-5 py-3 text-left text-xs font-bold ${themeClasses.textMuted} uppercase tracking-wide`}>Customer</th>
                      <th className={`px-5 py-3 text-left text-xs font-bold ${themeClasses.textMuted} uppercase tracking-wide`}>Method</th>
                      <th className={`px-5 py-3 text-right text-xs font-bold ${themeClasses.textMuted} uppercase tracking-wide`}>Amount</th>
                      <th className={`px-5 py-3 text-left text-xs font-bold ${themeClasses.textMuted} uppercase tracking-wide`}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.payments.map((p, i) => (
                      <tr key={p.id} className={`border-b ${themeClasses.border} ${themeClasses.hoverBg} transition-colors ${i % 2 !== 0 ? themeClasses.bgSecondary : ""}`}>
                        <td className={`px-5 py-3.5 text-xs ${themeClasses.textMuted} whitespace-nowrap`}>{formatDate(p.createdAt)}</td>
                        <td className={`px-5 py-3.5 text-xs font-mono font-semibold ${themeClasses.accent}`}>{p.orderNumber}</td>
                        <td className="px-5 py-3.5">
                          <p className={`text-xs font-semibold ${themeClasses.text}`}>{p.customerName}</p>
                          <p className={`text-xs ${themeClasses.textMuted}`}>{p.customerEmail}</p>
                        </td>
                        <td className="px-5 py-3.5"><MethodBadge method={p.paymentMethod} /></td>
                        <td className={`px-5 py-3.5 text-right font-semibold ${themeClasses.text} text-sm`}>{formatCurrency(p.amount)}</td>
                        <td className="px-5 py-3.5"><StatusBadge status={p.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {data.totalPages > 1 && (
                <div className={`flex items-center justify-between px-5 py-3.5 border-t ${themeClasses.border}`}>
                  <p className={`text-xs ${themeClasses.textMuted}`}>
                    {data.totalCount} payments · Page {data.currentPage} of {data.totalPages}
                  </p>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className={`p-1.5 ${themeClasses.textMuted} ${themeClasses.hoverBg} rounded-sm disabled:opacity-30`}
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    {Array.from({ length: Math.min(5, data.totalPages) }, (_, i) => {
                      const p = Math.max(1, Math.min(data.totalPages - 4, page - 2)) + i;
                      return (
                        <button
                          key={p}
                          onClick={() => setPage(p)}
                          className={`w-7 h-7 text-xs rounded-sm font-semibold transition-colors ${
                            page === p ? "bg-[#D4AF37] text-white" : `${themeClasses.textMuted} ${themeClasses.hoverBg}`
                          }`}
                        >
                          {p}
                        </button>
                      );
                    })}
                    <button
                      onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
                      disabled={page === data.totalPages}
                      className={`p-1.5 ${themeClasses.textMuted} ${themeClasses.hoverBg} rounded-sm disabled:opacity-30`}
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Cashout Log */}
        <div className={`${themeClasses.cardBg} border ${themeClasses.border} rounded-sm shadow-sm`}>
          <div className={`px-6 py-5 border-b ${themeClasses.border} flex items-center justify-between`}>
            <div>
              <h2 className={`text-sm font-bold ${themeClasses.text} uppercase tracking-wide`}>Cashout Log</h2>
              <p className={`text-xs ${themeClasses.textMuted} mt-0.5`}>Records of online balance withdrawals to bank</p>
            </div>
            <button
              onClick={() => setShowCashoutModal(true)}
              className="flex items-center gap-1.5 px-3 py-2 text-xs bg-[#D4AF37] hover:bg-[#c49b2a] text-white rounded-sm font-semibold transition-colors"
            >
              <Plus className="w-3 h-3" /> Record Cashout
            </button>
          </div>

          {cashouts.length === 0 ? (
            <div className={`flex flex-col items-center justify-center py-12 ${themeClasses.textMuted} text-sm`}>
              <CreditCard className="w-8 h-8 mb-2 opacity-30" />
              No cashouts recorded yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className={`border-b ${themeClasses.border} ${themeClasses.bgSecondary}`}>
                    <th className={`px-5 py-3 text-left text-xs font-bold ${themeClasses.textMuted} uppercase tracking-wide`}>Date</th>
                    <th className={`px-5 py-3 text-left text-xs font-bold ${themeClasses.textMuted} uppercase tracking-wide`}>Method</th>
                    <th className={`px-5 py-3 text-right text-xs font-bold ${themeClasses.textMuted} uppercase tracking-wide`}>Amount</th>
                    <th className={`px-5 py-3 text-left text-xs font-bold ${themeClasses.textMuted} uppercase tracking-wide`}>Note</th>
                  </tr>
                </thead>
                <tbody>
                  {cashouts.map((c, i) => (
                    <tr key={c.id} className={`border-b ${themeClasses.border} ${themeClasses.hoverBg} ${i % 2 !== 0 ? themeClasses.bgSecondary : ""}`}>
                      <td className={`px-5 py-3.5 text-xs ${themeClasses.textMuted} whitespace-nowrap`}>{formatDate(c.cashed_out_at)}</td>
                      <td className="px-5 py-3.5"><MethodBadge method={c.method} /></td>
                      <td className={`px-5 py-3.5 text-right font-semibold ${themeClasses.text}`}>{formatCurrency(c.amount)}</td>
                      <td className={`px-5 py-3.5 text-xs ${themeClasses.textMuted}`}>{c.note || "—"}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className={`border-t-2 border-[#D4AF37]/30 ${themeClasses.bgSecondary}`}>
                    <td className={`px-5 py-3 text-xs font-bold ${themeClasses.textMuted} uppercase`} colSpan={2}>Total Cashed Out</td>
                    <td className={`px-5 py-3 text-right font-bold ${themeClasses.text}`}>
                      {formatCurrency(cashouts.reduce((s, c) => s + Number(c.amount), 0))}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Cashout Modal */}
      {showCashoutModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className={`${themeClasses.bg} rounded-sm shadow-2xl w-full max-w-md border ${themeClasses.border}`}>
            <div className={`flex items-center justify-between px-6 py-5 border-b ${themeClasses.border} ${themeClasses.bgSecondary}`}>
              <h3 className={`font-bold ${themeClasses.text} text-sm uppercase tracking-wide`}>Record Cashout</h3>
              <button onClick={() => setShowCashoutModal(false)} className={`p-1.5 ${themeClasses.textMuted} ${themeClasses.hoverBg} rounded-sm`}>
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className={`text-xs ${themeClasses.textMuted}`}>Log when you transfer your online payment balance to your bank account.</p>

              <div>
                <label className={`block text-xs font-semibold ${themeClasses.text} mb-1.5 uppercase tracking-wide`}>Payment Method</label>
                <select
                  value={cashoutForm.method}
                  onChange={(e) => setCashoutForm((f) => ({ ...f, method: e.target.value }))}
                  className={`w-full border ${themeClasses.border} rounded-sm px-3 py-2 text-sm ${themeClasses.text} ${themeClasses.inputBg} focus:outline-none focus:border-[#D4AF37]`}
                >
                  <option value="gcash">GCash</option>
                  <option value="paypal">PayPal</option>
                  <option value="wallet">Scentopia Wallet</option>
                  <option value="paymaya">Maya</option>
                  <option value="card">Card</option>
                </select>
              </div>

              <div>
                <label className={`block text-xs font-semibold ${themeClasses.text} mb-1.5 uppercase tracking-wide`}>Amount (₱)</label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  placeholder="0.00"
                  value={cashoutForm.amount}
                  onChange={(e) => setCashoutForm((f) => ({ ...f, amount: e.target.value }))}
                  className={`w-full border ${themeClasses.border} rounded-sm px-3 py-2 text-sm ${themeClasses.text} ${themeClasses.inputBg} focus:outline-none focus:border-[#D4AF37]`}
                />
              </div>

              <div>
                <label className={`block text-xs font-semibold ${themeClasses.text} mb-1.5 uppercase tracking-wide`}>Date & Time</label>
                <input
                  type="datetime-local"
                  value={cashoutForm.cashed_out_at}
                  onChange={(e) => setCashoutForm((f) => ({ ...f, cashed_out_at: e.target.value }))}
                  className={`w-full border ${themeClasses.border} rounded-sm px-3 py-2 text-sm ${themeClasses.text} ${themeClasses.inputBg} focus:outline-none focus:border-[#D4AF37]`}
                />
              </div>

              <div>
                <label className={`block text-xs font-semibold ${themeClasses.text} mb-1.5 uppercase tracking-wide`}>Note (optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Transferred to BPI account"
                  value={cashoutForm.note}
                  onChange={(e) => setCashoutForm((f) => ({ ...f, note: e.target.value }))}
                  className={`w-full border ${themeClasses.border} rounded-sm px-3 py-2 text-sm ${themeClasses.text} ${themeClasses.inputBg} focus:outline-none focus:border-[#D4AF37]`}
                />
              </div>
            </div>
            <div className={`flex gap-3 px-6 pb-6`}>
              <button
                onClick={() => setShowCashoutModal(false)}
                className={`flex-1 py-2 text-sm border ${themeClasses.border} ${themeClasses.textMuted} ${themeClasses.hoverBg} rounded-sm transition-colors font-semibold`}
              >
                Cancel
              </button>
              <button
                onClick={handleCashoutSubmit}
                disabled={submitting}
                className="flex-1 py-2 text-sm bg-[#D4AF37] hover:bg-[#c49b2a] text-white rounded-sm font-semibold transition-colors disabled:opacity-50"
              >
                {submitting ? "Saving…" : "Record Cashout"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
