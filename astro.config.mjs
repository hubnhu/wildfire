import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://wildfire.hubn.com',
  output: 'static',
  trailingSlash: 'never',
  build: { format: 'directory' },
  devToolbar: { enabled: false },
});
