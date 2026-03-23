import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Palette, Image, FileText, Sparkles } from "lucide-react";
import { Tables } from "@/integrations/supabase/types";

type Client = Tables<"clients">;

interface BrandStyleSummaryCardProps {
  client: Client;
  referenceImages: Array<{ id: string; url: string; name: string }>;
  selectedReferenceIds: string[];
  onToggleReference: (id: string) => void;
  includeLogo: boolean;
  onToggleLogo: (checked: boolean) => void;
  styleNotes: string;
  onStyleNotesChange: (notes: string) => void;
  knowledgeSummary?: {
    positioning_summary?: string;
    key_differentiators?: string[];
  } | null;
}

export function BrandStyleSummaryCard({
  client,
  referenceImages,
  selectedReferenceIds,
  onToggleReference,
  includeLogo,
  onToggleLogo,
  styleNotes,
  onStyleNotesChange,
  knowledgeSummary,
}: BrandStyleSummaryCardProps) {
  const brandColors = [
    { name: "Primary", color: client.brand_primary_color },
    { name: "Secondary", color: client.brand_secondary_color },
    { name: "Accent", color: client.brand_accent_color },
  ].filter((c) => c.color);

  return (
    <Card className="border-border/50 bg-card/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          Brand Context
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Brand Colors */}
        {brandColors.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Palette className="h-3 w-3" />
              Colors
            </div>
            <div className="flex gap-2 flex-wrap">
              {brandColors.map((c) => (
                <div key={c.name} className="flex items-center gap-1.5">
                  <div
                    className="w-5 h-5 rounded-full border border-border shadow-sm"
                    style={{ backgroundColor: c.color || undefined }}
                  />
                  <span className="text-xs text-muted-foreground">{c.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Logo */}
        {client.brand_logo_url && (
          <div className="space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={includeLogo}
                onChange={(e) => onToggleLogo(e.target.checked)}
                className="rounded border-border"
              />
              <span className="text-xs text-muted-foreground">Include logo</span>
            </label>
            {includeLogo && (
              <div className="w-12 h-12 rounded border border-border bg-background flex items-center justify-center overflow-hidden">
                <img
                  src={client.brand_logo_url}
                  alt="Logo"
                  className="max-w-full max-h-full object-contain"
                />
              </div>
            )}
          </div>
        )}

        {/* Reference Images */}
        {referenceImages.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Image className="h-3 w-3" />
              Reference Images
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              {referenceImages.slice(0, 8).map((img) => (
                <button
                  key={img.id}
                  onClick={() => onToggleReference(img.id)}
                  className={`aspect-square rounded overflow-hidden border-2 transition-all ${
                    selectedReferenceIds.includes(img.id)
                      ? "border-primary ring-1 ring-primary/30"
                      : "border-transparent opacity-60 hover:opacity-100"
                  }`}
                >
                  <img
                    src={img.url}
                    alt={img.name}
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
            {referenceImages.length > 8 && (
              <p className="text-xs text-muted-foreground">
                +{referenceImages.length - 8} more
              </p>
            )}
          </div>
        )}

        {/* Key Differentiators */}
        {knowledgeSummary?.key_differentiators && knowledgeSummary.key_differentiators.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <FileText className="h-3 w-3" />
              Key Points
            </div>
            <div className="flex flex-wrap gap-1">
              {knowledgeSummary.key_differentiators.slice(0, 4).map((diff, i) => (
                <Badge key={i} variant="secondary" className="text-xs">
                  {diff.length > 25 ? diff.slice(0, 25) + "..." : diff}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Style Notes */}
        <div className="space-y-2">
          <label className="text-xs text-muted-foreground">Style Notes</label>
          <textarea
            value={styleNotes}
            onChange={(e) => onStyleNotesChange(e.target.value)}
            placeholder="E.g., Minimalist, professional, warm tones..."
            className="w-full h-16 text-xs p-2 rounded border border-border bg-background resize-none"
          />
        </div>
      </CardContent>
    </Card>
  );
}
