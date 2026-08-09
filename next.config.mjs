/** @type {import('next').NextConfig} */

const isDev = process.env.NODE_ENV === "development";

const nextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(self), microphone=(self), geolocation=(self)",
          },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              // unsafe-inline: needed for themeInitScript in layout.js
              // unsafe-eval: React dev mode uses eval() for stack reconstruction; not needed in production
              `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
              "connect-src 'self' https://api.pwnedpasswords.com",
              "font-src 'self'",
              "img-src 'self' data: blob:",
              "style-src 'self' 'unsafe-inline'",
              "worker-src 'self'",
              // Hardening: no plugin/object, <base>, or form-submission surfaces
              "object-src 'none'",
              "base-uri 'none'",
              "form-action 'none'",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
