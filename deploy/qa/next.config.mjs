import base from './next.base.config.mjs';

// Used only in a disposable QA source snapshot, never the production checkout.
export default {
  ...base,
  distDir: '.next',
  output: 'standalone',
  outputFileTracingRoot: process.cwd(),
  turbopack: { ...base.turbopack, root: process.cwd() },
};
