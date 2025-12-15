"use client";

import React, { useState, useEffect } from "react";
import {
  Search,
  Filter,
  ArrowUpDown,
  FileText,
  Edit,
  MoreHorizontal,
  Download,
  Plus,
  Package,
  Eye,
  Trash2,
  X,
  ToggleLeft,
  ToggleRight,
  Archive,
} from "lucide-react";
import ProductDetails from "./product-details";
import CustomSidebar from "@/components/modals/sidebar";
import AddProduct from "@/components/admin/sidebars/addproduct-sidebar";

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
  genderTags: string[];
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
      <Skeleton className="h-6 w-20" />
    </td>
    <td className="px-6 py-4">
      <Skeleton className="h-4 w-16" />
    </td>
    <td className="px-6 py-4">
      <Skeleton className="h-4 w-16" />
    </td>
    <td className="px-6 py-4">
      <Skeleton className="h-4 w-16" />
    </td>
    <td className="px-6 py-4">
      <Skeleton className="w-8 h-8" />
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
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const getStatusColor = (isActive: boolean) => {
  return isActive
    ? "bg-green-100 text-green-800"
    : "bg-red-100 text-red-800";
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

const getSortFieldMapping = (field: string): string => {
  switch (field) {
    case "name":
      return "name";
    case "price":
      return "price";
    case "category":
      return "category.name";
    case "perfume_type":
      return "perfume_type";
    case "created_at":
      return "created_at";
    default:
      return field;
  }
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

  const handleProductUpdate = (productId: string, updates: Partial<Product>) => {
   
  };

  const fetchProductDetails = async (productId: string) => {
    try {
      setIsLoadingProduct(true);
      const response = await fetch(`/api/admin/products/${productId}`);
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || "Failed to fetch product details");
      }

      setSelectedProduct(result.data);
    } catch (err) {
      console.error("Product details fetch error:", err);
    } finally {
      setIsLoadingProduct(false);
    }
  };

  const handleProductClick = (product: Product) => {
    fetchProductDetails(product.id);
  };

  const handleBackToList = () => {
    setSelectedProduct(null);
  };

  const fetchProducts = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const mappedSortBy = getSortFieldMapping(sortBy);

      const params = new URLSearchParams({
        page: currentPage.toString(),
        search: searchTerm,
        sort_by: mappedSortBy,
        sort_order: sortOrder,
        category: categoryFilter,
        perfume_type: perfumeTypeFilter,
        status: statusFilter,
      });

      const response = await fetch(`/api/admin/products?${params}`);
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || "Failed to fetch products");
      }

      setData(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error occurred");
      console.error("Products fetch error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, [currentPage, sortBy, sortOrder, categoryFilter, perfumeTypeFilter, statusFilter]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (currentPage !== 1) {
        setCurrentPage(1);
      } else {
        fetchProducts();
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

  const handleDeleteProduct = async (productId: string) => {
    if (!confirm("Are you sure you want to delete this product? This action cannot be undone.")) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/products?id=${productId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        fetchProducts();
      }
    } catch (error) {
      console.error("Failed to delete product:", error);
    }
  };

  // Bulk Actions
  const handleBulkDelete = async () => {
    if (selectedProducts.size === 0) return;
    
    const confirmMessage = `Are you sure you want to delete ${selectedProducts.size} selected product(s)? This action cannot be undone.`;
    if (!confirm(confirmMessage)) return;

    setIsBulkActionLoading(true);
    try {
      const deletePromises = Array.from(selectedProducts).map(productId =>
        fetch(`/api/admin/products?id=${productId}`, { method: "DELETE" })
      );
      
      await Promise.all(deletePromises);
      setSelectedProducts(new Set());
      fetchProducts();
    } catch (error) {
      console.error("Failed to delete products:", error);
    } finally {
      setIsBulkActionLoading(false);
    }
  };

  const handleBulkStatusToggle = async (status: boolean) => {
    if (selectedProducts.size === 0) return;
    
    const action = status ? "activate" : "deactivate";
    const confirmMessage = `Are you sure you want to ${action} ${selectedProducts.size} selected product(s)?`;
    if (!confirm(confirmMessage)) return;

    setIsBulkActionLoading(true);
    try {
      const updatePromises = Array.from(selectedProducts).map(productId =>
        fetch(`/api/admin/products?id=${productId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ is_active: status })
        })
      );
      
      await Promise.all(updatePromises);
      setSelectedProducts(new Set());
      fetchProducts();
    } catch (error) {
      console.error("Failed to update products:", error);
    } finally {
      setIsBulkActionLoading(false);
    }
  };

  const handleBulkExport = () => {
    if (selectedProducts.size === 0) return;
    
    const selectedProductsData = data?.products.filter(product => 
      selectedProducts.has(product.id)
    );
    
    if (!selectedProductsData) return;

    const csvContent = [
      ["Name", "Description", "Price", "Type", "Status", "Stock", "Category", "Created"].join(","),
      ...selectedProductsData.map(product => [
        `"${product.name}"`,
        `"${product.description}"`,
        product.price,
        product.perfumeType,
        product.isActive ? "Active" : "Inactive",
        product.totalStock,
        product.category?.name || "No category",
        formatDate(product.createdAt)
      ].join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `selected-products-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const clearSelection = () => {
    setSelectedProducts(new Set());
  };

  if (selectedProduct || isLoadingProduct) {
    console.log('Selected product:', selectedProduct);

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
          <div className="text-red-500 text-lg mb-2">Error loading products</div>
          <div className="text-[#b8a070] text-sm">{error}</div>
          <button
            onClick={fetchProducts}
            className="mt-4 px-4 py-2 bg-black text-white hover:bg-[#d4af37]/90 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <h1 className="text-2xl font-bold text-[#f5e6d3]">Products</h1>
            <div className="h-5 px-2 bg-[#d4af37]/10 rounded-full flex items-center justify-center">
              <span className="text-xs text-[#b8a070] font-semibold">
                {data?.totalCount || 0}
              </span>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <button className="px-4 py-2 border border-[#d4af37]/20 text-[#f5e6d3] hover:bg-gray-100 uppercase transition-colors flex items-center space-x-2">
              <Edit className="w-4 h-4" />
              <span>Bulk edit</span>
            </button>
            <button onClick={() => setIsAddSidebarOpen(true)} className="px-4 py-2 bg-black text-white hover:bg-[#d4af37]/90 uppercase tracking-wider font-medium transition-colors flex items-center space-x-2">
              <Plus className="w-4 h-4" />
              <span>Add product</span>
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between">
  <div className="flex items-center space-x-4 flex-1 max-w-2xl">
    <div className="relative flex-1">
      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[#b8a070] w-4 h-4" />
      <input
        type="text"
        placeholder="Search by product name or description"
        className="w-full pl-10 pr-4 py-2 border border-[#d4af37]/20 bg-[#1a1a1a] text-[#f5e6d3] placeholder-[#b8a070] focus:outline-none focus:ring-2 focus:ring-[#d4af37] focus:border-transparent"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
      />
    </div>
  </div>
  <div className="flex items-center space-x-4 flex-1 max-w-2xl justify-end">
    <select
      value={categoryFilter}
      onChange={(e) => setCategoryFilter(e.target.value)}
      className="px-4 py-2 border border-[#d4af37]/20 bg-[#1a1a1a] text-[#f5e6d3] focus:outline-none focus:ring-2 focus:ring-[#d4af37] focus:border-transparent"
    >
      <option value="all">All categories</option>
    </select>
    <select
      value={perfumeTypeFilter}
      onChange={(e) => setPerfumeTypeFilter(e.target.value)}
      className="px-4 py-2 border border-[#d4af37]/20 bg-[#1a1a1a] text-[#f5e6d3] focus:outline-none focus:ring-2 focus:ring-[#d4af37] focus:border-transparent"
    >
      <option value="all">All types</option>
      <option value="Basic">Basic</option>
      <option value="Premium">Premium</option>
    </select>
    <select
      value={statusFilter}
      onChange={(e) => setStatusFilter(e.target.value)}
      className="px-4 py-2 border border-[#d4af37]/20 bg-[#1a1a1a] text-[#f5e6d3] focus:outline-none focus:ring-2 focus:ring-[#d4af37] focus:border-transparent"
    >
      <option value="all">All status</option>
      <option value="active">Active</option>
      <option value="inactive">Inactive</option>
    </select>
  </div>
  {/* <div className="flex items-center space-x-3">
    <button className="p-2 border border-[#d4af37]/20 text-[#f5e6d3] hover:bg-[#d4af37]/5 transition-colors">
      <Filter className="w-4 h-4" />
    </button>
    <button className="p-2 border border-[#d4af37]/20 text-[#f5e6d3] hover:bg-[#d4af37]/5 transition-colors">
      <ArrowUpDown className="w-4 h-4" />
    </button>
  </div> */}
</div>

        <div className="bg-[#1a1a1a] border border-[#d4af37]/20">
          <div className="px-6 py-4 border-b border-[#d4af37]/20 flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <h2 className="text-lg font-medium text-[#f5e6d3]">Products</h2>
              
              {/* Bulk Actions Bar */}
              {selectedProducts.size > 0 && (
                <div className="flex items-center space-x-4 pl-4 border-l border-[#d4af37]/20">
                  <span className="text-sm text-[#b8a070]">
                    {selectedProducts.size} selected
                  </span>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handleBulkStatusToggle(true)}
                      disabled={isBulkActionLoading}
                      className="px-3 py-1 text-sm bg-green-100 text-green-800 hover:bg-green-200 transition-colors flex items-center space-x-1 disabled:opacity-50"
                    >
                      <ToggleRight className="w-3 h-3" />
                      <span>Activate</span>
                    </button>
                    <button
                      onClick={() => handleBulkStatusToggle(false)}
                      disabled={isBulkActionLoading}
                      className="px-3 py-1 text-sm bg-gray-100 text-gray-800 hover:bg-[#d4af37]/10 transition-colors flex items-center space-x-1 disabled:opacity-50"
                    >
                      <ToggleLeft className="w-3 h-3" />
                      <span>Deactivate</span>
                    </button>
                    <button
                      onClick={handleBulkExport}
                      disabled={isBulkActionLoading}
                      className="px-3 py-1 text-sm bg-blue-100 text-blue-800 hover:bg-blue-200 transition-colors flex items-center space-x-1 disabled:opacity-50"
                    >
                      <Download className="w-3 h-3" />
                      <span>Export</span>
                    </button>
                    <button
                      onClick={handleBulkDelete}
                      disabled={isBulkActionLoading}
                      className="px-3 py-1 text-sm bg-red-100 text-red-800 hover:bg-red-200 transition-colors flex items-center space-x-1 disabled:opacity-50"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Delete</span>
                    </button>
                    <button
                      onClick={clearSelection}
                      disabled={isBulkActionLoading}
                      className="p-1 text-gray-400 hover:text-[#b8a070] transition-colors disabled:opacity-50"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
  <table className="w-full">
    <thead className="bg-[#0a0a0a] border-b border-[#d4af37]/20">
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
          className="px-6 py-3 text-left text-xs font-medium text-[#b8a070] uppercase tracking-wider cursor-pointer hover:bg-[#d4af37]/5"
          onClick={() => handleSort("name")}
        >
          Product
          {sortBy === "name" && (
            <ArrowUpDown
              className={`inline w-3 h-3 ml-1 ${sortOrder === "desc" ? "rotate-180" : ""
                }`}
            />
          )}
        </th>
        <th
          className="px-6 py-3 text-left text-xs font-medium text-[#b8a070] uppercase tracking-wider cursor-pointer hover:bg-[#d4af37]/5"
          onClick={() => handleSort("perfume_type")}
        >
          Type
          {sortBy === "perfume_type" && (
            <ArrowUpDown
              className={`inline w-3 h-3 ml-1 ${sortOrder === "desc" ? "rotate-180" : ""
                }`}
            />
          )}
        </th>
        <th
          className="px-6 py-3 text-left text-xs font-medium text-[#b8a070] uppercase tracking-wider cursor-pointer hover:bg-[#d4af37]/5"
          onClick={() => handleSort("price")}
        >
          Base Price
          {sortBy === "price" && (
            <ArrowUpDown
              className={`inline w-3 h-3 ml-1 ${sortOrder === "desc" ? "rotate-180" : ""
                }`}
            />
          )}
        </th>
        <th className="px-6 py-3 text-left text-xs font-medium text-[#b8a070] uppercase tracking-wider">
          Status
        </th>
        <th className="px-6 py-3 text-left text-xs font-medium text-[#b8a070] uppercase tracking-wider">
          Stock
        </th>
        <th className="px-6 py-3 text-left text-xs font-medium text-[#b8a070] uppercase tracking-wider">
          Category
        </th>
        <th
          className="px-6 py-3 text-left text-xs font-medium text-[#b8a070] uppercase tracking-wider cursor-pointer hover:bg-[#d4af37]/5"
          onClick={() => handleSort("created_at")}
        >
          Created
          {sortBy === "created_at" && (
            <ArrowUpDown
              className={`inline w-3 h-3 ml-1 ${sortOrder === "desc" ? "rotate-180" : ""
                }`}
            />
          )}
        </th>
        <th className="px-6 py-3 text-left text-xs font-medium text-[#b8a070] uppercase tracking-wider">
          Actions
        </th>
      </tr>
    </thead>
    <tbody className="bg-[#1a1a1a] divide-y divide-[#d4af37]/10">
      {isLoading ? (
        Array.from({ length: 10 }).map((_, index) => (
          <ProductRowSkeleton key={index} />
        ))
      ) : data?.products.length === 0 ? (
        <tr>
          <td
            colSpan={9}
            className="px-6 py-12 text-center text-[#b8a070]"
          >
            No products found
          </td>
        </tr>
      ) : (
        data?.products.map((product) => (
          <tr
            key={product.id}
            className="hover:bg-[#d4af37]/5 cursor-pointer transition-colors"
            onClick={() => handleProductClick(product)}
          >
            <td
              className="px-6 py-4"
              onClick={(e) => e.stopPropagation()}
            >
              <input
                type="checkbox"
                checked={selectedProducts.has(product.id)}
                onChange={() => handleSelectProduct(product.id)}
                className="w-4 h-4 accent-[#d4af37]"
              />
            </td>
            <td className="px-6 py-4">
              <div className="flex items-center space-x-3">
                <div className="min-w-12 w-12 h-12 bg-[#d4af37]/10 border border-[#d4af37]/20 rounded-lg flex items-center justify-center overflow-hidden">
                  {product.images.length > 0 ? (
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
                  <div className="text-sm font-medium text-[#f5e6d3]">
                    {product.name}
                  </div>
                  <div className="text-xs text-[#b8a070] line-clamp-1">
                    {product.description}
                  </div>
                </div>
              </div>
            </td>
            <td className="px-6 py-4">
              <span
                className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getPerfumeTypeColor(
                  product.perfumeType
                )}`}
              >
                {product.perfumeType}
              </span>
            </td>
            <td className="px-6 py-4 text-sm font-medium text-[#d4af37]">
              {formatCurrency(product.price)}
            </td>
            <td className="px-6 py-4">
              <span
                className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(
                  product.isActive
                )}`}
              >
                {product.isActive ? "Active" : "Inactive"}
              </span>
            </td>
            <td className="px-6 py-4 text-sm text-[#f5e6d3]">
              {product.totalStock} units
            </td>
            <td className="px-6 py-4 text-sm text-[#f5e6d3]">
              {product.category?.name || "No category"}
            </td>
            <td className="px-6 py-4 text-sm text-[#b8a070]">
              {formatDate(product.createdAt)}
            </td>
            <td className="px-6 py-4">
              <div className="flex items-center space-x-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleProductClick(product);
                  }}
                  className="p-1 text-[#b8a070] hover:text-[#d4af37] transition-colors"
                >
                  <Eye className="w-4 h-4" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteProduct(product.id);
                  }}
                  className="p-1 text-[#b8a070] hover:text-red-400 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <button className="p-1 text-[#b8a070] hover:text-[#d4af37] transition-colors">
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

          {data && data.totalPages > 1 && (
            <div className="px-6 py-4 border-t border-[#d4af37]/20 flex items-center justify-between">
              <div className="text-sm text-[#b8a070]">
                Showing {(currentPage - 1) * 25 + 1} to{" "}
                {Math.min(currentPage * 25, data.totalCount)} of {data.totalCount}{" "}
                products
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1 border border-[#d4af37]/20 text-sm text-[#b8a070] hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <span className="px-3 py-1 text-sm text-[#b8a070]">
                  Page {currentPage} of {data.totalPages}
                </span>
                <button
                  onClick={() =>
                    setCurrentPage((prev) => Math.min(data.totalPages, prev + 1))
                  }
                  disabled={currentPage === data.totalPages}
                  className="px-3 py-1 border border-[#d4af37]/20 text-sm text-[#b8a070] hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      <CustomSidebar
        isOpen={isAddSidebarOpen}
        onClose={() => setIsAddSidebarOpen(false)}
        title="Add Product"
      >
        <AddProduct
          onClose={() => setIsAddSidebarOpen(false)}
          onProductAdd={() => {}}
        />
      </CustomSidebar>
    </>
  );
}