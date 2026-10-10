-- Phase 1 scaffold: one table per current Zustand store. Domain entities are
-- stored as whole JSONB docs so an existing store record round-trips verbatim
-- and the builder's atomic whole-doc edits stay one row write. The admin-side
-- tables (roles, audit, login history) are normalized because Phase 6 will
-- enforce permissions row by row.

create extension if not exists pgcrypto;

-- Profiles mirror the local `Account` type. RLS reads are the only client path;
-- users are created by Supabase Auth (and seeded in 0003).
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique,
  full_name text not null,
  email text,
  role text not null default 'admin',
  custom_permissions text[],
  status text not null default 'active',
  must_change_password boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- `data` mirrors the persisted shape of each store's record verbatim.
create table if not exists public.members (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.trainees (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.suguans (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.koro_documents (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.organista_suguans (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.assignment_presets (
  id text primary key,
  owner_id uuid references auth.users (id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

-- Settings live in one row: the app is a single-congregation tool where service
-- types, duty roles, voices, worship schedules and locale name are shared state.
create table if not exists public.settings (
  id smallint primary key default 1,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.roles (
  id text primary key,
  label text not null,
  description text not null default '',
  builtin boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.role_permissions (
  role_id text not null references public.roles (id) on delete cascade,
  permission text not null,
  primary key (role_id, permission)
);

create table if not exists public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users (id) on delete set null,
  actor_name text not null default '',
  actor_username text not null default '',
  action text not null,
  module text not null default '',
  affected_user_id uuid,
  affected_user_name text,
  details text,
  created_at timestamptz not null default now()
);

create table if not exists public.login_history (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users (id) on delete set null,
  user_name text not null default '',
  username text not null default '',
  device text not null default '',
  client_ip inet,
  status text not null default 'successful',
  created_at timestamptz not null default now()
);