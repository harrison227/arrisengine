import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { StyleSetupCard, type LogoPlacement } from './StyleSetupCard';

interface StyleReferencesDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  referenceImages: string[];
  onReferenceImagesChange: (images: string[]) => void;
  styleNotes: string;
  onStyleNotesChange: (notes: string) => void;
  brandLogoUrl?: string | null;
  includeLogo: boolean;
  onIncludeLogoChange: (include: boolean) => void;
  logoPlacement: LogoPlacement;
  onLogoPlacementChange: (placement: LogoPlacement) => void;
  clientId?: string;
  selectedSavedImageIds: string[];
  onSelectedSavedImageIdsChange: (ids: string[]) => void;
}

export function StyleReferencesDrawer({
  isOpen,
  onClose,
  referenceImages,
  onReferenceImagesChange,
  styleNotes,
  onStyleNotesChange,
  brandLogoUrl,
  includeLogo,
  onIncludeLogoChange,
  logoPlacement,
  onLogoPlacementChange,
  clientId,
  selectedSavedImageIds,
  onSelectedSavedImageIdsChange,
}: StyleReferencesDrawerProps) {
  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="right" className="w-[400px] sm:w-[440px] p-0">
        <SheetHeader className="p-4 border-b">
          <SheetTitle>Style & References</SheetTitle>
        </SheetHeader>
        <div className="p-4 overflow-auto h-[calc(100%-60px)]">
          <StyleSetupCard
            referenceImages={referenceImages}
            onReferenceImagesChange={onReferenceImagesChange}
            styleNotes={styleNotes}
            onStyleNotesChange={onStyleNotesChange}
            brandLogoUrl={brandLogoUrl}
            includeLogo={includeLogo}
            onIncludeLogoChange={onIncludeLogoChange}
            logoPlacement={logoPlacement}
            onLogoPlacementChange={onLogoPlacementChange}
            clientId={clientId}
            selectedSavedImageIds={selectedSavedImageIds}
            onSelectedSavedImageIdsChange={onSelectedSavedImageIdsChange}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
