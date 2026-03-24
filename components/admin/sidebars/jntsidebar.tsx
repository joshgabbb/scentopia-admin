"use client";
import React, { useState, useEffect } from 'react';
import { Truck, ExternalLink, Package, MapPin, Clock, Copy, Check, User, Phone, Printer } from 'lucide-react';
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
    shipping_fee?: number;
    // Mobile stores structured data inside delivery_snapshot
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
      landmark?: string;
    };
    // Legacy object format (some older orders may have this)
    region?: { code?: string; name?: string } | string;
    province?: { code?: string; name?: string } | string;
    city?: { code?: string; name?: string } | string;
    barangay?: { code?: string; name?: string } | string;
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

// Mirrors mobile's _computeShippingFee() logic exactly
function detectZoneFromAddress(region: string, province: string, city: string): keyof typeof SHIPPING_ZONES {
  const r = region.toLowerCase();
  const p = province.toLowerCase();
  const c = city.toLowerCase();

  // Metro Manila / NCR
  if (r.includes('ncr') || r.includes('national capital') || r.includes('metro manila') ||
      p.includes('metro manila') || p.includes('national capital') ||
      c.includes('manila') || c.includes('quezon') || c.includes('makati') ||
      c.includes('pasig') || c.includes('taguig') || c.includes('caloocan') ||
      c.includes('pasay') || c.includes('paranaque') || c.includes('marikina') ||
      c.includes('muntinlupa') || c.includes('las pinas') || c.includes('mandaluyong') ||
      c.includes('valenzuela') || c.includes('malabon') || c.includes('navotas') ||
      c.includes('san juan') || c.includes('pateros')) {
    return 'METRO_MANILA';
  }

  // Visayas
  if (r.includes('visayas') || r.includes('region vi') || r.includes('region vii') || r.includes('region viii') ||
      p.includes('cebu') || p.includes('iloilo') || p.includes('negros') || p.includes('leyte') ||
      p.includes('samar') || p.includes('aklan') || p.includes('antique') || p.includes('capiz') ||
      p.includes('guimaras') || p.includes('biliran') || p.includes('bohol') || p.includes('siquijor')) {
    return 'VISAYAS';
  }

  // Mindanao
  if (r.includes('mindanao') || r.includes('zamboanga') || r.includes('davao') ||
      r.includes('soccsksargen') || r.includes('caraga') || r.includes('barmm') ||
      r.includes('bangsamoro') || r.includes('region ix') || r.includes('region x') ||
      r.includes('region xi') || r.includes('region xii') || r.includes('region xiii') ||
      p.includes('zamboanga') || p.includes('davao') || p.includes('maguindanao') ||
      p.includes('lanao') || p.includes('bukidnon') || p.includes('misamis') ||
      p.includes('surigao') || p.includes('agusan') || p.includes('cotabato') ||
      p.includes('sarangani') || p.includes('sultan kudarat') || p.includes('compostela') ||
      p.includes('basilan') || p.includes('sulu') || p.includes('tawi-tawi')) {
    return 'MINDANAO';
  }

  // Default: Luzon provincial
  return 'LUZON';
}

// Reverse-map a base fee amount to a zone key
function zoneFromFee(fee: number): keyof typeof SHIPPING_ZONES | null {
  if (fee === 85) return 'METRO_MANILA';
  if (fee === 115) return 'LUZON';
  if (fee === 150) return 'VISAYAS';
  if (fee === 170) return 'MINDANAO';
  return null;
}

export default function JntSidebar({ order, onClose, onStatusUpdate }: JntSidebarProps) {
  const { themeClasses: tc, isDark } = useTheme();

  // Mobile stores address inside delivery_snapshot; fall back to legacy flat fields
  const snap = order.deliveryLocation?.delivery_snapshot;

  const recipientName = snap?.recipient_name
    || order.deliveryLocation?.recipient_name
    || order.recipientName
    || order.customerName
    || '';
  const recipientPhone = snap?.recipient_phone
    || order.deliveryLocation?.phone_number
    || order.recipientPhone
    || order.customerPhone
    || '';

  // Region/province/city: snapshot strings first, then legacy object or string format
  const getStr = (val: { name?: string } | string | undefined) =>
    val ? (typeof val === 'string' ? val : (val.name ?? '')) : '';

  const regionName = snap?.region || getStr(order.deliveryLocation?.region as any) || '';
  const provinceName = snap?.province || getStr(order.deliveryLocation?.province as any) || '';
  const cityName = snap?.city_municipality || getStr(order.deliveryLocation?.city as any) || '';
  const barangayName = snap?.barangay || getStr(order.deliveryLocation?.barangay as any) || '';
  const streetAddress = snap?.street_address || order.deliveryLocation?.street_address || '';

  const fullAddress = snap?.full_address
    || order.deliveryLocation?.full_address
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

  // Auto-detect zone from address data (mirrors mobile logic)
  useEffect(() => {
    if (regionName || provinceName || cityName) {
      setSelectedZone(detectZoneFromAddress(regionName, provinceName, cityName));
    } else if (order.shippingFee) {
      // If no region string but we have the checkout fee, reverse-map it
      const z = zoneFromFee(order.shippingFee);
      if (z) setSelectedZone(z);
    }
  }, [regionName, provinceName, cityName, order.shippingFee]);

  useEffect(() => {
    if (order.shippingFee && order.shippingFee > 0) {
      // Use the fee stored at checkout (already zone+weight calculated by mobile)
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
          status: 'To Ship',
          trackingUrl: `https://www.jtexpress.ph/index/query/gzquery.html?waybillnumber=${waybillNumber}`
        });

        try {
          const statusResponse = await fetch(`/api/admin/orders/${order.id}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              status: 'To Ship',
              title: 'Waybill Created — Ready to Hand Off',
              body: `Your order is packed and ready! Tracking number: ${waybillNumber}. Expected delivery: ${estimatedDelivery.toLocaleDateString('en-PH')}`
            })
          });

          if (statusResponse.ok) {
            onStatusUpdate('To Ship');
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

  const handlePrintWaybill = () => {
    if (!deliveryResult) return;
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Waybill – ${deliveryResult.waybillNumber}</title>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            font-family: Arial, sans-serif;
            background: #fff;
            display: flex;
            justify-content: center;
            padding: 24px;
          }
          .label {
            width: 100mm;
            border: 2px solid #111;
            font-size: 11px;
            color: #111;
          }
          .header {
            background: #e30613;
            color: #fff;
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 10px 14px;
          }
          .header-brand { font-size: 20px; font-weight: 900; letter-spacing: 1px; }
          .header-sub { font-size: 10px; opacity: 0.9; margin-top: 2px; }
          .header-order { font-size: 10px; text-align: right; opacity: 0.9; }
          .waybill-block {
            background: #fff3f3;
            border-bottom: 2px solid #111;
            padding: 10px 14px;
            text-align: center;
          }
          .waybill-label {
            font-size: 9px;
            font-weight: 700;
            letter-spacing: 2px;
            color: #e30613;
            text-transform: uppercase;
            margin-bottom: 4px;
          }
          .waybill-number {
            font-size: 22px;
            font-weight: 900;
            letter-spacing: 3px;
            color: #e30613;
            font-family: 'Courier New', monospace;
          }
          .waybill-bars {
            display: flex;
            justify-content: center;
            gap: 2px;
            margin-top: 6px;
            height: 30px;
            align-items: flex-end;
          }
          .bar { background: #111; }
          .section {
            border-bottom: 1px solid #ccc;
            padding: 8px 14px;
          }
          .section:last-child { border-bottom: none; }
          .section-title {
            font-size: 8px;
            font-weight: 700;
            letter-spacing: 1.5px;
            text-transform: uppercase;
            color: #e30613;
            margin-bottom: 5px;
          }
          .section-value {
            font-size: 12px;
            font-weight: 700;
            line-height: 1.4;
          }
          .section-sub {
            font-size: 10px;
            color: #444;
            margin-top: 2px;
          }
          .row { display: flex; justify-content: space-between; gap: 8px; }
          .col { flex: 1; }
          .meta-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 6px;
            padding: 8px 14px;
            border-bottom: 1px solid #ccc;
          }
          .meta-item { }
          .meta-key { font-size: 8px; color: #888; text-transform: uppercase; letter-spacing: 1px; }
          .meta-val { font-size: 11px; font-weight: 700; margin-top: 1px; }
          .footer {
            background: #f5f5f5;
            padding: 7px 14px;
            text-align: center;
            font-size: 9px;
            color: #666;
            border-top: 1px dashed #ccc;
          }
          @media print {
            body { padding: 0; }
            .no-print { display: none !important; }
            .label { border: 2px solid #111; page-break-inside: avoid; }
          }
          .print-btn {
            display: block;
            margin: 16px auto 0;
            padding: 8px 24px;
            background: #e30613;
            color: white;
            border: none;
            border-radius: 4px;
            font-size: 13px;
            font-weight: 700;
            cursor: pointer;
          }
        </style>
      </head>
      <body>
        <div>
          <div class="label">

            <!-- Header -->
            <div class="header">
              <div>
                <div class="header-brand">J&T EXPRESS</div>
                <div class="header-sub">Philippines</div>
              </div>
              <div class="header-order">
                <div style="font-size:9px;">ORDER REF.</div>
                <div style="font-weight:700;">${order.orderNumber}</div>
              </div>
            </div>

            <!-- Waybill Number -->
            <div class="waybill-block">
              <div class="waybill-label">Waybill Number</div>
              <div class="waybill-number">${deliveryResult.waybillNumber}</div>
              <div class="waybill-bars">
                ${Array.from({ length: 48 }, (_, i) =>
                  `<div class="bar" style="width:${i % 3 === 0 ? 3 : 2}px; height:${i % 5 === 0 ? 30 : i % 3 === 0 ? 22 : 16}px;"></div>`
                ).join('')}
              </div>
            </div>

            <!-- TO -->
            <div class="section">
              <div class="section-title">▼ To (Recipient)</div>
              <div class="section-value">${recipientName || '—'}</div>
              <div class="section-sub">${recipientPhone || ''}</div>
              <div class="section-sub" style="margin-top:4px; line-height:1.5;">${fullAddress || '—'}</div>
            </div>

            <!-- FROM -->
            <div class="section">
              <div class="section-title">▲ From (Sender)</div>
              <div class="section-value">Scentopia</div>
              <div class="section-sub">Scentopia Official Store</div>
            </div>

            <!-- Shipment Details -->
            <div class="meta-grid">
              <div class="meta-item">
                <div class="meta-key">Zone</div>
                <div class="meta-val">${deliveryResult.zone}</div>
              </div>
              <div class="meta-item">
                <div class="meta-key">Shipping Fee</div>
                <div class="meta-val" style="color:#e30613;">₱${deliveryResult.shippingFee.toFixed(2)}</div>
              </div>
              <div class="meta-item">
                <div class="meta-key">Weight</div>
                <div class="meta-val">${packageWeight} kg</div>
              </div>
              <div class="meta-item">
                <div class="meta-key">Est. Delivery</div>
                <div class="meta-val" style="font-size:9px;">${deliveryResult.estimatedDelivery}</div>
              </div>
            </div>

            <!-- Footer -->
            <div class="footer">
              Printed ${new Date().toLocaleString('en-PH', { timeZone: 'Asia/Manila' })}
              &nbsp;·&nbsp; Scentopia Admin
            </div>

          </div>
          <button class="print-btn no-print" onclick="window.print()">🖨 Print Waybill</button>
        </div>
      </body>
      </html>
    `);
    win.document.close();
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
        <div className="bg-gradient-to-r from-amber-500 to-amber-600 -mx-6 -mt-6 px-6 py-6 mb-4 text-center">
          <div className={`w-14 h-14 ${tc.bg} rounded-full flex items-center justify-center mx-auto mb-3 shadow-lg`}>
            <Package size={28} className="text-amber-500" />
          </div>
          <h3 className="text-lg font-bold text-white tracking-wide">Waybill Ready</h3>
          <p className="text-amber-100 text-sm mt-0.5">Print the waybill, then hand the package to J&T</p>
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
            <span className="px-2.5 py-0.5 bg-amber-100 text-amber-700 rounded-full text-xs font-semibold">
              {deliveryResult.status}
            </span>
          </div>
        </div>

        {/* Print Waybill Button */}
        <button
          onClick={handlePrintWaybill}
          className="w-full flex items-center justify-center gap-2 py-2.5 bg-[#1c1810] hover:bg-[#2e2820] text-white rounded-md font-semibold text-sm transition-colors shadow-md"
        >
          <Printer size={16} />
          Print Waybill Label
        </button>

        {/* Track Button */}
        {deliveryResult.trackingUrl && (
          <a
            href={deliveryResult.trackingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 text-red-600 border border-red-200 hover:bg-red-50 py-2.5 rounded-md font-semibold text-sm transition-colors"
          >
            <ExternalLink size={16} />
            Track on J&T Express
          </a>
        )}

        <div className={`${isDark ? 'bg-blue-900/20 border-blue-800/40 text-blue-300' : 'bg-blue-50 border-blue-200 text-blue-700'} border rounded-lg p-3`}>
          <p className="text-sm">
            <strong>Customer Notified:</strong> The customer received a notification that their order is packed and ready. Once you hand the package to J&T, use the <strong>⋯ menu → Confirm Handoff to J&T</strong> to mark it as Shipped.
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
              <div className="flex items-center justify-between mb-1.5">
                <label className={`block text-xs font-medium ${tc.textMuted} uppercase tracking-wide`}>
                  Delivery Zone
                </label>
                {(regionName || provinceName || order.shippingFee) && (
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${isDark ? 'bg-green-900/30 text-green-400' : 'bg-green-100 text-green-700'}`}>
                    Auto-detected
                  </span>
                )}
              </div>
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
