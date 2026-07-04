import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  sassOptions: {
    silenceDeprecations: ["legacy-js-api"]
  }
};

export default nextConfig;
