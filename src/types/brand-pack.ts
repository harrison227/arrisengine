/**
 * Manual type definitions for the brand pack tables.
 *
 * These tables (client_logos, client_brand_fonts, client_brand_guidelines,
 * brand_share_links) were added in migration 20260508160000 — but the
 * auto-generated Supabase types in `src/integrations/supabase/types.ts`
 * haven't been regenerated yet. Until they are, this file is the source
 * of truth for the new shapes.
 *
 * To regenerate:
 *   npx supabase gen types typescript --project-id <id> > src/integrations/supabase/types.ts
 */

export type LogoVariant = 'primary' | 'mark' | 'wordmark' | 'icon' | 'other';
export type LogoBackground = 'light' | 'dark' | 'color' | 'transparent';

export interface ClientLogo {
  id: string;
  client_id: string;
  label: string;
  variant: LogoVariant;
  background_treatment: LogoBackground;
  file_url: string;
  file_format: string | null;
  file_size_bytes: number | null;
  width_px: number | null;
  height_px: number | null;
  is_primary: boolean;
  sort_order: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type FontRole = 'heading' | 'body' | 'accent' | 'display';
export type FontSource = 'self_hosted' | 'google_fonts' | 'adobe_fonts' | 'system';
export type FontStyle = 'normal' | 'italic';

export interface ClientBrandFont {
  id: string;
  client_id: string;
  family_name: string;
  role: FontRole;
  file_url: string | null;
  file_format: string | null;
  weight: string;
  style: FontStyle;
  source: FontSource;
  source_url: string | null;
  fallback_stack: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export type GuidelineSection =
  | 'logo_usage'
  | 'typography'
  | 'voice'
  | 'colors'
  | 'dos_donts'
  | 'mission'
  | 'imagery'
  | 'other';

export interface ClientBrandGuideline {
  id: string;
  client_id: string;
  section: GuidelineSection;
  title: string | null;
  content: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface BrandShareLink {
  id: string;
  client_id: string;
  share_id: string;
  is_active: boolean;
  expires_at: string | null;
  allow_downloads: boolean;
  view_count: number;
  download_count: number;
  last_viewed_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface BrandColors {
  primary: string | null;
  secondary: string | null;
  accent: string | null;
  background: string | null;
  text: string | null;
}

export interface BrandPackPayload {
  client: {
    id: string;
    business_name: string;
    industry: string | null;
    style_notes: string | null;
    legacy_logo_url: string | null;
    legacy_font_names: string[];
  };
  colors: BrandColors;
  logos: ClientLogo[];
  fonts: ClientBrandFont[];
  guidelines: ClientBrandGuideline[];
}

export interface PublicBrandPackPayload extends BrandPackPayload {
  shareLink: {
    id: string;
    allow_downloads: boolean;
    expires_at: string | null;
  };
  client: BrandPackPayload['client']; // narrower in practice — no id required
}

// Helper labels for UI rendering.
export const LOGO_VARIANT_LABELS: Record<LogoVariant, string> = {
  primary: 'Primary',
  mark: 'Mark',
  wordmark: 'Wordmark',
  icon: 'Icon',
  other: 'Other',
};

export const LOGO_BACKGROUND_LABELS: Record<LogoBackground, string> = {
  light: 'For light backgrounds',
  dark: 'For dark backgrounds',
  color: 'For colored backgrounds',
  transparent: 'Transparent',
};

export const FONT_ROLE_LABELS: Record<FontRole, string> = {
  heading: 'Heading',
  body: 'Body',
  accent: 'Accent',
  display: 'Display',
};

export const GUIDELINE_SECTION_LABELS: Record<GuidelineSection, string> = {
  logo_usage: 'Logo usage',
  typography: 'Typography',
  voice: 'Brand voice',
  colors: 'Colors',
  dos_donts: 'Do’s & don’ts',
  mission: 'Mission',
  imagery: 'Imagery',
  other: 'Other',
};
