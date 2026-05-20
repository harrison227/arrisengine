/**
 * Upload-a-logo dialog. Splits the file picker from the metadata form so we
 * can require a label + variant + background treatment alongside the file.
 */

import { useRef, useState } from 'react';
import { Loader2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useClientLogos } from '@/hooks/useBrandPack';
import { useToast } from '@/hooks/use-toast';
import {
  LOGO_BACKGROUND_LABELS,
  LOGO_VARIANT_LABELS,
  type LogoBackground,
  type LogoVariant,
} from '@/types/brand-pack';

interface LogoUploadDialogProps {
  clientId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isFirstLogo?: boolean;
}

const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml', 'image/webp'];
const MAX_BYTES = 10 * 1024 * 1024;

export function LogoUploadDialog({ clientId, open, onOpenChange, isFirstLogo }: LogoUploadDialogProps) {
  const { toast } = useToast();
  const { upsertLogo } = useClientLogos(clientId);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [label, setLabel] = useState('Primary');
  const [variant, setVariant] = useState<LogoVariant>('primary');
  const [background, setBackground] = useState<LogoBackground>('transparent');
  const [notes, setNotes] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  const reset = () => {
    setFile(null);
    setPreviewUrl(null);
    setLabel('Primary');
    setVariant('primary');
    setBackground('transparent');
    setNotes('');
  };

  const handleClose = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const handleFile = (selected: File | null) => {
    if (!selected) return;
    if (!ACCEPTED_TYPES.includes(selected.type)) {
      toast({ title: 'Unsupported file', description: 'PNG, JPG, SVG, or WebP only.', variant: 'destructive' });
      return;
    }
    if (selected.size > MAX_BYTES) {
      toast({ title: 'File too large', description: 'Max 10MB.', variant: 'destructive' });
      return;
    }
    setFile(selected);
    setPreviewUrl(URL.createObjectURL(selected));
  };

  const handleSubmit = async () => {
    if (!file) return;
    setIsUploading(true);
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() ?? 'png';
      const path = `${clientId}/brand/logos/${crypto.randomUUID()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from('client-assets').upload(path, file, { upsert: false });
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('client-assets').getPublicUrl(path);

      // Probe image dimensions for nicer downstream rendering.
      const dims = await readImageDimensions(file);

      await upsertLogo({
        client_id: clientId,
        label: label.trim() || 'Primary',
        variant,
        background_treatment: background,
        file_url: publicUrl,
        file_format: ext,
        file_size_bytes: file.size,
        width_px: dims?.width ?? null,
        height_px: dims?.height ?? null,
        notes: notes.trim() || null,
        is_primary: Boolean(isFirstLogo),
      });

      toast({ title: 'Logo uploaded' });
      handleClose(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      toast({ title: 'Upload failed', description: message, variant: 'destructive' });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add logo</DialogTitle>
          <DialogDescription>Upload a logo file and tag it with the variant + intended background.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_TYPES.join(',')}
            className="hidden"
            onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
          />

          {previewUrl ? (
            <button
              type="button"
              className="w-full rounded-lg border border-border bg-muted/30 h-40 flex items-center justify-center hover:bg-muted/40"
              onClick={() => fileInputRef.current?.click()}
            >
              <img src={previewUrl} alt="Logo preview" className="max-w-[60%] max-h-[80%] object-contain" />
            </button>
          ) : (
            <button
              type="button"
              className="w-full rounded-lg border-2 border-dashed border-border hover:border-primary/50 bg-muted/30 h-40 flex flex-col items-center justify-center gap-2 text-muted-foreground"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-6 w-6" />
              <span className="text-sm">Click to choose a file</span>
              <span className="text-xs">PNG, JPG, SVG or WebP (max 10MB)</span>
            </button>
          )}

          <div className="space-y-2">
            <Label htmlFor="logo-label">Label</Label>
            <Input id="logo-label" value={label} onChange={(e) => setLabel(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Variant</Label>
              <Select value={variant} onValueChange={(v) => setVariant(v as LogoVariant)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(LOGO_VARIANT_LABELS) as LogoVariant[]).map((v) => (
                    <SelectItem key={v} value={v}>{LOGO_VARIANT_LABELS[v]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Background</Label>
              <Select value={background} onValueChange={(v) => setBackground(v as LogoBackground)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(LOGO_BACKGROUND_LABELS) as LogoBackground[]).map((v) => (
                    <SelectItem key={v} value={v}>{LOGO_BACKGROUND_LABELS[v]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="logo-notes">Notes (optional)</Label>
            <Textarea
              id="logo-notes"
              placeholder="Clear space, minimum size, do/don't…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => handleClose(false)} disabled={isUploading}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!file || isUploading}>
            {isUploading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save logo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function readImageDimensions(file: File): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    if (file.type === 'image/svg+xml') return resolve(null);
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    img.src = url;
  });
}
