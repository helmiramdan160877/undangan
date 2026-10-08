-- Jalankan SEKALI di Supabase -> SQL Editor -> New query -> Run.
-- Boleh dijalankan ulang. Data lama tidak akan dihapus.
-- Data hanya diakses dari backend Node.js memakai secret key, bukan dari browser.
create table if not exists public.invitation_config (
  id integer primary key check (id = 1),
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
create table if not exists public.rsvp_entries (
  id uuid primary key,
  date timestamptz not null default now(),
  name text not null,
  attendance text not null check (attendance in ('Hadir', 'Tidak hadir', 'Masih ragu')),
  guests integer not null check (guests between 1 and 10)
);
create table if not exists public.wish_entries (
  id uuid primary key,
  date timestamptz not null default now(),
  name text not null,
  message text not null
);
create index if not exists rsvp_entries_date_idx on public.rsvp_entries (date desc);
create index if not exists wish_entries_date_idx on public.wish_entries (date desc);
insert into public.invitation_config(id,data) values (1,'{}'::jsonb)
on conflict (id) do nothing;

-- Tanpa akses langsung dari pengunjung lewat Supabase API.
alter table public.invitation_config enable row level security;
alter table public.rsvp_entries enable row level security;
alter table public.wish_entries enable row level security;
revoke all on public.invitation_config, public.rsvp_entries, public.wish_entries from anon, authenticated;
grant select, insert, update, delete on public.invitation_config, public.rsvp_entries, public.wish_entries to service_role;

-- Bucket dibuat manual lewat menu Supabase Storage:
-- New bucket -> Name: undangan-media -> Public bucket: ON.
-- Tidak perlu membuat policy upload publik karena upload hanya memakai secret key di backend.
