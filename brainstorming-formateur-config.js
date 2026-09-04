(function(root, factory) {
  const api = factory();

  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.AxisMundiBrainstormingConfig = api;
})(typeof window !== 'undefined' ? window : globalThis, function() {
  'use strict';

  const STORAGE_KEY = 'axis-mundi:brainstorming:formateur-config:v1';
  const DEFAULT_CONFIG = Object.freeze({
    title: 'Brainstorming',
    instruction: 'Déposez vos idées dans la colonne correspondante.',
    columns: Object.freeze([
      Object.freeze({ id: 'col-1', name: 'Idées' }),
      Object.freeze({ id: 'col-2', name: 'À approfondir' }),
      Object.freeze({ id: 'col-3', name: 'À retenir' }),
    ]),
    maxIdeas: 3,
    maxVotes: 2,
  });

  function cleanText(value, maxLength) {
    return (typeof value === 'string' ? value.trim() : '').slice(0, maxLength);
  }

  function clampInteger(value, minimum, maximum, fallback) {
    const number = Number.parseInt(value, 10);
    if (!Number.isFinite(number)) return fallback;
    return Math.max(minimum, Math.min(maximum, number));
  }

  function sanitize(value) {
    const source = value && typeof value === 'object' ? value : {};
    const rawColumns = Array.isArray(source.columns) ? source.columns.slice(0, 6) : DEFAULT_CONFIG.columns;
    const usedIds = new Set();
    const columns = rawColumns.map(function(column, index) {
      const candidate = cleanText(column && column.id, 80) || 'col-' + (index + 1);
      let id = candidate;
      let suffix = 2;
      while (usedIds.has(id)) id = candidate + '-' + suffix++;
      usedIds.add(id);
      return { id, name: cleanText(column && column.name, 80) };
    });

    return {
      title: cleanText(source.title, 100) || DEFAULT_CONFIG.title,
      instruction: cleanText(source.instruction, 400),
      columns,
      maxIdeas: clampInteger(source.maxIdeas, 1, 5, DEFAULT_CONFIG.maxIdeas),
      maxVotes: clampInteger(source.maxVotes, 1, 5, DEFAULT_CONFIG.maxVotes),
    };
  }

  function validate(value) {
    const config = sanitize(value);
    if (!config.instruction) return 'Rédigez la consigne du brainstorming.';
    if (config.columns.length < 2) return 'Ajoutez au moins deux colonnes.';
    if (config.columns.some(function(column) { return !column.name; })) return 'Nommez chaque colonne.';
    return null;
  }

  function cloneDefaults() {
    return {
      title: DEFAULT_CONFIG.title,
      instruction: DEFAULT_CONFIG.instruction,
      columns: DEFAULT_CONFIG.columns.map(function(column) { return { id: column.id, name: column.name }; }),
      maxIdeas: DEFAULT_CONFIG.maxIdeas,
      maxVotes: DEFAULT_CONFIG.maxVotes,
    };
  }

  function load(storage) {
    try {
      const raw = storage && storage.getItem(STORAGE_KEY);
      return raw ? sanitize(JSON.parse(raw)) : cloneDefaults();
    } catch (error) {
      return cloneDefaults();
    }
  }

  function save(storage, value) {
    const config = sanitize(value);
    try {
      if (storage) storage.setItem(STORAGE_KEY, JSON.stringify(config));
    } catch (error) {
      // Le brouillon reste utilisable si le stockage local est indisponible.
    }
    return config;
  }

  function clear(storage) {
    try {
      if (storage) storage.removeItem(STORAGE_KEY);
    } catch (error) {
      // Les valeurs initiales sont tout de même réappliquées à l'écran.
    }
    return cloneDefaults();
  }

  function buildPreviewUrl(href) {
    const url = new URL(href);
    ['session', 'live'].forEach(function(key) { url.searchParams.delete(key); });
    url.searchParams.set('view', 'participant');
    url.searchParams.set('preview', '1');
    return url.href;
  }

  return { STORAGE_KEY, DEFAULT_CONFIG, sanitize, validate, load, save, clear, buildPreviewUrl };
});
