(function (root, factory) {
  const api = factory();

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  if (root && root.document) {
    root.AxisMundiToolViews = api;
    const script = root.document.currentScript;
    if (!script || !script.hasAttribute('data-api-only')) {
      api.apply(root.document.documentElement, root.location ? root.location.search : '');
    }
  }
})(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  const VIEWS = Object.freeze({
    PRESENTATION: 'presentation',
    FORMATEUR: 'formateur',
    PARTICIPANT: 'participant'
  });
  const VALID_VIEWS = [VIEWS.PRESENTATION, VIEWS.FORMATEUR, VIEWS.PARTICIPANT];

  function normalize(view) {
    return VALID_VIEWS.indexOf(view) === -1 ? VIEWS.PRESENTATION : view;
  }

  function resolve(search) {
    const params = new URLSearchParams(search || '');
    if (params.get('session')) return VIEWS.PARTICIPANT;
    return normalize(params.get('view') || VIEWS.PRESENTATION);
  }

  function apply(documentRoot, search) {
    const view = resolve(search);
    if (!documentRoot) return view;

    VALID_VIEWS.forEach(function (knownView) {
      documentRoot.classList.remove('mode-' + knownView);
    });
    documentRoot.classList.add('mode-' + view);
    documentRoot.setAttribute('data-tool-view', view);
    return view;
  }

  function withView(url, view, base) {
    const normalizedView = normalize(view);
    const source = String(url || '');
    const isAbsolute = /^[a-z][a-z0-9+.-]*:/i.test(source);
    const keepsLeadingSlash = source.charAt(0) === '/';
    const parsed = new URL(source, base || 'https://axismundi.local/');

    parsed.searchParams.delete('session');
    parsed.searchParams.set('view', normalizedView);

    if (isAbsolute) return parsed.href;
    const relativePath = keepsLeadingSlash ? parsed.pathname : parsed.pathname.replace(/^\/+/, '');
    return relativePath + parsed.search + parsed.hash;
  }

  return Object.freeze({
    VIEWS: VIEWS,
    resolve: resolve,
    apply: apply,
    withView: withView
  });
});
