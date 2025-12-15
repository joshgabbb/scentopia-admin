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

interface AddProductProps {
  onClose: () => void;
  onProductAdd: (product: Product) => void;
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

export default function AddProduct({ onClose, onProductAdd }: AddProductProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    categoryId: "",
    perfumeType: "Basic" as "Basic" | "Premium",
    isActive: true,
    genderTags: [] as string[],
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
        genderTags: formData.genderTags,
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
      <div className="flex items-center gap-3 p-2 border border-orange-200 bg-orange-50 rounded">
        {preview ? (
          <img src={preview} alt="Preview" className="w-12 h-12 object-cover rounded" />
        ) : (
          <div className="w-12 h-12 bg-[#d4af37]/10 rounded flex items-center justify-center">
            <Upload size={20} className="text-gray-400" />
          </div>
        )}
        <div className="flex-1">
          <div className="text-sm text-gray-900 truncate max-w-[250px]">{file.name}</div>
          <div className="text-xs text-orange-600">Will be uploaded on save</div>
        </div>
        <button type="button" onClick={onRemove} className="text-red-500 hover:text-red-700">
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
    <div className="space-y-2">
      <label className="block text-sm font-medium text-[#f5e6d3]">{title}</label>
      <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => onToggle(option)}
            className={`px-3 py-1 text-xs rounded-full border transition-colors ${
              selectedTags.includes(option)
                ? 'bg-primary/20 text-primary border-primary/30 font-semibold'
                : 'bg-gray-100 text-[#f5e6d3] border-[#d4af37]/20 hover:bg-gray-100'
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
    <div className="h-full flex flex-col">
      <form onSubmit={handleSubmit} className="flex-1 space-y-6 overflow-y-auto">
        <div className="space-y-4">
          <h3 className="text-lg font-semibold tracking-wider text-gray-900">BASIC INFORMATION</h3>
         
          <div>
            <label className="block text-sm font-medium text-[#f5e6d3] mb-1">
              Product Name
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              className="w-full p-3 border border-[#d4af37]/20 text-sm focus:border-transparent"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#f5e6d3] mb-1">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              rows={4}
              className="w-full p-3 border border-[#d4af37]/20 text-sm focus:border-transparent"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[#f5e6d3] mb-1">
                Perfume Type
              </label>
              <select
                value={formData.perfumeType}
                onChange={(e) => handleInputChange('perfumeType', e.target.value as "Basic" | "Premium")}
                className="w-full p-3 border border-[#d4af37]/20 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              >
                <option value="Basic">Basic</option>
                <option value="Premium">Premium</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-[#f5e6d3] mb-1">
                Category
              </label>
              <select
                value={formData.categoryId}
                onChange={(e) => handleInputChange('categoryId', e.target.value)}
                className="w-full p-3 border border-[#d4af37]/20 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Select a category</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              id="isActive"
              checked={formData.isActive}
              onChange={(e) => handleInputChange('isActive', e.target.checked)}
              className="h-4 w-4 text-primary focus:ring-primary border-[#d4af37]/20 rounded"
            />
            <label htmlFor="isActive" className="ml-2 block text-sm text-gray-900">
              Product is active
            </label>
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-lg font-semibold tracking-wider text-gray-900">PRODUCT IMAGES</h3>
         
          <div className="space-y-2">
            {formData.images.map((image, index) => (
              <div key={`url-${index}`} className="flex items-center gap-3 p-2 border border-green-200 bg-green-50 rounded">
                <img src={image} alt={`Product ${index + 1}`} className="w-12 h-12 object-cover rounded" />
                <div className="flex-1">
                  <div className="text-sm text-gray-900 truncate max-w-[250px]">{image}</div>
                  <div className="text-xs text-green-600">Image URL ready</div>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveImageUrl(index)}
                  className="text-red-500 hover:text-red-700"
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
              <label className="block text-sm font-medium text-[#f5e6d3] mb-2">Select Image Files</label>
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
                className="w-full p-2 border border-[#d4af37]/20 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">
                Supported formats: JPEG, PNG, WebP. Max size: 5MB. Files will be uploaded when you save the product.
              </p>
            </div>

            <div className="border-t pt-3">
              <label className="block text-sm font-medium text-[#f5e6d3] mb-2">Or Add Image URL</label>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={newImageUrl}
                  onChange={(e) => setNewImageUrl(e.target.value)}
                  placeholder="Enter image URL"
                  className="flex-1 p-2 border border-[#d4af37]/20 text-sm focus:border-transparent"
                />
                <button
                  type="button"
                  onClick={handleAddImageUrl}
                  disabled={!newImageUrl.trim()}
                  className="px-4 py-2 bg-primary text-white hover:bg-green-700 disabled:opacity-50"
                >
                  <Plus size={16} />
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-lg font-medium text-gray-900">Sizes, Pricing & Stock</h3>
          <p className="text-sm text-[#b8a070]">Add at least one size with its price and stock</p>
         
          <div className="space-y-3">
            {Object.entries(formData.sizes).map(([size, price]) => {
              const stock = formData.stocks[size] || 0;
             
              return (
                <div key={size} className="flex items-center gap-3 p-3 border border-[#d4af37]/20">
                  <div className="flex-1">
                    <div className="font-medium leading-none">{size}ml</div>
                  </div>
                 
                  <div className="flex items-center gap-2 justify-center">
                    <div>
                      <label className="block text-xs text-[#b8a070] mb-1">Price</label>
                      <select
                        value={price}
                        onChange={(e) => handleSizePriceChange(size, parseFloat(e.target.value))}
                        className="w-24 p-2 text-sm border border-[#d4af37]/20"
                      >
                        {PRICE_OPTIONS.map(priceOption => (
                          <option key={priceOption} value={priceOption}>
                            ₱{priceOption}
                          </option>
                        ))}
                      </select>
                    </div>
                   
                    <div>
                      <label className="block text-xs text-[#b8a070] mb-1">Stock</label>
                      <input
                        type="number"
                        min="0"
                        value={stock}
                        onChange={(e) => handleSizeStockChange(size, parseInt(e.target.value) || 0)}
                        className="w-20 p-2 text-sm border border-[#d4af37]/20"
                      />
                    </div>
                   
                    <button
                      type="button"
                      onClick={() => handleRemoveSize(size)}
                      className="text-white hover:bg-red-400 bg-red-600 rounded-full mt-4 p-1"
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
                className="flex-1 p-2 border border-[#d4af37]/20 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                onChange={(e) => {
                  if (e.target.value) {
                    handleAddSize(e.target.value);
                    e.target.value = '';
                  }
                }}
                defaultValue=""
              >
                <option value="">Select size to add...</option>
                {availableSizesToAdd.map(size => (
                  <option key={size} value={size}>
                    {size}ml
                  </option>
                ))}
              </select>
            </div>
          )}

          {Object.keys(formData.sizes).length === 0 && (
            <div className="text-sm text-amber-600 bg-amber-50 border border-amber-200 p-3 rounded">
              Please add at least one size to continue
            </div>
          )}
        </div>

        <div className="space-y-4">
          <h3 className="text-lg font-semibold tracking-wider text-gray-900">PRODUCT TAGS</h3>
         
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
      </form>

      <div className="flex-shrink-0 pt-4 border-t border-[#d4af37]/20 flex justify-end gap-3">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 text-[#f5e6d3] border border-[#d4af37]/20 uppercase text-sm hover:bg-gray-100"
          disabled={isLoading}
        >
          Cancel
        </button>
        <button
          type="submit"
          onClick={handleSubmit}
          disabled={isLoading || isUploading || Object.keys(formData.sizes).length === 0}
          className="px-4 py-2 bg-primary text-white uppercase hover:bg-primary/50 transition text-sm leading-[2px] disabled:opacity-50 flex items-center gap-2"
        >
          {isLoading && !isUploading && 'Creating...'}
          {isUploading && 'Uploading Images...'}
          {!isLoading && !isUploading && 'Create Product'}
        </button>
      </div>
    </div>
  );
}