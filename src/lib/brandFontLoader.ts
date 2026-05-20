/**
 * Inject a list of brand fonts into the document via @font-face.
 *
 * Used by the public brand pack page to render copy with the client's
 * actual fonts (so the previews are real, not approximations).
 *
 * Tracks which font URLs have been loaded so re-mounting the page
 * doesn't add duplicate <style> tags.
 */

import type { ClientBrandFont } from '@/types/brand-pack';

const STYLE_ELEMENT_ID = 'arris-brand-fonts';
const loaded = new Set<string>();

function fontFaceFor(font: ClientBrandFont): string | null {
  if (!font.file_url) return null;
  const format = font.file_format?.toLowerCase() ?? 'woff2';
  const formatMap: Record<string, string> = {
    woff2: 'woff2',
    woff: 'woff',
    otf: 'opentype',
    ttf: 'truetype',
  };
  const formatHint = formatMap[format] ?? format;
  return `@font-face {
  font-family: '${font.family_name.replace(/'/g, "\\'")}';
  src: url('${font.file_url}') format('${formatHint}');
  font-weight: ${font.weight};
  font-style: ${font.style};
  font-display: swap;
}`;
}

export function loadBrandFonts(fonts: ClientBrandFont[]): void {
  const newRules: string[] = [];
  for (const font of fonts) {
    if (!font.file_url || loaded.has(font.file_url)) continue;
    const rule = fontFaceFor(font);
    if (rule) {
      newRules.push(rule);
      loaded.add(font.file_url);
    }
  }
  if (newRules.length === 0) return;

  let style = document.getElementById(STYLE_ELEMENT_ID) as HTMLStyleElement | null;
  if (!style) {
    style = document.createElement('style');
    style.id = STYLE_ELEMENT_ID;
    document.head.appendChild(style);
  }
  style.appendChild(document.createTextNode(newRules.join('\n')));
}

export function fontFamilyStack(font: ClientBrandFont): string {
  const family = `'${font.family_name.replace(/'/g, "\\'")}'`;
  if (font.fallback_stack) return `${family}, ${font.fallback_stack}`;
  return `${family}, sans-serif`;
}
