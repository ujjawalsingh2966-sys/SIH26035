const { PHASE_DEVELOPMENT_SERVER } = require('next/constants');

// A dev server rewrites its cache continuously. Never share that cache with
// next build/start: their HTML refers to immutable, hashed production assets.
module.exports = (phase) => ({
  distDir: process.env.W8LAB_BROWSER_BUILD_DIR
    || (phase === PHASE_DEVELOPMENT_SERVER ? '.next-dev' : '.next-production'),
  typescript: { tsconfigPath: 'tsconfig.browser.json' },
});
