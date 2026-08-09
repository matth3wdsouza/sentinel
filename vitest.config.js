import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // happy-dom is a lightweight browser simulator. We need it (rather than
    // plain Node) because encrypt.js and hibp.js both call crypto.subtle,
    // which is a browser API. happy-dom ships its own Web Crypto
    // implementation so those calls just work — no polyfill required.
    environment: "happy-dom",

    // Print each test name as it runs, not just a dot. Easier to follow
    // when you're new to a test suite.
    reporter: "verbose",
  },

  resolve: {
    // Mirror the @/ alias from jsconfig.json so imports like
    // import { encryptText } from "@/lib/encrypt" resolve correctly
    // inside the test environment.
    alias: {
      "@": new URL("./src", import.meta.url).pathname,
    },
  },
});
