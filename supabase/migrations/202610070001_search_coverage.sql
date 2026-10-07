-- Search coverage retains only coordinates and aggregate counts, not business
-- details. One row per business-type/starting-location pair and sampled tile.
create table public.search_coverage_markets (
  query_key text not null,
  location_key text not null,
  center_lat double precision not null,
  center_lng double precision not null,
  next_tile integer not null default 0 check (next_tile between 0 and 441),
  created_at timestamptz not null default now(),
  primary key (query_key, location_key)
);

create table public.search_coverage_tiles (
  query_key text not null,
  location_key text not null,
  tile_index integer not null check (tile_index between 0 and 440),
  center_lat double precision not null,
  center_lng double precision not null,
  raw_results integer not null default 0,
  duplicates integer not null default 0,
  new_businesses integer not null default 0,
  searched_at timestamptz not null default now(),
  primary key (query_key, location_key, tile_index),
  foreign key (query_key, location_key)
    references public.search_coverage_markets (query_key, location_key)
    on delete cascade
);

alter table public.search_coverage_markets enable row level security;
alter table public.search_coverage_tiles enable row level security;

-- Atomic cursor reservation prevents concurrent lists from sampling the same
-- tile. The first successful city page supplies a provider-derived center.
create or replace function public.reserve_search_coverage_tile(
  p_query_key text, p_location_key text, p_center_lat double precision,
  p_center_lng double precision
) returns table(tile_index integer, market_lat double precision, market_lng double precision)
language plpgsql security definer set search_path = public as $$
begin
  if p_query_key = '' or p_location_key = ''
     or p_center_lat not between -90 and 90 or p_center_lng not between -180 and 180 then
    raise exception 'Invalid coverage market.';
  end if;

  insert into public.search_coverage_markets(query_key, location_key, center_lat, center_lng)
  values (p_query_key, p_location_key, p_center_lat, p_center_lng)
  on conflict (query_key, location_key) do nothing;

  return query
  update public.search_coverage_markets as market
  set next_tile = market.next_tile + 1
  where market.query_key = p_query_key and market.location_key = p_location_key
    and market.next_tile < 441
  returning market.next_tile - 1, market.center_lat, market.center_lng;
end;
$$;

revoke all on function public.reserve_search_coverage_tile(text, text, double precision, double precision) from public;
grant execute on function public.reserve_search_coverage_tile(text, text, double precision, double precision) to service_role;
grant select, insert, update on public.search_coverage_markets to service_role;
grant select, insert, update on public.search_coverage_tiles to service_role;
