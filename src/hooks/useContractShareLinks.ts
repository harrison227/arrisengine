import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface ContractShareLink {
  id: string;
  share_id: string;
  contract_id: string;
  is_active: boolean;
  expires_at: string | null;
  created_at: string;
  created_by: string;
}

export function useContractShareLinks(contractId?: string) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: shareLinks = [], isLoading, error, refetch } = useQuery({
    queryKey: ['contract-share-links', contractId],
    queryFn: async () => {
      if (!contractId) return [];
      const { data, error } = await supabase
        .from('contract_share_links')
        .select('*')
        .eq('contract_id', contractId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as ContractShareLink[];
    },
    enabled: !!contractId,
  });

  const createShareLink = useMutation({
    mutationFn: async ({ contractId, expiresAt }: { contractId: string; expiresAt?: string }) => {
      const shareId = crypto.randomUUID().slice(0, 8);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('contract_share_links')
        .insert({
          share_id: shareId,
          contract_id: contractId,
          expires_at: expiresAt || null,
          created_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data as ContractShareLink;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contract-share-links', contractId] });
      toast({ title: 'Share link created' });
    },
    onError: (error) => {
      console.error('Error creating share link:', error);
      toast({ title: 'Failed to create share link', variant: 'destructive' });
    },
  });

  const deactivateShareLink = useMutation({
    mutationFn: async (linkId: string) => {
      const { error } = await supabase
        .from('contract_share_links')
        .update({ is_active: false })
        .eq('id', linkId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contract-share-links', contractId] });
      toast({ title: 'Share link deactivated' });
    },
    onError: (error) => {
      console.error('Error deactivating share link:', error);
      toast({ title: 'Failed to deactivate share link', variant: 'destructive' });
    },
  });

  return {
    shareLinks,
    isLoading,
    error,
    refetch,
    createShareLink: createShareLink.mutate,
    deactivateShareLink: deactivateShareLink.mutate,
    isCreating: createShareLink.isPending,
  };
}

// Hook to get public contract data by share ID
export function usePublicContract(shareId: string | undefined) {
  return useQuery({
    queryKey: ['public-contract', shareId],
    queryFn: async () => {
      if (!shareId) return null;

      // Get the share link
      const { data: shareLink, error: shareLinkError } = await supabase
        .from('contract_share_links')
        .select('*')
        .eq('share_id', shareId)
        .eq('is_active', true)
        .single();

      if (shareLinkError) throw shareLinkError;

      // Check if expired
      if (shareLink.expires_at && new Date(shareLink.expires_at) < new Date()) {
        throw new Error('This link has expired');
      }

      // Get the contract
      const { data: contract, error: contractError } = await supabase
        .from('contracts')
        .select('*')
        .eq('id', shareLink.contract_id)
        .single();

      if (contractError) throw contractError;

      // Get the client info (using RLS policy for public access via share link)
      const { data: client } = await supabase
        .from('clients')
        .select('id, business_name, brand_logo_url, contact_name, email, phone')
        .eq('id', contract.client_id)
        .single();

      return {
        shareLink,
        contract,
        client,
      };
    },
    enabled: !!shareId,
    retry: false,
  });
}
