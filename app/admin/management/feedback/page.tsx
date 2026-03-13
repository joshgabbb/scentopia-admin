// app/admin/management/feedback/page.tsx
"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

interface Feedback {
  id: string;
  userId: string;
  customerName: string;
  customerEmail: string;
  subject: string;
  message: string;
  status: string;
  priority: string;
  category: string;
  createdAt: string;
  adminResponse: string | null;
  respondedAt: string | null;
}

interface Review {
  id: string;
  customerName: string;
  productName: string;
  rating: number;
  description: string;
  isAnon: boolean;
  createdAt: string;
  adminResponse: string | null;
  respondedAt: string | null;
}

export default function FeedbackPage() {
  const router = useRouter();

  // Tab state
  const [activeTab, setActiveTab] = useState<"feedback" | "reviews">("feedback");

  // Feedback state
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedFeedback, setSelectedFeedback] = useState<Feedback | null>(null);
  const [response, setResponse] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [newFeedbackCount, setNewFeedbackCount] = useState(0);

  // Reviews state
  const [reviews, setReviews] = useState<Review[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [selectedReview, setSelectedReview] = useState<Review | null>(null);
  const [reviewResponse, setReviewResponse] = useState("");
  const [reviewSearch, setReviewSearch] = useState("");
  const [reviewsPage, setReviewsPage] = useState(1);
  const [reviewsTotalPages, setReviewsTotalPages] = useState(1);

  // Setup real-time subscription for new feedback
  useEffect(() => {
    const supabase = createClient();
    let channel: RealtimeChannel;

    const setupRealtime = () => {
      channel = supabase
        .channel('admin-feedback-changes')
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'feedback' },
          (payload) => {
            console.log('New feedback received:', payload);
            setNewFeedbackCount(prev => prev + 1);
            if (currentPage === 1 && statusFilter === 'all' && searchTerm === '') {
              fetchFeedback();
            }
          }
        )
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'feedback' },
          (payload) => {
            console.log('Feedback updated:', payload);
            setFeedback(prev => prev.map(f =>
              f.id === payload.new.id ? { ...f, ...payload.new } : f
            ));
          }
        )
        .subscribe();
    };

    setupRealtime();
    return () => { if (channel) supabase.removeChannel(channel); };
  }, [currentPage, statusFilter, searchTerm]);

  useEffect(() => { fetchFeedback(); }, [currentPage, statusFilter, priorityFilter, searchTerm]);
  useEffect(() => { if (activeTab === 'reviews') fetchReviews(); }, [activeTab, reviewsPage, reviewSearch]);

  const fetchFeedback = async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams({ page: currentPage.toString(), status: statusFilter, search: searchTerm });
      const res = await fetch(`/api/admin/reports/feedback?${params}`);
      const result = await res.json();
      if (result.success) {
        setFeedback(result.data.feedback);
        setTotalPages(result.data.totalPages);
      }
    } catch (error) {
      console.error("Failed to fetch feedback:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchReviews = async () => {
    try {
      setReviewsLoading(true);
      const params = new URLSearchParams({ page: reviewsPage.toString(), search: reviewSearch });
      const res = await fetch(`/api/admin/reviews?${params}`);
      const result = await res.json();
      if (result.success) {
        setReviews(result.data.reviews);
        setReviewsTotalPages(result.data.totalPages);
      }
    } catch (error) {
      console.error("Failed to fetch reviews:", error);
    } finally {
      setReviewsLoading(false);
    }
  };

  const handleRespond = async () => {
    if (!selectedFeedback || !response.trim()) return;
    try {
      const res = await fetch("/api/admin/reports/feedback", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selectedFeedback.id, adminResponse: response, status: "resolved" })
      });
      if (res.ok) { setSelectedFeedback(null); setResponse(""); fetchFeedback(); }
    } catch (error) { console.error("Failed to respond:", error); }
  };

  const handleReplyReview = async () => {
    if (!selectedReview || !reviewResponse.trim()) return;
    try {
      const res = await fetch("/api/admin/reviews", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selectedReview.id, adminResponse: reviewResponse })
      });
      if (res.ok) {
        setSelectedReview(null);
        setReviewResponse("");
        fetchReviews();
      }
    } catch (error) { console.error("Failed to reply to review:", error); }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending": return "bg-yellow-500/20 text-yellow-400";
      case "in_progress": return "bg-blue-500/20 text-blue-400";
      case "resolved": return "bg-green-500/20 text-green-400";
      case "closed": return "bg-[#333] text-[#7a6a4a]";
      default: return "bg-[#333] text-[#7a6a4a]";
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "urgent": return "bg-red-500/20 text-red-400";
      case "high": return "bg-orange-500/20 text-orange-400";
      case "medium": return "bg-yellow-500/20 text-yellow-400";
      case "low": return "bg-green-500/20 text-green-400";
      default: return "bg-[#333] text-[#7a6a4a]";
    }
  };

  const renderStars = (rating: number) => "★".repeat(rating) + "☆".repeat(5 - rating);

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

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold text-[#d4af37] uppercase tracking-[2px]">Feedback Management</h1>
          {newFeedbackCount > 0 && activeTab === 'feedback' && (
            <button
              onClick={() => { setNewFeedbackCount(0); fetchFeedback(); }}
              className="flex items-center gap-2 px-3 py-1 bg-green-500/20 text-green-400 text-sm animate-pulse hover:bg-green-500/30 transition-colors"
            >
              <span className="w-2 h-2 bg-green-400 rounded-full"></span>
              {newFeedbackCount} new feedback - Click to refresh
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => activeTab === 'feedback' ? fetchFeedback() : fetchReviews()}
            className="px-4 py-2 border border-[#e8e0d0] text-[#1c1810] hover:border-[#d4af37]/50 transition-colors"
          >
            ↻ Refresh
          </button>
          <button className="px-4 py-2 bg-[#d4af37] text-[#0a0a0a] font-medium hover:bg-[#d4af37]/90">
            Export Report
          </button>
        </div>
      </div>

      {/* TABS */}
      <div className="flex border-b border-[#e8e0d0]">
        <button
          onClick={() => setActiveTab('feedback')}
          className={`px-6 py-3 font-medium text-sm transition-colors ${activeTab === 'feedback' ? 'border-b-2 border-[#d4af37] text-[#d4af37]' : 'text-[#7a6a4a] hover:text-[#1c1810]'}`}
        >
          Customer Feedback
        </button>
        <button
          onClick={() => setActiveTab('reviews')}
          className={`px-6 py-3 font-medium text-sm transition-colors ${activeTab === 'reviews' ? 'border-b-2 border-[#d4af37] text-[#d4af37]' : 'text-[#7a6a4a] hover:text-[#1c1810]'}`}
        >
          Product Reviews
        </button>
      </div>

      {/* ── FEEDBACK TAB ── */}
      {activeTab === 'feedback' && (
        <>
          <div className="flex gap-4">
            <input
              type="text"
              placeholder="Search feedback..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1 px-4 py-2 bg-white border border-[#e8e0d0] text-[#1c1810] placeholder-[#b0a080] focus:outline-none focus:ring-2 focus:ring-[#d4af37]"
            />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 bg-white border border-[#e8e0d0] text-[#1c1810] focus:outline-none focus:ring-2 focus:ring-[#d4af37]"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="in_progress">In Progress</option>
              <option value="resolved">Resolved</option>
              <option value="closed">Closed</option>
            </select>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="px-4 py-2 bg-white border border-[#e8e0d0] text-[#1c1810] focus:outline-none focus:ring-2 focus:ring-[#d4af37]"
            >
              <option value="all">All Priority</option>
              <option value="urgent">Urgent</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>

          {isLoading ? (
            <div className="p-6 flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#d4af37]"></div>
              <span className="ml-3 text-[#7a6a4a]">Loading...</span>
            </div>
          ) : (
            <div className="bg-[#faf8f3] border border-[#e8e0d0]">
              <table className="w-full">
                <thead className="bg-white">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-[#7a6a4a] uppercase">Customer</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-[#7a6a4a] uppercase">Subject</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-[#7a6a4a] uppercase">Category</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-[#7a6a4a] uppercase">Priority</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-[#7a6a4a] uppercase">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-[#7a6a4a] uppercase">Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-[#7a6a4a] uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#d4af37]/10">
                  {feedback.map((item) => (
                    <tr key={item.id} className="hover:bg-white/50">
                      <td className="px-6 py-4">
                        <div>
                          <div className="font-medium text-[#1c1810]">{item.customerName}</div>
                          <div className="text-sm text-[#7a6a4a]">{item.customerEmail}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="max-w-xs truncate text-[#1c1810]">{item.subject}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="capitalize text-[#1c1810]">{item.category}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 text-xs ${getPriorityColor(item.priority)}`}>
                          {item.priority}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 text-xs ${getStatusColor(item.status)}`}>
                          {item.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-[#7a6a4a]">
                        {new Date(item.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4">
                        <button onClick={() => setSelectedFeedback(item)} className="text-[#d4af37] hover:text-[#d4af37]/80">
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex justify-center gap-2">
              <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="px-4 py-2 border border-[#e8e0d0] text-[#1c1810] disabled:opacity-50 hover:border-[#d4af37]/50">Previous</button>
              <span className="px-4 py-2 text-[#7a6a4a]">Page {currentPage} of {totalPages}</span>
              <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="px-4 py-2 border border-[#e8e0d0] text-[#1c1810] disabled:opacity-50 hover:border-[#d4af37]/50">Next</button>
            </div>
          )}
        </>
      )}

      {/* ── REVIEWS TAB ── */}
      {activeTab === 'reviews' && (
        <>
          <div className="flex gap-4">
            <input
              type="text"
              placeholder="Search reviews..."
              value={reviewSearch}
              onChange={(e) => { setReviewSearch(e.target.value); setReviewsPage(1); }}
              className="flex-1 px-4 py-2 bg-white border border-[#e8e0d0] text-[#1c1810] placeholder-[#b0a080] focus:outline-none focus:ring-2 focus:ring-[#d4af37]"
            />
          </div>

          {reviewsLoading ? (
            <div className="p-6 flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#d4af37]"></div>
              <span className="ml-3 text-[#7a6a4a]">Loading...</span>
            </div>
          ) : (
            <div className="bg-[#faf8f3] border border-[#e8e0d0]">
              <table className="w-full">
                <thead className="bg-white">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-[#7a6a4a] uppercase">Customer</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-[#7a6a4a] uppercase">Product</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-[#7a6a4a] uppercase">Rating</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-[#7a6a4a] uppercase">Review</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-[#7a6a4a] uppercase">Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-[#7a6a4a] uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#d4af37]/10">
                  {reviews.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-8 text-center text-[#7a6a4a]">No reviews found.</td>
                    </tr>
                  ) : reviews.map((item) => (
                    <tr key={item.id} className="hover:bg-white/50">
                      <td className="px-6 py-4">
                        <div className="font-medium text-[#1c1810]">{item.customerName}</div>
                        {item.isAnon && <div className="text-xs text-[#7a6a4a]">Anonymous</div>}
                      </td>
                      <td className="px-6 py-4 text-[#1c1810]">{item.productName}</td>
                      <td className="px-6 py-4 text-[#d4af37] text-sm">{renderStars(item.rating)}</td>
                      <td className="px-6 py-4">
                        <div className="max-w-xs truncate text-[#1c1810] text-sm">{item.description || "—"}</div>
                      </td>
                      <td className="px-6 py-4 text-sm text-[#7a6a4a]">
                        {new Date(item.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => { setSelectedReview(item); setReviewResponse(""); }}
                          className="text-[#d4af37] hover:text-[#d4af37]/80"
                        >
                          {item.adminResponse ? "View" : "Reply"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {reviewsTotalPages > 1 && (
            <div className="flex justify-center gap-2">
              <button onClick={() => setReviewsPage(p => Math.max(1, p - 1))} disabled={reviewsPage === 1} className="px-4 py-2 border border-[#e8e0d0] text-[#1c1810] disabled:opacity-50 hover:border-[#d4af37]/50">Previous</button>
              <span className="px-4 py-2 text-[#7a6a4a]">Page {reviewsPage} of {reviewsTotalPages}</span>
              <button onClick={() => setReviewsPage(p => Math.min(reviewsTotalPages, p + 1))} disabled={reviewsPage === reviewsTotalPages} className="px-4 py-2 border border-[#e8e0d0] text-[#1c1810] disabled:opacity-50 hover:border-[#d4af37]/50">Next</button>
            </div>
          )}
        </>
      )}

      {/* ── FEEDBACK MODAL ── */}
      {selectedFeedback && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center p-4 z-50">
          <div className="bg-[#faf8f3] border border-[#e8e0d0] max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-[#e8e0d0]">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-xl font-bold text-[#d4af37]">{selectedFeedback.subject}</h2>
                  <p className="text-sm text-[#7a6a4a] mt-1">From {selectedFeedback.customerName} ({selectedFeedback.customerEmail})</p>
                </div>
                <button onClick={() => setSelectedFeedback(null)} className="text-[#7a6a4a] hover:text-[#1c1810]">✕</button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <h3 className="font-semibold text-[#d4af37] mb-2">Message</h3>
                <p className="text-[#1c1810]">{selectedFeedback.message}</p>
              </div>
              {selectedFeedback.adminResponse && (
                <div className="bg-white border border-[#e8e0d0] p-4">
                  <h3 className="font-semibold text-[#d4af37] mb-2">Your Response</h3>
                  <p className="text-[#1c1810]">{selectedFeedback.adminResponse}</p>
                  <p className="text-xs text-[#7a6a4a] mt-2">Responded: {new Date(selectedFeedback.respondedAt!).toLocaleString()}</p>
                </div>
              )}
              {selectedFeedback.status !== "resolved" && (
                <div>
                  <h3 className="font-semibold text-[#d4af37] mb-2">Send Response</h3>
                  <textarea
                    value={response}
                    onChange={(e) => setResponse(e.target.value)}
                    className="w-full p-3 bg-white border border-[#e8e0d0] text-[#1c1810] focus:outline-none focus:ring-2 focus:ring-[#d4af37]"
                    rows={4}
                    placeholder="Type your response..."
                  />
                  <button onClick={handleRespond} className="mt-2 px-4 py-2 bg-[#d4af37] text-[#0a0a0a] font-medium hover:bg-[#d4af37]/90">
                    Send Response
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── REVIEW REPLY MODAL ── */}
      {selectedReview && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center p-4 z-50">
          <div className="bg-[#faf8f3] border border-[#e8e0d0] max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-[#e8e0d0]">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-xl font-bold text-[#d4af37]">{selectedReview.productName}</h2>
                  <p className="text-sm text-[#7a6a4a] mt-1">
                    By {selectedReview.customerName} · <span className="text-[#d4af37]">{renderStars(selectedReview.rating)}</span>
                  </p>
                </div>
                <button onClick={() => setSelectedReview(null)} className="text-[#7a6a4a] hover:text-[#1c1810]">✕</button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <h3 className="font-semibold text-[#d4af37] mb-2">Customer Review</h3>
                <p className="text-[#1c1810]">{selectedReview.description || "No written review."}</p>
              </div>
              {selectedReview.adminResponse && (
                <div className="bg-white border border-[#e8e0d0] p-4">
                  <h3 className="font-semibold text-[#d4af37] mb-2">Admin Reply</h3>
                  <p className="text-[#1c1810]">{selectedReview.adminResponse}</p>
                  <p className="text-xs text-[#7a6a4a] mt-2">Replied: {new Date(selectedReview.respondedAt!).toLocaleString()}</p>
                </div>
              )}
              <div>
                <h3 className="font-semibold text-[#d4af37] mb-2">
                  {selectedReview.adminResponse ? "Update Reply" : "Reply to Review"}
                </h3>
                <textarea
                  value={reviewResponse}
                  onChange={(e) => setReviewResponse(e.target.value)}
                  className="w-full p-3 bg-white border border-[#e8e0d0] text-[#1c1810] focus:outline-none focus:ring-2 focus:ring-[#d4af37]"
                  rows={4}
                  placeholder="Type your reply..."
                />
                <button
                  onClick={handleReplyReview}
                  disabled={!reviewResponse.trim()}
                  className="mt-2 px-4 py-2 bg-[#d4af37] text-[#0a0a0a] font-medium hover:bg-[#d4af37]/90 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Save Reply
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
