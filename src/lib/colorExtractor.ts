interface RGB {
  r: number;
  g: number;
  b: number;
}

interface ColorWithCount extends RGB {
  count: number;
}

/**
 * Convert RGB to hex color string
 */
function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(x => {
    const hex = Math.round(x).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }).join('');
}

/**
 * Calculate the luminance of a color (0-1, higher = lighter)
 */
function getLuminance(r: number, g: number, b: number): number {
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

/**
 * Calculate the saturation of a color (0-1, higher = more saturated)
 */
function getSaturation(r: number, g: number, b: number): number {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max === 0) return 0;
  return (max - min) / max;
}

/**
 * Simple median-cut color quantization algorithm
 */
function quantizeColors(pixels: RGB[], numColors: number): ColorWithCount[] {
  if (pixels.length === 0) return [];
  
  // Group similar colors
  const colorMap = new Map<string, ColorWithCount>();
  
  for (const pixel of pixels) {
    // Reduce precision to group similar colors (bucket by 16)
    const keyR = Math.floor(pixel.r / 16) * 16;
    const keyG = Math.floor(pixel.g / 16) * 16;
    const keyB = Math.floor(pixel.b / 16) * 16;
    const key = `${keyR},${keyG},${keyB}`;
    
    const existing = colorMap.get(key);
    if (existing) {
      existing.count++;
      // Average the colors
      existing.r = (existing.r * (existing.count - 1) + pixel.r) / existing.count;
      existing.g = (existing.g * (existing.count - 1) + pixel.g) / existing.count;
      existing.b = (existing.b * (existing.count - 1) + pixel.b) / existing.count;
    } else {
      colorMap.set(key, { ...pixel, count: 1 });
    }
  }
  
  // Sort by count and get top colors
  const sortedColors = Array.from(colorMap.values())
    .sort((a, b) => b.count - a.count);
  
  // Filter out very light (near white) and very dark (near black) colors
  const filteredColors = sortedColors.filter(color => {
    const luminance = getLuminance(color.r, color.g, color.b);
    return luminance > 0.05 && luminance < 0.95;
  });
  
  // If we filtered too much, include some back
  const colorsToUse = filteredColors.length >= numColors ? filteredColors : sortedColors;
  
  return colorsToUse.slice(0, numColors);
}

/**
 * Extract dominant colors from an image element
 * Returns an array of hex color strings
 */
export async function extractColorsFromImage(imageElement: HTMLImageElement, numColors = 5): Promise<string[]> {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      resolve([]);
      return;
    }
    
    // Scale down for performance
    const maxSize = 100;
    const scale = Math.min(maxSize / imageElement.naturalWidth, maxSize / imageElement.naturalHeight, 1);
    canvas.width = imageElement.naturalWidth * scale;
    canvas.height = imageElement.naturalHeight * scale;
    
    ctx.drawImage(imageElement, 0, 0, canvas.width, canvas.height);
    
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const pixels: RGB[] = [];
    
    // Sample every 4th pixel for performance
    for (let i = 0; i < imageData.data.length; i += 16) {
      const r = imageData.data[i];
      const g = imageData.data[i + 1];
      const b = imageData.data[i + 2];
      const a = imageData.data[i + 3];
      
      // Skip transparent pixels
      if (a < 128) continue;
      
      pixels.push({ r, g, b });
    }
    
    const dominantColors = quantizeColors(pixels, numColors);
    const hexColors = dominantColors.map(c => rgbToHex(c.r, c.g, c.b));
    
    resolve(hexColors);
  });
}

/**
 * Extract colors from an image URL
 */
export async function extractColorsFromUrl(imageUrl: string, numColors = 5): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    img.onload = async () => {
      const colors = await extractColorsFromImage(img, numColors);
      resolve(colors);
    };
    
    img.onerror = () => {
      reject(new Error('Failed to load image'));
    };
    
    img.src = imageUrl;
  });
}

export interface SuggestedPalette {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  text: string;
}

/**
 * Intelligently assign extracted colors to brand palette slots
 */
export function assignColorsToPalette(colors: string[]): SuggestedPalette {
  if (colors.length === 0) {
    return {
      primary: '#6366f1',
      secondary: '#8b5cf6',
      accent: '#f59e0b',
      background: '#ffffff',
      text: '#1f2937',
    };
  }
  
  // Convert hex to RGB for analysis
  const colorData = colors.map(hex => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return {
      hex,
      r, g, b,
      luminance: getLuminance(r, g, b),
      saturation: getSaturation(r, g, b),
    };
  });
  
  // Sort by different criteria
  const bySaturation = [...colorData].sort((a, b) => b.saturation - a.saturation);
  const byLuminance = [...colorData].sort((a, b) => a.luminance - b.luminance);
  
  // Assign colors
  const primary = bySaturation[0]?.hex || colors[0];
  const secondary = bySaturation[1]?.hex || bySaturation[0]?.hex || colors[0];
  const accent = bySaturation[2]?.hex || bySaturation[0]?.hex || colors[0];
  
  // Darkest for text, lightest for background
  const text = byLuminance[0]?.hex || '#1f2937';
  const background = byLuminance[byLuminance.length - 1]?.hex || '#ffffff';
  
  return { primary, secondary, accent, background, text };
}
