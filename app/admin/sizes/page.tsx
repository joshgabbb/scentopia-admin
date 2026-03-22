"use client";

import React, { useState, useEffect } from "react";
import {
  Search,
  Plus,
  Edit2,
  Trash2,
  Ruler,
  X,
  Check,
  ToggleLeft,
  ToggleRight,
  Loader2,
  AlertCircle,
  Eye,
} from "lucide-react";

interface Size {
  id: string;
  name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  productCount: number;
}

interface SizeProduct {
  id: string;
  name: string;
  category: string;
  isActive: boolean;
}

const Skeleton = ({ className }: { className?: string }) => (
  <div className={`animate-pulse bg-[#d4af37]/10 rounded ${className}`} />
);

const SizeRowSkeleton = () => (
  <tr className="border-b border-[#d4af37]/10">
    <td className="px-6 py-4">
      <Skeleton className="h-5 w-32" />
    </td>
    <td className="px-6 py-4">
      <Skeleton className="h-6 w-10" />
    </td>
    <td className="px-6 py-4">
      <Skeleton className="h-6 w-16" />
    </td>
    <td className="px-6 py-4">
      <Skeleton className="h-4 w-24" />
    </td>
    <td className="px-6 py-4">
      <Skeleton className="h-8 w-20" />
    </td>
  </tr>
);

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "Asia/Manila",
    year: "numeric",
  });
};

export default function SizesPage() {
  const [sizes, setSizes] = useState<Size[]>([]);
  const [orphanKeys, setOrphanKeys] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [showInactive, setShowInactive] = useState(true);

  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedSize, setSelectedSize] = useState<Size | null>(null);

  // Form states
  const [formName, setFormName] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // View products modal state
  const [isViewProductsOpen, setIsViewProductsOpen] = useState(false);
  const [viewProductsList, setViewProductsList] = useState<SizeProduct[]>([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);
  const [viewProductsSize, setViewProductsSize] = useState<Size | null>(null);

  const fetchSizes = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (showInactive) {
        params.set('include_inactive', 'true');
      }

      const response = await fetch(`/api/admin/sizes?${params}`);
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || "Failed to fetch sizes");
      }

      setSizes(result.data);
      setOrphanKeys(result.orphanKeys || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error occurred");
      console.error("Sizes fetch error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSizes();
  }, [showInactive]);

  const handleAddSize = async () => {
    if (!formName.trim()) {
      setFormError("Size name is required");
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    try {
      const response = await fetch("/api/admin/sizes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: formName.trim() }),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || "Failed to create size");
      }

      setIsAddModalOpen(false);
      setFormName("");
      fetchSizes();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to create size");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditSize = async () => {
    if (!selectedSize || !formName.trim()) {
      setFormError("Size name is required");
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    try {
      const response = await fetch("/api/admin/sizes", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selectedSize.id,
          name: formName.trim()
        }),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || "Failed to update size");
      }

      setIsEditModalOpen(false);
      setSelectedSize(null);
      setFormName("");
      fetchSizes();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to update size");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async (size: Size) => {
    try {
      const response = await fetch("/api/admin/sizes", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: size.id,
          is_active: !size.is_active
        }),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || "Failed to update size status");
      }

      fetchSizes();
    } catch (err) {
      console.error("Toggle status error:", err);
    }
  };

  const handleDeleteSize = async () => {
    if (!selectedSize) return;

    setIsSubmitting(true);
    setFormError(null);

    try {
      const response = await fetch(`/api/admin/sizes?id=${selectedSize.id}`, {
        method: "DELETE",
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || "Failed to delete size");
      }

      setIsDeleteModalOpen(false);
      setSelectedSize(null);
      fetchSizes();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to delete size");
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEditModal = (size: Size) => {
    setSelectedSize(size);
    setFormName(size.name);
    setFormError(null);
    setIsEditModalOpen(true);
  };

  const openDeleteModal = (size: Size) => {
    setSelectedSize(size);
    setFormError(null);
    setIsDeleteModalOpen(true);
  };

  const handleViewProducts = async (size: Size) => {
    setViewProductsSize(size);
    setIsViewProductsOpen(true);
    setIsLoadingProducts(true);
    setViewProductsList([]);
    try {
      const res = await fetch(`/api/admin/sizes/products?name=${encodeURIComponent(size.name)}`);
      const result = await res.json();
      if (result.success) setViewProductsList(result.data);
    } catch (err) {
      console.error("Failed to fetch products for size:", err);
    } finally {
      setIsLoadingProducts(false);
    }
  };

  const filteredSizes = sizes.filter((size) =>
    size.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <div className="text-red-500 text-lg mb-2">Error loading sizes</div>
          <div className="text-[#7a6a4a] text-sm">{error}</div>
          <button
            onClick={fetchSizes}
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
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <h1 className="text-2xl font-bold text-[#1c1810]">Sizes</h1>
            <div className="h-5 px-2 bg-[#d4af37]/10 rounded-full flex items-center justify-center">
              <span className="text-xs text-[#7a6a4a] font-semibold">
                {filteredSizes.length}
              </span>
            </div>
          </div>
          <button
            onClick={() => {
              setFormName("");
              setFormError(null);
              setIsAddModalOpen(true);
            }}
            className="px-4 py-2 bg-black text-white hover:bg-[#d4af37]/90 uppercase tracking-wider font-medium transition-colors flex items-center space-x-2"
          >
            <Plus className="w-4 h-4" />
            <span>Add Size</span>
          </button>
        </div>

        {/* Filters */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4 flex-1 max-w-md">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[#7a6a4a] w-4 h-4" />
              <input
                type="text"
                placeholder="Search sizes..."
                className="w-full pl-10 pr-4 py-2 border border-[#e8e0d0] bg-[#faf8f3] text-[#1c1810] placeholder-[#b0a080] focus:outline-none focus:ring-2 focus:ring-[#d4af37] focus:border-transparent"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-sm text-[#7a6a4a]">Show inactive</span>
            <button
              onClick={() => setShowInactive(!showInactive)}
              className={`p-1 rounded transition-colors ${
                showInactive ? "text-[#d4af37]" : "text-[#7a6a4a]"
              }`}
            >
              {showInactive ? (
                <ToggleRight className="w-6 h-6" />
              ) : (
                <ToggleLeft className="w-6 h-6" />
              )}
            </button>
          </div>
        </div>

        {/* Orphan size keys warning */}
        {orphanKeys.length > 0 && (
          <div className="p-4 bg-amber-50 border border-amber-300 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-800">
                Unregistered size keys found in products
              </p>
              <p className="text-sm text-amber-700 mt-1">
                The following size keys exist in product data but are not in the sizes table:{" "}
                <span className="font-mono font-bold">{orphanKeys.join(", ")}</span>
              </p>
              <p className="text-xs text-amber-600 mt-1">
                To fix: open each affected product → remove the size under "Sizes &amp; Pricing" → save.
                Or create a new size entry matching the key name above.
              </p>
            </div>
          </div>
        )}

        {/* Table */}
        <div className="bg-[#faf8f3] border border-[#e8e0d0]">
          <div className="px-6 py-4 border-b border-[#e8e0d0]">
            <h2 className="text-lg font-medium text-[#1c1810]">All Sizes</h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-white border-b border-[#e8e0d0]">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-[#7a6a4a] uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-[#7a6a4a] uppercase tracking-wider">
                    Products Using
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-[#7a6a4a] uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-[#7a6a4a] uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-[#7a6a4a] uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-[#faf8f3] divide-y divide-[#d4af37]/10">
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, index) => (
                    <SizeRowSkeleton key={index} />
                  ))
                ) : filteredSizes.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-6 py-12 text-center text-[#7a6a4a]"
                    >
                      <Ruler className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>No sizes found</p>
                    </td>
                  </tr>
                ) : (
                  filteredSizes.map((size) => (
                    <tr
                      key={size.id}
                      className="hover:bg-[#d4af37]/5 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 bg-[#d4af37]/10 rounded-full flex items-center justify-center">
                            <Ruler className="w-4 h-4 text-[#d4af37]" />
                          </div>
                          <span className="text-sm font-medium text-[#1c1810]">
                            {size.name}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {size.productCount > 0 ? (
                          <button
                            onClick={() => handleViewProducts(size)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200 rounded-full hover:bg-blue-200 transition-colors"
                          >
                            <Eye className="w-3 h-3" />
                            {size.productCount}
                          </button>
                        ) : (
                          <span className="text-xs text-[#b0a080]">0</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => handleToggleStatus(size)}
                          className={`inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full transition-colors ${
                            size.is_active
                              ? "bg-green-100 text-green-800 hover:bg-green-200"
                              : "bg-red-100 text-red-800 hover:bg-red-200"
                          }`}
                        >
                          {size.is_active ? "Active" : "Inactive"}
                        </button>
                      </td>
                      <td className="px-6 py-4 text-sm text-[#7a6a4a]">
                        {formatDate(size.created_at)}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => openEditModal(size)}
                            className="p-1.5 text-[#7a6a4a] hover:text-[#d4af37] hover:bg-[#d4af37]/10 rounded transition-colors"
                            title="Edit"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => openDeleteModal(size)}
                            className="p-1.5 text-[#7a6a4a] hover:text-red-400 hover:bg-red-400/10 rounded transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Add Size Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-[#faf8f3] border border-[#e8e0d0] w-full max-w-md shadow-2xl">
            <div className="px-6 py-4 border-b border-[#e8e0d0] flex items-center justify-between">
              <h2 className="text-lg font-semibold text-[#d4af37]">Add Size</h2>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-1 text-[#7a6a4a] hover:text-[#1c1810] transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {formError && (
                <div className="p-3 bg-red-500/20 border border-red-500/30 rounded text-red-400 text-sm">
                  {formError}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-[#1c1810] mb-2">
                  Size Name
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g., 50ml, 100ml, 200ml"
                  className="w-full px-4 py-2.5 bg-white border border-[#e8e0d0] text-[#1c1810] placeholder-[#b0a080] focus:outline-none focus:ring-2 focus:ring-[#d4af37] focus:border-transparent"
                  autoFocus
                />
              </div>
            </div>

            <div className="px-6 py-4 border-t border-[#e8e0d0] flex items-center justify-end gap-3">
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="px-4 py-2 border border-[#e8e0d0] text-[#1c1810] hover:bg-[#d4af37]/5 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddSize}
                disabled={isSubmitting}
                className="px-4 py-2 bg-[#d4af37] text-[#0a0a0a] font-medium hover:bg-[#d4af37]/90 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    Create
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Size Modal */}
      {isEditModalOpen && selectedSize && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-[#faf8f3] border border-[#e8e0d0] w-full max-w-md shadow-2xl">
            <div className="px-6 py-4 border-b border-[#e8e0d0] flex items-center justify-between">
              <h2 className="text-lg font-semibold text-[#d4af37]">Edit Size</h2>
              <button
                onClick={() => {
                  setIsEditModalOpen(false);
                  setSelectedSize(null);
                }}
                className="p-1 text-[#7a6a4a] hover:text-[#1c1810] transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {formError && (
                <div className="p-3 bg-red-500/20 border border-red-500/30 rounded text-red-400 text-sm">
                  {formError}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-[#1c1810] mb-2">
                  Size Name
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g., 50ml, 100ml, 200ml"
                  className="w-full px-4 py-2.5 bg-white border border-[#e8e0d0] text-[#1c1810] placeholder-[#b0a080] focus:outline-none focus:ring-2 focus:ring-[#d4af37] focus:border-transparent"
                  autoFocus
                />
              </div>
            </div>

            <div className="px-6 py-4 border-t border-[#e8e0d0] flex items-center justify-end gap-3">
              <button
                onClick={() => {
                  setIsEditModalOpen(false);
                  setSelectedSize(null);
                }}
                className="px-4 py-2 border border-[#e8e0d0] text-[#1c1810] hover:bg-[#d4af37]/5 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleEditSize}
                disabled={isSubmitting}
                className="px-4 py-2 bg-[#d4af37] text-[#0a0a0a] font-medium hover:bg-[#d4af37]/90 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    Save Changes
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && selectedSize && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-[#faf8f3] border border-[#e8e0d0] w-full max-w-md shadow-2xl">
            <div className="px-6 py-4 border-b border-[#e8e0d0] flex items-center justify-between">
              <h2 className="text-lg font-semibold text-red-400">Delete Size</h2>
              <button
                onClick={() => {
                  setIsDeleteModalOpen(false);
                  setSelectedSize(null);
                }}
                className="p-1 text-[#7a6a4a] hover:text-[#1c1810] transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {formError && (
                <div className="p-3 bg-red-500/20 border border-red-500/30 rounded text-red-400 text-sm">
                  {formError}
                </div>
              )}

              <div className="flex items-start space-x-3">
                <div className="w-10 h-10 bg-red-500/20 rounded-full flex items-center justify-center flex-shrink-0">
                  <AlertCircle className="w-5 h-5 text-red-400" />
                </div>
                <div className="flex-1">
                  <p className="text-[#1c1810]">
                    Are you sure you want to delete the size{" "}
                    <span className="font-semibold text-[#d4af37]">
                      &quot;{selectedSize.name}&quot;
                    </span>
                    ?
                  </p>
                  {selectedSize.productCount > 0 ? (
                    <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded">
                      <p className="text-sm text-amber-800 font-medium">
                        This size is currently used by{" "}
                        <span className="font-bold">{selectedSize.productCount}</span>{" "}
                        {selectedSize.productCount === 1 ? "product" : "products"}.
                      </p>
                      <p className="text-xs text-amber-700 mt-1">
                        It will be deactivated instead of permanently deleted.
                      </p>
                      <button
                        onClick={() => {
                          setIsDeleteModalOpen(false);
                          handleViewProducts(selectedSize);
                        }}
                        className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white border border-amber-300 text-amber-800 rounded hover:bg-amber-50 transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        View Products
                      </button>
                    </div>
                  ) : (
                    <p className="text-sm text-[#7a6a4a] mt-2">
                      This size has no products assigned and will be permanently deleted.
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-[#e8e0d0] flex items-center justify-end gap-3">
              <button
                onClick={() => {
                  setIsDeleteModalOpen(false);
                  setSelectedSize(null);
                }}
                className="px-4 py-2 border border-[#e8e0d0] text-[#1c1810] hover:bg-[#d4af37]/5 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteSize}
                disabled={isSubmitting}
                className="px-4 py-2 bg-red-500 text-white font-medium hover:bg-red-600 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Products Modal */}
      {isViewProductsOpen && viewProductsSize && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-[#faf8f3] border border-[#e8e0d0] w-full max-w-lg shadow-2xl">
            <div className="px-6 py-4 border-b border-[#e8e0d0] flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-[#d4af37]">
                  Products Using &quot;{viewProductsSize.name}&quot;
                </h2>
                {!isLoadingProducts && (
                  <p className="text-xs text-[#7a6a4a] mt-0.5">
                    {viewProductsList.length} {viewProductsList.length === 1 ? "product" : "products"} found
                  </p>
                )}
              </div>
              <button
                onClick={() => {
                  setIsViewProductsOpen(false);
                  setViewProductsList([]);
                  setViewProductsSize(null);
                }}
                className="p-1 text-[#7a6a4a] hover:text-[#1c1810] transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto max-h-96">
              {isLoadingProducts ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-[#d4af37]" />
                </div>
              ) : viewProductsList.length === 0 ? (
                <div className="py-12 text-center text-[#7a6a4a] text-sm">
                  No products found.
                </div>
              ) : (
                <table className="w-full">
                  <thead className="bg-white border-b border-[#e8e0d0] sticky top-0">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-[#7a6a4a] uppercase tracking-wider">
                        Product Name
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-[#7a6a4a] uppercase tracking-wider">
                        Category
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-[#7a6a4a] uppercase tracking-wider">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#d4af37]/10">
                    {viewProductsList.map((product) => (
                      <tr key={product.id} className="hover:bg-[#d4af37]/5 transition-colors">
                        <td className="px-6 py-3 text-sm font-medium text-[#1c1810]">
                          {product.name}
                        </td>
                        <td className="px-6 py-3 text-sm text-[#7a6a4a]">
                          {product.category}
                        </td>
                        <td className="px-6 py-3">
                          <span className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full ${
                            product.isActive
                              ? "bg-green-100 text-green-800"
                              : "bg-red-100 text-red-700"
                          }`}>
                            {product.isActive ? "Active" : "Inactive"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="px-6 py-4 border-t border-[#e8e0d0] flex justify-end">
              <button
                onClick={() => {
                  setIsViewProductsOpen(false);
                  setViewProductsList([]);
                  setViewProductsSize(null);
                }}
                className="px-4 py-2 border border-[#e8e0d0] text-[#1c1810] hover:bg-[#d4af37]/5 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
