import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import vercel from '@astrojs/vercel/serverless';

// Proveravamo koja platforma radi build na osnovu env varijabli
const adapterToUse = process.env.VERCEL ? vercel() : cloudflare();

export default defineConfig({
  output: 'server',
  adapter: adapterToUse,
  security: { checkOrigin: true }
});
