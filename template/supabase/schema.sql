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
  select ad_id, source, date(ts) as day, count(*) as tracked_clicks
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
