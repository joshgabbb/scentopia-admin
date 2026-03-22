"use client";

import React, { useState, useEffect } from "react";
import {
  Search,
  ArrowUpDown,
  Package,
  RotateCcw,
  Trash2,
  ArchiveRestore,
  AlertCircle,
  Loader2,
} from "lucide-react";

interface Category {
  id: string;
  name: string;
}

interface Product {
  id: string;
  name: string;
  description: string;
  images: string[];
  price: number;
  createdAt: string;
  updatedAt: string;
  archivedAt: string;
  perfumeType: "Basic" | "Premium";
  isActive: boolean;
  isArchived: boolean;
  category: Category | null;
  totalStock: number;
}

interface ProductsData {
  products: Product[];
  totalCount: number;
  totalPages: number;
  currentPage: number;
}

const Skeleton = ({ className }: { className?: string }) => (
  <div className={`animate-pulse bg-[#d4af37]/10 rounded ${className}`} />
);

const ProductRowSkeleton = () => (
  <tr className="border-b border-gray-100">
    <td className="px-6 py-4">
      <Skeleton className="w-4 h-4" />
    </td>
    <td className="px-6 py-4">
      <div className="flex items-center space-x-3">
        <Skeleton className="w-12 h-12" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-24" />
        </div>
      </div>
    </td>
    <td className="px-6 py-4">
      <Skeleton className="h-6 w-16" />
    </td>
    <td className="px-6 py-4">
      <Skeleton className="h-4 w-20" />
    </td>
    <td className="px-6 py-4">
      <Skeleton className="h-4 w-24" />
    </td>
    <td className="px-6 py-4">
      <Skeleton className="h-8 w-20" />
    </td>
  </tr>
);

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
  }).format(amount);
};

const formatDate = (dateString: string) => {
  if (!dateString) return "N/A";
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "Asia/Manila",
    year: "numeric",
  });
};

const getPerfumeTypeColor = (type: string) => {
  switch (type) {
    case "Premium":
      return "bg-purple-100 text-purple-800";
    case "Basic":
      return "bg-blue-100 text-blue-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
};

export default function ArchivedProductsPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [data, setData] = useState<ProductsData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [sortBy, setSortBy] = useState<string>("archived_at");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [isRestoring, setIsRestoring] = useState<string | null>(null);
  const [isBulkActionLoading, setIsBulkActionLoading] = useState(false);

  const fetchArchivedProducts = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const params = new URLSearchParams({
        page: currentPage.toString(),
        search: searchTerm,
        sort_by: sortBy,
        sort_order: sortOrder,
        archived: "true",
      });

      const response = await fetch(`/api/admin/products?${params}`);
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || "Failed to fetch archived products");
      }

      setData(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error occurred");
      console.error("Archived products fetch error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchArchivedProducts();
  }, [currentPage, sortBy, sortOrder]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (currentPage !== 1) {
        setCurrentPage(1);
      } else {
        fetchArchivedProducts();
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [searchTerm]);

  const handleSelectAll = () => {
    if (!data) return;

    if (selectedProducts.size === data.products.length) {
      setSelectedProducts(new Set());
    } else {
      setSelectedProducts(new Set(data.products.map((product) => product.id)));
    }
  };

  const handleSelectProduct = (productId: string) => {
    const newSelected = new Set(selectedProducts);
    if (newSelected.has(productId)) {
      newSelected.delete(productId);
    } else {
      newSelected.add(productId);
    }
    setSelectedProducts(newSelected);
  };

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setSortOrder("desc");
    }
  };

  const handleRestoreProduct = async (productId: string) => {
    setIsRestoring(productId);
    try {
      const response = await fetch(`/api/admin/products?id=${productId}&action=restore`, {
        method: "DELETE",
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || "Failed to restore product");
      }

      fetchArchivedProducts();
    } catch (error) {
      console.error("Failed to restore product:", error);
      alert("Failed to restore product. Please try again.");
    } finally {
      setIsRestoring(null);
    }
  };

  const handleBulkRestore = async () => {
    if (selectedProducts.size === 0) return;

    const confirmMessage = `Are you sure you want to restore ${selectedProducts.size} selected product(s)?`;
    if (!confirm(confirmMessage)) return;

    setIsBulkActionLoading(true);
    try {
      const restorePromises = Array.from(selectedProducts).map((productId) =>
        fetch(`/api/admin/products?id=${productId}&action=restore`, { method: "DELETE" })
      );

      await Promise.all(restorePromises);
      setSelectedProducts(new Set());
      fetchArchivedProducts();
    } catch (error) {
      console.error("Failed to restore products:", error);
      alert("Failed to restore some products. Please try again.");
    } finally {
      setIsBulkActionLoading(false);
    }
  };

  const clearSelection = () => {
    setSelectedProducts(new Set());
  };

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <div className="text-red-500 text-lg mb-2">Error loading archived products</div>
          <div className="text-[#7a6a4a] text-sm">{error}</div>
          <button
            onClick={fetchArchivedProducts}
            className="mt-4 px-4 py-2 bg-black text-white hover:bg-[#d4af37]/90 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <ArchiveRestore className="w-6 h-6 text-[#d4af37]" />
          <h1 className="text-2xl font-bold text-[#1c1810]">Archived Products</h1>
          <div className="h-5 px-2 bg-[#d4af37]/10 rounded-full flex items-center justify-center">
            <span className="text-xs text-[#7a6a4a] font-semibold">
              {data?.totalCount || 0}
            </span>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="flex items-center space-x-4 flex-1 max-w-md">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[#7a6a4a] w-4 h-4" />
          <input
            type="text"
            placeholder="Search archived products..."
            className="w-full pl-10 pr-4 py-2 border border-[#e8e0d0] bg-[#faf8f3] text-[#1c1810] placeholder-[#b0a080] focus:outline-none focus:ring-2 focus:ring-[#d4af37] focus:border-transparent"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-[#faf8f3] border border-[#e8e0d0]">
        <div className="px-6 py-4 border-b border-[#e8e0d0] flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <h2 className="text-lg font-medium text-[#1c1810]">Archived Products</h2>

            {/* Bulk Actions Bar */}
            {selectedProducts.size > 0 && (
              <div className="flex items-center space-x-4 pl-4 border-l border-[#e8e0d0]">
                <span className="text-sm text-[#7a6a4a]">
                  {selectedProducts.size} selected
                </span>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={handleBulkRestore}
                    disabled={isBulkActionLoading}
                    className="px-3 py-1 text-sm bg-green-100 text-green-800 hover:bg-green-200 transition-colors flex items-center space-x-1 disabled:opacity-50"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Restore All</span>
                  </button>
                  <button
                    onClick={clearSelection}
                    disabled={isBulkActionLoading}
                    className="p-1 text-gray-400 hover:text-[#7a6a4a] transition-colors disabled:opacity-50"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-white border-b border-[#e8e0d0]">
              <tr>
                <th className="px-6 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={
                      data != null &&
                      data?.products.length > 0 &&
                      selectedProducts.size === data.products.length
                    }
                    onChange={handleSelectAll}
                    className="w-4 h-4 accent-[#d4af37]"
                  />
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-[#7a6a4a] uppercase tracking-wider cursor-pointer hover:bg-[#d4af37]/5"
                  onClick={() => handleSort("name")}
                >
                  Product
                  {sortBy === "name" && (
                    <ArrowUpDown
                      className={`inline w-3 h-3 ml-1 ${
                        sortOrder === "desc" ? "rotate-180" : ""
                      }`}
                    />
                  )}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-[#7a6a4a] uppercase tracking-wider">
                  Type
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-[#7a6a4a] uppercase tracking-wider cursor-pointer hover:bg-[#d4af37]/5"
                  onClick={() => handleSort("price")}
                >
                  Price
                  {sortBy === "price" && (
                    <ArrowUpDown
                      className={`inline w-3 h-3 ml-1 ${
                        sortOrder === "desc" ? "rotate-180" : ""
                      }`}
                    />
                  )}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-[#7a6a4a] uppercase tracking-wider">
                  Category
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-[#7a6a4a] uppercase tracking-wider cursor-pointer hover:bg-[#d4af37]/5"
                  onClick={() => handleSort("archived_at")}
                >
                  Archived
                  {sortBy === "archived_at" && (
                    <ArrowUpDown
                      className={`inline w-3 h-3 ml-1 ${
                        sortOrder === "desc" ? "rotate-180" : ""
                      }`}
                    />
                  )}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-[#7a6a4a] uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-[#faf8f3] divide-y divide-[#d4af37]/10">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, index) => (
                  <ProductRowSkeleton key={index} />
                ))
              ) : data?.products.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-[#7a6a4a]">
                    <ArchiveRestore className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No archived products</p>
                    <p className="text-sm mt-2">Products you archive will appear here</p>
                  </td>
                </tr>
              ) : (
                data?.products.map((product) => (
                  <tr
                    key={product.id}
                    className="hover:bg-[#d4af37]/5 transition-colors"
                  >
                    <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedProducts.has(product.id)}
                        onChange={() => handleSelectProduct(product.id)}
                        className="w-4 h-4 accent-[#d4af37]"
                      />
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-3">
                        <div className="min-w-12 w-12 h-12 bg-[#d4af37]/10 border border-[#e8e0d0] rounded-lg flex items-center justify-center overflow-hidden opacity-60">
                          {product.images && product.images.length > 0 ? (
                            <img
                              src={product.images[0]}
                              alt={product.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <Package className="w-6 h-6 text-[#d4af37]" />
                          )}
                        </div>
                        <div>
                          <div className="text-sm font-medium text-[#1c1810] opacity-75">
                            {product.name}
                          </div>
                          <div className="text-xs text-[#7a6a4a] line-clamp-1">
                            {product.description}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full opacity-75 ${getPerfumeTypeColor(
                          product.perfumeType
                        )}`}
                      >
                        {product.perfumeType}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-[#d4af37] opacity-75">
                      {formatCurrency(product.price)}
                    </td>
                    <td className="px-6 py-4 text-sm text-[#1c1810] opacity-75">
                      {product.category?.name || "No category"}
                    </td>
                    <td className="px-6 py-4 text-sm text-[#7a6a4a]">
                      {formatDate(product.archivedAt)}
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => handleRestoreProduct(product.id)}
                        disabled={isRestoring === product.id}
                        className="px-3 py-1.5 text-sm bg-green-100 text-green-800 hover:bg-green-200 transition-colors flex items-center space-x-1 disabled:opacity-50 rounded"
                      >
                        {isRestoring === product.id ? (
                          <>
                            <Loader2 className="w-3 h-3 animate-spin" />
                            <span>Restoring...</span>
                          </>
                        ) : (
                          <>
                            <RotateCcw className="w-3 h-3" />
                            <span>Restore</span>
                          </>
                        )}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {data && data.totalPages > 1 && (
          <div className="px-6 py-4 border-t border-[#e8e0d0] flex items-center justify-between">
            <div className="text-sm text-[#7a6a4a]">
              Showing {(currentPage - 1) * 25 + 1} to{" "}
              {Math.min(currentPage * 25, data.totalCount)} of {data.totalCount}{" "}
              archived products
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1 border border-[#e8e0d0] text-sm text-[#7a6a4a] hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <span className="px-3 py-1 text-sm text-[#7a6a4a]">
                Page {currentPage} of {data.totalPages}
              </span>
              <button
                onClick={() =>
                  setCurrentPage((prev) => Math.min(data.totalPages, prev + 1))
                }
                disabled={currentPage === data.totalPages}
                className="px-3 py-1 border border-[#e8e0d0] text-sm text-[#7a6a4a] hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
