import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// 阶段 2：界面开发。
export default defineConfig({
  plugins: [react()],
  test: {
    include: ['tests/**/*.test.ts'],
  },
});
