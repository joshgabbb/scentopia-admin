"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Archive,
  RotateCcw,
  Search,
  ChevronLeft,
  ChevronRight,
  User,
  Mail,
  Phone,
  Calendar,
  ShoppingBag,
  DollarSign,
  ArrowLeft,
  Loader2,
  AlertCircle,
  RefreshCw,
  CheckCircle
} from "lucide-react";
import Link from "next/link";

interface ArchivedUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  isArchived: boolean;
  archivedAt: string | null;
  createdAt: string | null;
  orderCount: number;
  totalSpent: number;
  lastOrderDate: string | null;
}

export default function ArchivedUsersPage() {
  const [users, setUsers] = useState<ArchivedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const fetchArchivedUsers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        page: currentPage.toString(),
        search: searchQuery,
        archived_only: 'true'
      });

      const response = await fetch(`/api/admin/users?${params}`);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "Failed to fetch archived users");
      }

      setUsers(data.data.users);
      setTotalPages(data.data.totalPages);
      setTotalCount(data.data.totalCount);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }, [currentPage, searchQuery]);

  useEffect(() => {
    fetchArchivedUsers();
  }, [fetchArchivedUsers]);

  const handleRestore = async (userId: string, userName: string) => {
    if (!confirm(`Are you sure you want to restore ${userName}? They will be moved back to active users.`)) {
      return;
    }

    try {
      setRestoringId(userId);

      const response = await fetch(`/api/admin/users?id=${userId}&action=restore`, {
        method: "DELETE"
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "Failed to restore user");
      }

      setSuccessMessage(`${userName} has been restored successfully`);
      setTimeout(() => setSuccessMessage(null), 3000);

      fetchArchivedUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to restore user");
    } finally {
      setRestoringId(null);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric"
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD"
    }).format(amount);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/admin/users"
            className="p-2 rounded-lg bg-[#faf8f3] border border-[#2a2a2a] hover:border-[#d4af37]/50 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-[#1c1810]" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-[#1c1810]">Archived Users</h1>
            <p className="text-[#a0a0a0] text-sm mt-1">
              {totalCount} archived {totalCount === 1 ? "user" : "users"}
            </p>
          </div>
        </div>
        <button
          onClick={() => fetchArchivedUsers()}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#faf8f3] border border-[#2a2a2a] hover:border-[#d4af37]/50 text-[#1c1810] transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Success Message */}
      <AnimatePresence>
        {successMessage && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex items-center gap-3 p-4 rounded-lg bg-green-500/10 border border-green-500/30"
          >
            <CheckCircle className="w-5 h-5 text-green-500" />
            <span className="text-green-500">{successMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#a0a0a0]" />
        <input
          type="text"
          placeholder="Search archived users by name, email, or phone..."
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setCurrentPage(1);
          }}
          className="w-full pl-10 pr-4 py-3 rounded-lg bg-[#faf8f3] border border-[#2a2a2a] text-[#1c1810] placeholder-[#a0a0a0] focus:outline-none focus:border-[#d4af37]/50 transition-colors"
        />
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-[#d4af37] animate-spin" />
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
          <p className="text-red-500 mb-4">{error}</p>
          <button
            onClick={() => fetchArchivedUsers()}
            className="px-4 py-2 rounded-lg bg-[#d4af37] text-[#0a0a0a] font-medium hover:bg-[#b8972e] transition-colors"
          >
            Try Again
          </button>
        </div>
      ) : users.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Archive className="w-16 h-16 text-[#2a2a2a] mb-4" />
          <h3 className="text-lg font-medium text-[#1c1810] mb-2">No Archived Users</h3>
          <p className="text-[#a0a0a0]">
            {searchQuery
              ? "No archived users match your search criteria."
              : "Users that are archived will appear here."}
          </p>
          <Link
            href="/admin/users"
            className="mt-4 px-4 py-2 rounded-lg bg-[#d4af37] text-[#0a0a0a] font-medium hover:bg-[#b8972e] transition-colors"
          >
            Back to Active Users
          </Link>
        </div>
      ) : (
        <>
          {/* Users Table */}
          <div className="bg-[#faf8f3] border border-[#2a2a2a] rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#2a2a2a]">
                    <th className="text-left px-6 py-4 text-sm font-medium text-[#a0a0a0]">User</th>
                    <th className="text-left px-6 py-4 text-sm font-medium text-[#a0a0a0]">Contact</th>
                    <th className="text-left px-6 py-4 text-sm font-medium text-[#a0a0a0]">Orders</th>
                    <th className="text-left px-6 py-4 text-sm font-medium text-[#a0a0a0]">Total Spent</th>
                    <th className="text-left px-6 py-4 text-sm font-medium text-[#a0a0a0]">Archived Date</th>
                    <th className="text-right px-6 py-4 text-sm font-medium text-[#a0a0a0]">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user, index) => (
                    <motion.tr
                      key={user.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="border-b border-[#2a2a2a] last:border-0 hover:bg-white/50 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-[#2a2a2a] flex items-center justify-center">
                            <User className="w-5 h-5 text-[#a0a0a0]" />
                          </div>
                          <div>
                            <p className="text-[#1c1810] font-medium">
                              {user.firstName} {user.lastName}
                            </p>
                            <p className="text-[#a0a0a0] text-sm">ID: {user.id.substring(0, 8)}...</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-sm">
                            <Mail className="w-4 h-4 text-[#a0a0a0]" />
                            <span className="text-[#1c1810]">{user.email || "N/A"}</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm">
                            <Phone className="w-4 h-4 text-[#a0a0a0]" />
                            <span className="text-[#a0a0a0]">{user.phone || "N/A"}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <ShoppingBag className="w-4 h-4 text-[#a0a0a0]" />
                          <span className="text-[#1c1810]">{user.orderCount}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <DollarSign className="w-4 h-4 text-[#d4af37]" />
                          <span className="text-[#1c1810]">{formatCurrency(user.totalSpent)}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-sm">
                          <Calendar className="w-4 h-4 text-[#a0a0a0]" />
                          <span className="text-[#a0a0a0]">{formatDate(user.archivedAt)}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex justify-end">
                          <button
                            onClick={() => handleRestore(user.id, `${user.firstName} ${user.lastName}`)}
                            disabled={restoringId === user.id}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#d4af37]/10 border border-[#d4af37]/30 text-[#d4af37] hover:bg-[#d4af37]/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {restoringId === user.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <RotateCcw className="w-4 h-4" />
                            )}
                            Restore
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-[#a0a0a0]">
                Showing {(currentPage - 1) * 25 + 1} to {Math.min(currentPage * 25, totalCount)} of {totalCount} users
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="p-2 rounded-lg bg-[#faf8f3] border border-[#2a2a2a] text-[#1c1810] disabled:opacity-50 disabled:cursor-not-allowed hover:border-[#d4af37]/50 transition-colors"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <span className="px-4 py-2 text-[#1c1810]">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="p-2 rounded-lg bg-[#faf8f3] border border-[#2a2a2a] text-[#1c1810] disabled:opacity-50 disabled:cursor-not-allowed hover:border-[#d4af37]/50 transition-colors"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
