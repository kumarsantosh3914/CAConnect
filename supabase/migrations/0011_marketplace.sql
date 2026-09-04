-- ---------------------------------------------------------------------------
-- 0011 — Marketplace: public profiles, packages, bookings, reviews
--
-- The demand half of V2. Four tables that interlock, so they land together.
--
-- ═══════════════════════════════════════════════════════════════════════════
--  THIS MIGRATION INTRODUCES THE FIRST PUBLIC READS IN CACONNECT.
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Until now nothing was readable by `anon`: every table was firm-scoped, and
-- the two anonymous surfaces (upload links, client portals) went through the
-- service-role key with a token as the credential. A marketplace is public by
-- definition, so profiles, packages and reviews get real `anon` SELECT
-- policies instead — which is what RLS is for, and keeps the service-role
-- call sites at five.
--
-- Two rules make that safe, and both are load-bearing:
--
--   1. Every public policy filters on a publish flag. An unpublished profile
--      is invisible, and its packages and reviews go with it — the flag is
--      re-checked through the join rather than trusted per row, so
--      unpublishing a profile cannot leave its packages exposed.
--
--   2. NO CONTACT DETAILS LIVE ON A PUBLIC TABLE. Postgres RLS is row-level,
--      not column-level, so a public row is public in full. Rather than reach
--      for column grants, the CA's email and phone simply are not here — the
--      booking form is the contact channel. That also keeps the transaction
--      on-platform, which is where the commission is measured.
--
-- Consumers never get accounts. A booking mints a 32-byte token, the same
-- credential shape as upload links and client portals, and that token is how
-- someone sees their booking and later leaves a review. Reviews are therefore
-- verified by construction: `reviews.booking_id` is UNIQUE and NOT NULL, so a
-- review cannot exist without exactly one real booking behind it.
-- ---------------------------------------------------------------------------

create type booking_status as enum (
  'requested',
  'accepted',
  'declined',
  'completed',
  'cancelled'
);

-- ---------------------------------------------------------------------------
-- ca_profiles — the opt-in public listing, one per firm
-- ---------------------------------------------------------------------------

create table ca_profiles (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references firms on delete cascade unique,
  created_by uuid references auth.users on delete set null,
  -- The public URL: /ca/<slug>. Generated from the display name and city.
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  -- Opt-in, per the vision doc: a firm is listed only if it chooses to be.
  -- Defaults false so creating a draft profile never publishes it by accident.
  is_published boolean not null default false,
  published_at timestamptz,
  -- Denormalised rather than read from firms.name: `firms` is firm-scoped and
  -- must stay that way, and a CA may want a different public-facing name.
  display_name text not null check (length(trim(display_name)) > 0),
  headline text,
  about text,
  city text,
  state text,
  -- Trust signals. The ICAI membership number is already public in ICAI's own
  -- directory, and it is the single strongest "this is a real CA" signal.
  membership_no text,
  years_experience int check (years_experience is null or years_experience between 0 and 70),
  languages text[] not null default '{}',
  specialisations service_type[] not null default '{}',
  -- Paid placement (Revenue Stream 3). Not sold yet; the column exists so
  -- search can order by it from day one without another migration.
  is_featured boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index ca_profiles_published_idx on ca_profiles (is_published, city) where is_published;
create index ca_profiles_specialisation_idx on ca_profiles using gin (specialisations);

create trigger ca_profiles_set_updated_at
  before update on ca_profiles
  for each row execute function set_updated_at();

alter table ca_profiles enable row level security;

-- Public read, published only.
create policy "ca_profiles_public_read" on ca_profiles
  for select to anon, authenticated using (is_published);

-- The owning firm manages its own, published or not.
create policy "ca_profiles_all_firm" on ca_profiles
  for all to authenticated
  using (firm_id in (select auth_firm_ids()))
  with check (firm_id in (select auth_firm_ids()));

-- ---------------------------------------------------------------------------
-- ca_packages — fixed-price offerings, the answer to pricing opacity
-- ---------------------------------------------------------------------------

create table ca_packages (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references firms on delete cascade,
  profile_id uuid not null references ca_profiles on delete cascade,
  created_by uuid references auth.users on delete set null,
  title text not null check (length(trim(title)) > 0),
  description text,
  service_type service_type,
  -- Money as integer paise, never floats. ₹15,000 is 1500000.
  price_paise bigint not null check (price_paise >= 0),
  turnaround_days int check (turnaround_days is null or turnaround_days > 0),
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index ca_packages_profile_idx on ca_packages (profile_id) where is_active;

create trigger ca_packages_set_updated_at
  before update on ca_packages
  for each row execute function set_updated_at();

alter table ca_packages enable row level security;

-- Public read, but ONLY through a published profile. Checking the parent
-- rather than a flag on this row means unpublishing a profile hides its
-- packages in the same instant, with nothing left behind to leak.
create policy "ca_packages_public_read" on ca_packages
  for select to anon, authenticated
  using (
    is_active
    and profile_id in (select id from ca_profiles where is_published)
  );

create policy "ca_packages_all_firm" on ca_packages
  for all to authenticated
  using (firm_id in (select auth_firm_ids()))
  with check (firm_id in (select auth_firm_ids()));

-- ---------------------------------------------------------------------------
-- bookings — a consumer enquiry, with commission recorded but never collected
-- ---------------------------------------------------------------------------

create table bookings (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references firms on delete cascade,
  profile_id uuid not null references ca_profiles on delete cascade,
  -- Nullable: a booking may be a general enquiry rather than a package. Set
  -- null rather than cascade so deleting a package never destroys the
  -- commercial record of what was booked.
  package_id uuid references ca_packages on delete set null,
  -- The consumer's only credential. 32 random bytes, base64url.
  token text not null unique,

  -- The consumer. No account, so these are the whole identity.
  contact_name text not null check (length(trim(contact_name)) > 0),
  contact_email text not null,
  contact_phone text,
  city text,
  service_type service_type,
  message text,

  status booking_status not null default 'requested',

  -- ── Money: RECORDED, NOT COLLECTED ────────────────────────────────────
  -- There is no payment gateway (V3). The CA and client settle directly,
  -- exactly as fees already work. These columns exist so GMV and
  -- commission-owed are measurable from the first booking, and so nothing
  -- needs re-modelling when embedded payments land.
  quoted_amount_paise bigint check (quoted_amount_paise is null or quoted_amount_paise >= 0),
  -- Basis points, not a float or a percentage. 800 = 8%, the rate in the
  -- vision doc. Stored per booking so changing the platform rate later never
  -- silently rewrites what was agreed on old bookings.
  commission_rate_bps int not null default 800 check (commission_rate_bps between 0 and 10000),
  -- Computed when the amount is set, then frozen. Deriving it on read would
  -- make historic commission move whenever the rate changes.
  commission_paise bigint check (commission_paise is null or commission_paise >= 0),
  -- 'consumer' per the vision doc: "CAs pay nothing extra — commission comes
  -- from the user side."
  commission_bearer text not null default 'consumer'
    check (commission_bearer in ('consumer', 'ca')),
  commission_status text not null default 'pending'
    check (commission_status in ('pending', 'waived', 'collected')),

  -- "Booking flows into their client list automatically" — set when the CA
  -- accepts. Nullable because accepting must never fail on a plan cap.
  client_id uuid references clients on delete set null,

  responded_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index bookings_firm_idx on bookings (firm_id, status);
create index bookings_profile_idx on bookings (profile_id);

create trigger bookings_set_updated_at
  before update on bookings
  for each row execute function set_updated_at();

alter table bookings enable row level security;

-- No anon policy at all. A booking holds a consumer's name, email and phone,
-- so it is never public: the consumer reaches their own booking only through
-- the token, server-side, and the CA reaches it through firm scoping.
create policy "bookings_read_firm" on bookings
  for select to authenticated using (firm_id in (select auth_firm_ids()));

create policy "bookings_update_firm" on bookings
  for update to authenticated
  using (firm_id in (select auth_firm_ids()))
  with check (firm_id in (select auth_firm_ids()));

-- ---------------------------------------------------------------------------
-- reviews — verified by construction
-- ---------------------------------------------------------------------------

create table reviews (
  id uuid primary key default gen_random_uuid(),
  -- UNIQUE and NOT NULL together are the verification. There is no path to a
  -- review that does not have exactly one real booking behind it, so "only
  -- real bookings can review" is a schema guarantee rather than a check some
  -- code has to remember to perform.
  booking_id uuid not null references bookings on delete cascade unique,
  firm_id uuid not null references firms on delete cascade,
  profile_id uuid not null references ca_profiles on delete cascade,
  rating int not null check (rating between 1 and 5),
  title text,
  body text,
  -- Copied from the booking when written. If the booking is ever amended the
  -- review still shows who actually said it.
  reviewer_name text not null,
  -- The CA cannot delete a review, but a moderator can unpublish one.
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index reviews_profile_idx on reviews (profile_id) where is_published;

create trigger reviews_set_updated_at
  before update on reviews
  for each row execute function set_updated_at();

alter table reviews enable row level security;

-- Public, through a published profile, same join-through rule as packages.
create policy "reviews_public_read" on reviews
  for select to anon, authenticated
  using (
    is_published
    and profile_id in (select id from ca_profiles where is_published)
  );

-- A firm may READ its own reviews including unpublished ones. Deliberately no
-- insert, update or delete policy: a CA editing or deleting their own reviews
-- would make the whole rating worthless. Writes happen only through the
-- consumer's booking token, server-side.
create policy "reviews_read_firm" on reviews
  for select to authenticated using (firm_id in (select auth_firm_ids()));

-- ---------------------------------------------------------------------------
-- Aggregate rating, for search results and profile headers.
--
-- A view rather than counters on ca_profiles: denormalised counters drift the
-- moment a review is unpublished, and this table is far too small for the
-- read cost to matter.
--
-- security_invoker = true is NOT optional. A Postgres view runs with its
-- OWNER's privileges by default, which would bypass RLS on `reviews`
-- entirely — anon could read aggregate ratings for unpublished profiles, and
-- a firm could read across other firms. With it, the underlying policies are
-- evaluated as the caller, so the view sees exactly what the caller may see.
-- ---------------------------------------------------------------------------
create view ca_profile_ratings
with (security_invoker = true) as
  select
    profile_id,
    count(*)::int as review_count,
    round(avg(rating)::numeric, 2) as average_rating
  from reviews
  where is_published
  group by profile_id;

grant select on ca_profile_ratings to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Consumer writes, without an account and without the service-role key
--
-- A visitor has to be able to do exactly three things: create a booking, read
-- back their own booking, and review it once it is done. None of those fit an
-- RLS policy cleanly — a permissive anon INSERT on `bookings` would let anyone
-- write any column, including status, commission and client_id — and none of
-- them justify a sixth service-role call site.
--
-- So they go through SECURITY DEFINER functions, the same pattern
-- accept_firm_invite() already uses. Each one derives every trustworthy value
-- server-side from rows the caller cannot choose, and takes only the facts a
-- consumer legitimately supplies.
-- ---------------------------------------------------------------------------

-- Creates a booking against a PUBLISHED profile.
--
-- firm_id, the quoted amount and the commission are all derived here, never
-- accepted from the caller: a consumer must not be able to book against an
-- unpublished firm, attribute a booking to another firm, or set their own
-- price. Status is hard-coded to 'requested' so nobody can self-accept.
create or replace function create_booking(
  p_profile_id uuid,
  p_token text,
  p_contact_name text,
  p_contact_email text,
  p_package_id uuid default null,
  p_contact_phone text default null,
  p_city text default null,
  p_service_type service_type default null,
  p_message text default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = public
as $fn_create_booking$
declare
  v_profile record;
  v_package record;
  v_amount bigint;
  v_rate int := 800;
  v_booking_id uuid;
begin
  select id, firm_id into v_profile
    from ca_profiles
   where id = p_profile_id and is_published;

  if v_profile.id is null then
    raise exception 'That CA is not available for booking.' using errcode = 'P0002';
  end if;

  if length(trim(coalesce(p_contact_name, ''))) = 0 then
    raise exception 'A name is required.' using errcode = '22023';
  end if;
  if p_contact_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'A valid email is required.' using errcode = '22023';
  end if;

  -- The price comes from the package row, not from the request body.
  if p_package_id is not null then
    select id, price_paise, service_type into v_package
      from ca_packages
     where id = p_package_id and profile_id = p_profile_id and is_active;

    if v_package.id is null then
      raise exception 'That package is not available.' using errcode = 'P0002';
    end if;
    v_amount := v_package.price_paise;
  end if;

  insert into bookings (
    firm_id, profile_id, package_id, token,
    contact_name, contact_email, contact_phone, city,
    service_type, message, status,
    quoted_amount_paise, commission_rate_bps, commission_paise
  ) values (
    v_profile.firm_id, p_profile_id, v_package.id, p_token,
    trim(p_contact_name), lower(trim(p_contact_email)), p_contact_phone, p_city,
    coalesce(p_service_type, v_package.service_type), p_message, 'requested',
    v_amount, v_rate,
    -- Integer arithmetic on paise. Frozen at booking time so a later change to
    -- the platform rate never rewrites what was agreed here.
    case when v_amount is null then null else (v_amount * v_rate) / 10000 end
  )
  returning id into v_booking_id;

  return v_booking_id;
end;
$fn_create_booking$;

revoke all on function create_booking(uuid, text, text, text, uuid, text, text, service_type, text) from public;
grant execute on function create_booking(uuid, text, text, text, uuid, text, text, service_type, text) to anon, authenticated;

-- Reads back one booking, by the token in the consumer's link.
--
-- Returns only what the consumer already knows or is entitled to see. It
-- deliberately does NOT return the commission columns: what the platform earns
-- is not the buyer's business, and the vision doc prices the service, not the
-- fee split.
create or replace function booking_by_token(p_token text)
returns table (
  id uuid,
  status booking_status,
  contact_name text,
  contact_email text,
  service_type service_type,
  message text,
  quoted_amount_paise bigint,
  created_at timestamptz,
  completed_at timestamptz,
  ca_display_name text,
  ca_slug text,
  ca_city text,
  package_title text,
  has_review boolean
)
language sql
stable
security definer
set search_path = public
as $fn_booking_by_token$
  select
    b.id, b.status, b.contact_name, b.contact_email, b.service_type, b.message,
    b.quoted_amount_paise, b.created_at, b.completed_at,
    p.display_name, p.slug, p.city,
    k.title,
    exists (select 1 from reviews r where r.booking_id = b.id)
  from bookings b
  join ca_profiles p on p.id = b.profile_id
  left join ca_packages k on k.id = b.package_id
  where b.token = p_token;
$fn_booking_by_token$;

revoke all on function booking_by_token(text) from public;
grant execute on function booking_by_token(text) to anon, authenticated;

-- Writes the one review a booking is entitled to.
--
-- The booking token is the entire authorisation: holding it proves you are the
-- person who booked. Reviewing is allowed only once the CA has marked the work
-- completed, so a review always describes work that actually happened — which
-- is what "verified" has to mean for it to be worth anything.
create or replace function create_review(
  p_token text,
  p_rating int,
  p_title text default null,
  p_body text default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = public
as $fn_create_review$
declare
  v_booking record;
  v_review_id uuid;
begin
  select id, firm_id, profile_id, contact_name, status into v_booking
    from bookings where token = p_token;

  if v_booking.id is null then
    raise exception 'That booking could not be found.' using errcode = 'P0002';
  end if;

  if v_booking.status <> 'completed' then
    raise exception 'You can leave a review once the work is marked complete.'
      using errcode = 'P0001';
  end if;

  if p_rating is null or p_rating < 1 or p_rating > 5 then
    raise exception 'A rating between 1 and 5 is required.' using errcode = '22023';
  end if;

  insert into reviews (booking_id, firm_id, profile_id, rating, title, body, reviewer_name)
  values (v_booking.id, v_booking.firm_id, v_booking.profile_id,
          p_rating, nullif(trim(coalesce(p_title, '')), ''),
          nullif(trim(coalesce(p_body, '')), ''), v_booking.contact_name)
  returning id into v_review_id;

  return v_review_id;
exception
  -- The UNIQUE on booking_id is what stops a second review; say so in words
  -- the consumer can act on rather than leaking a constraint name.
  when unique_violation then
    raise exception 'You have already reviewed this booking.' using errcode = 'P0001';
end;
$fn_create_review$;

revoke all on function create_review(text, int, text, text) from public;
grant execute on function create_review(text, int, text, text) to anon, authenticated;
