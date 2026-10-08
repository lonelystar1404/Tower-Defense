import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Relative asset paths so the build works on any static host (GitHub Pages subfolders, etc.).
  base: './',
  test: {
    include: ['tests/**/*.test.ts'],
  },
});
