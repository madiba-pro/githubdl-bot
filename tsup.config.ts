import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/worker.ts', 'api/webhook.ts'],
  format: ['esm'],
  clean: true,
  dts: false,
  sourcemap: true,
});
