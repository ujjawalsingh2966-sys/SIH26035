const { test } = require('node:test');
const assert = require('node:assert/strict');
const { PHASE_DEVELOPMENT_SERVER, PHASE_PRODUCTION_BUILD, PHASE_PRODUCTION_SERVER } = require('next/constants');
const config = require('../next.config');

test('development and production servers never use the same default asset directory', () => {
  const previous = process.env.W8LAB_BROWSER_BUILD_DIR;
  delete process.env.W8LAB_BROWSER_BUILD_DIR;
  try {
    assert.equal(config(PHASE_DEVELOPMENT_SERVER).distDir, '.next-dev');
    assert.equal(config(PHASE_PRODUCTION_BUILD).distDir, '.next-production');
    assert.equal(config(PHASE_PRODUCTION_SERVER).distDir, '.next-production');
    assert.notEqual(config(PHASE_DEVELOPMENT_SERVER).distDir, config(PHASE_PRODUCTION_SERVER).distDir);
  } finally {
    if (previous === undefined) delete process.env.W8LAB_BROWSER_BUILD_DIR;
    else process.env.W8LAB_BROWSER_BUILD_DIR = previous;
  }
});

test('isolated browser verification retains its explicit cache override', () => {
  const previous = process.env.W8LAB_BROWSER_BUILD_DIR;
  process.env.W8LAB_BROWSER_BUILD_DIR = '.next-browser-review';
  try {
    assert.equal(config(PHASE_DEVELOPMENT_SERVER).distDir, '.next-browser-review');
    assert.equal(config(PHASE_PRODUCTION_BUILD).distDir, '.next-browser-review');
  } finally {
    if (previous === undefined) delete process.env.W8LAB_BROWSER_BUILD_DIR;
    else process.env.W8LAB_BROWSER_BUILD_DIR = previous;
  }
});
