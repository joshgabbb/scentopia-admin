// app/admin/management/feedback/page.tsx
"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

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

  const [reviews, setReviews] = useState<Review[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [selectedReview, setSelectedReview] = useState<Review | null>(null);
  const [reviewResponse, setReviewResponse] = useState("");
  const [reviewSearch, setReviewSearch] = useState("");
  const [reviewsPage, setReviewsPage] = useState(1);
  const [reviewsTotalPages, setReviewsTotalPages] = useState(1);

  const fetchReviews = useCallback(async () => {
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
  }, [reviewsPage, reviewSearch]);

  useEffect(() => { fetchReviews(); }, [fetchReviews]);

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
        <h1 className="text-2xl font-bold text-[#d4af37] uppercase tracking-[2px]">Product Reviews</h1>
        <button
          onClick={fetchReviews}
          className="px-4 py-2 border border-[#e8e0d0] text-[#1c1810] hover:border-[#d4af37]/50 transition-colors"
        >
          ↻ Refresh
        </button>
      </div>

      {/* SEARCH */}
      <div className="flex gap-4">
        <input
          type="text"
          placeholder="Search reviews..."
          value={reviewSearch}
          onChange={(e) => { setReviewSearch(e.target.value); setReviewsPage(1); }}
          className="flex-1 px-4 py-2 bg-white border border-[#e8e0d0] text-[#1c1810] placeholder-[#b0a080] focus:outline-none focus:ring-2 focus:ring-[#d4af37]"
        />
      </div>

      {/* TABLE */}
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
                    {item.isAnon && <div className="text-xs text-[#7a6a4a] italic">Anonymous</div>}
                  </td>
                  <td className="px-6 py-4 text-[#1c1810]">{item.productName}</td>
                  <td className="px-6 py-4 text-[#d4af37] text-sm">{renderStars(item.rating)}</td>
                  <td className="px-6 py-4">
                    <div className="max-w-xs truncate text-[#1c1810] text-sm">{item.description || "—"}</div>
                  </td>
                  <td className="px-6 py-4 text-sm text-[#7a6a4a]">
                    {new Date(item.createdAt).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric", timeZone: "Asia/Manila" })}
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

      {/* PAGINATION */}
      {reviewsTotalPages > 1 && (
        <div className="flex justify-center gap-2">
          <button onClick={() => setReviewsPage(p => Math.max(1, p - 1))} disabled={reviewsPage === 1} className="px-4 py-2 border border-[#e8e0d0] text-[#1c1810] disabled:opacity-50 hover:border-[#d4af37]/50">Previous</button>
          <span className="px-4 py-2 text-[#7a6a4a]">Page {reviewsPage} of {reviewsTotalPages}</span>
          <button onClick={() => setReviewsPage(p => Math.min(reviewsTotalPages, p + 1))} disabled={reviewsPage === reviewsTotalPages} className="px-4 py-2 border border-[#e8e0d0] text-[#1c1810] disabled:opacity-50 hover:border-[#d4af37]/50">Next</button>
        </div>
      )}

      {/* REVIEW REPLY MODAL */}
      {selectedReview && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-[#e8e0d0] max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-[#e8e0d0] bg-white">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-xl font-bold text-[#d4af37]">{selectedReview.productName}</h2>
                  <p className="text-sm text-[#7a6a4a] mt-1">
                    By {selectedReview.customerName}
                    {selectedReview.isAnon && <span className="italic ml-1">(Anonymous)</span>}
                    {" · "}<span className="text-[#d4af37]">{renderStars(selectedReview.rating)}</span>
                  </p>
                </div>
                <button onClick={() => setSelectedReview(null)} className="text-[#7a6a4a] hover:text-[#1c1810]">✕</button>
              </div>
            </div>
            <div className="p-6 space-y-4 bg-white">
              <div>
                <h3 className="font-semibold text-[#d4af37] mb-2">Customer Review</h3>
                <p className="text-[#1c1810]">{selectedReview.description || "No written review."}</p>
              </div>
              {selectedReview.adminResponse && (
                <div className="bg-[#faf8f3] border border-[#e8e0d0] p-4">
                  <h3 className="font-semibold text-[#d4af37] mb-2">Admin Reply</h3>
                  <p className="text-[#1c1810]">{selectedReview.adminResponse}</p>
                  <p className="text-xs text-[#7a6a4a] mt-2">Replied: {new Date(selectedReview.respondedAt!).toLocaleString("en-PH", { timeZone: "Asia/Manila" })}</p>
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
                  className="mt-2 px-4 py-2 bg-[#d4af37] text-white font-medium hover:bg-[#c49b28] disabled:opacity-50 disabled:cursor-not-allowed"
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
