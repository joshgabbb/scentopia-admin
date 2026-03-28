"use client";
import React, { useState, useEffect } from "react";
import { X, Upload, Trash2, Plus, Minus } from "lucide-react";

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

interface AddProductProps {
  onClose: () => void;
  onProductAdd: (product: Product) => void;
}

// Default fallback options if API fails
const DEFAULT_OCCASION_OPTIONS = ["Everyday/Casual", "Work/Professional", "Gym/Sports", "Date Night/Intimate", "Formal"];
const DEFAULT_WEATHER_OPTIONS = ["Warm", "Cool", "Rainy"];
const DEFAULT_TOP_NOTES_OPTIONS = ["Fruity", "Floral", "Citrus", "Woody", "Spicy", "Herbal"];
const DEFAULT_OTHER_OPTIONS = ["Best Sellers", "Assorted"];

interface TagOptions {
  occasion: string[];
  weather: string[];
  top_notes: string[];
  other: string[];
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP'
  }).format(amount);
};

export default function AddProduct({ onClose, onProductAdd }: AddProductProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [sizeOptions, setSizeOptions] = useState<Size[]>([]);
  const [tagOptions, setTagOptions] = useState<TagOptions>({
    occasion: DEFAULT_OCCASION_OPTIONS,
    weather: DEFAULT_WEATHER_OPTIONS,
    top_notes: DEFAULT_TOP_NOTES_OPTIONS,
    other: DEFAULT_OTHER_OPTIONS
  });
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    categoryId: "",
    perfumeType: "Basic" as "Basic" | "Premium",
    isActive: true,
    occasionsTags: [] as string[],
    weatherTags: [] as string[],
    topNotesTags: [] as string[],
    otherOptionsTags: [] as string[],
    sizes: {} as Record<string, number>,
    stocks: {} as Record<string, number>,
    images: [] as string[],
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

  const handleSizeStockChange = (size: string, value: number) => {
    setFormData(prev => ({
      ...prev,
      stocks: {
        ...prev.stocks,
        [size]: value
      }
    }));
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
    const { [size]: removedSize, ...remainingSizes } = formData.sizes;
    const { [size]: removedStock, ...remainingStocks } = formData.stocks;
   
    setFormData(prev => ({
      ...prev,
      sizes: remainingSizes,
      stocks: remainingStocks
    }));
  };

  const handleAddSize = (size: string) => {
    if (formData.sizes[size]) {
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
   
    if (!formData.name.trim()) {
      alert('Product name is required');
      return;
    }
   
    if (!formData.description.trim()) {
      alert('Product description is required');
      return;
    }

    if (Object.keys(formData.sizes).length === 0) {
      alert('Please add at least one size with pricing');
      return;
    }

    setIsLoading(true);

    try {
      const uploadedUrls = await uploadAllFiles();
      const allImages = [...formData.images, ...uploadedUrls];

      // Calculate the lowest price from sizes for the base price field
      const lowestPrice = Math.min(...Object.values(formData.sizes));

      const payload = {
        name: formData.name.trim(),
        desc: formData.description.trim(),
        price: lowestPrice, // Use lowest size price
        categoryId: formData.categoryId || null,
        perfumeType: formData.perfumeType,
        isActive: formData.isActive,
        occasionsTags: formData.occasionsTags,
        weatherTags: formData.weatherTags,
        topNotesTags: formData.topNotesTags,
        otherOptionsTags: formData.otherOptionsTags,
        sizes: formData.sizes,
        stocks: formData.stocks,
        images: allImages
      };

      const response = await fetch('/api/admin/products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        const result = await response.json();
        onProductAdd(result.data);
        onClose();
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create product');
      }
    } catch (error) {
      console.error('Error creating product:', error);
      alert(`Failed to create product: ${error instanceof Error ? error.message : 'Please try again.'}`);
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

  const availableSizesToAdd = sizeOptions.filter(size => size.is_active && !formData.sizes[size.name]);

  return (
    <div className="h-full flex flex-col bg-white">
      <form onSubmit={handleSubmit} className="flex-1 space-y-6 overflow-y-auto px-1">
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
                  <div className="text-xs text-green-400">Image URL ready</div>
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
              <label className="block text-sm font-medium text-[#d4af37] mb-2 uppercase tracking-wide">Select Image Files</label>
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
                Supported formats: JPEG, PNG, WebP. Max size: 5MB. Files will be uploaded when you save the product.
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

        {/* Sizes, Pricing & Stock */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold tracking-wider text-[#d4af37] uppercase border-b border-[#e8e0d0] pb-2">Sizes, Pricing & Stock</h3>
          <p className="text-sm text-[#7a6a4a]">Add at least one size with its price and stock</p>
         
          <div className="space-y-3">
            {Object.entries(formData.sizes).map(([size, price]) => {
              const stock = formData.stocks[size] || 0;
             
              return (
                <div key={size} className="flex items-center gap-3 p-3 bg-[#faf8f3] border border-[#e8e0d0] rounded-lg">
                  <div className="flex-1">
                    <div className="font-medium text-[#d4af37]">{size}</div>
                  </div>
                 
                  <div className="flex items-center gap-3">
                    <div>
                      <label className="block text-xs text-[#7a6a4a] mb-1 uppercase">Price</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={price}
                        onChange={(e) => handleSizePriceChange(size, parseFloat(e.target.value) || 0)}
                        className="w-24 p-2 text-sm bg-white border border-[#e8e0d0] rounded text-[#1c1810] focus:outline-none focus:ring-2 focus:ring-[#d4af37]"
                        placeholder="0.00"
                      />
                    </div>
                   
                    <div>
                      <label className="block text-xs text-[#7a6a4a] mb-1 uppercase">Stock</label>
                      <input
                        type="number"
                        min="0"
                        value={stock}
                        onChange={(e) => handleSizeStockChange(size, parseInt(e.target.value) || 0)}
                        className="w-20 p-2 text-sm bg-white border border-[#e8e0d0] rounded text-[#1c1810] focus:outline-none focus:ring-2 focus:ring-[#d4af37]"
                      />
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
              );
            })}
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

          {Object.keys(formData.sizes).length === 0 && (
            <div className="text-sm text-[#d4af37] bg-[#d4af37]/10 border border-[#d4af37]/30 p-3 rounded-lg">
              Please add at least one size to continue
            </div>
          )}
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
      </form>

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
          type="submit"
          onClick={handleSubmit}
          disabled={isLoading || isUploading || Object.keys(formData.sizes).length === 0}
          className="px-6 py-2.5 bg-[#d4af37] text-[#0a0a0a] rounded-lg uppercase font-semibold hover:bg-[#d4af37]/90 transition-all disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-[#d4af37]/20"
        >
          {isLoading && !isUploading && (
            <>
              <div className="w-4 h-4 border-2 border-[#0a0a0a] border-t-transparent rounded-full animate-spin"></div>
              Creating...
            </>
          )}
          {isUploading && (
            <>
              <div className="w-4 h-4 border-2 border-[#0a0a0a] border-t-transparent rounded-full animate-spin"></div>
              Uploading Images...
            </>
          )}
          {!isLoading && !isUploading && 'Create Product'}
        </button>
      </div>
    </div>
  );
}