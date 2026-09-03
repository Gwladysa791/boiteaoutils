(function(root, factory) {
  const api = factory();

  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.AxisMundiSondageConfig = api;
})(typeof window !== 'undefined' ? window : globalThis, function() {
  'use strict';

  const STORAGE_KEY = 'axis-mundi:sondage:formateur-config:v1';
  const DEFAULT_CONFIG = Object.freeze({
    title: 'Sondage',
    question: '',
    options: Object.freeze([
      Object.freeze({ id: 'option-1', text: '' }),
      Object.freeze({ id: 'option-2', text: '' }),
    ]),
  });

  function cleanText(value, maxLength) {
    return (typeof value === 'string' ? value.trim() : '').slice(0, maxLength);
  }

  function sanitize(value) {
    const source = value && typeof value === 'object' ? value : {};
    const rawOptions = Array.isArray(source.options) ? source.options.slice(0, 8) : DEFAULT_CONFIG.options;
    const usedIds = new Set();
    const options = rawOptions.map(function(option, index) {
      const candidate = cleanText(option && option.id, 80) || 'option-' + (index + 1);
      let id = candidate;
      let suffix = 2;
      while (usedIds.has(id)) id = candidate + '-' + suffix++;
      usedIds.add(id);
      return { id, text: cleanText(option && option.text, 160) };
    });

    return {
      title: cleanText(source.title, 100) || DEFAULT_CONFIG.title,
      question: cleanText(source.question, 300),
      options,
    };
  }

  function validate(value) {
    const config = sanitize(value);
    if (!config.question) return 'Rédigez la question du sondage.';
    if (config.options.filter(function(option) { return option.text; }).length < 2) {
      return 'Ajoutez au moins deux réponses possibles.';
    }
    return null;
  }

  function cloneDefaults() {
    return {
      title: DEFAULT_CONFIG.title,
      question: DEFAULT_CONFIG.question,
      options: DEFAULT_CONFIG.options.map(function(option) { return { id: option.id, text: option.text }; }),
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
