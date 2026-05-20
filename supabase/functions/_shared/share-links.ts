/**
 * Share-link helpers — used by every public-* edge function.
 *
 * Centralises:
 *   - Validating that a share link exists, is active, and not expired.
 *   - Verifying that a piece of content belongs to the link's client.
 *
 * Returns typed records so callers don't have to repeat the same
 * is_active / expired / client-mismatch boilerplate that was previously
 * inlined into 5+ functions.
 */

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.57.2';
import { forbidden, notFound } from './errors.ts';

export interface CalendarShareLink {
  id: string;
  client_id: string;
  is_active: boolean;
  start_date?: string | null;
  end_date?: string | null;
}

export interface AnalyticsShareLink {
  id: string;
  client_id: string;
  is_active: boolean;
  expires_at?: string | null;
}

export interface PlanShareLink {
  id: string;
  content_plan_id: string;
  is_active: boolean;
  expires_at?: string | null;
}

export interface BrandShareLink {
  id: string;
  client_id: string;
  is_active: boolean;
  expires_at?: string | null;
  allow_downloads: boolean;
}

function ensureActive(link: { is_active: boolean; expires_at?: string | null }, label: string) {
  if (!link.is_active) throw forbidden(`${label} link is no longer active`);
  if (link.expires_at && new Date(link.expires_at).getTime() < Date.now()) {
    throw forbidden(`${label} link has expired`);
  }
}

export async function getCalendarShareLink(
  supabase: SupabaseClient,
  shareId: string,
): Promise<CalendarShareLink> {
  const { data, error } = await supabase
    .from('calendar_share_links')
    .select('id, client_id, is_active, start_date, end_date')
    .eq('share_id', shareId)
    .maybeSingle();
  if (error || !data) throw notFound('Invalid or expired share link');
  if (!data.is_active) throw forbidden('This share link is no longer active');
  return data as CalendarShareLink;
}

export async function getAnalyticsShareLink(
  supabase: SupabaseClient,
  shareId: string,
): Promise<AnalyticsShareLink> {
  const { data, error } = await supabase
    .from('analytics_share_links')
    .select('id, client_id, is_active, expires_at')
    .eq('share_id', shareId)
    .maybeSingle();
  if (error || !data) throw notFound('Invalid or expired share link');
  ensureActive(data as AnalyticsShareLink, 'Analytics share');
  return data as AnalyticsShareLink;
}

export async function getPlanShareLink(
  supabase: SupabaseClient,
  shareId: string,
): Promise<PlanShareLink> {
  const { data, error } = await supabase
    .from('plan_share_links')
    .select('id, content_plan_id, is_active, expires_at')
    .eq('share_id', shareId)
    .maybeSingle();
  if (error || !data) throw notFound('Invalid or expired share link');
  ensureActive(data as PlanShareLink, 'Plan share');
  return data as PlanShareLink;
}

export async function getBrandShareLink(
  supabase: SupabaseClient,
  shareId: string,
): Promise<BrandShareLink> {
  const { data, error } = await supabase
    .from('brand_share_links')
    .select('id, client_id, is_active, expires_at, allow_downloads')
    .eq('share_id', shareId)
    .maybeSingle();
  if (error || !data) throw notFound('Invalid or expired share link');
  ensureActive(data as BrandShareLink, 'Brand share');
  return data as BrandShareLink;
}
