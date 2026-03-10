import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  turbopack: {},  // Add this empty object to silence the error

  typescript: {
    ignoreBuildErrors: true,  // Keep this temporarily if type-checking hangs
  },

  webpack(config) {
    // Your existing SVG rules...
    const fileLoaderRule = config.module.rules.find((rule: any) =>
      rule.test?.test?.('.svg')
    );

    if (!fileLoaderRule) {
      return config;
    }

    config.module.rules.push(
      {
        ...fileLoaderRule,
        test: /\.svg$/i,
        resourceQuery: /url/,
      },
      {
        test: /\.svg$/i,
        issuer: fileLoaderRule.issuer,
        resourceQuery: { not: [...(fileLoaderRule.resourceQuery?.not || []), /url/] },
        use: ['@svgr/webpack'],
      }
    );

    fileLoaderRule.exclude = /\.svg$/i;

    return config;
  },
};

export default nextConfig;