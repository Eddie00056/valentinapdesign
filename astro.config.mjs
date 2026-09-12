// @ts-check
import { defineConfig } from 'astro/config';

import react from '@astrojs/react';
import { deckEdit } from './scripts/deck-edit-plugin.mjs';

// https://astro.build/config
export default defineConfig({
  site: 'https://valentinapdesign.com',
  integrations: [react()],
  // dev-only: saves the presentation's ?edit overrides (see the plugin)
  vite: { plugins: [deckEdit()] },
});