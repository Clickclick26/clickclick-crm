-- ClickClick CRM — initial schema
-- Mirrors src/data/mock.ts types + docs/CLAUDE_HANDOFF.md data model sketch.

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- agents (one row per auth user)
-- ---------------------------------------------------------------------------
create table public.agents (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null,
  role text not null default 'agent' check (role in ('agent', 'admin')),
  online boolean not null default false,
  on_call_with uuid, -- contact id the agent is currently on a call with; FK added below once contacts exists
  personal_number_id text,
  created_at timestamptz not null default now()
);

-- Bootstrap: first agent ever created becomes admin automatically.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.agents (id, name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
    case when (select count(*) from public.agents) = 0 then 'admin' else 'agent' end
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Helper used by RLS policies below.
create function public.is_admin()
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (
    select 1 from public.agents where id = auth.uid() and role = 'admin'
  );
$$;

-- ---------------------------------------------------------------------------
-- brands
-- ---------------------------------------------------------------------------
create table public.brands (
  id text primary key,
  label text not null
);

-- ---------------------------------------------------------------------------
-- outbound_numbers
-- ---------------------------------------------------------------------------
create table public.outbound_numbers (
  id text primary key,
  label text not null,
  e164 text not null,
  display text not null,
  brand_id text not null references public.brands (id),
  region text not null check (region in ('belfast', 'london', 'scotland', 'wales', 'other')),
  kind text not null check (kind in ('personal', 'local', 'main')),
  agent_id uuid references public.agents (id)
);

alter table public.agents
  add constraint agents_personal_number_id_fkey
  foreign key (personal_number_id) references public.outbound_numbers (id);

-- ---------------------------------------------------------------------------
-- contacts
-- ---------------------------------------------------------------------------
create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  company text not null default '',
  phone text not null,
  email text not null default '',
  avatar_url text,
  owner_id uuid references public.agents (id),
  stage text not null default 'new' check (stage in ('new', 'talking', 'proposal', 'won', 'lost')),
  source text not null default '',
  timezone text not null default 'Europe/London',
  quiet_hours text not null default '',
  do_not_call boolean not null default false,
  notes text not null default '',
  tags text[] not null default '{}',
  next_callback text,
  region text not null default 'other' check (region in ('belfast', 'london', 'scotland', 'wales', 'other')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index contacts_owner_id_idx on public.contacts (owner_id);
create index contacts_stage_idx on public.contacts (stage);

alter table public.agents
  add constraint agents_on_call_with_fkey
  foreign key (on_call_with) references public.contacts (id);

-- ---------------------------------------------------------------------------
-- dialer lists (+ membership, so counts are real)
-- ---------------------------------------------------------------------------
create table public.dialer_lists (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  emoji text not null default '📞',
  sort_order int not null default 0
);

create table public.dialer_list_members (
  list_id uuid not null references public.dialer_lists (id) on delete cascade,
  contact_id uuid not null references public.contacts (id) on delete cascade,
  primary key (list_id, contact_id)
);

-- ---------------------------------------------------------------------------
-- calls
-- ---------------------------------------------------------------------------
create table public.calls (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.contacts (id),
  phone text not null,
  status text not null check (status in ('missed', 'inbound', 'outbound')),
  extension text,
  channel text not null default 'phone' check (channel in ('phone', 'lark_video')),
  occurred_at timestamptz not null default now(),
  duration_sec int,
  recording_url text,
  outcome text check (outcome in ('sold', 'callback', 'no_answer', 'not_interested', 'do_not_call', 'wrong_number')),
  agent_id uuid references public.agents (id),
  from_number_id text references public.outbound_numbers (id),
  created_at timestamptz not null default now()
);

create index calls_contact_id_idx on public.calls (contact_id);
create index calls_agent_id_idx on public.calls (agent_id);
create index calls_occurred_at_idx on public.calls (occurred_at desc);

-- ---------------------------------------------------------------------------
-- call_feedback (coaching)
-- ---------------------------------------------------------------------------
create table public.call_feedback (
  id uuid primary key default gen_random_uuid(),
  call_id uuid not null references public.calls (id),
  agent_id uuid not null references public.agents (id),
  admin_id uuid not null references public.agents (id),
  note text not null,
  created_at timestamptz not null default now()
);

create index call_feedback_agent_id_idx on public.call_feedback (agent_id);

-- ---------------------------------------------------------------------------
-- scripts ("everyone" default + per-agent overrides) and objections
-- ---------------------------------------------------------------------------
create table public.scripts (
  id uuid primary key default gen_random_uuid(),
  scope text not null default 'everyone' check (scope in ('everyone', 'agent')),
  agent_id uuid references public.agents (id),
  title text not null,
  body text not null,
  updated_at timestamptz not null default now(),
  constraint scripts_agent_scope_chk check (
    (scope = 'everyone' and agent_id is null) or (scope = 'agent' and agent_id is not null)
  )
);

create unique index scripts_one_everyone_idx on public.scripts (scope) where scope = 'everyone';
create unique index scripts_one_per_agent_idx on public.scripts (agent_id) where scope = 'agent';

create table public.objections (
  id uuid primary key default gen_random_uuid(),
  brand_id text references public.brands (id),
  label text not null,
  reply text not null,
  sort_order int not null default 0
);

-- ---------------------------------------------------------------------------
-- packages, info kits, contract templates
-- ---------------------------------------------------------------------------
create table public.packages (
  id text primary key,
  brand_id text not null references public.brands (id),
  name text not null,
  blurb text not null default '',
  default_price numeric(10, 2) not null,
  default_monthly numeric(10, 2)
);

create table public.info_kits (
  id text primary key,
  brand_id text not null references public.brands (id),
  name text not null,
  blurb text not null default '',
  subject text not null default ''
);

create table public.contract_templates (
  id text primary key,
  brand_id text not null references public.brands (id),
  pay_type text not null check (pay_type in ('one_off', 'deposit', 'monthly', 'direct_debit')),
  name text not null,
  body text not null,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- deals + commission
-- ---------------------------------------------------------------------------
create table public.deals (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid references public.contacts (id),
  brand_id text not null references public.brands (id),
  package_ids text[] not null default '{}',
  pay_type text not null check (pay_type in ('one_off', 'deposit', 'monthly', 'direct_debit')),
  status text not null default 'draft' check (
    status in ('draft', 'contract_sent', 'signed', 'pay_sent', 'deposit_paid', 'active', 'closed')
  ),
  client_name text not null,
  company text not null default '',
  start_date date,
  end_date date,
  total_price numeric(10, 2),
  deposit_amount numeric(10, 2),
  monthly_amount numeric(10, 2),
  custom_notes text not null default '',
  agent_id uuid references public.agents (id),
  signed_pdf_path text,
  stripe_customer_id text,
  stripe_subscription_id text,
  gocardless_mandate_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index deals_contact_id_idx on public.deals (contact_id);
create index deals_agent_id_idx on public.deals (agent_id);

create table public.commission_events (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.deals (id),
  agent_id uuid not null references public.agents (id),
  amount numeric(10, 2) not null,
  basis text not null,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
create function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger contacts_set_updated_at before update on public.contacts
  for each row execute function public.set_updated_at();
create trigger contract_templates_set_updated_at before update on public.contract_templates
  for each row execute function public.set_updated_at();
create trigger deals_set_updated_at before update on public.deals
  for each row execute function public.set_updated_at();
create trigger scripts_set_updated_at before update on public.scripts
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- Internal team tool: any signed-in agent can read/use team data.
-- Admin-only for reference data (scripts default, templates, packages, etc).
-- ---------------------------------------------------------------------------
alter table public.agents enable row level security;
alter table public.brands enable row level security;
alter table public.outbound_numbers enable row level security;
alter table public.contacts enable row level security;
alter table public.dialer_lists enable row level security;
alter table public.dialer_list_members enable row level security;
alter table public.calls enable row level security;
alter table public.call_feedback enable row level security;
alter table public.scripts enable row level security;
alter table public.objections enable row level security;
alter table public.packages enable row level security;
alter table public.info_kits enable row level security;
alter table public.contract_templates enable row level security;
alter table public.deals enable row level security;
alter table public.commission_events enable row level security;

-- agents: everyone can see the team; you can update your own row, admin can update any.
create policy agents_select on public.agents for select to authenticated using (true);
create policy agents_update_self on public.agents for update to authenticated
  using (id = auth.uid() or public.is_admin());

-- brands / reference data shared across the team: read for all, write for admin.
create policy brands_select on public.brands for select to authenticated using (true);
create policy brands_admin_write on public.brands for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy outbound_numbers_select on public.outbound_numbers for select to authenticated using (true);
create policy outbound_numbers_admin_write on public.outbound_numbers for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy packages_select on public.packages for select to authenticated using (true);
create policy packages_admin_write on public.packages for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy info_kits_select on public.info_kits for select to authenticated using (true);
create policy info_kits_admin_write on public.info_kits for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy contract_templates_select on public.contract_templates for select to authenticated using (true);
create policy contract_templates_admin_write on public.contract_templates for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy objections_select on public.objections for select to authenticated using (true);
create policy objections_admin_write on public.objections for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- scripts: everyone reads; admin edits "everyone" scope; an agent may edit their own override, admin edits any.
create policy scripts_select on public.scripts for select to authenticated using (true);
create policy scripts_write on public.scripts for all to authenticated
  using (public.is_admin() or agent_id = auth.uid())
  with check (public.is_admin() or agent_id = auth.uid());

-- contacts / calls / dialer lists / deals: shared CRM data, any signed-in agent can read & write.
create policy contacts_all on public.contacts for all to authenticated using (true) with check (true);
create policy dialer_lists_select on public.dialer_lists for select to authenticated using (true);
create policy dialer_lists_admin_write on public.dialer_lists for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy dialer_list_members_all on public.dialer_list_members for all to authenticated using (true) with check (true);
create policy calls_all on public.calls for all to authenticated using (true) with check (true);
create policy deals_all on public.deals for all to authenticated using (true) with check (true);

-- call_feedback: admin writes; agent can read their own file, admin reads all.
create policy call_feedback_select on public.call_feedback for select to authenticated
  using (agent_id = auth.uid() or public.is_admin());
create policy call_feedback_admin_write on public.call_feedback for insert to authenticated
  with check (public.is_admin());
create policy call_feedback_admin_update on public.call_feedback for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- commission_events: agent reads their own, admin reads/writes all.
create policy commission_events_select on public.commission_events for select to authenticated
  using (agent_id = auth.uid() or public.is_admin());
create policy commission_events_admin_write on public.commission_events for insert to authenticated
  with check (public.is_admin());
create policy commission_events_admin_update on public.commission_events for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
