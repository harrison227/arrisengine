import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { CalendarIcon } from 'lucide-react';
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
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { useFilmingDays, FilmingDay } from '@/hooks/useFilmingDays';

const filmingDaySchema = z.object({
  date: z.date({ required_error: 'Please select a date' }),
  location: z.string().optional(),
  call_time: z.string().optional(),
  wrap_time: z.string().optional(),
  notes: z.string().optional(),
  equipment_needed: z.string().optional(),
});

type FilmingDayFormData = z.infer<typeof filmingDaySchema>;

interface FilmingDayDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
  filmingDay?: FilmingDay;
}

export function FilmingDayDialog({ open, onOpenChange, clientId, filmingDay }: FilmingDayDialogProps) {
  const { createFilmingDay, updateFilmingDay, isCreating, isUpdating } = useFilmingDays(clientId);
  const isEditing = !!filmingDay;

  const form = useForm<FilmingDayFormData>({
    resolver: zodResolver(filmingDaySchema),
    defaultValues: {
      date: filmingDay ? new Date(filmingDay.date) : undefined,
      location: filmingDay?.location || '',
      call_time: filmingDay?.call_time || '',
      wrap_time: filmingDay?.wrap_time || '',
      notes: filmingDay?.notes || '',
      equipment_needed: filmingDay?.equipment_needed?.join(', ') || '',
    },
  });

  const onSubmit = (data: FilmingDayFormData) => {
    const equipment = data.equipment_needed
      ? data.equipment_needed.split(',').map(s => s.trim()).filter(Boolean)
      : [];

    if (isEditing) {
      updateFilmingDay({
        id: filmingDay.id,
        date: format(data.date, 'yyyy-MM-dd'),
        location: data.location || null,
        call_time: data.call_time || null,
        wrap_time: data.wrap_time || null,
        notes: data.notes || null,
        equipment_needed: equipment,
      });
    } else {
      createFilmingDay({
        client_id: clientId,
        date: format(data.date, 'yyyy-MM-dd'),
        location: data.location || null,
        call_time: data.call_time || null,
        wrap_time: data.wrap_time || null,
        notes: data.notes || null,
        equipment_needed: equipment,
      });
    }
    onOpenChange(false);
    form.reset();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Filming Day' : 'Schedule Filming Day'}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="date"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Date *</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          className={cn(
                            'w-full pl-3 text-left font-normal',
                            !field.value && 'text-muted-foreground'
                          )}
                        >
                          {field.value ? format(field.value, 'PPP') : 'Pick a date'}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={field.onChange}
                        disabled={(date) => date < new Date()}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="location"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Location</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Studio A, Client's office" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="call_time"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Call Time</FormLabel>
                    <FormControl>
                      <Input type="time" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="wrap_time"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Wrap Time</FormLabel>
                    <FormControl>
                      <Input type="time" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="equipment_needed"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Equipment Needed</FormLabel>
                  <FormControl>
                    <Input placeholder="Camera, lights, mic (comma separated)" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Any special instructions or notes..." {...field} />
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
                {isEditing ? 'Save Changes' : 'Schedule'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
