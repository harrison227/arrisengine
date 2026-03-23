import React, { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ClipboardPaste, FileText, Tag } from 'lucide-react';

interface ParsedScript {
  category: string;
  hook: string;
  script: string;
}

interface PasteScriptsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (params: {
    clientId: string;
    title: string;
    scripts: ParsedScript[];
  }) => void;
  isSaving: boolean;
  clients: { id: string; business_name: string }[];
}

/**
 * Parses pasted text into categorized scripts.
 * Recognizes headings as:
 *   - Lines starting with # or ## (markdown)
 *   - Lines in ALL CAPS (at least 3 chars, no lowercase)
 *   - Lines ending with a colon
 * Everything between headings is treated as one script block.
 * Within a category, double blank lines split individual scripts.
 */
function parseScripts(raw: string): ParsedScript[] {
  const lines = raw.split('\n');
  const results: ParsedScript[] = [];
  let currentCategory = 'Uncategorised';
  let currentBlock: string[] = [];

  const isHeading = (line: string): string | null => {
    const trimmed = line.trim();
    if (!trimmed) return null;

    // Markdown headings: # or ##
    const mdMatch = trimmed.match(/^#{1,3}\s+(.+)$/);
    if (mdMatch) return mdMatch[1].trim();

    // ALL CAPS lines (min 3 chars, allow spaces/numbers/punctuation but no lowercase)
    if (trimmed.length >= 3 && /^[^a-z]*$/.test(trimmed) && /[A-Z]{2,}/.test(trimmed)) {
      return trimmed;
    }

    // Lines ending with colon (but not if very long — likely a sentence)
    if (trimmed.endsWith(':') && trimmed.length < 60 && !trimmed.includes('.')) {
      return trimmed.slice(0, -1).trim();
    }

    return null;
  };

  const flushBlock = () => {
    const text = currentBlock.join('\n').trim();
    if (!text) return;

    // Split on double blank lines for multiple scripts in one category
    const chunks = text.split(/\n\s*\n\s*\n/).map(c => c.trim()).filter(Boolean);
    
    // If no triple-newline splits, try double newline but only if chunks look like separate scripts
    const finalChunks = chunks.length === 1 
      ? text.split(/\n\s*\n/).map(c => c.trim()).filter(Boolean)
      : chunks;

    for (const chunk of finalChunks) {
      if (!chunk) continue;
      // First line or first sentence as hook
      const firstLine = chunk.split('\n')[0].trim();
      const hook = firstLine.length > 120 ? firstLine.substring(0, 117) + '...' : firstLine;
      results.push({
        category: currentCategory,
        hook,
        script: chunk,
      });
    }
  };

  for (const line of lines) {
    const heading = isHeading(line);
    if (heading) {
      flushBlock();
      currentCategory = heading;
      currentBlock = [];
    } else {
      currentBlock.push(line);
    }
  }
  flushBlock();

  return results;
}

export function PasteScriptsDialog({
  open,
  onOpenChange,
  onSave,
  isSaving,
  clients,
}: PasteScriptsDialogProps) {
  const [title, setTitle] = useState('');
  const [clientId, setClientId] = useState('');
  const [rawText, setRawText] = useState('');

  const parsed = useMemo(() => parseScripts(rawText), [rawText]);
  const categories = useMemo(() => [...new Set(parsed.map(p => p.category))], [parsed]);

  const handleSave = () => {
    if (!title.trim() || !clientId || parsed.length === 0) return;
    onSave({ clientId, title: title.trim(), scripts: parsed });
  };

  // Reset on open
  React.useEffect(() => {
    if (open) {
      setTitle('');
      setClientId('');
      setRawText('');
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardPaste className="w-5 h-5 text-primary" />
            Paste Scripts
          </DialogTitle>
          <DialogDescription>
            Paste your scripts from Claude or another LLM. Use headings (# Heading, ALL CAPS, or Heading:) to categorise them.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2 flex-1 min-h-0">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="paste-client">Client</Label>
              <Select value={clientId} onValueChange={setClientId}>
                <SelectTrigger id="paste-client">
                  <SelectValue placeholder="Select client" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.business_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="paste-title">Plan Title</Label>
              <Input
                id="paste-title"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="e.g., February Content Pack"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="paste-scripts">Scripts</Label>
            <Textarea
              id="paste-scripts"
              value={rawText}
              onChange={e => setRawText(e.target.value)}
              placeholder={`Paste your scripts here. Use headings to separate categories:\n\n# Educational\nScript about tips and tricks...\n\nScript about industry insights...\n\n# Promotional\nScript about your new product...\n\n# Behind The Scenes\nScript about your team culture...`}
              rows={10}
              className="font-mono text-sm"
            />
          </div>

          {/* Preview */}
          {parsed.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-1.5">
                  <FileText className="w-4 h-4" />
                  Preview — {parsed.length} script{parsed.length !== 1 ? 's' : ''} detected
                </Label>
                <div className="flex gap-1 flex-wrap">
                  {categories.map(cat => (
                    <Badge key={cat} variant="secondary" className="text-xs">
                      <Tag className="w-3 h-3 mr-1" />
                      {cat} ({parsed.filter(p => p.category === cat).length})
                    </Badge>
                  ))}
                </div>
              </div>
              <ScrollArea className="h-40 border rounded-md p-3">
                <div className="space-y-3">
                  {categories.map(cat => (
                    <div key={cat}>
                      <p className="text-xs font-semibold text-primary uppercase tracking-wide mb-1">{cat}</p>
                      {parsed.filter(p => p.category === cat).map((s, i) => (
                        <div key={i} className="text-xs text-muted-foreground pl-3 border-l-2 border-border mb-1.5">
                          {s.hook}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={!title.trim() || !clientId || parsed.length === 0 || isSaving}
          >
            {isSaving ? 'Saving...' : `Save ${parsed.length} Script${parsed.length !== 1 ? 's' : ''}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
