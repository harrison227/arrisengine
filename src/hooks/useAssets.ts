import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Tables, TablesInsert } from '@/integrations/supabase/types';

type Asset = Tables<'assets'>;
type AssetInsert = TablesInsert<'assets'>;

export function useAssets(clientId?: string) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['assets', clientId],
    queryFn: async () => {
      let q = supabase
        .from('assets')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (clientId) {
        q = q.eq('client_id', clientId);
      }
      
      const { data, error } = await q;
      if (error) throw error;
      return data as Asset[];
    },
    enabled: !!user,
  });

  const uploadAsset = async (
    file: File,
    clientId: string,
    assetType: Asset['asset_type'],
    tags?: string[]
  ) => {
    if (!user) throw new Error('Not authenticated');
    
    const fileExt = file.name.split('.').pop();
    const fileName = `${clientId}/${Date.now()}-${file.name}`;
    
    const { error: uploadError } = await supabase.storage
      .from('client-assets')
      .upload(fileName, file);
    
    if (uploadError) throw uploadError;
    
    const { data: { publicUrl } } = supabase.storage
      .from('client-assets')
      .getPublicUrl(fileName);
    
    const { data, error } = await supabase
      .from('assets')
      .insert({
        client_id: clientId,
        name: file.name,
        asset_type: assetType,
        storage_path: fileName,
        thumbnail_url: publicUrl,
        uploaded_by: user.id,
        tags,
      })
      .select()
      .single();
    
    if (error) throw error;
    
    queryClient.invalidateQueries({ queryKey: ['assets', clientId] });
    toast({ title: 'Asset uploaded successfully' });
    
    return data;
  };

  const deleteMutation = useMutation({
    mutationFn: async (asset: Asset) => {
      await supabase.storage
        .from('client-assets')
        .remove([asset.storage_path]);
      
      const { error } = await supabase
        .from('assets')
        .delete()
        .eq('id', asset.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assets', clientId] });
      toast({ title: 'Asset deleted successfully' });
    },
    onError: (error) => {
      toast({ title: 'Failed to delete asset', description: error.message, variant: 'destructive' });
    },
  });

  return {
    assets: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    uploadAsset,
    deleteAsset: deleteMutation.mutate,
    isDeleting: deleteMutation.isPending,
  };
}
