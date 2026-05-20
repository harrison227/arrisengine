/**
 * Font preview card. Renders a sample line in the actual font (loaded via
 * @font-face in brandFontLoader.ts) with metadata + download + delete.
 */

import { Download, Trash2, Type } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { ClientBrandFont } from '@/types/brand-pack';
import { FONT_ROLE_LABELS } from '@/types/brand-pack';
import { fontFamilyStack } from '@/lib/brandFontLoader';

interface FontCardProps {
  font: ClientBrandFont;
  onDelete?: (id: string) => void;
  readOnly?: boolean;
}

export function FontCard({ font, onDelete, readOnly }: FontCardProps) {
  const stack = fontFamilyStack(font);
  const sampleText = font.role === 'heading'
    ? 'The quick brown fox'
    : font.role === 'display'
      ? 'Big Bold Display'
      : 'The quick brown fox jumps over the lazy dog 0123456789';

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="secondary" className="text-xs">{FONT_ROLE_LABELS[font.role]}</Badge>
            {font.weight !== '400' && <Badge variant="outline" className="text-xs">{font.weight}</Badge>}
            {font.style === 'italic' && <Badge variant="outline" className="text-xs">italic</Badge>}
            {font.source !== 'self_hosted' && (
              <Badge variant="outline" className="text-xs">{font.source.replace('_', ' ')}</Badge>
            )}
          </div>
          <div className="mt-1 font-medium text-sm">{font.family_name}</div>
          {font.fallback_stack && (
            <div className="text-xs text-muted-foreground font-mono">{font.fallback_stack}</div>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {font.file_url && (
            <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
              <a href={font.file_url} download={font.family_name} target="_blank" rel="noreferrer">
                <Download className="h-3.5 w-3.5" />
              </a>
            </Button>
          )}
          {!readOnly && onDelete && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-destructive hover:text-destructive"
              onClick={() => onDelete(font.id)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>

      <div
        className="text-2xl leading-snug truncate"
        style={{ fontFamily: stack, fontWeight: Number(font.weight) || 400, fontStyle: font.style }}
      >
        {sampleText}
      </div>

      {!font.file_url && font.source === 'self_hosted' && (
        <div className="text-xs text-amber-600 flex items-center gap-1">
          <Type className="h-3 w-3" />
          No font file uploaded — preview falls back to system default.
        </div>
      )}
    </div>
  );
}
