import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCreativeConcepts, CreativeConcept } from '@/hooks/useCreativeConcepts';

const conceptSchema = z.object({
  hook: z.string().min(1, 'Hook is required'),
  description: z.string().min(1, 'Description is required'),
  target_emotion: z.string().min(1, 'Target emotion is required'),
  format: z.string().min(1, 'Format is required'),
  platform: z.string().min(1, 'Platform is required'),
  cta_options: z.string().optional(),
  target_audiences: z.string().optional(),
  performance_notes: z.string().optional(),
});

type ConceptFormData = z.infer<typeof conceptSchema>;

interface CreativeConceptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
  concept?: CreativeConcept;
}

export function CreativeConceptDialog({ open, onOpenChange, clientId, concept }: CreativeConceptDialogProps) {
  const { createConcept, updateConcept, isCreatingConcept, isUpdatingConcept } = useCreativeConcepts(clientId);
  const isEditing = !!concept;

  const form = useForm<ConceptFormData>({
    resolver: zodResolver(conceptSchema),
    defaultValues: {
      hook: concept?.hook || '',
      description: concept?.description || '',
      target_emotion: concept?.target_emotion || 'trust',
      format: concept?.format || 'video',
      platform: concept?.platform || 'meta',
      cta_options: concept?.cta_options?.join(', ') || '',
      target_audiences: concept?.target_audiences?.join(', ') || '',
      performance_notes: concept?.performance_notes || '',
    },
  });

  const onSubmit = (data: ConceptFormData) => {
    const ctaOptions = data.cta_options?.split(',').map(s => s.trim()).filter(Boolean) || [];
    const audiences = data.target_audiences?.split(',').map(s => s.trim()).filter(Boolean) || [];

    if (isEditing) {
      updateConcept({
        id: concept.id,
        hook: data.hook,
        description: data.description,
        target_emotion: data.target_emotion,
        format: data.format,
        platform: data.platform,
        cta_options: ctaOptions,
        target_audiences: audiences,
        performance_notes: data.performance_notes || null,
      });
    } else {
      createConcept({
        client_id: clientId,
        hook: data.hook,
        description: data.description,
        target_emotion: data.target_emotion,
        format: data.format,
        platform: data.platform,
        cta_options: ctaOptions,
        target_audiences: audiences,
        performance_notes: data.performance_notes || null,
      });
    }
    onOpenChange(false);
    form.reset();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Creative Concept' : 'New Creative Concept'}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="hook"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Hook *</FormLabel>
                  <FormControl>
                    <Input placeholder="The attention-grabbing headline" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description *</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Explain the concept and angle..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="target_emotion"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Emotion *</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="trust">🤝 Trust</SelectItem>
                        <SelectItem value="excitement">🎉 Excitement</SelectItem>
                        <SelectItem value="curiosity">🤔 Curiosity</SelectItem>
                        <SelectItem value="urgency">⚡ Urgency</SelectItem>
                        <SelectItem value="fear">😰 Fear</SelectItem>
                        <SelectItem value="desire">💫 Desire</SelectItem>
                        <SelectItem value="belonging">🏠 Belonging</SelectItem>
                        <SelectItem value="pride">🏆 Pride</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="format"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Format *</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="video">Video</SelectItem>
                        <SelectItem value="image">Image</SelectItem>
                        <SelectItem value="carousel">Carousel</SelectItem>
                        <SelectItem value="story">Story</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="platform"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Platform *</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="meta">Meta</SelectItem>
                        <SelectItem value="tiktok">TikTok</SelectItem>
                        <SelectItem value="google">Google</SelectItem>
                        <SelectItem value="linkedin">LinkedIn</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="cta_options"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>CTA Options</FormLabel>
                  <FormControl>
                    <Input placeholder="Shop Now, Learn More (comma separated)" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="target_audiences"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Target Audiences</FormLabel>
                  <FormControl>
                    <Input placeholder="Small business owners, marketers (comma separated)" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="performance_notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Performance Notes</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Notes on what's working..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isCreatingConcept || isUpdatingConcept}>
                {isEditing ? 'Save Changes' : 'Create Concept'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
