-- Referral program: an existing contact refers a new contact; when the
-- referred contact's deal closes, the referrer gets a reward.
-- Internal use only — no external referral portal, agents log this from the CRM.

-- ---------------------------------------------------------------------------
-- referral code generator (short, unique, human-readable)
-- ---------------------------------------------------------------------------
create function public.generate_referral_code()
returns text
language plpgsql
as $$
declare
  candidate text;
begin
  loop
    candidate := 'REF-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
    exit when not exists (select 1 from public.referrals where code = candidate);
  end loop;
  return candidate;
end;
$$;

-- ---------------------------------------------------------------------------
-- referrals
-- ---------------------------------------------------------------------------
create table public.referrals (
  id uuid primary key default gen_random_uuid(),
  code text not null unique default public.generate_referral_code(),
  referrer_contact_id uuid not null references public.contacts (id),
  referred_contact_id uuid references public.contacts (id),
  referred_deal_id uuid references public.deals (id),
  status text not null default 'pending' check (
    status in ('pending', 'referred', 'won', 'rewarded', 'expired')
  ),
  reward_type text check (reward_type in ('discount_percent', 'discount_amount', 'cash', 'credit')),
  reward_value numeric(10, 2),
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index referrals_referrer_contact_id_idx on public.referrals (referrer_contact_id);
create index referrals_referred_contact_id_idx on public.referrals (referred_contact_id);
create index referrals_status_idx on public.referrals (status);

create trigger referrals_set_updated_at before update on public.referrals
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS — same pattern as contacts/deals: any signed-in agent can read & write.
-- ---------------------------------------------------------------------------
alter table public.referrals enable row level security;

create policy referrals_all on public.referrals for all to authenticated using (true) with check (true);

-- ---------------------------------------------------------------------------
-- grants (SQL-created tables need explicit grants, see 0004_grants.sql)
-- ---------------------------------------------------------------------------
grant select, insert, update, delete on public.referrals to authenticated;
