"use client";
import React, { useState, useRef, useEffect } from "react";
import { ArrowLeft, Copy, Package, Edit, Trash2, Eye, EyeOff, MoreHorizontal, ExternalLink } from "lucide-react";
import CustomSidebar from "@/components/modals/sidebar";
import EditProduct from "@/components/admin/sidebars/editproduct-sidebar";
import { CategoryData } from "@/app/api/admin/products/route";
import { useRouter } from "next/navigation";

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
  category: CategoryData | null;
  occasionsTags: string[];
  weatherTags: string[];
  topNotesTags: string[];
  otherOptionsTags: string[];
  sizes: Record<string, number>;
  stocks: Record<string, number>;
  totalStock: number;
  availableSizes: string[];
}

interface ProductDetailsProps {
  product: Product | null;
  isLoading: boolean;
  onBack: () => void;
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP'
  }).format(amount);
};

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric', 
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

// BLACK & GOLD status colors
const getStatusColor = (isActive: boolean) => {
  return isActive 
    ? 'bg-green-900/20 text-green-400 border border-green-400/30' 
    : 'bg-red-900/20 text-red-400 border border-red-400/30';
};

const getPerfumeTypeColor = (type: string) => {
  switch (type) {
    case 'Premium':
      return 'bg-purple-900/20 text-purple-400 border border-purple-400/30';
    case 'Basic':
      return 'bg-blue-900/20 text-blue-400 border border-blue-400/30';
    default:
      return 'bg-[#d4af37]/10 text-[#7a6a4a] border border-[#d4af37]/30';
  }
};

const Skeleton = ({ className }: { className?: string }) => (
  <div className={`animate-pulse bg-[#d4af37]/10 rounded ${className}`}></div>
);

const ProductActionsDropdown = ({ 
  product, 
  onStatusUpdate,
  onOpenEditSidebar 
}: { 
  product: Product; 
  onStatusUpdate: (productId: string, updates: Partial<Product>) => void;
  onOpenEditSidebar: () => void;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleToggleStatus = async () => {
    setIsUpdating(true);
    try {
      const newStatus = !product.isActive;
      const response = await fetch(`/api/admin/products/${product.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: newStatus })
      });

      if (response.ok) {
        onStatusUpdate(product.id, { isActive: newStatus });
        setIsOpen(false);
      }
    } catch (error) {
      console.error('Failed to update status:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this product? This action cannot be undone.')) {
      return;
    }

    setIsUpdating(true);
    try {
      const response = await fetch(`/api/admin/products/${product.id}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        window.location.href = '/admin/products';
      }
    } catch (error) {
      console.error('Failed to delete product:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 hover:bg-[#d4af37]/10 rounded-lg transition-colors text-[#1c1810]"
      >
        <MoreHorizontal size={20} />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-[#faf8f3] border border-[#e8e0d0] rounded-lg shadow-lg z-50">
          <div className="py-1">
            <button
              onClick={handleToggleStatus}
              disabled={isUpdating}
              className="w-full text-left px-4 py-2 text-sm text-[#1c1810] hover:bg-[#d4af37]/10 flex items-center gap-2 disabled:opacity-50 transition-colors"
            >
              {product.isActive ? <EyeOff size={16} /> : <Eye size={16} />}
              {isUpdating ? 'Updating...' : (product.isActive ? 'Deactivate' : 'Activate')}
            </button>
            <button
              onClick={() => {
                onOpenEditSidebar();
                setIsOpen(false);
              }}
              className="w-full text-left px-4 py-2 text-sm text-[#1c1810] hover:bg-[#d4af37]/10 flex items-center gap-2 transition-colors"
            >
              <Edit size={16} />
              Edit Product
            </button>
            <div className="border-t border-[#d4af37]/10 my-1"></div>
            <button
              onClick={handleDelete}
              disabled={isUpdating}
              className="w-full text-left px-4 py-2 text-sm hover:bg-[#d4af37]/10 text-red-400 flex items-center gap-2 disabled:opacity-50 transition-colors"
            >
              <Trash2 size={16} />
              {isUpdating ? 'Deleting...' : 'Delete Product'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default function ProductDetails({ product, isLoading, onBack }: ProductDetailsProps) {
  const router = useRouter();
  const [currentProduct, setCurrentProduct] = useState(product);
  const [selectedImage, setSelectedImage] = useState(0);
  const [internalNote, setInternalNote] = useState('');
  const [isEditSidebarOpen, setIsEditSidebarOpen] = useState(false);

  useEffect(() => {
    setCurrentProduct(product);
    if (product && product.images.length > 0) {
      setSelectedImage(0);
    }
  }, [product]);

  const handleProductUpdate = (productId: string, updates: Partial<Product>) => {
    if (currentProduct && currentProduct.id === productId) {
      setCurrentProduct({ ...currentProduct, ...updates });
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  if (isLoading) {
    return (
      <div className="bg-white min-h-screen">
        <div className="max-w-7xl mx-auto p-6 space-y-6">
          <div className="flex items-center gap-4">
            <Skeleton className="w-20 h-8" />
            <div>
              <Skeleton className="w-48 h-8 mb-2" />
              <Skeleton className="w-32 h-4" />
            </div>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-[#faf8f3] p-6 rounded-lg border border-[#e8e0d0]">
                <Skeleton className="w-full h-64 mb-4" />
                <div className="flex space-x-2">
                  <Skeleton className="w-16 h-16" />
                  <Skeleton className="w-16 h-16" />
                  <Skeleton className="w-16 h-16" />
                </div>
              </div>
            </div>
            
            <div className="space-y-6">
              <div className="bg-[#faf8f3] p-6 rounded-lg border border-[#e8e0d0]">
                <Skeleton className="w-24 h-6 mb-4" />
                <div className="space-y-2">
                  <Skeleton className="w-full h-4" />
                  <Skeleton className="w-full h-4" />
                  <Skeleton className="w-3/4 h-4" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!currentProduct) {
    return (
      <div className="p-6 bg-white min-h-screen">
        <button 
          onClick={onBack}
          className="flex items-center gap-2 text-[#7a6a4a] hover:text-[#d4af37] mb-6 transition-colors"
        >
          <ArrowLeft size={20} />
          Back to products
        </button>
        <div className="text-center text-[#7a6a4a]">Product not found</div>
      </div>
    );
  }

  return (
    <>
      <div className="bg-white min-h-screen">
        <div className="max-w-7xl mx-auto p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button 
                onClick={onBack}
                className="flex items-center gap-2 text-[#7a6a4a] hover:text-[#d4af37] transition-colors"
              >
                <ArrowLeft size={20} />
                Back
              </button>
              <div>
                <h1 className="text-2xl font-bold text-[#d4af37]">{currentProduct.name}</h1>
                <p className="text-[#7a6a4a]">Created {formatDate(currentProduct.createdAt)}</p>
              </div>
            </div>
            <ProductActionsDropdown
              product={currentProduct}
              onStatusUpdate={handleProductUpdate}
              onOpenEditSidebar={() => setIsEditSidebarOpen(true)}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-[#faf8f3] p-4 rounded-lg border border-[#e8e0d0]">
              <div className="text-sm text-[#7a6a4a] mb-1">Status</div>
              <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(currentProduct.isActive)}`}>
                {currentProduct.isActive ? 'Active' : 'Inactive'}
              </span>
            </div>
            
            <div className="bg-[#faf8f3] p-4 rounded-lg border border-[#e8e0d0]">
              <div className="text-sm text-[#7a6a4a] mb-1">Type</div>
              <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getPerfumeTypeColor(currentProduct.perfumeType)}`}>
                {currentProduct.perfumeType}
              </span>
            </div>
            
            <div className="bg-[#faf8f3] p-4 rounded-lg border border-[#e8e0d0]">
              <div className="text-sm text-[#7a6a4a] mb-1">Total Stock</div>
              <span className="text-lg font-semibold text-[#d4af37]">{currentProduct.totalStock} units</span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-[#faf8f3] rounded-lg border border-[#e8e0d0]">
                <div className="p-6 border-b border-[#e8e0d0]">
                  <h2 className="text-lg font-semibold text-[#d4af37]">Product Images</h2>
                </div>
                <div className="p-6">
                  {currentProduct.images.length > 0 ? (
                    <div className="space-y-4">
                      <div className="w-full h-64 bg-white border border-[#e8e0d0] rounded-lg overflow-hidden">
                        <img
                          src={currentProduct.images[selectedImage]}
                          alt={currentProduct.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      {currentProduct.images.length > 1 && (
                        <div className="flex space-x-2 overflow-x-auto">
                          {currentProduct.images.map((image, index) => (
                            <button
                              key={index}
                              onClick={() => setSelectedImage(index)}
                              className={`w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 border-2 transition-colors ${
                                selectedImage === index ? 'border-[#d4af37]' : 'border-[#e8e0d0]'
                              }`}
                            >
                              <img
                                src={image}
                                alt={`${currentProduct.name} ${index + 1}`}
                                className="w-full h-full object-cover"
                              />
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="w-full h-64 bg-[#faf8f3] border border-[#e8e0d0] rounded-lg flex items-center justify-center">
                      <div className="text-center">
                        <Package className="w-16 h-16 text-[#d4af37] mx-auto mb-2" />
                        <p className="text-[#7a6a4a]">No images available</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-[#faf8f3] rounded-lg border border-[#e8e0d0]">
                <div className="p-6 border-b border-[#e8e0d0]">
                  <h2 className="text-lg font-semibold text-[#d4af37]">Sizes & Pricing</h2>
                </div>
                <div className="divide-y divide-[#d4af37]/10">
                  {Object.entries(currentProduct.sizes).map(([size, price]) => {
                    const stock = currentProduct.stocks[size] || 0;
                    
                    return (
                      <div key={size} className="p-6 flex justify-between items-center">
                        <div>
                          <h3 className="font-medium text-lg text-[#1c1810]">{size}ml</h3>
                        </div>
                        <div className="text-right">
                          <p className="font-medium text-lg text-[#d4af37]">{formatCurrency(price)}</p>
                          <p className={`text-sm ${stock > 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {stock} in stock
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="bg-[#faf8f3] rounded-lg border border-[#e8e0d0]">
                <div className="p-6 border-b border-[#e8e0d0]">
                  <h2 className="text-lg font-semibold text-[#d4af37]">Product Tags</h2>
                </div>
                <div className="p-6 space-y-4">
                  {currentProduct.occasionsTags.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-[#1c1810] mb-2">Occasion Tags</h4>
                      <div className="flex flex-wrap gap-2">
                        {currentProduct.occasionsTags.map((tag, index) => (
                          <span key={index} className="inline-flex px-2 py-1 text-xs bg-green-900/20 text-green-400 border border-green-400/30 rounded-full">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {currentProduct.weatherTags.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-[#1c1810] mb-2">Weather Tags</h4>
                      <div className="flex flex-wrap gap-2">
                        {currentProduct.weatherTags.map((tag, index) => (
                          <span key={index} className="inline-flex px-2 py-1 text-xs bg-yellow-900/20 text-yellow-400 border border-yellow-400/30 rounded-full">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {currentProduct.topNotesTags.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-[#1c1810] mb-2">Top Notes</h4>
                      <div className="flex flex-wrap gap-2">
                        {currentProduct.topNotesTags.map((tag, index) => (
                          <span key={index} className="inline-flex px-2 py-1 text-xs bg-purple-900/20 text-purple-400 border border-purple-400/30 rounded-full">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {currentProduct.otherOptionsTags.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-[#1c1810] mb-2">Other Options</h4>
                      <div className="flex flex-wrap gap-2">
                        {currentProduct.otherOptionsTags.map((tag, index) => (
                          <span key={index} className="inline-flex px-2 py-1 text-xs bg-[#d4af37]/10 text-[#d4af37] border border-[#d4af37]/30 rounded-full">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="bg-[#faf8f3] rounded-lg border border-[#e8e0d0]">
                <div className="p-6 border-b border-[#e8e0d0]">
                  <h2 className="text-lg font-semibold text-[#d4af37]">Product Information</h2>
                </div>
                <div className="p-6 space-y-4">
                  <div>
                    <p className="text-sm text-[#7a6a4a]">Product ID</p>
                    <div className="flex items-center gap-2">
                      <p className="font-mono text-sm text-[#1c1810]">{currentProduct.id}</p>
                      <button
                        onClick={() => copyToClipboard(currentProduct.id)}
                        className="text-[#7a6a4a] hover:text-[#d4af37] transition-colors"
                      >
                        <Copy size={16} />
                      </button>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm text-[#7a6a4a]">Category</p>
                    <p className="font-medium text-[#1c1810]">{currentProduct.category?.name || 'No category'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-[#7a6a4a]">Last Updated</p>
                    <p className="font-medium text-[#1c1810]">{formatDate(currentProduct.updatedAt)}</p>
                  </div>
                </div>
              </div>

              <div className="bg-[#faf8f3] rounded-lg border border-[#e8e0d0]">
                <div className="p-6 border-b border-[#e8e0d0]">
                  <h2 className="text-lg font-semibold text-[#d4af37]">Description</h2>
                </div>
                <div className="p-6">
                  <p className="text-[#1c1810] leading-relaxed">
                    {currentProduct.description}
                  </p>
                </div>
              </div>

              <div className="bg-[#faf8f3] rounded-lg border border-[#e8e0d0]">
                <div className="p-6 border-b border-[#e8e0d0]">
                  <h2 className="text-lg font-semibold text-[#d4af37]">Internal Notes</h2>
                </div>
                <div className="p-6">
                  <textarea
                    value={internalNote}
                    onChange={(e) => setInternalNote(e.target.value)}
                    className="w-full p-3 border border-[#e8e0d0] bg-white text-[#1c1810] placeholder-[#b0a080] rounded-lg focus:ring-2 focus:ring-[#d4af37] focus:border-transparent"
                    rows={4}
                    placeholder="Add internal notes about this product..."
                  />
                  <button className="mt-3 px-4 py-2 bg-[#d4af37] text-[#0a0a0a] rounded-lg hover:bg-[#d4af37]/90 transition-colors">
                    Save Notes
                  </button>
                </div>
              </div>

              <div className="bg-[#faf8f3] rounded-lg border border-[#e8e0d0]">
                <div className="p-6 border-b border-[#e8e0d0] flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-[#d4af37]">Stock Summary</h2>
                </div>
                <div className="p-6 space-y-3">
                  {Object.entries(currentProduct.stocks).map(([size, stock]) => (
                    <div key={size} className="flex justify-between items-center">
                      <span className="text-sm font-medium text-[#1c1810]">{size}ml</span>
                      <span className={`text-sm font-semibold ${stock > 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {stock} units
                      </span>
                    </div>
                  ))}
                  <div className="pt-3 border-t border-[#e8e0d0]">
                    <div className="flex justify-between items-center">
                      <span className="font-medium text-[#1c1810]">Total Stock</span>
                      <span className="font-bold text-lg text-[#d4af37]">{currentProduct.totalStock} units</span>
                    </div>
                  </div>
                  <div className="pt-3 border-t border-[#e8e0d0]">
                    <button
                      onClick={() => router.push('/admin/inventory')}
                      className="w-full flex items-center justify-center gap-2 py-2.5 px-4 border-2 border-[#d4af37] text-[#8B6914] text-sm font-semibold rounded-lg hover:bg-[#d4af37]/10 transition-all"
                    >
                      <ExternalLink size={15} />
                      Manage Stock
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <CustomSidebar
        isOpen={isEditSidebarOpen}
        onClose={() => setIsEditSidebarOpen(false)}
        title="Edit Product"
      >
        <EditProduct
          product={currentProduct}
          onClose={() => setIsEditSidebarOpen(false)}
          onProductUpdate={handleProductUpdate}
        />
      </CustomSidebar>
    </>
  );
}