// @ts-check
import { defineConfig } from 'astro/config';
import node from '@astrojs/node';
export default defineConfig({
  output: 'server',
  adapter: node({mode: 'middleware'}),
  security: {
    allowedDomains: [
      {protocol: 'https', hostname: 'my-family-allowance-liordana.web.app'},
      {protocol: 'https', hostname: 'my-family-allowance-liordana.firebaseapp.com'},
      {protocol: 'http', hostname: 'localhost'},
      {protocol: 'http', hostname: '127.0.0.1'},
    ],
  },
});
