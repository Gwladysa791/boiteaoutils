const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const htmlPath = path.join(root, 'Brainstorming.html');
const configPath = path.join(root, 'brainstorming-formateur-config.js');
const livePath = path.join(root, 'brainstorming-live-session.js');
const html = fs.readFileSync(htmlPath, 'utf8');

test('Brainstorming exposes dedicated formateur and participant workspaces', () => {
  assert.match(html, /id="brainstormingFormateurView"/);
  assert.match(html, /id="brainstormingParticipantView"/);
  assert.match(html, /html\.mode-formateur[\s\S]*#brainstormingFormateurView\s*\{[^}]*display\s*:\s*block/i);
  assert.match(html, /html\.mode-participant[\s\S]*#brainstormingParticipantView\s*\{[^}]*display\s*:\s*block/i);
});

test('the Brainstorming trainer workspace contains preparation and two-phase live controls', () => {
  const requiredIds = [
    'brainstormingTitleInput',
    'brainstormingInstructionInput',
    'brainstormingColumnsEditor',
    'brainstormingAddColumnButton',
    'brainstormingMaxIdeasInput',
    'brainstormingMaxVotesInput',
    'brainstormingPreviewLink',
    'brainstormingOpenSessionButton',
    'brainstormingLiveCode',
    'brainstormingLiveQr',
    'brainstormingLiveUrl',
    'brainstormingCopyLinkButton',
    'brainstormingIdeaCount',
    'brainstormingPhaseBadge',
    'brainstormingStartVoteButton',
    'brainstormingTrainerBoard',
    'brainstormingCloseSessionButton',
  ];
  requiredIds.forEach((id) => assert.match(html, new RegExp(`id="${id}"`), `${id} is missing`));

  const trainer = html.match(/<section[^>]+id="brainstormingFormateurView"[\s\S]*?<\/section>/i)?.[0] || '';
  assert.doesNotMatch(trainer, /20-40 minutes|idéal pour|permet de|outil d'animation collective/i);
});

test('the participant workspace separates private collection from revealed voting', () => {
  const requiredIds = [
    'brainstormingParticipantTitle',
    'brainstormingParticipantInstruction',
    'brainstormingParticipantPhase',
    'brainstormingParticipantColumnInputs',
    'brainstormingParticipantStatus',
    'brainstormingParticipantBoard',
    'brainstormingParticipantVoteStatus',
  ];
  requiredIds.forEach((id) => assert.match(html, new RegExp(`id="${id}"`), `${id} is missing`));
});

test('participant collection renders every column as a visible input card', () => {
  const live = require(livePath);
  const markup = live.renderParticipantColumnCards([
    { id: 'faits', name: 'Les faits' },
    { id: 'idees', name: 'Les idées' },
    { id: 'actions', name: 'Les actions' },
  ]);

  assert.equal((markup.match(/class="participant-column-card"/g) || []).length, 3);
  assert.match(markup, />Les faits</);
  assert.match(markup, />Les idées</);
  assert.match(markup, />Les actions</);
  assert.equal((markup.match(/data-brainstorming-column=/g) || []).length, 3);
  assert.match(markup, /style="--participant-accent:#00B5E2"/);
  assert.match(markup, /style="--participant-accent:#884EC2"/);
  assert.match(markup, /style="--participant-accent:#15CA88"/);
  assert.doesNotMatch(markup, /<select/i);
});

test('Brainstorming drafts normalize columns and enforce practical mobile limits', () => {
  assert.ok(fs.existsSync(configPath), 'brainstorming-formateur-config.js is missing');
  const config = require(configPath);
  const draft = config.sanitize({
    title: '  Priorités équipe  ',
    instruction: '  Proposez une action concrète.  ',
    columns: [
      { id: 'actions', name: '  Actions  ' },
      { id: 'freins', name: 'Freins' },
      { id: 'vide', name: '   ' },
    ],
    maxIdeas: 20,
    maxVotes: 0,
  });

  assert.deepEqual(draft, {
    title: 'Priorités équipe',
    instruction: 'Proposez une action concrète.',
    columns: [
      { id: 'actions', name: 'Actions' },
      { id: 'freins', name: 'Freins' },
      { id: 'vide', name: '' },
    ],
    maxIdeas: 5,
    maxVotes: 1,
  });
  assert.equal(config.validate(draft), 'Nommez chaque colonne.');
  assert.equal(config.validate({ title: 'Brainstorming', instruction: '', columns: [] }), 'Rédigez la consigne du brainstorming.');
  assert.equal(config.validate({ title: 'Brainstorming', instruction: 'Une idée', columns: [{ id: 'a', name: 'Idées' }] }), 'Ajoutez au moins deux colonnes.');
});

test('Brainstorming drafts persist locally and build a participant preview URL', () => {
  const config = require(configPath);
  const values = new Map();
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
  const saved = config.save(storage, {
    title: 'Décisions équipe',
    instruction: 'Une idée par post-it.',
    columns: [{ id: 'a', name: 'Idées' }, { id: 'b', name: 'Décisions' }],
    maxIdeas: 3,
    maxVotes: 2,
  });
  assert.deepEqual(config.load(storage), saved);
  assert.equal(
    config.buildPreviewUrl('https://example.test/Brainstorming.html?view=formateur&live=OLD&session=ABC'),
    'https://example.test/Brainstorming.html?view=participant&preview=1'
  );
});

test('Brainstorming sessions serialize configuration with a private collection phase', () => {
  assert.ok(fs.existsSync(livePath), 'brainstorming-live-session.js is missing');
  const live = require(livePath);
  const config = {
    title: 'Décisions équipe',
    instruction: 'Une idée par post-it.',
    columns: [{ id: 'a', name: 'Idées' }, { id: 'b', name: 'Décisions' }],
    maxIdeas: 3,
    maxVotes: 2,
  };
  assert.deepEqual(live.sessionPatch(config, 'collecte'), {
    titre: 'Décisions équipe',
    consigne: 'Une idée par post-it.',
    configuration: {
      columns: [{ id: 'a', name: 'Idées' }, { id: 'b', name: 'Décisions' }],
      maxIdeas: 3,
      maxVotes: 2,
      phase: 'collecte',
    },
  });
  assert.equal(live.readSessionConfig({
    titre: 'Décisions équipe',
    consigne: 'Ancienne consigne',
    configuration: {
      columns: [{ id: 'a', name: 'Idées' }, { id: 'b', name: 'Décisions' }],
      maxIdeas: 3,
      maxVotes: 2,
      phase: 'vote',
    },
  }).phase, 'vote');
});

test('Brainstorming event tracker rebuilds moves and limited votes', () => {
  const live = require(livePath);
  const tracker = live.createBoardTracker(
    [{ id: 'a', name: 'Idées' }, { id: 'b', name: 'Décisions' }],
    2,
    3
  );

  assert.equal(tracker.add({ id: 'r1', payload: { type: 'idea', clientId: 'p1', columnId: 'a', text: 'Tester', color: 'jaune' } }), true);
  assert.equal(tracker.add({ id: 'r2', payload: { type: 'idea', clientId: 'p2', columnId: 'b', text: 'Mesurer', color: 'vert' } }), true);
  assert.equal(tracker.add({ id: 'r3', payload: { type: 'move', ideaId: 'r1', columnId: 'b' } }), true);
  assert.equal(tracker.add({ id: 'r4', payload: { type: 'vote', clientId: 'p1', ideaId: 'r1' } }), true);
  assert.equal(tracker.add({ id: 'r5', payload: { type: 'vote', clientId: 'p1', ideaId: 'r1' } }), false);
  assert.equal(tracker.add({ id: 'r6', payload: { type: 'vote', clientId: 'p1', ideaId: 'r2' } }), true);
  assert.equal(tracker.add({ id: 'r7', payload: { type: 'vote', clientId: 'p1', ideaId: 'unknown' } }), false);

  assert.deepEqual(tracker.snapshot(), {
    totalIdeas: 2,
    totalVotes: 2,
    ideas: [
      { id: 'r1', clientId: 'p1', columnId: 'b', text: 'Tester', color: 'jaune', pseudo: '', votes: 1 },
      { id: 'r2', clientId: 'p2', columnId: 'b', text: 'Mesurer', color: 'vert', pseudo: '', votes: 1 },
    ],
  });
  assert.deepEqual(tracker.participantCounts('p1'), { ideas: 1, votes: 2 });
});

test('Brainstorming phase guards prevent early viewing and over-submission', () => {
  const live = require(livePath);
  const session = { statut: 'ouverte' };
  assert.equal(live.canSubmitIdea(session, 'collecte', 2, 3), true);
  assert.equal(live.canSubmitIdea(session, 'collecte', 3, 3), false);
  assert.equal(live.canSubmitIdea(session, 'vote', 0, 3), false);
  assert.equal(live.canViewBoard(session, 'collecte'), false);
  assert.equal(live.canViewBoard(session, 'vote'), true);
  assert.equal(live.canVote(session, 'vote', 1, 2), true);
  assert.equal(live.canVote(session, 'vote', 2, 2), false);
  assert.equal(live.canVote({ statut: 'fermee' }, 'vote', 0, 2), false);
});

test('Brainstorming loads live dependencies and creates brainstorming sessions', () => {
  assert.match(html, /<script src="brainstorming-formateur-config\.js"><\/script>/);
  assert.match(html, /<script src="brainstorming-live-session\.js"><\/script>/);
  assert.match(html, /<script src="qrcode-generator\.js"><\/script>/);
  assert.match(html, /AXMSession\.creerSession\('brainstorming'/);
  assert.match(html, /AXMSession\.ecouterReponses/);
  assert.match(html, /AXMSession\.ecouterSession/);
  assert.match(html, /AXMSession\.mettreAJourSession/);
  assert.match(html, /AXMSession\.fermerSession/);
});

test('all inline scripts in Brainstorming compile', () => {
  const inlineScripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)]
    .map((match) => match[1])
    .filter((source) => source.trim());
  assert.ok(inlineScripts.length > 0);
  inlineScripts.forEach((source, index) => {
    assert.doesNotThrow(() => new vm.Script(source, { filename: `Brainstorming.inline-${index}.js` }));
  });
});
