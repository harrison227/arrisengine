import { useState, useEffect } from 'react';
import { Palette, Save, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BrandPaletteEditor } from '@/components/brand/BrandPaletteEditor';
import { BrandPreview } from '@/components/brand/BrandPreview';
import { LogoUploader } from '@/components/brand/LogoUploader';
import { ExtractedPalettePreview } from '@/components/brand/ExtractedPalettePreview';
import { useClients } from '@/hooks/useClients';
import { toast } from 'sonner';
import { Tables } from '@/integrations/supabase/types';
import { extractColorsFromUrl, assignColorsToPalette, SuggestedPalette } from '@/lib/colorExtractor';

type Client = Tables<'clients'>;

interface BrandTabProps {
  client: Client;
}

interface BrandColors {
  brand_primary_color: string | null;
  brand_secondary_color: string | null;
  brand_accent_color: string | null;
  brand_background_color: string | null;
  brand_text_color: string | null;
  brand_fonts: string[] | null;
  brand_style_notes: string | null;
}

export function BrandTab({ client }: BrandTabProps) {
  const { updateClient, isUpdating } = useClients();
  const [hasChanges, setHasChanges] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(client.brand_logo_url);
  const [extractedColors, setExtractedColors] = useState<string[]>([]);
  const [suggestedPalette, setSuggestedPalette] = useState<SuggestedPalette | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [brandColors, setBrandColors] = useState<BrandColors>({
    brand_primary_color: client.brand_primary_color,
    brand_secondary_color: client.brand_secondary_color,
    brand_accent_color: client.brand_accent_color,
    brand_background_color: client.brand_background_color,
    brand_text_color: client.brand_text_color,
    brand_fonts: client.brand_fonts,
    brand_style_notes: client.brand_style_notes,
  });

  useEffect(() => {
    setLogoUrl(client.brand_logo_url);
    setBrandColors({
      brand_primary_color: client.brand_primary_color,
      brand_secondary_color: client.brand_secondary_color,
      brand_accent_color: client.brand_accent_color,
      brand_background_color: client.brand_background_color,
      brand_text_color: client.brand_text_color,
      brand_fonts: client.brand_fonts,
      brand_style_notes: client.brand_style_notes,
    });
  }, [client]);

  const handleLogoChange = (url: string | null) => {
    setLogoUrl(url);
    setHasChanges(true);
    // Clear extracted colors when logo changes
    setExtractedColors([]);
    setSuggestedPalette(null);
  };

  const handleExtractColors = async (imageUrl: string) => {
    setIsExtracting(true);
    try {
      const colors = await extractColorsFromUrl(imageUrl, 5);
      setExtractedColors(colors);
      const palette = assignColorsToPalette(colors);
      setSuggestedPalette(palette);
      toast.success('Colors extracted from logo');
    } catch (error) {
      console.error('Color extraction error:', error);
      toast.error('Failed to extract colors from logo');
    } finally {
      setIsExtracting(false);
    }
  };

  const handleApplyAllColors = (palette: SuggestedPalette) => {
    setBrandColors(prev => ({
      ...prev,
      brand_primary_color: palette.primary,
      brand_secondary_color: palette.secondary,
      brand_accent_color: palette.accent,
      brand_background_color: palette.background,
      brand_text_color: palette.text,
    }));
    setHasChanges(true);
    toast.success('All colors applied');
  };

  const handleApplyColor = (slot: keyof SuggestedPalette, color: string) => {
    const slotMap: Record<keyof SuggestedPalette, keyof BrandColors> = {
      primary: 'brand_primary_color',
      secondary: 'brand_secondary_color',
      accent: 'brand_accent_color',
      background: 'brand_background_color',
      text: 'brand_text_color',
    };
    
    setBrandColors(prev => ({
      ...prev,
      [slotMap[slot]]: color,
    }));
    setHasChanges(true);
  };

  const handleColorsChange = (newColors: BrandColors) => {
    setBrandColors(newColors);
    setHasChanges(true);
  };

  const handleSave = () => {
    updateClient({
      id: client.id,
      brand_logo_url: logoUrl,
      ...brandColors,
    }, {
      onSuccess: () => {
        toast.success('Brand identity saved');
        setHasChanges(false);
      },
      onError: () => {
        toast.error('Failed to save brand identity');
      },
    });
  };

  return (
    <div className="space-y-6">
      {/* Header with Save Button */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
            <Palette className="h-5 w-5" />
            Brand Identity
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Define the visual identity for {client.business_name}
          </p>
        </div>
        <Button 
          onClick={handleSave} 
          disabled={!hasChanges || isUpdating}
        >
          {isUpdating ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          Save Changes
        </Button>
      </div>

      {/* Logo Upload Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Brand Logo</CardTitle>
          <CardDescription>
            Upload your logo and extract colors from it to build your palette
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-6">
            <LogoUploader
              clientId={client.id}
              currentLogoUrl={logoUrl}
              onLogoChange={handleLogoChange}
              onExtractColors={handleExtractColors}
            />
            
            {isExtracting && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Extracting colors...
              </div>
            )}
          </div>

          {extractedColors.length > 0 && suggestedPalette && (
            <ExtractedPalettePreview
              extractedColors={extractedColors}
              suggestedPalette={suggestedPalette}
              onApplyAll={handleApplyAllColors}
              onApplyColor={handleApplyColor}
            />
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Editor */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Colors & Typography</CardTitle>
              <CardDescription>
                These colors will be used when generating images in the Image Studio
              </CardDescription>
            </CardHeader>
            <CardContent>
              <BrandPaletteEditor
                colors={brandColors}
                onChange={handleColorsChange}
              />
            </CardContent>
          </Card>
        </div>

        {/* Preview */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Preview</CardTitle>
              <CardDescription>
                How your brand colors look together
              </CardDescription>
            </CardHeader>
            <CardContent>
              <BrandPreview
                primaryColor={brandColors.brand_primary_color}
                secondaryColor={brandColors.brand_secondary_color}
                accentColor={brandColors.brand_accent_color}
                backgroundColor={brandColors.brand_background_color}
                textColor={brandColors.brand_text_color}
                fonts={brandColors.brand_fonts}
              />
            </CardContent>
          </Card>

          {/* Quick Color Display */}
          <Card className="mt-4">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Color Swatches</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3">
                {brandColors.brand_primary_color && (
                  <div className="text-center">
                    <div
                      className="w-12 h-12 rounded-lg border border-border shadow-sm"
                      style={{ backgroundColor: brandColors.brand_primary_color }}
                    />
                    <span className="text-xs text-muted-foreground mt-1 block">Primary</span>
                  </div>
                )}
                {brandColors.brand_secondary_color && (
                  <div className="text-center">
                    <div
                      className="w-12 h-12 rounded-lg border border-border shadow-sm"
                      style={{ backgroundColor: brandColors.brand_secondary_color }}
                    />
                    <span className="text-xs text-muted-foreground mt-1 block">Secondary</span>
                  </div>
                )}
                {brandColors.brand_accent_color && (
                  <div className="text-center">
                    <div
                      className="w-12 h-12 rounded-lg border border-border shadow-sm"
                      style={{ backgroundColor: brandColors.brand_accent_color }}
                    />
                    <span className="text-xs text-muted-foreground mt-1 block">Accent</span>
                  </div>
                )}
                {brandColors.brand_background_color && (
                  <div className="text-center">
                    <div
                      className="w-12 h-12 rounded-lg border border-border shadow-sm"
                      style={{ backgroundColor: brandColors.brand_background_color }}
                    />
                    <span className="text-xs text-muted-foreground mt-1 block">Background</span>
                  </div>
                )}
                {brandColors.brand_text_color && (
                  <div className="text-center">
                    <div
                      className="w-12 h-12 rounded-lg border border-border shadow-sm"
                      style={{ backgroundColor: brandColors.brand_text_color }}
                    />
                    <span className="text-xs text-muted-foreground mt-1 block">Text</span>
                  </div>
                )}
              </div>
              {!brandColors.brand_primary_color && !brandColors.brand_secondary_color && !brandColors.brand_accent_color && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No colors defined yet
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
