/**
 * Public read-only brand pack page. Accessed via /brand/:shareId.
 *
 * Pulls everything via the public-brand-pack edge function (no auth),
 * loads the client's real fonts via @font-face so the previews render
 * correctly, and offers a one-click ZIP download (when allow_downloads
 * is set on the share link).
 */

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ColorSwatch } from '@/components/brand-pack/ColorSwatch';
import { LogoCard } from '@/components/brand-pack/LogoCard';
import { FontCard } from '@/components/brand-pack/FontCard';
import { usePublicBrandPack } from '@/hooks/useBrandPack';
import { downloadBrandPackZip } from '@/lib/brandPackZip';
import { loadBrandFonts } from '@/lib/brandFontLoader';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { GUIDELINE_SECTION_LABELS, type GuidelineSection } from '@/types/brand-pack';

export default function PublicBrandPack() {
  const { shareId } = useParams<{ shareId: string }>();
  const { toast } = useToast();
  const { data, isLoading, error } = usePublicBrandPack(shareId);
  const [isZipping, setIsZipping] = useState(false);

  useEffect(() => {
    if (data?.fonts) loadBrandFonts(data.fonts);
  }, [data?.fonts]);

  const groupedGuidelines = useMemo(() => {
    if (!data?.guidelines) return {} as Record<GuidelineSection, typeof data.guidelines>;
    return data.guidelines.reduce<Record<string, typeof data.guidelines>>((acc, g) => {
      (acc[g.section] ??= []).push(g);
      return acc;
    }, {});
  }, [data?.guidelines]);

  const handleDownload = async () => {
    if (!data) return;
    setIsZipping(true);
    try {
      await downloadBrandPackZip({
        clientName: data.client.business_name,
        industry: data.client.industry,
        colors: data.colors,
        logos: data.logos,
        fonts: data.fonts,
        guidelines: data.guidelines,
        styleNotes: data.client.style_notes,
        legacyLogoUrl: data.client.legacy_logo_url,
      });
      // Best-effort download counter.
      if (shareId) {
        await supabase.rpc('record_brand_pack_download', { p_share_id: shareId });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      toast({ title: 'Download failed', description: message, variant: 'destructive' });
    } finally {
      setIsZipping(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-6 sm:p-10">
        <div className="max-w-5xl mx-auto space-y-6">
          <Skeleton className="h-12 w-64" />
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-32" />)}
          </div>
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <Card className="p-8 max-w-md text-center">
          <h1 className="text-xl font-semibold mb-2">Link not available</h1>
          <p className="text-sm text-muted-foreground">
            This brand pack link is invalid, expired, or has been deactivated. Please ask for a fresh link.
          </p>
        </Card>
      </div>
    );
  }

  const accent = data.colors.accent ?? data.colors.primary ?? '#0f172a';

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border" style={{ borderTopColor: accent, borderTopWidth: 4 }}>
        <div className="max-w-5xl mx-auto px-6 sm:px-10 py-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Brand pack</p>
            <h1 className="text-3xl font-semibold mt-1">{data.client.business_name}</h1>
            {data.client.industry && (
              <p className="text-sm text-muted-foreground">{data.client.industry}</p>
            )}
          </div>
          {data.shareLink.allow_downloads && (
            <Button onClick={handleDownload} disabled={isZipping}>
              {isZipping ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
              Download ZIP
            </Button>
          )}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 sm:px-10 py-10 space-y-10">
        {/* Colors. */}
        <section className="space-y-3">
          <h2 className="text-lg font-medium">Colors</h2>
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <ColorSwatch label="Primary" hex={data.colors.primary} />
            <ColorSwatch label="Secondary" hex={data.colors.secondary} />
            <ColorSwatch label="Accent" hex={data.colors.accent} />
            <ColorSwatch label="Background" hex={data.colors.background} />
            <ColorSwatch label="Text" hex={data.colors.text} />
          </div>
        </section>

        {/* Logos. */}
        {data.logos.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-lg font-medium">Logos</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {data.logos.map((logo) => (
                <LogoCard key={logo.id} logo={logo} readOnly />
              ))}
            </div>
          </section>
        )}

        {/* Fonts. */}
        {data.fonts.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-lg font-medium">Typography</h2>
            <div className="grid gap-3 lg:grid-cols-2">
              {data.fonts.map((font) => (
                <FontCard key={font.id} font={font} readOnly />
              ))}
            </div>
          </section>
        )}

        {/* Guidelines. */}
        {Object.keys(groupedGuidelines).length > 0 && (
          <section className="space-y-4">
            <h2 className="text-lg font-medium">Guidelines</h2>
            {Object.entries(groupedGuidelines).map(([section, items]) => (
              <Card key={section} className="p-4 space-y-2">
                <h3 className="text-sm font-medium">
                  {GUIDELINE_SECTION_LABELS[section as GuidelineSection] ?? section}
                </h3>
                <div className="space-y-3">
                  {items.map((item) => (
                    <div key={item.id} className="space-y-1">
                      {item.title && <div className="font-medium text-sm">{item.title}</div>}
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">{item.content}</p>
                    </div>
                  ))}
                </div>
              </Card>
            ))}
          </section>
        )}

        {data.client.style_notes && (
          <section className="space-y-2">
            <h2 className="text-lg font-medium">Style notes</h2>
            <Card className="p-4">
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{data.client.style_notes}</p>
            </Card>
          </section>
        )}
      </main>

      <footer className="border-t border-border mt-16">
        <div className="max-w-5xl mx-auto px-6 sm:px-10 py-6 text-xs text-muted-foreground flex flex-wrap items-center justify-between gap-2">
          <span>Powered by ArrisEngine</span>
          {data.shareLink.expires_at && (
            <span>Link expires {new Date(data.shareLink.expires_at).toLocaleDateString()}</span>
          )}
        </div>
      </footer>
    </div>
  );
}
