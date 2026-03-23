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
import { useContentPieces, ContentPiece } from '@/hooks/useContentPieces';
import { useContentPlans } from '@/hooks/useContentPlans';

const contentPieceSchema = z.object({
  concept: z.string().min(1, 'Concept is required'),
  hook: z.string().optional(),
  content_type: z.enum(['video', 'image', 'carousel', 'story', 'reel', 'ugc']),
  platform: z.string().min(1, 'Platform is required'),
  script: z.string().optional(),
  shot_notes: z.string().optional(),
  cta: z.string().optional(),
  target_duration: z.string().optional(),
  talent_notes: z.string().optional(),
  b_roll_needed: z.string().optional(),
  edit_notes: z.string().optional(),
});

type ContentPieceFormData = z.infer<typeof contentPieceSchema>;

interface ContentPieceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filmingDayId: string;
  clientId: string;
  piece?: ContentPiece;
}

export function ContentPieceDialog({ 
  open, 
  onOpenChange, 
  filmingDayId, 
  clientId,
  piece 
}: ContentPieceDialogProps) {
  const { contentPlans } = useContentPlans(clientId);
  const { createPiece, updatePiece, isCreating, isUpdating } = useContentPieces(undefined, filmingDayId);
  const isEditing = !!piece;

  // Get first content plan for this client (or create one if needed)
  const defaultContentPlanId = contentPlans[0]?.id;

  const form = useForm<ContentPieceFormData>({
    resolver: zodResolver(contentPieceSchema),
    defaultValues: {
      concept: piece?.concept || '',
      hook: piece?.hook || '',
      content_type: piece?.content_type || 'video',
      platform: piece?.platform || 'Instagram',
      script: piece?.script || '',
      shot_notes: piece?.shot_notes || '',
      cta: piece?.cta || '',
      target_duration: piece?.target_duration?.toString() || '',
      talent_notes: piece?.talent_notes || '',
      b_roll_needed: piece?.b_roll_needed?.join(', ') || '',
      edit_notes: piece?.edit_notes || '',
    },
  });

  const onSubmit = (data: ContentPieceFormData) => {
    const bRoll = data.b_roll_needed
      ? data.b_roll_needed.split(',').map(s => s.trim()).filter(Boolean)
      : [];

    if (isEditing) {
      updatePiece({
        id: piece.id,
        concept: data.concept,
        hook: data.hook || null,
        content_type: data.content_type,
        platform: data.platform,
        script: data.script || null,
        shot_notes: data.shot_notes || null,
        cta: data.cta || null,
        target_duration: data.target_duration ? parseInt(data.target_duration) : null,
        talent_notes: data.talent_notes || null,
        b_roll_needed: bRoll,
        edit_notes: data.edit_notes || null,
      });
    } else {
      if (!defaultContentPlanId) {
        return;
      }
      createPiece({
        content_plan_id: defaultContentPlanId,
        filming_day_id: filmingDayId,
        concept: data.concept,
        hook: data.hook || null,
        content_type: data.content_type,
        platform: data.platform,
        script: data.script || null,
        shot_notes: data.shot_notes || null,
        cta: data.cta || null,
        target_duration: data.target_duration ? parseInt(data.target_duration) : null,
        talent_notes: data.talent_notes || null,
        b_roll_needed: bRoll,
        edit_notes: data.edit_notes || null,
      });
    }
    onOpenChange(false);
    form.reset();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Content Piece' : 'Add Content Piece'}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="concept"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Concept *</FormLabel>
                    <FormControl>
                      <Input placeholder="What is this piece about?" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="hook"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Hook</FormLabel>
                    <FormControl>
                      <Input placeholder="The opening line/hook" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="content_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Content Type *</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="video">Video</SelectItem>
                        <SelectItem value="image">Image</SelectItem>
                        <SelectItem value="carousel">Carousel</SelectItem>
                        <SelectItem value="story">Story</SelectItem>
                        <SelectItem value="reel">Reel</SelectItem>
                        <SelectItem value="ugc">UGC</SelectItem>
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
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Instagram">Instagram</SelectItem>
                        <SelectItem value="TikTok">TikTok</SelectItem>
                        <SelectItem value="YouTube">YouTube</SelectItem>
                        <SelectItem value="Facebook">Facebook</SelectItem>
                        <SelectItem value="LinkedIn">LinkedIn</SelectItem>
                        <SelectItem value="Twitter">Twitter</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="cta"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Call to Action</FormLabel>
                    <FormControl>
                      <Input placeholder="What should viewers do?" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="target_duration"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Target Duration (seconds)</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="e.g., 30" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="script"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Script</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Write the full script here..." 
                      className="min-h-[100px]"
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="shot_notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Shot Notes</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Camera angles, framing, locations..." 
                      className="min-h-[80px]"
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="talent_notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Talent Notes</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Who appears, wardrobe, energy/tone..." 
                      className="min-h-[80px]"
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="b_roll_needed"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>B-Roll Needed</FormLabel>
                  <FormControl>
                    <Input placeholder="Product shots, office, etc. (comma separated)" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="edit_notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Edit Notes</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Post-production notes, music, graphics..." 
                      className="min-h-[80px]"
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isCreating || isUpdating}>
                {isEditing ? 'Save Changes' : 'Add Piece'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
