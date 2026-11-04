import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const css=fs.readFileSync(new URL('../src/appEnhancements.css',import.meta.url),'utf8');
const jsx=fs.readFileSync(new URL('../src/Dashboards.jsx',import.meta.url),'utf8');
test('teacher round card uses the PDF yellow surface and navy actions',()=>{assert.ok(jsx.includes('<Card className="pd-round-card">'));assert.match(css,/\.pd-shell \.pd-round-card\{background:#ffce3a/);});
test('reading tiers use the four distinct PDF colours',()=>{for(const color of ['#ffcd3c','#24c474','#ff85cf','#4d88ff'])assert.ok(css.includes(`background:${color}!important`));});
test('guidelines use the navy focus card and parent progress uses the dedicated PDF view',()=>{assert.ok(jsx.includes('app-guideline-focus'));assert.ok(jsx.includes('<ParentProgress learner={child}'));assert.match(css,/\.app-guideline-focus\{background:#17183f/);});
