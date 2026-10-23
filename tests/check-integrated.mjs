import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
const { default: config } = await import(pathToFileURL(process.env.INTEGRATED_CONFIG_PATH));
const base = process.env.DASHBOARD_BASE ?? 'http://127.0.0.1:5099/dashboard-preview/extension/FavaDashboards/';
const time = process.env.PREVIEW_TIME ?? '2025-02';
globalThis.window = { location: { href: base + '?time=' + time } };
globalThis.document = { body: {}, documentElement: { style: { colorScheme: 'light' } } };
globalThis.window.screen = { width: 1280 };
globalThis.getComputedStyle = () => ({ color: '#222222' });
async function api(path) {
 const r = await fetch(new URL(path, base)); const j = await r.json();
 if (!r.ok || !j.success) throw new Error(j.error ?? `HTTP ${r.status}`);
 return j.data;
}
const ledger = {
 ...(await api('v2_ledger?time=' + time)).ledgerData,
 query: async (bql) => (await api('query?' + new URLSearchParams({bql, time}))).result,
 urlFor: (path) => { const u = new URL(path, base); u.searchParams.set('time', time); return u.href; },
};
async function variablesFor(items, variables, panel) {
 for (const item of items ?? []) {
  const options = typeof item.options === 'function' ? await item.options({ledger,variables,panel}) : item.options;
  variables[item.name] = item.default ?? (typeof options?.[0] === 'object' ? options[0].value : options?.[0]);
 }
 return variables;
}
function finiteValues(value, path = '', seen = new WeakSet()) {
 if (typeof value === 'number') assert.ok(Number.isFinite(value), 'Non-finite number at ' + path);
 if (!value || typeof value !== 'object' || seen.has(value)) return;
 seen.add(value);
 for (const [key, item] of Object.entries(value)) finiteValues(item, path + '.' + key, seen);
}
assert.deepEqual(config.dashboards.map(d => d.name), ['종합','자산','수익·비용','흐름도','순자산 전망','손익','현금흐름','대출']);
let failures = 0, count = 0;
for (const dashboard of config.dashboards) {
 const variables = await variablesFor(dashboard.variables, {});
 for (const panel of dashboard.panels) {
  if (panel.kind === "react") { console.log("BROWSER",dashboard.name,panel.title); continue; }
  try {
   const selected = await variablesFor(panel.variables, {...variables}, panel);
   const spec = await panel.spec({panel,ledger,variables:selected});
   finiteValues(spec);
   assert.notEqual(spec, undefined);
   console.log('PASS', dashboard.name, panel.title); count++;
  } catch (error) { console.log('FAIL',dashboard.name,panel.title,error.message); failures++; }
 }
}
console.log(JSON.stringify({time, panels:count, failures}));
if(failures) process.exitCode = 1;
