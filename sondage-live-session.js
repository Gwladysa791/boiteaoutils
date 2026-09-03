(function(root, factory) {
  const api = factory();

  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.AxisMundiSondageLive = api;
})(typeof window !== 'undefined' ? window : globalThis, function() {
  'use strict';

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

  function normalizeConfig(value) {
    const source = value && typeof value === 'object' ? value : {};
    const options = (Array.isArray(source.options) ? source.options : []).slice(0, 8).map(function(option, index) {
      return {
        id: String(option && option.id || 'option-' + (index + 1)).trim(),
        text: String(option && option.text || '').trim(),
      };
    }).filter(function(option) { return option.id && option.text; });
    return {
      title: String(source.title || 'Sondage').trim().slice(0, 100) || 'Sondage',
      question: String(source.question || '').trim().slice(0, 300),
      options,
    };
  }

  function sessionPatch(value) {
    const config = normalizeConfig(value);
    return {
      titre: config.title,
      consigne: config.question,
      configuration: { question: config.question, options: config.options },
    };
  }

  function readSessionConfig(session) {
    const source = session && typeof session === 'object' ? session : {};
    const configuration = source.configuration && typeof source.configuration === 'object'
      ? source.configuration
      : {};
    return normalizeConfig({
      title: source.titre,
      question: configuration.question || source.consigne,
      options: configuration.options,
    });
  }

  function createVoteTracker(options) {
    const normalized = normalizeConfig({ options }).options;
    const allowed = new Set(normalized.map(function(option) { return option.id; }));
    const responseIds = new Set();
    const counts = new Map(normalized.map(function(option) { return [option.id, 0]; }));

    function add(response) {
      const responseId = response && response.id;
      const optionId = String(response && response.payload && response.payload.optionId || '');
      if (!responseId || responseIds.has(responseId) || !allowed.has(optionId)) return false;
      responseIds.add(responseId);
      counts.set(optionId, counts.get(optionId) + 1);
      return true;
    }

    function snapshot() {
      const total = responseIds.size;
      return {
        total,
        results: normalized.map(function(option) {
          const count = counts.get(option.id) || 0;
          return {
            id: option.id,
            text: option.text,
            count,
            percentage: total ? Math.round(count / total * 100) : 0,
          };
        }),
      };
    }

    return { add, snapshot };
  }

  function canVote(session, submittedCount) {
    return !!session && session.statut !== 'fermee' && Math.max(0, Number(submittedCount) || 0) < 1;
  }

  function participantStatus(session, submittedCount, transientMessage) {
    if (session && session.statut === 'fermee') return 'Ce sondage est clôturé.';
    if (Math.max(0, Number(submittedCount) || 0) > 0) return 'Merci, votre vote a été enregistré.';
    if (transientMessage) return String(transientMessage);
    if (!session) return 'Connexion au sondage…';
    return '';
  }

  return {
    buildParticipantUrl,
    buildTrainerUrl,
    sessionPatch,
    readSessionConfig,
    createVoteTracker,
    canVote,
    participantStatus,
  };
});
