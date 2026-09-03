(function(root, factory) {
  const api = factory();

  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }

  if (root) {
    root.AxisMundiRotiConfig = api;
  }
})(typeof window !== 'undefined' ? window : globalThis, function() {
  'use strict';

  const STORAGE_KEY = 'axis-mundi:roti:formateur-config:v1';
  const DEFAULT_CONFIG = Object.freeze({
    title: 'ROTI',
    instruction: 'Choisissez la note qui correspond le mieux à votre ressenti sur la valeur du temps passé.',
    commentMode: 'optional',
  });
  const COMMENT_MODES = ['optional', 'required', 'none'];

  function cleanText(value, fallback, maxLength) {
    const text = typeof value === 'string' ? value.trim() : '';
    return (text || fallback).slice(0, maxLength);
  }

  function sanitize(value) {
    const source = value && typeof value === 'object' ? value : {};
    const commentMode = COMMENT_MODES.indexOf(source.commentMode) === -1
      ? DEFAULT_CONFIG.commentMode
      : source.commentMode;

    return {
      title: cleanText(source.title, DEFAULT_CONFIG.title, 100),
      instruction: cleanText(source.instruction, DEFAULT_CONFIG.instruction, 500),
      commentMode,
    };
  }

  function load(storage) {
    try {
      const raw = storage && storage.getItem(STORAGE_KEY);
      return raw ? sanitize(JSON.parse(raw)) : { ...DEFAULT_CONFIG };
    } catch (error) {
      return { ...DEFAULT_CONFIG };
    }
  }

  function save(storage, value) {
    const config = sanitize(value);
    try {
      if (storage) storage.setItem(STORAGE_KEY, JSON.stringify(config));
    } catch (error) {
      // La configuration reste utilisable si le stockage local est indisponible.
    }
    return config;
  }

  function clear(storage) {
    try {
      if (storage) storage.removeItem(STORAGE_KEY);
    } catch (error) {
      // Les valeurs par défaut seront réappliquées à l'écran.
    }
    return { ...DEFAULT_CONFIG };
  }

  function buildPreviewUrl(href, commentMode) {
    const url = new URL(href);
    ['session', 'live', 'comment'].forEach(function(key) {
      url.searchParams.delete(key);
    });
    url.searchParams.set('view', 'participant');
    url.searchParams.set('preview', '1');
    url.searchParams.set('comment', sanitize({ commentMode }).commentMode);
    return url.href;
  }

  return {
    STORAGE_KEY,
    DEFAULT_CONFIG,
    sanitize,
    load,
    save,
    clear,
    buildPreviewUrl,
  };
});
