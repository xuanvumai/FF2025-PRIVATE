'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

test('project metadata is present', () => {
  const pkg = require('../package.json');
  assert.equal(pkg.name, 'ff2025-private');
  assert.equal(pkg.engines.node, '24.x');
});
