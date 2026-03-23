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
import { useContentPlans } from '@/hooks/useContentPlans';
import { useClients } from '@/hooks/useClients';

const contentPlanSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  client_id: z.string().min(1, 'Client is required'),
  filming_date: z.string().optional(),
  brief: z.string().optional(),
});

type ContentPlanFormData = z.infer<typeof contentPlanSchema>;

interface AddContentPlanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preselectedClientId?: string;
}

export function AddContentPlanDialog({ open, onOpenChange, preselectedClientId }: AddContentPlanDialogProps) {
  const { createContentPlan, isCreating } = useContentPlans();
  const { clients } = useClients();
  const [selectedClientId, setSelectedClientId] = useState(preselectedClientId || '');
  
  const { register, handleSubmit, formState: { errors }, reset, setValue } = useForm<ContentPlanFormData>({
    resolver: zodResolver(contentPlanSchema),
    defaultValues: {
      client_id: preselectedClientId || '',
    },
  });

  const onSubmit = (data: ContentPlanFormData) => {
    createContentPlan({
      title: data.title,
      client_id: data.client_id,
      filming_date: data.filming_date || null,
      brief: data.brief || null,
      status: 'planning',
    }, {
      onSuccess: () => {
        reset();
        setSelectedClientId('');
        onOpenChange(false);
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>New Content Plan</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              {...register('title')}
              placeholder="e.g., June 2024 Content Batch"
              className="bg-secondary border-border"
            />
            {errors.title && (
              <p className="text-sm text-destructive">{errors.title.message}</p>
            )}
          </div>
          
          <div className="space-y-2">
            <Label>Client *</Label>
            <Select 
              value={selectedClientId} 
              onValueChange={(value) => {
                setSelectedClientId(value);
                setValue('client_id', value);
              }}
              disabled={!!preselectedClientId}
            >
              <SelectTrigger className="bg-secondary border-border">
                <SelectValue placeholder="Select client" />
              </SelectTrigger>
              <SelectContent>
                {clients.map((client) => (
                  <SelectItem key={client.id} value={client.id}>
                    {client.business_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.client_id && (
              <p className="text-sm text-destructive">{errors.client_id.message}</p>
            )}
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="filming_date">Filming Date</Label>
            <Input
              id="filming_date"
              type="date"
              {...register('filming_date')}
              className="bg-secondary border-border"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="brief">Brief</Label>
            <Textarea
              id="brief"
              {...register('brief')}
              className="bg-secondary border-border min-h-[100px]"
              placeholder="Content plan details and objectives..."
            />
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
                'Create Plan'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
