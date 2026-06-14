import { defineConfig } from 'vitest/config'

// 순수 로직 단위 테스트만 (앱 vite.config의 PWA 등 플러그인 미로딩 → 빠르고 안정적)
export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
})
