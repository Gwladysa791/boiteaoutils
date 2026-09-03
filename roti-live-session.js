(function(root, factory) {
  const api = factory();

  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }

  if (root) {
    root.AxisMundiRotiLive = api;
  }
})(typeof window !== 'undefined' ? window : globalThis, function() {
  'use strict';

  const COMMENT_MODES = ['optional', 'required', 'none'];

  function normalizeCommentMode(value) {
    return COMMENT_MODES.indexOf(value) === -1 ? 'optional' : value;
  }

  function cleanSessionUrl(href) {
    const url = new URL(href);
    ['view', 'preview', 'session', 'live', 'comment'].forEach(function(key) {
      url.searchParams.delete(key);
    });
    return url;
  }

  function buildParticipantUrl(href, code, commentMode) {
    const url = cleanSessionUrl(href);
    url.searchParams.set('session', String(code || '').toUpperCase().trim());
    url.searchParams.set('comment', normalizeCommentMode(commentMode));
    return url.href;
  }

  function buildFormateurSessionUrl(href, code, commentMode) {
    const url = cleanSessionUrl(href);
    url.searchParams.set('view', 'formateur');
    url.searchParams.set('live', String(code || '').toUpperCase().trim());
    url.searchParams.set('comment', normalizeCommentMode(commentMode));
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
    const distribution = [0, 0, 0, 0, 0];
    const comments = [];
    let scoreTotal = 0;

    function add(response) {
      const id = response && response.id;
      const score = Number(response && response.payload && response.payload.score);
      if (!id || ids.has(id) || !Number.isInteger(score) || score < 1 || score > 5) return false;

      ids.add(id);
      distribution[score - 1] += 1;
      scoreTotal += score;

      const text = response && response.payload && typeof response.payload.commentaire === 'string'
        ? response.payload.commentaire.trim()
        : '';
      if (text) {
        comments.push({
          pseudo: typeof response.pseudo === 'string' ? response.pseudo.trim() : '',
          text,
          score,
        });
      }
      return true;
    }

    function snapshot() {
      return {
        total: ids.size,
        average: ids.size ? Number((scoreTotal / ids.size).toFixed(1)) : null,
        distribution: distribution.map(function(count, index) {
          return { score: index + 1, count };
        }),
        comments: comments.map(function(comment) {
          return { pseudo: comment.pseudo, text: comment.text, score: comment.score };
        }),
      };
    }

    return { add, snapshot };
  }

  function isCommentValid(commentMode, comment) {
    return normalizeCommentMode(commentMode) !== 'required' || String(comment || '').trim().length > 0;
  }

  function canSubmit(session, submittedCount) {
    return !!session && session.statut !== 'fermee' && Math.max(0, Number(submittedCount) || 0) < 1;
  }

  function participantStatus(session, submittedCount, transientMessage) {
    if (session && session.statut === 'fermee') return 'Cette session est clôturée.';
    if (Math.max(0, Number(submittedCount) || 0) > 0) {
      return 'Merci, votre réponse a été transmise au formateur.';
    }
    if (transientMessage) return String(transientMessage);
    if (!session) return 'Connexion à la session…';
    return '';
  }

  return {
    normalizeCommentMode,
    buildParticipantUrl,
    buildFormateurSessionUrl,
    sessionPatch,
    createResponseTracker,
    isCommentValid,
    canSubmit,
    participantStatus,
  };
});
