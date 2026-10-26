/// <reference types="vitest/config" />
import { getViteConfig } from 'astro/config';

// Astro's Vite config, so unit tests can import .astro components and render them
// with the Container API (tests/unit/analytics-beacon.test.ts).
export default getViteConfig({
  test: {
    include: ['tests/unit/**/*.test.ts'],
  },
});
