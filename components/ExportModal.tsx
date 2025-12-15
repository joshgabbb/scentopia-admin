// components/ExportModal.tsx
"use client";

import React, { useState } from "react";

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExport: (options: ExportOptions) => void;
  title: string;
  totalRecords: number;
  filteredRecords?: number;
  showDateRange?: boolean;
  currentDays?: number;
}

export interface ExportOptions {
  exportType: "all" | "filtered";
  dateRange?: {
    from: string;
    to: string;
  };
  includeDetails: boolean;
}

export default function ExportModal({
  isOpen,
  onClose,
  onExport,
  title,
  totalRecords,
  filteredRecords,
  showDateRange = true,
  currentDays
}: ExportModalProps) {
  const [exportType, setExportType] = useState<"all" | "filtered">("all");
  const [useDateRange, setUseDateRange] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [includeDetails, setIncludeDetails] = useState(true);

  if (!isOpen) return null;

  const handleExport = () => {
    const options: ExportOptions = {
      exportType,
      includeDetails
    };

    if (useDateRange && dateFrom && dateTo) {
      options.dateRange = { from: dateFrom, to: dateTo };
    }

    onExport(options);
  };

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 z-40"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-[#1a1a1a] text-white rounded-lg shadow-xl w-full max-w-md">
          {/* Header */}
          <div className="px-6 py-4">
            <h2 className="text-lg font-semibold text-yellow-500">{title}</h2>
          </div>

          {/* Body */}
          <div className="px-6 pb-4 space-y-4">
            {/* Export Type */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-3">
                Export Type
              </label>
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="exportType"
                    value="all"
                    checked={exportType === "all"}
                    onChange={() => setExportType("all")}
                    className="w-4 h-4 accent-yellow-500"
                  />
                  <span className="text-sm text-gray-200">
                    All records ({totalRecords})
                  </span>
                </label>
                {filteredRecords !== undefined && (
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="exportType"
                      value="filtered"
                      checked={exportType === "filtered"}
                      onChange={() => setExportType("filtered")}
                      className="w-4 h-4 accent-yellow-500"
                    />
                    <span className="text-sm text-gray-400">
                      Current view ({filteredRecords})
                    </span>
                  </label>
                )}
              </div>
            </div>

            {/* Date Range */}
            {showDateRange && (
              <div>
                <label className="flex items-center gap-2 mb-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={useDateRange}
                    onChange={(e) => setUseDateRange(e.target.checked)}
                    className="w-4 h-4 accent-yellow-500"
                  />
                  <span className="text-sm font-medium text-yellow-500">Date range</span>
                </label>
                
                {useDateRange && (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">From Date</label>
                      <input
                        type="date"
                        value={dateFrom}
                        onChange={(e) => setDateFrom(e.target.value)}
                        className="w-full px-3 py-2 bg-[#2a2a2a] border border-gray-700 rounded text-white text-sm focus:border-yellow-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">To Date</label>
                      <input
                        type="date"
                        value={dateTo}
                        onChange={(e) => setDateTo(e.target.value)}
                        className="w-full px-3 py-2 bg-[#2a2a2a] border border-gray-700 rounded text-white text-sm focus:border-yellow-500 focus:outline-none"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Include Details */}
            <div>
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeDetails}
                  onChange={(e) => setIncludeDetails(e.target.checked)}
                  className="w-4 h-4 mt-0.5 accent-yellow-500"
                />
                <span className="text-xs text-gray-400 leading-relaxed">
                  Export will include Product Name, Current Stock, Sales Data, Velocity, 
                  Stock Status, Recommendations, and Notes.
                </span>
              </label>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 flex justify-end gap-3 border-t border-gray-800">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-300 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleExport}
              className="px-6 py-2 bg-yellow-500 hover:bg-yellow-600 text-black font-medium rounded flex items-center gap-2 transition-colors"
            >
              <span>📥</span>
              Export CSV
            </button>
          </div>
        </div>
      </div>
    </>
  );
}