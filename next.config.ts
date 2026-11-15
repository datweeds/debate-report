import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Requests pass through proxy.ts, which by default buffers at most 10 MB.
    // Society documents can be up to 50 MB (moderators), plus form overhead.
    proxyClientMaxBodySize: 55 * 1024 * 1024,
  },
};

export default nextConfig;
