import { defineCloudflareConfig } from "@opennextjs/cloudflare";

const config = defineCloudflareConfig({});

export default {
  ...config,
  // Avoid recursing into `opennextjs-cloudflare build` when Cloudflare runs the build script.
  // Webpack is required so Serwist can emit public/sw.js (Turbopack is unsupported).
  buildCommand: "next build --webpack",
};
