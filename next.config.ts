import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep the DB drivers out of the server bundle. pg is the production driver;
  // @electric-sql/pglite is the local-dev fallback, dynamically imported.
  serverExternalPackages: ["pg", "@electric-sql/pglite"],
};

export default nextConfig;
