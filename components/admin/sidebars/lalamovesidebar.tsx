"use client";
import React, { useState, useEffect } from 'react';
import { Truck, ExternalLink } from 'lucide-react';

interface DeliveryLocation {
  address?: string;
  full_address?: string;
  coordinates?: { lat?: number; lng?: number };
  shipping_fee?: number;
  delivery_snapshot?: {
    full_address?: string;
    recipient_name?: string;
    recipient_phone?: string;
    street_address?: string;
    barangay?: string;
    city_municipality?: string;
    province?: string;
    region?: string;
    postal_code?: string;
    coordinates?: { lat?: number; lng?: number };
  };
  recipient_name?: string;
  phone_number?: string;
  latitude?: number;
  longitude?: number;
  [key: string]: any;
}

interface Order {
  id: string;
  customerName: string;
  customerPhone?: string;
  orderNumber: string;
  deliveryAddress?: string;
  deliveryLocation?: DeliveryLocation;
  recipientName?: string;
  recipientPhone?: string;
}

interface LalaMoveSidebarProps {
  order: Order;
  onClose: () => void;
  onStatusUpdate: (newStatus: string) => void;
}

// Store defaults from public env vars (set NEXT_PUBLIC_LALAMOVE_STORE_* in .env.local)
const STORE_LAT = process.env.NEXT_PUBLIC_LALAMOVE_STORE_LAT || '14.5851';
const STORE_LNG = process.env.NEXT_PUBLIC_LALAMOVE_STORE_LNG || '121.1762';
const STORE_ADDRESS = process.env.NEXT_PUBLIC_LALAMOVE_STORE_ADDRESS
  || 'Block 1 Lot 67, San Jose Heights, Brgy. San Jose, Antipolo City, Rizal';
const STORE_SENDER_NAME = process.env.NEXT_PUBLIC_LALAMOVE_SENDER_NAME || 'Scentopia';
const STORE_SENDER_PHONE = process.env.NEXT_PUBLIC_LALAMOVE_SENDER_PHONE || '+63000000000';

function resolveCoords(loc?: DeliveryLocation): { lat: string; lng: string } {
  // Prefer top-level coordinates (mobile format), then snapshot coords, then legacy lat/lng
  const c = loc?.coordinates ?? loc?.delivery_snapshot?.coordinates;
  if (c?.lat && c?.lng) return { lat: String(c.lat), lng: String(c.lng) };
  if (loc?.latitude && loc?.longitude) return { lat: String(loc.latitude), lng: String(loc.longitude) };
  return { lat: '', lng: '' };
}

function resolveDeliveryAddress(order: Order): string {
  return order.deliveryAddress
    || order.deliveryLocation?.delivery_snapshot?.full_address
    || order.deliveryLocation?.full_address
    || order.deliveryLocation?.address
    || '';
}

function normalisePhone(phone?: string): string {
  if (!phone) return '';
  const trimmed = phone.trim();
  // Already has country code
  if (trimmed.startsWith('+')) return trimmed;
  // Strip leading 0 and add +63
  if (trimmed.startsWith('0')) return '+63' + trimmed.slice(1);
  return '+63' + trimmed;
}

export default function LalaMoveSidebar({ order, onClose, onStatusUpdate }: LalaMoveSidebarProps) {
  const coords = resolveCoords(order.deliveryLocation);
  const recipientName = order.recipientName
    || order.deliveryLocation?.delivery_snapshot?.recipient_name
    || order.deliveryLocation?.recipient_name
    || order.customerName;
  const recipientPhone = normalisePhone(
    order.recipientPhone
    || order.deliveryLocation?.delivery_snapshot?.recipient_phone
    || order.deliveryLocation?.phone_number
    || order.customerPhone
  );

  const [deliveryDetails, setDeliveryDetails] = useState({
    pickupLat: STORE_LAT,
    pickupLng: STORE_LNG,
    pickupAddress: STORE_ADDRESS,
    deliveryLat: coords.lat,
    deliveryLng: coords.lng,
    deliveryAddress: resolveDeliveryAddress(order),
    senderName: STORE_SENDER_NAME,
    senderPhone: STORE_SENDER_PHONE,
    recipientName,
    recipientPhone,
    notes: `Order ${order.orderNumber}`,
    serviceType: 'MOTORCYCLE',
  });

  // Re-populate if order changes (e.g. sidebar stays open between orders)
  useEffect(() => {
    const c = resolveCoords(order.deliveryLocation);
    const rName = order.recipientName
      || order.deliveryLocation?.delivery_snapshot?.recipient_name
      || order.deliveryLocation?.recipient_name
      || order.customerName;
    const rPhone = normalisePhone(
      order.recipientPhone
      || order.deliveryLocation?.delivery_snapshot?.recipient_phone
      || order.deliveryLocation?.phone_number
      || order.customerPhone
    );
    setDeliveryDetails(prev => ({
      ...prev,
      deliveryLat: c.lat || prev.deliveryLat,
      deliveryLng: c.lng || prev.deliveryLng,
      deliveryAddress: resolveDeliveryAddress(order) || prev.deliveryAddress,
      recipientName: rName || prev.recipientName,
      recipientPhone: rPhone || prev.recipientPhone,
      notes: `Order ${order.orderNumber}`,
    }));
  }, [order.id]);

  const [isCreatingDelivery, setIsCreatingDelivery] = useState(false);
  const [deliveryResult, setDeliveryResult] = useState<any>(null);
  const [error, setError] = useState<string>('');

  const handleCreateDelivery = async () => {
    setIsCreatingDelivery(true);
    setError('');

    try {
      if (!deliveryDetails.deliveryLat || !deliveryDetails.deliveryLng || !deliveryDetails.deliveryAddress) {
        setError('Please fill in delivery coordinates and address');
        return;
      }

      if (!deliveryDetails.recipientPhone.startsWith('+')) {
        setError('Phone number must include country code (e.g., +63912345678)');
        return;
      }

      const deliveryRequest = {
        orderId: order.id,
        pickupAddress: {
          lat: parseFloat(deliveryDetails.pickupLat),
          lng: parseFloat(deliveryDetails.pickupLng),
          address: deliveryDetails.pickupAddress,
        },
        deliveryAddress: {
          lat: parseFloat(deliveryDetails.deliveryLat),
          lng: parseFloat(deliveryDetails.deliveryLng),
          address: deliveryDetails.deliveryAddress,
        },
        senderInfo: {
          name: deliveryDetails.senderName,
          phone: deliveryDetails.senderPhone,
        },
        recipientInfo: {
          name: deliveryDetails.recipientName,
          phone: deliveryDetails.recipientPhone,
        },
        serviceType: deliveryDetails.serviceType,
        notes: deliveryDetails.notes,
      };

      const response = await fetch('/api/admin/orders/create-delivery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(deliveryRequest),
      });

      const result = await response.json();

      if (!response.ok) throw new Error(result.details || result.error || `HTTP ${response.status}`);

      if (result.success) {
        setDeliveryResult(result.data);

        try {
          const statusResponse = await fetch(`/api/admin/orders/${order.id}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              status: 'Shipped',
              title: 'Order Shipped via Lalamove',
              body: `Your order has been dispatched for same-day delivery. Track: ${result.data.shareLink}`,
            }),
          });
          if (statusResponse.ok) onStatusUpdate('Shipped');
        } catch (statusError) {
          console.error('Failed to update order status:', statusError);
        }
      } else {
        throw new Error(result.error || 'Failed to create delivery');
      }
    } catch (err) {
      console.error('Failed to create delivery:', err);
      setError(err instanceof Error ? err.message : 'Failed to create delivery');
    } finally {
      setIsCreatingDelivery(false);
    }
  };

  if (deliveryResult) {
    return (
      <div className="p-0 space-y-6">
        <div className="text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Truck size={24} className="text-green-600" />
          </div>
          <h3 className="text-lg font-semibold text-green-800 mb-2">Delivery Created!</h3>
          <p className="text-[#7a6a4a] mb-6">Order dispatched via Lalamove same-day delivery</p>
        </div>

        <div className="bg-gray-100 rounded-lg p-4 space-y-3">
          <div className="flex justify-between">
            <span className="text-sm text-[#7a6a4a]">Lalamove Order ID:</span>
            <span className="font-mono text-sm">{deliveryResult.lalamoveOrderId}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-[#7a6a4a]">Delivery Cost:</span>
            <span className="font-medium">{deliveryResult.deliveryAmount} {deliveryResult.currency}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-[#7a6a4a]">Status:</span>
            <span className="font-medium">{deliveryResult.status}</span>
          </div>
          {deliveryResult.shareLink && (
            <div>
              <span className="text-sm text-[#7a6a4a]">Tracking Link:</span>
              <a
                href={deliveryResult.shareLink}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-blue-600 hover:text-blue-800 text-sm mt-1"
              >
                View tracking <ExternalLink size={14} />
              </a>
            </div>
          )}
        </div>

        <button
          onClick={onClose}
          className="w-full px-4 py-2 bg-green-600 text-white hover:bg-green-700 rounded-lg"
        >
          DONE
        </button>
      </div>
    );
  }

  return (
    <div className="p-0 space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-1">Create Lalamove Delivery</h3>
        <p className="text-xs text-[#7a6a4a] mb-4">Same-day delivery · Metro Manila</p>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
            <p className="text-red-800 text-sm">{error}</p>
          </div>
        )}

        <div className="space-y-4">
          {/* Pickup */}
          <div className="border-l-4 border-blue-500 pl-4">
            <h4 className="font-medium text-blue-800 mb-3">Pickup Location (Store)</h4>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-[#1c1810] mb-1">Store Address</label>
                <textarea
                  value={deliveryDetails.pickupAddress}
                  onChange={e => setDeliveryDetails(p => ({ ...p, pickupAddress: e.target.value }))}
                  className="w-full p-3 border border-[#e8e0d0] rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={2}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-[#1c1810] mb-1">Latitude</label>
                  <input
                    type="number" step="any"
                    value={deliveryDetails.pickupLat}
                    onChange={e => setDeliveryDetails(p => ({ ...p, pickupLat: e.target.value }))}
                    className="w-full p-3 border border-[#e8e0d0] rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#1c1810] mb-1">Longitude</label>
                  <input
                    type="number" step="any"
                    value={deliveryDetails.pickupLng}
                    onChange={e => setDeliveryDetails(p => ({ ...p, pickupLng: e.target.value }))}
                    className="w-full p-3 border border-[#e8e0d0] rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-[#1c1810] mb-1">Sender Name</label>
                  <input
                    type="text"
                    value={deliveryDetails.senderName}
                    onChange={e => setDeliveryDetails(p => ({ ...p, senderName: e.target.value }))}
                    className="w-full p-3 border border-[#e8e0d0] rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#1c1810] mb-1">Sender Phone</label>
                  <input
                    type="tel"
                    value={deliveryDetails.senderPhone}
                    onChange={e => setDeliveryDetails(p => ({ ...p, senderPhone: e.target.value }))}
                    className="w-full p-3 border border-[#e8e0d0] rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="+63912345678"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Delivery */}
          <div className="border-l-4 border-green-500 pl-4">
            <h4 className="font-medium text-green-800 mb-3">Delivery Location</h4>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-[#1c1810] mb-1">Delivery Address *</label>
                <textarea
                  value={deliveryDetails.deliveryAddress}
                  onChange={e => setDeliveryDetails(p => ({ ...p, deliveryAddress: e.target.value }))}
                  className="w-full p-3 border border-[#e8e0d0] rounded-lg focus:ring-2 focus:ring-green-500"
                  rows={2}
                  placeholder="Customer's complete delivery address..."
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-[#1c1810] mb-1">Latitude *</label>
                  <input
                    type="number" step="any"
                    value={deliveryDetails.deliveryLat}
                    onChange={e => setDeliveryDetails(p => ({ ...p, deliveryLat: e.target.value }))}
                    className="w-full p-3 border border-[#e8e0d0] rounded-lg focus:ring-2 focus:ring-green-500"
                    placeholder="14.6042"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#1c1810] mb-1">Longitude *</label>
                  <input
                    type="number" step="any"
                    value={deliveryDetails.deliveryLng}
                    onChange={e => setDeliveryDetails(p => ({ ...p, deliveryLng: e.target.value }))}
                    className="w-full p-3 border border-[#e8e0d0] rounded-lg focus:ring-2 focus:ring-green-500"
                    placeholder="120.9822"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-[#1c1810] mb-1">Recipient Name</label>
                  <input
                    type="text"
                    value={deliveryDetails.recipientName}
                    onChange={e => setDeliveryDetails(p => ({ ...p, recipientName: e.target.value }))}
                    className="w-full p-3 border border-[#e8e0d0] rounded-lg focus:ring-2 focus:ring-green-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#1c1810] mb-1">Recipient Phone *</label>
                  <input
                    type="tel"
                    value={deliveryDetails.recipientPhone}
                    onChange={e => setDeliveryDetails(p => ({ ...p, recipientPhone: e.target.value }))}
                    className="w-full p-3 border border-[#e8e0d0] rounded-lg focus:ring-2 focus:ring-green-500"
                    placeholder="+63987654321"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Vehicle */}
          <div>
            <label className="block text-sm font-medium text-[#1c1810] mb-1">Vehicle Type</label>
            <select
              value={deliveryDetails.serviceType}
              onChange={e => setDeliveryDetails(p => ({ ...p, serviceType: e.target.value }))}
              className="w-full p-3 border border-[#e8e0d0] rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="MOTORCYCLE">Motorcycle (Small items)</option>
              <option value="CAR">Car (Medium items)</option>
              <option value="VAN">Van (Large items)</option>
              <option value="TRUCK">Truck (Extra large items)</option>
            </select>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-[#1c1810] mb-1">Delivery Notes</label>
            <textarea
              value={deliveryDetails.notes}
              onChange={e => setDeliveryDetails(p => ({ ...p, notes: e.target.value }))}
              className="w-full p-3 border border-[#e8e0d0] rounded-lg focus:ring-2 focus:ring-blue-500"
              rows={2}
              placeholder="Special instructions for the driver..."
            />
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mt-2">
          <p className="text-blue-800 text-sm">
            <strong>Note:</strong> Delivery coordinates are auto-filled from the order.
            Verify them on Google Maps before dispatching.
          </p>
        </div>
      </div>

      <div className="flex gap-3 pt-4 border-t">
        <button
          onClick={onClose}
          className="flex-1 px-4 py-2 border border-[#e8e0d0] hover:bg-gray-100 rounded-lg"
          disabled={isCreatingDelivery}
        >
          CANCEL
        </button>
        <button
          onClick={handleCreateDelivery}
          disabled={
            isCreatingDelivery
            || !deliveryDetails.deliveryAddress
            || !deliveryDetails.deliveryLat
            || !deliveryDetails.deliveryLng
          }
          className="flex-1 px-4 py-2 bg-[#d4af37] text-[#0a0a0a] font-medium hover:bg-[#d4af37]/90 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg"
        >
          {isCreatingDelivery ? 'CREATING...' : 'CREATE DELIVERY'}
        </button>
      </div>
    </div>
  );
}
