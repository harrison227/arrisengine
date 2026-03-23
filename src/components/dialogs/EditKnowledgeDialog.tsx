import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useKnowledgeEntries } from '@/hooks/useKnowledgeEntries';
import { Tables, Database } from '@/integrations/supabase/types';

type KnowledgeEntry = Tables<'knowledge_entries'>;
type KnowledgeCategory = Database['public']['Enums']['knowledge_category'];

interface EditKnowledgeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entry: KnowledgeEntry;
}

export function EditKnowledgeDialog({ open, onOpenChange, entry }: EditKnowledgeDialogProps) {
  const { updateEntry, isUpdating } = useKnowledgeEntries(entry.client_id);
  
  const [formData, setFormData] = useState({
    title: entry.title,
    content: entry.content,
    category: entry.category,
  });

  useEffect(() => {
    setFormData({
      title: entry.title,
      content: entry.content,
      category: entry.category,
    });
  }, [entry]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateEntry({
      id: entry.id,
      title: formData.title,
      content: formData.content,
      category: formData.category,
    }, {
      onSuccess: () => onOpenChange(false),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Edit Knowledge Entry</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Select
                value={formData.category}
                onValueChange={(value: KnowledgeCategory) => setFormData({ ...formData, category: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="brand">Brand</SelectItem>
                  <SelectItem value="audience">Audience</SelectItem>
                  <SelectItem value="competitors">Competitors</SelectItem>
                  <SelectItem value="offers">Offers</SelectItem>
                  <SelectItem value="past_results">Past Results</SelectItem>
                  <SelectItem value="notes">Notes</SelectItem>
                  <SelectItem value="compliance">Compliance</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="content">Content</Label>
              <Textarea
                id="content"
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                rows={6}
                required
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isUpdating}>
              {isUpdating ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
