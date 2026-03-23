import { useState } from 'react';
import { Sparkles, Check, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { SuggestedPalette } from '@/lib/colorExtractor';

interface ExtractedPalettePreviewProps {
  extractedColors: string[];
  suggestedPalette: SuggestedPalette;
  onApplyAll: (palette: SuggestedPalette) => void;
  onApplyColor: (slot: keyof SuggestedPalette, color: string) => void;
}

const SLOT_LABELS: Record<keyof SuggestedPalette, string> = {
  primary: 'Primary',
  secondary: 'Secondary',
  accent: 'Accent',
  background: 'Background',
  text: 'Text',
};

export function ExtractedPalettePreview({
  extractedColors,
  suggestedPalette,
  onApplyAll,
  onApplyColor,
}: ExtractedPalettePreviewProps) {
  const [appliedSlots, setAppliedSlots] = useState<Set<keyof SuggestedPalette>>(new Set());

  const handleApplyColor = (slot: keyof SuggestedPalette, color: string) => {
    onApplyColor(slot, color);
    setAppliedSlots(prev => new Set([...prev, slot]));
  };

  const handleApplyAll = () => {
    onApplyAll(suggestedPalette);
    setAppliedSlots(new Set(['primary', 'secondary', 'accent', 'background', 'text']));
  };

  return (
    <div className="space-y-4 p-4 rounded-lg border border-border bg-muted/20">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">Extracted Colors</span>
        </div>
        <Button size="sm" onClick={handleApplyAll}>
          Apply All
        </Button>
      </div>

      {/* Raw extracted colors */}
      <div className="flex gap-2">
        {extractedColors.map((color, index) => (
          <DropdownMenu key={index}>
            <DropdownMenuTrigger asChild>
              <button
                className="w-10 h-10 rounded-lg border border-border shadow-sm hover:scale-105 transition-transform cursor-pointer"
                style={{ backgroundColor: color }}
                title={color}
              />
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              {(Object.keys(SLOT_LABELS) as Array<keyof SuggestedPalette>).map(slot => (
                <DropdownMenuItem 
                  key={slot}
                  onClick={() => handleApplyColor(slot, color)}
                >
                  Apply as {SLOT_LABELS[slot]}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ))}
      </div>

      {/* Suggested palette mapping */}
      <div className="space-y-2">
        <span className="text-xs text-muted-foreground">Suggested assignment:</span>
        <div className="flex flex-wrap gap-3">
          {(Object.entries(suggestedPalette) as Array<[keyof SuggestedPalette, string]>).map(([slot, color]) => (
            <div key={slot} className="flex flex-col items-center gap-1">
              <button
                onClick={() => handleApplyColor(slot, color)}
                className="relative w-12 h-12 rounded-lg border border-border shadow-sm hover:scale-105 transition-transform cursor-pointer"
                style={{ backgroundColor: color }}
                title={`${SLOT_LABELS[slot]}: ${color}`}
              >
                {appliedSlots.has(slot) && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-lg">
                    <Check className="h-5 w-5 text-white" />
                  </div>
                )}
              </button>
              <span className="text-xs text-muted-foreground">{SLOT_LABELS[slot]}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
