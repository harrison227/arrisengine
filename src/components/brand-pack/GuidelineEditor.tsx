/**
 * Inline editor for a single guideline section. Each section can hold
 * multiple entries (e.g. multiple "do/don't" items). Stored as plain text
 * with newlines preserved — kept simple on purpose; no rich-text MVP.
 */

import { useState } from 'react';
import { Plus, Save, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useClientBrandGuidelines } from '@/hooks/useBrandPack';
import type { ClientBrandGuideline, GuidelineSection } from '@/types/brand-pack';
import { GUIDELINE_SECTION_LABELS } from '@/types/brand-pack';

interface GuidelineEditorProps {
  clientId: string;
  section: GuidelineSection;
  guidelines: ClientBrandGuideline[];
}

export function GuidelineEditor({ clientId, section, guidelines }: GuidelineEditorProps) {
  const { upsertGuideline, deleteGuideline, isMutating } = useClientBrandGuidelines(clientId);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftContent, setDraftContent] = useState('');

  const sectionGuidelines = guidelines.filter((g) => g.section === section);

  const handleAdd = async () => {
    if (!draftContent.trim()) return;
    await upsertGuideline({
      client_id: clientId,
      section,
      title: draftTitle.trim() || null,
      content: draftContent.trim(),
      sort_order: sectionGuidelines.length,
    });
    setDraftTitle('');
    setDraftContent('');
  };

  return (
    <div className="space-y-3">
      <div className="text-sm font-medium">{GUIDELINE_SECTION_LABELS[section]}</div>

      {sectionGuidelines.length === 0 && (
        <div className="text-xs text-muted-foreground italic">No entries yet.</div>
      )}

      {sectionGuidelines.map((g) => (
        <ExistingGuidelineRow key={g.id} guideline={g} clientId={clientId} onDelete={deleteGuideline} />
      ))}

      <div className="rounded-md border border-dashed border-border p-3 space-y-2 bg-muted/20">
        <Input
          placeholder="Title (optional)"
          value={draftTitle}
          onChange={(e) => setDraftTitle(e.target.value)}
        />
        <Textarea
          placeholder="Add a note or rule…"
          rows={3}
          value={draftContent}
          onChange={(e) => setDraftContent(e.target.value)}
        />
        <div className="flex justify-end">
          <Button size="sm" onClick={handleAdd} disabled={!draftContent.trim() || isMutating}>
            <Plus className="h-4 w-4 mr-1.5" />
            Add
          </Button>
        </div>
      </div>
    </div>
  );
}

interface ExistingRowProps {
  guideline: ClientBrandGuideline;
  clientId: string;
  onDelete: (id: string) => void;
}

function ExistingGuidelineRow({ guideline, clientId, onDelete }: ExistingRowProps) {
  const { upsertGuideline, isMutating } = useClientBrandGuidelines(clientId);
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState(guideline.title ?? '');
  const [content, setContent] = useState(guideline.content);

  const handleSave = async () => {
    await upsertGuideline({
      ...guideline,
      title: title.trim() || null,
      content,
    });
    setIsEditing(false);
  };

  if (!isEditing) {
    return (
      <div className="rounded-md border border-border p-3 group">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            {guideline.title && <div className="font-medium text-sm">{guideline.title}</div>}
            <div className="text-sm text-muted-foreground whitespace-pre-wrap">{guideline.content}</div>
          </div>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button variant="ghost" size="sm" onClick={() => setIsEditing(true)}>Edit</Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => onDelete(guideline.id)}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-primary/40 p-3 space-y-2 bg-muted/20">
      <div className="space-y-2">
        <Label className="text-xs">Title</Label>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label className="text-xs">Content</Label>
        <Textarea rows={4} value={content} onChange={(e) => setContent(e.target.value)} />
      </div>
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={() => setIsEditing(false)} disabled={isMutating}>
          Cancel
        </Button>
        <Button size="sm" onClick={handleSave} disabled={isMutating}>
          <Save className="h-4 w-4 mr-1.5" />
          Save
        </Button>
      </div>
    </div>
  );
}
