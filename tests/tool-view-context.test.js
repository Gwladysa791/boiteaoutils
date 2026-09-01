const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const contextPath = path.join(root, 'tool-view-context.js');
const studioHtml = fs.readFileSync(path.join(root, 'Espace_Formateur.html'), 'utf8');
const contextExists = fs.existsSync(contextPath);

function catalogFiles() {
  return [...studioHtml.matchAll(/fichier:"([^"]+\.html)"/g)].map((match) => match[1]);
}

test('a shared tool-view resolver is available', () => {
  assert.ok(contextExists, 'tool-view-context.js is missing');
});

test('the resolver applies the three-view URL contract', { skip: !contextExists }, () => {
  const views = require(contextPath);

  assert.equal(views.resolve(''), 'presentation');
  assert.equal(views.resolve('?view=formateur'), 'formateur');
  assert.equal(views.resolve('?view=participant'), 'participant');
  assert.equal(views.resolve('?view=unknown'), 'presentation');
  assert.equal(views.resolve('?view=formateur&session=482731'), 'participant');
  assert.equal(
    views.withView('Nuage_De_Mots.html', 'formateur', 'https://example.test/'),
    'Nuage_De_Mots.html?view=formateur'
  );
  assert.equal(
    views.withView('Nuage_De_Mots.html?theme=bleu#resultats', 'participant', 'https://example.test/'),
    'Nuage_De_Mots.html?theme=bleu&view=participant#resultats'
  );
  assert.equal(
    views.withView('Nuage_De_Mots.html?session=482731', 'formateur', 'https://example.test/'),
    'Nuage_De_Mots.html?view=formateur'
  );
});

test('the Studio requests the formateur view for every catalog iframe', () => {
  assert.match(studioHtml, /<script src="tool-view-context\.js" data-api-only><\/script>/);
  assert.match(studioHtml, /function toolViewUrl\(/, 'the Studio URL helper is missing');
  assert.match(studioHtml, /AxisMundiToolViews\.withView\(file, view, location\.href\)/);
  assert.match(studioHtml, /toolViewUrl\(tool\.fichier,\s*'formateur'\)/);
  assert.doesNotMatch(
    studioHtml,
    /<iframe[^>]+src="' \+ escapeHtml\(tool\.fichier\)/,
    'a Studio iframe still opens a catalog file without an explicit view'
  );
});

test('every catalog page loads the shared context resolver exactly once', () => {
  const files = catalogFiles();
  assert.ok(files.length >= 40, `expected the complete catalog, found ${files.length} files`);

  const uncovered = [];
  const duplicated = [];
  for (const file of files) {
    const html = fs.readFileSync(path.join(root, file), 'utf8');
    const count = (html.match(/<script src="tool-view-context\.js"><\/script>/g) || []).length;
    if (count === 0) uncovered.push(file);
    if (count > 1) duplicated.push(file);
  }

  assert.deepEqual(uncovered, [], `missing resolver in: ${uncovered.join(', ')}`);
  assert.deepEqual(duplicated, [], `resolver included more than once in: ${duplicated.join(', ')}`);
});
