import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface ContractSignature {
  id: string;
  contract_id: string;
  signer_role: 'agency' | 'client';
  signer_name: string;
  signer_email: string;
  signer_title: string | null;
  intent_confirmed: boolean;
  consent_to_electronic: boolean;
  signature_data: string | null;
  signature_type: 'draw' | 'type' | 'upload' | null;
  signed_at: string | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

export interface SignatureInput {
  contract_id: string;
  signer_role: 'agency' | 'client';
  signer_name: string;
  signer_email: string;
  signer_title?: string;
  intent_confirmed: boolean;
  consent_to_electronic: boolean;
  signature_data: string;
  signature_type: 'draw' | 'type' | 'upload';
}

export function useContractSignatures(contractId?: string) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: signatures = [], isLoading } = useQuery({
    queryKey: ['contract-signatures', contractId],
    queryFn: async () => {
      if (!contractId) return [];
      const { data, error } = await supabase
        .from('contract_signatures')
        .select('*')
        .eq('contract_id', contractId)
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      return data as ContractSignature[];
    },
    enabled: !!contractId,
  });

  const agencySignature = signatures.find(s => s.signer_role === 'agency' && s.signed_at);
  const clientSignature = signatures.find(s => s.signer_role === 'client' && s.signed_at);
  const isFullySigned = !!agencySignature && !!clientSignature;

  const addSignature = useMutation({
    mutationFn: async (input: SignatureInput) => {
      const { data, error } = await supabase.functions.invoke('sign-contract', {
        body: input,
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['contract-signatures', contractId] });
      queryClient.invalidateQueries({ queryKey: ['public-contract'] });
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
      toast({ title: data.message || 'Contract signed successfully' });
    },
    onError: (error) => {
      console.error('Error signing contract:', error);
      toast({ 
        title: 'Failed to sign contract', 
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive' 
      });
    },
  });

  return {
    signatures,
    isLoading,
    agencySignature,
    clientSignature,
    isFullySigned,
    addSignature: addSignature.mutate,
    isSigning: addSignature.isPending,
  };
}
