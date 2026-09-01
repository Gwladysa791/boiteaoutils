(function(root, factory) {
  const api = factory();

  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }

  if (root) {
    root.AxisMundiNuageLive = api;
  }
})(typeof window !== 'undefined' ? window : globalThis, function() {
  'use strict';

  function normalizeMaxWords(value) {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? Math.min(5, Math.max(1, parsed)) : 3;
  }

  function cleanSessionUrl(href) {
    const url = new URL(href);
    ['view', 'preview', 'session', 'live', 'maxWords'].forEach(function(key) {
      url.searchParams.delete(key);
    });
    return url;
  }

  function buildParticipantUrl(href, code, maxWords) {
    const url = cleanSessionUrl(href);
    url.searchParams.set('session', String(code || '').toUpperCase().trim());
    url.searchParams.set('maxWords', String(normalizeMaxWords(maxWords)));
    return url.href;
  }

  function buildFormateurSessionUrl(href, code, maxWords) {
    const url = cleanSessionUrl(href);
    url.searchParams.set('view', 'formateur');
    url.searchParams.set('live', String(code || '').toUpperCase().trim());
    url.searchParams.set('maxWords', String(normalizeMaxWords(maxWords)));
    return url.href;
  }

  function sessionPatch(config) {
    const source = config && typeof config === 'object' ? config : {};
    return {
      titre: typeof source.title === 'string' ? source.title.trim() : '',
      consigne: typeof source.instruction === 'string' ? source.instruction.trim() : '',
    };
  }

  function createResponseTracker() {
    const ids = new Set();
    const words = [];

    function add(response) {
      const id = response && response.id;
      const text = response && response.payload && typeof response.payload.mot === 'string'
        ? response.payload.mot.trim()
        : '';
      if (!id || !text || ids.has(id)) return false;

      ids.add(id);
      const key = text.toLocaleLowerCase('fr');
      const existing = words.find(function(word) {
        return word.text.toLocaleLowerCase('fr') === key;
      });
      if (existing) existing.count += 1;
      else words.push({ text: text, count: 1 });
      return true;
    }

    function snapshot() {
      return {
        total: ids.size,
        words: words.map(function(word) {
          return { text: word.text, count: word.count };
        }),
      };
    }

    return { add: add, snapshot: snapshot };
  }

  function canSubmit(session, submittedCount, maxWords) {
    if (!session || session.statut === 'fermee') return false;
    if (maxWords === null || typeof maxWords === 'undefined' || maxWords === '') return true;
    return Math.max(0, Number(submittedCount) || 0) < normalizeMaxWords(maxWords);
  }

  return {
    normalizeMaxWords: normalizeMaxWords,
    buildParticipantUrl: buildParticipantUrl,
    buildFormateurSessionUrl: buildFormateurSessionUrl,
    sessionPatch: sessionPatch,
    createResponseTracker: createResponseTracker,
    canSubmit: canSubmit,
  };
});
