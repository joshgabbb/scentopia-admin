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
      case "pending": return "bg-yellow-100 text-yellow-800";
      case "in_progress": return "bg-blue-100 text-blue-800";
      case "resolved": return "bg-green-100 text-green-800";
      case "closed": return "bg-gray-100 text-gray-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "urgent": return "bg-red-100 text-red-800";
      case "high": return "bg-orange-100 text-orange-800";
      case "medium": return "bg-yellow-100 text-yellow-800";
      case "low": return "bg-green-100 text-green-800";
      default: return "bg-gray-100 text-gray-800";
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
        <h1 className="text-2xl font-bold">Feedback Management</h1>
        <button className="px-4 py-2 bg-black text-white hover:bg-gray-800">
          Export Report
        </button>
      </div>

      <div className="flex gap-4">
        <input
          type="text"
          placeholder="Search feedback..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-1 px-4 py-2 border border-gray-300"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 border border-gray-300"
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
          className="px-4 py-2 border border-gray-300"
        >
          <option value="all">All Priority</option>
          <option value="urgent">Urgent</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
      </div>

      <div className="bg-white border">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Subject</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Priority</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {feedback.map((item) => (
              <tr key={item.id} className="hover:bg-gray-50">
                <td className="px-6 py-4">
                  <div>
                    <div className="font-medium">{item.customerName}</div>
                    <div className="text-sm text-gray-500">{item.customerEmail}</div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="max-w-xs truncate">{item.subject}</div>
                </td>
                <td className="px-6 py-4">
                  <span className="capitalize">{item.category}</span>
                </td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 text-xs rounded-full ${getPriorityColor(item.priority)}`}>
                    {item.priority}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(item.status)}`}>
                    {item.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-gray-500">
                  {new Date(item.createdAt).toLocaleDateString()}
                </td>
                <td className="px-6 py-4">
                  <button
                    onClick={() => setSelectedFeedback(item)}
                    className="text-blue-600 hover:text-blue-800"
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-xl font-bold">{selectedFeedback.subject}</h2>
                  <p className="text-sm text-gray-600 mt-1">
                    From {selectedFeedback.customerName} ({selectedFeedback.customerEmail})
                  </p>
                </div>
                <button onClick={() => setSelectedFeedback(null)} className="text-gray-400 hover:text-gray-600">
                  ✕
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <h3 className="font-semibold mb-2">Message</h3>
                <p className="text-gray-700">{selectedFeedback.message}</p>
              </div>

              {selectedFeedback.adminResponse && (
                <div className="bg-blue-50 p-4 rounded">
                  <h3 className="font-semibold mb-2">Your Response</h3>
                  <p className="text-gray-700">{selectedFeedback.adminResponse}</p>
                  <p className="text-xs text-gray-500 mt-2">
                    Responded: {new Date(selectedFeedback.respondedAt!).toLocaleString()}
                  </p>
                </div>
              )}

              {selectedFeedback.status !== "resolved" && (
                <div>
                  <h3 className="font-semibold mb-2">Send Response</h3>
                  <textarea
                    value={response}
                    onChange={(e) => setResponse(e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded"
                    rows={4}
                    placeholder="Type your response..."
                  />
                  <button
                    onClick={handleRespond}
                    className="mt-2 px-4 py-2 bg-blue-600 text-white hover:bg-blue-700"
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