import { Lightbulb, Target, AlertTriangle, Sparkles, Palette, BookOpen } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';

interface KnowledgeSummary {
  positioning_summary: string | null;
  ideal_customer_profile: string | null;
  key_differentiators: string[] | null;
  content_opportunities: string[] | null;
  compliance_flags: string[] | null;
}

interface KnowledgeEntry {
  id: string;
  title: string;
  content: string;
  category: string;
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

interface BrandContextSidebarProps {
  summary: KnowledgeSummary | null;
  entries: KnowledgeEntry[];
  brandColors?: BrandColors | null;
  isLoading?: boolean;
}

export function BrandContextSidebar({
  summary,
  entries,
  brandColors,
  isLoading,
}: BrandContextSidebarProps) {
  const hasColors = brandColors?.brand_primary_color || brandColors?.brand_secondary_color || brandColors?.brand_accent_color;

  return (
    <div className="h-full border-l bg-card flex flex-col">
      {/* Header */}
      <div className="p-4 border-b">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Lightbulb className="h-4 w-4 text-primary" />
          </div>
          <span className="font-semibold text-sm">Brand Context</span>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-20 w-full rounded-lg" />
              <Skeleton className="h-16 w-full rounded-lg" />
              <Skeleton className="h-24 w-full rounded-lg" />
            </div>
          ) : !summary && entries.length === 0 && !hasColors ? (
            <div className="text-center py-8">
              <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center mx-auto mb-3">
                <Lightbulb className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium text-foreground mb-1">No brand context</p>
              <p className="text-xs text-muted-foreground">
                Add knowledge entries in the client profile
              </p>
            </div>
          ) : (
            <>
              {/* Brand Colors */}
              {hasColors && (
                <div className="p-3 rounded-lg bg-muted/50 border">
                  <div className="flex items-center gap-2 mb-2">
                    <Palette className="h-4 w-4 text-muted-foreground" />
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Brand Colors
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {brandColors?.brand_primary_color && (
                      <div className="text-center">
                        <div
                          className="w-10 h-10 rounded-lg border shadow-sm"
                          style={{ backgroundColor: brandColors.brand_primary_color }}
                        />
                        <span className="text-[9px] text-muted-foreground mt-1 block">Primary</span>
                      </div>
                    )}
                    {brandColors?.brand_secondary_color && (
                      <div className="text-center">
                        <div
                          className="w-10 h-10 rounded-lg border shadow-sm"
                          style={{ backgroundColor: brandColors.brand_secondary_color }}
                        />
                        <span className="text-[9px] text-muted-foreground mt-1 block">Secondary</span>
                      </div>
                    )}
                    {brandColors?.brand_accent_color && (
                      <div className="text-center">
                        <div
                          className="w-10 h-10 rounded-lg border shadow-sm"
                          style={{ backgroundColor: brandColors.brand_accent_color }}
                        />
                        <span className="text-[9px] text-muted-foreground mt-1 block">Accent</span>
                      </div>
                    )}
                  </div>
                  {brandColors?.brand_fonts && brandColors.brand_fonts.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      <span className="font-medium">Fonts:</span> {brandColors.brand_fonts.join(', ')}
                    </p>
                  )}
                  {brandColors?.brand_style_notes && (
                    <p className="text-xs text-muted-foreground mt-2 italic border-l-2 border-border pl-2">
                      {brandColors.brand_style_notes}
                    </p>
                  )}
                </div>
              )}

              {/* Positioning */}
              {summary?.positioning_summary && (
                <div className="p-3 rounded-lg bg-muted/50 border">
                  <div className="flex items-center gap-2 mb-2">
                    <Lightbulb className="h-4 w-4 text-muted-foreground" />
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Positioning
                    </span>
                  </div>
                  <p className="text-sm leading-relaxed text-foreground">
                    {summary.positioning_summary}
                  </p>
                </div>
              )}

              {/* Target Audience */}
              {summary?.ideal_customer_profile && (
                <div className="p-3 rounded-lg bg-muted/50 border">
                  <div className="flex items-center gap-2 mb-2">
                    <Target className="h-4 w-4 text-muted-foreground" />
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Target Audience
                    </span>
                  </div>
                  <p className="text-sm leading-relaxed text-foreground">
                    {summary.ideal_customer_profile}
                  </p>
                </div>
              )}

              {/* Key Differentiators */}
              {summary?.key_differentiators && summary.key_differentiators.length > 0 && (
                <div className="p-3 rounded-lg bg-muted/50 border">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="h-4 w-4 text-muted-foreground" />
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Differentiators
                    </span>
                  </div>
                  <ul className="space-y-1">
                    {summary.key_differentiators.map((diff, index) => (
                      <li key={index} className="text-sm flex items-start gap-2">
                        <span className="text-muted-foreground mt-0.5">•</span>
                        <span>{diff}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Compliance */}
              {summary?.compliance_flags && summary.compliance_flags.length > 0 && (
                <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="h-4 w-4 text-destructive" />
                    <span className="text-xs font-semibold text-destructive uppercase tracking-wide">
                      Compliance
                    </span>
                  </div>
                  <ul className="space-y-1">
                    {summary.compliance_flags.map((flag, index) => (
                      <li key={index} className="text-sm text-destructive flex items-start gap-2">
                        <span className="mt-0.5">•</span>
                        <span>{flag}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Knowledge entries */}
              {entries.length > 0 && (
                <div className="p-3 rounded-lg bg-muted/50 border">
                  <div className="flex items-center gap-2 mb-2">
                    <BookOpen className="h-4 w-4 text-muted-foreground" />
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Knowledge ({entries.length})
                    </span>
                  </div>
                  <div className="space-y-2">
                    {entries.slice(0, 4).map((entry) => (
                      <div
                        key={entry.id}
                        className="p-2 rounded bg-background text-xs"
                      >
                        <div className="font-medium text-foreground truncate">{entry.title}</div>
                        <div className="text-muted-foreground truncate mt-0.5">
                          {entry.content}
                        </div>
                      </div>
                    ))}
                    {entries.length > 4 && (
                      <p className="text-xs text-muted-foreground text-center pt-1">
                        +{entries.length - 4} more entries
                      </p>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
