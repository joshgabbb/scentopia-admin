"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Search,
  Edit2,
  Archive,
  Users,
  X,
  Check,
  Loader2,
  AlertCircle,
  Eye,
  ChevronLeft,
  ChevronRight,
  ShoppingBag,
  Mail,
  Phone,
  Calendar,
  DollarSign,
  Package,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  UserCheck,
  UserX,
  UserMinus,
  MoreVertical,
  Filter,
} from "lucide-react";

interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  status: 'active' | 'inactive' | 'suspended';
  isArchived: boolean;
  archivedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  lastLogin: string | null;
  orderCount: number;
  totalSpent: number;
  lastOrderDate: string | null;
}

interface UserDetails {
  user: User;
  stats: {
    orderCount: number;
    totalSpent: number;
    averageOrderValue: number;
    statusBreakdown: Record<string, number>;
  };
  orders: {
    id: string;
    orderNumber: string;
    amount: number;
    status: string;
    createdAt: string;
    itemCount: number;
    items: {
      id: string;
      productName: string;
      quantity: number;
      size: string;
      itemAmount: number;
    }[];
    payment: {
      method: string;
      status: string;
      amount: number;
    } | null;
  }[];
}

const Skeleton = ({ className }: { className?: string }) => (
  <div className={`animate-pulse bg-[#d4af37]/10 rounded ${className}`} />
);

const UserRowSkeleton = () => (
  <tr className="border-b border-[#d4af37]/10">
    <td className="px-6 py-4">
      <div className="flex items-center space-x-3">
        <Skeleton className="h-10 w-10 rounded-full" />
        <div>
          <Skeleton className="h-4 w-32 mb-2" />
          <Skeleton className="h-3 w-40" />
        </div>
      </div>
    </td>
    <td className="px-6 py-4"><Skeleton className="h-4 w-28" /></td>
    <td className="px-6 py-4"><Skeleton className="h-4 w-16" /></td>
    <td className="px-6 py-4"><Skeleton className="h-4 w-20" /></td>
    <td className="px-6 py-4"><Skeleton className="h-6 w-16" /></td>
    <td className="px-6 py-4"><Skeleton className="h-8 w-20" /></td>
  </tr>
);

const formatDate = (dateString: string | null) => {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "Asia/Manila",
    year: "numeric",
  });
};

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
  }).format(amount);
};

const getStatusColor = (status: string) => {
  const statusColors: Record<string, string> = {
    'active': 'bg-green-500/20 text-green-400 border-green-500/30',
    'inactive': 'bg-gray-500/20 text-gray-400 border-gray-500/30',
    'suspended': 'bg-red-500/20 text-red-400 border-red-500/30',
    'Pending': 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    'Processing': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    'Shipped': 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    'Delivered': 'bg-green-500/20 text-green-400 border-green-500/30',
    'Cancelled': 'bg-red-500/20 text-red-400 border-red-500/30',
  };
  return statusColors[status] || 'bg-gray-500/20 text-gray-400 border-gray-500/30';
};

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'active': return <UserCheck className="w-3 h-3" />;
    case 'inactive': return <UserMinus className="w-3 h-3" />;
    case 'suspended': return <UserX className="w-3 h-3" />;
    default: return null;
  }
};

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("created_at");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Modal states
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isArchiveModalOpen, setIsArchiveModalOpen] = useState(false);
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [userDetails, setUserDetails] = useState<UserDetails | null>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [actionMenuOpen, setActionMenuOpen] = useState<string | null>(null);

  // Form states
  const [formFirstName, setFormFirstName] = useState("");
  const [formLastName, setFormLastName] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [newStatus, setNewStatus] = useState<string>("");
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Customer stats for top summary
  const [customerStats, setCustomerStats] = useState({
    totalCustomers: 0,
    totalOrders: 0,
    totalRevenue: 0,
    avgOrderPerCustomer: 0,
  });

  const fetchUsers = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const params = new URLSearchParams();
      params.set('page', currentPage.toString());
      params.set('sort_by', sortBy);
      params.set('sort_order', sortOrder);

      if (searchTerm) {
        params.set('search', searchTerm);
      }

      if (statusFilter !== 'all') {
        params.set('status', statusFilter);
      }

      const response = await fetch(`/api/admin/users?${params}`);
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || "Failed to fetch users");
      }

      setUsers(result.data.users);
      setTotalPages(result.data.totalPages);
      setTotalCount(result.data.totalCount);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error occurred");
      console.error("Users fetch error:", err);
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, searchTerm, sortBy, sortOrder, statusFilter]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter]);

  // Fetch customer stats for summary
  useEffect(() => {
    const fetchCustomerStats = async () => {
      try {
        const response = await fetch('/api/admin/dashboard');
        const result = await response.json();
        if (result.success) {
          const totalCustomers = result.data.stats.totalUsers || 0;
          const totalOrders = result.data.stats.totalOrders || 0;
          const totalRevenue = result.data.stats.revenue || 0;
          setCustomerStats({
            totalCustomers,
            totalOrders,
            totalRevenue,
            avgOrderPerCustomer: totalCustomers > 0 ? totalOrders / totalCustomers : 0,
          });
        }
      } catch (error) {
        console.error('Failed to fetch customer stats:', error);
      }
    };
    fetchCustomerStats();
  }, []);

  // Close action menu when clicking outside
  useEffect(() => {
    const handleClickOutside = () => setActionMenuOpen(null);
    if (actionMenuOpen) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [actionMenuOpen]);

  const fetchUserDetails = async (userId: string) => {
    try {
      setIsLoadingDetails(true);
      const response = await fetch(`/api/admin/users/${userId}`);
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || "Failed to fetch user details");
      }

      setUserDetails(result.data);
    } catch (err) {
      console.error("User details fetch error:", err);
      setFormError(err instanceof Error ? err.message : "Failed to load user details");
    } finally {
      setIsLoadingDetails(false);
    }
  };

  const handleStatusChange = async () => {
    if (!selectedUser || !newStatus) return;

    setIsSubmitting(true);
    setFormError(null);

    try {
      const response = await fetch("/api/admin/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selectedUser.id,
          status: newStatus
        }),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || "Failed to update user status");
      }

      setIsStatusModalOpen(false);
      setSelectedUser(null);
      setNewStatus("");
      fetchUsers();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to update status");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditUser = async () => {
    if (!selectedUser) return;

    setIsSubmitting(true);
    setFormError(null);

    try {
      const response = await fetch("/api/admin/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selectedUser.id,
          firstName: formFirstName.trim(),
          lastName: formLastName.trim(),
          phone: formPhone.trim()
        }),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || "Failed to update user");
      }

      setIsEditModalOpen(false);
      setSelectedUser(null);
      fetchUsers();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to update user");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleArchiveUser = async () => {
    if (!selectedUser) return;

    setIsSubmitting(true);
    setFormError(null);

    try {
      const response = await fetch(`/api/admin/users?id=${selectedUser.id}&action=archive`, {
        method: "DELETE",
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || "Failed to archive user");
      }

      setIsArchiveModalOpen(false);
      setSelectedUser(null);
      fetchUsers();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to archive user");
    } finally {
      setIsSubmitting(false);
    }
  };

  const openViewModal = (user: User) => {
    setSelectedUser(user);
    setUserDetails(null);
    setIsViewModalOpen(true);
    fetchUserDetails(user.id);
  };

  const openEditModal = (user: User) => {
    setSelectedUser(user);
    setFormFirstName(user.firstName);
    setFormLastName(user.lastName);
    setFormPhone(user.phone);
    setFormError(null);
    setIsEditModalOpen(true);
    setActionMenuOpen(null);
  };

  const openArchiveModal = (user: User) => {
    setSelectedUser(user);
    setFormError(null);
    setIsArchiveModalOpen(true);
    setActionMenuOpen(null);
  };

  const openStatusModal = (user: User, status: string) => {
    setSelectedUser(user);
    setNewStatus(status);
    setFormError(null);
    setIsStatusModalOpen(true);
    setActionMenuOpen(null);
  };

  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('desc');
    }
  };

  const getSortIcon = (column: string) => {
    if (sortBy !== column) return <ArrowUpDown className="w-4 h-4" />;
    return sortOrder === 'asc' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />;
  };

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <div className="text-red-500 text-lg mb-2">Error loading users</div>
          <div className="text-[#7a6a4a] text-sm">{error}</div>
          <button
            onClick={fetchUsers}
            className="mt-4 px-4 py-2 bg-black text-white hover:bg-[#d4af37]/90 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <h1 className="text-2xl font-bold text-[#1c1810]">Client Users</h1>
            <div className="h-5 px-2 bg-[#d4af37]/10 rounded-full flex items-center justify-center">
              <span className="text-xs text-[#7a6a4a] font-semibold">
                {totalCount}
              </span>
            </div>
          </div>
        </div>

        {/* Customer Stats Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-[#faf8f3] border border-[#e8e0d0] p-4">
            <p className="text-sm text-[#7a6a4a]">Total Customers</p>
            <p className="text-2xl font-bold text-[#d4af37]">{customerStats.totalCustomers.toLocaleString()}</p>
          </div>
          <div className="bg-[#faf8f3] border border-[#e8e0d0] p-4">
            <p className="text-sm text-[#7a6a4a]">Total Orders</p>
            <p className="text-2xl font-bold text-blue-400">{customerStats.totalOrders.toLocaleString()}</p>
          </div>
          <div className="bg-[#faf8f3] border border-[#e8e0d0] p-4">
            <p className="text-sm text-[#7a6a4a]">Total Revenue</p>
            <p className="text-2xl font-bold text-green-400">{formatCurrency(customerStats.totalRevenue)}</p>
          </div>
          <div className="bg-[#faf8f3] border border-[#e8e0d0] p-4">
            <p className="text-sm text-[#7a6a4a]">Avg Order/Customer</p>
            <p className="text-2xl font-bold text-purple-400">{customerStats.avgOrderPerCustomer.toFixed(1)}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          {/* Search */}
          <div className="flex items-center space-x-4 flex-1 max-w-md">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[#7a6a4a] w-4 h-4" />
              <input
                type="text"
                placeholder="Search by name, email, or phone..."
                className="w-full pl-10 pr-4 py-2 border border-[#e8e0d0] bg-[#faf8f3] text-[#1c1810] placeholder-[#b0a080] focus:outline-none focus:ring-2 focus:ring-[#d4af37] focus:border-transparent"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          {/* Filter & Sort Controls */}
          <div className="flex items-center gap-3 flex-wrap">
            {/* Status Filter */}
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-[#7a6a4a]" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 border border-[#e8e0d0] bg-[#faf8f3] text-[#1c1810] focus:outline-none focus:ring-2 focus:ring-[#d4af37] text-sm"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="suspended">Suspended</option>
              </select>
            </div>

            {/* Sort By */}
            <select
              value={sortBy}
              onChange={(e) => {
                setSortBy(e.target.value);
                setSortOrder('desc');
              }}
              className="px-3 py-2 border border-[#e8e0d0] bg-[#faf8f3] text-[#1c1810] focus:outline-none focus:ring-2 focus:ring-[#d4af37] text-sm"
            >
              <option value="created_at">Sort by: Date Created</option>
              <option value="last_login">Sort by: Last Login</option>
              <option value="name">Sort by: Name</option>
              <option value="email">Sort by: Email</option>
            </select>

            {/* Sort Order Toggle */}
            <button
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              className="p-2 border border-[#e8e0d0] bg-[#faf8f3] text-[#7a6a4a] hover:text-[#d4af37] transition-colors"
              title={sortOrder === 'asc' ? 'Ascending' : 'Descending'}
            >
              {sortOrder === 'asc' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="bg-[#faf8f3] border border-[#e8e0d0]">
          <div className="px-6 py-4 border-b border-[#e8e0d0]">
            <h2 className="text-lg font-medium text-[#1c1810]">All Clients</h2>
          </div>

          <div className="overflow-x-auto max-h-[calc(100vh-320px)] overflow-y-auto">
            <table className="w-full">
              <thead className="bg-white border-b border-[#e8e0d0] sticky top-0 z-10">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-[#7a6a4a] uppercase tracking-wider">
                    <button
                      onClick={() => handleSort('name')}
                      className="flex items-center space-x-1 hover:text-[#d4af37] transition-colors"
                    >
                      <span>Customer</span>
                      {getSortIcon('name')}
                    </button>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-[#7a6a4a] uppercase tracking-wider">
                    Contact
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-[#7a6a4a] uppercase tracking-wider">
                    Orders
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-[#7a6a4a] uppercase tracking-wider">
                    Total Spent
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-[#7a6a4a] uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-[#7a6a4a] uppercase tracking-wider">
                    <button
                      onClick={() => handleSort('created_at')}
                      className="flex items-center space-x-1 hover:text-[#d4af37] transition-colors"
                    >
                      <span>Joined</span>
                      {getSortIcon('created_at')}
                    </button>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-[#7a6a4a] uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-[#faf8f3] divide-y divide-[#d4af37]/10">
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, index) => (
                    <UserRowSkeleton key={index} />
                  ))
                ) : users.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-6 py-12 text-center text-[#7a6a4a]"
                    >
                      <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>No users found</p>
                    </td>
                  </tr>
                ) : (
                  users.map((user) => (
                    <tr
                      key={user.id}
                      className="hover:bg-[#d4af37]/5 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-[#d4af37]/10 rounded-full flex items-center justify-center">
                            <span className="text-sm font-semibold text-[#d4af37]">
                              {user.firstName?.charAt(0).toUpperCase() || user.email?.charAt(0).toUpperCase() || '?'}
                            </span>
                          </div>
                          <div>
                            <div className="text-sm font-medium text-[#1c1810]">
                              {user.firstName && user.lastName
                                ? `${user.firstName} ${user.lastName}`
                                : user.firstName || user.lastName || 'Unnamed User'}
                            </div>
                            <div className="text-xs text-[#7a6a4a]">
                              {user.email}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-[#1c1810]">
                          {user.phone || '-'}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-2">
                          <ShoppingBag className="w-4 h-4 text-[#7a6a4a]" />
                          <span className="text-sm text-[#1c1810]">{user.orderCount}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm font-medium text-[#d4af37]">
                          {formatCurrency(user.totalSpent)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded border ${getStatusColor(user.status)}`}>
                          {getStatusIcon(user.status)}
                          {user.status.charAt(0).toUpperCase() + user.status.slice(1)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-[#7a6a4a]">
                        {formatDate(user.createdAt)}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-1">
                          <button
                            onClick={() => openViewModal(user)}
                            className="p-1.5 text-[#7a6a4a] hover:text-[#d4af37] hover:bg-[#d4af37]/10 rounded transition-colors"
                            title="View Details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => openEditModal(user)}
                            className="p-1.5 text-[#7a6a4a] hover:text-[#d4af37] hover:bg-[#d4af37]/10 rounded transition-colors"
                            title="Edit"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>

                          {/* Actions Dropdown */}
                          <div className="relative">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setActionMenuOpen(actionMenuOpen === user.id ? null : user.id);
                              }}
                              className="p-1.5 text-[#7a6a4a] hover:text-[#d4af37] hover:bg-[#d4af37]/10 rounded transition-colors"
                              title="More Actions"
                            >
                              <MoreVertical className="w-4 h-4" />
                            </button>

                            {actionMenuOpen === user.id && (
                              <div className="absolute right-0 mt-1 w-48 bg-[#faf8f3] border border-[#e8e0d0] shadow-xl z-50">
                                <div className="py-1">
                                  {user.status !== 'active' && (
                                    <button
                                      onClick={() => openStatusModal(user, 'active')}
                                      className="w-full px-4 py-2 text-left text-sm text-green-400 hover:bg-[#d4af37]/10 flex items-center gap-2"
                                    >
                                      <UserCheck className="w-4 h-4" />
                                      Activate
                                    </button>
                                  )}
                                  {user.status !== 'inactive' && (
                                    <button
                                      onClick={() => openStatusModal(user, 'inactive')}
                                      className="w-full px-4 py-2 text-left text-sm text-gray-400 hover:bg-[#d4af37]/10 flex items-center gap-2"
                                    >
                                      <UserMinus className="w-4 h-4" />
                                      Deactivate
                                    </button>
                                  )}
                                  {user.status !== 'suspended' && (
                                    <button
                                      onClick={() => openStatusModal(user, 'suspended')}
                                      className="w-full px-4 py-2 text-left text-sm text-orange-400 hover:bg-[#d4af37]/10 flex items-center gap-2"
                                    >
                                      <UserX className="w-4 h-4" />
                                      Suspend
                                    </button>
                                  )}
                                  <div className="border-t border-[#d4af37]/10 my-1"></div>
                                  <button
                                    onClick={() => openArchiveModal(user)}
                                    className="w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-red-500/10 flex items-center gap-2"
                                  >
                                    <Archive className="w-4 h-4" />
                                    Archive
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="px-6 py-4 border-t border-[#e8e0d0] flex items-center justify-between">
              <div className="text-sm text-[#7a6a4a]">
                Showing {((currentPage - 1) * 25) + 1} to {Math.min(currentPage * 25, totalCount)} of {totalCount} users
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="p-2 text-[#7a6a4a] hover:text-[#d4af37] hover:bg-[#d4af37]/10 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <span className="text-sm text-[#1c1810]">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="p-2 text-[#7a6a4a] hover:text-[#d4af37] hover:bg-[#d4af37]/10 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* View User Modal */}
      {isViewModalOpen && selectedUser && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-[#faf8f3] border border-[#e8e0d0] w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="px-6 py-4 border-b border-[#e8e0d0] flex items-center justify-between sticky top-0 bg-[#faf8f3] z-10">
              <h2 className="text-lg font-semibold text-[#d4af37]">Customer Details</h2>
              <button
                onClick={() => {
                  setIsViewModalOpen(false);
                  setSelectedUser(null);
                  setUserDetails(null);
                }}
                className="p-1 text-[#7a6a4a] hover:text-[#1c1810] transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6">
              {isLoadingDetails ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-[#d4af37]" />
                </div>
              ) : userDetails ? (
                <div className="space-y-6">
                  {/* User Info Card */}
                  <div className="bg-white border border-[#e8e0d0] p-6">
                    <div className="flex items-start space-x-4">
                      <div className="w-16 h-16 bg-[#d4af37]/10 rounded-full flex items-center justify-center flex-shrink-0">
                        <span className="text-2xl font-semibold text-[#d4af37]">
                          {userDetails.user.firstName?.charAt(0).toUpperCase() || '?'}
                        </span>
                      </div>
                      <div className="flex-1">
                        <h3 className="text-xl font-semibold text-[#1c1810]">
                          {userDetails.user.firstName} {userDetails.user.lastName}
                        </h3>
                        <div className="mt-2 space-y-1">
                          <div className="flex items-center text-sm text-[#7a6a4a]">
                            <Mail className="w-4 h-4 mr-2" />
                            {userDetails.user.email}
                          </div>
                          {userDetails.user.phone && (
                            <div className="flex items-center text-sm text-[#7a6a4a]">
                              <Phone className="w-4 h-4 mr-2" />
                              {userDetails.user.phone}
                            </div>
                          )}
                        </div>
                      </div>
                      <span className={`px-3 py-1 text-sm font-medium rounded border ${getStatusColor(selectedUser.status)}`}>
                        {selectedUser.status.charAt(0).toUpperCase() + selectedUser.status.slice(1)}
                      </span>
                    </div>
                  </div>

                  {/* Stats Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-white border border-[#e8e0d0] p-4">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-blue-500/10 rounded-full flex items-center justify-center">
                          <ShoppingBag className="w-5 h-5 text-blue-400" />
                        </div>
                        <div>
                          <p className="text-2xl font-bold text-[#1c1810]">{userDetails.stats.orderCount}</p>
                          <p className="text-xs text-[#7a6a4a]">Total Orders</p>
                        </div>
                      </div>
                    </div>
                    <div className="bg-white border border-[#e8e0d0] p-4">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-green-500/10 rounded-full flex items-center justify-center">
                          <DollarSign className="w-5 h-5 text-green-400" />
                        </div>
                        <div>
                          <p className="text-2xl font-bold text-[#1c1810]">{formatCurrency(userDetails.stats.totalSpent)}</p>
                          <p className="text-xs text-[#7a6a4a]">Total Spent</p>
                        </div>
                      </div>
                    </div>
                    <div className="bg-white border border-[#e8e0d0] p-4">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-purple-500/10 rounded-full flex items-center justify-center">
                          <Package className="w-5 h-5 text-purple-400" />
                        </div>
                        <div>
                          <p className="text-2xl font-bold text-[#1c1810]">{formatCurrency(userDetails.stats.averageOrderValue)}</p>
                          <p className="text-xs text-[#7a6a4a]">Avg. Order</p>
                        </div>
                      </div>
                    </div>
                    <div className="bg-white border border-[#e8e0d0] p-4">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-[#d4af37]/10 rounded-full flex items-center justify-center">
                          <Calendar className="w-5 h-5 text-[#d4af37]" />
                        </div>
                        <div>
                          <p className="text-lg font-bold text-[#1c1810]">
                            {userDetails.orders[0]?.createdAt
                              ? formatDate(userDetails.orders[0].createdAt)
                              : 'Never'}
                          </p>
                          <p className="text-xs text-[#7a6a4a]">Last Order</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Order History */}
                  <div>
                    <h4 className="text-lg font-semibold text-[#1c1810] mb-4">Order History</h4>
                    {userDetails.orders.length === 0 ? (
                      <div className="bg-white border border-[#e8e0d0] p-8 text-center">
                        <ShoppingBag className="w-12 h-12 mx-auto mb-4 text-[#7a6a4a] opacity-50" />
                        <p className="text-[#7a6a4a]">No orders yet</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {userDetails.orders.map((order) => (
                          <div
                            key={order.id}
                            className="bg-white border border-[#e8e0d0] p-4"
                          >
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center space-x-3">
                                <span className="font-mono text-[#d4af37]">{order.orderNumber}</span>
                                <span className={`px-2 py-0.5 text-xs font-medium rounded border ${getStatusColor(order.status)}`}>
                                  {order.status}
                                </span>
                              </div>
                              <div className="text-right">
                                <p className="font-semibold text-[#1c1810]">{formatCurrency(order.amount)}</p>
                                <p className="text-xs text-[#7a6a4a]">{formatDate(order.createdAt)}</p>
                              </div>
                            </div>
                            <div className="text-sm text-[#7a6a4a]">
                              {order.itemCount} item{order.itemCount !== 1 ? 's' : ''}: {' '}
                              {order.items.slice(0, 3).map(item => item.productName).join(', ')}
                              {order.items.length > 3 && ` +${order.items.length - 3} more`}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 text-[#7a6a4a]">
                  Failed to load user details
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-[#e8e0d0] flex items-center justify-end">
              <button
                onClick={() => {
                  setIsViewModalOpen(false);
                  setSelectedUser(null);
                  setUserDetails(null);
                }}
                className="px-4 py-2 border border-[#e8e0d0] text-[#1c1810] hover:bg-[#d4af37]/5 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {isEditModalOpen && selectedUser && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-[#faf8f3] border border-[#e8e0d0] w-full max-w-md shadow-2xl">
            <div className="px-6 py-4 border-b border-[#e8e0d0] flex items-center justify-between">
              <h2 className="text-lg font-semibold text-[#d4af37]">Edit Customer</h2>
              <button
                onClick={() => {
                  setIsEditModalOpen(false);
                  setSelectedUser(null);
                }}
                className="p-1 text-[#7a6a4a] hover:text-[#1c1810] transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {formError && (
                <div className="p-3 bg-red-500/20 border border-red-500/30 rounded text-red-400 text-sm">
                  {formError}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-[#1c1810] mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={selectedUser.email}
                  disabled
                  className="w-full px-4 py-2.5 bg-white border border-[#e8e0d0] text-[#7a6a4a] cursor-not-allowed"
                />
                <p className="text-xs text-[#7a6a4a] mt-1">Email cannot be changed</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[#1c1810] mb-2">
                    First Name
                  </label>
                  <input
                    type="text"
                    value={formFirstName}
                    onChange={(e) => setFormFirstName(e.target.value)}
                    placeholder="First name"
                    className="w-full px-4 py-2.5 bg-white border border-[#e8e0d0] text-[#1c1810] placeholder-[#b0a080] focus:outline-none focus:ring-2 focus:ring-[#d4af37] focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#1c1810] mb-2">
                    Last Name
                  </label>
                  <input
                    type="text"
                    value={formLastName}
                    onChange={(e) => setFormLastName(e.target.value)}
                    placeholder="Last name"
                    className="w-full px-4 py-2.5 bg-white border border-[#e8e0d0] text-[#1c1810] placeholder-[#b0a080] focus:outline-none focus:ring-2 focus:ring-[#d4af37] focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-[#1c1810] mb-2">
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={formPhone}
                  onChange={(e) => setFormPhone(e.target.value)}
                  placeholder="+63 912 345 6789"
                  className="w-full px-4 py-2.5 bg-white border border-[#e8e0d0] text-[#1c1810] placeholder-[#b0a080] focus:outline-none focus:ring-2 focus:ring-[#d4af37] focus:border-transparent"
                />
              </div>
            </div>

            <div className="px-6 py-4 border-t border-[#e8e0d0] flex items-center justify-end gap-3">
              <button
                onClick={() => {
                  setIsEditModalOpen(false);
                  setSelectedUser(null);
                }}
                className="px-4 py-2 border border-[#e8e0d0] text-[#1c1810] hover:bg-[#d4af37]/5 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleEditUser}
                disabled={isSubmitting}
                className="px-4 py-2 bg-[#d4af37] text-[#0a0a0a] font-medium hover:bg-[#d4af37]/90 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    Save Changes
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Status Change Modal */}
      {isStatusModalOpen && selectedUser && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-[#faf8f3] border border-[#e8e0d0] w-full max-w-md shadow-2xl">
            <div className="px-6 py-4 border-b border-[#e8e0d0] flex items-center justify-between">
              <h2 className="text-lg font-semibold text-[#d4af37]">Change User Status</h2>
              <button
                onClick={() => {
                  setIsStatusModalOpen(false);
                  setSelectedUser(null);
                  setNewStatus("");
                }}
                className="p-1 text-[#7a6a4a] hover:text-[#1c1810] transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {formError && (
                <div className="p-3 bg-red-500/20 border border-red-500/30 rounded text-red-400 text-sm">
                  {formError}
                </div>
              )}

              <div className="flex items-start space-x-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                  newStatus === 'active' ? 'bg-green-500/20' :
                  newStatus === 'inactive' ? 'bg-gray-500/20' :
                  'bg-red-500/20'
                }`}>
                  {newStatus === 'active' ? <UserCheck className="w-5 h-5 text-green-400" /> :
                   newStatus === 'inactive' ? <UserMinus className="w-5 h-5 text-gray-400" /> :
                   <UserX className="w-5 h-5 text-red-400" />}
                </div>
                <div>
                  <p className="text-[#1c1810]">
                    Are you sure you want to{" "}
                    <span className={`font-semibold ${
                      newStatus === 'active' ? 'text-green-400' :
                      newStatus === 'inactive' ? 'text-gray-400' :
                      'text-red-400'
                    }`}>
                      {newStatus}
                    </span>
                    {" "}the user{" "}
                    <span className="font-semibold text-[#d4af37]">
                      {selectedUser.firstName} {selectedUser.lastName}
                    </span>
                    ?
                  </p>
                  <p className="text-sm text-[#7a6a4a] mt-2">
                    {newStatus === 'active' && "User will be able to access their account and place orders."}
                    {newStatus === 'inactive' && "User will not be able to access their account."}
                    {newStatus === 'suspended' && "User account will be suspended and they will not be able to log in."}
                  </p>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-[#e8e0d0] flex items-center justify-end gap-3">
              <button
                onClick={() => {
                  setIsStatusModalOpen(false);
                  setSelectedUser(null);
                  setNewStatus("");
                }}
                className="px-4 py-2 border border-[#e8e0d0] text-[#1c1810] hover:bg-[#d4af37]/5 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleStatusChange}
                disabled={isSubmitting}
                className={`px-4 py-2 font-medium transition-colors disabled:opacity-50 flex items-center gap-2 ${
                  newStatus === 'active' ? 'bg-green-500 text-white hover:bg-green-600' :
                  newStatus === 'inactive' ? 'bg-gray-500 text-white hover:bg-gray-600' :
                  'bg-red-500 text-white hover:bg-red-600'
                }`}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Updating...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    Confirm
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Archive Confirmation Modal */}
      {isArchiveModalOpen && selectedUser && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-[#faf8f3] border border-[#e8e0d0] w-full max-w-md shadow-2xl">
            <div className="px-6 py-4 border-b border-[#e8e0d0] flex items-center justify-between">
              <h2 className="text-lg font-semibold text-red-400">Archive Customer</h2>
              <button
                onClick={() => {
                  setIsArchiveModalOpen(false);
                  setSelectedUser(null);
                }}
                className="p-1 text-[#7a6a4a] hover:text-[#1c1810] transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {formError && (
                <div className="p-3 bg-red-500/20 border border-red-500/30 rounded text-red-400 text-sm">
                  {formError}
                </div>
              )}

              <div className="flex items-start space-x-3">
                <div className="w-10 h-10 bg-red-500/20 rounded-full flex items-center justify-center flex-shrink-0">
                  <Archive className="w-5 h-5 text-red-400" />
                </div>
                <div>
                  <p className="text-[#1c1810]">
                    Are you sure you want to archive{" "}
                    <span className="font-semibold text-[#d4af37]">
                      {selectedUser.firstName} {selectedUser.lastName}
                    </span>
                    ?
                  </p>
                  <p className="text-sm text-[#7a6a4a] mt-2">
                    This user will be moved to the archived section. You can restore them later if needed.
                  </p>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-[#e8e0d0] flex items-center justify-end gap-3">
              <button
                onClick={() => {
                  setIsArchiveModalOpen(false);
                  setSelectedUser(null);
                }}
                className="px-4 py-2 border border-[#e8e0d0] text-[#1c1810] hover:bg-[#d4af37]/5 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleArchiveUser}
                disabled={isSubmitting}
                className="px-4 py-2 bg-red-500 text-white font-medium hover:bg-red-600 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Archiving...
                  </>
                ) : (
                  <>
                    <Archive className="w-4 h-4" />
                    Archive
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
