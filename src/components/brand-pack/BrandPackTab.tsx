/**
 * Brand Pack tab for the Client Detail page.
 *
 * Pulls everything together: colors palette, logo grid, font list,
 * guidelines editor, share-link manager, and a "Download brand pack" zip
 * action. Delegates to the focused components in this folder.
 */

import { useEffect, useMemo, useState } from 'react';
import { Download, Loader2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  useBrandPack,
  useClientLogos,
  useClientBrandFonts,
  useClientBrandGuidelines,
} from '@/hooks/useBrandPack';
import { ColorSwatch } from './ColorSwatch';
import { LogoCard } from './LogoCard';
import { LogoUploadDialog } from './LogoUploadDialog';
import { FontCard } from './FontCard';
import { FontUploadDialog } from './FontUploadDialog';
import { GuidelineEditor } from './GuidelineEditor';
import { ShareLinkManager } from './ShareLinkManager';
import { downloadBrandPackZip } from '@/lib/brandPackZip';
import { loadBrandFonts } from '@/lib/brandFontLoader';
import { useToast } from '@/hooks/use-toast';
import {
  GUIDELINE_SECTION_LABELS,
  type GuidelineSection,
} from '@/types/brand-pack';

interface BrandPackTabProps {
  clientId: string;
}

const GUIDELINE_SECTIONS: GuidelineSection[] = [
  'logo_usage',
  'typography',
  'voice',
  'colors',
  'dos_donts',
  'mission',
  'imagery',
];

export function BrandPackTab({ clientId }: BrandPackTabProps) {
  const { toast } = useToast();
  const { data: pack, isLoading } = useBrandPack(clientId);
  const { logos, deleteLogo, setPrimary } = useClientLogos(clientId);
  const { fonts, deleteFont } = useClientBrandFonts(clientId);
  const { guidelines } = useClientBrandGuidelines(clientId);

  const [showLogoDialog, setShowLogoDialog] = useState(false);
  const [showFontDialog, setShowFontDialog] = useState(false);
  const [isZipping, setIsZipping] = useState(false);

  // Inject the brand fonts so the FontCard previews actually use the real fonts.
  useEffect(() => {
    loadBrandFonts(fonts);
  }, [fonts]);

  const sortedFonts = useMemo(() => {
    const order: Record<string, number> = { heading: 0, display: 1, body: 2, accent: 3 };
    return [...fonts].sort((a, b) => (order[a.role] ?? 99) - (order[b.role] ?? 99) || a.sort_order - b.sort_order);
  }, [fonts]);

  const handleDownloadZip = async () => {
    if (!pack) return;
    setIsZipping(true);
    try {
      await downloadBrandPackZip({
        clientName: pack.client.business_name,
        industry: pack.client.industry,
        colors: pack.colors,
        logos,
        fonts,
        guidelines,
        styleNotes: pack.client.style_notes,
        legacyLogoUrl: pack.client.legacy_logo_url,
      });
      toast({ title: 'Brand pack downloaded' });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      toast({ title: 'Download failed', description: message, variant: 'destructive' });
    } finally {
      setIsZipping(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-40" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-32" />)}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!pack) {
    return (
      <Card className="p-6">
        <p className="text-sm text-muted-foreground">Brand pack not available for this client.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top-line download. */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{pack.client.business_name} — Brand Pack</h2>
          <p className="text-sm text-muted-foreground">
            All logos, colors, fonts and guidelines in one place. Downloadable as a ZIP, shareable via a public link.
          </p>
        </div>
        <Button onClick={handleDownloadZip} disabled={isZipping}>
          {isZipping ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
          Download ZIP
        </Button>
      </div>

      {/* Colors. */}
      <section className="space-y-3">
        <h3 className="text-sm font-medium">Colors</h3>
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <ColorSwatch label="Primary" hex={pack.colors.primary} />
          <ColorSwatch label="Secondary" hex={pack.colors.secondary} />
          <ColorSwatch label="Accent" hex={pack.colors.accent} />
          <ColorSwatch label="Background" hex={pack.colors.background} />
          <ColorSwatch label="Text" hex={pack.colors.text} />
        </div>
      </section>

      {/* Logos. */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium">Logos</h3>
          <Button size="sm" variant="outline" onClick={() => setShowLogoDialog(true)}>
            <Plus className="h-4 w-4 mr-1.5" />
            Add logo
          </Button>
        </div>
        {logos.length === 0 ? (
          <Card className="p-6 text-center text-sm text-muted-foreground">
            No logo variants yet. Upload your primary logo, then add white/dark/mark variants as needed.
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {logos.map((logo) => (
              <LogoCard
                key={logo.id}
                logo={logo}
                onDelete={deleteLogo}
                onSetPrimary={setPrimary}
              />
            ))}
          </div>
        )}
      </section>

      {/* Fonts. */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium">Typography</h3>
          <Button size="sm" variant="outline" onClick={() => setShowFontDialog(true)}>
            <Plus className="h-4 w-4 mr-1.5" />
            Add font
          </Button>
        </div>
        {sortedFonts.length === 0 ? (
          <Card className="p-6 text-center text-sm text-muted-foreground">
            No fonts yet. Upload .woff2 / .otf files for live previews and image generation, or just reference a Google Font by name.
          </Card>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {sortedFonts.map((font) => (
              <FontCard key={font.id} font={font} onDelete={deleteFont} />
            ))}
          </div>
        )}
      </section>

      {/* Guidelines. */}
      <section className="space-y-3">
        <h3 className="text-sm font-medium">Guidelines</h3>
        <Tabs defaultValue={GUIDELINE_SECTIONS[0]} className="w-full">
          <TabsList className="flex-wrap h-auto justify-start">
            {GUIDELINE_SECTIONS.map((section) => (
              <TabsTrigger key={section} value={section} className="text-xs">
                {GUIDELINE_SECTION_LABELS[section]}
              </TabsTrigger>
            ))}
          </TabsList>
          {GUIDELINE_SECTIONS.map((section) => (
            <TabsContent key={section} value={section} className="pt-4">
              <GuidelineEditor clientId={clientId} section={section} guidelines={guidelines} />
            </TabsContent>
          ))}
        </Tabs>
      </section>

      {/* Share-link manager. */}
      <ShareLinkManager clientId={clientId} />

      {/* Dialogs. */}
      <LogoUploadDialog
        clientId={clientId}
        open={showLogoDialog}
        onOpenChange={setShowLogoDialog}
        isFirstLogo={logos.length === 0}
      />
      <FontUploadDialog clientId={clientId} open={showFontDialog} onOpenChange={setShowFontDialog} />
    </div>
  );
}
