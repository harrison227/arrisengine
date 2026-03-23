import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export type ReminderType = 'filming' | 'follow_up' | 'contract_renewal' | 'task_due' | 'stale_lead' | 'custom';

export interface Reminder {
  id: string;
  user_id: string;
  reminder_type: ReminderType;
  title: string;
  description: string | null;
  due_date: string;
  is_read: boolean;
  is_dismissed: boolean;
  related_client_id: string | null;
  related_lead_id: string | null;
  related_task_id: string | null;
  related_content_plan_id: string | null;
  created_at: string;
  clients?: { business_name: string } | null;
  leads?: { business_name: string } | null;
}

export function useReminders() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: reminders = [], isLoading } = useQuery({
    queryKey: ['reminders', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase
        .from('reminders')
        .select(`
          *,
          clients(business_name),
          leads(business_name)
        `)
        .eq('is_dismissed', false)
        .order('due_date', { ascending: true });

      if (error) throw error;
      return data as Reminder[];
    },
    enabled: !!user?.id,
  });

  const unreadCount = reminders.filter(r => !r.is_read && new Date(r.due_date) <= new Date()).length;

  const createReminder = useMutation({
    mutationFn: async (reminder: Omit<Reminder, 'id' | 'user_id' | 'created_at' | 'is_read' | 'is_dismissed' | 'clients' | 'leads'>) => {
      if (!user?.id) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('reminders')
        .insert({ ...reminder, user_id: user.id });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reminders'] });
      toast({ title: 'Reminder created' });
    },
    onError: (error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const markAsRead = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('reminders')
        .update({ is_read: true })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reminders'] });
    },
  });

  const dismissReminder = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('reminders')
        .update({ is_dismissed: true })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reminders'] });
    },
  });

  return {
    reminders,
    unreadCount,
    isLoading,
    createReminder: createReminder.mutate,
    markAsRead: markAsRead.mutate,
    dismissReminder: dismissReminder.mutate,
  };
}
