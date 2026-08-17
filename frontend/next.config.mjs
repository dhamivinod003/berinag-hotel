/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "res.cloudinary.com" },
      { protocol: "https", hostname: "plus.unsplash.com" },
    ],
  },
  // NOTE: keep `optimizePackageImports` away from framer-motion. The
  // barrel-optimizer rewrites its `motion.div` etc. exports into barrel
  // lookups that break the React Client Manifest ("Could not find the
  // module ... framer-motion ... in the React Client Manifest").
  // Keeping it for lucide-react only.
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },
};

export default nextConfig;
