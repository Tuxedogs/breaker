import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const source = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
const app = ts.createSourceFile('App.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const routes = new Map();
function visit(node) {
  if ((ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node))
    && node.tagName.getText(app) === 'Route') {
    const attributes = new Map(node.attributes.properties
      .filter(ts.isJsxAttribute).map((attribute) => [attribute.name.getText(app), attribute.initializer]));
    const path = attributes.get('path');
    const element = attributes.get('element');
    if (path && ts.isStringLiteral(path) && element && ts.isJsxExpression(element)) {
      routes.set(path.text, element.expression);
    }
  }
  ts.forEachChild(node, visit);
}
visit(app);

const expected = [
  ['industry/blueprint-tracker', '/industry/crafting'],
  ['industry/missions', '/industry/crafting'],
  ['industry/missions/:missionSlug', '/industry/crafting'],
  ['dashboard/doctrine/armor-threshold', '/dashboard'],
  ['doctrine/armor-threshold', '/dashboard'],
  ['tools/alpha-threshold', '/dashboard'],
  ['combat/component-mapping', '/fitting'],
  ['tools/component-mapping', '/fitting'],
  ['tools/gunnery', '/fitting'],
];

// Execute the actual redirect helpers, substituting only the router location.
// Browser/history behavior is covered by legacy-page-redirects.spec.ts.
const helpers = app.statements.filter((node) => ts.isFunctionDeclaration(node)
  && ['RedirectToActivePage', 'RedirectToCrafting'].includes(node.name?.text));
const compiled = ts.transpileModule(helpers.map((node) => node.getText(app)).join('\n'), {
  compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS },
}).outputText;
const context = {
  exports: {}, require: createRequire(import.meta.url),
  useLocation: () => ({ search: '?channel=LIVE&offer=old%3Aoffer' }),
  Navigate: () => null,
};
runInNewContext(compiled, context);

for (const [path, destination] of expected) {
  test(`${path} targets an active route, preserves search, and replaces history`, () => {
    const element = routes.get(path);
    assert.ok(element && ts.isJsxSelfClosingElement(element), `Missing explicit redirect: ${path}`);
    const helperName = element.tagName.getText(app);
    assert.ok(['RedirectToCrafting', 'RedirectToActivePage'].includes(helperName));
    const to = element.attributes.properties.find((attribute) => ts.isJsxAttribute(attribute)
      && attribute.name.getText(app) === 'to');
    const result = context[helperName](to ? { to: to.initializer.text } : {});
    assert.equal(result.type, context.Navigate);
    assert.equal(result.props.to, `${destination}?channel=LIVE&offer=old%3Aoffer`);
    assert.equal(result.props.replace, true);
    assert.ok(routes.has(destination.slice(1)), `Inactive destination: ${destination}`);
  });
}
