import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  turbopack: {
    // Explicit workspace root silences the multi-lockfile detection warning
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
