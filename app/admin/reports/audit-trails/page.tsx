// app/admin/reports/audit-trails/page.tsx
"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import ExportModal, { ExportOptions } from "@/components/ExportModal";

interface AuditLog {
  id: string;
  userId: string;
  adminName: string;
  adminEmail: string;
  adminRole: string;
  action: string;
  entityType: string;
  entityId: string;
  changes: any;
  ipAddress: string;
  userAgent: string;
  timestamp: string;
}

export default function AuditTrailsPage() {
  const router = useRouter();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState("all");
  const [entityFilter, setEntityFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [showExportModal, setShowExportModal] = useState(false);

  useEffect(() => {
    fetchLogs();
  }, [currentPage, actionFilter, entityFilter, searchTerm]);

  const fetchLogs = async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams({
        page: currentPage.toString(),
        action: actionFilter,
        entity: entityFilter,
        search: searchTerm
      });

      const res = await fetch(`/api/admin/reports/audit-trails?${params}`);
      const result = await res.json();

      if (result.success) {
        setLogs(result.data.logs);
        setTotalPages(result.data.totalPages);
        setTotalCount(result.data.totalCount);
      }
    } catch (error) {
      console.error("Failed to fetch audit logs:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportClick = () => {
    setShowExportModal(true);
  };

  const handleExport = (options: ExportOptions) => {
    const params = new URLSearchParams();
    
    params.append("action", actionFilter);
    params.append("entity", entityFilter);
    
    if (searchTerm) {
      params.append("search", searchTerm);
    }
    
    if (options.dateRange) {
      params.append("dateFrom", options.dateRange.from);
      params.append("dateTo", options.dateRange.to);
    }

    window.location.href = `/api/admin/reports/audit-trails/export?${params.toString()}`;
    setShowExportModal(false);
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case "create": return "bg-green-100 text-green-800";
      case "update": return "bg-blue-100 text-blue-800";
      case "delete": return "bg-red-100 text-red-800";
      case "login": return "bg-purple-100 text-purple-800";
      case "logout": return "bg-gray-100 text-gray-800";
      case "view": return "bg-yellow-100 text-yellow-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case "create": return "➕";
      case "update": return "✏️";
      case "delete": return "🗑️";
      case "login": return "🔑";
      case "logout": return "🚪";
      case "view": return "👁️";
      default: return "📝";
    }
  };

  if (isLoading && currentPage === 1) {
    return <div className="p-6">Loading...</div>;
  }

  return (
    <>
      <div className="space-y-6">
        {/* BACK NAVIGATION */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/admin/reports")}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 hover:bg-gray-50 transition-colors"
          >
            <span>←</span>
            <span>Back to Reports</span>
          </button>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Audit Trails</h1>
            <p className="text-sm text-gray-600 mt-1">
              {totalCount} total records
            </p>
          </div>
          <button 
            onClick={handleExportClick}
            className="px-4 py-2 bg-black text-white hover:bg-gray-800"
          >
            Export Logs
          </button>
        </div>

        {/* Filters */}
        <div className="flex gap-4">
          <input
            type="text"
            placeholder="Search by entity ID..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            className="flex-1 px-4 py-2 border border-gray-300 rounded"
          />
          <select
            value={actionFilter}
            onChange={(e) => {
              setActionFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="px-4 py-2 border border-gray-300 rounded"
          >
            <option value="all">All Actions</option>
            <option value="create">Create</option>
            <option value="update">Update</option>
            <option value="delete">Delete</option>
            <option value="login">Login</option>
            <option value="logout">Logout</option>
            <option value="view">View</option>
          </select>
          <select
            value={entityFilter}
            onChange={(e) => {
              setEntityFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="px-4 py-2 border border-gray-300 rounded"
          >
            <option value="all">All Entities</option>
            <option value="product">Product</option>
            <option value="order">Order</option>
            <option value="user">User</option>
            <option value="category">Category</option>
            <option value="inventory">Inventory</option>
            <option value="notification">Notification</option>
            <option value="settings">Settings</option>
          </select>
        </div>

        {/* Logs Table */}
        <div className="bg-white border rounded">
          {logs.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">📋</div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No Audit Logs Found</h3>
              <p className="text-gray-600">
                {searchTerm || actionFilter !== "all" || entityFilter !== "all"
                  ? "Try adjusting your filters"
                  : "Audit logs will appear here as actions are performed"}
              </p>
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Timestamp</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Admin</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Entity</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Entity ID</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">IP Address</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <div className="font-medium">{log.adminName}</div>
                        <div className="text-xs text-gray-500">{log.adminRole}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 text-xs rounded-full ${getActionColor(log.action)} flex items-center gap-1 w-fit`}>
                        <span>{getActionIcon(log.action)}</span>
                        {log.action}
                      </span>
                    </td>
                    <td className="px-6 py-4 capitalize">{log.entityType}</td>
                    <td className="px-6 py-4">
                      <span className="font-mono text-xs">{log.entityId.substring(0, 8)}...</span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">{log.ipAddress || 'N/A'}</td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => setSelectedLog(log)}
                        className="text-blue-600 hover:text-blue-800 text-sm"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-center items-center gap-2">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <span className="px-4 py-2 text-sm">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        )}
      </div>

      {/* Details Modal */}
      {selectedLog && (
        <>
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 z-40"
            onClick={() => setSelectedLog(null)}
          />
          <div className="fixed inset-0 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b flex justify-between items-start">
                <div>
                  <h2 className="text-xl font-bold">Audit Log Details</h2>
                  <p className="text-sm text-gray-600 mt-1">
                    {new Date(selectedLog.timestamp).toLocaleString()}
                  </p>
                </div>
                <button 
                  onClick={() => setSelectedLog(null)} 
                  className="text-gray-400 hover:text-gray-600 text-2xl"
                >
                  ✕
                </button>
              </div>

              <div className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm text-gray-600">Admin</div>
                    <div className="font-medium">{selectedLog.adminName}</div>
                    <div className="text-sm text-gray-500">{selectedLog.adminEmail}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600">Role</div>
                    <div className="font-medium capitalize">{selectedLog.adminRole}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600">Action</div>
                    <span className={`px-2 py-1 text-xs rounded-full ${getActionColor(selectedLog.action)}`}>
                      {selectedLog.action}
                    </span>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600">Entity Type</div>
                    <div className="font-medium capitalize">{selectedLog.entityType}</div>
                  </div>
                  <div className="col-span-2">
                    <div className="text-sm text-gray-600">Entity ID</div>
                    <div className="font-mono text-sm">{selectedLog.entityId}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600">IP Address</div>
                    <div className="font-medium">{selectedLog.ipAddress || 'N/A'}</div>
                  </div>
                </div>

                {selectedLog.changes && (
                  <div>
                    <div className="text-sm text-gray-600 mb-2">Changes</div>
                    <pre className="bg-gray-50 p-4 rounded text-xs overflow-auto max-h-96">
                      {JSON.stringify(selectedLog.changes, null, 2)}
                    </pre>
                  </div>
                )}

                {selectedLog.userAgent && (
                  <div>
                    <div className="text-sm text-gray-600 mb-1">User Agent</div>
                    <div className="text-xs text-gray-500 break-all">{selectedLog.userAgent}</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Export Modal */}
      <ExportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        onExport={handleExport}
        title="Export Audit Trails"
        totalRecords={totalCount}
        filteredRecords={logs.length}
        showDateRange={true}
      />
    </>
  );
}