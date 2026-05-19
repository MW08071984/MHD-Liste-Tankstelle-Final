create table if not exists mhd_artikel (
  id text primary key,
  name text,
  barcode text,
  image text,
  category text,
  mhd date,
  menge int,
  employee text,
  type text,
  artikelnummer text,
  created_at timestamptz default now()
);
alter table mhd_artikel disable row level security;
