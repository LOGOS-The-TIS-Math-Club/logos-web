import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  images: {
    /*
     * Google profile pictures for the signed-in avatar. Next fetches and
     * re-serves these from our own origin, so the browser never contacts
     * Google and the `img-src 'self' data:` policy in proxy.ts stays intact.
     */
    remotePatterns: [
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
    ],
  },
};

export default nextConfig;
