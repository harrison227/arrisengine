import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Loader2 } from 'lucide-react';
import { useKnowledgeEntries } from '@/hooks/useKnowledgeEntries';
import { Database } from '@/integrations/supabase/types';

type KnowledgeCategory = Database['public']['Enums']['knowledge_category'];

const knowledgeSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  content: z.string().min(1, 'Content is required'),
  category: z.string().min(1, 'Category is required'),
});

type KnowledgeFormData = z.infer<typeof knowledgeSchema>;

interface AddKnowledgeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
}

const categories: { value: KnowledgeCategory; label: string }[] = [
  { value: 'brand', label: 'Brand' },
  { value: 'audience', label: 'Audience' },
  { value: 'competitors', label: 'Competitors' },
  { value: 'offers', label: 'Offers' },
  { value: 'past_results', label: 'Past Results' },
  { value: 'notes', label: 'Notes' },
  { value: 'compliance', label: 'Compliance' },
];

export function AddKnowledgeDialog({ open, onOpenChange, clientId }: AddKnowledgeDialogProps) {
  const { createEntry, isCreating } = useKnowledgeEntries(clientId);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  
  const { register, handleSubmit, formState: { errors }, reset, setValue } = useForm<KnowledgeFormData>({
    resolver: zodResolver(knowledgeSchema),
  });

  const onSubmit = (data: KnowledgeFormData) => {
    createEntry({
      client_id: clientId,
      title: data.title,
      content: data.content,
      category: data.category as KnowledgeCategory,
    }, {
      onSuccess: () => {
        reset();
        setSelectedCategory('');
        onOpenChange(false);
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add Knowledge Entry</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              {...register('title')}
              className="bg-secondary border-border"
            />
            {errors.title && (
              <p className="text-sm text-destructive">{errors.title.message}</p>
            )}
          </div>
          
          <div className="space-y-2">
            <Label>Category *</Label>
            <Select 
              value={selectedCategory} 
              onValueChange={(value) => {
                setSelectedCategory(value);
                setValue('category', value);
              }}
            >
              <SelectTrigger className="bg-secondary border-border">
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((cat) => (
                  <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.category && (
              <p className="text-sm text-destructive">{errors.category.message}</p>
            )}
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="content">Content *</Label>
            <Textarea
              id="content"
              {...register('content')}
              className="bg-secondary border-border min-h-[150px]"
              placeholder="Enter knowledge entry content..."
            />
            {errors.content && (
              <p className="text-sm text-destructive">{errors.content.message}</p>
            )}
          </div>
          
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isCreating}>
              {isCreating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                'Add Entry'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
