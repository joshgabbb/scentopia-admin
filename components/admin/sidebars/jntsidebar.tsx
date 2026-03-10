"use client";
import React, { useState, useEffect } from 'react';
import { Truck, ExternalLink, Package, MapPin, Clock, Copy, Check, User, Phone } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';

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
  const { themeClasses: tc, isDark } = useTheme();

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
          // Status update failure is non-critical
        }
      } else {
        throw new Error(result.error || 'Failed to create delivery');
      }
    } catch (error) {
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

  // Conditional red-tint card classes for dark/light mode
  const redCardClass = isDark
    ? 'bg-red-900/20 border border-red-800/40'
    : 'bg-red-50 border border-red-200';

  const inputClass = `w-full px-3 py-2.5 rounded-md border ${tc.border} ${tc.inputBg} ${tc.text} text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-colors`;

  // ── Success screen ──────────────────────────────────────────────────────────
  if (deliveryResult) {
    return (
      <div className={`p-0 space-y-4 ${tc.bg}`}>
        {/* Success Header */}
        <div className="bg-gradient-to-r from-green-600 to-green-700 -mx-6 -mt-6 px-6 py-6 mb-4 text-center">
          <div className={`w-14 h-14 ${tc.bg} rounded-full flex items-center justify-center mx-auto mb-3 shadow-lg`}>
            <Check size={28} className="text-green-600" />
          </div>
          <h3 className="text-lg font-bold text-white tracking-wide">Shipment Created</h3>
          <p className="text-green-100 text-sm mt-0.5">J&T Express delivery confirmed</p>
        </div>

        {/* Waybill Card */}
        <div className={`${redCardClass} rounded-lg p-4`}>
          <p className="text-xs text-red-600 font-semibold uppercase tracking-wider text-center mb-2">
            Waybill Number
          </p>
          <div className="flex items-center justify-center gap-2">
            <span className="font-mono text-xl font-bold text-red-600">{deliveryResult.waybillNumber}</span>
            <button
              onClick={copyWaybill}
              className={`p-1.5 rounded-md transition-colors ${isDark ? 'hover:bg-red-800/40' : 'hover:bg-red-100'}`}
              title="Copy waybill number"
            >
              {copied
                ? <Check size={16} className="text-green-500" />
                : <Copy size={16} className="text-red-500" />
              }
            </button>
          </div>
        </div>

        {/* Details */}
        <div className={`${tc.bgSecondary} border ${tc.border} rounded-lg divide-y ${isDark ? 'divide-[#2e2a1e]' : 'divide-[#e8e0d0]'}`}>
          {[
            { label: 'Shipping Fee', value: `₱${deliveryResult.shippingFee.toFixed(2)}`, valueClass: 'font-bold text-red-600 text-base' },
            { label: 'Delivery Zone', value: deliveryResult.zone, valueClass: `font-medium ${tc.text}` },
            { label: 'Expected Delivery', value: deliveryResult.estimatedDelivery, valueClass: `font-medium ${tc.text}` },
          ].map(({ label, value, valueClass }) => (
            <div key={label} className="flex justify-between items-center px-4 py-3">
              <span className={`text-sm ${tc.textMuted}`}>{label}</span>
              <span className={`text-sm ${valueClass}`}>{value}</span>
            </div>
          ))}
          <div className="flex justify-between items-center px-4 py-3">
            <span className={`text-sm ${tc.textMuted}`}>Status</span>
            <span className="px-2.5 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-semibold">
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
            className="flex items-center justify-center gap-2 text-white bg-red-600 hover:bg-red-700 py-2.5 rounded-md font-semibold text-sm transition-colors shadow-md"
          >
            <ExternalLink size={16} />
            Track on J&T Express
          </a>
        )}

        <div className={`${isDark ? 'bg-blue-900/20 border-blue-800/40 text-blue-300' : 'bg-blue-50 border-blue-200 text-blue-700'} border rounded-lg p-3`}>
          <p className="text-sm">
            <strong>Customer Notified:</strong> The customer will receive a notification with the tracking number.
          </p>
        </div>

        <button
          onClick={onClose}
          className="w-full px-4 py-2.5 bg-red-600 text-white hover:bg-red-700 rounded-md font-semibold text-sm tracking-wider transition-colors shadow-sm"
        >
          DONE
        </button>
      </div>
    );
  }

  // ── Main form ───────────────────────────────────────────────────────────────
  return (
    <div className={`p-0 space-y-4 ${tc.bg}`}>
      {/* J&T Header */}
      <div className="bg-gradient-to-r from-red-600 to-red-700 -mx-6 -mt-6 px-6 py-4 mb-4">
        <div className="flex items-center gap-3">
          <div className={`w-11 h-11 ${tc.bg} rounded-md flex items-center justify-center shadow-md flex-shrink-0`}>
            <Truck size={22} className="text-red-600" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white tracking-wide">J&T Express</h3>
            <p className="text-xs text-red-100">Order #{order.orderNumber}</p>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-300 rounded-md p-3">
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}

      <div className="space-y-3">
        {/* Recipient Information */}
        <div className={`${tc.bgSecondary} border ${tc.border} rounded-lg p-4`}>
          <h4 className="font-semibold text-red-600 mb-3 flex items-center gap-2 text-xs uppercase tracking-widest">
            <User size={14} />
            Recipient
          </h4>
          <div className="space-y-2">
            <div className={`flex items-center gap-2 text-sm ${tc.text}`}>
              <User size={13} className="text-red-500 flex-shrink-0" />
              <span className="font-medium">{recipientName || <span className={tc.textMuted}>Not provided</span>}</span>
            </div>
            <div className={`flex items-center gap-2 text-sm ${tc.text}`}>
              <Phone size={13} className="text-red-500 flex-shrink-0" />
              <span>{recipientPhone || <span className={tc.textMuted}>Not provided</span>}</span>
            </div>
          </div>
        </div>

        {/* Delivery Address */}
        <div className={`${tc.bgSecondary} border ${tc.border} rounded-lg p-4`}>
          <h4 className="font-semibold text-red-600 mb-3 flex items-center gap-2 text-xs uppercase tracking-widest">
            <MapPin size={14} />
            Delivery Address
          </h4>
          <p className={`text-sm leading-relaxed ${tc.text}`}>{fullAddress || <span className={tc.textMuted}>No address provided</span>}</p>
          {regionName && (
            <div className="mt-2 flex flex-wrap gap-1">
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${isDark ? 'bg-red-900/30 text-red-400' : 'bg-red-100 text-red-700'}`}>
                {regionName}
              </span>
              {provinceName && (
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${isDark ? 'bg-red-900/30 text-red-400' : 'bg-red-100 text-red-700'}`}>
                  {provinceName}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Shipping Details */}
        <div className={`${tc.bgSecondary} border ${tc.border} rounded-lg p-4`}>
          <h4 className="font-semibold text-red-600 mb-3 flex items-center gap-2 text-xs uppercase tracking-widest">
            <Clock size={14} />
            Shipping Details
          </h4>

          <div className="space-y-3">
            <div>
              <label className={`block text-xs font-medium ${tc.textMuted} mb-1.5 uppercase tracking-wide`}>
                Delivery Zone
              </label>
              <select
                value={selectedZone}
                onChange={(e) => setSelectedZone(e.target.value as keyof typeof SHIPPING_ZONES)}
                className={inputClass}
              >
                {Object.entries(SHIPPING_ZONES).map(([key, value]) => (
                  <option key={key} value={key}>
                    {value.label} — ₱{value.baseFee} ({value.estimatedDays} days)
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={`block text-xs font-medium ${tc.textMuted} mb-1.5 uppercase tracking-wide`}>
                  Weight (kg)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  value={packageWeight}
                  onChange={(e) => setPackageWeight(parseFloat(e.target.value) || 0.5)}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={`block text-xs font-medium ${tc.textMuted} mb-1.5 uppercase tracking-wide`}>
                  Shipping Fee
                </label>
                <div className={`w-full px-3 py-2.5 rounded-md text-sm font-bold text-center ${redCardClass} text-red-600`}>
                  ₱{shippingFee.toFixed(2)}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className={`block text-xs font-medium ${tc.textMuted} mb-1.5 uppercase tracking-wide`}>
            Delivery Notes (Optional)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className={`${inputClass} resize-none`}
            rows={2}
            placeholder="Special instructions for delivery..."
          />
        </div>

        {/* Shipping Summary */}
        <div className={`${redCardClass} rounded-lg p-4`}>
          <h5 className="font-semibold text-red-600 mb-3 text-xs uppercase tracking-widest">Shipping Summary</h5>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className={tc.textMuted}>Zone</span>
              <span className={`font-medium ${tc.text}`}>{SHIPPING_ZONES[selectedZone].label}</span>
            </div>
            <div className="flex justify-between">
              <span className={tc.textMuted}>Est. Delivery</span>
              <span className={`font-medium ${tc.text}`}>{SHIPPING_ZONES[selectedZone].estimatedDays} business days</span>
            </div>
            <div className={`flex justify-between font-bold pt-2 mt-1 border-t ${isDark ? 'border-red-800/40' : 'border-red-200'}`}>
              <span className={tc.text}>Total</span>
              <span className="text-red-600 text-base">₱{shippingFee.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Note callout */}
        <div className={`${tc.bgSecondary} border ${tc.border} rounded-md p-3`}>
          <p className={`text-xs ${tc.textMuted}`}>
            <span className={`font-semibold ${tc.text}`}>Note:</span>{' '}
            Click "Ship Order" to generate a waybill and notify the customer.
          </p>
        </div>
      </div>

      {/* Action Buttons */}
      <div className={`flex gap-3 pt-4 border-t ${tc.border}`}>
        <button
          onClick={onClose}
          disabled={isCreatingDelivery}
          className={`flex-1 px-4 py-2.5 border ${tc.border} rounded-md text-sm font-semibold ${tc.text} transition-colors disabled:opacity-50 ${tc.hoverBg}`}
        >
          CANCEL
        </button>
        <button
          onClick={handleCreateDelivery}
          disabled={isCreatingDelivery || !recipientName || !fullAddress}
          className="flex-1 px-4 py-2.5 bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-md flex items-center justify-center gap-2 text-sm font-semibold transition-colors shadow-sm"
        >
          {isCreatingDelivery ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              CREATING...
            </>
          ) : (
            <>
              <Truck size={16} />
              SHIP ORDER
            </>
          )}
        </button>
      </div>
    </div>
  );
}
