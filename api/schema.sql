-- Asado calculator schema (Postgres)
-- Primary keys are client-supplied text ids (the frontend already generates ids),
-- which keeps the "save the whole asado" flow simple and stable.

create table if not exists people (
  id          text primary key,
  name        text not null,
  come_carne  boolean not null default true,
  created_at  timestamptz not null default now()
);

create table if not exists asados (
  id          text primary key,
  name        text not null,
  event_date  date,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists expenses (
  id          text primary key,
  asado_id    text not null references asados(id) on delete cascade,
  description text not null default '',
  price       numeric(12,2) not null default 0,
  es_carne    boolean not null default false,
  position    integer not null default 0
);

create table if not exists asado_participants (
  id          text primary key,
  asado_id    text not null references asados(id) on delete cascade,
  person_id   text references people(id) on delete set null,  -- link to roster (recall across events)
  name        text not null default '',
  come_carne  boolean not null default true,
  pagado      boolean not null default false,
  position    integer not null default 0
);

create index if not exists idx_expenses_asado on expenses(asado_id);
create index if not exists idx_participants_asado on asado_participants(asado_id);
