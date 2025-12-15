"use client";
import React, { useState, useEffect } from "react";
import { X, Upload, Trash2, Plus, Minus } from "lucide-react";

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

interface EditProductProps {
  product: Product;
  onClose: () => void;
  onProductUpdate: (productId: string, updates: Partial<Product>) => void;
}

const GENDER_OPTIONS = ["Men", "Women", "Unisex"];
const OCCASION_OPTIONS = ["Everyday/Casual", "Work/Professional", "Gym/Sports", "Date Night/Intimate", "Formal"];
const WEATHER_OPTIONS = ["Warm", "Cool", "Rainy"];
const TOP_NOTES_OPTIONS = ["Fruity", "Floral", "Citrus", "Woody", "Spicy", "Herbal"];
const OTHER_OPTIONS = ["Best Sellers", "Assorted"];
const PRICE_OPTIONS = [250, 350, 450];
const SIZE_OPTIONS = ["50", "85"];

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP'
  }).format(amount);
};

export default function EditProduct({ product, onClose, onProductUpdate }: EditProductProps) {
  const [categories, setCategories] = useState<Category[]>([]);
 
  const [formData, setFormData] = useState({
    name: product?.name || '',
    description: product?.description || '',
    categoryId: product?.category?.id || "",
    perfumeType: (product?.perfumeType as "Basic" | "Premium") || "Basic",
    isActive: product?.isActive ?? true,
    genderTags: product?.genderTags ? [...product.genderTags] : [],
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

    fetchCategories();
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
          gender_tags: formData.genderTags,
          occasions_tags: formData.occasionsTags,
          weather_tags: formData.weatherTags,
          top_notes_tags: formData.topNotesTags,
          other_options_tags: formData.otherOptionsTags,
          sizes: formData.sizes,
          stocks: formData.stocks,
          images: allImages
        })
      });

      if (response.ok) {
        const result = await response.json();
        onProductUpdate(product.id, result.data);
        onClose();
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update product');
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
          <img src={preview} alt="Preview" className="w-12 h-12 object-cover rounded border border-[#d4af37]/20" />
        ) : (
          <div className="w-12 h-12 bg-[#1a1a1a] rounded flex items-center justify-center border border-[#d4af37]/20">
            <Upload size={20} className="text-[#b8a070]" />
          </div>
        )}
        <div className="flex-1">
          <div className="text-sm text-[#f5e6d3] truncate max-w-[250px]">{file.name}</div>
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
                : 'bg-[#1a1a1a] text-[#f5e6d3] border-[#d4af37]/20 hover:border-[#d4af37]/40 hover:bg-[#1a1a1a]'
            }`}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );

  const availableSizesToAdd = SIZE_OPTIONS.filter(size => !formData.sizes[size]);

  return (
    <div className="h-full flex flex-col bg-[#0a0a0a]">
      <div className="flex-1 space-y-6 overflow-y-auto px-1">
        {/* Basic Information */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold tracking-wider text-[#d4af37] uppercase border-b border-[#d4af37]/20 pb-2">Basic Information</h3>
         
          <div>
            <label className="block text-sm font-medium text-[#d4af37] mb-2 uppercase tracking-wide">
              Product Name
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              className="w-full p-3 bg-[#1a1a1a] border border-[#d4af37]/20 rounded-lg text-[#f5e6d3] placeholder-[#b8a070] focus:outline-none focus:ring-2 focus:ring-[#d4af37] focus:border-transparent transition-all"
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
              className="w-full p-3 bg-[#1a1a1a] border border-[#d4af37]/20 rounded-lg text-[#f5e6d3] placeholder-[#b8a070] focus:outline-none focus:ring-2 focus:ring-[#d4af37] focus:border-transparent transition-all resize-none"
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
                className="w-full p-3 bg-[#1a1a1a] border border-[#d4af37]/20 rounded-lg text-[#f5e6d3] focus:outline-none focus:ring-2 focus:ring-[#d4af37] focus:border-transparent transition-all"
                required
              >
                <option value="Basic" className="bg-[#1a1a1a]">Basic</option>
                <option value="Premium" className="bg-[#1a1a1a]">Premium</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-[#d4af37] mb-2 uppercase tracking-wide">
                Category
              </label>
              <select
                value={formData.categoryId}
                onChange={(e) => handleInputChange('categoryId', e.target.value)}
                className="w-full p-3 bg-[#1a1a1a] border border-[#d4af37]/20 rounded-lg text-[#f5e6d3] focus:outline-none focus:ring-2 focus:ring-[#d4af37] focus:border-transparent transition-all"
              >
                <option value="" className="bg-[#1a1a1a]">Select a category</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id} className="bg-[#1a1a1a]">
                    {category.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center p-3 bg-[#1a1a1a] border border-[#d4af37]/20 rounded-lg">
            <input
              type="checkbox"
              id="isActive"
              checked={formData.isActive}
              onChange={(e) => handleInputChange('isActive', e.target.checked)}
              className="h-4 w-4 accent-[#d4af37] rounded"
            />
            <label htmlFor="isActive" className="ml-3 block text-sm text-[#f5e6d3]">
              Product is active
            </label>
          </div>
        </div>

        {/* Product Images */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold tracking-wider text-[#d4af37] uppercase border-b border-[#d4af37]/20 pb-2">Product Images</h3>
         
          <div className="space-y-2">
            {formData.images.map((image, index) => (
              <div key={`url-${index}`} className="flex items-center gap-3 p-3 border border-green-500/30 bg-green-900/20 rounded-lg">
                <img src={image} alt={`Product ${index + 1}`} className="w-12 h-12 object-cover rounded border border-[#d4af37]/20" />
                <div className="flex-1">
                  <div className="text-sm text-[#f5e6d3] truncate max-w-[250px]">{image}</div>
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
                className="w-full p-2 bg-[#1a1a1a] border border-[#d4af37]/20 rounded-lg text-[#f5e6d3] file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:bg-[#d4af37] file:text-[#0a0a0a] file:font-semibold hover:file:bg-[#d4af37]/90 transition-all"
              />
              <p className="text-xs text-[#b8a070] mt-2">
                Supported formats: JPEG, PNG, WebP. Max size: 5MB. Files will be uploaded when you save changes.
              </p>
            </div>

            <div className="border-t border-[#d4af37]/20 pt-3">
              <label className="block text-sm font-medium text-[#d4af37] mb-2 uppercase tracking-wide">Or Add Image URL</label>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={newImageUrl}
                  onChange={(e) => setNewImageUrl(e.target.value)}
                  placeholder="Enter image URL"
                  className="flex-1 p-3 bg-[#1a1a1a] border border-[#d4af37]/20 rounded-lg text-[#f5e6d3] placeholder-[#b8a070] focus:outline-none focus:ring-2 focus:ring-[#d4af37] focus:border-transparent transition-all"
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
          <h3 className="text-lg font-semibold tracking-wider text-[#d4af37] uppercase border-b border-[#d4af37]/20 pb-2">Sizes, Pricing & Stock</h3>
         
          <div className="space-y-3">
            {Object.entries(formData.sizes).map(([size, price]) => {
              const stock = formData.stocks[size] || 0;
             
              return (
                <div key={size} className="flex items-center gap-3 p-3 bg-[#1a1a1a] border border-[#d4af37]/20 rounded-lg">
                  <div className="flex-1">
                    <div className="font-medium text-[#d4af37]">{size}ml</div>
                  </div>
                 
                  <div className="flex items-center gap-3">
                    <div>
                      <label className="block text-xs text-[#b8a070] mb-1 uppercase">Price</label>
                      <select
                        value={price}
                        onChange={(e) => handleSizePriceChange(size, parseFloat(e.target.value))}
                        className="w-24 p-2 text-sm bg-[#0a0a0a] border border-[#d4af37]/20 rounded text-[#f5e6d3] focus:outline-none focus:ring-2 focus:ring-[#d4af37]"
                      >
                        {PRICE_OPTIONS.map(priceOption => (
                          <option key={priceOption} value={priceOption} className="bg-[#1a1a1a]">
                            ₱{priceOption}
                          </option>
                        ))}
                      </select>
                    </div>
                   
                    <div>
                      <label className="block text-xs text-[#b8a070] mb-1 uppercase">Stock</label>
                      <input
                        type="number"
                        min="0"
                        value={stock}
                        onChange={(e) => handleSizeStockChange(size, parseInt(e.target.value) || 0)}
                        className="w-20 p-2 text-sm bg-[#0a0a0a] border border-[#d4af37]/20 rounded text-[#f5e6d3] focus:outline-none focus:ring-2 focus:ring-[#d4af37]"
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
                className="flex-1 p-3 bg-[#1a1a1a] border border-[#d4af37]/20 rounded-lg text-[#f5e6d3] focus:outline-none focus:ring-2 focus:ring-[#d4af37] focus:border-transparent transition-all"
                onChange={(e) => {
                  if (e.target.value) {
                    handleAddSize(e.target.value);
                    e.target.value = '';
                  }
                }}
                defaultValue=""
              >
                <option value="" className="bg-[#1a1a1a]">Select size to add...</option>
                {availableSizesToAdd.map(size => (
                  <option key={size} value={size} className="bg-[#1a1a1a]">
                    {size}ml
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Product Tags */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold tracking-wider text-[#d4af37] uppercase border-b border-[#d4af37]/20 pb-2">Product Tags</h3>
         
          <TagSelector
            title="Gender Tags"
            options={GENDER_OPTIONS}
            selectedTags={formData.genderTags}
            onToggle={(tag) => handleTagToggle('genderTags', tag)}
          />
         
          <TagSelector
            title="Occasion Tags"
            options={OCCASION_OPTIONS}
            selectedTags={formData.occasionsTags}
            onToggle={(tag) => handleTagToggle('occasionsTags', tag)}
          />
         
          <TagSelector
            title="Weather Tags"
            options={WEATHER_OPTIONS}
            selectedTags={formData.weatherTags}
            onToggle={(tag) => handleTagToggle('weatherTags', tag)}
          />
         
          <TagSelector
            title="Top Notes Tags"
            options={TOP_NOTES_OPTIONS}
            selectedTags={formData.topNotesTags}
            onToggle={(tag) => handleTagToggle('topNotesTags', tag)}
          />
         
          <TagSelector
            title="Other Options Tags"
            options={OTHER_OPTIONS}
            selectedTags={formData.otherOptionsTags}
            onToggle={(tag) => handleTagToggle('otherOptionsTags', tag)}
          />
        </div>
        <div className="h-[30px]" />
      </div>

      {/* Action Buttons */}
      <div className="flex-shrink-0 pt-4 border-t border-[#d4af37]/20 flex justify-end gap-3 bg-[#0a0a0a]">
        <button
          type="button"
          onClick={onClose}
          className="px-6 py-2.5 text-[#f5e6d3] border-2 border-[#d4af37]/30 rounded-lg uppercase text-sm font-semibold hover:bg-[#1a1a1a] hover:border-[#d4af37] transition-all disabled:opacity-50"
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