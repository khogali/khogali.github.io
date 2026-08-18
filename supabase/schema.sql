-- ============================================================
-- adstack — affiliate media buying tracker
-- Offer-agnostic. Works with any network / traffic source.
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

-- Dedupe: a network retrying a postback must not double-count.
create unique index if not exists conversions_dedupe_idx
  on conversions (network, network_txn_id)
  where network_txn_id is not null;

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
-- Truth view: real ROI per ad. Spend from the network,
-- conversions from your own postbacks.
-- ============================================================
create or replace view ad_performance as
select
  s.day,
  s.source,
  s.campaign_id,
  s.adset_id,
  s.ad_id,
  s.spend,
  s.impressions,
  s.clicks                                              as platform_clicks,
  coalesce(t.tracked_clicks, 0)                         as tracked_clicks,
  coalesce(c.conversions, 0)                            as conversions,
  coalesce(c.revenue, 0)                                as revenue,
  coalesce(c.revenue, 0) - s.spend                      as profit,
  case when s.spend > 0
       then round(((coalesce(c.revenue,0) - s.spend) / s.spend) * 100, 2)
  end                                                   as roi_pct,
  case when coalesce(c.conversions,0) > 0
       then round(s.spend / c.conversions, 2)
  end                                                   as cpa,
  case when coalesce(t.tracked_clicks,0) > 0
       then round((coalesce(c.conversions,0)::numeric / t.tracked_clicks) * 100, 2)
  end                                                   as cvr_pct
from spend_daily s
left join (
  select ad_id, date(ts) as day, count(*) as tracked_clicks
  from clicks group by ad_id, date(ts)
) t on t.ad_id = s.ad_id and t.day = s.day
left join (
  select cl.ad_id, date(cv.ts) as day,
         count(*) as conversions,
         sum(cv.payout) as revenue
  from conversions cv
  join clicks cl on cl.click_id = cv.click_id
  where cv.status <> 'reversed'
  group by cl.ad_id, date(cv.ts)
) c on c.ad_id = s.ad_id and c.day = s.day;
