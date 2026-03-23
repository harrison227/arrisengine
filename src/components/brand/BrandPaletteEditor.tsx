import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { X, Plus } from 'lucide-react';

interface BrandColors {
  brand_primary_color: string | null;
  brand_secondary_color: string | null;
  brand_accent_color: string | null;
  brand_background_color: string | null;
  brand_text_color: string | null;
  brand_fonts: string[] | null;
  brand_style_notes: string | null;
}

interface BrandPaletteEditorProps {
  colors: BrandColors;
  onChange: (colors: BrandColors) => void;
}

export function BrandPaletteEditor({ colors, onChange }: BrandPaletteEditorProps) {
  const updateColor = (key: keyof BrandColors, value: string | string[] | null) => {
    onChange({ ...colors, [key]: value });
  };

  const addFont = () => {
    const currentFonts = colors.brand_fonts || [];
    updateColor('brand_fonts', [...currentFonts, '']);
  };

  const updateFont = (index: number, value: string) => {
    const currentFonts = [...(colors.brand_fonts || [])];
    currentFonts[index] = value;
    updateColor('brand_fonts', currentFonts);
  };

  const removeFont = (index: number) => {
    const currentFonts = [...(colors.brand_fonts || [])];
    currentFonts.splice(index, 1);
    updateColor('brand_fonts', currentFonts);
  };

  const colorInputs = [
    { key: 'brand_primary_color' as const, label: 'Primary Color', description: 'Main brand color' },
    { key: 'brand_secondary_color' as const, label: 'Secondary Color', description: 'Supporting color' },
    { key: 'brand_accent_color' as const, label: 'Accent Color', description: 'Highlights & CTAs' },
    { key: 'brand_background_color' as const, label: 'Background Color', description: 'Preferred backgrounds' },
    { key: 'brand_text_color' as const, label: 'Text Color', description: 'Primary text color' },
  ];

  return (
    <div className="space-y-6">
      {/* Color Palette */}
      <div>
        <h4 className="text-sm font-medium text-foreground mb-4">Color Palette</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {colorInputs.map(({ key, label, description }) => (
            <div key={key} className="space-y-2">
              <Label htmlFor={key} className="text-xs">
                {label}
              </Label>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <input
                    type="color"
                    value={colors[key] || '#ffffff'}
                    onChange={(e) => updateColor(key, e.target.value)}
                    className="w-10 h-10 rounded-lg cursor-pointer border border-border bg-transparent"
                  />
                </div>
                <Input
                  id={key}
                  value={colors[key] || ''}
                  onChange={(e) => updateColor(key, e.target.value)}
                  placeholder="#000000"
                  className="font-mono text-xs flex-1"
                />
              </div>
              <p className="text-xs text-muted-foreground">{description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Fonts */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-medium text-foreground">Brand Fonts</h4>
          <Button type="button" variant="outline" size="sm" onClick={addFont}>
            <Plus className="h-3 w-3 mr-1" />
            Add Font
          </Button>
        </div>
        <div className="space-y-2">
          {(colors.brand_fonts || []).map((font, index) => (
            <div key={index} className="flex items-center gap-2">
              <Input
                value={font}
                onChange={(e) => updateFont(index, e.target.value)}
                placeholder="e.g., Inter, Playfair Display"
                className="flex-1"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => removeFont(index)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
          {(!colors.brand_fonts || colors.brand_fonts.length === 0) && (
            <p className="text-sm text-muted-foreground">No fonts added yet</p>
          )}
        </div>
      </div>

      {/* Style Notes */}
      <div className="space-y-2">
        <Label htmlFor="brand_style_notes">Style Notes</Label>
        <Textarea
          id="brand_style_notes"
          value={colors.brand_style_notes || ''}
          onChange={(e) => updateColor('brand_style_notes', e.target.value)}
          placeholder="Describe the visual style preferences... e.g., Clean and minimal, modern aesthetic, avoid busy backgrounds"
          rows={4}
        />
        <p className="text-xs text-muted-foreground">
          These notes will be used by AI when generating images for this client
        </p>
      </div>
    </div>
  );
}
