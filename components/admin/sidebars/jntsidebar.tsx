"use client";
import React, { useState, useEffect } from 'react';
import { Truck, ExternalLink, Package, MapPin, Clock, Copy, Check, User, Phone } from 'lucide-react';

interface Order {
  id: string;
  customerName: string;
  customerPhone?: string;
  customerEmail?: string;
  orderNumber: string;
  deliveryAddress?: string;
  recipientName?: string;
  recipientPhone?: string;
  deliveryLocation?: {
    address?: string;
    full_address?: string;
    region?: { code?: string; name?: string };
    province?: { code?: string; name?: string };
    city?: { code?: string; name?: string };
    barangay?: { code?: string; name?: string };
    street_address?: string;
    postal_code?: string;
    recipient_name?: string;
    phone_number?: string;
    latitude?: number;
    longitude?: number;
  };
  amount?: number;
  shippingFee?: number;
}

interface JntSidebarProps {
  order: Order;
  onClose: () => void;
  onStatusUpdate: (newStatus: string) => void;
}

// Shipping zones and rates based on Philippine regions
const SHIPPING_ZONES = {
  METRO_MANILA: { baseFee: 85, estimatedDays: '2-3', label: 'Metro Manila' },
  LUZON: { baseFee: 115, estimatedDays: '3-5', label: 'Luzon (Provincial)' },
  VISAYAS: { baseFee: 150, estimatedDays: '5-7', label: 'Visayas' },
  MINDANAO: { baseFee: 170, estimatedDays: '5-7', label: 'Mindanao' },
};

const WEIGHT_FEE_PER_500G = 20;

export default function JntSidebar({ order, onClose, onStatusUpdate }: JntSidebarProps) {
  // Get recipient info from order's delivery location or customer profile (already registered)
  const recipientName = order.deliveryLocation?.recipient_name || order.recipientName || order.customerName || '';
  const recipientPhone = order.deliveryLocation?.phone_number || order.recipientPhone || order.customerPhone || '';
  const regionName = order.deliveryLocation?.region?.name || '';
  const provinceName = order.deliveryLocation?.province?.name || '';
  const cityName = order.deliveryLocation?.city?.name || '';
  const barangayName = order.deliveryLocation?.barangay?.name || '';
  const streetAddress = order.deliveryLocation?.street_address || '';
  const fullAddress = order.deliveryLocation?.full_address
    || order.deliveryLocation?.address
    || order.deliveryAddress
    || [streetAddress, barangayName, cityName, provinceName, regionName].filter(Boolean).join(', ');

  const [packageWeight, setPackageWeight] = useState(0.5);
  const [notes, setNotes] = useState(`Order ${order.orderNumber}`);
  const [selectedZone, setSelectedZone] = useState<keyof typeof SHIPPING_ZONES>('METRO_MANILA');
  const [shippingFee, setShippingFee] = useState(order.shippingFee || 85);
  const [isCreatingDelivery, setIsCreatingDelivery] = useState(false);
  const [deliveryResult, setDeliveryResult] = useState<any>(null);
  const [error, setError] = useState<string>('');
  const [copied, setCopied] = useState(false);

  // Auto-detect shipping zone based on region
  useEffect(() => {
    const region = regionName.toLowerCase();
    if (region.includes('ncr') || region.includes('metro manila') || region.includes('national capital')) {
      setSelectedZone('METRO_MANILA');
    } else if (region.includes('visayas') || region.includes('cebu') || region.includes('iloilo') ||
               region.includes('negros') || region.includes('bohol') || region.includes('leyte') ||
               region.includes('samar') || region.includes('aklan') || region.includes('antique') ||
               region.includes('region vi') || region.includes('region vii') || region.includes('region viii')) {
      setSelectedZone('VISAYAS');
    } else if (region.includes('mindanao') || region.includes('davao') || region.includes('zamboanga') ||
               region.includes('bukidnon') || region.includes('cotabato') || region.includes('caraga') ||
               region.includes('soccsksargen') || region.includes('armm') || region.includes('barmm') ||
               region.includes('region ix') || region.includes('region x') || region.includes('region xi') ||
               region.includes('region xii') || region.includes('region xiii')) {
      setSelectedZone('MINDANAO');
    } else if (region) {
      setSelectedZone('LUZON');
    }
  }, [regionName]);

  // Use existing shipping fee from order if available, otherwise calculate
  useEffect(() => {
    if (order.shippingFee && order.shippingFee > 0) {
      setShippingFee(order.shippingFee);
    } else {
      const zone = SHIPPING_ZONES[selectedZone];
      const baseFee = zone.baseFee;
      const weightFee = Math.max(0, Math.ceil((packageWeight - 0.5) / 0.5)) * WEIGHT_FEE_PER_500G;
      setShippingFee(baseFee + weightFee);
    }
  }, [selectedZone, packageWeight, order.shippingFee]);

  const generateWaybillNumber = () => {
    const timestamp = Date.now().toString().slice(-10);
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `JNT${timestamp}${random}PH`;
  };

  const handleCreateDelivery = async () => {
    setIsCreatingDelivery(true);
    setError('');

    try {
      if (!recipientName) {
        setError('Missing recipient name. Please ensure the customer provided their name.');
        return;
      }

      if (!fullAddress) {
        setError('Missing delivery address. Please ensure the customer provided their delivery address.');
        return;
      }

      const waybillNumber = generateWaybillNumber();
      const estimatedDays = parseInt(SHIPPING_ZONES[selectedZone].estimatedDays.split('-')[1]);
      const estimatedDelivery = new Date();
      estimatedDelivery.setDate(estimatedDelivery.getDate() + estimatedDays);

      const deliveryRequest = {
        orderId: order.id,
        waybillNumber,
        courierCode: 'JNT',
        courierName: 'J&T Express',
        shippingFee,
        estimatedDelivery: estimatedDelivery.toISOString(),
        recipientInfo: {
          name: recipientName,
          phone: recipientPhone,
          address: fullAddress,
          region: regionName,
          province: provinceName,
          city: cityName,
          barangay: barangayName,
        },
        packageWeight,
        notes,
        zone: selectedZone,
      };

      console.log('Creating J&T delivery with:', deliveryRequest);

      const response = await fetch('/api/admin/orders/create-jnt-delivery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(deliveryRequest)
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || `HTTP ${response.status}`);
      }

      if (result.success) {
        setDeliveryResult({
          waybillNumber,
          shippingFee,
          estimatedDelivery: estimatedDelivery.toLocaleDateString('en-PH', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          }),
          zone: SHIPPING_ZONES[selectedZone].label,
          status: 'Shipped',
          trackingUrl: `https://www.jtexpress.ph/index/query/gzquery.html?waybillnumber=${waybillNumber}`
        });

        // Update order status to Shipped
        try {
          const statusResponse = await fetch(`/api/admin/orders/${order.id}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              status: 'Shipped',
              title: 'Order Shipped via J&T Express',
              body: `Your order has been shipped! Tracking number: ${waybillNumber}. Expected delivery: ${estimatedDelivery.toLocaleDateString('en-PH')}`
            })
          });

          if (statusResponse.ok) {
            onStatusUpdate('Shipped');
          }
        } catch (statusError) {
          console.error('Failed to update order status:', statusError);
        }
      } else {
        throw new Error(result.error || 'Failed to create delivery');
      }
    } catch (error) {
      console.error('Failed to create delivery:', error);
      setError(error instanceof Error ? error.message : 'Failed to create delivery');
    } finally {
      setIsCreatingDelivery(false);
    }
  };

  const copyWaybill = () => {
    if (deliveryResult?.waybillNumber) {
      navigator.clipboard.writeText(deliveryResult.waybillNumber);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Success screen
  if (deliveryResult) {
    return (
      <div className="p-0 space-y-4 bg-white">
        {/* Success Header */}
        <div className="bg-gradient-to-r from-green-500 to-green-600 -mx-6 -mt-6 px-6 py-6 mb-4 text-center">
          <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-3 shadow-lg">
            <Check size={32} className="text-green-600" />
          </div>
          <h3 className="text-xl font-bold text-white">
            Shipment Created!
          </h3>
          <p className="text-green-100 text-sm mt-1">
            J&T Express delivery confirmed
          </p>
        </div>

        {/* Waybill Card */}
        <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4">
          <div className="text-center mb-3">
            <p className="text-xs text-red-600 font-semibold uppercase tracking-wider">Waybill Number</p>
            <div className="flex items-center justify-center gap-2 mt-1">
              <span className="font-mono text-xl font-bold text-red-700">{deliveryResult.waybillNumber}</span>
              <button
                onClick={copyWaybill}
                className="p-2 hover:bg-red-100 rounded-full text-red-600 transition-colors"
                title="Copy waybill number"
              >
                {copied ? <Check size={18} className="text-green-600" /> : <Copy size={18} />}
              </button>
            </div>
          </div>
        </div>

        {/* Details */}
        <div className="bg-white border-2 border-gray-200 rounded-lg p-4 space-y-3">
          <div className="flex justify-between items-center py-2 border-b border-gray-100">
            <span className="text-sm text-gray-600">Shipping Fee</span>
            <span className="font-bold text-red-600 text-lg">₱{deliveryResult.shippingFee.toFixed(2)}</span>
          </div>
          <div className="flex justify-between items-center py-2 border-b border-gray-100">
            <span className="text-sm text-gray-600">Delivery Zone</span>
            <span className="font-medium text-gray-900">{deliveryResult.zone}</span>
          </div>
          <div className="flex justify-between items-center py-2 border-b border-gray-100">
            <span className="text-sm text-gray-600">Expected Delivery</span>
            <span className="font-medium text-gray-900">{deliveryResult.estimatedDelivery}</span>
          </div>
          <div className="flex justify-between items-center py-2">
            <span className="text-sm text-gray-600">Status</span>
            <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-semibold">
              {deliveryResult.status}
            </span>
          </div>
        </div>

        {/* Track Button */}
        {deliveryResult.trackingUrl && (
          <a
            href={deliveryResult.trackingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 text-white bg-red-600 hover:bg-red-700 py-3 rounded-lg font-semibold transition-colors shadow-md"
          >
            <ExternalLink size={18} />
            Track on J&T Express
          </a>
        )}

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <p className="text-blue-700 text-sm">
            <strong>✓ Customer Notified:</strong> The customer will receive a notification with the tracking number.
          </p>
        </div>

        <button
          onClick={onClose}
          className="w-full px-4 py-3 bg-gray-800 text-white hover:bg-gray-900 rounded-lg font-semibold transition-colors"
        >
          DONE
        </button>
      </div>
    );
  }

  return (
    <div className="p-0 space-y-4 bg-white">
      {/* J&T Header */}
      <div className="bg-gradient-to-r from-red-600 to-red-700 -mx-6 -mt-6 px-6 py-4 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-white rounded-lg flex items-center justify-center shadow-md">
            <Truck size={24} className="text-red-600" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">J&T Express</h3>
            <p className="text-sm text-red-100">Order {order.orderNumber}</p>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-300 rounded-lg p-3">
          <p className="text-red-700 text-sm font-medium">{error}</p>
        </div>
      )}

      <div className="space-y-4">
        {/* Recipient Information */}
        <div className="bg-white border-2 border-red-100 rounded-lg p-4">
          <h4 className="font-semibold text-red-700 mb-3 flex items-center gap-2 text-sm uppercase tracking-wide">
            <User size={16} />
            Recipient Information
          </h4>
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2 text-gray-800">
              <User size={14} className="text-red-500" />
              <span className="font-medium">{recipientName || 'Not provided'}</span>
            </div>
            <div className="flex items-center gap-2 text-gray-800">
              <Phone size={14} className="text-red-500" />
              <span>{recipientPhone || 'Not provided'}</span>
            </div>
          </div>
        </div>

        {/* Delivery Address */}
        <div className="bg-white border-2 border-red-100 rounded-lg p-4">
          <h4 className="font-semibold text-red-700 mb-3 flex items-center gap-2 text-sm uppercase tracking-wide">
            <MapPin size={16} />
            Delivery Address
          </h4>
          <p className="text-sm text-gray-800">{fullAddress || 'No address provided'}</p>
          {regionName && (
            <div className="mt-2 flex flex-wrap gap-1">
              <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs font-medium">{regionName}</span>
              {provinceName && <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs font-medium">{provinceName}</span>}
            </div>
          )}
        </div>

        {/* Shipping Details */}
        <div className="bg-white border-2 border-red-100 rounded-lg p-4">
          <h4 className="font-semibold text-red-700 mb-3 flex items-center gap-2 text-sm uppercase tracking-wide">
            <Clock size={16} />
            Shipping Details
          </h4>

          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Delivery Zone
              </label>
              <select
                value={selectedZone}
                onChange={(e) => setSelectedZone(e.target.value as keyof typeof SHIPPING_ZONES)}
                className="w-full p-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 bg-white text-gray-900"
              >
                {Object.entries(SHIPPING_ZONES).map(([key, value]) => (
                  <option key={key} value={key}>
                    {value.label} - ₱{value.baseFee} ({value.estimatedDays} days)
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Weight (kg)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  value={packageWeight}
                  onChange={(e) => setPackageWeight(parseFloat(e.target.value) || 0.5)}
                  className="w-full p-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 bg-white text-gray-900"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Shipping Fee
                </label>
                <div className="w-full p-3 border-2 border-red-200 rounded-lg bg-red-50 text-red-700 font-bold text-center">
                  ₱{shippingFee.toFixed(2)}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Delivery Notes (Optional)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full p-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 bg-white text-gray-900"
            rows={2}
            placeholder="Special instructions for delivery..."
          />
        </div>

        {/* Shipping Summary */}
        <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4">
          <h5 className="font-semibold mb-3 text-red-700 text-sm uppercase tracking-wide">Shipping Summary</h5>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Zone:</span>
              <span className="text-gray-900 font-medium">{SHIPPING_ZONES[selectedZone].label}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Estimated Delivery:</span>
              <span className="text-gray-900 font-medium">{SHIPPING_ZONES[selectedZone].estimatedDays} business days</span>
            </div>
            <div className="flex justify-between font-bold pt-2 border-t border-red-200 mt-2">
              <span className="text-gray-900">Total:</span>
              <span className="text-red-600 text-lg">₱{shippingFee.toFixed(2)}</span>
            </div>
          </div>
        </div>

        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
          <p className="text-gray-600 text-sm">
            <strong className="text-gray-800">Note:</strong> Click "Ship Order" to generate waybill and notify the customer.
          </p>
        </div>
      </div>

      <div className="flex gap-3 pt-4 border-t border-gray-200">
        <button
          onClick={onClose}
          className="flex-1 px-4 py-3 border-2 border-gray-300 hover:bg-gray-50 rounded-lg text-gray-700 font-semibold transition-colors"
          disabled={isCreatingDelivery}
        >
          CANCEL
        </button>
        <button
          onClick={handleCreateDelivery}
          disabled={isCreatingDelivery || !recipientName || !fullAddress}
          className="flex-1 px-4 py-3 bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg flex items-center justify-center gap-2 font-semibold transition-colors shadow-md"
        >
          {isCreatingDelivery ? (
            <>
              <span className="animate-spin">⏳</span>
              CREATING...
            </>
          ) : (
            <>
              <Truck size={18} />
              SHIP ORDER
            </>
          )}
        </button>
      </div>
    </div>
  );
}
