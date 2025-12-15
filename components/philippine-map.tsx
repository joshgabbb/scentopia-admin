"use client";
import React, { useState, useEffect, useRef, useImperativeHandle, forwardRef } from 'react';

interface PhilippineMapProps {
  className?: string;
  style?: React.CSSProperties;
  onMapLoaded?: (colorFunction: (id: string, color: string) => void) => void;
  region?: 'all' | 'luzon' | 'visayas' | 'mindanao'; // Add region prop
}
 
export interface PhilippineMapRef {
  colorProvince: (id: string, color: string) => void;
  getAllProvinceIds: () => string[];
  debugProvince: (id: string) => void;
}

const PhilippineMap = forwardRef<PhilippineMapRef, PhilippineMapProps>(({ 
  className, 
  style, 
  onMapLoaded,
  region = 'all' // Default to 'all'
}, ref) => {
  const [svgContent, setSvgContent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentRegion, setCurrentRegion] = useState<string>(region);
  const mapRef = useRef<HTMLDivElement>(null);

  // Map region to SVG file
  const getSvgPath = (regionType: string): string => {
    const svgMap = {
      'all': '/assets/svgs/general/philippines.svg',
      'luzon': '/assets/svgs/general/luzon.svg',
      'visayas': '/assets/svgs/general/visayas.svg',
      'mindanao': '/assets/svgs/general/mindanao.svg'
    };
    return svgMap[regionType as keyof typeof svgMap] || svgMap['all'];
  };

  const colorProvince = (id: string, color: string) => {
    console.log(`Attempting to color province: ${id} with color: ${color}`);
    
    if (!mapRef.current) {
      console.error('Map container not found');
      return;
    }

    // Try different selectors
    const selectors = [
      `#${id}`,
      `path[id="${id}"]`,
      `[id="${id}"]`
    ];

    let element = null;
    for (const selector of selectors) {
      element = mapRef.current.querySelector(selector);
      if (element) {
        console.log(`Found element with selector: ${selector}`, element);
        break;
      }
    }

    if (!element) {
      console.error(`Province element not found for ID: ${id}`);
      console.log('Available elements with IDs:', getAllProvinceIds());
      return;
    }

    // Try different ways to set the color
    element.setAttribute("fill", color);
    element.setAttribute("style", `fill: ${color} !important;`);
    (element as HTMLElement).style.fill = color;
    
    console.log(`Successfully colored ${id} with ${color}`);
  };

  const getAllProvinceIds = (): string[] => {
    if (!mapRef.current) return [];
    
    const elements = mapRef.current.querySelectorAll('[id]');
    const ids: string[] = [];
    elements.forEach(el => {
      const id = el.getAttribute('id');
      if (id) ids.push(id);
    });
    
    console.log('All available IDs:', ids);
    return ids;
  };

  const debugProvince = (id: string) => {
    console.log(`Debugging province: ${id}`);
    const element = mapRef.current?.querySelector(`#${id}`);
    console.log('Element found:', element);
    console.log('Current fill:', element?.getAttribute('fill'));
    console.log('Current style:', element?.getAttribute('style'));
  };

  // Function to scale SVG to fit container
  const scaleSvgToFit = () => {
    if (!mapRef.current) return;
    
    const svgEl = mapRef.current.querySelector("svg");
    if (svgEl) {
      // Remove any existing dimensions
      svgEl.removeAttribute("width");
      svgEl.removeAttribute("height");
      
      // Set responsive dimensions
      svgEl.setAttribute("width", "100%");
      svgEl.setAttribute("height", "100%");
      svgEl.setAttribute("preserveAspectRatio", "xMidYMid meet");
      
      // Ensure the viewBox is preserved from the original SVG
      if (!svgEl.getAttribute("viewBox")) {
        svgEl.setAttribute("viewBox", "0 0 702.39 1209.4381");
      }
      
      console.log("SVG scaled to fit container");
    }
  };

  useImperativeHandle(ref, () => ({
    colorProvince,
    getAllProvinceIds,
    debugProvince
  }));

  // Load SVG when region changes
  useEffect(() => {
    const loadSvg = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const svgPath = getSvgPath(region);
        console.log(`Loading SVG for region: ${region}, path: ${svgPath}`);
        
        const response = await fetch(svgPath);
        if (!response.ok) {
          throw new Error(`Failed to fetch SVG: ${response.status} ${response.statusText}`);
        }
        const svgText = await response.text();
        console.log(`SVG loaded for ${region}, first 500 chars:`, svgText.substring(0, 500));
        setSvgContent(svgText);
        setCurrentRegion(region);
        
      } catch (err) {
        console.error('Error loading SVG:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    loadSvg();
  }, [region]); // Re-load when region changes

  // Separate effect for scaling SVG - runs whenever svgContent changes
  useEffect(() => {
    if (svgContent && mapRef.current) {
      // Use a small delay to ensure DOM is ready
      const timer = setTimeout(() => {
        scaleSvgToFit();
        
        // Call onMapLoaded after scaling
        if (onMapLoaded) {
          console.log(`Map loaded and scaled for region: ${currentRegion}, calling onMapLoaded`);
          onMapLoaded(colorProvince);
        }
      }, 100);

      return () => clearTimeout(timer);
    }
  }, [svgContent, onMapLoaded, currentRegion]);

  // Additional effect to handle window resize
  useEffect(() => {
    const handleResize = () => {
      if (svgContent) {
        scaleSvgToFit();
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [svgContent]);

  if (loading) {
    return (
      <div className={`${className || ''} flex items-center justify-center bg-gray-100`} style={style}>
        <span className="text-gray-500">Loading {region === 'all' ? 'Philippines' : region} map...</span>
      </div>
    );
  }

  if (error || !svgContent) {
    return (
      <div className={`${className || ''} flex items-center justify-center bg-gray-100 border border-[#d4af37]/20`} style={style}>
        <span className="text-red-500">Failed to load {region} map: {error}</span>
      </div>
    );
  }

  return ( 
    <div
      ref={mapRef}
      className={`${className || ''} w-full h-full`}
      style={style}
      dangerouslySetInnerHTML={{ __html: svgContent }}
    />
  );
});

PhilippineMap.displayName = 'PhilippineMap';

export default PhilippineMap;