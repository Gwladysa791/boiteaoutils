const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'Nuage_De_Mots.html'), 'utf8');
const configPath = path.join(root, 'nuage-formateur-config.js');
const livePath = path.join(root, 'nuage-live-session.js');
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
    config.buildPreviewUrl('https://example.test/Nuage_De_Mots.html?view=formateur&live=ABCDE&maxWords=4&session=123456'),
    'https://example.test/Nuage_De_Mots.html?view=participant&preview=1'
  );
});

test('the formateur view contains the complete live-session cockpit', () => {
  for (const id of [
    'formateurOpenSessionButton',
    'formateurLiveSetup',
    'formateurLiveActive',
    'formateurLiveStatus',
    'formateurLiveCode',
    'formateurLiveQr',
    'formateurLiveUrl',
    'formateurCopyLinkButton',
    'formateurLiveParticipantLink',
    'formateurResponseCount',
    'formateurLiveCloud',
    'formateurSyncSessionButton',
    'formateurCloseSessionButton',
    'formateurLiveError',
  ]) {
    assert.match(formateurView, new RegExp(`id="${id}"`), `${id} is missing`);
  }

  assert.match(html, /<script src="qrcode-generator\.js"><\/script>/);
  assert.match(html, /<script src="nuage-live-session\.js"><\/script>/);
  assert.match(html, /AXMSession\.creerSession\('nuage_mots'/);
  assert.match(html, /AXMSession\.listerReponses/);
  assert.match(html, /AXMSession\.ecouterReponses/);
  assert.match(html, /AXMSession\.mettreAJourSession/);
  assert.match(html, /AXMSession\.fermerSession/);
});

test('the live-session state module builds safe URLs and deduplicates responses', {
  skip: !fs.existsSync(livePath),
}, () => {
  const live = require(livePath);

  assert.equal(
    live.buildParticipantUrl('https://example.test/Nuage_De_Mots.html?view=formateur&live=OLD', 'Q7ABC', 4),
    'https://example.test/Nuage_De_Mots.html?session=Q7ABC&maxWords=4'
  );
  assert.equal(
    live.buildFormateurSessionUrl('https://example.test/Nuage_De_Mots.html?view=participant&preview=1', 'Q7ABC', 4),
    'https://example.test/Nuage_De_Mots.html?view=formateur&live=Q7ABC&maxWords=4'
  );
  assert.deepEqual(live.sessionPatch({ title: '  Équipe Nord ', instruction: ' Deux mots. ' }), {
    titre: 'Équipe Nord',
    consigne: 'Deux mots.',
  });

  const tracker = live.createResponseTracker();
  assert.equal(tracker.add({ id: 'r1', payload: { mot: 'Écoute' } }), true);
  assert.equal(tracker.add({ id: 'r1', payload: { mot: 'Écoute' } }), false);
  assert.equal(tracker.add({ id: 'r2', payload: { mot: 'écoute' } }), true);
  assert.equal(tracker.add({ id: 'r3', payload: { mot: 'Confiance' } }), true);
  assert.deepEqual(tracker.snapshot(), {
    total: 3,
    words: [
      { text: 'Écoute', count: 2 },
      { text: 'Confiance', count: 1 },
    ],
  });

  assert.equal(live.canSubmit({ statut: 'ouverte' }, 1, 2), true);
  assert.equal(live.canSubmit({ statut: 'ouverte' }, 2, 2), false);
  assert.equal(live.canSubmit({ statut: 'ouverte' }, 99, null), true);
  assert.equal(live.canSubmit({ statut: 'fermee' }, 0, 2), false);
});

test('the live-session state module is available', () => {
  assert.ok(fs.existsSync(livePath), 'nuage-live-session.js is missing');
});

test('participant input is locked before the asynchronous session connection starts', () => {
  assert.match(
    html,
    /if\(SESSION_CODE\)\s*\{\s*actualiserEtatSaisieParticipant\(\);\s*chargerScriptsSession\(initSessionMode\);/,
    'the participant can type before the live session is confirmed'
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
