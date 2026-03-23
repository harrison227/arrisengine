

# Image Migration to R2 + Speed Optimizations

## Overview
Two parts: (1) create a backend function to migrate existing images from internal storage to Cloudflare R2, and (2) apply a set of frontend performance optimizations to make the site noticeably faster.

---

## Part 1: Migrate Existing Images to R2

### New Edge Function: `migrate-images-to-r2`
A one-shot edge function that:
1. Queries `image_batch_items` for rows where `generated_image_url` starts with the Supabase storage domain (not already R2 URLs)
2. Queries `image_batch_revisions` for the same
3. Queries `assets` for rows where `thumbnail_url` points to Supabase storage
4. For each image URL: fetches the image, uploads to R2 using the existing `uploadToR2` helper, then updates the database row with the new R2 URL
5. Processes in batches of 10 to avoid timeout, returns progress so it can be called repeatedly if needed

This is invoked manually (or from a simple admin button) and is idempotent -- skips already-migrated rows.

### Admin trigger in Settings
Add a "Migrate Images to R2" button in the Agency Settings page that calls this function and shows progress via a toast.

---

## Part 2: Frontend Speed Optimizations

### 1. Font loading optimization (`index.html`)
- Add `rel="preload"` for the Geist font CSS
- Add `font-display: swap` to prevent render-blocking
- Remove unused Inter font (Geist is the primary font already)

### 2. Image component optimization
- Add `decoding="async"` to all `<img>` tags across gallery components
- Add explicit `width`/`height` or `aspect-ratio` to prevent layout shifts (CLS)
- Components affected: `AllImagesGallery`, `GenerationGallery`, `QuickGenerateGallery`, `VariationsWorkspace`

### 3. Route-level code splitting improvements (`src/App.tsx`)
- Move `SocialAnalytics`, `ImageStudio`, `ContentPlanner`, and `AIPromptStudio` to `React.lazy` (already done)
- Also lazy-load `Onboarding` page (rarely visited)
- Keep core pages (Dashboard, Clients, Pipeline, Content, Tasks, Team, Settings) eagerly loaded as-is

### 4. Vite build optimizations (`vite.config.ts`)
- Add `build.rollupOptions.output.manualChunks` to split vendor bundles:
  - `vendor-react`: react, react-dom, react-router-dom
  - `vendor-query`: @tanstack/react-query
  - `vendor-ui`: radix UI components
  - `vendor-charts`: recharts
- This improves caching -- vendor code rarely changes, so returning users get cache hits

### 5. Preconnect to R2 domain (`index.html`)
- Add `<link rel="preconnect" href="YOUR_R2_PUBLIC_URL">` so the browser establishes the connection early before any image requests

---

## Technical Details

### Files to create
- `supabase/functions/migrate-images-to-r2/index.ts` -- migration edge function

### Files to modify
- `index.html` -- font preload, R2 preconnect, remove Inter
- `vite.config.ts` -- manual chunks for better caching
- `src/components/image-studio/AllImagesGallery.tsx` -- `decoding="async"` + aspect-ratio
- `src/components/image-studio/GenerationGallery.tsx` -- `decoding="async"`
- `src/components/image-studio/QuickGenerateGallery.tsx` -- `decoding="async"`
- `src/components/image-studio/VariationsWorkspace.tsx` -- `decoding="async"`
- `src/pages/AgencySettings.tsx` -- migration trigger button

### Implementation order
1. Create migration edge function
2. Add migration button to settings
3. Apply `index.html` optimizations (fonts + preconnect)
4. Apply Vite chunk splitting
5. Add `decoding="async"` across image components

