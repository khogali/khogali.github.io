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

// ---- 7. host -> offer resolution -----------------------------------------
// Imported, not restated: Node runs the .ts directly via type stripping, so
// this exercises the code that actually ships. One burner domain per offer
// means a wrong host either sends traffic to the wrong advertiser or drops it.
const { resolveOffer, offerUrlWithSubId } = await import('../lib/offers.ts');

const OFFERS = JSON.stringify({
  'derila-sleep.com':  { name: 'derila',   url: 'https://hop.cb/derila?aff_sub1={subid}' },
  'purisaki-trial.com':{ name: 'purisaki', url: 'https://hop.cb/purisaki?aff_sub1={subid}' },
});
const env = { OFFERS, OFFER_URL: 'https://fallback.example?x=1', OFFER_NAME: 'fallback' };

assert.equal(resolveOffer('derila-sleep.com', env).name, 'derila');
assert.equal(resolveOffer('WWW.Derila-Sleep.com', env).name, 'derila', 'www/case not normalised');
assert.equal(resolveOffer('derila-sleep.com:443', env).name, 'derila', 'port not stripped');
assert.equal(resolveOffer('purisaki-trial.com', env).name, 'purisaki');
assert.equal(resolveOffer('unknown.com', env).name, 'fallback', 'unknown host must fall back');
assert.equal(resolveOffer(undefined, env).name, 'fallback');
// A malformed OFFERS must degrade to the single-offer vars, never take the funnel down.
assert.equal(resolveOffer('derila-sleep.com', { OFFERS: '{not json', OFFER_URL: 'https://f', OFFER_NAME: 'f' }).name, 'f');
assert.equal(resolveOffer('derila-sleep.com', {}), null, 'no config must be null, not a crash');

const cid = '3f1a7c2e-9b4d-4a51-8e6f-1c2d3e4f5a6b';
assert.equal(offerUrlWithSubId('https://h/o?aff_sub1={subid}', cid), `https://h/o?aff_sub1=${cid}`);
assert.equal(offerUrlWithSubId('https://h/o?a=1', cid),           `https://h/o?a=1&subid=${cid}`);
assert.equal(offerUrlWithSubId('https://h/o', cid),               `https://h/o?subid=${cid}`);
assert.ok(!offerUrlWithSubId('https://h/o', 'a b&c=1').includes(' '), 'sub-ID must be url-encoded');

// fbclid must ride along to the offer, or ClickBank's Meta CAPI fires a
// Purchase that Meta cannot attribute — silently.
const cb = 'https://x.hop.clickbank.net/?cbpage=lp1&aff_sub1={subid}';
const withFb = offerUrlWithSubId(cb, cid, { fbclid: 'ABC123', traffic_source: 'meta' });
assert.ok(withFb.includes(`aff_sub1=${cid}`), 'sub-ID must land in aff_sub1');
assert.ok(withFb.includes('cbpage=lp1'), 'lander selector must survive');
assert.ok(withFb.includes('fbclid=ABC123'), 'fbclid must be forwarded');
assert.ok(withFb.includes('traffic_source=meta'));
// Absent/empty extras must not emit dangling params.
const noFb = offerUrlWithSubId(cb, cid, { fbclid: null, ttclid: undefined });
assert.ok(!noFb.includes('fbclid'), 'null extras must be skipped');
assert.ok(!noFb.endsWith('&') && !noFb.includes('=&'), 'no dangling params');

// ---- 8. missing config must be a handler-level 503, not a module crash -----
// The client used to be built at module scope with `!`. A missing env var threw
// during module load, so Vercel answered an opaque 500 before any handler ran,
// which masked /api/pb's deliberate 503 and its diagnostic message.
const { missingConfig } = await import('../lib/db.ts');
const saved = { u: process.env.SUPABASE_URL, k: process.env.SUPABASE_SERVICE_KEY };
delete process.env.SUPABASE_URL; delete process.env.SUPABASE_SERVICE_KEY;
assert.match(missingConfig() ?? '', /SUPABASE_URL/, 'missing URL must be named');
process.env.SUPABASE_URL = 'https://x.supabase.co';
assert.match(missingConfig() ?? '', /SUPABASE_SERVICE_KEY/, 'missing key must be named');
process.env.SUPABASE_SERVICE_KEY = 'k';
assert.equal(missingConfig(), null, 'complete config must report no error');
if (saved.u) process.env.SUPABASE_URL = saved.u; else delete process.env.SUPABASE_URL;
if (saved.k) process.env.SUPABASE_SERVICE_KEY = saved.k; else delete process.env.SUPABASE_SERVICE_KEY;
for (const f of ['api/c.ts','api/go.ts','api/pb.ts']) {
  const src = read(f);
  assert.ok(src.includes('missingConfig()'), `${f} must guard on config`);
  assert.ok(!/(?<![\w)])db\s*\.from\(/.test(src), `${f} still uses the old eager db.from`);
  // ESM needs explicit extensions on relative imports. Without them the deployed
  // function dies with ERR_MODULE_NOT_FOUND at load — before any handler runs,
  // so it reads as a config problem rather than a build problem.
  for (const m of src.matchAll(/from '(\.\.?\/[^']+)'/g)) {
    assert.ok(m[1].endsWith('.js'), `${f}: relative import ${m[1]} needs a .js extension`);
  }
}

console.log(`ok — ${keys.length} data-v slots, variant b overrides ${bKeys.join(', ')}, ` +
            `${seeded.size} config keys wired, offer resolver green`);
