/**
 * Hook bundle for the Brand Pack feature.
 *
 * Exports:
 *   useBrandPack(clientId)           — full bundle (colors, logos, fonts, guidelines).
 *   useClientLogos(clientId)         — CRUD on client_logos.
 *   useClientBrandFonts(clientId)    — CRUD on client_brand_fonts.
 *   useClientBrandGuidelines(clientId) — CRUD on client_brand_guidelines.
 *   useBrandShareLinks(clientId)     — list / create / rotate / deactivate share links.
 *   usePublicBrandPack(shareId)      — public-facing read for the share-link page.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type {
  BrandPackPayload,
  BrandShareLink,
  ClientBrandFont,
  ClientBrandGuideline,
  ClientLogo,
  PublicBrandPackPayload,
} from '@/types/brand-pack';

// ============================================================================
// Internal full-bundle reader (calls the brand-pack-data edge function so RLS +
// JWT auth are enforced server-side; cuts the network round-trip count too).
// ============================================================================
export function useBrandPack(clientId: string | undefined) {
  return useQuery({
    queryKey: ['brand_pack', clientId],
    queryFn: async (): Promise<BrandPackPayload | null> => {
      if (!clientId) return null;
      const { data, error } = await supabase.functions.invoke('brand-pack-data', {
        body: { clientId },
      });
      if (error) throw error;
      return data as BrandPackPayload;
    },
    enabled: Boolean(clientId),
    staleTime: 60 * 1000,
  });
}

// ============================================================================
// LOGOS
// ============================================================================
type LogoTable = 'client_logos';
const LOGO_TABLE: LogoTable = 'client_logos';

export function useClientLogos(clientId: string | undefined) {
  const { toast } = useToast();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: [LOGO_TABLE, clientId],
    queryFn: async (): Promise<ClientLogo[]> => {
      if (!clientId) return [];
      // The new tables aren't in the auto-generated types yet — cast to bypass.
      const { data, error } = await (supabase.from as any)(LOGO_TABLE)
        .select('*')
        .eq('client_id', clientId)
        .order('is_primary', { ascending: false })
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return (data ?? []) as ClientLogo[];
    },
    enabled: Boolean(clientId),
  });

  const upsertMutation = useMutation({
    mutationFn: async (logo: Partial<ClientLogo> & { client_id: string; label: string; file_url: string }) => {
      const { data, error } = await (supabase.from as any)(LOGO_TABLE).upsert(logo).select().single();
      if (error) throw error;
      return data as ClientLogo;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [LOGO_TABLE, clientId] });
      qc.invalidateQueries({ queryKey: ['brand_pack', clientId] });
    },
    onError: (error: Error) => toast({ title: 'Logo save failed', description: error.message, variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase.from as any)(LOGO_TABLE).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [LOGO_TABLE, clientId] });
      qc.invalidateQueries({ queryKey: ['brand_pack', clientId] });
      toast({ title: 'Logo removed' });
    },
    onError: (error: Error) => toast({ title: 'Logo delete failed', description: error.message, variant: 'destructive' }),
  });

  const setPrimaryMutation = useMutation({
    mutationFn: async (logoId: string) => {
      if (!clientId) throw new Error('clientId required');
      // Clear any existing primary first (the unique partial index would block us otherwise).
      const { error: clearError } = await (supabase.from as any)(LOGO_TABLE)
        .update({ is_primary: false })
        .eq('client_id', clientId)
        .eq('is_primary', true);
      if (clearError) throw clearError;
      const { error } = await (supabase.from as any)(LOGO_TABLE)
        .update({ is_primary: true })
        .eq('id', logoId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [LOGO_TABLE, clientId] });
      qc.invalidateQueries({ queryKey: ['brand_pack', clientId] });
    },
    onError: (error: Error) => toast({ title: 'Could not set primary', description: error.message, variant: 'destructive' }),
  });

  return {
    logos: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    upsertLogo: upsertMutation.mutateAsync,
    deleteLogo: deleteMutation.mutate,
    setPrimary: setPrimaryMutation.mutate,
    isMutating: upsertMutation.isPending || deleteMutation.isPending || setPrimaryMutation.isPending,
  };
}

// ============================================================================
// FONTS
// ============================================================================
const FONT_TABLE = 'client_brand_fonts';

export function useClientBrandFonts(clientId: string | undefined) {
  const { toast } = useToast();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: [FONT_TABLE, clientId],
    queryFn: async (): Promise<ClientBrandFont[]> => {
      if (!clientId) return [];
      const { data, error } = await (supabase.from as any)(FONT_TABLE)
        .select('*')
        .eq('client_id', clientId)
        .order('role', { ascending: true })
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return (data ?? []) as ClientBrandFont[];
    },
    enabled: Boolean(clientId),
  });

  const upsertMutation = useMutation({
    mutationFn: async (font: Partial<ClientBrandFont> & { client_id: string; family_name: string; role: ClientBrandFont['role'] }) => {
      const { data, error } = await (supabase.from as any)(FONT_TABLE).upsert(font).select().single();
      if (error) throw error;
      return data as ClientBrandFont;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [FONT_TABLE, clientId] });
      qc.invalidateQueries({ queryKey: ['brand_pack', clientId] });
    },
    onError: (error: Error) => toast({ title: 'Font save failed', description: error.message, variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase.from as any)(FONT_TABLE).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [FONT_TABLE, clientId] });
      qc.invalidateQueries({ queryKey: ['brand_pack', clientId] });
      toast({ title: 'Font removed' });
    },
    onError: (error: Error) => toast({ title: 'Font delete failed', description: error.message, variant: 'destructive' }),
  });

  return {
    fonts: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    upsertFont: upsertMutation.mutateAsync,
    deleteFont: deleteMutation.mutate,
    isMutating: upsertMutation.isPending || deleteMutation.isPending,
  };
}

// ============================================================================
// GUIDELINES
// ============================================================================
const GUIDELINE_TABLE = 'client_brand_guidelines';

export function useClientBrandGuidelines(clientId: string | undefined) {
  const { toast } = useToast();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: [GUIDELINE_TABLE, clientId],
    queryFn: async (): Promise<ClientBrandGuideline[]> => {
      if (!clientId) return [];
      const { data, error } = await (supabase.from as any)(GUIDELINE_TABLE)
        .select('*')
        .eq('client_id', clientId)
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return (data ?? []) as ClientBrandGuideline[];
    },
    enabled: Boolean(clientId),
  });

  const upsertMutation = useMutation({
    mutationFn: async (
      guideline: Partial<ClientBrandGuideline> & { client_id: string; section: ClientBrandGuideline['section']; content: string },
    ) => {
      const { data, error } = await (supabase.from as any)(GUIDELINE_TABLE).upsert(guideline).select().single();
      if (error) throw error;
      return data as ClientBrandGuideline;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [GUIDELINE_TABLE, clientId] });
      qc.invalidateQueries({ queryKey: ['brand_pack', clientId] });
    },
    onError: (error: Error) => toast({ title: 'Guideline save failed', description: error.message, variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase.from as any)(GUIDELINE_TABLE).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [GUIDELINE_TABLE, clientId] });
      qc.invalidateQueries({ queryKey: ['brand_pack', clientId] });
    },
    onError: (error: Error) => toast({ title: 'Guideline delete failed', description: error.message, variant: 'destructive' }),
  });

  return {
    guidelines: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    upsertGuideline: upsertMutation.mutateAsync,
    deleteGuideline: deleteMutation.mutate,
    isMutating: upsertMutation.isPending || deleteMutation.isPending,
  };
}

// ============================================================================
// SHARE LINKS
// ============================================================================
const SHARE_LINK_TABLE = 'brand_share_links';

export function useBrandShareLinks(clientId: string | undefined) {
  const { toast } = useToast();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: [SHARE_LINK_TABLE, clientId],
    queryFn: async (): Promise<BrandShareLink[]> => {
      if (!clientId) return [];
      const { data, error } = await (supabase.from as any)(SHARE_LINK_TABLE)
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as BrandShareLink[];
    },
    enabled: Boolean(clientId),
  });

  const callShareLinkFn = async (input: {
    action: 'create' | 'rotate' | 'deactivate';
    shareLinkId?: string;
    expiresAt?: string;
    allowDownloads?: boolean;
  }) => {
    if (!clientId) throw new Error('clientId required');
    const { data, error } = await supabase.functions.invoke('create-brand-share-link', {
      body: { clientId, ...input },
    });
    if (error) throw error;
    return data?.shareLink as BrandShareLink;
  };

  const createMutation = useMutation({
    mutationFn: (input: { expiresAt?: string; allowDownloads?: boolean }) =>
      callShareLinkFn({ action: 'create', ...input }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [SHARE_LINK_TABLE, clientId] });
      toast({ title: 'Share link created' });
    },
    onError: (error: Error) => toast({ title: 'Could not create share link', description: error.message, variant: 'destructive' }),
  });

  const rotateMutation = useMutation({
    mutationFn: (shareLinkId: string) => callShareLinkFn({ action: 'rotate', shareLinkId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [SHARE_LINK_TABLE, clientId] });
      toast({ title: 'Share link rotated', description: 'The old link no longer works.' });
    },
    onError: (error: Error) => toast({ title: 'Could not rotate share link', description: error.message, variant: 'destructive' }),
  });

  const deactivateMutation = useMutation({
    mutationFn: (shareLinkId: string) => callShareLinkFn({ action: 'deactivate', shareLinkId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [SHARE_LINK_TABLE, clientId] });
      toast({ title: 'Share link deactivated' });
    },
    onError: (error: Error) => toast({ title: 'Could not deactivate', description: error.message, variant: 'destructive' }),
  });

  return {
    shareLinks: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    createShareLink: createMutation.mutateAsync,
    rotateShareLink: rotateMutation.mutateAsync,
    deactivateShareLink: deactivateMutation.mutate,
    isMutating: createMutation.isPending || rotateMutation.isPending || deactivateMutation.isPending,
  };
}

// ============================================================================
// PUBLIC READER (for the /brand/:shareId page)
// ============================================================================
export function usePublicBrandPack(shareId: string | undefined) {
  return useQuery({
    queryKey: ['public_brand_pack', shareId],
    queryFn: async (): Promise<PublicBrandPackPayload | null> => {
      if (!shareId) return null;
      const { data, error } = await supabase.functions.invoke('public-brand-pack', {
        body: { shareId },
      });
      if (error) throw error;
      return data as PublicBrandPackPayload;
    },
    enabled: Boolean(shareId),
    staleTime: 60 * 1000,
    retry: false,
  });
}
