-- Speed-Update für MHD Kontrolle
-- In Supabase SQL Editor ausführen. Löscht keine Daten.

create index if not exists idx_mhd_artikel_mhd on public.mhd_artikel (mhd);
create index if not exists idx_mhd_artikel_barcode on public.mhd_artikel (barcode);
create index if not exists idx_mhd_artikel_artikelnummer on public.mhd_artikel (artikelnummer);
create index if not exists idx_mhd_artikel_kategorie on public.mhd_artikel (kategorie);

create unique index if not exists idx_artikel_stammdaten_barcode_unique on public.artikel_stammdaten (barcode);
create index if not exists idx_artikel_stammdaten_artikelnummer on public.artikel_stammdaten (artikelnummer);
create index if not exists idx_artikel_stammdaten_name on public.artikel_stammdaten (name);

create index if not exists idx_abschriften_created_at on public.abschriften (created_at desc);
create index if not exists idx_abschriften_datum on public.abschriften (datum desc);
create index if not exists idx_abschriften_typ on public.abschriften (typ);

create index if not exists idx_fehlende_artikel_status_created on public.fehlende_artikel (status, created_at desc);
create index if not exists idx_fehlende_artikel_barcode_status on public.fehlende_artikel (barcode, status);


-- Zusätzlicher Index gegen Timeout in der MHD-Übersicht / Alle MHD
create index if not exists idx_mhd_artikel_mhd_order on public.mhd_artikel (mhd);
create index if not exists idx_mhd_artikel_mhd_barcode on public.mhd_artikel (mhd, barcode);
