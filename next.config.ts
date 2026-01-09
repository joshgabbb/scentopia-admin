import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // REMOVED: eslint block (no longer supported in Next.js 16)

  typescript: {
    // Temporarily skip TypeScript type-checking during Vercel builds
    // (run `next build` locally to catch errors)
    ignoreBuildErrors: true,
  },

  webpack(config) {
    // Find the existing file loader rule that handles SVGs
    const fileLoaderRule = config.module.rules.find((rule: any) =>
      rule.test?.test?.('.svg')
    );

    if (!fileLoaderRule) {
      return config;
    }

    config.module.rules.push(
      // Reapply the existing file loader for ?url imports
      {
        ...fileLoaderRule,
        test: /\.svg$/i,
        resourceQuery: /url/,
      },
      // Convert other *.svg imports to React components
      {
        test: /\.svg$/i,
        issuer: fileLoaderRule.issuer,
        resourceQuery: { not: [...(fileLoaderRule.resourceQuery?.not || []), /url/] },
        use: ['@svgr/webpack'],
      }
    );

    // Exclude .svg from the default file loader
    fileLoaderRule.exclude = /\.svg$/i;

    return config;
  },
};

export default nextConfig;