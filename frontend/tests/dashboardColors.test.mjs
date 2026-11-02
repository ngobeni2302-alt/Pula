import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const cssPath = path.resolve('frontend/src/dashboards.css');
const jsxPath = path.resolve('frontend/src/Dashboards.jsx');

test('Teacher Home: Reading activity card has Coral background (#FF6B4A)', () => {
  const css = fs.readFileSync(cssPath, 'utf8');
  const jsx = fs.readFileSync(jsxPath, 'utf8');

  // Verify class in JSX
  assert.ok(
    jsx.includes('<Card className="pd-coral">'),
    'Teacher reading activity card must use pd-coral class'
  );

  // Verify background color in CSS
  assert.match(
    css,
    /\.pd-coral\s*\{\s*background:\s*#FF6B4A/i,
    '.pd-coral must have background #FF6B4A (Coral)'
  );

  // Verify dark navy text for contrast
  assert.match(
    css,
    /\.pd-coral\s+h2\s*\{[^}]*color:\s*var\(--pula-navy\)/i,
    '.pd-coral h2 must use dark navy text for contrast'
  );
});

test('Teacher Home: All four Reading Groups tier cards have Periwinkle background (#8E9BFF)', () => {
  const css = fs.readFileSync(cssPath, 'utf8');
  const jsx = fs.readFileSync(jsxPath, 'utf8');

  // Verify teacher reading groups container has pd-teacher-groups
  assert.ok(
    jsx.includes('className="pd-groups pd-teacher-groups"'),
    'Teacher Reading Groups container must be scoped with pd-teacher-groups'
  );

  // Verify all four tiers get #8E9BFF
  assert.match(
    css,
    /\.pd-teacher-groups\s+\.pd-group[\s\S]*?background:\s*#8E9BFF/i,
    'Teacher reading groups must have background #8E9BFF (Periwinkle)'
  );

  // Verify dark navy text and icon colors
  assert.match(
    css,
    /\.pd-teacher-groups\s+\.pd-group[\s\S]*?color:\s*var\(--pula-navy\)/i,
    'Teacher reading groups must maintain dark navy color'
  );
});

test('Parent Home: Reading groups retain original pastel colors (unmodified)', () => {
  const css = fs.readFileSync(cssPath, 'utf8');
  const jsx = fs.readFileSync(jsxPath, 'utf8');

  // Verify parent reading groups do not have pd-teacher-groups
  const parentSection = jsx.slice(jsx.indexOf("{!teacher && page === 'Home'"));
  assert.ok(
    parentSection.includes('<div className="pd-groups">'),
    'Parent reading groups must remain pd-groups without pd-teacher-groups'
  );
  assert.ok(
    !parentSection.includes('<div className="pd-groups pd-teacher-groups">'),
    'Parent reading groups must not use pd-teacher-groups'
  );

  // Verify original tier colors exist
  assert.match(css, /\.g0\s*\{\s*background:\s*var\(--pula-sand\)\s*\}/);
  assert.match(css, /\.g1\s*\{\s*background:\s*var\(--pula-sage\)\s*\}/);
  assert.match(css, /\.g2\s*\{\s*background:\s*var\(--pula-lavender\)\s*\}/);
  assert.match(css, /\.g3\s*\{\s*background:\s*var\(--pula-blue\)\s*\}/);
});
