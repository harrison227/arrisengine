import { cn } from '@/lib/utils';

interface BrandPreviewProps {
  primaryColor: string | null;
  secondaryColor: string | null;
  accentColor: string | null;
  backgroundColor: string | null;
  textColor: string | null;
  fonts: string[] | null;
  className?: string;
}

export function BrandPreview({
  primaryColor,
  secondaryColor,
  accentColor,
  backgroundColor,
  textColor,
  fonts,
  className,
}: BrandPreviewProps) {
  const hasColors = primaryColor || secondaryColor || accentColor || backgroundColor || textColor;
  const fontFamily = fonts && fonts.length > 0 ? fonts.join(', ') : undefined;

  if (!hasColors) {
    return (
      <div className={cn('p-6 rounded-xl border border-dashed border-border bg-muted/30 text-center', className)}>
        <p className="text-sm text-muted-foreground">
          Add brand colors to see a preview
        </p>
      </div>
    );
  }

  return (
    <div
      className={cn('rounded-xl border border-border overflow-hidden', className)}
      style={{ backgroundColor: backgroundColor || '#ffffff' }}
    >
      {/* Header */}
      <div
        className="p-4"
        style={{ backgroundColor: primaryColor || '#3b82f6' }}
      >
        <h3
          className="text-lg font-semibold"
          style={{ 
            color: '#ffffff',
            fontFamily,
          }}
        >
          Brand Preview
        </h3>
      </div>

      {/* Content */}
      <div className="p-6 space-y-4">
        <p
          style={{ 
            color: textColor || '#1f2937',
            fontFamily,
          }}
        >
          This is how your brand colors will appear in generated content.
        </p>

        {/* Color Swatches Row */}
        <div className="flex items-center gap-2">
          {primaryColor && (
            <div className="flex items-center gap-2">
              <div
                className="w-8 h-8 rounded-full border border-border"
                style={{ backgroundColor: primaryColor }}
                title="Primary"
              />
            </div>
          )}
          {secondaryColor && (
            <div
              className="w-8 h-8 rounded-full border border-border"
              style={{ backgroundColor: secondaryColor }}
              title="Secondary"
            />
          )}
          {accentColor && (
            <div
              className="w-8 h-8 rounded-full border border-border"
              style={{ backgroundColor: accentColor }}
              title="Accent"
            />
          )}
        </div>

        {/* Sample Button */}
        <button
          className="px-4 py-2 rounded-lg font-medium transition-opacity hover:opacity-90"
          style={{
            backgroundColor: accentColor || primaryColor || '#3b82f6',
            color: '#ffffff',
            fontFamily,
          }}
        >
          Sample Button
        </button>

        {/* Secondary Element */}
        {secondaryColor && (
          <div
            className="p-3 rounded-lg"
            style={{ backgroundColor: secondaryColor }}
          >
            <p className="text-sm" style={{ color: '#ffffff' }}>
              Secondary color highlight
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
