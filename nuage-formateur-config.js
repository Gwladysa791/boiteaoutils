(function(root, factory) {
  const api = factory();

  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }

  if (root) {
    root.AxisMundiNuageConfig = api;
  }
})(typeof window !== 'undefined' ? window : globalThis, function() {
  'use strict';

  const STORAGE_KEY = 'axis-mundi:nuage-de-mots:formateur-config:v1';
  const DEFAULT_CONFIG = Object.freeze({
    title: 'Nuage de mots',
    instruction: 'Saisissez 1 à 3 mots-clés en réponse à la question posée.',
    maxWords: 3,
  });

  function cleanText(value, fallback, maxLength) {
    const text = typeof value === 'string' ? value.trim() : '';
    return (text || fallback).slice(0, maxLength);
  }

  function sanitize(value) {
    const source = value && typeof value === 'object' ? value : {};
    const parsedMax = Number.parseInt(source.maxWords, 10);
    const maxWords = Number.isFinite(parsedMax)
      ? Math.min(5, Math.max(1, parsedMax))
      : DEFAULT_CONFIG.maxWords;

    return {
      title: cleanText(source.title, DEFAULT_CONFIG.title, 100),
      instruction: cleanText(source.instruction, DEFAULT_CONFIG.instruction, 500),
      maxWords,
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
      // La prévisualisation reste utilisable même si le stockage est désactivé.
    }
    return config;
  }

  function clear(storage) {
    try {
      if (storage) storage.removeItem(STORAGE_KEY);
    } catch (error) {
      // Rien à faire : les valeurs par défaut seront réappliquées à l'écran.
    }
    return { ...DEFAULT_CONFIG };
  }

  function buildPreviewUrl(href) {
    const url = new URL(href);
    url.searchParams.delete('session');
    url.searchParams.delete('live');
    url.searchParams.delete('maxWords');
    url.searchParams.set('view', 'participant');
    url.searchParams.set('preview', '1');
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
