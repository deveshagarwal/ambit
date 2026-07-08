import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root to this project. A stray package-lock.json in the
  // home directory otherwise makes Next infer the wrong root, which breaks
  // proxy (middleware) resolution and Clerk's clerkMiddleware() detection.
  turbopack: { root: __dirname },
  // Keep the DB drivers out of the server bundle. pg is the production driver;
  // @electric-sql/pglite is the local-dev fallback, dynamically imported.
  serverExternalPackages: ["pg", "@electric-sql/pglite"],
};

export default nextConfig;
