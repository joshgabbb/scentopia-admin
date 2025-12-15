"use client";
import React, { useState, useRef, useEffect } from "react";
import { ArrowLeft, Copy, ExternalLink, ChevronRight, MoreHorizontal, Package, Truck, X } from "lucide-react";
import CustomSidebar from "@/components/modals/sidebar";
import LalaMoveSidebar from "@/components/admin/sidebars/lalamovesidebar";

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
  status: 'Pending' | 'Processing' | 'Shipped' | 'Delivered' | 'Cancelled';
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
    minute: '2-digit'
  });
};

// BLACK & GOLD themed status colors
const getStatusColor = (status: string) => {
  switch (status) {
    case 'Pending':
      return 'bg-yellow-900/20 text-yellow-400 border border-yellow-400/30';
    case 'Processing':
      return 'bg-blue-900/20 text-blue-400 border border-blue-400/30';
    case 'Shipped':
      return 'bg-purple-900/20 text-purple-400 border border-purple-400/30';
    case 'Delivered':
      return 'bg-green-900/20 text-green-400 border border-green-400/30';
    case 'Cancelled':
      return 'bg-red-900/20 text-red-400 border border-red-400/30';
    case 'paid':
    case 'completed':
      return 'bg-green-900/20 text-green-400 border border-green-400/30';
    case 'unpaid':
      return 'bg-red-900/20 text-red-400 border border-red-400/30';
    case 'refunded':
      return 'bg-[#d4af37]/10 text-[#d4af37] border border-[#d4af37]/30';
    default:
      return 'bg-[#d4af37]/10 text-[#b8a070] border border-[#d4af37]/30';
  }
};

const getFulfillmentStatus = (orderStatus: string) => {
  switch (orderStatus) {
    case 'Delivered':
      return { status: 'FULFILLED', color: 'bg-green-900/20 text-green-400 border border-green-400/30' };
    case 'Shipped':
      return { status: 'PARTIALLY FULFILLED', color: 'bg-blue-900/20 text-blue-400 border border-blue-400/30' };
    case 'Processing':
      return { status: 'PROCESSING', color: 'bg-yellow-900/20 text-yellow-400 border border-yellow-400/30' };
    case 'Cancelled':
      return { status: 'CANCELLED', color: 'bg-red-900/20 text-red-400 border border-red-400/30' };
    default:
      return { status: 'UNFULFILLED', color: 'bg-[#d4af37]/10 text-[#b8a070] border border-[#d4af37]/30' };
  }
};

const Skeleton = ({ className }: { className?: string }) => (
  <div className={`animate-pulse bg-[#d4af37]/10 rounded ${className}`}></div>
);

const OrderActionsDropdown = ({ 
  order, 
  onStatusUpdate, 
  onOpenLalaMoveSidebar 
}: { 
  order: Order; 
  onStatusUpdate: (newStatus: string) => void;
  onOpenLalaMoveSidebar: () => void;
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
    switch (order.status) {
      case 'Pending':
        return (
          <button
            onClick={handleProcessOrder}
            disabled={isUpdating}
            className="w-full text-left px-4 py-2 text-sm text-[#f5e6d3] hover:bg-[#d4af37]/10 flex items-center gap-2 disabled:opacity-50 transition-colors"
          >
            <Package size={16} />
            {isUpdating ? 'Processing...' : 'Process Order'}
          </button>
        );
      
      case 'Processing':
        return (
          <button
            onClick={() => {
              setIsOpen(false);
            }}
            className="w-full text-left px-4 py-2 text-sm text-[#f5e6d3] hover:bg-[#d4af37]/10 flex items-center gap-2 transition-colors"
          >
            <Truck size={16} />
            Send with courier
          </button>
        );
      
      default:
        return (
          <div className="px-4 py-2 text-sm text-[#b8a070]">
            No actions available
          </div>
        );
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 hover:bg-[#d4af37]/10 rounded-lg transition-colors text-[#f5e6d3]"
      >
        <MoreHorizontal size={20} />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-[#1a1a1a] border border-[#d4af37]/20 rounded-lg shadow-lg z-50">
          <div className="py-1">
            {renderDropdownItems()}
          </div>
        </div>
      )}
    </div>
  );
};

export default function OrderDetails({ order, isLoading, onBack }: OrderDetailsProps) {
  const [currentOrder, setCurrentOrder] = useState(order);
  const [isLalaMoveSidebarOpen, setIsLalaMoveSidebarOpen] = useState(false);
  const [internalNote, setInternalNote] = useState(order?.note || '');

  useEffect(() => {
    setCurrentOrder(order);
    setInternalNote(order?.note || '');
  }, [order]);

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
      <div className="bg-[#0a0a0a] min-h-screen">
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
              <div className="bg-[#1a1a1a] p-6 rounded-lg border border-[#d4af37]/20">
                <Skeleton className="w-32 h-6 mb-4" />
                <div className="space-y-4">
                  <Skeleton className="w-full h-16" />
                  <Skeleton className="w-full h-16" />
                </div>
              </div>
            </div>
            
            <div className="space-y-6">
              <div className="bg-[#1a1a1a] p-6 rounded-lg border border-[#d4af37]/20">
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
      <div className="p-6 bg-[#0a0a0a] min-h-screen">
        <button 
          onClick={onBack}
          className="flex items-center gap-2 text-[#b8a070] hover:text-[#d4af37] mb-6 transition-colors"
        >
          <ArrowLeft size={20} />
          Back to orders
        </button>
        <div className="text-center text-[#b8a070]">Order not found</div>
      </div>
    );
  }

  const fulfillment = getFulfillmentStatus(currentOrder.status);

  return (
    <>
      <div className="bg-[#0a0a0a] min-h-screen">
        <div className="max-w-7xl mx-auto p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button 
                onClick={onBack}
                className="flex items-center gap-2 text-[#b8a070] hover:text-[#d4af37] transition-colors"
              >
                <ArrowLeft size={20} />
                Back
              </button>
              <div>
                <h1 className="text-2xl font-bold text-[#d4af37]">Order {currentOrder.orderNumber}</h1>
                <p className="text-[#b8a070]">{formatDate(currentOrder.createdAt)}</p>
              </div>
            </div>
            <OrderActionsDropdown
              order={currentOrder}
              onStatusUpdate={handleStatusUpdate}
              onOpenLalaMoveSidebar={() => setIsLalaMoveSidebarOpen(true)}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-[#1a1a1a] p-4 rounded-lg border border-[#d4af37]/20">
              <div className="text-sm text-[#b8a070] mb-1">Order Status</div>
              <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(currentOrder.status)}`}>
                {currentOrder.status}
              </span>
            </div>
            
            <div className="bg-[#1a1a1a] p-4 rounded-lg border border-[#d4af37]/20">
              <div className="text-sm text-[#b8a070] mb-1">Payment Status</div>
              <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(currentOrder.payment?.paymentStatus || 'unpaid')}`}>
                {currentOrder.payment?.paymentStatus || 'Unpaid'}
              </span>
            </div>
            
            <div className="bg-[#1a1a1a] p-4 rounded-lg border border-[#d4af37]/20">
              <div className="text-sm text-[#b8a070] mb-1">Fulfillment</div>
              <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${fulfillment.color}`}>
                {fulfillment.status}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-[#1a1a1a] rounded-lg border border-[#d4af37]/20">
                <div className="p-6 border-b border-[#d4af37]/20">
                  <h2 className="text-lg font-semibold text-[#d4af37]">Order Items ({currentOrder.itemCount})</h2>
                </div>
                <div className="divide-y divide-[#d4af37]/10">
                  {currentOrder.items.map((item, index) => (
                    <div key={index} className="p-6 flex justify-between items-start">
                      <div className="flex-1">
                        <h3 className="font-medium text-[#f5e6d3]">{item.productName}</h3>
                        {item.size && (
                          <p className="text-sm text-[#b8a070] mt-1">Size: {item.size}</p>
                        )}
                        <p className="text-sm text-[#b8a070] mt-1">Quantity: {item.quantity}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium text-[#d4af37]">{formatCurrency(item.itemAmount)}</p>
                        <p className="text-sm text-[#b8a070]">{formatCurrency(item.itemAmount / item.quantity)} each</p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="p-6 border-t border-[#d4af37]/20 bg-[#0a0a0a]">
                  <div className="flex justify-between items-center font-semibold text-lg">
                    <span className="text-[#f5e6d3]">Total</span>
                    <span className="text-[#d4af37]">{formatCurrency(currentOrder.amount)}</span>
                  </div>
                </div>
              </div>

              {currentOrder.payment && (
                <div className="bg-[#1a1a1a] rounded-lg border border-[#d4af37]/20">
                  <div className="p-6 border-b border-[#d4af37]/20">
                    <h2 className="text-lg font-semibold text-[#d4af37]">Payment Information</h2>
                  </div>
                  <div className="p-6 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-[#b8a070]">Payment ID</p>
                        <div className="flex items-center gap-2">
                          <p className="font-mono text-sm text-[#f5e6d3]">{currentOrder.payment.paymentId}</p>
                          <button
                            onClick={() => copyToClipboard(currentOrder.payment?.paymentId || '')}
                            className="text-[#b8a070] hover:text-[#d4af37] transition-colors"
                          >
                            <Copy size={16} />
                          </button>
                        </div>
                      </div>
                      <div>
                        <p className="text-sm text-[#b8a070]">Payment Method</p>
                        <p className="font-medium text-[#f5e6d3]">{currentOrder.payment.paymentMethod}</p>
                      </div>
                      <div>
                        <p className="text-sm text-[#b8a070]">Amount</p>
                        <p className="font-medium text-[#d4af37]">{formatCurrency(currentOrder.payment.paymentAmount)} {currentOrder.payment.currency}</p>
                      </div>
                      <div>
                        <p className="text-sm text-[#b8a070]">Payment Date</p>
                        <p className="font-medium text-[#f5e6d3]">{formatDate(currentOrder.payment.paymentCreatedAt)}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-6">
              <div className="bg-[#1a1a1a] rounded-lg border border-[#d4af37]/20">
                <div className="p-6 border-b border-[#d4af37]/20">
                  <h2 className="text-lg font-semibold text-[#d4af37]">Customer</h2>
                </div>
                <div className="p-6 space-y-4">
                  <div>
                    <p className="text-sm text-[#b8a070]">Name</p>
                    <p className="font-medium text-[#f5e6d3]">{currentOrder.customerName}</p>
                  </div>
                  <div>
                    <p className="text-sm text-[#b8a070]">Email</p>
                    <p className="font-medium text-[#f5e6d3]">{currentOrder.customerEmail}</p>
                  </div>
                  {currentOrder.customerPhone && (
                    <div>
                      <p className="text-sm text-[#b8a070]">Phone</p>
                      <p className="font-medium text-[#f5e6d3]">{currentOrder.customerPhone}</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-[#1a1a1a] rounded-lg border border-[#d4af37]/20">
                <div className="p-6 border-b border-[#d4af37]/20">
                  <h2 className="text-lg font-semibold text-[#d4af37]">Internal Notes</h2>
                </div>
                <div className="p-6">
                  <textarea
                    value={internalNote}
                    onChange={(e) => setInternalNote(e.target.value)}
                    className="w-full p-3 border border-[#d4af37]/20 bg-[#0a0a0a] text-[#f5e6d3] placeholder-[#b8a070] rounded-lg focus:ring-2 focus:ring-[#d4af37] focus:border-transparent"
                    rows={4}
                    placeholder="Add internal notes about this order..."
                  />
                  <button className="mt-3 px-4 py-2 bg-[#d4af37] text-[#0a0a0a] rounded-lg hover:bg-[#d4af37]/90 transition-colors">
                    Save Notes
                  </button>
                </div>
              </div>

              {(currentOrder.status === 'Shipped' || currentOrder.status === 'Delivered') && (
                <div className="bg-[#1a1a1a] rounded-lg border border-[#d4af37]/20">
                  <div className="p-6 border-b border-[#d4af37]/20">
                    <h2 className="text-lg font-semibold text-[#d4af37]">Tracking Information</h2>
                  </div>
                  <div className="p-6 space-y-4">
                    {currentOrder.trackingNumber && (
                      <div>
                        <p className="text-sm text-[#b8a070]">Tracking Number</p>
                        <div className="flex items-center gap-2">
                          <p className="font-mono text-sm text-[#f5e6d3]">{currentOrder.trackingNumber}</p>
                          <button
                            onClick={() => copyToClipboard(currentOrder.trackingNumber || '')}
                            className="text-[#b8a070] hover:text-[#d4af37] transition-colors"
                          >
                            <Copy size={16} />
                          </button>
                        </div>
                      </div>
                    )}
                    {currentOrder.courier && (
                      <div>
                        <p className="text-sm text-[#b8a070]">Courier</p>
                        <p className="font-medium text-[#f5e6d3]">{currentOrder.courier}</p>
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
        isOpen={isLalaMoveSidebarOpen}
        onClose={() => setIsLalaMoveSidebarOpen(false)}
        title="Send with LalaMove"
      >
        <LalaMoveSidebar
          order={currentOrder}
          onClose={() => setIsLalaMoveSidebarOpen(false)}
          onStatusUpdate={handleStatusUpdate}
        />
      </CustomSidebar>
    </>
  );
}