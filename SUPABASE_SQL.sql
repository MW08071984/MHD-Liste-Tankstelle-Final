create table if not exists mhd_artikel (
  id text primary key,
  barcode text,
  name text not null,
  artikelnummer text,
  kategorie text,
  mhd date,
  menge int,
  bild text,
  mitarbeiter text,
  created_at timestamptz default now()
);
