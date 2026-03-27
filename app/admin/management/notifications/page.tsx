// app/admin/management/notifications/page.tsx
"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

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
  imageUrl?: string | null;
}

export default function NotificationsPage() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingNotification, setEditingNotification] = useState<Notification | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isSending, setIsSending] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    title: "",
    message: "",
    type: "announcement",
    targetAudience: "customers",
    scheduledAt: "",
    imageUrl: ""
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [, setTick] = useState(0); // For countdown refresh
  const fetchNotificationsRef = useRef<() => void>(() => {});

  // Setup real-time subscription
  useEffect(() => {
    const supabase = createClient();
    let channel: RealtimeChannel;

    const setupRealtime = () => {
      channel = supabase
        .channel('admin-notifications-changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'admin_notifications'
          },
          (payload) => {
            console.log('Notification change:', payload);
            // Use ref to always call the latest fetchNotifications
            fetchNotificationsRef.current();
          }
        )
        .subscribe();
    };

    setupRealtime();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, []);

  // Auto-send scheduled notifications when their time arrives (silent - no popups)
  useEffect(() => {
    const checkScheduledNotifications = async () => {
      try {
        const res = await fetch("/api/admin/reports/notification/scheduled", {
          method: "POST"
        });
        const result = await res.json();
        if (result.success && result.processed > 0) {
          console.log(`[Auto-send] Sent ${result.processed} scheduled notification(s)`);
          // Silently refresh the list - no popup interruption
          fetchNotifications();
        }
      } catch (error) {
        console.error("Error checking scheduled notifications:", error);
      }
    };

    // Check immediately on page load
    checkScheduledNotifications();

    // Check every 10 seconds for due notifications (more responsive)
    const interval = setInterval(checkScheduledNotifications, 10000);

    return () => clearInterval(interval);
  }, []);

  // Update countdown every minute
  useEffect(() => {
    const countdownInterval = setInterval(() => {
      setTick(t => t + 1);
    }, 60000); // Update every minute

    return () => clearInterval(countdownInterval);
  }, []);

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

      const res = await fetch(`/api/admin/reports/notification?${params}`);
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

  // Keep ref in sync so the realtime callback always calls the latest version
  fetchNotificationsRef.current = fetchNotifications;

  const resetForm = () => {
    setFormData({
      title: "",
      message: "",
      type: "announcement",
      targetAudience: "customers",
      scheduledAt: "",
      imageUrl: ""
    });
    setImageFile(null);
    setImagePreview(null);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        alert('Please select an image file');
        return;
      }
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        alert('Image size should be less than 5MB');
        return;
      }
      setImageFile(file);
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadImage = async (): Promise<string | null> => {
    if (!imageFile) return formData.imageUrl || null;

    try {
      setIsUploading(true);
      const supabase = createClient();

      // Generate unique filename
      const fileExt = imageFile.name.split('.').pop();
      const fileName = `notification-${Date.now()}.${fileExt}`;

      // Try multiple buckets in order of preference
      const bucketsToTry = ['notifications', 'notificaitons', 'products', 'public', 'assets'];
      const errors: string[] = [];

      for (const bucketName of bucketsToTry) {
        try {
          // Try uploading directly to bucket root (simpler path)
          const { data, error } = await supabase.storage
            .from(bucketName)
            .upload(fileName, imageFile, {
              cacheControl: '3600',
              upsert: true // Allow overwrite
            });

          if (!error && data) {
            const { data: urlData } = supabase.storage.from(bucketName).getPublicUrl(fileName);
            console.log(`✅ Successfully uploaded to bucket: ${bucketName}`);
            return urlData.publicUrl;
          }

          const errorMsg = `${bucketName}: ${error?.message || 'Unknown error'}`;
          errors.push(errorMsg);
          console.log(`❌ Bucket ${bucketName} failed:`, error?.message);
        } catch (bucketError) {
          const errorMsg = `${bucketName}: ${bucketError}`;
          errors.push(errorMsg);
          console.log(`❌ Bucket ${bucketName} error:`, bucketError);
        }
      }

      // All buckets failed - show detailed error
      console.error('All storage buckets failed:', errors);
      alert(`⚠️ Image upload failed.\n\nErrors:\n${errors.join('\n')}\n\nPlease check:\n1. Bucket exists and is PUBLIC\n2. RLS policies allow INSERT for authenticated users\n\nYou can still paste an external image URL instead.`);
      return null;
    } catch (e) {
      console.error('Upload failed:', e);
      alert('⚠️ Image upload failed. You can paste an external image URL instead.');
      return null;
    } finally {
      setIsUploading(false);
    }
  };

  const handleCreate = async (sendImmediately = false) => {
    if (!formData.title.trim() || !formData.message.trim()) {
      alert("Please fill in title and message");
      return;
    }

    try {
      setIsSending(true);

      // Upload image first if selected
      let imageUrl = formData.imageUrl;
      if (imageFile) {
        const uploadedUrl = await uploadImage();
        if (uploadedUrl) {
          imageUrl = uploadedUrl;
        }
      }

      // Convert local datetime to UTC ISO string for storage
      let scheduledAtUTC = null;
      if (formData.scheduledAt) {
        // formData.scheduledAt is like "2026-02-13T07:25" (local time)
        // Convert to UTC ISO string for database storage
        const localDate = new Date(formData.scheduledAt);
        scheduledAtUTC = localDate.toISOString();
      }

      const res = await fetch("/api/admin/reports/notification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: formData.title,
          message: formData.message,
          type: formData.type,
          targetAudience: formData.targetAudience,
          scheduledAt: scheduledAtUTC,
          imageUrl: imageUrl || null
        })
      });

      const result = await res.json();

      if (res.ok && result.success) {
        if (sendImmediately && result.data?.id) {
          // Send immediately
          const sendRes = await fetch("/api/admin/reports/notification", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: result.data.id, status: "sent" })
          });

          const sendResult = await sendRes.json();
          if (sendRes.ok && sendResult.success) {
            alert(`✅ Notification sent successfully to ${sendResult.recipientCount || 'all'} users!${sendResult.failedCount ? ` (${sendResult.failedCount} failed)` : ''}`);
          } else {
            alert("⚠️ Notification created but failed to send: " + (sendResult.error || "Unknown error"));
          }
        } else if (formData.scheduledAt) {
          // Scheduled for later
          const scheduledDate = new Date(formData.scheduledAt);
          alert(`📅 Notification scheduled for ${scheduledDate.toLocaleString("en-PH", { timeZone: "Asia/Manila" })}!\n\nUsers will receive this notification at the scheduled time.`);
        } else {
          // Saved as draft
          alert("✅ Notification saved as draft!\n\nYou can send it later from the notifications list.");
        }

        setShowCreateModal(false);
        resetForm();
        fetchNotifications();
      } else {
        alert("❌ Failed to create notification: " + (result.error || "Unknown error"));
      }
    } catch (error) {
      console.error("Failed to create notification:", error);
      alert("❌ Failed to create notification. Please try again.");
    } finally {
      setIsSending(false);
    }
  };

  const handleEdit = (notif: Notification) => {
    setEditingNotification(notif);

    // Convert UTC scheduled time to local datetime string for the form
    let localScheduledAt = "";
    if (notif.scheduledAt) {
      const utcDate = new Date(notif.scheduledAt);
      // Format as YYYY-MM-DDTHH:MM for the datetime inputs
      const year = utcDate.getFullYear();
      const month = String(utcDate.getMonth() + 1).padStart(2, '0');
      const day = String(utcDate.getDate()).padStart(2, '0');
      const hours = String(utcDate.getHours()).padStart(2, '0');
      const minutes = String(utcDate.getMinutes()).padStart(2, '0');
      localScheduledAt = `${year}-${month}-${day}T${hours}:${minutes}`;
    }

    setFormData({
      title: notif.title,
      message: notif.message,
      type: notif.type,
      targetAudience: notif.targetAudience,
      scheduledAt: localScheduledAt,
      imageUrl: notif.imageUrl || ""
    });
    // Set image preview if there's an existing image
    if (notif.imageUrl) {
      setImagePreview(notif.imageUrl);
    }
    setShowEditModal(true);
  };

  const handleUpdate = async () => {
    if (!editingNotification) return;
    if (!formData.title.trim() || !formData.message.trim()) {
      alert("Please fill in title and message");
      return;
    }

    try {
      setIsSending(true);

      // Upload new image if selected
      let imageUrl = formData.imageUrl;
      if (imageFile) {
        const uploadedUrl = await uploadImage();
        if (uploadedUrl) {
          imageUrl = uploadedUrl;
        }
      }

      // Convert local datetime to UTC ISO string for storage
      let scheduledAtUTC = null;
      if (formData.scheduledAt) {
        const localDate = new Date(formData.scheduledAt);
        scheduledAtUTC = localDate.toISOString();
      }

      const res = await fetch("/api/admin/reports/notification", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingNotification.id,
          title: formData.title,
          message: formData.message,
          type: formData.type,
          targetAudience: formData.targetAudience,
          scheduledAt: scheduledAtUTC,
          imageUrl: imageUrl || null
        })
      });

      const result = await res.json();

      if (res.ok && result.success) {
        alert("✅ Notification updated successfully!");
        setShowEditModal(false);
        setEditingNotification(null);
        resetForm();
        fetchNotifications();
      } else {
        alert("❌ Failed to update notification: " + (result.error || "Unknown error"));
      }
    } catch (error) {
      console.error("Failed to update notification:", error);
      alert("❌ Failed to update notification. Please try again.");
    } finally {
      setIsSending(false);
    }
  };

  const handleSend = async (id: string) => {
    if (!confirm("Are you sure you want to send this notification to all target users?")) return;

    try {
      setActionLoading(id);

      const res = await fetch("/api/admin/reports/notification", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: "sent" })
      });

      const result = await res.json();

      if (res.ok && result.success) {
        alert(`✅ Notification sent successfully to ${result.recipientCount || 'all'} users!`);
        fetchNotifications();
      } else {
        alert("❌ Failed to send notification: " + (result.error || result.warning || "Unknown error"));
      }
    } catch (error) {
      console.error("Failed to send notification:", error);
      alert("❌ Failed to send notification. Please try again.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleArchive = async (id: string) => {
    if (!confirm("Are you sure you want to archive this notification? This will also remove it from all users' mobile apps.")) return;

    try {
      setActionLoading(id);

      const res = await fetch("/api/admin/reports/notification", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: "archived", removeFromMobile: true })
      });

      const result = await res.json();

      if (res.ok && result.success) {
        alert(`✅ Notification archived! ${result.removedCount ? `Removed from ${result.removedCount} users.` : ''}`);
        fetchNotifications();
      } else {
        alert("❌ Failed to archive notification: " + (result.error || "Unknown error"));
      }
    } catch (error) {
      console.error("Failed to archive notification:", error);
    } finally {
      setActionLoading(null);
    }
  };

  const handleRestore = async (id: string) => {
    if (!confirm("Are you sure you want to restore this notification to draft?")) return;

    try {
      setActionLoading(id);

      const res = await fetch("/api/admin/reports/notification", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: "draft" })
      });

      const result = await res.json();

      if (res.ok && result.success) {
        alert("✅ Notification restored to draft!");
        fetchNotifications();
      } else {
        alert("❌ Failed to restore notification: " + (result.error || "Unknown error"));
      }
    } catch (error) {
      console.error("Failed to restore notification:", error);
    } finally {
      setActionLoading(null);
    }
  };


  const getStatusColor = (status: string) => {
    switch (status) {
      case "draft": return "bg-gray-500/20 text-gray-300 border border-gray-500/30";
      case "scheduled": return "bg-blue-500/20 text-blue-400 border border-blue-500/30";
      case "sent": return "bg-green-500/20 text-green-400 border border-green-500/30";
      case "failed": return "bg-red-500/20 text-red-400 border border-red-500/30";
      case "archived": return "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30";
      default: return "bg-gray-500/20 text-gray-300";
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

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Manila',
    });
  };

  const getTimeUntil = (dateStr: string) => {
    const now = new Date();
    const target = new Date(dateStr);
    const diff = target.getTime() - now.getTime();

    if (diff <= 0) return "Sending now...";

    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    return `${minutes}m`;
  };

  if (isLoading && notifications.length === 0) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#d4af37]"></div>
        <span className="ml-3 text-[#7a6a4a]">Loading notifications...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* BACK NAVIGATION */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.push("/admin/management")}
          className="flex items-center gap-2 px-4 py-2 border border-[#e8e0d0] text-[#1c1810] hover:border-[#d4af37]/50 transition-colors"
        >
          <span>←</span>
          <span>Back to Management</span>
        </button>
      </div>

      {/* HEADER */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#d4af37] uppercase tracking-[2px]">Notifications</h1>
          <p className="text-[#7a6a4a] text-sm mt-1">Manage and send notifications to users</p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setShowCreateModal(true);
          }}
          className="flex items-center gap-2 px-5 py-2.5 bg-[#d4af37] text-[#0a0a0a] font-semibold hover:bg-[#d4af37]/90 transition-colors"
        >
          <span>+</span>
          <span>Create Notification</span>
        </button>
      </div>

      {/* FILTERS */}
      <div className="flex gap-4 flex-wrap">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 bg-white border border-[#e8e0d0] text-[#1c1810] focus:outline-none focus:ring-2 focus:ring-[#d4af37]"
        >
          <option value="all">All Status</option>
          <option value="draft">Draft</option>
          <option value="scheduled">Scheduled</option>
          <option value="sent">Sent</option>
          <option value="archived">Archived</option>
          <option value="failed">Failed</option>
        </select>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="px-4 py-2 bg-white border border-[#e8e0d0] text-[#1c1810] focus:outline-none focus:ring-2 focus:ring-[#d4af37]"
        >
          <option value="all">All Types</option>
          <option value="announcement">📢 Announcement</option>
          <option value="promotion">🎉 Promotion</option>
          <option value="alert">⚠️ Alert</option>
          <option value="update">🔔 Update</option>
          <option value="newsletter">📰 Newsletter</option>
        </select>
        <button
          onClick={() => fetchNotifications()}
          className="px-4 py-2 border border-[#e8e0d0] text-[#1c1810] hover:border-[#d4af37]/50 transition-colors"
        >
          ↻ Refresh
        </button>
      </div>

      {/* NOTIFICATIONS TABLE */}
      <div className="bg-[#faf8f3] border border-[#e8e0d0] overflow-hidden">
        <table className="w-full">
          <thead className="bg-white">
            <tr>
              <th className="px-6 py-4 text-left text-xs font-medium text-[#7a6a4a] uppercase tracking-wider">Notification</th>
              <th className="px-4 py-4 text-left text-xs font-medium text-[#7a6a4a] uppercase tracking-wider">Type</th>
              <th className="px-4 py-4 text-left text-xs font-medium text-[#7a6a4a] uppercase tracking-wider">Audience</th>
              <th className="px-4 py-4 text-center text-xs font-medium text-[#7a6a4a] uppercase tracking-wider">Recipients</th>
              <th className="px-4 py-4 text-center text-xs font-medium text-[#7a6a4a] uppercase tracking-wider">Status</th>
              <th className="px-4 py-4 text-left text-xs font-medium text-[#7a6a4a] uppercase tracking-wider">Date</th>
              <th className="px-6 py-4 text-center text-xs font-medium text-[#7a6a4a] uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#d4af37]/10">
            {notifications.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-[#7a6a4a]">
                  No notifications found. Create your first notification!
                </td>
              </tr>
            ) : (
              notifications.map((notif) => (
                <tr key={notif.id} className="hover:bg-white/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-medium text-[#1c1810]">{notif.title}</div>
                    <div className="text-sm text-[#7a6a4a] truncate max-w-xs">{notif.message}</div>
                  </td>
                  <td className="px-4 py-4">
                    <span className="flex items-center gap-2 text-[#1c1810]">
                      <span className="text-lg">{getTypeIcon(notif.type)}</span>
                      <span className="capitalize text-sm">{notif.type}</span>
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <span className="capitalize text-[#1c1810] text-sm">{notif.targetAudience}</span>
                  </td>
                  <td className="px-4 py-4 text-center">
                    <span className="text-[#d4af37] font-semibold">{notif.recipientCount}</span>
                  </td>
                  <td className="px-4 py-4 text-center">
                    <span className={`px-3 py-1 text-xs font-medium rounded-full ${getStatusColor(notif.status)}`}>
                      {notif.status}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-sm text-[#7a6a4a]">
                    {notif.status === 'sent' && notif.sentAt ? (
                      <div>
                        <div className="text-green-400 text-xs">✅ Sent</div>
                        <div>{formatDate(notif.sentAt)}</div>
                      </div>
                    ) : notif.status === 'scheduled' && notif.scheduledAt ? (
                      <div>
                        <div className={`text-xs ${new Date(notif.scheduledAt) <= new Date() ? 'text-orange-400 animate-pulse' : 'text-blue-400'}`}>
                          {new Date(notif.scheduledAt) <= new Date() ? '🚀 Sending soon...' : '📅 Scheduled'}
                        </div>
                        <div>{formatDate(notif.scheduledAt)}</div>
                        {new Date(notif.scheduledAt) > new Date() && (
                          <div className="text-xs text-green-400 mt-1">
                            ⏱️ {getTimeUntil(notif.scheduledAt)}
                          </div>
                        )}
                      </div>
                    ) : notif.status === 'failed' ? (
                      <div>
                        <div className="text-red-400 text-xs">❌ Failed</div>
                        <div>{formatDate(notif.createdAt)}</div>
                      </div>
                    ) : notif.status === 'archived' ? (
                      <div>
                        <div className="text-yellow-400 text-xs">📁 Archived</div>
                        <div>{formatDate(notif.createdAt)}</div>
                      </div>
                    ) : (
                      <div>
                        <div className="text-gray-400 text-xs">📝 Draft</div>
                        <div>{formatDate(notif.createdAt)}</div>
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-center gap-2">
                      {actionLoading === notif.id ? (
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-[#d4af37]"></div>
                      ) : (
                        <>
                          {/* Send button - only for draft */}
                          {notif.status === 'draft' && (
                            <button
                              onClick={() => handleSend(notif.id)}
                              className="px-3 py-1.5 bg-green-600 text-white text-xs font-medium hover:bg-green-700 transition-colors rounded"
                              title="Send Now"
                            >
                              🚀 Send
                            </button>
                          )}

                          {/* For scheduled - show status indicator */}
                          {notif.status === 'scheduled' && (
                            <>
                              {/* If scheduled time has passed, show processing indicator (auto-sending) */}
                              {notif.scheduledAt && new Date(notif.scheduledAt) <= new Date() ? (
                                <span className="px-3 py-1.5 bg-orange-600/20 text-orange-400 text-xs font-medium rounded animate-pulse" title="Auto-sending...">
                                  🔄 Sending...
                                </span>
                              ) : (
                                /* If scheduled time is in future, show waiting indicator */
                                <span className="px-3 py-1.5 bg-blue-600/20 text-blue-400 text-xs font-medium rounded" title={`Will auto-send at ${notif.scheduledAt ? new Date(notif.scheduledAt).toLocaleString("en-PH", { timeZone: "Asia/Manila" }) : 'scheduled time'}`}>
                                  ⏰ Waiting
                                </span>
                              )}
                            </>
                          )}

                          {/* Edit button - only for draft/scheduled */}
                          {(notif.status === 'draft' || notif.status === 'scheduled') && (
                            <button
                              onClick={() => handleEdit(notif)}
                              className="px-3 py-1.5 bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 transition-colors rounded"
                              title="Edit"
                            >
                              ✏️ Edit
                            </button>
                          )}

                          {/* Retry button - for failed notifications */}
                          {notif.status === 'failed' && (
                            <button
                              onClick={() => handleSend(notif.id)}
                              className="px-3 py-1.5 bg-orange-600 text-white text-xs font-medium hover:bg-orange-700 transition-colors rounded"
                              title="Retry Sending"
                            >
                              🔄 Retry
                            </button>
                          )}

                          {/* Archive button - available for all non-archived notifications */}
                          {notif.status !== 'archived' && (
                            <button
                              onClick={() => handleArchive(notif.id)}
                              className="px-3 py-1.5 bg-yellow-600 text-white text-xs font-medium hover:bg-yellow-700 transition-colors rounded"
                              title="Archive (removes from mobile app)"
                            >
                              📁 Archive
                            </button>
                          )}

                          {/* Restore button - for archived notifications */}
                          {notif.status === 'archived' && (
                            <button
                              onClick={() => handleRestore(notif.id)}
                              className="px-3 py-1.5 bg-green-600 text-white text-xs font-medium hover:bg-green-700 transition-colors rounded"
                              title="Restore to Draft"
                            >
                              ↩️ Restore
                            </button>
                          )}

                          {/* View stats for sent */}
                          {notif.status === 'sent' && (
                            <div className="text-xs text-[#7a6a4a]" title="Open Rate">
                              👁️ {notif.openRate}%
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* PAGINATION */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="px-4 py-2 border border-[#e8e0d0] text-[#1c1810] disabled:opacity-50 hover:border-[#d4af37]/50 transition-colors"
          >
            ← Previous
          </button>
          <span className="px-4 py-2 text-[#7a6a4a]">Page {currentPage} of {totalPages}</span>
          <button
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="px-4 py-2 border border-[#e8e0d0] text-[#1c1810] disabled:opacity-50 hover:border-[#d4af37]/50 transition-colors"
          >
            Next →
          </button>
        </div>
      )}

      {/* CREATE MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <div className="bg-[#faf8f3] border border-[#e8e0d0] max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-[#e8e0d0]">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-[#d4af37]">Create Notification</h2>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="text-[#7a6a4a] hover:text-[#1c1810] text-2xl"
                >
                  ×
                </button>
              </div>
            </div>

            <div className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-medium text-[#d4af37] mb-2">Title *</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({...formData, title: e.target.value})}
                  className="w-full px-4 py-3 bg-white border border-[#e8e0d0] text-[#1c1810] focus:outline-none focus:ring-2 focus:ring-[#d4af37] placeholder-[#b0a080]/50"
                  placeholder="Enter notification title..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[#d4af37] mb-2">Message *</label>
                <textarea
                  value={formData.message}
                  onChange={(e) => setFormData({...formData, message: e.target.value})}
                  className="w-full px-4 py-3 bg-white border border-[#e8e0d0] text-[#1c1810] focus:outline-none focus:ring-2 focus:ring-[#d4af37] placeholder-[#b0a080]/50"
                  rows={4}
                  placeholder="Enter notification message..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[#d4af37] mb-2">Type</label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({...formData, type: e.target.value})}
                    className="w-full px-4 py-3 bg-white border border-[#e8e0d0] text-[#1c1810] focus:outline-none focus:ring-2 focus:ring-[#d4af37]"
                  >
                    <option value="announcement">📢 Announcement</option>
                    <option value="promotion">🎉 Promotion</option>
                    <option value="alert">⚠️ Alert</option>
                    <option value="update">🔔 Update</option>
                    <option value="newsletter">📰 Newsletter</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-[#d4af37] mb-2">Target Audience</label>
                  <select
                    value={formData.targetAudience}
                    onChange={(e) => setFormData({...formData, targetAudience: e.target.value})}
                    className="w-full px-4 py-3 bg-white border border-[#e8e0d0] text-[#1c1810] focus:outline-none focus:ring-2 focus:ring-[#d4af37]"
                  >
                    <option value="customers">👥 Customers Only</option>
                    <option value="all">🌐 All Users</option>
                    <option value="admins">👔 Admins Only</option>
                  </select>
                </div>
              </div>

              {/* Image Upload or URL */}
              <div>
                <label className="block text-sm font-medium text-[#d4af37] mb-2">Image (Optional)</label>
                <div className="space-y-3">
                  {imagePreview ? (
                    <div className="relative">
                      <img
                        src={imagePreview}
                        alt="Preview"
                        className="w-full h-48 object-cover rounded border border-[#e8e0d0]"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setImageFile(null);
                          setImagePreview(null);
                          setFormData({...formData, imageUrl: ""});
                        }}
                        className="absolute top-2 right-2 bg-red-600 text-white p-1 rounded-full hover:bg-red-700"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {/* Upload option */}
                      <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-[#d4af37]/30 rounded cursor-pointer hover:border-[#d4af37]/50 transition-colors bg-white">
                        <div className="flex flex-col items-center justify-center py-3">
                          <span className="text-2xl mb-1">📤</span>
                          <p className="text-sm text-[#7a6a4a]">Click to upload image</p>
                          <p className="text-xs text-[#7a6a4a]/70">PNG, JPG up to 5MB</p>
                        </div>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleImageChange}
                          className="hidden"
                        />
                      </label>

                      {/* Or paste URL */}
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-px bg-[#d4af37]/20"></div>
                        <span className="text-xs text-[#7a6a4a]">OR paste image URL</span>
                        <div className="flex-1 h-px bg-[#d4af37]/20"></div>
                      </div>

                      <input
                        type="url"
                        value={formData.imageUrl}
                        onChange={(e) => {
                          setFormData({...formData, imageUrl: e.target.value});
                          if (e.target.value) {
                            setImagePreview(e.target.value);
                          }
                        }}
                        placeholder="https://example.com/image.jpg"
                        className="w-full px-4 py-2 bg-white border border-[#e8e0d0] text-[#1c1810] text-sm focus:outline-none focus:ring-2 focus:ring-[#d4af37] placeholder-[#b0a080]/50"
                      />
                    </div>
                  )}
                  <p className="text-xs text-[#7a6a4a]">Add an image to make your notification more engaging</p>
                </div>
              </div>

              {/* Schedule */}
              <div>
                <label className="block text-sm font-medium text-[#d4af37] mb-2">Schedule (Optional)</label>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-[#7a6a4a] mb-1">Date</label>
                    <input
                      type="date"
                      value={formData.scheduledAt ? formData.scheduledAt.split('T')[0] : ''}
                      onChange={(e) => {
                        const time = formData.scheduledAt ? formData.scheduledAt.split('T')[1] || '12:00' : '12:00';
                        setFormData({...formData, scheduledAt: e.target.value ? `${e.target.value}T${time}` : ''});
                      }}
                      className="w-full px-4 py-3 bg-white border border-[#e8e0d0] text-[#1c1810] focus:outline-none focus:ring-2 focus:ring-[#d4af37] cursor-pointer"
                      min={new Date().toISOString().split('T')[0]}
                      style={{ colorScheme: 'dark' }}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-[#7a6a4a] mb-1">Time</label>
                    <input
                      type="time"
                      value={formData.scheduledAt ? formData.scheduledAt.split('T')[1]?.substring(0, 5) || '12:00' : ''}
                      onChange={(e) => {
                        const date = formData.scheduledAt ? formData.scheduledAt.split('T')[0] : new Date().toISOString().split('T')[0];
                        setFormData({...formData, scheduledAt: `${date}T${e.target.value}`});
                      }}
                      className="w-full px-4 py-3 bg-white border border-[#e8e0d0] text-[#1c1810] focus:outline-none focus:ring-2 focus:ring-[#d4af37] cursor-pointer"
                      style={{ colorScheme: 'dark' }}
                      disabled={!formData.scheduledAt}
                    />
                  </div>
                </div>
                {formData.scheduledAt && (
                  <button
                    type="button"
                    onClick={() => setFormData({...formData, scheduledAt: ""})}
                    className="mt-2 px-3 py-1 text-sm bg-red-600/20 text-red-400 border border-red-600/30 hover:bg-red-600/30 transition-colors"
                  >
                    ✕ Clear Schedule
                  </button>
                )}
                <p className="text-xs text-[#7a6a4a] mt-2">Select a date first, then choose the time. Leave empty to send immediately or save as draft.</p>
              </div>

              {/* Info about scheduling */}
              {formData.scheduledAt && (
                <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded text-blue-300 text-sm">
                  📅 <strong>Scheduling for:</strong> {new Date(formData.scheduledAt).toLocaleString("en-PH", { timeZone: "Asia/Manila" })}
                  <br />
                  <span className="text-xs text-blue-400">Users will receive this notification at the scheduled time.</span>
                </div>
              )}

              <div className="flex gap-3 pt-4 border-t border-[#e8e0d0]">
                {/* Send Now - only if NOT scheduled */}
                {!formData.scheduledAt && (
                  <button
                    onClick={() => handleCreate(true)}
                    disabled={isSending}
                    className="flex-1 px-4 py-3 bg-green-600 text-white font-semibold hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {isSending ? '⏳ Sending...' : '🚀 Send Now'}
                  </button>
                )}

                {/* Schedule - only if date is set */}
                {formData.scheduledAt && (
                  <button
                    onClick={() => handleCreate(false)}
                    disabled={isSending}
                    className="flex-1 px-4 py-3 bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors"
                  >
                    {isSending ? '⏳ Scheduling...' : '📅 Schedule for Later'}
                  </button>
                )}

                {/* Save Draft - only if NOT scheduled */}
                {!formData.scheduledAt && (
                  <button
                    onClick={() => handleCreate(false)}
                    disabled={isSending}
                    className="flex-1 px-4 py-3 bg-[#333] text-[#1c1810] font-semibold hover:bg-[#444] disabled:opacity-50 transition-colors"
                  >
                    💾 Save Draft
                  </button>
                )}

                <button
                  onClick={() => setShowCreateModal(false)}
                  disabled={isSending}
                  className="px-6 py-3 border border-[#e8e0d0] text-[#1c1810] hover:border-[#d4af37]/50 disabled:opacity-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* EDIT MODAL */}
      {showEditModal && editingNotification && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <div className="bg-[#faf8f3] border border-[#e8e0d0] max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-[#e8e0d0]">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-[#d4af37]">Edit Notification</h2>
                <button
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingNotification(null);
                    resetForm();
                  }}
                  className="text-[#7a6a4a] hover:text-[#1c1810] text-2xl"
                >
                  ×
                </button>
              </div>
            </div>

            <div className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-medium text-[#d4af37] mb-2">Title *</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({...formData, title: e.target.value})}
                  className="w-full px-4 py-3 bg-white border border-[#e8e0d0] text-[#1c1810] focus:outline-none focus:ring-2 focus:ring-[#d4af37]"
                  placeholder="Enter notification title..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[#d4af37] mb-2">Message *</label>
                <textarea
                  value={formData.message}
                  onChange={(e) => setFormData({...formData, message: e.target.value})}
                  className="w-full px-4 py-3 bg-white border border-[#e8e0d0] text-[#1c1810] focus:outline-none focus:ring-2 focus:ring-[#d4af37]"
                  rows={4}
                  placeholder="Enter notification message..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[#d4af37] mb-2">Type</label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({...formData, type: e.target.value})}
                    className="w-full px-4 py-3 bg-white border border-[#e8e0d0] text-[#1c1810] focus:outline-none focus:ring-2 focus:ring-[#d4af37]"
                  >
                    <option value="announcement">📢 Announcement</option>
                    <option value="promotion">🎉 Promotion</option>
                    <option value="alert">⚠️ Alert</option>
                    <option value="update">🔔 Update</option>
                    <option value="newsletter">📰 Newsletter</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-[#d4af37] mb-2">Target Audience</label>
                  <select
                    value={formData.targetAudience}
                    onChange={(e) => setFormData({...formData, targetAudience: e.target.value})}
                    className="w-full px-4 py-3 bg-white border border-[#e8e0d0] text-[#1c1810] focus:outline-none focus:ring-2 focus:ring-[#d4af37]"
                  >
                    <option value="customers">👥 Customers Only</option>
                    <option value="all">🌐 All Users</option>
                    <option value="admins">👔 Admins Only</option>
                  </select>
                </div>
              </div>

              {/* Image Upload or URL for Edit */}
              <div>
                <label className="block text-sm font-medium text-[#d4af37] mb-2">Image (Optional)</label>
                <div className="space-y-3">
                  {imagePreview ? (
                    <div className="relative">
                      <img
                        src={imagePreview}
                        alt="Preview"
                        className="w-full h-48 object-cover rounded border border-[#e8e0d0]"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setImageFile(null);
                          setImagePreview(null);
                          setFormData({...formData, imageUrl: ""});
                        }}
                        className="absolute top-2 right-2 bg-red-600 text-white p-1 rounded-full hover:bg-red-700"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {/* Upload option */}
                      <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-[#d4af37]/30 rounded cursor-pointer hover:border-[#d4af37]/50 transition-colors bg-white">
                        <div className="flex flex-col items-center justify-center py-3">
                          <span className="text-2xl mb-1">📤</span>
                          <p className="text-sm text-[#7a6a4a]">Click to upload image</p>
                          <p className="text-xs text-[#7a6a4a]/70">PNG, JPG up to 5MB</p>
                        </div>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleImageChange}
                          className="hidden"
                        />
                      </label>

                      {/* Or paste URL */}
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-px bg-[#d4af37]/20"></div>
                        <span className="text-xs text-[#7a6a4a]">OR paste image URL</span>
                        <div className="flex-1 h-px bg-[#d4af37]/20"></div>
                      </div>

                      <input
                        type="url"
                        value={formData.imageUrl}
                        onChange={(e) => {
                          setFormData({...formData, imageUrl: e.target.value});
                          if (e.target.value) {
                            setImagePreview(e.target.value);
                          }
                        }}
                        placeholder="https://example.com/image.jpg"
                        className="w-full px-4 py-2 bg-white border border-[#e8e0d0] text-[#1c1810] text-sm focus:outline-none focus:ring-2 focus:ring-[#d4af37] placeholder-[#b0a080]/50"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Schedule for Edit - matching Create modal UI */}
              <div>
                <label className="block text-sm font-medium text-[#d4af37] mb-2">Schedule (Optional)</label>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-[#7a6a4a] mb-1">Date</label>
                    <input
                      type="date"
                      value={formData.scheduledAt ? formData.scheduledAt.split('T')[0] : ''}
                      onChange={(e) => {
                        const time = formData.scheduledAt ? formData.scheduledAt.split('T')[1] || '12:00' : '12:00';
                        setFormData({...formData, scheduledAt: e.target.value ? `${e.target.value}T${time}` : ''});
                      }}
                      className="w-full px-4 py-3 bg-white border border-[#e8e0d0] text-[#1c1810] focus:outline-none focus:ring-2 focus:ring-[#d4af37] cursor-pointer"
                      min={new Date().toISOString().split('T')[0]}
                      style={{ colorScheme: 'dark' }}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-[#7a6a4a] mb-1">Time</label>
                    <input
                      type="time"
                      value={formData.scheduledAt ? formData.scheduledAt.split('T')[1]?.substring(0, 5) || '12:00' : ''}
                      onChange={(e) => {
                        const date = formData.scheduledAt ? formData.scheduledAt.split('T')[0] : new Date().toISOString().split('T')[0];
                        setFormData({...formData, scheduledAt: `${date}T${e.target.value}`});
                      }}
                      className="w-full px-4 py-3 bg-white border border-[#e8e0d0] text-[#1c1810] focus:outline-none focus:ring-2 focus:ring-[#d4af37] cursor-pointer"
                      style={{ colorScheme: 'dark' }}
                      disabled={!formData.scheduledAt}
                    />
                  </div>
                </div>
                {formData.scheduledAt && (
                  <button
                    type="button"
                    onClick={() => setFormData({...formData, scheduledAt: ""})}
                    className="mt-2 px-3 py-1 text-sm bg-red-600/20 text-red-400 border border-red-600/30 hover:bg-red-600/30 transition-colors"
                  >
                    ✕ Clear Schedule
                  </button>
                )}
                <p className="text-xs text-[#7a6a4a] mt-2">Select a date first, then choose the time. Leave empty to save as draft.</p>
              </div>

              {/* Info about scheduling */}
              {formData.scheduledAt && (
                <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded text-blue-300 text-sm">
                  📅 <strong>Scheduling for:</strong> {new Date(formData.scheduledAt).toLocaleString("en-PH", { timeZone: "Asia/Manila" })}
                  <br />
                  <span className="text-xs text-blue-400">Users will receive this notification at the scheduled time.</span>
                </div>
              )}

              <div className="flex gap-3 pt-4 border-t border-[#e8e0d0]">
                {/* Save/Schedule based on whether scheduled */}
                {formData.scheduledAt ? (
                  <button
                    onClick={handleUpdate}
                    disabled={isSending}
                    className="flex-1 px-4 py-3 bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {isSending ? '⏳ Saving...' : '📅 Save & Schedule'}
                  </button>
                ) : (
                  <button
                    onClick={handleUpdate}
                    disabled={isSending}
                    className="flex-1 px-4 py-3 bg-[#333] text-[#1c1810] font-semibold hover:bg-[#444] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {isSending ? '⏳ Saving...' : '💾 Save as Draft'}
                  </button>
                )}
                <button
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingNotification(null);
                    resetForm();
                  }}
                  disabled={isSending}
                  className="px-6 py-3 border border-[#e8e0d0] text-[#1c1810] hover:border-[#d4af37]/50 disabled:opacity-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
