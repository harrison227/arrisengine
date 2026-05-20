-- ----------------------------------------------------------------------------
-- Brand Pack feature (2026-05-08)
--
-- Adds a structured way to store and share each client's full brand identity:
--   * Multiple logo variants (primary, mark, white, dark, etc.)
--   * Real font files (uploadable, downloadable, usable in image gen)
--   * Per-section brand guidelines (rich text)
--   * Public share links so clients can self-serve their assets
--
-- The existing per-client brand colors / fonts / logo URL fields on the
-- clients table are kept (backwards compatible) — this migration just adds
-- the relational tables that surround them.
-- ----------------------------------------------------------------------------

-- ============================================================================
-- LOGOS — multiple variants per client
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.client_logos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  label TEXT NOT NULL,                          -- "Primary", "Mark", "White on dark"
  variant TEXT NOT NULL DEFAULT 'primary',      -- primary | mark | wordmark | icon | other
  background_treatment TEXT NOT NULL DEFAULT 'transparent', -- light | dark | color | transparent
  file_url TEXT NOT NULL,
  file_format TEXT,                             -- svg | png | jpg | pdf
  file_size_bytes INTEGER,
  width_px INTEGER,
  height_px INTEGER,
  is_primary BOOLEAN NOT NULL DEFAULT false,    -- one logo per client should be primary
  sort_order INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT client_logos_variant_check CHECK (variant IN ('primary', 'mark', 'wordmark', 'icon', 'other')),
  CONSTRAINT client_logos_bg_check CHECK (background_treatment IN ('light', 'dark', 'color', 'transparent'))
);

CREATE INDEX IF NOT EXISTS idx_client_logos_client_id ON public.client_logos (client_id, sort_order);
CREATE UNIQUE INDEX IF NOT EXISTS uq_client_logos_primary
  ON public.client_logos (client_id) WHERE is_primary = true;

ALTER TABLE public.client_logos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team can view client_logos"
  ON public.client_logos FOR SELECT TO authenticated
  USING (
    public.is_admin_or_owner(auth.uid())
    OR public.has_client_access(auth.uid(), client_id)
  );

CREATE POLICY "Team can manage client_logos"
  ON public.client_logos FOR ALL TO authenticated
  USING (
    public.is_admin_or_owner(auth.uid())
    OR public.has_client_access(auth.uid(), client_id)
  )
  WITH CHECK (
    public.is_admin_or_owner(auth.uid())
    OR public.has_client_access(auth.uid(), client_id)
  );

CREATE TRIGGER trg_client_logos_updated_at
  BEFORE UPDATE ON public.client_logos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- ============================================================================
-- FONTS — actual font files per client (so we can use them, not just name them)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.client_brand_fonts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  family_name TEXT NOT NULL,                    -- "Inter", "Söhne", etc
  role TEXT NOT NULL DEFAULT 'body',            -- heading | body | accent | display
  file_url TEXT,                                -- self-hosted woff2/otf/ttf
  file_format TEXT,                             -- woff2 | woff | otf | ttf
  weight TEXT NOT NULL DEFAULT '400',           -- '400', '700', 'regular', 'bold'
  style TEXT NOT NULL DEFAULT 'normal',         -- normal | italic
  source TEXT NOT NULL DEFAULT 'self_hosted',   -- self_hosted | google_fonts | adobe_fonts | system
  source_url TEXT,                              -- e.g. Google Fonts URL when source != self_hosted
  fallback_stack TEXT,                          -- "Inter, sans-serif"
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT client_brand_fonts_role_check CHECK (role IN ('heading', 'body', 'accent', 'display')),
  CONSTRAINT client_brand_fonts_source_check CHECK (source IN ('self_hosted', 'google_fonts', 'adobe_fonts', 'system')),
  CONSTRAINT client_brand_fonts_style_check CHECK (style IN ('normal', 'italic'))
);

CREATE INDEX IF NOT EXISTS idx_client_brand_fonts_client_id
  ON public.client_brand_fonts (client_id, role, sort_order);

ALTER TABLE public.client_brand_fonts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team can view client_brand_fonts"
  ON public.client_brand_fonts FOR SELECT TO authenticated
  USING (
    public.is_admin_or_owner(auth.uid())
    OR public.has_client_access(auth.uid(), client_id)
  );

CREATE POLICY "Team can manage client_brand_fonts"
  ON public.client_brand_fonts FOR ALL TO authenticated
  USING (
    public.is_admin_or_owner(auth.uid())
    OR public.has_client_access(auth.uid(), client_id)
  )
  WITH CHECK (
    public.is_admin_or_owner(auth.uid())
    OR public.has_client_access(auth.uid(), client_id)
  );

CREATE TRIGGER trg_client_brand_fonts_updated_at
  BEFORE UPDATE ON public.client_brand_fonts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- ============================================================================
-- GUIDELINES — rich-text usage rules per section
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.client_brand_guidelines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  section TEXT NOT NULL,                        -- logo_usage | typography | voice | colors | dos_donts | mission | other
  title TEXT,
  content TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT client_brand_guidelines_section_check
    CHECK (section IN ('logo_usage', 'typography', 'voice', 'colors', 'dos_donts', 'mission', 'imagery', 'other'))
);

CREATE INDEX IF NOT EXISTS idx_client_brand_guidelines_client_id
  ON public.client_brand_guidelines (client_id, section, sort_order);

ALTER TABLE public.client_brand_guidelines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team can view client_brand_guidelines"
  ON public.client_brand_guidelines FOR SELECT TO authenticated
  USING (
    public.is_admin_or_owner(auth.uid())
    OR public.has_client_access(auth.uid(), client_id)
  );

CREATE POLICY "Team can manage client_brand_guidelines"
  ON public.client_brand_guidelines FOR ALL TO authenticated
  USING (
    public.is_admin_or_owner(auth.uid())
    OR public.has_client_access(auth.uid(), client_id)
  )
  WITH CHECK (
    public.is_admin_or_owner(auth.uid())
    OR public.has_client_access(auth.uid(), client_id)
  );

CREATE TRIGGER trg_client_brand_guidelines_updated_at
  BEFORE UPDATE ON public.client_brand_guidelines
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- ============================================================================
-- SHARE LINKS — public read-only access to a client's brand pack
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.brand_share_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  share_id TEXT NOT NULL UNIQUE,                -- short slug used in the URL
  is_active BOOLEAN NOT NULL DEFAULT true,
  expires_at TIMESTAMPTZ,                       -- null = never
  allow_downloads BOOLEAN NOT NULL DEFAULT true,
  view_count INTEGER NOT NULL DEFAULT 0,
  download_count INTEGER NOT NULL DEFAULT 0,
  last_viewed_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_brand_share_links_share_id
  ON public.brand_share_links (share_id);
CREATE INDEX IF NOT EXISTS idx_brand_share_links_client_id
  ON public.brand_share_links (client_id);

ALTER TABLE public.brand_share_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team can view brand_share_links"
  ON public.brand_share_links FOR SELECT TO authenticated
  USING (
    public.is_admin_or_owner(auth.uid())
    OR public.has_client_access(auth.uid(), client_id)
  );

CREATE POLICY "Team can manage brand_share_links"
  ON public.brand_share_links FOR ALL TO authenticated
  USING (
    public.is_admin_or_owner(auth.uid())
    OR public.has_client_access(auth.uid(), client_id)
  )
  WITH CHECK (
    public.is_admin_or_owner(auth.uid())
    OR public.has_client_access(auth.uid(), client_id)
    OR auth.uid() = created_by
  );

CREATE TRIGGER trg_brand_share_links_updated_at
  BEFORE UPDATE ON public.brand_share_links
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

COMMENT ON TABLE public.brand_share_links IS
  'Public share links for the brand pack. The /brand/:shareId page is read-only and validates against this row''s is_active and expires_at.';


-- ============================================================================
-- VIEW + DOWNLOAD COUNTERS — small SECURITY DEFINER helpers
-- ============================================================================
CREATE OR REPLACE FUNCTION public.record_brand_pack_view(p_share_id TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.brand_share_links
  SET view_count = view_count + 1,
      last_viewed_at = now()
  WHERE share_id = p_share_id
    AND is_active = true
    AND (expires_at IS NULL OR expires_at > now());
  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.record_brand_pack_view(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_brand_pack_view(TEXT) TO authenticated, anon, service_role;

CREATE OR REPLACE FUNCTION public.record_brand_pack_download(p_share_id TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.brand_share_links
  SET download_count = download_count + 1
  WHERE share_id = p_share_id
    AND is_active = true
    AND (expires_at IS NULL OR expires_at > now())
    AND allow_downloads = true;
  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.record_brand_pack_download(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_brand_pack_download(TEXT) TO authenticated, anon, service_role;


-- ============================================================================
-- STORAGE BUCKET — for logo + font file uploads
-- ============================================================================
-- We piggy-back on the existing client-assets bucket (already public + RLS-policed).
-- Brand pack files use the path prefix `<client_id>/brand/`.
-- No new bucket needed.


-- ============================================================================
-- HELPER VIEW — public-safe brand pack snapshot
-- ============================================================================
-- Read-only view that joins everything a brand pack needs into one row,
-- excluding sensitive fields (Late API key, contact emails, etc.).
CREATE OR REPLACE VIEW public.client_brand_pack_safe AS
SELECT
  c.id AS client_id,
  c.business_name,
  c.industry,
  c.brand_primary_color,
  c.brand_secondary_color,
  c.brand_accent_color,
  c.brand_background_color,
  c.brand_text_color,
  c.brand_fonts AS legacy_brand_fonts,
  c.brand_logo_url AS legacy_logo_url,
  c.brand_style_notes
FROM public.clients c;

COMMENT ON VIEW public.client_brand_pack_safe IS
  'Subset of clients exposed to brand-pack consumers (internal + public share links). Excludes credentials, MRR, contact details.';
