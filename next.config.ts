import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // La géolocalisation est utilisée par le bouton « Ma position » (uniquement sur ce site).
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self)" },
];

// Dans GitHub Codespaces, le site est servi via une adresse *.app.github.dev :
// on l'autorise pour les formulaires (Server Actions), uniquement dans cet environnement.
const codespaceOrigins = process.env.CODESPACES === "true" ? ["*.app.github.dev"] : [];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  allowedDevOrigins: codespaceOrigins,
  experimental: { serverActions: { allowedOrigins: codespaceOrigins } },
  serverExternalPackages: ["@libsql/client", "libsql"],
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
