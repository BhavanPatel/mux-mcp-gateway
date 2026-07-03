import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/setup.ts', 'src/registry.ts', 'src/tool-catalog.ts', 'src/tool-discovery.ts'],
  format: ['esm'],
  target: 'node20',
  outDir: 'dist',
  clean: true,
  splitting: false,
  sourcemap: true,
  banner: { js: '#!/usr/bin/env node' },
});
