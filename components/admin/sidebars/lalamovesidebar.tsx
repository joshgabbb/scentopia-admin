"use client";
import React, { useState } from 'react';
import { Truck, ExternalLink } from 'lucide-react';

interface Order {
  id: string;
  customerName: string;
  customerPhone?: string;
  orderNumber: string;
}

interface LalaMoveSidebarProps {
  order: Order;
  onClose: () => void;
  onStatusUpdate: (newStatus: string) => void;
}

export default function LalaMoveSidebar({ order, onClose, onStatusUpdate }: LalaMoveSidebarProps) {
  const [deliveryDetails, setDeliveryDetails] = useState({
    pickupLat: '14.5995',
    pickupLng: '120.9842',
    pickupAddress: 'Your Business Address, Manila, Philippines',
    deliveryLat: '',
    deliveryLng: '',
    deliveryAddress: '',
    senderName: 'Your Business Name',
    senderPhone: '+63912345678',
    recipientName: order.customerName,
    recipientPhone: order.customerPhone || '',
    notes: `Order ${order.orderNumber}`,
    serviceType: 'MOTORCYCLE'
  });
  
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
          address: deliveryDetails.pickupAddress
        },
        deliveryAddress: {
          lat: parseFloat(deliveryDetails.deliveryLat),
          lng: parseFloat(deliveryDetails.deliveryLng),
          address: deliveryDetails.deliveryAddress
        },
        senderInfo: {
          name: deliveryDetails.senderName,
          phone: deliveryDetails.senderPhone
        },
        recipientInfo: {
          name: deliveryDetails.recipientName,
          phone: deliveryDetails.recipientPhone
        },
        serviceType: deliveryDetails.serviceType,
        notes: deliveryDetails.notes
      };

      console.log('Creating delivery with:', deliveryRequest);

      const response = await fetch('/api/admin/orders/create-delivery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(deliveryRequest)
      });

      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || `HTTP ${response.status}`);
      }

      if (result.success) {
        setDeliveryResult(result.data);
        
        try {
          const statusResponse = await fetch(`/api/admin/orders/${order.id}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              status: 'Shipped',
              title: 'Order Shipped via LalaMove',
              body: `Your order has been dispatched for delivery. Tracking: ${result.data.shareLink}`
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

  if (deliveryResult) {
    return (
      <div className="p-0 space-y-6">
        <div className="text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Truck size={24} className="text-green-600" />
          </div>
          <h3 className="text-lg font-semibold text-green-800 mb-2">
            Delivery Created Successfully!
          </h3>
          <p className="text-[#b8a070] mb-6">
            Your order has been dispatched via LalaMove
          </p>
        </div>

        <div className="bg-gray-100 rounded-lg p-4 space-y-3">
          <div className="flex justify-between">
            <span className="text-sm text-[#b8a070]">LalaMove Order ID:</span>
            <span className="font-mono text-sm">{deliveryResult.lalamoveOrderId}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-[#b8a070]">Delivery Cost:</span>
            <span className="font-medium">{deliveryResult.deliveryAmount} {deliveryResult.currency}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-[#b8a070]">Status:</span>
            <span className="font-medium">{deliveryResult.status}</span>
          </div>
          {deliveryResult.shareLink && (
            <div>
              <span className="text-sm text-[#b8a070]">Tracking Link:</span>
              <a 
                href={deliveryResult.shareLink} 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-blue-600 hover:text-blue-800 text-sm"
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
        <h3 className="text-lg font-semibold mb-4">Create LalaMove Delivery</h3>
        
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
            <p className="text-red-800 text-sm">{error}</p>
          </div>
        )}

        <div className="space-y-4">
          <div className="border-l-4 border-blue-500 pl-4">
            <h4 className="font-medium text-blue-800 mb-3">Pickup Location (Your Business)</h4>
            
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-[#f5e6d3] mb-1">
                  Business Address
                </label>
                <textarea
                  value={deliveryDetails.pickupAddress}
                  onChange={(e) => setDeliveryDetails(prev => ({ ...prev, pickupAddress: e.target.value }))}
                  className="w-full p-3 border border-[#d4af37]/20 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={2}
                  placeholder="Your complete business address..."
                />
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-[#f5e6d3] mb-1">
                    Latitude
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={deliveryDetails.pickupLat}
                    onChange={(e) => setDeliveryDetails(prev => ({ ...prev, pickupLat: e.target.value }))}
                    className="w-full p-3 border border-[#d4af37]/20 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="14.5995"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#f5e6d3] mb-1">
                    Longitude
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={deliveryDetails.pickupLng}
                    onChange={(e) => setDeliveryDetails(prev => ({ ...prev, pickupLng: e.target.value }))}
                    className="w-full p-3 border border-[#d4af37]/20 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="120.9842"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-[#f5e6d3] mb-1">
                    Sender Name
                  </label>
                  <input
                    type="text"
                    value={deliveryDetails.senderName}
                    onChange={(e) => setDeliveryDetails(prev => ({ ...prev, senderName: e.target.value }))}
                    className="w-full p-3 border border-[#d4af37]/20 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#f5e6d3] mb-1">
                    Sender Phone
                  </label>
                  <input
                    type="tel"
                    value={deliveryDetails.senderPhone}
                    onChange={(e) => setDeliveryDetails(prev => ({ ...prev, senderPhone: e.target.value }))}
                    className="w-full p-3 border border-[#d4af37]/20 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="+63912345678"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="border-l-4 border-green-500 pl-4">
            <h4 className="font-medium text-green-800 mb-3">Delivery Location</h4>
            
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-[#f5e6d3] mb-1">
                  Delivery Address *
                </label>
                <textarea
                  value={deliveryDetails.deliveryAddress}
                  onChange={(e) => setDeliveryDetails(prev => ({ ...prev, deliveryAddress: e.target.value }))}
                  className="w-full p-3 border border-[#d4af37]/20 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={2}
                  placeholder="Customer's complete delivery address..."
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-[#f5e6d3] mb-1">
                    Latitude *
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={deliveryDetails.deliveryLat}
                    onChange={(e) => setDeliveryDetails(prev => ({ ...prev, deliveryLat: e.target.value }))}
                    className="w-full p-3 border border-[#d4af37]/20 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="14.6042"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#f5e6d3] mb-1">
                    Longitude *
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={deliveryDetails.deliveryLng}
                    onChange={(e) => setDeliveryDetails(prev => ({ ...prev, deliveryLng: e.target.value }))}
                    className="w-full p-3 border border-[#d4af37]/20 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="120.9822"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-[#f5e6d3] mb-1">
                    Recipient Name
                  </label>
                  <input
                    type="text"
                    value={deliveryDetails.recipientName}
                    onChange={(e) => setDeliveryDetails(prev => ({ ...prev, recipientName: e.target.value }))}
                    className="w-full p-3 border border-[#d4af37]/20 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#f5e6d3] mb-1">
                    Recipient Phone *
                  </label>
                  <input
                    type="tel"
                    value={deliveryDetails.recipientPhone}
                    onChange={(e) => setDeliveryDetails(prev => ({ ...prev, recipientPhone: e.target.value }))}
                    className="w-full p-3 border border-[#d4af37]/20 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="+63987654321"
                  />
                </div>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-[#f5e6d3] mb-1">
              Vehicle Type
            </label>
            <select
              value={deliveryDetails.serviceType}
              onChange={(e) => setDeliveryDetails(prev => ({ ...prev, serviceType: e.target.value }))}
              className="w-full p-3 border border-[#d4af37]/20 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="MOTORCYCLE">Motorcycle (Small items)</option>
              <option value="CAR">Car (Medium items)</option>
              <option value="VAN">Van (Large items)</option>
              <option value="TRUCK">Truck (Extra large items)</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-[#f5e6d3] mb-1">
              Delivery Notes
            </label>
            <textarea
              value={deliveryDetails.notes}
              onChange={(e) => setDeliveryDetails(prev => ({ ...prev, notes: e.target.value }))}
              className="w-full p-3 border border-[#d4af37]/20 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              rows={2}
              placeholder="Special instructions for the driver..."
            />
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <p className="text-blue-800 text-sm">
            <strong>Note:</strong> Make sure coordinates are accurate. You can get them from Google Maps by right-clicking on a location.
          </p>
        </div>
      </div>

      <div className="flex gap-3 pt-4 border-t">
        <button
          onClick={onClose}
          className="flex-1 px-4 py-2 border border-[#d4af37]/20 hover:bg-gray-100 rounded-lg"
          disabled={isCreatingDelivery}
        >
          CANCEL
        </button>
        <button
          onClick={handleCreateDelivery}
          disabled={isCreatingDelivery || !deliveryDetails.deliveryAddress || !deliveryDetails.deliveryLat || !deliveryDetails.deliveryLng}
          className="flex-1 px-4 py-2 bg-black text-white hover:bg-black/70 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg"
        >
          {isCreatingDelivery ? 'CREATING DELIVERY...' : 'CREATE DELIVERY'}
        </button>
      </div>
    </div>
  );
}