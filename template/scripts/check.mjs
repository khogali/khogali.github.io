// ponytail: no test framework. One file, plain asserts, run with `npm run check`.
// It reads the regexes out of the real source instead of restating them, so it
// cannot drift away from the code it is guarding.
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { timingSafeEqual } from 'node:crypto';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const literal = (src, name) => {
  const m = src.match(new RegExp(`const ${name} = (/.+/[a-z]*);`));
  assert.ok(m, `${name} literal not found — did the source change shape?`);
  return eval(m[1]);
};

const cSrc  = read('api/c.ts');
const pbSrc = read('api/pb.ts');
const lpSrc = read('lp/default/index.html');

// ---- 1. the landing-page redirect must not be an open redirect ------------
const SLUG = literal(cSrc, 'SLUG');
const target = (lp) => `/lp/${SLUG.test(lp ?? '') ? lp : 'default'}`;

assert.equal(target('default'), '/lp/default');
assert.equal(target('offer1'),  '/lp/offer1');
for (const hostile of ['/evil.com', '//evil.com', '..%2f..%2fadmin', 'a/../../x', '']) {
  assert.equal(target(hostile), '/lp/default', `open redirect via lp=${hostile}`);
  assert.ok(!target(hostile).startsWith('//'), 'protocol-relative Location');
}

// ---- 2. that redirect must point at a file that exists --------------------
// This is the bug that 404'd every paid click: c.ts sent traffic to /<slug>
// while the asset sits at lp/<slug>/index.html.
const slug = 'default';
assert.ok(existsSync(new URL(`../lp/${slug}/index.html`, import.meta.url)),
  `redirect target ${target(slug)} has no lp/${slug}/index.html behind it`);
assert.ok(cSrc.includes('`/lp/${lpSlug}'), 'c.ts no longer redirects into lp/');

// ---- 3. only a real UUID may reach the click_id foreign key ---------------
const UUID = literal(pbSrc, 'UUID');
assert.ok(UUID.test('3f1a7c2e-9b4d-4a51-8e6f-1c2d3e4f5a6b'));
for (const bad of ['untracked', '', 'null', '3f1a7c2e9b4d4a518e6f1c2d3e4f5a6b', "'; drop table clicks;--"]) {
  assert.ok(!UUID.test(bad), `${bad} would hit the FK and lose the conversion`);
}
assert.ok(pbSrc.includes('sub_id:'), 'pb.ts must persist the raw sub-ID regardless of match');
assert.ok(/if \(!secret\)/.test(pbSrc), 'pb.ts must fail closed when POSTBACK_SECRET is unset');
assert.ok(!/raw:\s*q\b/.test(pbSrc), 'pb.ts must not persist the shared secret in raw');

// ---- 4. secret comparison ------------------------------------------------
const enc = new TextEncoder();
const matches = (given, expected) => {
  const a = enc.encode(given ?? '');
  const b = enc.encode(expected);
  return a.length === b.length && timingSafeEqual(a, b);
};
assert.equal(matches('s3cret', 's3cret'), true);
assert.equal(matches('s3cres', 's3cret'), false);
assert.equal(matches('s3cre',  's3cret'), false);
assert.equal(matches(undefined, 's3cret'), false);

// ---- 5. the A/B swap must actually have copy to swap ---------------------
assert.ok(/window\.VARIANTS\s*=/.test(lpSrc), 'VARIANTS is undefined — both arms serve identical HTML');
const keys = [...lpSrc.matchAll(/data-v="([^"]+)"/g)].map(m => m[1]);
const bStart = lpSrc.indexOf('b: {') + 'b: {'.length;
const bBlock = lpSrc.slice(bStart, lpSrc.indexOf('}', bStart));
const bKeys = [...bBlock.matchAll(/^\s*([a-z0-9]+):/gm)].map(m => m[1]);
assert.ok(bKeys.length > 0, 'variant b overrides nothing');
for (const k of bKeys) assert.ok(keys.includes(k), `variant key "${k}" matches no data-v element`);

// ---- 6. every config key a view reads must exist in the seed -------------
// A typo'd key does not error in Postgres, it silently falls through to the
// coalesce default, so the view keeps returning verdicts built on the wrong
// number. This is the only place that mismatch is visible.
const sql = read('supabase/schema.sql');
const seeded = new Set([...sql.matchAll(/^\s*\('([a-z_]+)',\s*-?[\d.]+,/gm)].map(m => m[1]));
const referenced = new Set([...sql.matchAll(/where key = '([a-z_]+)'/g)].map(m => m[1]));
assert.ok(seeded.size > 0, 'config seed not found');
for (const k of referenced) assert.ok(seeded.has(k), `view reads config key "${k}" that is never seeded`);
for (const k of seeded) assert.ok(referenced.has(k), `config key "${k}" is seeded but no view reads it`);

console.log(`ok — ${keys.length} data-v slots, variant b overrides ${bKeys.join(', ')}, ` +
            `${seeded.size} config keys wired`);
