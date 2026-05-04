-- Multi-tenant setup for BM Dashboard (Supabase)
-- Goal:
-- 1) Each company (tenant) has isolated data
-- 2) Users from same tenant share same records
-- 3) No cross-company access

create extension if not exists pgcrypto;

create table if not exists public.tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text not null unique,
  owner_user_id uuid not null,
  created_at timestamptz not null default now()
);

create table if not exists public.user_tenants (
  user_id uuid primary key,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  role text not null default 'member' check (role in ('owner','member')),
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  user_id uuid primary key,
  full_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_data (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete cascade,
  owner_user_id uuid,
  content jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Existing table migration (if user_data already exists)
alter table if exists public.user_data
  add column if not exists tenant_id uuid references public.tenants(id) on delete cascade;

alter table if exists public.user_data
  add column if not exists owner_user_id uuid;

alter table if exists public.user_data
  add column if not exists updated_at timestamptz not null default now();

-- Ensure one shared row per tenant
create unique index if not exists user_data_tenant_id_unique on public.user_data(tenant_id);

-- Enable RLS
alter table public.tenants enable row level security;
alter table public.user_tenants enable row level security;
alter table public.user_data enable row level security;
alter table public.profiles enable row level security;

-- Policies: tenants
drop policy if exists "tenant_select_by_membership" on public.tenants;
create policy "tenant_select_by_membership"
on public.tenants
for select
using (
  exists (
    select 1
    from public.user_tenants ut
    where ut.user_id = auth.uid()
      and ut.tenant_id = tenants.id
  )
);

drop policy if exists "tenant_insert_owner" on public.tenants;
create policy "tenant_insert_owner"
on public.tenants
for insert
with check (false);

drop policy if exists "tenant_update_owner" on public.tenants;
create policy "tenant_update_owner"
on public.tenants
for update
using (false)
with check (false);

-- Policies: user_tenants
drop policy if exists "user_tenants_select_own_or_same_tenant" on public.user_tenants;
create policy "user_tenants_select_own_or_same_tenant"
on public.user_tenants
for select
using (user_id = auth.uid());

drop policy if exists "user_tenants_insert_self" on public.user_tenants;
create policy "user_tenants_insert_self"
on public.user_tenants
for insert
with check (false);

drop policy if exists "user_tenants_update_self" on public.user_tenants;
create policy "user_tenants_update_self"
on public.user_tenants
for update
using (false)
with check (false);

-- Policies: user_data
drop policy if exists "user_data_select_same_tenant" on public.user_data;
create policy "user_data_select_same_tenant"
on public.user_data
for select
using (
  exists (
    select 1
    from public.user_tenants ut
    where ut.user_id = auth.uid()
      and ut.tenant_id = user_data.tenant_id
  )
);

drop policy if exists "user_data_insert_same_tenant" on public.user_data;
create policy "user_data_insert_same_tenant"
on public.user_data
for insert
with check (
  exists (
    select 1
    from public.user_tenants ut
    where ut.user_id = auth.uid()
      and ut.tenant_id = user_data.tenant_id
  )
);

drop policy if exists "user_data_update_same_tenant" on public.user_data;
create policy "user_data_update_same_tenant"
on public.user_data
for update
using (
  exists (
    select 1
    from public.user_tenants ut
    where ut.user_id = auth.uid()
      and ut.tenant_id = user_data.tenant_id
  )
)
with check (
  exists (
    select 1
    from public.user_tenants ut
    where ut.user_id = auth.uid()
      and ut.tenant_id = user_data.tenant_id
  )
);

-- Optional: block delete from client
drop policy if exists "user_data_no_delete" on public.user_data;
create policy "user_data_no_delete"
on public.user_data
for delete
using (false);

-- Profiles (nome completo do usuario)
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
on public.profiles
for select
using (user_id = auth.uid());

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
on public.profiles
for insert
with check (user_id = auth.uid());

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles
for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- Funcoes seguras para criar/entrar em empresa sem expor escrita direta ampla
create or replace function public._generate_invite_code()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  code text;
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  i int;
begin
  loop
    code := '';
    for i in 1..8 loop
      code := code || substr(chars, 1 + floor(random() * length(chars))::int, 1);
    end loop;
    exit when not exists (select 1 from public.tenants t where t.invite_code = code);
  end loop;
  return code;
end;
$$;

create or replace function public.create_tenant_for_owner(p_name text)
returns table(tenant_id uuid, tenant_name text, invite_code text, role text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_tenant_id uuid;
  v_name text := nullif(trim(p_name), '');
  v_code text;
begin
  if v_user is null then
    raise exception 'not_authenticated';
  end if;

  if exists (select 1 from public.user_tenants ut where ut.user_id = v_user) then
    raise exception 'user_already_has_tenant';
  end if;

  if v_name is null then
    v_name := 'Empresa';
  end if;

  v_code := public._generate_invite_code();

  insert into public.tenants(name, invite_code, owner_user_id)
  values (v_name, v_code, v_user)
  returning id into v_tenant_id;

  insert into public.user_tenants(user_id, tenant_id, role)
  values (v_user, v_tenant_id, 'owner');

  return query
  select v_tenant_id, v_name, v_code, 'owner'::text;
end;
$$;

create or replace function public.join_tenant_by_invite(p_invite_code text)
returns table(tenant_id uuid, tenant_name text, invite_code text, role text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_code text := upper(regexp_replace(coalesce(p_invite_code, ''), '[^A-Z0-9]', '', 'g'));
  v_tenant record;
begin
  if v_user is null then
    raise exception 'not_authenticated';
  end if;

  select t.id, t.name, t.invite_code
  into v_tenant
  from public.tenants t
  where t.invite_code = v_code
  limit 1;

  if v_tenant.id is null then
    raise exception 'invalid_invite_code';
  end if;

  insert into public.user_tenants(user_id, tenant_id, role)
  values (v_user, v_tenant.id, 'member')
  on conflict (user_id)
  do update set tenant_id = excluded.tenant_id, role = 'member';

  return query
  select v_tenant.id, v_tenant.name, v_tenant.invite_code, 'member'::text;
end;
$$;

revoke all on function public._generate_invite_code() from public;
revoke execute on function public.create_tenant_for_owner(text) from public;
revoke execute on function public.join_tenant_by_invite(text) from public;
revoke execute on function public.create_tenant_for_owner(text) from authenticated;
revoke execute on function public.join_tenant_by_invite(text) from authenticated;

-- ============================================================================
-- FLUXO DE APROVACAO MANUAL (ADMIN)
-- ============================================================================
-- 1) Usuario se cadastra no app (nome completo + email + senha)
-- 2) Admin cria/define a empresa e vincula o usuario no banco
-- 3) Apos inserir em user_tenants, o usuario ja consegue logar no dashboard
--
-- Exemplo: criar empresa para um dono
-- insert into public.tenants(name, invite_code, owner_user_id)
-- values ('Giovani Emprestimos', 'GJ2026BM', '<USER_ID_DO_DONO>');
--
-- Exemplo: vincular dono na propria empresa
-- insert into public.user_tenants(user_id, tenant_id, role)
-- values ('<USER_ID_DO_DONO>', '<TENANT_ID>', 'owner')
-- on conflict (user_id) do update set tenant_id = excluded.tenant_id, role = excluded.role;
--
-- Exemplo: vincular membro da equipe na mesma empresa
-- insert into public.user_tenants(user_id, tenant_id, role)
-- values ('<USER_ID_DO_MEMBRO>', '<TENANT_ID>', 'member')
-- on conflict (user_id) do update set tenant_id = excluded.tenant_id, role = excluded.role;
