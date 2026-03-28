

// app/admin/orders/page.tsx
"use client";

import React, { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  Search,
  Filter,
  ArrowUpDown,
  FileText,
  FileSpreadsheet,
  Edit,
  MoreHorizontal,
  Download,
  Plus,
  Eye,
  X,
  Package,
} from "lucide-react";
import OrderDetails from "./order-details";
import { exportReport, createOrdersExportConfig, type ExportFormat } from "@/lib/export-utils";
import { createClient } from "@/lib/supabase/client";

// [Keep all the interfaces the same - PaymentInfo, OrderItem, Order, OrdersData]
interface PaymentInfo {
  paymentId: string;
  paymentMethod: string;
  paymentStatus: string;
  paymentAmount: number;
  currency: string;
  paymentCreatedAt: string;
  paymentMetadata?: any;
}

interface OrderItem {
  quantity: number;
  itemAmount: number;
  size?: string;
  productName: string;
}

interface Order {
  id: string;
  customerName: string;
  customerEmail: string;
  amount: number;
  voucherCode?: string | null;
  discountAmount?: number;
  originalAmount?: number | null;
  status: "Pending" | "Processing" | "To Ship" | "Shipped" | "Delivered" | "Cancelled";
  createdAt: string;
  orderNumber: string;
  itemCount: number;
  payment: PaymentInfo | null;
  items: OrderItem[];
}

interface OrdersData {
  orders: Order[];
  totalCount: number;
  totalPages: number;
  currentPage: number;
}

// BLACK & GOLD Skeleton components
const Skeleton = ({ className }: { className?: string }) => (
  <div className={`animate-pulse bg-[#d4af37]/10 rounded ${className}`} />
);

const OrderRowSkeleton = () => (
  <tr className="border-b border-[#d4af37]/10">
    <td className="px-6 py-4"><Skeleton className="w-4 h-4" /></td>
    <td className="px-6 py-4"><Skeleton className="h-4 w-20" /></td>
    <td className="px-6 py-4"><Skeleton className="h-4 w-32" /></td>
    <td className="px-6 py-4"><Skeleton className="h-4 w-16" /></td>
    <td className="px-6 py-4"><Skeleton className="h-6 w-20" /></td>
    <td className="px-6 py-4"><Skeleton className="h-6 w-16" /></td>
    <td className="px-6 py-4"><Skeleton className="h-6 w-16" /></td>
    <td className="px-6 py-4"><Skeleton className="h-4 w-16" /></td>
    <td className="px-6 py-4"><Skeleton className="w-8 h-8" /></td>
  </tr>
);

// Utility functions
const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
  }).format(amount);
};

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "Asia/Manila",
  });
};

// BLACK & GOLD Status Colors
const getStatusColor = (status: string) => {
  switch (status) {
    case "Pending":
      return "bg-yellow-900/20 text-yellow-400 border border-yellow-400/30";
    case "Processing":
      return "bg-blue-900/20 text-blue-400 border border-blue-400/30";
    case "To Ship":
      return "bg-amber-900/20 text-amber-500 border border-amber-500/30";
    case "Shipped":
      return "bg-purple-900/20 text-purple-400 border border-purple-400/30";
    case "Delivered":
      return "bg-green-900/20 text-green-400 border border-green-400/30";
    case "Cancelled":
      return "bg-red-900/20 text-red-400 border border-red-400/30";
    case "Paid":
    case "completed":
      return "bg-green-900/20 text-green-400 border border-green-400/30";
    case "Unpaid":
      return "bg-red-900/20 text-red-400 border border-red-400/30";
    case "refunded":
      return "bg-[#d4af37]/10 text-[#d4af37] border border-[#d4af37]/30";
    default:
      return "bg-[#d4af37]/10 text-[#7a6a4a] border border-[#d4af37]/30";
  }
};

const getFulfillmentStatus = (orderStatus: string) => {
  switch (orderStatus?.toLowerCase()) {
    case "delivered":
      return { status: "FULFILLED", color: "bg-green-900/20 text-green-400 border border-green-400/30" };
    case "shipped":
      return { status: "PARTIALLY FULFILLED", color: "bg-blue-900/20 text-blue-400 border border-blue-400/30" };
    case "processing":
      return { status: "PROCESSING", color: "bg-yellow-900/20 text-yellow-400 border border-yellow-400/30" };
    case "cancelled":
      return { status: "CANCELLED", color: "bg-red-900/20 text-red-400 border border-red-400/30" };
    default:
      return { status: "UNFULFILLED", color: "bg-[#d4af37]/10 text-[#7a6a4a] border border-[#d4af37]/30" };
  }
};

const getSortFieldMapping = (field: string): string => {
  switch (field) {
    case "payment_status":
      return "payments.status";
    case "customer_name":
      return "profiles.first_name";
    case "created_at":
      return "orders.created_at";
    case "amount":
      return "orders.amount";
    default:
      return field;
  }
};

function OrdersContent() {
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(true);
  const [data, setData] = useState<OrdersData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState(() => searchParams.get('search') || "");
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [sortBy, setSortBy] = useState<string>("created_at");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<string>("all");
  const [appliedDateFrom, setAppliedDateFrom] = useState(() => searchParams.get('from') || "");
  const [appliedDateTo, setAppliedDateTo] = useState(() => searchParams.get('to') || "");
  const [source, setSource] = useState<'app' | 'store'>(() =>
    searchParams.get('source') === 'store' ? 'store' : 'app'
  );
  const [posTransactions, setPosTransactions] = useState<any[]>([]);
  const [posLoading, setPosLoading] = useState(false);
  const [posTotalCount, setPosTotalCount] = useState(0);
  const [posTotalPages, setPosTotalPages] = useState(1);
  const [posCurrentPage, setPosCurrentPage] = useState(1);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isLoadingOrder, setIsLoadingOrder] = useState(false);
  const [previewOrder, setPreviewOrder] = useState<Order | null>(null);
  // NEW: Add these states for modals and actions
  const [showSummary, setShowSummary] = useState(false);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [showBulkEditModal, setShowBulkEditModal] = useState(false);
  const [showCreateOrderModal, setShowCreateOrderModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
const [exportOptions, setExportOptions] = useState({
  dateFrom: '',
  dateTo: '',
  exportType: 'all', // 'all', 'selected', 'daterange'
  format: 'csv' as ExportFormat
});

  const [tempFilters, setTempFilters] = useState({
    status: statusFilter,
    paymentStatus: paymentStatusFilter,
    minAmount: '',
    maxAmount: '',
    dateFrom: searchParams.get('from') || '',
    dateTo: searchParams.get('to') || ''
  });

  const [bulkAction, setBulkAction] = useState({
    updateStatus: '',
    updatePaymentStatus: ''
  });

  const [newOrder, setNewOrder] = useState({
    customerEmail: '',
    customerName: '',
    amount: '',
    status: 'Pending',
    paymentMethod: 'gcash',
    paymentStatus: 'pending'
  });

  // Stats for top summary
  const [orderStats, setOrderStats] = useState({
    totalOrders: 0,
    completed: 0,
    pending: 0,
    totalRevenue: 0,
  });

  const fetchOrderDetails = async (orderId: string) => {
    try {
      setIsLoadingOrder(true);
      const response = await fetch(`/api/admin/orders/${orderId}`);
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || "Failed to fetch order details");
      }

      setSelectedOrder(result.data);
    } catch (err) {
      console.error("Order details fetch error:", err);
    } finally {
      setIsLoadingOrder(false);
    }
  };

  const handleOrderClick = (order: Order) => {
    fetchOrderDetails(order.id);
  };

  const handleBackToList = () => {
    setSelectedOrder(null);
  };

  const fetchOrders = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const mappedSortBy = getSortFieldMapping(sortBy);

      const params = new URLSearchParams({
        page: currentPage.toString(),
        search: searchTerm,
        sort_by: mappedSortBy,
        sort_order: sortOrder,
        status: statusFilter,
        payment_status: paymentStatusFilter,
      });
      if (appliedDateFrom) params.append('date_from', appliedDateFrom);
      if (appliedDateTo) params.append('date_to', appliedDateTo);

      const response = await fetch(`/api/admin/orders?${params}`);
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || "Failed to fetch orders");
      }

      setData(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error occurred");
      console.error("Orders fetch error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [currentPage, sortBy, sortOrder, statusFilter, paymentStatusFilter, appliedDateFrom, appliedDateTo]);

  // Keep a ref to the latest fetchOrders so the realtime callback is never stale
  const fetchOrdersRef = useRef(fetchOrders);
  useEffect(() => { fetchOrdersRef.current = fetchOrders; });

  // Realtime subscription + 30-second polling for live order updates
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel('admin-orders-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        fetchOrdersRef.current();
      })
      .subscribe();

    const interval = setInterval(() => {
      fetchOrdersRef.current();
    }, 30000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, []);

  const fetchPosTransactions = async () => {
    setPosLoading(true);
    try {
      const params = new URLSearchParams({ page: posCurrentPage.toString() });
      if (appliedDateFrom) params.append('date_from', appliedDateFrom);
      if (appliedDateTo) params.append('date_to', appliedDateTo);
      const res = await fetch(`/api/admin/pos-transactions?${params}`);
      const result = await res.json();
      if (result.success) {
        setPosTransactions(result.data.transactions);
        setPosTotalCount(result.data.totalCount);
        setPosTotalPages(result.data.totalPages);
      }
    } catch {
      // silent
    } finally {
      setPosLoading(false);
    }
  };

  useEffect(() => {
    if (source === 'store') fetchPosTransactions();
  }, [source, posCurrentPage, appliedDateFrom, appliedDateTo]);

  // Fetch order stats for summary
  useEffect(() => {
    const fetchOrderStats = async () => {
      try {
        // Fetch order status counts
        const ordersResponse = await fetch('/api/admin/orders?page=1&status=all&payment_status=all');
        const ordersResult = await ordersResponse.json();

        const dashboardResponse = await fetch('/api/admin/dashboard');
        const dashboardResult = await dashboardResponse.json();

        if (dashboardResult.success) {
          // Calculate completed and pending from recent orders or use dashboard stats
          const allOrders = ordersResult.data?.orders || [];
          const completed = allOrders.filter((o: any) => o.status === 'Delivered').length;
          const pending = allOrders.filter((o: any) => o.status === 'Pending' || o.status === 'Processing').length;

          setOrderStats({
            totalOrders: dashboardResult.data.stats.totalOrders || 0,
            completed: completed,
            pending: pending,
            totalRevenue: dashboardResult.data.stats.revenue || 0,
          });
        }
      } catch (error) {
        console.error('Failed to fetch order stats:', error);
      }
    };
    fetchOrderStats();
  }, []);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (currentPage !== 1) {
        setCurrentPage(1);
      } else {
        fetchOrders();
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [searchTerm]);

  const handleSelectAll = () => {
    if (!data) return;

    if (selectedOrders.size === data.orders.length) {
      setSelectedOrders(new Set());
    } else {
      setSelectedOrders(new Set(data.orders.map((order) => order.id)));
    }
  };

  const handleSelectOrder = (orderId: string) => {
    const newSelected = new Set(selectedOrders);
    if (newSelected.has(orderId)) {
      newSelected.delete(orderId);
    } else {
      newSelected.add(orderId);
    }
    setSelectedOrders(newSelected);
  };

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setSortOrder("desc");
    }
  };

  // ============================================
  // NEW FUNCTIONS - START
  // ============================================

  // 1. EXPORT FUNCTION
  // EXPORT FUNCTION WITH DATE RANGE
const handleExport = () => {
  setShowExportModal(true);
};

const executeExport = () => {
  let ordersToExport = data?.orders || [];

  // Filter based on export type
  if (exportOptions.exportType === 'selected') {
    if (selectedOrders.size === 0) {
      alert('No orders selected');
      return;
    }
    ordersToExport = ordersToExport.filter(order => selectedOrders.has(order.id));
  } else if (exportOptions.exportType === 'daterange') {
    if (!exportOptions.dateFrom || !exportOptions.dateTo) {
      alert('Please select both start and end dates');
      return;
    }

    const fromDate = new Date(exportOptions.dateFrom);
    const toDate = new Date(exportOptions.dateTo);
    toDate.setHours(23, 59, 59, 999);

    ordersToExport = ordersToExport.filter(order => {
      const orderDate = new Date(order.createdAt);
      return orderDate >= fromDate && orderDate <= toDate;
    });
  }

  if (ordersToExport.length === 0) {
    alert('No orders found to export');
    return;
  }

  // Create export config with date range if applicable
  const dateRange = exportOptions.exportType === 'daterange' && exportOptions.dateFrom && exportOptions.dateTo
    ? { from: exportOptions.dateFrom, to: exportOptions.dateTo }
    : undefined;

  const exportConfig = createOrdersExportConfig(ordersToExport, dateRange);

  // Custom filename based on export type
  if (exportOptions.exportType === 'selected') {
    exportConfig.filename = `orders_selected_${selectedOrders.size}`;
    exportConfig.subtitle = `Selected orders export (${selectedOrders.size} orders)`;
  } else if (exportOptions.exportType === 'daterange') {
    exportConfig.filename = `orders_${exportOptions.dateFrom}_to_${exportOptions.dateTo}`;
  }

  // Export using the utility
  exportReport(exportConfig, exportOptions.format);

  // Close modal and reset
  setShowExportModal(false);
  setExportOptions({
    dateFrom: '',
    dateTo: '',
    exportType: 'all',
    format: 'csv'
  });

  alert(`Successfully exported ${ordersToExport.length} order(s) as ${exportOptions.format.toUpperCase()}!`);
};

  // 2. SUMMARY CALCULATOR
  const calculateSummary = () => {
    if (!data?.orders) return null;

    const orders = selectedOrders.size > 0 
      ? data.orders.filter(order => selectedOrders.has(order.id))
      : data.orders;

    const totalRevenue = orders.reduce((sum, order) => sum + order.amount, 0);
    const totalItems = orders.reduce((sum, order) => sum + order.itemCount, 0);
    const averageOrderValue = totalRevenue / orders.length || 0;

    const statusBreakdown = orders.reduce((acc, order) => {
      acc[order.status] = (acc[order.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const paymentBreakdown = orders.reduce((acc, order) => {
      const status = order.payment?.paymentStatus || 'N/A';
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalOrders: orders.length,
      totalRevenue,
      totalItems,
      averageOrderValue,
      statusBreakdown,
      paymentBreakdown
    };
  };

  // 3. FILTER FUNCTIONS
  const applyFilters = () => {
    setStatusFilter(tempFilters.status);
    setPaymentStatusFilter(tempFilters.paymentStatus);
    setAppliedDateFrom(tempFilters.dateFrom);
    setAppliedDateTo(tempFilters.dateTo);
    setShowFilterModal(false);
  };

  const resetFilters = () => {
    setTempFilters({
      status: 'all',
      paymentStatus: 'all',
      minAmount: '',
      maxAmount: '',
      dateFrom: '',
      dateTo: ''
    });
    setStatusFilter('all');
    setPaymentStatusFilter('all');
    setAppliedDateFrom('');
    setAppliedDateTo('');
    setShowFilterModal(false);
  };

  // 4. BULK EDIT FUNCTION
  const handleBulkEdit = async () => {
    if (selectedOrders.size === 0) {
      alert('Please select orders to edit');
      return;
    }

    const confirmed = confirm(`Update ${selectedOrders.size} selected order(s)?`);
    if (!confirmed) return;

    try {
      const updates = Array.from(selectedOrders).map(orderId =>
        fetch(`/api/admin/orders?id=${orderId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            status: bulkAction.updateStatus || undefined,
            paymentStatus: bulkAction.updatePaymentStatus || undefined
          })
        })
      );

      await Promise.all(updates);
      alert('Orders updated successfully!');
      setShowBulkEditModal(false);
      setSelectedOrders(new Set());
      fetchOrders();
    } catch (error) {
      alert('Failed to update orders');
      console.error(error);
    }
  };

  // 5. CREATE ORDER FUNCTION
  const handleCreateOrder = async () => {
    try {
      const response = await fetch('/api/admin/orders/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newOrder)
      });

      const result = await response.json();
      
      if (result.success) {
        alert('Order created successfully!');
        setShowCreateOrderModal(false);
        setNewOrder({
          customerEmail: '',
          customerName: '',
          amount: '',
          status: 'Pending',
          paymentMethod: 'gcash',
          paymentStatus: 'pending'
        });
        fetchOrders();
      } else {
        alert('Failed to create order: ' + result.error);
      }
    } catch (error) {
      alert('Failed to create order');
      console.error(error);
    }
  };

  // 6. SORT OPTIONS
  const sortOptions = [
    { label: 'Newest First', value: 'created_at', order: 'desc' },
    { label: 'Oldest First', value: 'created_at', order: 'asc' },
    { label: 'Highest Amount', value: 'amount', order: 'desc' },
    { label: 'Lowest Amount', value: 'amount', order: 'asc' },
    { label: 'Customer Name A-Z', value: 'customer_name', order: 'asc' },
    { label: 'Customer Name Z-A', value: 'customer_name', order: 'desc' }
  ];

  const handleSortChange = (value: string, order: string) => {
    setSortBy(value);
    setSortOrder(order as 'asc' | 'desc');
    setShowSortMenu(false);
  };

  // ============================================
  // NEW FUNCTIONS - END
  // ============================================
  const sortOrdersClientSide = (orders: Order[]) => {
    if (sortBy !== "payment_status") return orders;

    return [...orders].sort((a, b) => {
      const aPaymentStatus = a.payment?.paymentStatus || "pending";
      const bPaymentStatus = b.payment?.paymentStatus || "pending";

      const comparison = aPaymentStatus.localeCompare(bPaymentStatus);
      return sortOrder === "asc" ? comparison : -comparison;
    });
  };

  if (selectedOrder || isLoadingOrder) {
    return (
      <OrderDetails
        order={selectedOrder}
        isLoading={isLoadingOrder}
        onBack={handleBackToList}
      />
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="text-red-400 text-lg mb-2">Error loading orders</div>
          <div className="text-[#7a6a4a] text-sm">{error}</div>
          <button
            onClick={fetchOrders}
            className="mt-4 px-4 py-2 bg-[#d4af37] text-[#0a0a0a] hover:bg-[#d4af37]/90 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const displayOrders = data ? sortOrdersClientSide(data.orders) : [];

  return (
    <div className="space-y-6 bg-white dark:bg-[#100f0c] min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <h1 className="text-2xl font-bold text-[#d4af37]">Orders</h1>
          <div className="w-5 h-5 bg-[#d4af37]/20 border border-[#d4af37]/40 rounded-full flex items-center justify-center">
            <span className="text-xs text-[#d4af37]">
              {data?.totalCount || 0}
            </span>
          </div>
          <span className="flex items-center gap-1 text-[10px] font-semibold text-green-500 uppercase tracking-wider">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            Live
          </span>
        </div>
      </div>

      {/* Order Stats Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-[#faf8f3] border border-[#e8e0d0] p-4">
          <p className="text-sm text-[#7a6a4a]">Total Orders</p>
          <p className="text-2xl font-bold text-[#d4af37]">{orderStats.totalOrders.toLocaleString()}</p>
        </div>
        <div className="bg-[#faf8f3] border border-[#e8e0d0] p-4">
          <p className="text-sm text-[#7a6a4a]">Completed</p>
          <p className="text-2xl font-bold text-green-400">{orderStats.completed.toLocaleString()}</p>
        </div>
        <div className="bg-[#faf8f3] border border-[#e8e0d0] p-4">
          <p className="text-sm text-[#7a6a4a]">Pending</p>
          <p className="text-2xl font-bold text-yellow-400">{orderStats.pending.toLocaleString()}</p>
        </div>
        <div className="bg-[#faf8f3] border border-[#e8e0d0] p-4">
          <p className="text-sm text-[#7a6a4a]">Revenue</p>
          <p className="text-2xl font-bold text-[#d4af37]">{formatCurrency(orderStats.totalRevenue)}</p>
        </div>
      </div>

      {/* Source Toggle */}
      <div className="flex gap-0 border-b border-[#e8e0d0]">
        {(['app', 'store'] as const).map((s) => (
          <button
            key={s}
            onClick={() => { setSource(s); setPosCurrentPage(1); }}
            className={`px-5 py-2.5 text-xs font-semibold uppercase tracking-widest border-b-2 -mb-px transition-colors ${
              source === s
                ? 'border-[#D4AF37] text-[#8B6914]'
                : 'border-transparent text-[#7a6a4a] hover:text-[#1c1810]'
            }`}
          >
            {s === 'app' ? 'App Orders' : 'Physical Store'}
          </button>
        ))}
      </div>

      {/* Search and Filters */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4 flex-1 max-w-2xl">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[#7a6a4a] w-4 h-4" />
            <input
              type="text"
              placeholder="Search by customer name or email"
              className="w-full pl-10 pr-4 py-2 border border-[#e8e0d0] bg-[#faf8f3] text-[#1c1810] focus:outline-none focus:ring-2 focus:ring-[#d4af37] focus:border-transparent placeholder-[#b0a080]"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-[#e8e0d0] bg-[#faf8f3] text-[#1c1810] focus:outline-none focus:ring-2 focus:ring-[#d4af37] focus:border-transparent"
          >
            <option value="all">All order statuses</option>
            <option value="Pending">Pending</option>
            <option value="Processing">Processing</option>
            <option value="To Ship">To Ship</option>
            <option value="Shipped">Shipped</option>
            <option value="Delivered">Delivered</option>
            <option value="Cancelled">Cancelled</option>
          </select>
          <select
            value={paymentStatusFilter}
            onChange={(e) => setPaymentStatusFilter(e.target.value)}
            className="px-4 py-2 border border-[#e8e0d0] bg-[#faf8f3] text-[#1c1810] focus:outline-none focus:ring-2 focus:ring-[#d4af37] focus:border-transparent"
          >
            <option value="all">All payment statuses</option>
            <option value="paid">Paid</option>
            <option value="pending">Pending</option>
          </select>
        </div>
       <div className="flex items-center justify-between mb-6">
  <div className="flex items-center space-x-3">
    {/* Filter Button */}
    <button 
      onClick={() => setShowFilterModal(true)}
      className="p-2 border border-[#e8e0d0] text-[#1c1810] hover:bg-[#d4af37]/10 transition-colors"
    >
      <Filter className="w-4 h-4" />
    </button>

    {/* Sort Button with Dropdown */}
    <div className="relative">
      <button 
        onClick={() => setShowSortMenu(!showSortMenu)}
        className="p-2 border border-[#e8e0d0] text-[#1c1810] hover:bg-[#d4af37]/10 transition-colors"
      >
        <ArrowUpDown className="w-4 h-4" />
      </button>

      {showSortMenu && (
        <div className="absolute top-full left-0 mt-2 w-64 bg-[#faf8f3] border border-[#e8e0d0] shadow-lg z-50">
          {sortOptions.map((option) => (
            <button
              key={`${option.value}-${option.order}`}
              onClick={() => handleSortChange(option.value, option.order)}
              className={`w-full px-4 py-2 text-left text-sm hover:bg-[#d4af37]/10 transition-colors ${
                sortBy === option.value && sortOrder === option.order
                  ? 'bg-[#d4af37]/20 text-[#d4af37]'
                  : 'text-[#1c1810]'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>

    {/* Export Button */}
    <button 
      onClick={handleExport}
      className="px-4 py-2 border border-[#e8e0d0] text-[#1c1810] hover:bg-[#d4af37]/10 transition-colors flex items-center space-x-2"
    >
      <Download className="w-4 h-4" />
      <span>Export</span>
    </button>

    {/* Summary Button */}
    <button 
      onClick={() => setShowSummary(true)}
      className="px-4 py-2 border border-[#e8e0d0] text-[#1c1810] hover:bg-[#d4af37]/10 transition-colors flex items-center space-x-2"
    >
      <FileText className="w-4 h-4" />
      <span>Summary</span>
    </button>
  </div>

  <div className="flex items-center space-x-3">

  </div>
  {/* ============================================ */}
      {/* ALL MODALS - ADD BEFORE CLOSING </div> */}
      {/* ============================================ */}
{/* EXPORT MODAL */}
{showExportModal && (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
    <div className="bg-[#faf8f3] border border-[#e8e0d0] p-6 w-full max-w-md">
      <h2 className="text-xl font-bold text-[#d4af37] mb-4">Export Orders</h2>

      <div className="space-y-4">
        {/* Export Format Selection */}
        <div>
          <label className="block text-sm font-medium text-[#7a6a4a] mb-2">Export Format</label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setExportOptions({ ...exportOptions, format: 'csv' })}
              className={`flex items-center justify-center gap-2 p-3 rounded border-2 transition-all ${
                exportOptions.format === 'csv'
                  ? 'border-[#d4af37] bg-[#d4af37]/10 text-[#d4af37]'
                  : 'border-[#e8e0d0] text-[#7a6a4a] hover:border-[#d4af37]/40'
              }`}
            >
              <FileSpreadsheet className="w-5 h-5" />
              <div className="text-left">
                <div className="font-medium">CSV</div>
                <div className="text-xs opacity-70">Spreadsheet</div>
              </div>
            </button>
            <button
              type="button"
              onClick={() => setExportOptions({ ...exportOptions, format: 'pdf' })}
              className={`flex items-center justify-center gap-2 p-3 rounded border-2 transition-all ${
                exportOptions.format === 'pdf'
                  ? 'border-[#d4af37] bg-[#d4af37]/10 text-[#d4af37]'
                  : 'border-[#e8e0d0] text-[#7a6a4a] hover:border-[#d4af37]/40'
              }`}
            >
              <FileText className="w-5 h-5" />
              <div className="text-left">
                <div className="font-medium">PDF</div>
                <div className="text-xs opacity-70">Document</div>
              </div>
            </button>
          </div>
        </div>

        {/* Export Type Selection */}
        <div>
          <label className="block text-sm font-medium text-[#7a6a4a] mb-2">Export Type</label>
          <div className="space-y-2">
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="radio"
                name="exportType"
                value="all"
                checked={exportOptions.exportType === 'all'}
                onChange={(e) => setExportOptions({ ...exportOptions, exportType: e.target.value })}
                className="w-4 h-4 accent-[#d4af37]"
              />
              <span className="text-[#1c1810]">All orders ({data?.totalCount || 0})</span>
            </label>
            
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="radio"
                name="exportType"
                value="selected"
                checked={exportOptions.exportType === 'selected'}
                onChange={(e) => setExportOptions({ ...exportOptions, exportType: e.target.value })}
                className="w-4 h-4 accent-[#d4af37]"
                disabled={selectedOrders.size === 0}
              />
              <span className={selectedOrders.size === 0 ? 'text-[#7a6a4a]/50' : 'text-[#1c1810]'}>
                Selected orders ({selectedOrders.size})
              </span>
            </label>
            
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="radio"
                name="exportType"
                value="daterange"
                checked={exportOptions.exportType === 'daterange'}
                onChange={(e) => setExportOptions({ ...exportOptions, exportType: e.target.value })}
                className="w-4 h-4 accent-[#d4af37]"
              />
              <span className="text-[#1c1810]">Date range</span>
            </label>
          </div>
        </div>

        {/* Date Range Inputs (only show when daterange is selected) */}
        {exportOptions.exportType === 'daterange' && (
          <div className="space-y-3 p-3 bg-white dark:bg-[#26231a] border border-[#d4af37]/10 rounded">
            <div>
              <label className="block text-sm font-medium text-[#7a6a4a] mb-2">From Date</label>
              <input
                type="date"
                value={exportOptions.dateFrom}
                onChange={(e) => setExportOptions({ ...exportOptions, dateFrom: e.target.value })}
                className="w-full px-3 py-2 border border-[#e8e0d0] bg-[#faf8f3] text-[#1c1810] focus:outline-none focus:ring-2 focus:ring-[#d4af37]"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-[#7a6a4a] mb-2">To Date</label>
              <input
                type="date"
                value={exportOptions.dateTo}
                onChange={(e) => setExportOptions({ ...exportOptions, dateTo: e.target.value })}
                className="w-full px-3 py-2 border border-[#e8e0d0] bg-[#faf8f3] text-[#1c1810] focus:outline-none focus:ring-2 focus:ring-[#d4af37]"
              />
            </div>
          </div>
        )}

        {/* Export Info */}
        <div className="bg-[#d4af37]/10 border border-[#e8e0d0] p-3 rounded">
          <p className="text-xs text-[#7a6a4a]">
            📄 Export will include: Order Number, Customer Name, Email, Amount, Status, Payment Status, Payment Method, Items, and Date
          </p>
        </div>
      </div>

      <div className="flex justify-end space-x-3 mt-6">
        <button
          onClick={() => setShowExportModal(false)}
          className="px-4 py-2 border border-[#e8e0d0] text-[#1c1810] hover:bg-[#d4af37]/10 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={executeExport}
          className="px-4 py-2 bg-[#d4af37] text-[#0a0a0a] hover:bg-[#d4af37]/90 transition-colors flex items-center space-x-2"
        >
          {exportOptions.format === 'pdf' ? <FileText className="w-4 h-4" /> : <FileSpreadsheet className="w-4 h-4" />}
          <span>Export {exportOptions.format.toUpperCase()}</span>
        </button>
      </div>
    </div>
  </div>
)}
      {/* FILTER MODAL */}
      {showFilterModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[#faf8f3] border border-[#e8e0d0] p-6 w-full max-w-md">
            <h2 className="text-xl font-bold text-[#d4af37] mb-4">Filter Orders</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#7a6a4a] mb-2">Order Status</label>
                <select
                  value={tempFilters.status}
                  onChange={(e) => setTempFilters({ ...tempFilters, status: e.target.value })}
                  className="w-full px-3 py-2 border border-[#e8e0d0] dark:border-[#2e2a1e] bg-white dark:bg-[#26231a] text-[#1c1810] dark:text-[#f0e8d8] focus:outline-none focus:ring-2 focus:ring-[#d4af37]"
                >
                  <option value="all">All Statuses</option>
                  <option value="Pending">Pending</option>
                  <option value="Processing">Processing</option>
                  <option value="To Ship">To Ship</option>
                  <option value="Shipped">Shipped</option>
                  <option value="Delivered">Delivered</option>
                  <option value="Cancelled">Cancelled</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-[#7a6a4a] mb-2">Payment Status</label>
                <select
                  value={tempFilters.paymentStatus}
                  onChange={(e) => setTempFilters({ ...tempFilters, paymentStatus: e.target.value })}
                  className="w-full px-3 py-2 border border-[#e8e0d0] dark:border-[#2e2a1e] bg-white dark:bg-[#26231a] text-[#1c1810] dark:text-[#f0e8d8] focus:outline-none focus:ring-2 focus:ring-[#d4af37]"
                >
                  <option value="all">All Payment Statuses</option>
                  <option value="paid">Paid</option>
                  <option value="pending">Pending</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={resetFilters}
                className="px-4 py-2 border border-[#e8e0d0] text-[#1c1810] hover:bg-[#d4af37]/10 transition-colors"
              >
                Reset
              </button>
              <button
                onClick={() => setShowFilterModal(false)}
                className="px-4 py-2 border border-[#e8e0d0] text-[#1c1810] hover:bg-[#d4af37]/10 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={applyFilters}
                className="px-4 py-2 bg-[#d4af37] text-[#0a0a0a] hover:bg-[#d4af37]/90 transition-colors"
              >
                Apply Filters
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SUMMARY MODAL */}
      {showSummary && (() => {
        const summary = calculateSummary();
        return (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-[#faf8f3] border border-[#e8e0d0] p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <h2 className="text-xl font-bold text-[#d4af37] mb-4">
                Orders Summary {selectedOrders.size > 0 && `(${selectedOrders.size} selected)`}
              </h2>
              
              {summary && (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-white border border-[#e8e0d0] p-4">
                      <div className="text-sm text-[#7a6a4a]">Total Orders</div>
                      <div className="text-2xl font-bold text-[#d4af37]">{summary.totalOrders}</div>
                    </div>
                    <div className="bg-white border border-[#e8e0d0] p-4">
                      <div className="text-sm text-[#7a6a4a]">Total Revenue</div>
                      <div className="text-2xl font-bold text-[#d4af37]">
                        {formatCurrency(summary.totalRevenue)}
                      </div>
                    </div>
                    <div className="bg-white border border-[#e8e0d0] p-4">
                      <div className="text-sm text-[#7a6a4a]">Total Items</div>
                      <div className="text-2xl font-bold text-[#d4af37]">{summary.totalItems}</div>
                    </div>
                    <div className="bg-white border border-[#e8e0d0] p-4">
                      <div className="text-sm text-[#7a6a4a]">Avg Order</div>
                      <div className="text-2xl font-bold text-[#d4af37]">
                        {formatCurrency(summary.averageOrderValue)}
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold text-[#1c1810] mb-3">Order Status</h3>
                    <div className="space-y-2">
                      {Object.entries(summary.statusBreakdown).map(([status, count]) => (
                        <div key={status} className="flex justify-between bg-white border border-[#e8e0d0] p-3">
                          <span className="text-[#1c1810]">{status}</span>
                          <span className="text-[#d4af37] font-bold">{count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-end mt-6">
                <button
                  onClick={() => setShowSummary(false)}
                  className="px-4 py-2 bg-[#d4af37] text-[#0a0a0a] hover:bg-[#d4af37]/90 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        );
      })()}



    </div> {/* Don't forget to keep your closing tags */}
  

</div>

      {/* Active Date Filter Banner */}
      {(appliedDateFrom || appliedDateTo) && (
        <div className="flex items-center gap-3 px-4 py-2 bg-[#fffdf5] dark:bg-[#1c1a14] border border-[#D4AF37]/40 border-l-4 border-l-[#D4AF37] text-sm">
          <span className="text-[#8B6914] dark:text-[#D4AF37] font-medium">Filtered:</span>
          <span className="text-[#1c1810] dark:text-[#f0e8d8]">
            Orders from{' '}
            <strong>{appliedDateFrom || '—'}</strong> to <strong>{appliedDateTo || '—'}</strong>
          </span>
          <button
            onClick={() => { setAppliedDateFrom(''); setAppliedDateTo(''); }}
            className="ml-auto text-xs text-[#8B6914] dark:text-[#D4AF37] hover:text-[#d4af37] dark:hover:text-[#f0d060] underline"
          >
            Clear date filter
          </button>
        </div>
      )}

      {/* Physical Store Transactions Table */}
      {source === 'store' && (
        <div className="bg-[#faf8f3] border border-[#e8e0d0]">
          <div className="px-6 py-4 border-b border-[#e8e0d0]">
            <h2 className="text-lg font-medium text-[#d4af37]">
              Physical Store Transactions
              <span className="ml-2 text-sm font-normal text-[#7a6a4a]">({posTotalCount} total)</span>
            </h2>
          </div>
          <div className="overflow-x-auto max-h-[calc(100vh-380px)] overflow-y-auto">
            <table className="w-full">
              <thead className="bg-white dark:bg-[#26231a] border-b border-[#e8e0d0] dark:border-[#2e2a1e] sticky top-0 z-10">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-[#7a6a4a] uppercase tracking-wider">Transaction #</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-[#7a6a4a] uppercase tracking-wider">Items</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-[#7a6a4a] uppercase tracking-wider">Total</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-[#7a6a4a] uppercase tracking-wider">Date</th>
                </tr>
              </thead>
              <tbody className="bg-[#faf8f3] divide-y divide-[#d4af37]/10">
                {posLoading ? (
                  Array.from({ length: 8 }).map((_, i) => <OrderRowSkeleton key={i} />)
                ) : posTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-[#7a6a4a]">
                      No transactions found
                    </td>
                  </tr>
                ) : (
                  posTransactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-[#d4af37]/5 transition-colors">
                      <td className="px-6 py-4 text-sm font-mono text-[#1c1810]">{tx.transactionNumber}</td>
                      <td className="px-6 py-4 text-sm text-[#1c1810]">
                        <div className="space-y-0.5">
                          {tx.items.slice(0, 3).map((item: any, i: number) => (
                            <div key={i} className="text-xs">
                              {item.productName} × {item.quantity}
                            </div>
                          ))}
                          {tx.items.length > 3 && (
                            <div className="text-xs text-[#7a6a4a]">+{tx.items.length - 3} more</div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-[#d4af37]">
                        {formatCurrency(tx.totalAmount)}
                      </td>
                      <td className="px-6 py-4 text-sm text-[#7a6a4a]">
                        {new Date(tx.createdAt).toLocaleDateString('en-PH', {
                          year: 'numeric', month: 'short', day: 'numeric',
                          hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Manila'
                        })}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {posTotalPages > 1 && (
            <div className="px-6 py-4 border-t border-[#e8e0d0] flex items-center justify-between">
              <div className="text-sm text-[#7a6a4a]">Page {posCurrentPage} of {posTotalPages}</div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setPosCurrentPage(Math.max(1, posCurrentPage - 1))}
                  disabled={posCurrentPage === 1}
                  className="px-3 py-1 border border-[#e8e0d0] text-[#1c1810] hover:bg-[#d4af37]/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >Previous</button>
                <button
                  onClick={() => setPosCurrentPage(Math.min(posTotalPages, posCurrentPage + 1))}
                  disabled={posCurrentPage === posTotalPages}
                  className="px-3 py-1 border border-[#e8e0d0] text-[#1c1810] hover:bg-[#d4af37]/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >Next</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* App Orders Table */}
      {source === 'app' && (
      <div className="bg-[#faf8f3] border border-[#e8e0d0]">
        <div className="px-6 py-4 border-b border-[#e8e0d0]">
          <h2 className="text-lg font-medium text-[#d4af37]">Orders</h2>
        </div>

        <div className="overflow-x-auto max-h-[calc(100vh-380px)] overflow-y-auto">
          <table className="w-full">
            <thead className="bg-white dark:bg-[#26231a] border-b border-[#e8e0d0] dark:border-[#2e2a1e] sticky top-0 z-10">
              <tr>
                <th className="px-6 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={
                      data != null &&
                      data?.orders.length > 0 &&
                      selectedOrders.size === data.orders.length
                    }
                    onChange={handleSelectAll}
                    className="w-4 h-4 accent-[#d4af37]"
                  />
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-[#7a6a4a] uppercase tracking-wider cursor-pointer hover:bg-[#d4af37]/5"
                  onClick={() => handleSort("created_at")}
                >
                  Order
                  {sortBy === "created_at" && (
                    <ArrowUpDown
                      className={`inline w-3 h-3 ml-1 ${
                        sortOrder === "desc" ? "rotate-180" : ""
                      }`}
                    />
                  )}
                  {sortBy !== "created_at" && (
                    <ArrowUpDown className="inline w-3 h-3 ml-1 opacity-30" />
                  )}
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-[#7a6a4a] uppercase tracking-wider cursor-pointer hover:bg-[#d4af37]/5"
                  onClick={() => handleSort("customer_name")}
                >
                  Customer
                  {sortBy === "customer_name" && (
                    <ArrowUpDown
                      className={`inline w-3 h-3 ml-1 ${
                        sortOrder === "desc" ? "rotate-180" : ""
                      }`}
                    />
                  )}
                  {sortBy !== "customer_name" && (
                    <ArrowUpDown className="inline w-3 h-3 ml-1 opacity-30" />
                  )}
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-[#7a6a4a] uppercase tracking-wider cursor-pointer hover:bg-[#d4af37]/5"
                  onClick={() => handleSort("amount")}
                >
                  Total
                  {sortBy === "amount" && (
                    <ArrowUpDown
                      className={`inline w-3 h-3 ml-1 ${
                        sortOrder === "desc" ? "rotate-180" : ""
                      }`}
                    />
                  )}
                  {sortBy !== "amount" && (
                    <ArrowUpDown className="inline w-3 h-3 ml-1 opacity-30" />
                  )}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-[#7a6a4a] uppercase tracking-wider">
                  Voucher
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-[#7a6a4a] uppercase tracking-wider cursor-pointer hover:bg-[#d4af37]/5"
                  onClick={() => handleSort("payment_status")}
                >
                  Payment Status
                  {sortBy === "payment_status" && (
                    <ArrowUpDown
                      className={`inline w-3 h-3 ml-1 ${
                        sortOrder === "desc" ? "rotate-180" : ""
                      }`}
                    />
                  )}
                  {sortBy !== "payment_status" && (
                    <ArrowUpDown className="inline w-3 h-3 ml-1 opacity-30" />
                  )}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-[#7a6a4a] uppercase tracking-wider">
                  Fulfillment
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-[#7a6a4a] uppercase tracking-wider">
                  Items
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-[#7a6a4a] uppercase tracking-wider cursor-pointer hover:bg-[#d4af37]/5"
                  onClick={() => handleSort("created_at")}
                >
                  Date
                  {sortBy === "created_at" && (
                    <ArrowUpDown
                      className={`inline w-3 h-3 ml-1 ${
                        sortOrder === "desc" ? "rotate-180" : ""
                      }`}
                    />
                  )}
                  {sortBy !== "created_at" && (
                    <ArrowUpDown className="inline w-3 h-3 ml-1 opacity-30" />
                  )}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-[#7a6a4a] uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-[#faf8f3] divide-y divide-[#d4af37]/10">
              {isLoading ? (
                Array.from({ length: 10 }).map((_, index) => (
                  <OrderRowSkeleton key={index} />
                ))
              ) : displayOrders.length === 0 ? (
                <tr>
                  <td
                    colSpan={10}
                    className="px-6 py-12 text-center text-[#7a6a4a]"
                  >
                    No orders found
                  </td>
                </tr>
              ) : (
                displayOrders.map((order) => {
                  const fulfillmentStatus = getFulfillmentStatus(order.status);

                  return (
                    <tr
                      key={order.id}
                      className="hover:bg-[#d4af37]/5 cursor-pointer transition-colors"
                      onClick={() => handleOrderClick(order)}
                    >
                      <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedOrders.has(order.id)}
                          onChange={() => handleSelectOrder(order.id)}
                          className="w-4 h-4 accent-[#d4af37]"
                        />
                      </td>
                      <td className="px-6 py-4 text-sm text-[#1c1810]">
                        {order.orderNumber}
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-[#1c1810]">{order.customerName}</div>
                        <div className="text-xs text-[#7a6a4a]">{order.customerEmail}</div>
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-[#d4af37]">
                        {formatCurrency(order.amount)}
                      </td>
                      <td className="px-6 py-4">
                        {order.voucherCode ? (
                          <div>
                            <span className="inline-block px-2 py-0.5 text-xs font-mono font-semibold bg-[#d4af37]/10 text-[#8B6914] border border-[#d4af37]/30 rounded">
                              {order.voucherCode}
                            </span>
                            {(order.discountAmount ?? 0) > 0 && (
                              <div className="text-xs text-green-600 mt-0.5">
                                -{formatCurrency(order.discountAmount!)}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-[#7a6a4a]">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 text-xs font-medium rounded ${getStatusColor(order.payment?.paymentStatus?.toUpperCase() || "Unpaid")}`}>
                          {order.payment?.paymentStatus?.toUpperCase() || "UNPAID"}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 text-xs font-medium rounded ${fulfillmentStatus.color}`}>
                          {fulfillmentStatus.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-[#1c1810]">
                        {order.itemCount} item{order.itemCount !== 1 ? "s" : ""}
                      </td>
                      <td className="px-6 py-4 text-sm text-[#7a6a4a]">
                        {formatDate(order.createdAt)}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => setPreviewOrder(order)}
                            className="p-1.5 text-[#9a8a6a] hover:text-[#8B6914] hover:bg-[#D4AF37]/10 rounded-sm transition-colors"
                            title="Quick preview"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleOrderClick(order)}
                            className="p-1.5 text-[#9a8a6a] hover:text-[#8B6914] hover:bg-[#D4AF37]/10 rounded-sm transition-colors"
                            title="More details"
                          >
                            <MoreHorizontal className="w-4 h-4" />
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
        {data && data.totalPages > 1 && (
          <div className="px-6 py-4 border-t border-[#e8e0d0] flex items-center justify-between">
            <div className="text-sm text-[#7a6a4a]">
              Page {data.currentPage} of {data.totalPages}
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1 border border-[#e8e0d0] text-[#1c1810] hover:bg-[#d4af37]/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Previous
              </button>
              <button
                onClick={() => setCurrentPage(Math.min(data.totalPages, currentPage + 1))}
                disabled={currentPage === data.totalPages}
                className="px-3 py-1 border border-[#e8e0d0] text-[#1c1810] hover:bg-[#d4af37]/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
      )}

      {/* Dropdown backdrop */}
      {/* Order Preview Modal */}
      {previewOrder && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setPreviewOrder(null); }}
        >
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-[#e8e0d0]">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#e8e0d0]">
              <h2 className="text-base font-semibold text-[#1c1810]">Order Preview</h2>
              <button onClick={() => setPreviewOrder(null)} className="p-1.5 rounded hover:bg-[#f2ede4] text-[#7a6a4a] transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Order number + customer */}
              <div className="flex gap-5">
                {/* Order icon placeholder */}
                <div className="w-20 h-20 flex-shrink-0 rounded-lg border border-[#e8e0d0] bg-[#faf8f3] flex items-center justify-center">
                  <FileText className="w-8 h-8 text-[#D4AF37]/60" />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0 space-y-2">
                  <div>
                    <h3 className="text-lg font-semibold text-[#1c1810] leading-tight font-mono">{previewOrder.orderNumber}</h3>
                    <p className="text-sm text-[#7a6a4a] mt-0.5">{previewOrder.customerName}</p>
                    <p className="text-xs text-[#9a8a6a]">{previewOrder.customerEmail}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className={`px-2 py-0.5 text-xs font-medium rounded-full border ${getStatusColor(previewOrder.status)}`}>
                      {previewOrder.status}
                    </span>
                    <span className={`px-2 py-0.5 text-xs font-medium rounded-full border ${getStatusColor(previewOrder.payment?.paymentStatus?.toUpperCase() || 'Unpaid')}`}>
                      {(previewOrder.payment?.paymentStatus || 'Unpaid').toUpperCase()}
                    </span>
                    {previewOrder.payment?.paymentMethod && (
                      <span className="px-2 py-0.5 text-xs font-medium rounded-full border bg-[#d4af37]/10 text-[#8B6914] border-[#d4af37]/30">
                        {previewOrder.payment.paymentMethod.toUpperCase()}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Items */}
              {previewOrder.items && previewOrder.items.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-[#8B6914] uppercase tracking-wide mb-2 flex items-center gap-1.5">
                    <Package className="w-3.5 h-3.5" /> Items ({previewOrder.itemCount})
                  </p>
                  <div className="border border-[#e8e0d0] rounded-lg overflow-hidden">
                    {previewOrder.items.map((item, i) => (
                      <div key={i} className="flex justify-between items-center px-3 py-2.5 border-b border-[#e8e0d0] last:border-0 bg-[#faf8f3]">
                        <div>
                          <p className="text-sm text-[#1c1810] font-medium">{item.productName}</p>
                          {item.size && <p className="text-xs text-[#9a8a6a]">{item.size}</p>}
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-[#9a8a6a]">×{item.quantity}</p>
                          <p className="text-sm font-semibold text-[#1c1810]">{formatCurrency(item.itemAmount)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Totals */}
              <div>
                <p className="text-xs font-semibold text-[#8B6914] uppercase tracking-wide mb-2">Summary</p>
                <div className="border border-[#e8e0d0] rounded-lg px-4 py-3 bg-[#faf8f3] space-y-1.5">
                  {previewOrder.voucherCode && (
                    <div className="flex justify-between text-sm">
                      <span className="text-green-600 flex items-center gap-1.5">
                        Voucher
                        <span className="font-mono text-xs bg-green-50 border border-green-200 text-green-700 px-1.5 py-0.5 rounded">
                          {previewOrder.voucherCode}
                        </span>
                      </span>
                      <span className="text-green-600 font-medium">-{formatCurrency(previewOrder.discountAmount || 0)}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center pt-1 border-t border-[#e8e0d0]">
                    <span className="text-sm font-semibold text-[#1c1810]">Total</span>
                    <span className="text-base font-bold text-[#D4AF37]">{formatCurrency(previewOrder.amount)}</span>
                  </div>
                </div>
              </div>

              {/* Footer meta */}
              <div className="pt-2 border-t border-[#e8e0d0] flex justify-between text-xs text-[#9a8a6a]">
                <span>Placed on {formatDate(previewOrder.createdAt)}</span>
                <span>{previewOrder.itemCount} item{previewOrder.itemCount !== 1 ? 's' : ''}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function OrdersPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center"><div className="text-[#d4af37]">Loading...</div></div>}>
      <OrdersContent />
    </Suspense>
  );
}