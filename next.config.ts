import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // /resources came down when the Directory grew to cover it. The URL was in
  // the nav for months and is in old newsletter issues, so it forwards rather
  // than 404s. Permanent, because it is not coming back.
  async redirects() {
    return [{ source: "/resources", destination: "/directory", permanent: true }];
  },
};

export default nextConfig;
