import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface ClientReferenceImage {
  id: string;
  client_id: string;
  name: string;
  storage_path: string;
  thumbnail_url: string | null;
  is_active: boolean;
  created_at: string;
  created_by: string | null;
}

export function useClientReferenceImages(clientId: string | undefined) {
  const queryClient = useQueryClient();

  const { data: savedImages = [], isLoading } = useQuery({
    queryKey: ['client-reference-images', clientId],
    queryFn: async () => {
      if (!clientId) return [];
      
      const { data, error } = await supabase
        .from('client_reference_images')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as ClientReferenceImage[];
    },
    enabled: !!clientId,
  });

  const saveImageMutation = useMutation({
    mutationFn: async ({ 
      imageData, 
      name 
    }: { 
      imageData: string; 
      name: string;
    }) => {
      if (!clientId) throw new Error('No client selected');

      // Convert base64 to blob
      const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
      const imageBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
      
      const fileName = `${clientId}/reference-images/${Date.now()}-${name.replace(/[^a-zA-Z0-9]/g, '-')}.png`;
      
      const { error: uploadError } = await supabase.storage
        .from('client-assets')
        .upload(fileName, imageBytes, {
          contentType: 'image/png',
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('client-assets')
        .getPublicUrl(fileName);

      const { data: user } = await supabase.auth.getUser();

      const { data, error } = await supabase
        .from('client_reference_images')
        .insert({
          client_id: clientId,
          name,
          storage_path: fileName,
          thumbnail_url: publicUrl,
          is_active: true,
          created_by: user.user?.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-reference-images', clientId] });
      toast.success('Reference image saved to library');
    },
    onError: (error) => {
      console.error('Error saving reference image:', error);
      toast.error('Failed to save reference image');
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const { error } = await supabase
        .from('client_reference_images')
        .update({ is_active: isActive })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-reference-images', clientId] });
    },
  });

  const deleteImageMutation = useMutation({
    mutationFn: async (id: string) => {
      const image = savedImages.find(img => img.id === id);
      
      if (image?.storage_path) {
        await supabase.storage
          .from('client-assets')
          .remove([image.storage_path]);
      }

      const { error } = await supabase
        .from('client_reference_images')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-reference-images', clientId] });
      toast.success('Reference image removed from library');
    },
    onError: (error) => {
      console.error('Error deleting reference image:', error);
      toast.error('Failed to delete reference image');
    },
  });

  return {
    savedImages,
    isLoading,
    activeImages: savedImages.filter(img => img.is_active),
    saveImage: saveImageMutation.mutate,
    isSaving: saveImageMutation.isPending,
    toggleActive: toggleActiveMutation.mutate,
    deleteImage: deleteImageMutation.mutate,
    isDeleting: deleteImageMutation.isPending,
  };
}
