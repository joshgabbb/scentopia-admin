"use client";
import React, { useState, useEffect } from "react";
import { X, Upload, Trash2, Plus, Minus } from "lucide-react";
import { useRouter } from "next/navigation";

interface Category {
  id: string;
  name: string;
}

interface Size {
  id: string;
  name: string;
  is_active: boolean;
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

interface EditProductProps {
  product: Product;
  onClose: () => void;
  onProductUpdate: (productId: string, updates: Partial<Product>) => void;
}

// Default fallback options if API fails
const DEFAULT_OCCASION_OPTIONS = ["Everyday/Casual", "Work/Professional", "Gym/Sports", "Date Night/Intimate", "Formal"];
const DEFAULT_WEATHER_OPTIONS = ["Warm", "Cool", "Rainy"];
const DEFAULT_TOP_NOTES_OPTIONS = ["Fruity", "Floral", "Citrus", "Woody", "Spicy", "Herbal"];
const DEFAULT_OTHER_OPTIONS = ["Best Sellers", "Assorted"];
const PRICE_OPTIONS = [250, 350, 450];

interface TagOptions {
  occasion: string[];
  weather: string[];
  top_notes: string[];
  other: string[];
}

const normKey = (s: string) =>
  s.toLowerCase().replace(/\s+/g, '').replace(/ml$/i, '');

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP'
  }).format(amount);
};

export default function EditProduct({ product, onClose, onProductUpdate }: EditProductProps) {
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [sizeOptions, setSizeOptions] = useState<Size[]>([]);
  const [tagOptions, setTagOptions] = useState<TagOptions>({
    occasion: DEFAULT_OCCASION_OPTIONS,
    weather: DEFAULT_WEATHER_OPTIONS,
    top_notes: DEFAULT_TOP_NOTES_OPTIONS,
    other: DEFAULT_OTHER_OPTIONS
  });

  const [formData, setFormData] = useState({
    name: product?.name || '',
    description: product?.description || '',
    categoryId: product?.category?.id || "",
    perfumeType: (product?.perfumeType as "Basic" | "Premium") || "Basic",
    isActive: product?.isActive ?? true,
    occasionsTags: product?.occasionsTags ? [...product.occasionsTags] : [],
    weatherTags: product?.weatherTags ? [...product.weatherTags] : [],
    topNotesTags: product?.topNotesTags ? [...product.topNotesTags] : [],
    otherOptionsTags: product?.otherOptionsTags ? [...product.otherOptionsTags] : [],
    sizes: product?.sizes ? { ...product.sizes } : {},
    stocks: product?.stocks ? { ...product.stocks } : {},
    images: product?.images ? [...product.images] : [],
    imageFiles: [] as File[]
  });

  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [newImageUrl, setNewImageUrl] = useState('');

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await fetch('/api/admin/categories');
        const result = await response.json();
        if (result.success) {
          setCategories(result.data || []);
        }
      } catch (error) {
        console.error('Failed to fetch categories:', error);
      }
    };

    const fetchTags = async () => {
      try {
        const response = await fetch('/api/admin/tags');
        const result = await response.json();
        if (result.success && result.grouped) {
          setTagOptions({
            occasion: result.grouped.occasion?.map((t: { name: string }) => t.name) || DEFAULT_OCCASION_OPTIONS,
            weather: result.grouped.weather?.map((t: { name: string }) => t.name) || DEFAULT_WEATHER_OPTIONS,
            top_notes: result.grouped.top_notes?.map((t: { name: string }) => t.name) || DEFAULT_TOP_NOTES_OPTIONS,
            other: result.grouped.other?.map((t: { name: string }) => t.name) || DEFAULT_OTHER_OPTIONS
          });
        }
      } catch (error) {
        console.error('Failed to fetch tags:', error);
      }
    };

    const fetchSizes = async () => {
      try {
        const response = await fetch('/api/admin/sizes');
        const result = await response.json();
        if (result.success) {
          setSizeOptions(result.data || []);
        }
      } catch (error) {
        console.error('Failed to fetch sizes:', error);
      }
    };

    fetchCategories();
    fetchTags();
    fetchSizes();

    // Re-fetch tags when the tab regains focus (handles tag created in another tab)
    const handleVisibilityChange = () => {
      if (!document.hidden) fetchTags();
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  const handleFileSelect = (file: File) => {
    if (!file) return;

    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      alert('Please upload only JPEG, PNG, or WebP images.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert('Image size should be less than 5MB.');
      return;
    }

    setFormData(prev => ({
      ...prev,
      imageFiles: [...prev.imageFiles, file]
    }));
  };

  const uploadAllFiles = async (): Promise<string[]> => {
    if (formData.imageFiles.length === 0) return [];

    setIsUploading(true);
    const uploadPromises = formData.imageFiles.map(async (file) => {
      const formDataUpload = new FormData();
      formDataUpload.append('file', file);
      formDataUpload.append('bucket', 'products');
     
      const response = await fetch('/api/admin/products/upload-image', {
        method: 'POST',
        body: formDataUpload,
      });
     
      const result = await response.json();
      if (!result.success) {
        throw new Error(`Failed to upload ${file.name}: ${result.error}`);
      }
     
      return result.url;
    });

    try {
      return await Promise.all(uploadPromises);
    } finally {
      setIsUploading(false);
    }
  };

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleTagToggle = (field: keyof typeof formData, tag: string) => {
    const currentTags = formData[field] as string[];
    const updatedTags = currentTags.includes(tag)
      ? currentTags.filter(t => t !== tag)
      : [...currentTags, tag];
   
    handleInputChange(field, updatedTags);
  };

  const handleSizePriceChange = (size: string, value: number) => {
    setFormData(prev => ({
      ...prev,
      sizes: {
        ...prev.sizes,
        [size]: value
      }
    }));
  };

  const handleRemoveSize = (size: string) => {
    // Find the matching stock key by normalized comparison (handles "30" vs "30ml")
    const matchingStockKey = Object.keys(formData.stocks).find(
      k => normKey(k) === normKey(size)
    );
    const currentStock = matchingStockKey !== undefined
      ? (formData.stocks[matchingStockKey] ?? 0)
      : 0;

    if (currentStock > 0) {
      const confirmed = confirm(
        `Removing "${size}" will permanently zero out its ${currentStock} unit${currentStock !== 1 ? 's' : ''} of stock.\n\nContinue?`
      );
      if (!confirmed) return;
    }

    const { [size]: _removedSize, ...remainingSizes } = formData.sizes;
    const stocksAfterRemoval = matchingStockKey !== undefined
      ? Object.fromEntries(
          Object.entries(formData.stocks).filter(([k]) => k !== matchingStockKey)
        )
      : { ...formData.stocks };

    setFormData(prev => ({
      ...prev,
      sizes: remainingSizes,
      stocks: stocksAfterRemoval,
    }));
  };

  const handleAddSize = (size: string) => {
    const alreadyExists = Object.keys(formData.sizes).some(
      k => normKey(k) === normKey(size)
    );
    if (alreadyExists) {
      alert('This size already exists!');
      return;
    }
   
    setFormData(prev => ({
      ...prev,
      sizes: {
        ...prev.sizes,
        [size]: 250
      },
      stocks: {
        ...prev.stocks,
        [size]: 0
      }
    }));
  };

  const handleAddImageUrl = () => {
    if (!newImageUrl.trim()) return;
   
    setFormData(prev => ({
      ...prev,
      images: [...prev.images, newImageUrl.trim()]
    }));
   
    setNewImageUrl('');
  };

  const handleRemoveImageUrl = (index: number) => {
    setFormData(prev => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index)
    }));
  };

  const handleRemoveFile = (index: number) => {
    setFormData(prev => ({
      ...prev,
      imageFiles: prev.imageFiles.filter((_, i) => i !== index)
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const uploadedUrls = await uploadAllFiles();
      const allImages = [...formData.images, ...uploadedUrls];

      // Calculate the lowest price from sizes for the base price field
      const lowestPrice = Object.keys(formData.sizes).length > 0
        ? Math.min(...Object.values(formData.sizes))
        : 0;

      const response = await fetch(`/api/admin/products/${product.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name,
          desc: formData.description,
          price: lowestPrice, // Use lowest size price
          category_id: formData.categoryId || null,
          perfume_type: formData.perfumeType,
          is_active: formData.isActive,
          occasions_tags: formData.occasionsTags,
          weather_tags: formData.weatherTags,
          top_notes_tags: formData.topNotesTags,
          other_options_tags: formData.otherOptionsTags,
          sizes: formData.sizes,
          images: allImages
        })
      });

      if (response.ok) {
        const result = await response.json();
        onProductUpdate(product.id, result.data);
        onClose();
      } else {
        const errorData = await response.json();
        const message = errorData.details
          ? `${errorData.error || 'Failed to update product'}: ${errorData.details}`
          : (errorData.error || 'Failed to update product');
        throw new Error(message);
      }
    } catch (error) {
      console.error('Error updating product:', error);
      alert(`Failed to update product: ${error instanceof Error ? error.message : 'Please try again.'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const FilePreview = ({ file, onRemove }: { file: File; onRemove: () => void }) => {
    const [preview, setPreview] = useState<string | null>(null);

    useEffect(() => {
      const url = URL.createObjectURL(file);
      setPreview(url);
      return () => URL.revokeObjectURL(url);
    }, [file]);

    return (
      <div className="flex items-center gap-3 p-3 border border-[#d4af37]/30 bg-[#d4af37]/10 rounded-lg">
        {preview ? (
          <img src={preview} alt="Preview" className="w-12 h-12 object-cover rounded border border-[#e8e0d0]" />
        ) : (
          <div className="w-12 h-12 bg-[#faf8f3] rounded flex items-center justify-center border border-[#e8e0d0]">
            <Upload size={20} className="text-[#7a6a4a]" />
          </div>
        )}
        <div className="flex-1">
          <div className="text-sm text-[#1c1810] truncate max-w-[250px]">{file.name}</div>
          <div className="text-xs text-[#d4af37]">Will be uploaded on save</div>
        </div>
        <button type="button" onClick={onRemove} className="text-red-400 hover:text-red-300 transition-colors">
          <Trash2 size={16} />
        </button>
      </div>
    );
  };

  const TagSelector = ({
    title,
    options,
    selectedTags,
    onToggle
  }: {
    title: string;
    options: string[];
    selectedTags: string[];
    onToggle: (tag: string) => void;
  }) => (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-[#d4af37] uppercase tracking-wide">{title}</label>
      <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => onToggle(option)}
            className={`px-3 py-1.5 text-xs rounded-full border transition-all ${
              selectedTags.includes(option)
                ? 'bg-[#d4af37] text-[#0a0a0a] border-[#d4af37] font-semibold shadow-lg shadow-[#d4af37]/20'
                : 'bg-[#faf8f3] text-[#1c1810] border-[#e8e0d0] hover:border-[#d4af37]/40 hover:bg-[#faf8f3]'
            }`}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );

  const currentSizeNorms = new Set(Object.keys(formData.sizes).map(normKey));
  const availableSizesToAdd = sizeOptions.filter(
    size => size.is_active && !currentSizeNorms.has(normKey(size.name))
  );

  return (
    <div className="h-full flex flex-col bg-white">
      <div className="flex-1 space-y-6 overflow-y-auto px-1">
        {/* Basic Information */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold tracking-wider text-[#d4af37] uppercase border-b border-[#e8e0d0] pb-2">Basic Information</h3>
         
          <div>
            <label className="block text-sm font-medium text-[#d4af37] mb-2 uppercase tracking-wide">
              Product Name
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              className="w-full p-3 bg-[#faf8f3] border border-[#e8e0d0] rounded-lg text-[#1c1810] placeholder-[#b0a080] focus:outline-none focus:ring-2 focus:ring-[#d4af37] focus:border-transparent transition-all"
              placeholder="Enter product name"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#d4af37] mb-2 uppercase tracking-wide">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              rows={4}
              className="w-full p-3 bg-[#faf8f3] border border-[#e8e0d0] rounded-lg text-[#1c1810] placeholder-[#b0a080] focus:outline-none focus:ring-2 focus:ring-[#d4af37] focus:border-transparent transition-all resize-none"
              placeholder="Enter product description"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[#d4af37] mb-2 uppercase tracking-wide">
                Perfume Type
              </label>
              <select
                value={formData.perfumeType}
                onChange={(e) => handleInputChange('perfumeType', e.target.value as "Basic" | "Premium")}
                className="w-full p-3 bg-[#faf8f3] border border-[#e8e0d0] rounded-lg text-[#1c1810] focus:outline-none focus:ring-2 focus:ring-[#d4af37] focus:border-transparent transition-all"
                required
              >
                <option value="Basic" className="bg-[#faf8f3]">Basic</option>
                <option value="Premium" className="bg-[#faf8f3]">Premium</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-[#d4af37] mb-2 uppercase tracking-wide">
                Category
              </label>
              <select
                value={formData.categoryId}
                onChange={(e) => handleInputChange('categoryId', e.target.value)}
                className="w-full p-3 bg-[#faf8f3] border border-[#e8e0d0] rounded-lg text-[#1c1810] focus:outline-none focus:ring-2 focus:ring-[#d4af37] focus:border-transparent transition-all"
              >
                <option value="" className="bg-[#faf8f3]">Select a category</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id} className="bg-[#faf8f3]">
                    {category.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center p-3 bg-[#faf8f3] border border-[#e8e0d0] rounded-lg">
            <input
              type="checkbox"
              id="isActive"
              checked={formData.isActive}
              onChange={(e) => handleInputChange('isActive', e.target.checked)}
              className="h-4 w-4 accent-[#d4af37] rounded"
            />
            <label htmlFor="isActive" className="ml-3 block text-sm text-[#1c1810]">
              Product is active
            </label>
          </div>
        </div>

        {/* Product Images */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold tracking-wider text-[#d4af37] uppercase border-b border-[#e8e0d0] pb-2">Product Images</h3>
         
          <div className="space-y-2">
            {formData.images.map((image, index) => (
              <div key={`url-${index}`} className="flex items-center gap-3 p-3 border border-green-500/30 bg-green-900/20 rounded-lg">
                <img src={image} alt={`Product ${index + 1}`} className="w-12 h-12 object-cover rounded border border-[#e8e0d0]" />
                <div className="flex-1">
                  <div className="text-sm text-[#1c1810] truncate max-w-[250px]">{image}</div>
                  <div className="text-xs text-green-400">Current image</div>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveImageUrl(index)}
                  className="text-red-400 hover:text-red-300 transition-colors"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}

            {formData.imageFiles.map((file, index) => (
              <FilePreview
                key={`file-${index}`}
                file={file}
                onRemove={() => handleRemoveFile(index)}
              />
            ))}
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-[#d4af37] mb-2 uppercase tracking-wide">Add New Image Files</label>
              <input
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/webp"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    handleFileSelect(file);
                    e.target.value = '';
                  }
                }}
                className="w-full p-2 bg-[#faf8f3] border border-[#e8e0d0] rounded-lg text-[#1c1810] file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:bg-[#d4af37] file:text-[#1c1810] file:font-semibold hover:file:bg-[#d4af37]/90 transition-all"
              />
              <p className="text-xs text-[#7a6a4a] mt-2">
                Supported formats: JPEG, PNG, WebP. Max size: 5MB. Files will be uploaded when you save changes.
              </p>
            </div>

            <div className="border-t border-[#e8e0d0] pt-3">
              <label className="block text-sm font-medium text-[#d4af37] mb-2 uppercase tracking-wide">Or Add Image URL</label>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={newImageUrl}
                  onChange={(e) => setNewImageUrl(e.target.value)}
                  placeholder="Enter image URL"
                  className="flex-1 p-3 bg-[#faf8f3] border border-[#e8e0d0] rounded-lg text-[#1c1810] placeholder-[#b0a080] focus:outline-none focus:ring-2 focus:ring-[#d4af37] focus:border-transparent transition-all"
                />
                <button
                  type="button"
                  onClick={handleAddImageUrl}
                  disabled={!newImageUrl.trim()}
                  className="px-4 py-2 bg-[#d4af37] text-[#0a0a0a] rounded-lg hover:bg-[#d4af37]/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  <Plus size={20} />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Sizes & Pricing */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold tracking-wider text-[#d4af37] uppercase border-b border-[#e8e0d0] pb-2">Sizes & Pricing</h3>

          <div className="space-y-3">
            {Object.entries(formData.sizes).map(([size, price]) => (
              <div key={size} className="flex items-center gap-3 p-3 bg-[#faf8f3] border border-[#e8e0d0] rounded-lg">
                <div className="flex-1">
                  <div className="font-medium text-[#d4af37]">{size}</div>
                </div>

                <div className="flex items-center gap-3">
                  <div>
                    <label className="block text-xs text-[#7a6a4a] mb-1 uppercase">Price</label>
                    <select
                      value={price}
                      onChange={(e) => handleSizePriceChange(size, parseFloat(e.target.value))}
                      className="w-24 p-2 text-sm bg-white border border-[#e8e0d0] rounded text-[#1c1810] focus:outline-none focus:ring-2 focus:ring-[#d4af37]"
                    >
                      {/* Include the current price if it isn't one of the presets */}
                      {[...new Set([...PRICE_OPTIONS, ...(PRICE_OPTIONS.includes(price) ? [] : [price])])]
                        .sort((a, b) => a - b)
                        .map(priceOption => (
                          <option key={priceOption} value={priceOption} className="bg-[#faf8f3]">
                            ₱{priceOption}{!PRICE_OPTIONS.includes(priceOption) ? ' (current)' : ''}
                          </option>
                        ))}
                    </select>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleRemoveSize(size)}
                    className="text-white bg-red-600 hover:bg-red-500 rounded-full p-1.5 transition-colors mt-5"
                  >
                    <Minus size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {availableSizesToAdd.length > 0 && (
            <div className="flex gap-2">
              <select
                className="flex-1 p-3 bg-[#faf8f3] border border-[#e8e0d0] rounded-lg text-[#1c1810] focus:outline-none focus:ring-2 focus:ring-[#d4af37] focus:border-transparent transition-all"
                onChange={(e) => {
                  if (e.target.value) {
                    handleAddSize(e.target.value);
                    e.target.value = '';
                  }
                }}
                defaultValue=""
              >
                <option value="" className="bg-[#faf8f3]">Select size to add...</option>
                {availableSizesToAdd.map(size => (
                  <option key={size.id} value={size.name} className="bg-[#faf8f3]">
                    {size.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Current Stock (read-only) */}
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-[#e8e0d0] pb-2">
            <h3 className="text-lg font-semibold tracking-wider text-[#d4af37] uppercase">Current Stock</h3>
            <span className="text-xs text-[#7a6a4a] bg-[#faf8f3] border border-[#e8e0d0] px-2 py-1 rounded">
              Read-only · managed via Stock In / Out
            </span>
          </div>
          <div className="space-y-2">
            {Object.entries(formData.stocks).length > 0 ? (
              Object.entries(formData.stocks).map(([size, stock]) => (
                <div key={size} className="flex items-center justify-between px-4 py-2.5 bg-[#faf8f3] border border-[#e8e0d0] rounded-lg">
                  <span className="text-sm font-medium text-[#1c1810]">{size}</span>
                  <span className={`text-sm font-semibold ${stock > 0 ? 'text-green-600' : 'text-red-500'}`}>
                    {stock} units
                  </span>
                </div>
              ))
            ) : (
              <p className="text-sm text-[#7a6a4a] italic">No stock data available</p>
            )}
          </div>
          <button
            type="button"
            onClick={() => { onClose(); router.push('/admin/inventory'); }}
            className="w-full py-2.5 px-4 border-2 border-[#d4af37] text-[#8B6914] text-sm font-semibold rounded-lg hover:bg-[#d4af37]/10 transition-all flex items-center justify-center gap-2"
          >
            Manage Stock →
          </button>
        </div>

        {/* Product Tags */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold tracking-wider text-[#d4af37] uppercase border-b border-[#e8e0d0] pb-2">Product Tags</h3>

          <TagSelector
            title="Occasion Tags"
            options={tagOptions.occasion}
            selectedTags={formData.occasionsTags}
            onToggle={(tag) => handleTagToggle('occasionsTags', tag)}
          />

          <TagSelector
            title="Weather Tags"
            options={tagOptions.weather}
            selectedTags={formData.weatherTags}
            onToggle={(tag) => handleTagToggle('weatherTags', tag)}
          />

          <TagSelector
            title="Top Notes Tags"
            options={tagOptions.top_notes}
            selectedTags={formData.topNotesTags}
            onToggle={(tag) => handleTagToggle('topNotesTags', tag)}
          />

          <TagSelector
            title="Other Options Tags"
            options={tagOptions.other}
            selectedTags={formData.otherOptionsTags}
            onToggle={(tag) => handleTagToggle('otherOptionsTags', tag)}
          />
        </div>
        <div className="h-[30px]" />
      </div>

      {/* Action Buttons */}
      <div className="flex-shrink-0 pt-4 border-t border-[#e8e0d0] flex justify-end gap-3 bg-white">
        <button
          type="button"
          onClick={onClose}
          className="px-6 py-2.5 text-[#1c1810] border-2 border-[#d4af37]/30 rounded-lg uppercase text-sm font-semibold hover:bg-[#faf8f3] hover:border-[#d4af37] transition-all disabled:opacity-50"
          disabled={isLoading}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isLoading || isUploading}
          className="px-6 py-2.5 bg-[#d4af37] text-[#0a0a0a] rounded-lg uppercase font-semibold hover:bg-[#d4af37]/90 transition-all disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-[#d4af37]/20"
        >
          {isLoading && !isUploading && (
            <>
              <div className="w-4 h-4 border-2 border-[#0a0a0a] border-t-transparent rounded-full animate-spin"></div>
              Saving...
            </>
          )}
          {isUploading && (
            <>
              <div className="w-4 h-4 border-2 border-[#0a0a0a] border-t-transparent rounded-full animate-spin"></div>
              Uploading Images...
            </>
          )}
          {!isLoading && !isUploading && 'Save Changes'}
        </button>
      </div>
    </div>
  );
}