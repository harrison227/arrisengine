import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, startOfYear, endOfYear } from 'date-fns';

export type GoalPeriod = 'monthly' | 'quarterly' | 'yearly';

export interface RevenueGoal {
  id: string;
  user_id: string;
  period: GoalPeriod;
  target_amount: number;
  start_date: string;
  end_date: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export function useRevenueGoals() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: goals = [], isLoading } = useQuery({
    queryKey: ['revenue-goals', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase
        .from('revenue_goals')
        .select('*')
        .eq('user_id', user.id)
        .order('start_date', { ascending: false });

      if (error) throw error;
      return data as RevenueGoal[];
    },
    enabled: !!user?.id,
  });

  const currentGoal = goals.find(g => {
    const now = new Date();
    return new Date(g.start_date) <= now && new Date(g.end_date) >= now;
  });

  const createGoal = useMutation({
    mutationFn: async (goal: { period: GoalPeriod; target_amount: number; notes?: string }) => {
      if (!user?.id) throw new Error('Not authenticated');

      const now = new Date();
      let start_date: Date, end_date: Date;

      switch (goal.period) {
        case 'monthly':
          start_date = startOfMonth(now);
          end_date = endOfMonth(now);
          break;
        case 'quarterly':
          start_date = startOfQuarter(now);
          end_date = endOfQuarter(now);
          break;
        case 'yearly':
          start_date = startOfYear(now);
          end_date = endOfYear(now);
          break;
      }

      const { error } = await supabase
        .from('revenue_goals')
        .insert({
          user_id: user.id,
          period: goal.period,
          target_amount: goal.target_amount,
          start_date: start_date.toISOString().split('T')[0],
          end_date: end_date.toISOString().split('T')[0],
          notes: goal.notes || null,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['revenue-goals'] });
      toast({ title: 'Goal created', description: 'Your revenue goal has been set.' });
    },
    onError: (error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const updateGoal = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<RevenueGoal> & { id: string }) => {
      const { error } = await supabase
        .from('revenue_goals')
        .update(updates)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['revenue-goals'] });
      toast({ title: 'Goal updated' });
    },
    onError: (error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const deleteGoal = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('revenue_goals')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['revenue-goals'] });
    },
  });

  return {
    goals,
    currentGoal,
    isLoading,
    createGoal: createGoal.mutate,
    updateGoal: updateGoal.mutate,
    deleteGoal: deleteGoal.mutate,
    isCreating: createGoal.isPending,
  };
}
