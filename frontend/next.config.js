// Give local browser verification its own build cache while another dev server runs.
module.exports = {
  distDir: process.env.W8LAB_BROWSER_BUILD_DIR || '.next',
  ...(process.env.W8LAB_BROWSER_BUILD_DIR ? { typescript: { tsconfigPath: 'tsconfig.browser.json' } } : {}),
};
