(function(root, factory) {
  const api = factory();

  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.AxisMundiBrainstormingLive = api;
})(typeof window !== 'undefined' ? window : globalThis, function() {
  'use strict';

  const VALID_PHASES = ['collecte', 'vote', 'resultats'];
  const VALID_COLORS = ['jaune', 'violet', 'vert', 'rose', 'bleu', 'gris'];

  function cleanSessionUrl(href) {
    const url = new URL(href);
    ['view', 'preview', 'session', 'live'].forEach(function(key) { url.searchParams.delete(key); });
    return url;
  }

  function buildParticipantUrl(href, code) {
    const url = cleanSessionUrl(href);
    url.searchParams.set('session', String(code || '').toUpperCase().trim());
    return url.href;
  }

  function buildTrainerUrl(href, code) {
    const url = cleanSessionUrl(href);
    url.searchParams.set('view', 'formateur');
    url.searchParams.set('live', String(code || '').toUpperCase().trim());
    return url.href;
  }

  function clamp(value, minimum, maximum, fallback) {
    const number = Number.parseInt(value, 10);
    if (!Number.isFinite(number)) return fallback;
    return Math.max(minimum, Math.min(maximum, number));
  }

  function normalizeColumns(value) {
    const source = Array.isArray(value) ? value.slice(0, 6) : [];
    const usedIds = new Set();
    return source.map(function(column, index) {
      const candidate = String(column && column.id || 'col-' + (index + 1)).trim().slice(0, 80);
      let id = candidate || 'col-' + (index + 1);
      let suffix = 2;
      while (usedIds.has(id)) id = candidate + '-' + suffix++;
      usedIds.add(id);
      return { id, name: String(column && column.name || '').trim().slice(0, 80) };
    }).filter(function(column) { return column.id && column.name; });
  }

  function normalizeConfig(value) {
    const source = value && typeof value === 'object' ? value : {};
    const phase = VALID_PHASES.indexOf(source.phase) === -1 ? 'collecte' : source.phase;
    return {
      title: String(source.title || 'Brainstorming').trim().slice(0, 100) || 'Brainstorming',
      instruction: String(source.instruction || '').trim().slice(0, 400),
      columns: normalizeColumns(source.columns),
      maxIdeas: clamp(source.maxIdeas, 1, 5, 3),
      maxVotes: clamp(source.maxVotes, 1, 5, 2),
      phase,
    };
  }

  function sessionPatch(value, phase) {
    const config = normalizeConfig(Object.assign({}, value, { phase: phase || value && value.phase }));
    return {
      titre: config.title,
      consigne: config.instruction,
      configuration: {
        columns: config.columns,
        maxIdeas: config.maxIdeas,
        maxVotes: config.maxVotes,
        phase: config.phase,
      },
    };
  }

  function readSessionConfig(session) {
    const source = session && typeof session === 'object' ? session : {};
    const configuration = source.configuration && typeof source.configuration === 'object'
      ? source.configuration
      : {};
    return normalizeConfig({
      title: source.titre,
      instruction: source.consigne,
      columns: configuration.columns,
      maxIdeas: configuration.maxIdeas,
      maxVotes: configuration.maxVotes,
      phase: configuration.phase,
    });
  }

  function createBoardTracker(columns, maxVotes, maxIdeas) {
    const normalizedColumns = normalizeColumns(columns);
    const allowedColumns = new Set(normalizedColumns.map(function(column) { return column.id; }));
    const voteLimit = clamp(maxVotes, 1, 5, 2);
    const ideaLimit = clamp(maxIdeas, 1, 5, 3);
    const seenEvents = new Set();
    const ideas = new Map();
    const ideaOrder = [];
    const votesByClient = new Map();
    const ideasByClient = new Map();
    let totalVotes = 0;

    function add(response) {
      const responseId = String(response && response.id || '').trim();
      const payload = response && response.payload && typeof response.payload === 'object' ? response.payload : {};
      const type = String(payload.type || '');
      if (!responseId || seenEvents.has(responseId)) return false;

      if (type === 'idea') {
        const clientId = String(payload.clientId || '').trim();
        const columnId = String(payload.columnId || '').trim();
        const text = String(payload.text || '').trim().slice(0, 240);
        const count = ideasByClient.get(clientId) || 0;
        if (!clientId || !allowedColumns.has(columnId) || !text || count >= ideaLimit) return false;
        ideas.set(responseId, {
          id: responseId,
          clientId,
          columnId,
          text,
          color: VALID_COLORS.indexOf(payload.color) === -1 ? 'jaune' : payload.color,
          pseudo: String(response.pseudo || payload.pseudo || '').trim().slice(0, 80),
          votes: 0,
        });
        ideaOrder.push(responseId);
        ideasByClient.set(clientId, count + 1);
        seenEvents.add(responseId);
        return true;
      }

      if (type === 'move') {
        const ideaId = String(payload.ideaId || '').trim();
        const columnId = String(payload.columnId || '').trim();
        const idea = ideas.get(ideaId);
        if (!idea || !allowedColumns.has(columnId)) return false;
        idea.columnId = columnId;
        seenEvents.add(responseId);
        return true;
      }

      if (type === 'vote') {
        const clientId = String(payload.clientId || '').trim();
        const ideaId = String(payload.ideaId || '').trim();
        const idea = ideas.get(ideaId);
        const clientVotes = votesByClient.get(clientId) || new Set();
        if (!clientId || !idea || clientVotes.has(ideaId) || clientVotes.size >= voteLimit) return false;
        clientVotes.add(ideaId);
        votesByClient.set(clientId, clientVotes);
        idea.votes += 1;
        totalVotes += 1;
        seenEvents.add(responseId);
        return true;
      }

      return false;
    }

    function snapshot() {
      return {
        totalIdeas: ideas.size,
        totalVotes,
        ideas: ideaOrder.map(function(id) { return Object.assign({}, ideas.get(id)); }),
      };
    }

    function participantCounts(clientId) {
      const id = String(clientId || '').trim();
      return {
        ideas: ideasByClient.get(id) || 0,
        votes: (votesByClient.get(id) || new Set()).size,
      };
    }

    return { add, snapshot, participantCounts };
  }

  function canSubmitIdea(session, phase, submittedCount, maxIdeas) {
    return !!session && session.statut !== 'fermee' && phase === 'collecte'
      && Math.max(0, Number(submittedCount) || 0) < clamp(maxIdeas, 1, 5, 3);
  }

  function canViewBoard(session, phase) {
    return !!session && phase !== 'collecte';
  }

  function canVote(session, phase, submittedCount, maxVotes) {
    return !!session && session.statut !== 'fermee' && phase === 'vote'
      && Math.max(0, Number(submittedCount) || 0) < clamp(maxVotes, 1, 5, 2);
  }

  function phaseLabel(phase) {
    if (phase === 'vote') return 'Vote ouvert';
    if (phase === 'resultats') return 'Résultats';
    return 'Collecte des idées';
  }

  return {
    buildParticipantUrl,
    buildTrainerUrl,
    normalizeConfig,
    sessionPatch,
    readSessionConfig,
    createBoardTracker,
    canSubmitIdea,
    canViewBoard,
    canVote,
    phaseLabel,
  };
});
