// app/admin/reports/feedback/page.tsx
"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

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

export default function FeedbackPage() {
  const router = useRouter();
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedFeedback, setSelectedFeedback] = useState<Feedback | null>(null);
  const [response, setResponse] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    fetchFeedback();
  }, [currentPage, statusFilter, priorityFilter, searchTerm]);

  const fetchFeedback = async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams({
        page: currentPage.toString(),
        status: statusFilter,
        search: searchTerm
      });

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

  const handleRespond = async () => {
    if (!selectedFeedback || !response.trim()) return;

    try {
      const res = await fetch("/api/admin/reports/feedback", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selectedFeedback.id,
          adminResponse: response,
          status: "resolved"
        })
      });

      if (res.ok) {
        setSelectedFeedback(null);
        setResponse("");
        fetchFeedback();
      }
    } catch (error) {
      console.error("Failed to respond:", error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending": return "bg-yellow-500/20 text-yellow-400";
      case "in_progress": return "bg-blue-500/20 text-blue-400";
      case "resolved": return "bg-green-500/20 text-green-400";
      case "closed": return "bg-[#333] text-[#b8a070]";
      default: return "bg-[#333] text-[#b8a070]";
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "urgent": return "bg-red-500/20 text-red-400";
      case "high": return "bg-orange-500/20 text-orange-400";
      case "medium": return "bg-yellow-500/20 text-yellow-400";
      case "low": return "bg-green-500/20 text-green-400";
      default: return "bg-[#333] text-[#b8a070]";
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#d4af37]"></div>
        <span className="ml-3 text-[#b8a070]">Loading...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* BACK NAVIGATION */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.push("/admin/reports")}
          className="flex items-center gap-2 px-4 py-2 border border-[#d4af37]/20 text-[#f5e6d3] hover:border-[#d4af37]/50 transition-colors"
        >
          <span>←</span>
          <span>Back to Reports</span>
        </button>
      </div>

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[#d4af37] uppercase tracking-[2px]">Feedback Management</h1>
        <button className="px-4 py-2 bg-[#d4af37] text-[#0a0a0a] font-medium hover:bg-[#d4af37]/90">
          Export Report
        </button>
      </div>

      <div className="flex gap-4">
        <input
          type="text"
          placeholder="Search feedback..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-1 px-4 py-2 bg-[#0a0a0a] border border-[#d4af37]/20 text-[#f5e6d3] placeholder-[#b8a070] focus:outline-none focus:ring-2 focus:ring-[#d4af37]"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 bg-[#0a0a0a] border border-[#d4af37]/20 text-[#f5e6d3] focus:outline-none focus:ring-2 focus:ring-[#d4af37]"
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
          className="px-4 py-2 bg-[#0a0a0a] border border-[#d4af37]/20 text-[#f5e6d3] focus:outline-none focus:ring-2 focus:ring-[#d4af37]"
        >
          <option value="all">All Priority</option>
          <option value="urgent">Urgent</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
      </div>

      <div className="bg-[#1a1a1a] border border-[#d4af37]/20">
        <table className="w-full">
          <thead className="bg-[#0a0a0a]">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-[#b8a070] uppercase">Customer</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-[#b8a070] uppercase">Subject</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-[#b8a070] uppercase">Category</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-[#b8a070] uppercase">Priority</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-[#b8a070] uppercase">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-[#b8a070] uppercase">Date</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-[#b8a070] uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#d4af37]/10">
            {feedback.map((item) => (
              <tr key={item.id} className="hover:bg-[#0a0a0a]/50">
                <td className="px-6 py-4">
                  <div>
                    <div className="font-medium text-[#f5e6d3]">{item.customerName}</div>
                    <div className="text-sm text-[#b8a070]">{item.customerEmail}</div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="max-w-xs truncate text-[#f5e6d3]">{item.subject}</div>
                </td>
                <td className="px-6 py-4">
                  <span className="capitalize text-[#f5e6d3]">{item.category}</span>
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
                <td className="px-6 py-4 text-sm text-[#b8a070]">
                  {new Date(item.createdAt).toLocaleDateString()}
                </td>
                <td className="px-6 py-4">
                  <button
                    onClick={() => setSelectedFeedback(item)}
                    className="text-[#d4af37] hover:text-[#d4af37]/80"
                  >
                    View
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedFeedback && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center p-4 z-50">
          <div className="bg-[#1a1a1a] border border-[#d4af37]/20 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-[#d4af37]/20">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-xl font-bold text-[#d4af37]">{selectedFeedback.subject}</h2>
                  <p className="text-sm text-[#b8a070] mt-1">
                    From {selectedFeedback.customerName} ({selectedFeedback.customerEmail})
                  </p>
                </div>
                <button onClick={() => setSelectedFeedback(null)} className="text-[#b8a070] hover:text-[#f5e6d3]">
                  ✕
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <h3 className="font-semibold text-[#d4af37] mb-2">Message</h3>
                <p className="text-[#f5e6d3]">{selectedFeedback.message}</p>
              </div>

              {selectedFeedback.adminResponse && (
                <div className="bg-[#0a0a0a] border border-[#d4af37]/20 p-4">
                  <h3 className="font-semibold text-[#d4af37] mb-2">Your Response</h3>
                  <p className="text-[#f5e6d3]">{selectedFeedback.adminResponse}</p>
                  <p className="text-xs text-[#b8a070] mt-2">
                    Responded: {new Date(selectedFeedback.respondedAt!).toLocaleString()}
                  </p>
                </div>
              )}

              {selectedFeedback.status !== "resolved" && (
                <div>
                  <h3 className="font-semibold text-[#d4af37] mb-2">Send Response</h3>
                  <textarea
                    value={response}
                    onChange={(e) => setResponse(e.target.value)}
                    className="w-full p-3 bg-[#0a0a0a] border border-[#d4af37]/20 text-[#f5e6d3] focus:outline-none focus:ring-2 focus:ring-[#d4af37]"
                    rows={4}
                    placeholder="Type your response..."
                  />
                  <button
                    onClick={handleRespond}
                    className="mt-2 px-4 py-2 bg-[#d4af37] text-[#0a0a0a] font-medium hover:bg-[#d4af37]/90"
                  >
                    Send Response
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="px-4 py-2 border border-[#d4af37]/20 text-[#f5e6d3] disabled:opacity-50 hover:border-[#d4af37]/50"
          >
            Previous
          </button>
          <span className="px-4 py-2 text-[#b8a070]">Page {currentPage} of {totalPages}</span>
          <button
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="px-4 py-2 border border-[#d4af37]/20 text-[#f5e6d3] disabled:opacity-50 hover:border-[#d4af37]/50"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
