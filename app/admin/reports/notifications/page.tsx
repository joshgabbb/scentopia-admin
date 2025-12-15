// app/admin/reports/notifications/page.tsx
"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  status: string;
  targetAudience: string;
  scheduledAt: string | null;
  sentAt: string | null;
  recipientCount: number;
  openedCount: number;
  clickedCount: number;
  openRate: number;
  clickRate: number;
  createdAt: string;
  createdBy: string;
}

export default function NotificationsPage() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  
  const [formData, setFormData] = useState({
    title: "",
    message: "",
    type: "announcement",
    targetAudience: "all",
    scheduledAt: ""
  });

  useEffect(() => {
    fetchNotifications();
  }, [currentPage, statusFilter, typeFilter]);

  const fetchNotifications = async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams({
        page: currentPage.toString(),
        status: statusFilter,
        type: typeFilter
      });

      const res = await fetch(`/api/admin/reports/notifications?${params}`);
      const result = await res.json();

      if (result.success) {
        setNotifications(result.data.notifications);
        setTotalPages(result.data.totalPages);
      }
    } catch (error) {
      console.error("Failed to fetch notifications:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreate = async () => {
    try {
      const res = await fetch("/api/admin/reports/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: formData.title,
          message: formData.message,
          type: formData.type,
          targetAudience: formData.targetAudience,
          scheduledAt: formData.scheduledAt || null
        })
      });

      if (res.ok) {
        setShowCreateModal(false);
        setFormData({
          title: "",
          message: "",
          type: "announcement",
          targetAudience: "all",
          scheduledAt: ""
        });
        fetchNotifications();
      }
    } catch (error) {
      console.error("Failed to create notification:", error);
    }
  };

  const handleSend = async (id: string) => {
    if (!confirm("Are you sure you want to send this notification?")) return;

    try {
      const res = await fetch("/api/admin/reports/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: "sent" })
      });

      if (res.ok) {
        fetchNotifications();
      }
    } catch (error) {
      console.error("Failed to send notification:", error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "draft": return "bg-gray-100 text-gray-800";
      case "scheduled": return "bg-blue-100 text-blue-800";
      case "sent": return "bg-green-100 text-green-800";
      case "failed": return "bg-red-100 text-red-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "announcement": return "📢";
      case "promotion": return "🎉";
      case "alert": return "⚠️";
      case "update": return "🔔";
      case "newsletter": return "📰";
      default: return "📬";
    }
  };

  if (isLoading) {
    return <div className="p-6">Loading...</div>;
  }

  return (
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
        <h1 className="text-2xl font-bold">Notifications Management</h1>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-black text-white hover:bg-gray-800"
        >
          Create Notification
        </button>
      </div>

      <div className="flex gap-4">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 border border-gray-300"
        >
          <option value="all">All Status</option>
          <option value="draft">Draft</option>
          <option value="scheduled">Scheduled</option>
          <option value="sent">Sent</option>
          <option value="failed">Failed</option>
        </select>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="px-4 py-2 border border-gray-300"
        >
          <option value="all">All Types</option>
          <option value="announcement">Announcement</option>
          <option value="promotion">Promotion</option>
          <option value="alert">Alert</option>
          <option value="update">Update</option>
          <option value="newsletter">Newsletter</option>
        </select>
      </div>

      <div className="bg-white border">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Title</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Audience</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Recipients</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Open Rate</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {notifications.map((notif) => (
              <tr key={notif.id} className="hover:bg-gray-50">
                <td className="px-6 py-4">
                  <div className="font-medium">{notif.title}</div>
                  <div className="text-sm text-gray-500 truncate max-w-xs">{notif.message}</div>
                </td>
                <td className="px-6 py-4">
                  <span className="flex items-center gap-1">
                    {getTypeIcon(notif.type)}
                    <span className="capitalize">{notif.type}</span>
                  </span>
                </td>
                <td className="px-6 py-4 capitalize">{notif.targetAudience}</td>
                <td className="px-6 py-4 text-center">{notif.recipientCount}</td>
                <td className="px-6 py-4">
                  {notif.status === 'sent' ? (
                    <div>
                      <div className="text-sm font-medium">{notif.openRate}%</div>
                      <div className="text-xs text-gray-500">
                        {notif.openedCount}/{notif.recipientCount} opened
                      </div>
                    </div>
                  ) : (
                    <span className="text-gray-400">N/A</span>
                  )}
                </td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(notif.status)}`}>
                    {notif.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-gray-500">
                  {new Date(notif.createdAt).toLocaleDateString()}
                </td>
                <td className="px-6 py-4">
                  {notif.status === 'draft' && (
                    <button
                      onClick={() => handleSend(notif.id)}
                      className="text-blue-600 hover:text-blue-800"
                    >
                      Send
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full">
            <div className="p-6 border-b">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold">Create Notification</h2>
                <button onClick={() => setShowCreateModal(false)} className="text-gray-400 hover:text-gray-600">
                  ✕
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Title</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({...formData, title: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300"
                  placeholder="Notification title..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Message</label>
                <textarea
                  value={formData.message}
                  onChange={(e) => setFormData({...formData, message: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300"
                  rows={4}
                  placeholder="Notification message..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Type</label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({...formData, type: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300"
                  >
                    <option value="announcement">Announcement</option>
                    <option value="promotion">Promotion</option>
                    <option value="alert">Alert</option>
                    <option value="update">Update</option>
                    <option value="newsletter">Newsletter</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Target Audience</label>
                  <select
                    value={formData.targetAudience}
                    onChange={(e) => setFormData({...formData, targetAudience: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300"
                  >
                    <option value="all">All Users</option>
                    <option value="customers">Customers Only</option>
                    <option value="admins">Admins Only</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Schedule (Optional)</label>
                <input
                  type="datetime-local"
                  value={formData.scheduledAt}
                  onChange={(e) => setFormData({...formData, scheduledAt: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300"
                />
              </div>

              <div className="flex gap-2 pt-4">
                <button
                  onClick={handleCreate}
                  className="flex-1 px-4 py-2 bg-black text-white hover:bg-gray-800"
                >
                  {formData.scheduledAt ? 'Schedule' : 'Save as Draft'}
                </button>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 border border-gray-300 hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="px-4 py-2 border disabled:opacity-50"
          >
            Previous
          </button>
          <span className="px-4 py-2">Page {currentPage} of {totalPages}</span>
          <button
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="px-4 py-2 border disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}