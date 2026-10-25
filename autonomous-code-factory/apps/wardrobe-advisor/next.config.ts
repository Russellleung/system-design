import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Render's Docker image uses Next's minimal standalone server. The Sites /
  // Vinext build keeps its existing output shape.
  output: process.env.PORTABLE_DOCKER_BUILD === "1" ? "standalone" : undefined,
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
