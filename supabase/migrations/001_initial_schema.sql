-- Run in Supabase SQL Editor (Dashboard → SQL → New query) after creating a project.
-- Enables per-user data when the API uses SUPABASE_SERVICE_ROLE_KEY (RLS optional; service role bypasses RLS).

create table if not exists public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  last_resume_update text not null default '',
  updated_at timestamptz not null default now()
);

create table if not exists public.contacts (
  id bigint primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  email text not null default '',
  phone text not null default '',
  company text not null default '',
  role text not null default '',
  notes text not null default '',
  last_contacted text not null default '',
  linkedin text not null default '',
  website text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists contacts_user_id_idx on public.contacts (user_id);

create table if not exists public.reminders (
  id bigint primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  contact_name text not null,
  reason text not null default '',
  due_date text not null default '',
  done boolean not null default false,
  custom_reason text not null default ''
);

create index if not exists reminders_user_id_idx on public.reminders (user_id);

create table if not exists public.outreach_logs (
  id bigint primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  contact_id bigint not null,
  contacted_at text not null,
  channel text not null default '',
  note text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists outreach_logs_user_id_idx on public.outreach_logs (user_id);
create index if not exists outreach_logs_contact_idx on public.outreach_logs (user_id, contact_id);

create table if not exists public.resume_updates (
  id bigint primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  details text not null default '',
  effective_date text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists resume_updates_user_id_idx on public.resume_updates (user_id);

-- Optional RLS for future direct client access (PostgREST). Service role ignores these.
alter table public.profiles enable row level security;
alter table public.contacts enable row level security;
alter table public.reminders enable row level security;
alter table public.outreach_logs enable row level security;
alter table public.resume_updates enable row level security;

create policy "Users read own profile" on public.profiles for select using (auth.uid() = user_id);
create policy "Users upsert own profile" on public.profiles for insert with check (auth.uid() = user_id);
create policy "Users update own profile" on public.profiles for update using (auth.uid() = user_id);

create policy "Users read own contacts" on public.contacts for select using (auth.uid() = user_id);
create policy "Users insert own contacts" on public.contacts for insert with check (auth.uid() = user_id);
create policy "Users update own contacts" on public.contacts for update using (auth.uid() = user_id);
create policy "Users delete own contacts" on public.contacts for delete using (auth.uid() = user_id);

create policy "Users read own reminders" on public.reminders for select using (auth.uid() = user_id);
create policy "Users insert own reminders" on public.reminders for insert with check (auth.uid() = user_id);
create policy "Users update own reminders" on public.reminders for update using (auth.uid() = user_id);
create policy "Users delete own reminders" on public.reminders for delete using (auth.uid() = user_id);

create policy "Users read own logs" on public.outreach_logs for select using (auth.uid() = user_id);
create policy "Users insert own logs" on public.outreach_logs for insert with check (auth.uid() = user_id);
create policy "Users delete own logs" on public.outreach_logs for delete using (auth.uid() = user_id);

create policy "Users read own resume_updates" on public.resume_updates for select using (auth.uid() = user_id);
create policy "Users insert own resume_updates" on public.resume_updates for insert with check (auth.uid() = user_id);
create policy "Users delete own resume_updates" on public.resume_updates for delete using (auth.uid() = user_id);
