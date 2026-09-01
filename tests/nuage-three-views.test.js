const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'Nuage_De_Mots.html'), 'utf8');
const configPath = path.join(root, 'nuage-formateur-config.js');
const formateurView = html.match(/<section class="formateur-view"[\s\S]*?<\/section>/i)?.[0] || '';

test('Nuage de mots exposes a dedicated operational formateur view', () => {
  assert.ok(formateurView, 'the dedicated formateur view is missing');

  for (const id of [
    'formateurView',
    'formateurTitleInput',
    'formateurInstructionInput',
    'formateurMaxWordsInput',
    'formateurPreviewLink',
    'formateurResetButton',
  ]) {
    assert.match(formateurView, new RegExp(`id="${id}"`), `${id} is missing`);
  }

  assert.doesNotMatch(formateurView, /5-10 minutes|ouvrir, clôturer ou ponctuer|Mots illimités/i);
  assert.match(html, /html\.mode-formateur[\s\S]*\.formateur-view\s*\{[^}]*display\s*:\s*block/i);
  assert.match(
    html,
    /html\.mode-formateur[\s\S]*\.hero-header[\s\S]*\.container[\s\S]*footer[\s\S]*display\s*:\s*none/i
  );
});

test('presentation and participant content remain available', () => {
  assert.match(html, /class="hero-desc"/);
  assert.match(html, /class="hero-stats"/);
  assert.match(html, /id="backToSommaire"/);
  assert.match(html, /class="participant-eyebrow">Session en direct/);
  assert.match(html, /class="participant-subtitle">Partagez les mots/);
  assert.match(html, /html\.mode-participant \.hero-header/);
});

test('the formateur settings module is available', () => {
  assert.ok(fs.existsSync(configPath), 'nuage-formateur-config.js is missing');
  assert.match(html, /<script src="nuage-formateur-config\.js"><\/script>/);
});

test('formateur settings are sanitized, persisted and used for participant previews', {
  skip: !fs.existsSync(configPath),
}, () => {
  const config = require(configPath);
  const values = new Map();
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };

  assert.deepEqual(config.sanitize({ title: '  Ma session  ', instruction: '  Trois mots.  ', maxWords: 99 }), {
    title: 'Ma session',
    instruction: 'Trois mots.',
    maxWords: 5,
  });

  config.save(storage, { title: 'Équipe projet', instruction: 'Un mot chacun', maxWords: 2 });
  assert.deepEqual(config.load(storage), {
    title: 'Équipe projet',
    instruction: 'Un mot chacun',
    maxWords: 2,
  });

  values.set(config.STORAGE_KEY, '{invalid json');
  assert.deepEqual(config.load(storage), config.DEFAULT_CONFIG);

  assert.equal(
    config.buildPreviewUrl('https://example.test/Nuage_De_Mots.html?view=formateur&session=123456'),
    'https://example.test/Nuage_De_Mots.html?view=participant&preview=1'
  );
});

test('all inline scripts in Nuage de mots compile', () => {
  const inlineScripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)]
    .map((match) => match[1])
    .filter((source) => source.trim());

  assert.ok(inlineScripts.length > 0);
  inlineScripts.forEach((source, index) => {
    assert.doesNotThrow(
      () => new vm.Script(source, { filename: `Nuage_De_Mots.inline-${index}.js` }),
      `inline script ${index} must compile`
    );
  });
});
