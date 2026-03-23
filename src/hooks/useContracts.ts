import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { logActivity } from '@/hooks/useActivityLog';
export interface Contract {
  id: string;
  client_id: string;
  user_id: string;
  title: string;
  contract_type: string;
  content: string;
  scope_of_work: string | null;
  deliverables: string | null;
  payment_terms: string | null;
  start_date: string | null;
  end_date: string | null;
  status: string;
  version: number;
  created_at: string;
  updated_at: string;
  // Payment fields
  payment_amount: number | null;
  payment_currency: string | null;
  payment_status: string | null;
  stripe_checkout_session_id: string | null;
  stripe_payment_intent_id: string | null;
  paid_at: string | null;
  // Recurring payment fields
  payment_type: 'one_time' | 'recurring' | null;
  billing_interval: 'weekly' | 'monthly' | 'yearly' | null;
  initial_payment_amount: number | null;
  stripe_subscription_id: string | null;
  stripe_customer_id: string | null;
  // GST fields
  include_gst: boolean | null;
  gst_percentage: number | null;
}

export interface ContractInsert {
  client_id: string;
  title: string;
  contract_type?: string;
  content: string;
  scope_of_work?: string | null;
  deliverables?: string | null;
  payment_terms?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  status?: string;
  // Payment fields
  payment_amount?: number | null;
  payment_currency?: string | null;
  payment_status?: string | null;
  // Recurring payment fields
  payment_type?: 'one_time' | 'recurring' | null;
  billing_interval?: 'weekly' | 'monthly' | 'yearly' | null;
  initial_payment_amount?: number | null;
  // GST fields
  include_gst?: boolean | null;
  gst_percentage?: number | null;
}

export interface ContractUpdate {
  id: string;
  title?: string;
  contract_type?: string;
  content?: string;
  scope_of_work?: string | null;
  deliverables?: string | null;
  payment_terms?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  status?: string;
  version?: number;
  // Payment fields
  payment_amount?: number | null;
  payment_currency?: string | null;
  payment_status?: string | null;
  // Recurring payment fields
  payment_type?: 'one_time' | 'recurring' | null;
  billing_interval?: 'weekly' | 'monthly' | 'yearly' | null;
  initial_payment_amount?: number | null;
  // GST fields
  include_gst?: boolean | null;
  gst_percentage?: number | null;
}

export function useContracts(clientId?: string) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['contracts', clientId],
    queryFn: async () => {
      let q = supabase
        .from('contracts')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (clientId) {
        q = q.eq('client_id', clientId);
      }
      
      const { data, error } = await q;
      if (error) throw error;
      return data as Contract[];
    },
    enabled: !!user,
  });

  const createMutation = useMutation({
    mutationFn: async (contract: ContractInsert) => {
      const { data, error } = await supabase
        .from('contracts')
        .insert({ ...contract, user_id: user!.id })
        .select()
        .single();
      
      if (error) throw error;
      
      // Log activity
      await logActivity(user!.id, 'created', 'contract', data.id, data.title);
      
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
      toast({ title: 'Contract created' });
    },
    onError: (error) => {
      toast({ title: 'Failed to create contract', description: error.message, variant: 'destructive' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...updates }: ContractUpdate) => {
      const { data, error } = await supabase
        .from('contracts')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      
      // Log activity
      await logActivity(user!.id, 'updated', 'contract', data.id, data.title);
      
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
      toast({ title: 'Contract updated' });
    },
    onError: (error) => {
      toast({ title: 'Failed to update contract', description: error.message, variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      // First get the contract to log its name
      const { data: contract } = await supabase
        .from('contracts')
        .select('title')
        .eq('id', id)
        .single();
      
      const { data, error } = await supabase
        .from('contracts')
        .delete()
        .eq('id', id)
        .select();
      
      if (error) throw error;
      
      // Check if any rows were actually deleted
      if (!data || data.length === 0) {
        throw new Error('Contract could not be deleted. You may not have permission to delete this contract.');
      }
      
      // Log activity
      await logActivity(user!.id, 'deleted', 'contract', id, contract?.title || 'Unknown');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
      toast({ title: 'Contract deleted' });
    },
    onError: (error) => {
      toast({ title: 'Failed to delete contract', description: error.message, variant: 'destructive' });
    },
  });

  const cancelSubscriptionMutation = useMutation({
    mutationFn: async (contractId: string) => {
      const { data, error } = await supabase.functions.invoke('cancel-contract-subscription', {
        body: { contract_id: contractId }
      });
      
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
      toast({ title: 'Subscription cancelled' });
    },
    onError: (error) => {
      toast({ title: 'Failed to cancel subscription', description: error.message, variant: 'destructive' });
    },
  });

  return {
    contracts: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    createContract: createMutation.mutate,
    updateContract: updateMutation.mutate,
    deleteContract: deleteMutation.mutate,
    cancelSubscription: cancelSubscriptionMutation.mutate,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
    isCancellingSubscription: cancelSubscriptionMutation.isPending,
  };
}
