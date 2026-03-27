"use client";
import React, { useState, useRef, useEffect } from "react";
import { ArrowLeft, Copy, ExternalLink, ChevronRight, MoreHorizontal, Package, Truck, X, RotateCcw, CheckCircle, XCircle, Clock } from "lucide-react";
import CustomSidebar from "@/components/modals/sidebar";
import JntSidebar from "@/components/admin/sidebars/jntsidebar";
import LalaMoveSidebar from "@/components/admin/sidebars/lalamovesidebar";
import { Zap } from "lucide-react";

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
  status: 'Pending' | 'Processing' | 'To Ship' | 'Shipped' | 'Delivered' | 'Cancelled';
  createdAt: string;
  orderNumber: string;
  itemCount: number;
  payment: PaymentInfo | null;
  items: OrderItem[];
  note?: string;
  customerPhone?: string;
  trackingNumber?: string;
  courier?: string;
  paymentLink?: string;
  deliveryAddress?: string;
  deliveryLocation?: {
    address?: string;
    region?: { name: string };
    province?: { name: string };
    city?: { name: string };
    barangay?: { name: string };
    street_address?: string;
    recipient_name?: string;
    phone_number?: string;
    latitude?: number;
    longitude?: number;
    shipping_fee?: number;
    courier_info?: {
      waybill_number?: string;
      courier_code?: string;
      courier_name?: string;
      shipping_fee?: number;
      estimated_delivery?: string;
      lalamove_order_id?: string;
      tracking_url?: string;
    };
  };
  waybillNumber?: string;
  courierCode?: string;
  courierProvider?: string;
  trackingUrl?: string;
  shippingFee?: number;
  estimatedDelivery?: string;
  voucherCode?: string | null;
  discountAmount?: number;
  originalAmount?: number | null;
  recipientName?: string;
  recipientPhone?: string;
}

interface OrderDetailsProps {
  order: Order | null;
  isLoading: boolean;
  onBack: () => void;
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP'
  }).format(amount);
};

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Manila',
  });
};

// BLACK & GOLD themed status colors
const getStatusColor = (status: string) => {
  switch (status?.toLowerCase()) {
    case 'pending':
      return 'bg-yellow-900/20 text-yellow-400 border border-yellow-400/30';
    case 'processing':
      return 'bg-blue-900/20 text-blue-400 border border-blue-400/30';
    case 'to ship':
      return 'bg-amber-900/20 text-amber-500 border border-amber-500/30';
    case 'shipped':
      return 'bg-purple-900/20 text-purple-400 border border-purple-400/30';
    case 'delivered':
      return 'bg-green-900/20 text-green-400 border border-green-400/30';
    case 'cancelled':
      return 'bg-red-900/20 text-red-400 border border-red-400/30';
    case 'paid':
    case 'completed':
      return 'bg-green-900/20 text-green-400 border border-green-400/30';
    case 'unpaid':
    case 'failed':
      return 'bg-red-900/20 text-red-400 border border-red-400/30';
    case 'refunded':
      return 'bg-[#d4af37]/10 text-[#d4af37] border border-[#d4af37]/30';
    default:
      return 'bg-[#d4af37]/10 text-[#7a6a4a] border border-[#d4af37]/30';
  }
};

const getFulfillmentStatus = (orderStatus: string) => {
  switch (orderStatus) {
    case 'Delivered':
      return { status: 'FULFILLED', color: 'bg-green-900/20 text-green-400 border border-green-400/30' };
    case 'To Ship':
      return { status: 'AWAITING HANDOFF', color: 'bg-amber-900/20 text-amber-500 border border-amber-500/30' };
    case 'Shipped':
      return { status: 'PARTIALLY FULFILLED', color: 'bg-blue-900/20 text-blue-400 border border-blue-400/30' };
    case 'Processing':
      return { status: 'PROCESSING', color: 'bg-yellow-900/20 text-yellow-400 border border-yellow-400/30' };
    case 'Cancelled':
      return { status: 'CANCELLED', color: 'bg-red-900/20 text-red-400 border border-red-400/30' };
    default:
      return { status: 'UNFULFILLED', color: 'bg-[#d4af37]/10 text-[#7a6a4a] border border-[#d4af37]/30' };
  }
};

const Skeleton = ({ className }: { className?: string }) => (
  <div className={`animate-pulse bg-[#d4af37]/10 rounded ${className}`}></div>
);

const isPaidOrder = (order: Order) => {
  const s = order.payment?.paymentStatus?.toLowerCase();
  return s === 'paid' || s === 'completed';
};

const OrderActionsDropdown = ({
  order,
  onStatusUpdate,
  onOpenJntSidebar,
  onOpenLalamoveSidebar,
}: {
  order: Order;
  onStatusUpdate: (newStatus: string) => void;
  onOpenJntSidebar: () => void;
  onOpenLalamoveSidebar: () => void;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleProcessOrder = async () => {
    setIsUpdating(true);
    try {
      const response = await fetch(`/api/admin/orders/${order.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          status: 'Processing',
          title: 'Order Processing',
          body: 'Your order is now being processed'
        })
      });

      if (response.ok) {
        onStatusUpdate('Processing');
        setIsOpen(false);
      }
    } catch (error) {
      console.error('Failed to update status:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  const renderDropdownItems = () => {
    const paid = isPaidOrder(order);

    if (!paid && (order.status === 'Pending' || order.status === 'Processing')) {
      return (
        <div className="px-4 py-3">
          <div className="flex items-center gap-2 text-red-500 mb-1">
            <XCircle size={14} />
            <span className="text-xs font-semibold">Payment Required</span>
          </div>
          <p className="text-xs text-[#7a6a4a]">Order must be paid before it can be processed or shipped.</p>
        </div>
      );
    }

    switch (order.status) {
      case 'Pending':
        return (
          <button
            onClick={handleProcessOrder}
            disabled={isUpdating}
            className="w-full text-left px-4 py-2 text-sm text-[#1c1810] dark:text-[#f0e8d8] hover:bg-[#d4af37]/10 flex items-center gap-2 disabled:opacity-50 transition-colors"
          >
            <Package size={16} />
            {isUpdating ? 'Processing...' : 'Process Order'}
          </button>
        );

      case 'Processing': {
        const customerWantsLalamove = order.courierProvider === 'lalamove';
        return (
          <>
            <div className="px-4 py-2 text-xs text-[#7a6a4a] font-semibold border-b border-[#d4af37]/10">
              CREATE SHIPMENT
            </div>
            <div className="px-4 py-1.5 text-xs text-[#8B6914] bg-[#d4af37]/10 border-b border-[#d4af37]/10">
              Customer chose: <span className="font-semibold">{customerWantsLalamove ? 'Lalamove (Same-Day)' : 'J&T Express (Standard)'}</span>
            </div>
            <button
              onClick={() => {
                setIsOpen(false);
                onOpenJntSidebar();
              }}
              className={`w-full text-left px-4 py-2 text-sm text-[#1c1810] dark:text-[#f0e8d8] hover:bg-red-500/10 flex items-center gap-2 transition-colors ${!customerWantsLalamove ? 'bg-red-500/5' : ''}`}
            >
              <Truck size={16} className="text-red-500" />
              <span>J&T Express</span>
              <span className="ml-auto text-xs text-[#9a8a68]">Standard</span>
              {!customerWantsLalamove && <span className="text-xs text-red-500 font-semibold">★</span>}
            </button>
            <button
              onClick={() => {
                setIsOpen(false);
                onOpenLalamoveSidebar();
              }}
              className={`w-full text-left px-4 py-2 text-sm text-[#1c1810] dark:text-[#f0e8d8] hover:bg-yellow-500/10 flex items-center gap-2 transition-colors ${customerWantsLalamove ? 'bg-yellow-500/5' : ''}`}
            >
              <Zap size={16} className="text-yellow-500" />
              <span>Lalamove</span>
              <span className="ml-auto text-xs text-[#9a8a68]">Same-Day</span>
              {customerWantsLalamove && <span className="text-xs text-yellow-600 font-semibold">★</span>}
            </button>
          </>
        );
      }

      case 'To Ship': {
        const isLalamove = order.courierProvider === 'lalamove';
        return (
          <button
            onClick={async () => {
              setIsUpdating(true);
              setIsOpen(false);
              try {
                await fetch(`/api/admin/orders/${order.id}/status`, {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    status: 'Shipped',
                    title: isLalamove ? 'Order Picked Up by Lalamove' : 'Order Handed to J&T Express',
                    body: isLalamove
                      ? 'A Lalamove driver has picked up your order and it is on its way.'
                      : 'Your order has been handed to J&T Express and is now on its way.',
                    ...(order.trackingUrl ? { tracking_url: order.trackingUrl } : {}),
                  }),
                });
                onStatusUpdate('Shipped');
              } catch (error) {
                console.error('Failed to update status:', error);
              } finally {
                setIsUpdating(false);
              }
            }}
            disabled={isUpdating}
            className="w-full text-left px-4 py-2 text-sm text-[#1c1810] dark:text-[#f0e8d8] hover:bg-amber-500/10 flex items-center gap-2 disabled:opacity-50 transition-colors"
          >
            <Truck size={16} className="text-amber-500" />
            {isUpdating ? 'Updating...' : isLalamove ? 'Confirm Handoff to Lalamove' : 'Confirm Handoff to J&T'}
          </button>
        );
      }

      default:
        return (
          <div className="px-4 py-2 text-sm text-[#7a6a4a]">
            No actions available
          </div>
        );
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 hover:bg-[#d4af37]/10 rounded-lg transition-colors text-[#1c1810]"
      >
        <MoreHorizontal size={20} />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-[#faf8f3] dark:bg-[#1c1a14] border border-[#e8e0d0] dark:border-[#2e2a1e] rounded-lg shadow-lg z-50">
          <div className="py-1">
            {renderDropdownItems()}
          </div>
        </div>
      )}
    </div>
  );
};

interface RefundRecord {
  id: string;
  order_id: string;
  user_id: string;
  reason: string;
  description?: string;
  image_url?: string;
  amount: number;
  status: 'Pending' | 'Approved' | 'Declined';
  admin_note?: string;
  created_at: string;
}

export default function OrderDetails({ order, isLoading, onBack }: OrderDetailsProps) {
  const [currentOrder, setCurrentOrder] = useState(order);
  const [isJntSidebarOpen, setIsJntSidebarOpen] = useState(false);
  const [isLalamoveSidebarOpen, setIsLalamoveSidebarOpen] = useState(false);
  const [internalNote, setInternalNote] = useState(order?.note || '');
  const [refund, setRefund] = useState<RefundRecord | null>(null);
  const [refundLoading, setRefundLoading] = useState(false);
  const [refundActionLoading, setRefundActionLoading] = useState(false);
  const [adminNote, setAdminNote] = useState('');

  useEffect(() => {
    setCurrentOrder(order);
    setInternalNote(order?.note || '');
    setRefund(null);
    if (order?.id) fetchRefund(order.id);
  }, [order]);

  const fetchRefund = async (orderId: string) => {
    setRefundLoading(true);
    try {
      const res = await fetch(`/api/admin/refunds?order_id=${orderId}`);
      const json = await res.json();
      if (json.success && json.data?.length > 0) {
        setRefund(json.data[0]);
        setAdminNote(json.data[0].admin_note ?? '');
      }
    } catch (e) {
      console.error('Failed to fetch refund:', e);
    } finally {
      setRefundLoading(false);
    }
  };

  const handleRefundAction = async (action: 'approve' | 'decline') => {
    if (!refund) return;
    setRefundActionLoading(true);
    try {
      const res = await fetch('/api/admin/refunds', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refundId: refund.id, action, adminNote }),
      });
      const json = await res.json();
      if (json.success) {
        setRefund({ ...refund, status: json.status, admin_note: adminNote });
      } else {
        alert(`Failed: ${json.error}`);
      }
    } catch (e) {
      console.error('Refund action failed:', e);
    } finally {
      setRefundActionLoading(false);
    }
  };

  const handleStatusUpdate = (newStatus: string) => {
    if (currentOrder) {
      setCurrentOrder({ ...currentOrder, status: newStatus as any });
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-[#100f0c] min-h-screen">
        <div className="max-w-7xl mx-auto p-6 space-y-6">
          <div className="flex items-center gap-4">
            <Skeleton className="w-20 h-8" />
            <div>
              <Skeleton className="w-48 h-8 mb-2" />
              <Skeleton className="w-32 h-4" />
            </div>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-[#faf8f3] p-6 rounded-lg border border-[#e8e0d0]">
                <Skeleton className="w-32 h-6 mb-4" />
                <div className="space-y-4">
                  <Skeleton className="w-full h-16" />
                  <Skeleton className="w-full h-16" />
                </div>
              </div>
            </div>
            
            <div className="space-y-6">
              <div className="bg-[#faf8f3] p-6 rounded-lg border border-[#e8e0d0]">
                <Skeleton className="w-24 h-6 mb-4" />
                <div className="space-y-2">
                  <Skeleton className="w-full h-4" />
                  <Skeleton className="w-full h-4" />
                  <Skeleton className="w-3/4 h-4" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!currentOrder) {
    return (
      <div className="p-6 bg-white dark:bg-[#100f0c] min-h-screen">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-[#7a6a4a] hover:text-[#d4af37] mb-6 transition-colors"
        >
          <ArrowLeft size={20} />
          Back to orders
        </button>
        <div className="text-center text-[#7a6a4a]">Order not found</div>
      </div>
    );
  }

  const fulfillment = getFulfillmentStatus(currentOrder.status);

  return (
    <>
      <div className="bg-white dark:bg-[#100f0c] min-h-screen">
        <div className="max-w-7xl mx-auto p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button 
                onClick={onBack}
                className="flex items-center gap-2 text-[#7a6a4a] hover:text-[#d4af37] transition-colors"
              >
                <ArrowLeft size={20} />
                Back
              </button>
              <div>
                <h1 className="text-2xl font-bold text-[#d4af37]">Order {currentOrder.orderNumber}</h1>
                <p className="text-[#7a6a4a]">{formatDate(currentOrder.createdAt)}</p>
              </div>
            </div>
            <OrderActionsDropdown
              order={currentOrder}
              onStatusUpdate={handleStatusUpdate}
              onOpenJntSidebar={() => setIsJntSidebarOpen(true)}
              onOpenLalamoveSidebar={() => setIsLalamoveSidebarOpen(true)}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-[#faf8f3] p-4 rounded-lg border border-[#e8e0d0]">
              <div className="text-sm text-[#7a6a4a] mb-1">Order Status</div>
              <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(currentOrder.status)}`}>
                {currentOrder.status}
              </span>
            </div>
            
            <div className="bg-[#faf8f3] p-4 rounded-lg border border-[#e8e0d0]">
              <div className="text-sm text-[#7a6a4a] mb-1">Payment Status</div>
              <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(currentOrder.payment?.paymentStatus || 'unpaid')}`}>
                {currentOrder.payment?.paymentStatus || 'Unpaid'}
              </span>
            </div>
            
            <div className="bg-[#faf8f3] p-4 rounded-lg border border-[#e8e0d0]">
              <div className="text-sm text-[#7a6a4a] mb-1">Fulfillment</div>
              <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${fulfillment.color}`}>
                {fulfillment.status}
              </span>
            </div>
          </div>

          {/* ── Order Flow Timeline ─────────────────────────────────────── */}
          {currentOrder.status !== 'Cancelled' && (
            <div className="bg-[#faf8f3] rounded-lg border border-[#e8e0d0] p-5">
              <h2 className="text-xs font-semibold text-[#7a6a4a] uppercase tracking-wider mb-5">Order Progress</h2>
              <div className="relative flex items-start justify-between">
                {/* Connector line behind steps */}
                <div className="absolute top-4 left-0 right-0 h-0.5 bg-[#e8e0d0]" style={{ zIndex: 0 }} />
                <div
                  className="absolute top-4 left-0 h-0.5 bg-[#d4af37] transition-all duration-500"
                  style={{
                    zIndex: 0,
                    width: currentOrder.status === 'Pending' ? '0%'
                      : currentOrder.status === 'Processing' ? '25%'
                      : currentOrder.status === 'To Ship' ? '50%'
                      : currentOrder.status === 'Shipped' ? '75%'
                      : '100%',
                  }}
                />
                {(
                  [
                    { key: 'Pending',    label: 'Ordered',    sub: 'Awaiting processing' },
                    { key: 'Processing', label: 'Processing', sub: 'Being prepared' },
                    { key: 'To Ship',    label: 'Packed',     sub: 'Ready to hand off' },
                    { key: 'Shipped',    label: 'Shipped',    sub: 'On the way' },
                    { key: 'Delivered',  label: 'Delivered',  sub: 'Order received' },
                  ] as const
                ).map((step, i, arr) => {
                  const statuses = ['Pending', 'Processing', 'To Ship', 'Shipped', 'Delivered'] as const;
                  const currentIdx = statuses.indexOf(currentOrder.status as typeof statuses[number]);
                  const stepIdx = statuses.indexOf(step.key);
                  const isComplete  = stepIdx < currentIdx;
                  const isCurrent   = stepIdx === currentIdx;
                  const isPending   = stepIdx > currentIdx;
                  return (
                    <div key={step.key} className="relative flex flex-col items-center flex-1 min-w-0" style={{ zIndex: 1 }}>
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all duration-300
                          ${isComplete ? 'bg-[#d4af37] border-[#d4af37]'
                          : isCurrent  ? 'bg-white border-[#d4af37] shadow-md shadow-[#d4af37]/30'
                          :              'bg-white border-[#e8e0d0]'}`}
                      >
                        {isComplete ? (
                          <CheckCircle size={16} className="text-white" />
                        ) : isCurrent ? (
                          <div className="w-3 h-3 rounded-full bg-[#d4af37]" />
                        ) : (
                          <div className="w-3 h-3 rounded-full bg-[#e8e0d0]" />
                        )}
                      </div>
                      <p className={`mt-2 text-xs font-semibold text-center leading-tight
                        ${isComplete || isCurrent ? 'text-[#d4af37]' : 'text-[#7a6a4a]'}`}>
                        {step.label}
                      </p>
                      <p className={`text-[10px] text-center mt-0.5 ${isCurrent ? 'text-[#8B6914]' : 'text-[#7a6a4a]/60'}`}>
                        {step.sub}
                      </p>
                    </div>
                  );
                })}
              </div>

              {/* Contextual hint for admin */}
              <div className="mt-5 pt-4 border-t border-[#e8e0d0]">
                {currentOrder.status === 'Pending' && (
                  <p className="text-xs text-[#7a6a4a] text-center">
                    Use the <span className="font-semibold text-[#8B6914]">⋯ menu</span> → <span className="font-semibold text-[#8B6914]">Process Order</span> to confirm this order
                  </p>
                )}
                {currentOrder.status === 'Processing' && (
                  <p className="text-xs text-[#7a6a4a] text-center">
                    Use the <span className="font-semibold text-[#8B6914]">⋯ menu</span> → <span className="font-semibold text-[#8B6914]">
                      {currentOrder.courierProvider === 'lalamove' ? 'Lalamove' : 'J&T Express'}
                    </span> to create the shipment while packing
                  </p>
                )}
                {currentOrder.status === 'To Ship' && (
                  <p className="text-xs text-[#7a6a4a] text-center">
                    {currentOrder.courierProvider === 'lalamove'
                      ? <>Use the <span className="font-semibold text-amber-600">⋯ menu</span> → <span className="font-semibold text-amber-600">Confirm Handoff to Lalamove</span> once the driver picks up</>
                      : <>Use the <span className="font-semibold text-amber-600">⋯ menu</span> → <span className="font-semibold text-amber-600">Confirm Handoff to J&T</span> once you hand the package to the courier</>
                    }
                  </p>
                )}
                {currentOrder.status === 'Shipped' && (
                  <p className="text-xs text-[#7a6a4a] text-center">
                    {currentOrder.courierProvider === 'lalamove'
                      ? 'Package handed to Lalamove driver — waiting for customer to confirm receipt'
                      : 'Package handed to J&T Express — waiting for customer to confirm receipt'
                    }
                  </p>
                )}
                {currentOrder.status === 'Delivered' && (
                  <p className="text-xs text-green-600 text-center font-medium">
                    Order complete
                  </p>
                )}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-[#faf8f3] rounded-lg border border-[#e8e0d0]">
                <div className="p-6 border-b border-[#e8e0d0]">
                  <h2 className="text-lg font-semibold text-[#d4af37]">Order Items ({currentOrder.itemCount})</h2>
                </div>
                <div className="divide-y divide-[#d4af37]/10">
                  {currentOrder.items.map((item, index) => (
                    <div key={index} className="p-6 flex justify-between items-start">
                      <div className="flex-1">
                        <h3 className="font-medium text-[#1c1810]">{item.productName}</h3>
                        {item.size && (
                          <p className="text-sm text-[#7a6a4a] mt-1">Size: {item.size}</p>
                        )}
                        <p className="text-sm text-[#7a6a4a] mt-1">Quantity: {item.quantity}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium text-[#d4af37]">{formatCurrency(item.itemAmount)}</p>
                        <p className="text-sm text-[#7a6a4a]">{formatCurrency(item.itemAmount / item.quantity)} each</p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="p-6 border-t border-[#e8e0d0] bg-white dark:bg-[#1c1a14] space-y-2">
                  {(() => {
                    const itemsSubtotal = currentOrder.items.reduce((sum, item) => sum + item.itemAmount, 0);
                    const deliveryFee = currentOrder.deliveryLocation?.shipping_fee
                      ?? currentOrder.deliveryLocation?.courier_info?.shipping_fee
                      ?? currentOrder.shippingFee
                      ?? null;
                    const total = currentOrder.amount;
                    const discount = currentOrder.discountAmount ?? 0;
                    return (
                      <>
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-[#7a6a4a]">Subtotal</span>
                          <span className="text-[#1c1810]">{formatCurrency(itemsSubtotal)}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-[#7a6a4a]">Delivery Fee</span>
                          <span className="text-[#1c1810]">
                            {deliveryFee != null ? formatCurrency(deliveryFee) : '—'}
                          </span>
                        </div>
                        {discount > 0 && currentOrder.voucherCode && (
                          <div className="flex justify-between items-center text-sm">
                            <span className="text-green-600 flex items-center gap-1">
                              Voucher
                              <span className="font-mono text-xs bg-green-50 border border-green-200 text-green-700 px-1.5 py-0.5 rounded">
                                {currentOrder.voucherCode}
                              </span>
                            </span>
                            <span className="text-green-600 font-medium">-{formatCurrency(discount)}</span>
                          </div>
                        )}
                        <div className="flex justify-between items-center font-semibold text-base pt-2 border-t border-[#e8e0d0]">
                          <span className="text-[#1c1810]">Total</span>
                          <span className="text-[#d4af37]">{formatCurrency(total)}</span>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>

              {currentOrder.payment && (
                <div className="bg-[#faf8f3] rounded-lg border border-[#e8e0d0]">
                  <div className="p-6 border-b border-[#e8e0d0]">
                    <h2 className="text-lg font-semibold text-[#d4af37]">Payment Information</h2>
                  </div>
                  <div className="p-6 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-[#7a6a4a]">Payment ID</p>
                        <div className="flex items-center gap-2">
                          <p className="font-mono text-sm text-[#1c1810]">{currentOrder.payment.paymentId}</p>
                          <button
                            onClick={() => copyToClipboard(currentOrder.payment?.paymentId || '')}
                            className="text-[#7a6a4a] hover:text-[#d4af37] transition-colors"
                          >
                            <Copy size={16} />
                          </button>
                        </div>
                      </div>
                      <div>
                        <p className="text-sm text-[#7a6a4a]">Payment Method</p>
                        <p className="font-medium text-[#1c1810]">{currentOrder.payment.paymentMethod}</p>
                      </div>
                      <div>
                        <p className="text-sm text-[#7a6a4a]">Amount</p>
                        <p className="font-medium text-[#d4af37]">{formatCurrency(currentOrder.payment.paymentAmount)} {currentOrder.payment.currency}</p>
                      </div>
                      <div>
                        <p className="text-sm text-[#7a6a4a]">Payment Date</p>
                        <p className="font-medium text-[#1c1810]">{formatDate(currentOrder.payment.paymentCreatedAt)}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Refund Management */}
              <div className="bg-[#faf8f3] rounded-lg border border-[#e8e0d0]">
                <div className="p-6 border-b border-[#e8e0d0] flex items-center gap-2">
                  <RotateCcw size={18} className="text-[#d4af37]" />
                  <h2 className="text-lg font-semibold text-[#d4af37]">Refund Request</h2>
                </div>
                <div className="p-6">
                  {refundLoading ? (
                    <div className="text-sm text-[#7a6a4a]">Loading...</div>
                  ) : !refund ? (
                    <p className="text-sm text-[#7a6a4a]">No refund request for this order.</p>
                  ) : (
                    <div className="space-y-4">
                      {/* Status badge */}
                      <div className="flex items-center gap-2">
                        {refund.status === 'Approved' && <CheckCircle size={16} className="text-green-500" />}
                        {refund.status === 'Declined' && <XCircle size={16} className="text-red-400" />}
                        {refund.status === 'Pending' && <Clock size={16} className="text-orange-400" />}
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(refund.status.toLowerCase())}`}>
                          {refund.status}
                        </span>
                        <span className="text-sm text-[#7a6a4a]">
                          Submitted {formatDate(refund.created_at)}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm text-[#7a6a4a]">Refund Amount</p>
                          <p className="font-semibold text-[#d4af37]">{formatCurrency(refund.amount)}</p>
                        </div>
                        <div>
                          <p className="text-sm text-[#7a6a4a]">Reason</p>
                          <p className="font-medium text-[#1c1810] dark:text-[#f0e8d8]">{refund.reason}</p>
                        </div>
                      </div>

                      {refund.description && (
                        <div>
                          <p className="text-sm text-[#7a6a4a]">Description</p>
                          <p className="text-sm text-[#1c1810] dark:text-[#f0e8d8] mt-1">{refund.description}</p>
                        </div>
                      )}

                      <div>
                        <p className="text-sm text-[#7a6a4a] mb-2">Proof / Attachment</p>
                        {refund.image_url ? (
                          <a href={refund.image_url} target="_blank" rel="noopener noreferrer">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={refund.image_url}
                              alt="Refund evidence"
                              className="rounded-lg border border-[#e8e0d0] max-h-48 object-contain cursor-pointer hover:opacity-90 transition-opacity"
                            />
                            <span className="flex items-center gap-1 text-xs text-[#d4af37] mt-1 hover:underline">
                              <ExternalLink size={12} /> Open full image
                            </span>
                          </a>
                        ) : (
                          <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg">
                            <AlertTriangle size={14} className="text-amber-500 shrink-0" />
                            <p className="text-xs text-amber-700">No photo attached — evidence may be insufficient to approve</p>
                          </div>
                        )}
                      </div>

                      {refund.status === 'Pending' && (
                        <div className="pt-2 space-y-3 border-t border-[#e8e0d0]">
                          <div>
                            <label className="text-sm text-[#7a6a4a] mb-1 block">Admin Note (optional)</label>
                            <input
                              type="text"
                              value={adminNote}
                              onChange={(e) => setAdminNote(e.target.value)}
                              placeholder="Add a note for the customer..."
                              className="w-full px-3 py-2 text-sm border border-[#e8e0d0] dark:border-[#2e2a1e] bg-white dark:bg-[#26231a] text-[#1c1810] dark:text-[#f0e8d8] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#d4af37]"
                            />
                          </div>
                          <div className="flex gap-3">
                            <button
                              onClick={() => handleRefundAction('approve')}
                              disabled={refundActionLoading}
                              className="flex-1 flex items-center justify-center gap-2 py-2 px-4 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-lg disabled:opacity-50 transition-colors"
                            >
                              <CheckCircle size={15} />
                              {refundActionLoading ? 'Processing...' : 'Approve Refund'}
                            </button>
                            <button
                              onClick={() => handleRefundAction('decline')}
                              disabled={refundActionLoading}
                              className="flex-1 flex items-center justify-center gap-2 py-2 px-4 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-lg disabled:opacity-50 transition-colors"
                            >
                              <XCircle size={15} />
                              {refundActionLoading ? 'Processing...' : 'Decline'}
                            </button>
                          </div>
                        </div>
                      )}

                      {refund.admin_note && refund.status !== 'Pending' && (
                        <div className="pt-2 border-t border-[#e8e0d0]">
                          <p className="text-sm text-[#7a6a4a]">Admin Note</p>
                          <p className="text-sm text-[#1c1810] dark:text-[#f0e8d8] mt-1">{refund.admin_note}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="bg-[#faf8f3] rounded-lg border border-[#e8e0d0]">
                <div className="p-6 border-b border-[#e8e0d0]">
                  <h2 className="text-lg font-semibold text-[#d4af37]">Customer</h2>
                </div>
                <div className="p-6 space-y-4">
                  <div>
                    <p className="text-sm text-[#7a6a4a]">Name</p>
                    <p className="font-medium text-[#1c1810]">{currentOrder.customerName}</p>
                  </div>
                  <div>
                    <p className="text-sm text-[#7a6a4a]">Email</p>
                    <p className="font-medium text-[#1c1810]">{currentOrder.customerEmail}</p>
                  </div>
                  {currentOrder.customerPhone && (
                    <div>
                      <p className="text-sm text-[#7a6a4a]">Phone</p>
                      <p className="font-medium text-[#1c1810]">{currentOrder.customerPhone}</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-[#faf8f3] rounded-lg border border-[#e8e0d0]">
                <div className="p-6 border-b border-[#e8e0d0]">
                  <h2 className="text-lg font-semibold text-[#d4af37]">Internal Notes</h2>
                </div>
                <div className="p-6">
                  <textarea
                    value={internalNote}
                    onChange={(e) => setInternalNote(e.target.value)}
                    className="w-full p-3 border border-[#e8e0d0] dark:border-[#2e2a1e] bg-white dark:bg-[#26231a] text-[#1c1810] dark:text-[#f0e8d8] placeholder-[#b8a070] rounded-lg focus:ring-2 focus:ring-[#d4af37] focus:border-transparent"
                    rows={4}
                    placeholder="Add internal notes about this order..."
                  />
                  <button className="mt-3 px-4 py-2 bg-[#d4af37] text-[#0a0a0a] rounded-lg hover:bg-[#d4af37]/90 transition-colors">
                    Save Notes
                  </button>
                </div>
              </div>

              {(currentOrder.status === 'Shipped' || currentOrder.status === 'Delivered') && (
                <div className="bg-[#faf8f3] rounded-lg border border-[#e8e0d0]">
                  <div className="p-6 border-b border-[#e8e0d0] flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-[#d4af37]">Tracking Information</h2>
                    {currentOrder.courierProvider === 'lalamove' && currentOrder.status === 'Shipped' && (() => {
                      const [syncing, setSyncing] = React.useState(false);
                      const [syncMsg, setSyncMsg] = React.useState('');
                      const handleSync = async () => {
                        setSyncing(true);
                        setSyncMsg('');
                        try {
                          const res = await fetch('/api/admin/orders/sync-lalamove', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ orderId: currentOrder.id }),
                          });
                          const data = await res.json();
                          if (data.success) {
                            setSyncMsg(data.message);
                            if (data.orderStatus && data.orderStatus !== currentOrder.status) {
                              handleStatusUpdate(data.orderStatus);
                            }
                          } else {
                            setSyncMsg(data.error || 'Sync failed');
                          }
                        } catch {
                          setSyncMsg('Network error');
                        } finally {
                          setSyncing(false);
                        }
                      };
                      return (
                        <div className="flex flex-col items-end gap-1">
                          <button
                            onClick={handleSync}
                            disabled={syncing}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[#d4af37] text-[#0a0a0a] rounded-lg hover:bg-[#d4af37]/90 disabled:opacity-50 transition-colors"
                          >
                            <RotateCcw size={13} className={syncing ? 'animate-spin' : ''} />
                            {syncing ? 'Syncing…' : 'Sync Lalamove Status'}
                          </button>
                          {syncMsg && <p className="text-xs text-[#7a6a4a]">{syncMsg}</p>}
                        </div>
                      );
                    })()}
                  </div>
                  <div className="p-6 space-y-4">
                    <div>
                      <p className="text-sm text-[#7a6a4a]">Courier</p>
                      <p className="font-medium text-[#1c1810]">
                        {currentOrder.courierProvider === 'lalamove' ? 'Lalamove (Same-Day)' : 'J&T Express'}
                      </p>
                    </div>
                    {currentOrder.trackingNumber && (
                      <div>
                        <p className="text-sm text-[#7a6a4a]">Tracking Number</p>
                        <div className="flex items-center gap-2">
                          <p className="font-mono text-sm text-[#1c1810]">{currentOrder.trackingNumber}</p>
                          <button
                            onClick={() => copyToClipboard(currentOrder.trackingNumber || '')}
                            className="text-[#7a6a4a] hover:text-[#d4af37] transition-colors"
                          >
                            <Copy size={16} />
                          </button>
                        </div>
                      </div>
                    )}
                    {currentOrder.trackingUrl && (
                      <div>
                        <p className="text-sm text-[#7a6a4a] mb-1">Tracking Link</p>
                        <a
                          href={currentOrder.trackingUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 underline underline-offset-2 transition-colors"
                        >
                          <ExternalLink size={14} />
                          {currentOrder.courierProvider === 'lalamove' ? 'Track on Lalamove' : 'Track on J&T'}
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <CustomSidebar
        isOpen={isJntSidebarOpen}
        onClose={() => setIsJntSidebarOpen(false)}
        title="Ship with J&T Express"
      >
        <JntSidebar
          order={currentOrder}
          onClose={() => setIsJntSidebarOpen(false)}
          onStatusUpdate={handleStatusUpdate}
        />
      </CustomSidebar>

      <CustomSidebar
        isOpen={isLalamoveSidebarOpen}
        onClose={() => setIsLalamoveSidebarOpen(false)}
        title="Same-Day Delivery via Lalamove"
      >
        <LalaMoveSidebar
          order={currentOrder!}
          onClose={() => setIsLalamoveSidebarOpen(false)}
          onStatusUpdate={handleStatusUpdate}
        />
      </CustomSidebar>
    </>
  );
}