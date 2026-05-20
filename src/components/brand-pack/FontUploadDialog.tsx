/**
 * Add-a-font dialog. Two paths:
 *   - Upload a font file (woff2 / woff / otf / ttf).
 *   - Reference a Google / Adobe font by name + URL (no file).
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useClientBrandFonts } from '@/hooks/useBrandPack';
import { useToast } from '@/hooks/use-toast';
import { FONT_ROLE_LABELS, type FontRole, type FontSource } from '@/types/brand-pack';

interface FontUploadDialogProps {
  clientId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ACCEPTED_EXTS = ['woff2', 'woff', 'otf', 'ttf'];
const MAX_BYTES = 5 * 1024 * 1024;

export function FontUploadDialog({ clientId, open, onOpenChange }: FontUploadDialogProps) {
  const { toast } = useToast();
  const { upsertFont } = useClientBrandFonts(clientId);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState<'upload' | 'reference'>('upload');

  const [file, setFile] = useState<File | null>(null);
  const [familyName, setFamilyName] = useState('');
  const [role, setRole] = useState<FontRole>('body');
  const [weight, setWeight] = useState('400');
  const [style, setStyle] = useState<'normal' | 'italic'>('normal');
  const [fallbackStack, setFallbackStack] = useState('sans-serif');
  const [referenceSource, setReferenceSource] = useState<FontSource>('google_fonts');
  const [referenceUrl, setReferenceUrl] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const reset = () => {
    setFile(null);
    setFamilyName('');
    setRole('body');
    setWeight('400');
    setStyle('normal');
    setFallbackStack('sans-serif');
    setReferenceSource('google_fonts');
    setReferenceUrl('');
    setTab('upload');
  };

  const handleClose = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const handleFile = (selected: File | null) => {
    if (!selected) return;
    const ext = selected.name.split('.').pop()?.toLowerCase() ?? '';
    if (!ACCEPTED_EXTS.includes(ext)) {
      toast({ title: 'Unsupported file', description: 'Use woff2, woff, otf, or ttf.', variant: 'destructive' });
      return;
    }
    if (selected.size > MAX_BYTES) {
      toast({ title: 'File too large', description: 'Max 5MB.', variant: 'destructive' });
      return;
    }
    setFile(selected);
    if (!familyName) {
      // Best-guess family from filename: "Inter-Bold.woff2" → "Inter".
      const stem = selected.name.replace(/\.[^.]+$/, '').split(/[-_]/)[0];
      setFamilyName(stem);
    }
  };

  const handleSubmit = async () => {
    if (!familyName.trim()) {
      toast({ title: 'Family name is required', variant: 'destructive' });
      return;
    }

    setIsSaving(true);
    try {
      let fileUrl: string | null = null;
      let fileFormat: string | null = null;

      if (tab === 'upload') {
        if (!file) {
          toast({ title: 'Pick a file or switch to Reference', variant: 'destructive' });
          setIsSaving(false);
          return;
        }
        fileFormat = file.name.split('.').pop()?.toLowerCase() ?? null;
        const path = `${clientId}/brand/fonts/${crypto.randomUUID()}.${fileFormat}`;
        const { error: uploadError } = await supabase.storage.from('client-assets').upload(path, file, { upsert: false, contentType: file.type || 'font/woff2' });
        if (uploadError) throw uploadError;
        const { data: { publicUrl } } = supabase.storage.from('client-assets').getPublicUrl(path);
        fileUrl = publicUrl;
      }

      await upsertFont({
        client_id: clientId,
        family_name: familyName.trim(),
        role,
        weight,
        style,
        fallback_stack: fallbackStack || null,
        source: tab === 'upload' ? 'self_hosted' : referenceSource,
        source_url: tab === 'reference' ? referenceUrl || null : null,
        file_url: fileUrl,
        file_format: fileFormat,
      });

      toast({ title: 'Font saved' });
      handleClose(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      toast({ title: 'Save failed', description: message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add font</DialogTitle>
          <DialogDescription>Upload a real font file, or just reference a Google / Adobe font.</DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as 'upload' | 'reference')}>
          <TabsList className="grid grid-cols-2">
            <TabsTrigger value="upload">Upload file</TabsTrigger>
            <TabsTrigger value="reference">Reference</TabsTrigger>
          </TabsList>

          <TabsContent value="upload" className="space-y-4 pt-4">
            <input
              ref={fileInputRef}
              type="file"
              accept=".woff2,.woff,.otf,.ttf"
              className="hidden"
              onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
            />
            <button
              type="button"
              className="w-full rounded-lg border-2 border-dashed border-border hover:border-primary/50 bg-muted/30 h-24 flex flex-col items-center justify-center gap-1 text-muted-foreground"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-5 w-5" />
              <span className="text-sm">{file ? file.name : 'Click to choose a font file'}</span>
              <span className="text-xs">woff2, woff, otf, ttf (max 5MB)</span>
            </button>
          </TabsContent>

          <TabsContent value="reference" className="space-y-3 pt-4">
            <div className="space-y-2">
              <Label>Source</Label>
              <Select value={referenceSource} onValueChange={(v) => setReferenceSource(v as FontSource)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="google_fonts">Google Fonts</SelectItem>
                  <SelectItem value="adobe_fonts">Adobe Fonts</SelectItem>
                  <SelectItem value="system">System default</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="font-source-url">Source URL (optional)</Label>
              <Input
                id="font-source-url"
                placeholder="https://fonts.google.com/specimen/Inter"
                value={referenceUrl}
                onChange={(e) => setReferenceUrl(e.target.value)}
              />
            </div>
          </TabsContent>
        </Tabs>

        <div className="space-y-3 mt-2">
          <div className="space-y-2">
            <Label htmlFor="font-family">Family name</Label>
            <Input id="font-family" value={familyName} onChange={(e) => setFamilyName(e.target.value)} placeholder="Inter" />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-2 col-span-1">
              <Label>Role</Label>
              <Select value={role} onValueChange={(v) => setRole(v as FontRole)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(FONT_ROLE_LABELS) as FontRole[]).map((r) => (
                    <SelectItem key={r} value={r}>{FONT_ROLE_LABELS[r]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 col-span-1">
              <Label htmlFor="font-weight">Weight</Label>
              <Input id="font-weight" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="400" />
            </div>
            <div className="space-y-2 col-span-1">
              <Label>Style</Label>
              <Select value={style} onValueChange={(v) => setStyle(v as 'normal' | 'italic')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="italic">Italic</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="font-fallback">Fallback stack</Label>
            <Input
              id="font-fallback"
              placeholder="-apple-system, BlinkMacSystemFont, sans-serif"
              value={fallbackStack}
              onChange={(e) => setFallbackStack(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => handleClose(false)} disabled={isSaving}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={isSaving}>
            {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save font
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
