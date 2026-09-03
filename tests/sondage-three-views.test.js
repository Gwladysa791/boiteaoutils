const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const htmlPath = path.join(root, 'Outil_Sondage.html');
const configPath = path.join(root, 'sondage-formateur-config.js');
const livePath = path.join(root, 'sondage-live-session.js');
const html = fs.readFileSync(htmlPath, 'utf8');

test('Sondage exposes dedicated formateur and participant workspaces', () => {
  assert.match(html, /id="sondageFormateurView"/);
  assert.match(html, /id="sondageParticipantView"/);
  assert.match(html, /html\.mode-formateur[\s\S]*#sondageFormateurView\s*\{[^}]*display\s*:\s*block/i);
  assert.match(html, /html\.mode-participant[\s\S]*#sondageParticipantView\s*\{[^}]*display\s*:\s*block/i);
});

test('the Sondage trainer workspace contains preparation, preview and live controls', () => {
  const requiredIds = [
    'sondageTitleInput',
    'sondageQuestionInput',
    'sondageOptionsEditor',
    'sondageAddOptionButton',
    'sondagePreviewQuestion',
    'sondagePreviewOptions',
    'sondagePreviewLink',
    'sondageOpenSessionButton',
    'sondageLiveCode',
    'sondageLiveQr',
    'sondageLiveUrl',
    'sondageCopyLinkButton',
    'sondageResponseCount',
    'sondageChartArea',
    'sondageChartPieButton',
    'sondageChartBarsButton',
    'sondageCloseSessionButton',
  ];
  requiredIds.forEach((id) => assert.match(html, new RegExp(`id="${id}"`), `${id} is missing`));

  const trainer = html.match(/<section[^>]+id="sondageFormateurView"[\s\S]*?<\/section>/i)?.[0] || '';
  assert.doesNotMatch(trainer, /5-15 minutes|idéal pour|permet de/i);
});

test('Sondage drafts trim choices, preserve stable ids and enforce 2 to 8 answers', () => {
  assert.ok(fs.existsSync(configPath), 'sondage-formateur-config.js is missing');
  const config = require(configPath);
  const draft = config.sanitize({
    title: '  Priorités équipe  ',
    question: '  Quel sujet traiter en premier ?  ',
    options: [
      { id: 'a', text: '  Organisation  ' },
      { id: 'b', text: 'Communication' },
      { id: 'c', text: '   ' },
    ],
  });

  assert.deepEqual(draft, {
    title: 'Priorités équipe',
    question: 'Quel sujet traiter en premier ?',
    options: [
      { id: 'a', text: 'Organisation' },
      { id: 'b', text: 'Communication' },
      { id: 'c', text: '' },
    ],
  });
  assert.equal(config.validate(draft), null);
  assert.equal(config.validate({ title: 'Sondage', question: '', options: [] }), 'Rédigez la question du sondage.');
  assert.equal(config.validate({ title: 'Sondage', question: 'Choix ?', options: [{ id: 'a', text: 'Oui' }] }), 'Ajoutez au moins deux réponses possibles.');
  assert.equal(config.sanitize({ title: 'S', question: 'Q', options: Array.from({ length: 10 }, (_, i) => ({ id: `o${i}`, text: `Choix ${i}` })) }).options.length, 8);
});

test('Sondage drafts persist locally and produce a participant preview URL', () => {
  assert.ok(fs.existsSync(configPath), 'sondage-formateur-config.js is missing');
  const config = require(configPath);
  const values = new Map();
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
  const saved = config.save(storage, {
    title: 'Décision collective',
    question: 'Votre préférence ?',
    options: [{ id: 'x', text: 'A' }, { id: 'y', text: 'B' }],
  });
  assert.deepEqual(config.load(storage), saved);
  assert.equal(
    config.buildPreviewUrl('https://example.test/Outil_Sondage.html?view=formateur&live=OLD&session=ABC'),
    'https://example.test/Outil_Sondage.html?view=participant&preview=1'
  );
});

test('Sondage live sessions serialize configuration and restore it safely', () => {
  assert.ok(fs.existsSync(livePath), 'sondage-live-session.js is missing');
  const live = require(livePath);
  const config = {
    title: 'Décision collective',
    question: 'Votre préférence ?',
    options: [{ id: 'x', text: 'A' }, { id: 'y', text: 'B' }],
  };
  assert.deepEqual(live.sessionPatch(config), {
    titre: 'Décision collective',
    consigne: 'Votre préférence ?',
    configuration: {
      question: 'Votre préférence ?',
      options: [{ id: 'x', text: 'A' }, { id: 'y', text: 'B' }],
    },
  });
  assert.deepEqual(live.readSessionConfig({
    titre: 'Décision collective',
    consigne: 'Ancienne question',
    configuration: {
      question: 'Question en direct',
      options: [{ id: 'x', text: 'A' }, { id: 'y', text: 'B' }],
    },
  }), {
    title: 'Décision collective',
    question: 'Question en direct',
    options: [{ id: 'x', text: 'A' }, { id: 'y', text: 'B' }],
  });
});

test('Sondage vote aggregation rejects duplicate and unknown choices', () => {
  assert.ok(fs.existsSync(livePath), 'sondage-live-session.js is missing');
  const live = require(livePath);
  const tracker = live.createVoteTracker([
    { id: 'yes', text: 'Oui' },
    { id: 'no', text: 'Non' },
  ]);

  assert.equal(tracker.add({ id: 'r1', payload: { optionId: 'yes' } }), true);
  assert.equal(tracker.add({ id: 'r1', payload: { optionId: 'no' } }), false);
  assert.equal(tracker.add({ id: 'r2', payload: { optionId: 'unknown' } }), false);
  assert.equal(tracker.add({ id: 'r3', payload: { optionId: 'no' } }), true);
  assert.deepEqual(tracker.snapshot(), {
    total: 2,
    results: [
      { id: 'yes', text: 'Oui', count: 1, percentage: 50 },
      { id: 'no', text: 'Non', count: 1, percentage: 50 },
    ],
  });
});

test('Sondage live links and participant state enforce a single vote', () => {
  assert.ok(fs.existsSync(livePath), 'sondage-live-session.js is missing');
  const live = require(livePath);
  assert.equal(
    live.buildParticipantUrl('https://example.test/Outil_Sondage.html?view=formateur&live=OLD', 'q7abc'),
    'https://example.test/Outil_Sondage.html?session=Q7ABC'
  );
  assert.equal(
    live.buildTrainerUrl('https://example.test/Outil_Sondage.html?view=participant&preview=1', 'q7abc'),
    'https://example.test/Outil_Sondage.html?view=formateur&live=Q7ABC'
  );
  assert.equal(live.canVote({ statut: 'ouverte' }, 0), true);
  assert.equal(live.canVote({ statut: 'ouverte' }, 1), false);
  assert.equal(live.canVote({ statut: 'fermee' }, 0), false);
  assert.equal(live.participantStatus({ statut: 'ouverte' }, 1, ''), 'Merci, votre vote a été enregistré.');
  assert.equal(live.participantStatus({ statut: 'fermee' }, 0, ''), 'Ce sondage est clôturé.');
});

test('Sondage loads the live-session dependencies and creates sondage sessions', () => {
  assert.match(html, /<script src="sondage-formateur-config\.js"><\/script>/);
  assert.match(html, /<script src="sondage-live-session\.js"><\/script>/);
  assert.match(html, /<script src="qrcode-generator\.js"><\/script>/);
  assert.match(html, /AXMSession\.creerSession\('sondage'/);
  assert.match(html, /AXMSession\.ecouterReponses/);
  assert.match(html, /AXMSession\.fermerSession/);
});

test('all inline scripts in Sondage compile', () => {
  const inlineScripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)]
    .map((match) => match[1])
    .filter((source) => source.trim());
  assert.ok(inlineScripts.length > 0);
  inlineScripts.forEach((source, index) => {
    assert.doesNotThrow(() => new vm.Script(source, { filename: `Sondage.inline-${index}.js` }));
  });
});
