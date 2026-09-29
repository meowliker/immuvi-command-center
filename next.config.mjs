/** @type {import('next').NextConfig} */
const nextConfig = {
  distDir: process.env.QA_NEXT_DIST_DIR || '.next',
  agentRules: false,
  poweredByHeader: false,
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
