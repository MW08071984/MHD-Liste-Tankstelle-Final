
-- FINAL SQL
alter table if exists public.abschriften
add column if not exists menge integer default 1;

alter table if exists public.mhd_artikel
add column if not exists bild_url text;

alter table if exists public.mhd_artikel
add column if not exists barcode text;

alter table if exists public.mitarbeiter
add column if not exists rolle text default 'mitarbeiter';

alter table if exists public.mitarbeiter
add column if not exists muss_passwort_aendern boolean default false;

create table if not exists public.app_settings (
  key text primary key,
  value text,
  updated_at timestamp with time zone default now(),
  updated_by text
);

alter table public.mitarbeiter disable row level security;
alter table public.mhd_artikel disable row level security;
alter table public.abschriften disable row level security;
alter table public.app_settings disable row level security;


-- Für Bestandsgrenze und Rückgängig-Funktion ist keine neue SQL-Spalte nötig.
-- Die Funktion nutzt vorhandene Tabellen mhd_artikel und abschriften.
