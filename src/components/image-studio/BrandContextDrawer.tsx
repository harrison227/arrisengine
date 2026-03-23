import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { BrandContextSidebar } from './BrandContextSidebar';

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

interface BrandContextDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  summary: KnowledgeSummary | null;
  entries: KnowledgeEntry[];
  brandColors?: BrandColors | null;
  isLoading?: boolean;
}

export function BrandContextDrawer({
  isOpen,
  onClose,
  summary,
  entries,
  brandColors,
  isLoading,
}: BrandContextDrawerProps) {
  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="right" className="w-[400px] sm:w-[440px] p-0">
        <SheetHeader className="p-4 border-b">
          <SheetTitle>Brand Context</SheetTitle>
        </SheetHeader>
        <div className="h-[calc(100%-60px)]">
          <BrandContextSidebar
            summary={summary}
            entries={entries}
            brandColors={brandColors}
            isLoading={isLoading}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
