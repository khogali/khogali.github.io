-- ============================================================
-- adstack — affiliate media buying tracker
-- Offer-agnostic. Works with any network / traffic source.
--
-- Re-runnable. Safe to paste into the Supabase SQL editor on a
-- fresh project OR on top of an existing deployment.
-- ============================================================

create extension if not exists "pgcrypto";

-- Every inbound ad click.
create table if not exists clicks (
  click_id      uuid primary key default gen_random_uuid(),
  ts            timestamptz not null default now(),

  -- traffic attribution (populated from URL macros)
  source        text,            -- meta | tiktok | google | native
  campaign_id   text,
  adset_id      text,
  ad_id         text,
  creative_id   text,
  placement     text,
  keyword       text,

  -- meta click id, required for Conversions API attribution
  fbclid        text,
  ttclid        text,
  gclid         text,

  -- landing page split test
  lp_slug       text,
  lp_variant    text,

  -- request context (needed by CAPI for match quality)
  ip            inet,
  user_agent    text,
  country       text,
  device        text,
  referrer      text,

  -- funnel progression
  clicked_out   boolean not null default false,
  clicked_out_ts timestamptz
);

-- Which offer this click was sent to, stamped at click time from the burner
-- domain it arrived on. One deploy serves many domains; without this, offers
-- are only separable by ad_id, so "how is Derila doing overall" is unanswerable.
alter table clicks add column if not exists offer text;

create index if not exists clicks_offer_idx     on clicks (offer, ts desc);
create index if not exists clicks_ts_idx        on clicks (ts desc);
create index if not exists clicks_ad_idx        on clicks (ad_id, ts desc);
create index if not exists clicks_variant_idx   on clicks (lp_slug, lp_variant, ts desc);

-- Conversions, delivered by affiliate network postback.
create table if not exists conversions (
  conversion_id  uuid primary key default gen_random_uuid(),
  click_id       uuid references clicks(click_id) on delete set null,
  ts             timestamptz not null default now(),

  network        text,
  offer_id       text,
  payout         numeric(10,2) not null default 0,
  currency       text not null default 'USD',
  status         text not null default 'pending',   -- pending | approved | reversed

  network_txn_id text,
  raw            jsonb,

  -- Conversions API delivery state
  capi_sent      boolean not null default false,
  capi_sent_ts   timestamptz,
  capi_response  jsonb
);

-- The raw sub-ID exactly as the network sent it. click_id is a foreign key and
-- rejects anything that is not a live UUID, so a mangled or unmatched sub-ID
-- would fail the whole insert and lose the conversion. This column always
-- records what arrived, whether or not it resolved to a click.
alter table conversions add column if not exists sub_id text;

create index if not exists conversions_sub_id_idx on conversions (sub_id);

-- Dedupe: a network retrying a postback must not double-count.
create unique index if not exists conversions_dedupe_idx
  on conversions (network, network_txn_id)
  where network_txn_id is not null;

-- Networks that send no transaction id get deduped on the sub-ID instead.
-- Ceiling: one conversion per click per network. A genuine repeat purchase from
-- the same click is rejected as a duplicate. That trade is deliberate — inflated
-- revenue is the more expensive error, because it teaches the optimiser to buy
-- traffic that does not pay. If an offer legitimately converts twice per click,
-- get a transaction-id macro from the network and drop this index.
create unique index if not exists conversions_dedupe_nosubid_idx
  on conversions (network, sub_id)
  where network_txn_id is null and sub_id is not null;

create index if not exists conversions_ts_idx on conversions (ts desc);

-- Daily ad spend, pulled from the traffic source API.
create table if not exists spend_daily (
  day          date not null,
  source       text not null,
  campaign_id  text,
  adset_id     text,
  ad_id        text not null,
  spend        numeric(10,2) not null default 0,
  impressions  bigint not null default 0,
  clicks       bigint not null default 0,
  currency     text not null default 'USD',
  pulled_at    timestamptz not null default now(),
  primary key (day, source, ad_id)
);

-- Audit trail for the optimizer. Never act without logging why.
create table if not exists decisions (
  id          bigserial primary key,
  ts          timestamptz not null default now(),
  entity_type text not null,        -- ad | adset | campaign
  entity_id   text not null,
  action      text not null,        -- pause | resume | budget_up | budget_down | flag | noop
  reason      text not null,
  metrics     jsonb,
  applied     boolean not null default false,
  error       text
);

create index if not exists decisions_ts_idx on decisions (ts desc);

-- ============================================================
-- Row level security.
--
-- Nothing in this stack talks to Supabase from a browser — every query runs
-- server-side with the service-role key, which bypasses RLS. So enabling RLS
-- with zero policies costs nothing and closes the anon key completely. If the
-- anon key ever leaks, it reads nothing and writes nothing.
-- ============================================================
alter table clicks       enable row level security;
alter table conversions  enable row level security;
alter table spend_daily  enable row level security;
alter table decisions    enable row level security;

-- ============================================================
-- Truth view: real ROI per ad. Spend from the network,
-- conversions from your own postbacks.
--
-- The day/source/ad spine is the UNION of spend, tracked clicks and
-- conversions — not spend alone. A click on Monday that converts on Thursday
-- has no Thursday spend row once the ad is paused, and joining out of
-- spend_daily would drop that revenue from the report entirely, making the ad
-- look like a loser on the exact evidence that proves it is a winner.
--
-- Ceiling: date() buckets in the database timezone (UTC on Supabase) while ad
-- platforms report in the ad account timezone. Days near the boundary can be
-- off by one. Set the ad account to UTC, or accept the drift.
-- ============================================================
create or replace view ad_performance as
with clk as (
  select ad_id, source, date(ts) as day,
         count(*) as tracked_clicks,
         max(offer) as offer
  from clicks
  where ad_id is not null
  group by 1, 2, 3
),
conv as (
  select cl.ad_id, cl.source, date(cv.ts) as day,
         count(*)       as conversions,
         sum(cv.payout) as revenue
  from conversions cv
  join clicks cl on cl.click_id = cv.click_id
  where cv.status <> 'reversed' and cl.ad_id is not null
  group by 1, 2, 3
),
spine as (
  select day, source, ad_id from spend_daily
  union
  select day, source, ad_id from clk
  union
  select day, source, ad_id from conv
)
select
  sp.day,
  sp.source,
  t.offer,
  s.campaign_id,
  s.adset_id,
  sp.ad_id,
  coalesce(s.spend, 0)                                  as spend,
  coalesce(s.impressions, 0)                            as impressions,
  coalesce(s.clicks, 0)                                 as platform_clicks,
  coalesce(t.tracked_clicks, 0)                         as tracked_clicks,
  coalesce(c.conversions, 0)                            as conversions,
  coalesce(c.revenue, 0)                                as revenue,
  coalesce(c.revenue, 0) - coalesce(s.spend, 0)         as profit,
  case when coalesce(s.spend, 0) > 0
       then round(((coalesce(c.revenue,0) - s.spend) / s.spend) * 100, 2)
  end                                                   as roi_pct,
  case when coalesce(c.conversions,0) > 0
       then round(coalesce(s.spend,0) / c.conversions, 2)
  end                                                   as cpa,
  case when coalesce(t.tracked_clicks,0) > 0
       then round((coalesce(c.conversions,0)::numeric / t.tracked_clicks) * 100, 2)
  end                                                   as cvr_pct
from spine sp
left join spend_daily s on s.day = sp.day and s.source = sp.source and s.ad_id = sp.ad_id
left join clk         t on t.day = sp.day and t.source = sp.source and t.ad_id = sp.ad_id
left join conv        c on c.day = sp.day and c.source = sp.source and c.ad_id = sp.ad_id;

-- Views run as their owner by default, which would sidestep the RLS above.
alter view ad_performance set (security_invoker = true);
revoke all on ad_performance from anon, authenticated;

-- ============================================================
-- Tunables. Everything the decision layer judges on lives here, so the
-- thresholds can move without editing a view. Seeded, never overwritten.
-- ============================================================
create table if not exists config (
  key   text primary key,
  value numeric not null,
  note  text
);

insert into config (key, value, note) values
  ('target_payout',       75.00, 'Expected $ per conversion for the live offer'),
  ('target_cvr',          0.025, 'Modeled conversion rate. 0.025 = 2.5%'),
  ('min_clicks_to_judge',   100, 'No CUT verdict below this many clicks'),
  ('min_spend_to_judge',  75.00, 'No CUT verdict below this spend. ~1x payout'),
  ('scale_roi_pct',          30, 'ROI at or above this is a SCALE'),
  ('cut_roi_pct',           -30, 'ROI at or below this is a CUT'),
  ('window_days',             7, 'Trailing window the decision view judges on')
on conflict (key) do nothing;

alter table config enable row level security;

-- ============================================================
-- Decision layer: one row per ad, one verdict, one action.
--
-- ad_performance tells you what happened. This tells you what to do about it,
-- and shows the arithmetic so the verdict is checkable rather than trusted.
--
-- It recommends. Nothing here acts. The optimiser stays unbuilt until there is
-- live data, and when it is built it writes to `decisions` and reads this.
-- ============================================================
create or replace view ad_decisions as
with cfg as (
  select
    coalesce(max(value) filter (where key = 'target_payout'),       75)    as target_payout,
    coalesce(max(value) filter (where key = 'target_cvr'),           0.025) as target_cvr,
    coalesce(max(value) filter (where key = 'min_clicks_to_judge'), 100)   as min_clicks,
    coalesce(max(value) filter (where key = 'min_spend_to_judge'),   75)   as min_spend,
    coalesce(max(value) filter (where key = 'scale_roi_pct'),        30)   as scale_roi,
    coalesce(max(value) filter (where key = 'cut_roi_pct'),         -30)   as cut_roi,
    coalesce(max(value) filter (where key = 'window_days'),           7)   as window_days
  from config
),
w as (
  select
    p.ad_id,
    p.source,
    max(p.offer)               as offer,
    max(p.campaign_id)         as campaign_id,
    max(p.adset_id)            as adset_id,
    min(p.day)                 as first_day,
    max(p.day)                 as last_day,
    sum(p.spend)               as spend,
    sum(p.tracked_clicks)      as clicks,
    sum(p.conversions)         as conversions,
    sum(p.revenue)             as revenue
  from ad_performance p, cfg
  where p.day > current_date - cfg.window_days::int
  group by p.ad_id, p.source
),
m as (
  select
    w.*,
    cfg.target_payout * cfg.target_cvr                              as breakeven_cpc,
    round(w.spend / nullif(w.clicks, 0), 2)                         as cpc,
    round(w.spend / nullif(w.conversions, 0), 2)                    as cpa,
    w.revenue - w.spend                                             as profit,
    case when w.spend > 0
         then round(((w.revenue - w.spend) / w.spend) * 100, 1) end as roi_pct,
    -- The guardrail, in one boolean. Both thresholds, never either. Killing on
    -- 4 clicks and no conversion is killing on noise, and it is how DIY
    -- optimisers murder winners.
    (w.spend >= cfg.min_spend and w.clicks >= cfg.min_clicks)       as judgeable,
    cfg.*
  from w, cfg
)
select
  m.ad_id, m.source, m.offer, m.campaign_id, m.adset_id,
  m.first_day, m.last_day,
  m.spend, m.clicks, m.conversions, m.revenue, m.profit,
  m.roi_pct, m.cpc, m.cpa,
  round(m.breakeven_cpc, 2)                                   as breakeven_cpc,
  case when m.cpc is not null
       then round(m.cpc - m.breakeven_cpc, 2) end             as cpc_over_breakeven,

  case
    when not m.judgeable                     then 'WAIT'
    when m.conversions = 0                   then 'CUT'
    when m.roi_pct >= m.scale_roi            then 'SCALE'
    when m.roi_pct <= m.cut_roi              then 'CUT'
    else                                          'KEEP'
  end                                                         as verdict,

  -- Sort key. Money actively burning outranks money left on the table.
  case
    when not m.judgeable                     then 3
    when m.conversions = 0                   then 1
    when m.roi_pct >= m.scale_roi            then 2
    when m.roi_pct <= m.cut_roi              then 1
    else                                          4
  end                                                         as priority,

  case
    when not m.judgeable then format(
      '%s clicks and $%s spent. Needs %s clicks and $%s before any kill call.',
      m.clicks, round(m.spend, 2), m.min_clicks, round(m.min_spend, 2))
    when m.conversions = 0 then format(
      '$%s across %s clicks, zero conversions. CPC $%s vs $%s break-even.',
      round(m.spend, 2), m.clicks, m.cpc, round(m.breakeven_cpc, 2))
    when m.roi_pct >= m.scale_roi then format(
      'ROI %s%% on %s conversions. CPA $%s against $%s payout.',
      m.roi_pct, m.conversions, m.cpa, round(m.target_payout, 2))
    when m.roi_pct <= m.cut_roi then format(
      'ROI %s%%. CPC $%s is $%s over the $%s break-even.',
      m.roi_pct, m.cpc, round(m.cpc - m.breakeven_cpc, 2), round(m.breakeven_cpc, 2))
    else format(
      'ROI %s%% on %s conversions. Inside the do-nothing band.',
      m.roi_pct, m.conversions)
  end                                                         as reason,

  case
    when not m.judgeable then format('Leave it. Needs %s more clicks.',
                                     greatest(m.min_clicks - m.clicks, 0))
    when m.conversions = 0                   then 'Pause it.'
    when m.roi_pct >= m.scale_roi            then 'Raise budget 20%. Do not touch targeting.'
    when m.roi_pct <= m.cut_roi              then 'Pause it.'
    else                                          'Leave it.'
  end                                                         as next_action
from m;

alter view ad_decisions set (security_invoker = true);
revoke all on ad_decisions from anon, authenticated;

-- ============================================================
-- Is the plumbing working? Separate from "is it making money", because a
-- healthy-looking $0 is indistinguishable from a broken tracker.
-- ============================================================
create or replace view tracker_health as
select
  (select count(*) from clicks where ts > now() - interval '7 days')            as clicks_7d,
  (select count(*) from clicks
     where ts > now() - interval '7 days' and clicked_out)                      as clickouts_7d,
  (select round(100.0 * count(*) filter (where clicked_out) / nullif(count(*), 0), 1)
     from clicks where ts > now() - interval '7 days')                          as clickout_pct,
  -- Postbacks that arrived but matched no click. Before the audit these were
  -- dropped outright; now they land here, and a non-zero count means the
  -- sub-ID macro is wrong on the network side.
  (select count(*) from conversions where sub_id is not null and click_id is null) as unmatched_postbacks,
  -- Only a genuine delivery failure: we attempted, got a response back, and it
  -- was neither a success nor a deliberate skip. Counting every unsent event
  -- made this fire permanently whenever ClickBank's native CAPI is used instead
  -- of lib/capi.ts, which is the recommended setup — and a permanent alarm in
  -- `plumbing` hides the real checks underneath it. Found by running the views
  -- against seeded data, not by reading them.
  (select count(*) from conversions
     where click_id is not null
       and not capi_sent
       and capi_response is not null
       and not (capi_response ? 'skipped'))                                     as capi_undelivered,
  (select coalesce(sum(payout), 0) from conversions where status = 'pending')   as revenue_pending,
  (select coalesce(sum(payout), 0) from conversions where status = 'reversed')  as revenue_reversed;

alter view tracker_health set (security_invoker = true);
revoke all on tracker_health from anon, authenticated;

-- ============================================================
-- The one-row answer to "where are we and what do I do next".
--   select * from adstack_status;
-- ============================================================
create or replace view adstack_status as
with d as (select * from ad_decisions),
     h as (select * from tracker_health),
     worst as (
       select ad_id, spend from d where verdict = 'CUT' order by spend desc limit 1
     ),
     best as (
       select ad_id, roi_pct from d where verdict = 'SCALE' order by roi_pct desc limit 1
     )
select
  (select count(*) from d)                                        as live_ads,
  (select coalesce(sum(spend), 0)   from d)                       as spend,
  (select coalesce(sum(revenue), 0) from d)                       as revenue,
  (select coalesce(sum(profit), 0)  from d)                       as profit,
  (select case when sum(spend) > 0
          then round((sum(revenue) - sum(spend)) / sum(spend) * 100, 1) end from d) as roi_pct,
  (select count(*) from d where verdict = 'CUT')                  as to_cut,
  (select count(*) from d where verdict = 'SCALE')                as to_scale,
  (select count(*) from d where verdict = 'WAIT')                 as still_gathering,
  h.revenue_pending,

  case
    when h.unmatched_postbacks > 0
      then format('%s postback(s) matched no click. Check the sub-ID macro.', h.unmatched_postbacks)
    when h.capi_undelivered > 0
      then format('%s conversion(s) never reached Meta. Check the CAPI token.', h.capi_undelivered)
    when h.clicks_7d > 50 and coalesce(h.clickout_pct, 0) < 10
      then format('Only %s%% of clicks reach the offer. The landing page is the problem.', h.clickout_pct)
    else 'ok'
  end                                                             as plumbing,

  -- One sentence. This is the whole point of the view.
  case
    when h.clicks_7d = 0
      then 'No clicks recorded. Deploy the tracker and send one test click before spending anything.'
    when (select count(*) from d) = 0
      then 'Clicks are landing but no spend has been ingested. spend_daily is empty.'
    when (select count(*) from d where verdict = 'CUT') > 0
      then format('Pause %s ad(s). Start with %s, it has burned $%s.',
                  (select count(*) from d where verdict = 'CUT'),
                  (select ad_id from worst), (select round(spend, 2) from worst))
    when (select count(*) from d where verdict = 'SCALE') > 0
      then format('Raise budget on %s ad(s). Best is %s at %s%% ROI.',
                  (select count(*) from d where verdict = 'SCALE'),
                  (select ad_id from best), (select roi_pct from best))
    when (select count(*) from d where verdict = 'WAIT') > 0
      then format('%s ad(s) still gathering data. Nothing to do today.',
                  (select count(*) from d where verdict = 'WAIT'))
    else 'Everything inside the do-nothing band. Nothing to do today.'
  end                                                             as next_action
from h;

alter view adstack_status set (security_invoker = true);
revoke all on adstack_status from anon, authenticated;
