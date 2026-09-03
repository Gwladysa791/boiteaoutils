const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const htmlPath = path.join(root, 'ROTI.html');
const configPath = path.join(root, 'roti-formateur-config.js');
const livePath = path.join(root, 'roti-live-session.js');
const html = fs.readFileSync(htmlPath, 'utf8');
const formateurView = html.match(/<section class="formateur-view"[\s\S]*?<\/section>/i)?.[0] || '';

test('ROTI exposes separate presentation, formateur and participant experiences', () => {
  assert.ok(formateurView, 'the dedicated formateur view is missing');
  assert.match(html, /<script src="tool-view-context\.js"><\/script>/);
  assert.match(html, /class="hero-desc"/);
  assert.match(html, /class="participant-eyebrow">Session en direct/);
  assert.match(html, /html\.mode-formateur[\s\S]*\.formateur-view\s*\{[^}]*display\s*:\s*block/i);
  assert.match(
    html,
    /html\.mode-formateur[\s\S]*\.hero-header[\s\S]*\.container[\s\S]*footer[\s\S]*display\s*:\s*none/i
  );
});

test('the ROTI formateur view is operational and contains no presentation copy', () => {
  for (const id of [
    'formateurView',
    'formateurTitleInput',
    'formateurInstructionInput',
    'formateurCommentModeInput',
    'formateurPreviewLink',
    'formateurResetButton',
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
    'formateurAverageScore',
    'formateurScoreDistribution',
    'formateurCommentsList',
    'formateurSyncSessionButton',
    'formateurCloseSessionButton',
    'formateurLiveError',
  ]) {
    assert.match(formateurView, new RegExp(`id="${id}"`), `${id} is missing`);
  }

  assert.doesNotMatch(formateurView, /2-5 minutes|combien valait|Outil de clôture/i);
});

test('the ROTI settings module sanitizes and persists participant configuration', {
  skip: !fs.existsSync(configPath),
}, () => {
  const config = require(configPath);
  const values = new Map();
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };

  assert.deepEqual(config.sanitize({
    title: '  Bilan de la journée  ',
    instruction: '  Donnez votre note.  ',
    commentMode: 'required',
  }), {
    title: 'Bilan de la journée',
    instruction: 'Donnez votre note.',
    commentMode: 'required',
  });
  assert.equal(config.sanitize({ commentMode: 'unexpected' }).commentMode, 'optional');

  config.save(storage, {
    title: 'Formation management',
    instruction: 'Évaluez le temps investi',
    commentMode: 'none',
  });
  assert.deepEqual(config.load(storage), {
    title: 'Formation management',
    instruction: 'Évaluez le temps investi',
    commentMode: 'none',
  });

  values.set(config.STORAGE_KEY, '{invalid json');
  assert.deepEqual(config.load(storage), config.DEFAULT_CONFIG);
  assert.equal(
    config.buildPreviewUrl('https://example.test/ROTI.html?view=formateur&live=OLD&comment=required&session=ABCDE', 'none'),
    'https://example.test/ROTI.html?view=participant&preview=1&comment=none'
  );
});

test('the ROTI live module aggregates valid votes and comments without duplicates', {
  skip: !fs.existsSync(livePath),
}, () => {
  const live = require(livePath);
  const tracker = live.createResponseTracker();

  assert.equal(tracker.add({ id: 'r1', pseudo: ' Alice ', payload: { score: 5, commentaire: ' Très utile. ' } }), true);
  assert.equal(tracker.add({ id: 'r1', pseudo: 'Alice', payload: { score: 5, commentaire: 'Doublon' } }), false);
  assert.equal(tracker.add({ id: 'r2', pseudo: '', payload: { score: 3, commentaire: '' } }), true);
  assert.equal(tracker.add({ id: 'r3', pseudo: 'Bob', payload: { score: 9, commentaire: 'Invalide' } }), false);

  assert.deepEqual(tracker.snapshot(), {
    total: 2,
    average: 4,
    distribution: [
      { score: 1, count: 0 },
      { score: 2, count: 0 },
      { score: 3, count: 1 },
      { score: 4, count: 0 },
      { score: 5, count: 1 },
    ],
    comments: [
      { pseudo: 'Alice', text: 'Très utile.', score: 5 },
    ],
  });
});

test('the ROTI live module builds resumable links and enforces one valid submission', {
  skip: !fs.existsSync(livePath),
}, () => {
  const live = require(livePath);

  assert.equal(
    live.buildParticipantUrl('https://example.test/ROTI.html?view=formateur&live=OLD', 'q7abc', 'required'),
    'https://example.test/ROTI.html?session=Q7ABC&comment=required'
  );
  assert.equal(
    live.buildFormateurSessionUrl('https://example.test/ROTI.html?view=participant&preview=1', 'q7abc', 'none'),
    'https://example.test/ROTI.html?view=formateur&live=Q7ABC&comment=none'
  );
  assert.deepEqual(live.sessionPatch({ title: '  Équipe Nord ', instruction: ' Votre note. ' }), {
    titre: 'Équipe Nord',
    consigne: 'Votre note.',
  });
  assert.equal(live.isCommentValid('required', '  '), false);
  assert.equal(live.isCommentValid('required', 'Une explication'), true);
  assert.equal(live.isCommentValid('optional', ''), true);
  assert.equal(live.canSubmit({ statut: 'ouverte' }, 0), true);
  assert.equal(live.canSubmit({ statut: 'ouverte' }, 1), false);
  assert.equal(live.canSubmit({ statut: 'fermee' }, 0), false);
  assert.equal(live.participantStatus(null, 0, ''), 'Connexion à la session…');
  assert.equal(live.participantStatus({ statut: 'ouverte' }, 0, "Erreur d'envoi"), "Erreur d'envoi");
  assert.equal(live.participantStatus({ statut: 'ouverte' }, 1, "Erreur d'envoi"), 'Merci, votre réponse a été transmise au formateur.');
  assert.equal(live.participantStatus({ statut: 'fermee' }, 0, "Erreur d'envoi"), 'Cette session est clôturée.');
});

test('ROTI loads the session cockpit dependencies and lifecycle', () => {
  assert.ok(fs.existsSync(configPath), 'roti-formateur-config.js is missing');
  assert.ok(fs.existsSync(livePath), 'roti-live-session.js is missing');
  assert.match(html, /<script src="roti-formateur-config\.js"><\/script>/);
  assert.match(html, /<script src="roti-live-session\.js"><\/script>/);
  assert.match(html, /<script src="qrcode-generator\.js"><\/script>/);
  assert.match(html, /AXMSession\.creerSession\('roti'/);
  assert.match(html, /AXMSession\.listerReponses/);
  assert.match(html, /AXMSession\.ecouterReponses/);
  assert.match(html, /AXMSession\.mettreAJourSession/);
  assert.match(html, /AXMSession\.fermerSession/);
});

test('resuming a ROTI session refreshes the participant preview link', () => {
  const resumeFunction = html.match(/async function reprendreSessionFormateur[\s\S]*?\n}/)?.[0] || '';
  assert.match(resumeFunction, /formateurPreviewLink/);
  assert.match(resumeFunction, /buildPreviewUrl/);
});

test('ROTI participant controls stay locked until an open session is confirmed', () => {
  assert.match(
    html,
    /if\(SESSION_CODE\)\s*\{\s*actualiserEtatSaisieParticipant\(\);\s*chargerScriptsSession\(initSessionMode\);/,
    'the participant can answer before the live session is confirmed'
  );
});

test('the participant ROTI scale fits on mobile without horizontal scrolling', () => {
  assert.match(
    html,
    /html\.mode-participant \.roti-scale\s*\{[^}]*display\s*:\s*grid[^}]*grid-template-columns\s*:\s*repeat\(5,minmax\(0,1fr\)\)/i
  );
  assert.match(html, /html\.mode-participant \.roti-def\s*\{[^}]*display\s*:\s*none/i);
});

test('all inline scripts in ROTI compile', () => {
  const inlineScripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)]
    .map((match) => match[1])
    .filter((source) => source.trim());

  assert.ok(inlineScripts.length > 0);
  inlineScripts.forEach((source, index) => {
    assert.doesNotThrow(
      () => new vm.Script(source, { filename: `ROTI.inline-${index}.js` }),
      `inline script ${index} must compile`
    );
  });
});
