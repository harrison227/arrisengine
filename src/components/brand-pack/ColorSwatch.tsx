/**
 * Color swatch with click-to-copy in multiple formats (hex, RGB, HSL).
 *
 * The big colored block is the swatch; below it sits a small button row
 * that copies the value to clipboard in the chosen format.
 */

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ColorSwatchProps {
  label: string;
  hex: string | null;
  size?: 'sm' | 'md' | 'lg';
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const m = /^#?([a-f0-9]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const v = parseInt(m[1], 16);
  return { r: (v >> 16) & 255, g: (v >> 8) & 255, b: v & 255 };
}

function hexToHsl(hex: string): { h: number; s: number; l: number } | null {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l: Math.round(l * 100) };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0));
  else if (max === g) h = ((b - r) / d + 2);
  else h = ((r - g) / d + 4);
  h /= 6;
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

const SIZE_CLASSES: Record<NonNullable<ColorSwatchProps['size']>, string> = {
  sm: 'h-16',
  md: 'h-24',
  lg: 'h-32',
};

export function ColorSwatch({ label, hex, size = 'md' }: ColorSwatchProps) {
  const [copied, setCopied] = useState<'hex' | 'rgb' | 'hsl' | null>(null);

  if (!hex) {
    return (
      <div className="rounded-lg border border-dashed border-border p-4 bg-muted/20">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="mt-2 text-sm text-muted-foreground">Not set</div>
      </div>
    );
  }

  const rgb = hexToRgb(hex);
  const hsl = hexToHsl(hex);

  const copy = async (format: 'hex' | 'rgb' | 'hsl', value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(format);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      // Clipboard blocked — silently ignore.
    }
  };

  return (
    <div className="rounded-lg overflow-hidden border border-border">
      <div className={cn(SIZE_CLASSES[size], 'w-full')} style={{ backgroundColor: hex }} />
      <div className="p-3 space-y-2 bg-card">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="flex flex-wrap gap-1.5">
          <CopyButton value={hex.toUpperCase()} active={copied === 'hex'} onClick={() => copy('hex', hex.toUpperCase())} />
          {rgb && (
            <CopyButton
              value={`rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`}
              active={copied === 'rgb'}
              onClick={() => copy('rgb', `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`)}
            />
          )}
          {hsl && (
            <CopyButton
              value={`hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`}
              active={copied === 'hsl'}
              onClick={() => copy('hsl', `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`)}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function CopyButton({ value, active, onClick }: { value: string; active: boolean; onClick: () => void }) {
  return (
    <Button
      variant="outline"
      size="sm"
      className="h-7 px-2 font-mono text-[11px]"
      onClick={onClick}
    >
      {active ? <Check className="h-3 w-3 mr-1" /> : <Copy className="h-3 w-3 mr-1" />}
      {value}
    </Button>
  );
}
