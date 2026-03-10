"use client";

import React, { useState, useEffect } from "react";
import {
  Search,
  ArrowUpDown,
  FileText,
  FileSpreadsheet,
  Edit,
  MoreHorizontal,
  Download,
  Plus,
  Package,
  Eye,
  Archive,
  X,
  ToggleLeft,
  ToggleRight,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import ProductDetails from "./product-details";
import CustomSidebar from "@/components/modals/sidebar";
import AddProduct from "@/components/admin/sidebars/addproduct-sidebar";
import { exportReport, createProductsExportConfig, type ExportFormat } from "@/lib/export-utils";

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
  perfumeType: "Basic" | "Premium";
  isActive: boolean;
  category: Category | null;
  occasionsTags: string[];
  weatherTags: string[];
  topNotesTags: string[];
  otherOptionsTags: string[];
  sizes: Record<string, number>;
  stocks: Record<string, number>;
  totalStock: number;
  availableSizes: string[];
}

interface ProductsData {
  products: Product[];
  totalCount: number;
  totalPages: number;
  currentPage: number;
}

const Skeleton = ({ className }: { className?: string }) => (
  <div className={`animate-pulse bg-[#D4AF37]/10 rounded ${className}`} />
);

const ProductRowSkeleton = () => (
  <tr className="border-b border-[#f0ebe0]">
    <td className="px-5 py-4"><Skeleton className="w-4 h-4" /></td>
    <td className="px-5 py-4">
      <div className="flex items-center space-x-3">
        <Skeleton className="w-11 h-11 rounded-sm flex-shrink-0" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-24" />
        </div>
      </div>
    </td>
    <td className="px-5 py-4"><Skeleton className="h-6 w-16 rounded-full" /></td>
    <td className="px-5 py-4"><Skeleton className="h-4 w-20" /></td>
    <td className="px-5 py-4"><Skeleton className="h-6 w-16 rounded-full" /></td>
    <td className="px-5 py-4"><Skeleton className="h-4 w-16" /></td>
    <td className="px-5 py-4"><Skeleton className="h-4 w-20" /></td>
    <td className="px-5 py-4"><Skeleton className="h-4 w-16" /></td>
    <td className="px-5 py-4"><Skeleton className="w-16 h-7 rounded-sm" /></td>
  </tr>
);

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(amount);

const formatDate = (dateString: string) =>
  new Date(dateString).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

const getStatusBadge = (isActive: boolean) =>
  isActive
    ? "bg-green-50 text-green-700 border border-green-200"
    : "bg-red-50 text-red-600 border border-red-200";

const getPerfumeTypeBadge = (type: string) => {
  switch (type) {
    case "Premium": return "bg-purple-50 text-purple-700 border border-purple-200";
    case "Basic":   return "bg-blue-50 text-blue-700 border border-blue-200";
    default:        return "bg-gray-50 text-gray-600 border border-gray-200";
  }
};

const getSortFieldMapping = (field: string): string => {
  switch (field) {
    case "name":         return "name";
    case "price":        return "price";
    case "category":     return "category.name";
    case "perfume_type": return "perfume_type";
    case "created_at":   return "created_at";
    default:             return field;
  }
};

// Compact page numbers: [1] [2] ... [N-1] [N]
const getPageNumbers = (current: number, total: number): (number | "...")[] => {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const delta = 2;
  const range: (number | "...")[] = [];
  for (let i = Math.max(2, current - delta); i <= Math.min(total - 1, current + delta); i++) {
    range.push(i);
  }
  if (current - delta > 2) range.unshift("...");
  if (current + delta < total - 1) range.push("...");
  range.unshift(1);
  if (total > 1) range.push(total);
  return range;
};

export default function ProductsPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [data, setData] = useState<ProductsData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [sortBy, setSortBy] = useState<string>("created_at");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [perfumeTypeFilter, setPerfumeTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isLoadingProduct, setIsLoadingProduct] = useState(false);
  const [isAddSidebarOpen, setIsAddSidebarOpen] = useState(false);
  const [isBulkActionLoading, setIsBulkActionLoading] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportFormat, setExportFormat] = useState<ExportFormat>("csv");
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await fetch("/api/admin/categories");
        const result = await response.json();
        if (result.success) setCategories(result.data);
      } catch (err) {
        console.error("Failed to fetch categories:", err);
      }
    };
    fetchCategories();
  }, []);

  const handleProductUpdate = (productId: string, updates: Partial<Product>) => {};

  const fetchProductDetails = async (productId: string) => {
    try {
      setIsLoadingProduct(true);
      const response = await fetch(`/api/admin/products/${productId}`);
      const result = await response.json();
      if (!result.success) throw new Error(result.error || "Failed to fetch product details");
      setSelectedProduct(result.data);
    } catch (err) {
      console.error("Product details fetch error:", err);
    } finally {
      setIsLoadingProduct(false);
    }
  };

  const handleProductClick = (product: Product) => fetchProductDetails(product.id);
  const handleBackToList = () => setSelectedProduct(null);

  const fetchProducts = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const params = new URLSearchParams({
        page: currentPage.toString(),
        search: searchTerm,
        sort_by: getSortFieldMapping(sortBy),
        sort_order: sortOrder,
        category: categoryFilter,
        perfume_type: perfumeTypeFilter,
        status: statusFilter,
      });
      const response = await fetch(`/api/admin/products?${params}`);
      const result = await response.json();
      if (!result.success) throw new Error(result.error || "Failed to fetch products");
      setData(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error occurred");
      console.error("Products fetch error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchProducts(); }, [currentPage, sortBy, sortOrder, categoryFilter, perfumeTypeFilter, statusFilter]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (currentPage !== 1) setCurrentPage(1);
      else fetchProducts();
    }, 500);
    return () => clearTimeout(timeout);
  }, [searchTerm]);

  const handleSelectAll = () => {
    if (!data) return;
    setSelectedProducts(
      selectedProducts.size === data.products.length
        ? new Set()
        : new Set(data.products.map((p) => p.id))
    );
  };

  const handleSelectProduct = (productId: string) => {
    const next = new Set(selectedProducts);
    next.has(productId) ? next.delete(productId) : next.add(productId);
    setSelectedProducts(next);
  };

  const handleSort = (field: string) => {
    if (sortBy === field) setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    else { setSortBy(field); setSortOrder("desc"); }
  };

  const handleArchiveProduct = async (productId: string) => {
    if (!confirm("Are you sure you want to archive this product? It can be restored later from the Archive section.")) return;
    try {
      const response = await fetch(`/api/admin/products?id=${productId}`, { method: "DELETE" });
      if (response.ok) fetchProducts();
    } catch (error) {
      console.error("Failed to archive product:", error);
    }
  };

  const handleBulkArchive = async () => {
    if (selectedProducts.size === 0) return;
    if (!confirm(`Are you sure you want to archive ${selectedProducts.size} selected product(s)?`)) return;
    setIsBulkActionLoading(true);
    try {
      await Promise.all(Array.from(selectedProducts).map((id) => fetch(`/api/admin/products?id=${id}`, { method: "DELETE" })));
      setSelectedProducts(new Set());
      fetchProducts();
    } catch (error) {
      console.error("Failed to archive products:", error);
    } finally {
      setIsBulkActionLoading(false);
    }
  };

  const handleBulkStatusToggle = async (status: boolean) => {
    if (selectedProducts.size === 0) return;
    if (!confirm(`Are you sure you want to ${status ? "activate" : "deactivate"} ${selectedProducts.size} selected product(s)?`)) return;
    setIsBulkActionLoading(true);
    try {
      await Promise.all(
        Array.from(selectedProducts).map((id) =>
          fetch(`/api/admin/products?id=${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ is_active: status }) })
        )
      );
      setSelectedProducts(new Set());
      fetchProducts();
    } catch (error) {
      console.error("Failed to update products:", error);
    } finally {
      setIsBulkActionLoading(false);
    }
  };

  const handleBulkExport = () => { if (selectedProducts.size > 0) setShowExportModal(true); };

  const executeProductExport = () => {
    const selected = data?.products.filter((p) => selectedProducts.has(p.id));
    if (!selected?.length) return;
    const config = createProductsExportConfig(selected);
    config.filename = `selected_products_${selectedProducts.size}`;
    config.subtitle = `Selected products export (${selectedProducts.size} products)`;
    exportReport(config, exportFormat);
    setShowExportModal(false);
    alert(`Successfully exported ${selected.length} product(s) as ${exportFormat.toUpperCase()}!`);
  };

  const clearSelection = () => setSelectedProducts(new Set());

  if (selectedProduct || isLoadingProduct) {
    return (
      <ProductDetails
        product={selectedProduct}
        isLoading={isLoadingProduct}
        onBack={handleBackToList}
      />
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="text-red-500 text-lg mb-2 font-semibold">Error loading products</div>
          <div className="text-[#7a6a4a] text-sm">{error}</div>
          <button
            onClick={fetchProducts}
            className="mt-4 px-5 py-2.5 bg-[#D4AF37] text-[#1c1810] font-semibold hover:bg-[#C4A030] transition-colors rounded-sm text-sm"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const selectFieldClass =
    "px-3 py-2 border border-[#e8e0d0] bg-white text-[#1c1810] text-sm focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/40 focus:border-[#D4AF37] rounded-sm transition-colors hover:border-[#D4AF37]/50 min-w-0";

  return (
    <>
      <div className="space-y-5">

        {/* Page header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-[#1c1810]">Products</h1>
            <span className="inline-flex items-center justify-center h-6 min-w-[24px] px-2 bg-[#D4AF37]/12 border border-[#D4AF37]/30 rounded-full">
              <span className="text-xs text-[#8B6914] font-bold">{data?.totalCount ?? 0}</span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button className="px-4 py-2 border border-[#e8e0d0] text-[#1c1810] text-sm font-medium hover:bg-[#f5f0e8] hover:border-[#D4AF37]/40 transition-colors rounded-sm flex items-center gap-2">
              <Edit className="w-4 h-4 text-[#7a6a4a]" />
              <span>Bulk Edit</span>
            </button>
            <button
              onClick={() => setIsAddSidebarOpen(true)}
              className="px-4 py-2 bg-[#D4AF37] text-[#1c1810] font-semibold text-sm hover:bg-[#C4A030] transition-colors rounded-sm flex items-center gap-2 shadow-sm hover:shadow-md hover:shadow-[#D4AF37]/20"
            >
              <Plus className="w-4 h-4" />
              <span>Add Product</span>
            </button>
          </div>
        </div>

        {/* Search + Filters */}
        <div className="flex flex-col sm:flex-row flex-wrap gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px] sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9a8a6a] w-4 h-4" />
            <input
              type="text"
              placeholder="Search products…"
              className="w-full pl-9 pr-4 py-2 border border-[#e8e0d0] bg-white text-[#1c1810] text-sm placeholder-[#b0a080] focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/40 focus:border-[#D4AF37] rounded-sm transition-colors"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Filters row */}
          <div className="flex flex-wrap gap-2">
            <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className={selectFieldClass}>
              <option value="all">All categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>

            <select value={perfumeTypeFilter} onChange={(e) => setPerfumeTypeFilter(e.target.value)} className={selectFieldClass}>
              <option value="all">All types</option>
              <option value="Basic">Basic</option>
              <option value="Premium">Premium</option>
            </select>

            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={selectFieldClass}>
              <option value="all">All status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>

        {/* Table card */}
        <div className="bg-white border border-[#e8e0d0] rounded-sm shadow-sm">

          {/* Table header bar */}
          <div className="px-5 py-3.5 border-b border-[#e8e0d0] flex items-center justify-between flex-wrap gap-3">
            <h2 className="text-sm font-semibold text-[#1c1810]">All Products</h2>

            {selectedProducts.size > 0 && (
              <div className="flex items-center flex-wrap gap-2">
                <span className="text-xs text-[#7a6a4a] font-medium bg-[#f5f0e8] px-2.5 py-1 rounded-full">
                  {selectedProducts.size} selected
                </span>
                <button
                  onClick={() => handleBulkStatusToggle(true)}
                  disabled={isBulkActionLoading}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 transition-colors rounded-full disabled:opacity-50"
                >
                  <ToggleRight className="w-3 h-3" /> Activate
                </button>
                <button
                  onClick={() => handleBulkStatusToggle(false)}
                  disabled={isBulkActionLoading}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-gray-50 text-gray-700 border border-gray-200 hover:bg-gray-100 transition-colors rounded-full disabled:opacity-50"
                >
                  <ToggleLeft className="w-3 h-3" /> Deactivate
                </button>
                <button
                  onClick={handleBulkExport}
                  disabled={isBulkActionLoading}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition-colors rounded-full disabled:opacity-50"
                >
                  <Download className="w-3 h-3" /> Export
                </button>
                <button
                  onClick={handleBulkArchive}
                  disabled={isBulkActionLoading}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-orange-50 text-orange-700 border border-orange-200 hover:bg-orange-100 transition-colors rounded-full disabled:opacity-50"
                >
                  <Archive className="w-3 h-3" /> Archive
                </button>
                <button
                  onClick={clearSelection}
                  disabled={isBulkActionLoading}
                  className="p-1 text-[#9a8a6a] hover:text-[#7a6a4a] transition-colors disabled:opacity-50"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* Scrollable table */}
          <div className="overflow-x-auto" style={{ maxHeight: "calc(100vh - 360px)", overflowY: "auto" }}>
            <table className="w-full min-w-[760px]">
              <thead className="bg-[#faf8f3] border-b border-[#e8e0d0] sticky top-0 z-10">
                <tr>
                  <th className="px-5 py-3 text-left w-10">
                    <input
                      type="checkbox"
                      checked={data != null && data.products.length > 0 && selectedProducts.size === data.products.length}
                      onChange={handleSelectAll}
                      className="w-4 h-4 accent-[#D4AF37] cursor-pointer"
                    />
                  </th>
                  {[
                    { label: "Product", field: "name" },
                    { label: "Type", field: "perfume_type" },
                    { label: "Base Price", field: "price" },
                    { label: "Status", field: null },
                    { label: "Stock", field: null },
                    { label: "Category", field: null },
                    { label: "Created", field: "created_at" },
                  ].map(({ label, field }) => (
                    <th
                      key={label}
                      className={`px-5 py-3 text-left text-xs font-bold text-[#7a6a4a] uppercase tracking-wider ${field ? "cursor-pointer hover:bg-[#f0ebe0] hover:text-[#8B6914] select-none" : ""} transition-colors`}
                      onClick={field ? () => handleSort(field) : undefined}
                    >
                      {label}
                      {field && sortBy === field && (
                        <ArrowUpDown className={`inline w-3 h-3 ml-1 text-[#D4AF37] ${sortOrder === "desc" ? "rotate-180" : ""}`} />
                      )}
                    </th>
                  ))}
                  <th className="px-5 py-3 text-left text-xs font-bold text-[#7a6a4a] uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-[#f5f0e8]">
                {isLoading ? (
                  Array.from({ length: 10 }).map((_, i) => <ProductRowSkeleton key={i} />)
                ) : data?.products.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-5 py-16 text-center">
                      <Package className="w-10 h-10 text-[#D4AF37]/30 mx-auto mb-3" />
                      <p className="text-[#7a6a4a] font-medium">No products found</p>
                      <p className="text-xs text-[#9a8a6a] mt-1">Try adjusting your search or filters</p>
                    </td>
                  </tr>
                ) : (
                  data?.products.map((product) => (
                    <tr
                      key={product.id}
                      className="hover:bg-[#faf8f3] cursor-pointer transition-colors group"
                      onClick={() => handleProductClick(product)}
                    >
                      <td className="px-5 py-3.5" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedProducts.has(product.id)}
                          onChange={() => handleSelectProduct(product.id)}
                          className="w-4 h-4 accent-[#D4AF37] cursor-pointer"
                        />
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-11 h-11 bg-[#f5f0e8] border border-[#e8e0d0] rounded-sm flex-shrink-0 flex items-center justify-center overflow-hidden group-hover:border-[#D4AF37]/40 transition-colors">
                            {product.images.length > 0 ? (
                              <img src={product.images[0]} alt={product.name} className="w-full h-full object-cover" />
                            ) : (
                              <Package className="w-5 h-5 text-[#D4AF37]/60" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-[#1c1810] truncate max-w-[180px]">{product.name}</div>
                            <div className="text-xs text-[#9a8a6a] line-clamp-1 max-w-[180px]">{product.description}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`inline-flex px-2.5 py-1 text-xs font-semibold rounded-full ${getPerfumeTypeBadge(product.perfumeType)}`}>
                          {product.perfumeType}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="text-sm font-bold text-[#8B6914]">{formatCurrency(product.price)}</span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`inline-flex px-2.5 py-1 text-xs font-semibold rounded-full ${getStatusBadge(product.isActive)}`}>
                          {product.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="text-sm text-[#1c1810] font-medium">{product.totalStock}</span>
                        <span className="text-xs text-[#9a8a6a] ml-1">units</span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="text-sm text-[#1c1810]">{product.category?.name ?? <span className="text-[#9a8a6a] italic text-xs">No category</span>}</span>
                      </td>
                      <td className="px-5 py-3.5 text-sm text-[#9a8a6a]">{formatDate(product.createdAt)}</td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => handleProductClick(product)}
                            className="p-1.5 text-[#9a8a6a] hover:text-[#8B6914] hover:bg-[#D4AF37]/10 rounded-sm transition-colors"
                            title="View"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleArchiveProduct(product.id)}
                            className="p-1.5 text-[#9a8a6a] hover:text-orange-500 hover:bg-orange-50 rounded-sm transition-colors"
                            title="Archive"
                          >
                            <Archive className="w-4 h-4" />
                          </button>
                          <button className="p-1.5 text-[#9a8a6a] hover:text-[#8B6914] hover:bg-[#D4AF37]/10 rounded-sm transition-colors">
                            <MoreHorizontal className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {data && data.totalPages >= 1 && (
            <div className="px-5 py-4 border-t border-[#e8e0d0] flex flex-col sm:flex-row items-center justify-between gap-3">
              <p className="text-xs text-[#7a6a4a] font-medium">
                Showing{" "}
                <span className="text-[#1c1810] font-bold">{Math.min((currentPage - 1) * 25 + 1, data.totalCount)}</span>
                {" "}–{" "}
                <span className="text-[#1c1810] font-bold">{Math.min(currentPage * 25, data.totalCount)}</span>
                {" "}of{" "}
                <span className="text-[#1c1810] font-bold">{data.totalCount}</span> products
              </p>

              {data.totalPages > 1 && (
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="p-1.5 border border-[#e8e0d0] text-[#7a6a4a] hover:bg-[#f5f0e8] hover:border-[#D4AF37]/40 hover:text-[#8B6914] disabled:opacity-40 disabled:cursor-not-allowed transition-colors rounded-sm"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>

                  {getPageNumbers(currentPage, data.totalPages).map((page, idx) =>
                    page === "..." ? (
                      <span key={`ellipsis-${idx}`} className="px-2 py-1 text-xs text-[#9a8a6a] select-none">
                        …
                      </span>
                    ) : (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page as number)}
                        className={`min-w-[32px] h-8 px-2 text-xs font-semibold border transition-colors rounded-sm ${
                          currentPage === page
                            ? "bg-[#D4AF37] text-[#1c1810] border-[#D4AF37] shadow-sm"
                            : "border-[#e8e0d0] text-[#7a6a4a] hover:bg-[#f5f0e8] hover:border-[#D4AF37]/40 hover:text-[#8B6914]"
                        }`}
                      >
                        {page}
                      </button>
                    )
                  )}

                  <button
                    onClick={() => setCurrentPage((p) => Math.min(data.totalPages, p + 1))}
                    disabled={currentPage === data.totalPages}
                    className="p-1.5 border border-[#e8e0d0] text-[#7a6a4a] hover:bg-[#f5f0e8] hover:border-[#D4AF37]/40 hover:text-[#8B6914] disabled:opacity-40 disabled:cursor-not-allowed transition-colors rounded-sm"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Add Product Sidebar */}
      <CustomSidebar isOpen={isAddSidebarOpen} onClose={() => setIsAddSidebarOpen(false)} title="Add Product">
        <AddProduct onClose={() => setIsAddSidebarOpen(false)} onProductAdd={() => {}} />
      </CustomSidebar>

      {/* Export Modal */}
      {showExportModal && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-[#e8e0d0] rounded-sm shadow-2xl w-full max-w-md">
            {/* Modal header */}
            <div className="px-6 py-4 border-b border-[#e8e0d0] flex items-center justify-between">
              <h2 className="text-lg font-bold text-[#1c1810]">Export Products</h2>
              <button onClick={() => setShowExportModal(false)} className="p-1 text-[#9a8a6a] hover:text-[#1c1810] hover:bg-[#f5f0e8] rounded-sm transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Format selection */}
              <div>
                <label className="block text-xs font-bold text-[#7a6a4a] mb-3 uppercase tracking-wider">Export Format</label>
                <div className="grid grid-cols-2 gap-3">
                  {([
                    { format: "csv" as ExportFormat, icon: <FileSpreadsheet className="w-5 h-5" />, label: "CSV", sub: "Spreadsheet" },
                    { format: "pdf" as ExportFormat, icon: <FileText className="w-5 h-5" />, label: "PDF", sub: "Document" },
                  ] as const).map(({ format, icon, label, sub }) => (
                    <button
                      key={format}
                      type="button"
                      onClick={() => setExportFormat(format)}
                      className={`flex items-center gap-3 p-4 rounded-sm border-2 transition-all ${
                        exportFormat === format
                          ? "border-[#D4AF37] bg-[#D4AF37]/8 text-[#8B6914]"
                          : "border-[#e8e0d0] text-[#7a6a4a] hover:border-[#D4AF37]/40 hover:bg-[#faf8f3]"
                      }`}
                    >
                      {icon}
                      <div className="text-left">
                        <div className="font-bold text-sm">{label}</div>
                        <div className="text-xs opacity-70">{sub}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Info */}
              <div className="bg-[#faf8f3] border border-[#e8e0d0] p-3 rounded-sm">
                <p className="text-xs text-[#7a6a4a]">
                  Exporting <span className="font-bold text-[#8B6914]">{selectedProducts.size}</span> selected product(s).
                  Report includes product details, pricing, stock levels, and category information.
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-[#e8e0d0] flex justify-end gap-3">
              <button
                onClick={() => setShowExportModal(false)}
                className="px-4 py-2.5 border border-[#e8e0d0] text-[#7a6a4a] hover:bg-[#f5f0e8] hover:border-[#D4AF37]/40 transition-colors rounded-sm text-sm font-medium"
              >
                Cancel
              </button>
              <button
                onClick={executeProductExport}
                className="px-5 py-2.5 bg-[#D4AF37] text-[#1c1810] hover:bg-[#C4A030] transition-colors rounded-sm text-sm font-semibold flex items-center gap-2 shadow-sm"
              >
                {exportFormat === "pdf" ? <FileText className="w-4 h-4" /> : <FileSpreadsheet className="w-4 h-4" />}
                Export {exportFormat.toUpperCase()}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
