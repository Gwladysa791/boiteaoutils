const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '..', 'Espace_Formateur.html'), 'utf8');
const body = html.match(/<body>([\s\S]*)<\/body>/i)?.[1] || '';

test('the Studio opens as a compact formateur workspace', () => {
  const workspaceHeader = body.match(/<section class="studio-workspace-header"[\s\S]*?<\/section>/i)?.[0];

  assert.ok(workspaceHeader, 'the compact Studio workspace header is missing');
  assert.match(workspaceHeader, /STUDIO D'ANIMATION/);
  assert.match(workspaceHeader, /Studio d'animation pédagogique/);
  assert.match(workspaceHeader, /id="studioNameInput"/);
  assert.match(workspaceHeader, /id="logoControl"/);
  assert.match(workspaceHeader, /id="logoFileInput"/);
  assert.doesNotMatch(body, /class="hero-header"/);
  assert.doesNotMatch(body, /class="intro"/);
});

test('the compact header preserves each functional Studio hook exactly once', () => {
  for (const id of ['studioNameInput', 'logoControl', 'logoFileInput', 'studioPanel']) {
    const occurrences = body.match(new RegExp(`id="${id}"`, 'g')) || [];
    assert.equal(occurrences.length, 1, `${id} must appear exactly once`);
  }
});
