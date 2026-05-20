/**
 * Client-side ZIP packaging for the Brand Pack download button.
 *
 * Pulls every asset URL through fetch() into the browser, drops them into a
 * folder structure, generates a brand-spec.txt summary, and triggers a download.
 *
 * Doing this in the browser (rather than an edge function) keeps the
 * compute off our backend and bandwidth off our edge — the user already
 * has the assets in their CDN cache anyway.
 */

import JSZip from 'jszip';
import type {
  BrandColors,
  ClientBrandFont,
  ClientBrandGuideline,
  ClientLogo,
  GuidelineSection,
} from '@/types/brand-pack';
import { GUIDELINE_SECTION_LABELS, LOGO_BACKGROUND_LABELS, LOGO_VARIANT_LABELS } from '@/types/brand-pack';

interface BrandPackZipInput {
  clientName: string;
  industry?: string | null;
  colors: BrandColors;
  logos: ClientLogo[];
  fonts: ClientBrandFont[];
  guidelines: ClientBrandGuideline[];
  styleNotes?: string | null;
  legacyLogoUrl?: string | null;
}

function safeFilename(name: string, fallback: string): string {
  const cleaned = (name || fallback)
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return cleaned || fallback;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const m = /^#?([a-f0-9]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const v = parseInt(m[1], 16);
  return { r: (v >> 16) & 255, g: (v >> 8) & 255, b: v & 255 };
}

function buildSpecText(input: BrandPackZipInput): string {
  const lines: string[] = [];
  lines.push(`${input.clientName} — Brand Pack`);
  lines.push('='.repeat(`${input.clientName} — Brand Pack`.length));
  lines.push('');
  if (input.industry) lines.push(`Industry: ${input.industry}`);
  lines.push(`Generated: ${new Date().toISOString().slice(0, 10)}`);
  lines.push('');

  // Colors.
  lines.push('Colors');
  lines.push('------');
  const colorEntries: Array<[string, string | null]> = [
    ['Primary', input.colors.primary],
    ['Secondary', input.colors.secondary],
    ['Accent', input.colors.accent],
    ['Background', input.colors.background],
    ['Text', input.colors.text],
  ];
  for (const [name, value] of colorEntries) {
    if (!value) continue;
    const rgb = hexToRgb(value);
    const rgbPart = rgb ? `   rgb(${rgb.r}, ${rgb.g}, ${rgb.b})` : '';
    lines.push(`  ${name.padEnd(11)} ${value.toUpperCase()}${rgbPart}`);
  }
  lines.push('');

  // Logos.
  if (input.logos.length > 0) {
    lines.push('Logos');
    lines.push('-----');
    for (const logo of input.logos) {
      const tags = [LOGO_VARIANT_LABELS[logo.variant], LOGO_BACKGROUND_LABELS[logo.background_treatment]];
      lines.push(`  • ${logo.label} (${tags.join(', ')})${logo.is_primary ? ' [primary]' : ''}`);
      if (logo.notes) lines.push(`      ${logo.notes}`);
    }
    lines.push('');
  }

  // Fonts.
  if (input.fonts.length > 0) {
    lines.push('Typography');
    lines.push('----------');
    for (const font of input.fonts) {
      const stack = font.fallback_stack ? ` (${font.fallback_stack})` : '';
      const weight = font.weight !== '400' ? ` ${font.weight}` : '';
      lines.push(`  • ${font.role.padEnd(8)} ${font.family_name}${weight} ${font.style === 'italic' ? 'italic' : ''}${stack}`);
    }
    lines.push('');
  }

  // Guidelines.
  if (input.guidelines.length > 0) {
    const bySection = input.guidelines.reduce<Record<string, ClientBrandGuideline[]>>((acc, g) => {
      acc[g.section] = acc[g.section] ?? [];
      acc[g.section].push(g);
      return acc;
    }, {});
    lines.push('Guidelines');
    lines.push('----------');
    for (const section of Object.keys(bySection) as GuidelineSection[]) {
      lines.push('');
      lines.push(`[${GUIDELINE_SECTION_LABELS[section] ?? section}]`);
      for (const g of bySection[section]) {
        if (g.title) lines.push(`  ${g.title}`);
        for (const ln of g.content.split('\n')) lines.push(`    ${ln}`);
      }
    }
    lines.push('');
  }

  if (input.styleNotes) {
    lines.push('Style notes');
    lines.push('-----------');
    for (const ln of input.styleNotes.split('\n')) lines.push(`  ${ln}`);
    lines.push('');
  }

  return lines.join('\n');
}

async function fetchAsBlob(url: string): Promise<Blob | null> {
  try {
    const res = await fetch(url, { mode: 'cors' });
    if (!res.ok) return null;
    return await res.blob();
  } catch {
    return null;
  }
}

function inferExtension(url: string, fallback: string): string {
  try {
    const path = new URL(url).pathname;
    const dot = path.lastIndexOf('.');
    if (dot >= 0) return path.slice(dot + 1).toLowerCase().replace(/[^a-z0-9]/g, '');
  } catch { /* ignore */ }
  return fallback;
}

/**
 * Build the brand pack ZIP and trigger a browser download.
 */
export async function downloadBrandPackZip(input: BrandPackZipInput): Promise<void> {
  const zip = new JSZip();

  // Spec sheet.
  zip.file('brand-spec.txt', buildSpecText(input));

  // Logos.
  if (input.logos.length > 0 || input.legacyLogoUrl) {
    const logoFolder = zip.folder('logos');
    if (logoFolder) {
      let i = 0;
      for (const logo of input.logos) {
        const blob = await fetchAsBlob(logo.file_url);
        if (!blob) continue;
        const ext = (logo.file_format ?? '').toLowerCase() || inferExtension(logo.file_url, 'png');
        const name = `${String(++i).padStart(2, '0')}-${safeFilename(logo.label, `logo-${i}`)}.${ext}`;
        logoFolder.file(name, blob);
      }
      // Include the legacy single-logo for back-compat if no structured logos.
      if (input.logos.length === 0 && input.legacyLogoUrl) {
        const blob = await fetchAsBlob(input.legacyLogoUrl);
        if (blob) {
          const ext = inferExtension(input.legacyLogoUrl, 'png');
          logoFolder.file(`primary.${ext}`, blob);
        }
      }
    }
  }

  // Fonts.
  if (input.fonts.some((f) => f.file_url)) {
    const fontFolder = zip.folder('fonts');
    if (fontFolder) {
      for (const font of input.fonts) {
        if (!font.file_url) continue;
        const blob = await fetchAsBlob(font.file_url);
        if (!blob) continue;
        const ext = (font.file_format ?? '').toLowerCase() || inferExtension(font.file_url, 'woff2');
        const weightSuffix = font.weight && font.weight !== '400' ? `-${font.weight}` : '';
        const styleSuffix = font.style === 'italic' ? '-italic' : '';
        const name = `${safeFilename(font.family_name, 'font')}${weightSuffix}${styleSuffix}.${ext}`;
        fontFolder.file(name, blob);
      }
    }
  }

  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${safeFilename(input.clientName, 'brand-pack')}-brand-pack.zip`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
