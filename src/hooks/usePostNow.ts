import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';

export function usePostNow() {
  const [isPosting, setIsPosting] = useState(false);
  const [postingId, setPostingId] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const postNow = async (contentPieceId: string) => {
    setIsPosting(true);
    setPostingId(contentPieceId);

    try {
      const { data, error } = await supabase.functions.invoke('post-now-to-late', {
        body: { contentPieceId },
      });

      if (error) {
        throw new Error(error.message);
      }

      if (!data || !data.success) {
        throw new Error(data?.error || 'Post failed — no confirmation from server. Please try again.');
      }

      toast({
        title: 'Posted successfully!',
        description: 'Your content has been published to Late.',
      });

      // Invalidate queries to refresh the UI
      queryClient.invalidateQueries({ queryKey: ['content_pieces'] });

      return true;
    } catch (error) {
      console.error('Post Now error:', error);
      toast({
        title: 'Failed to post',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
      return false;
    } finally {
      setIsPosting(false);
      setPostingId(null);
    }
  };

  return {
    postNow,
    isPosting,
    postingId,
  };
}
