-- =====================================================================
-- 0043  Single-currency app: everything in EUR
-- =====================================================================
-- Money is display-only in Inkora, but some rows/defaults were USD/GBP
-- (e.g. London seed artists, and the historical 'USD' column defaults), so
-- prices could render as $/£. Normalise every currency_code to EUR and make
-- EUR the default for new rows. The formatter stays multi-currency-capable;
-- the data just no longer produces anything but EUR.
set search_path = public, extensions;

alter table public.artists           alter column currency_code set default 'EUR';
alter table public.offers            alter column currency_code set default 'EUR';
alter table public.price_estimations alter column currency_code set default 'EUR';

update public.artists           set currency_code = 'EUR' where currency_code <> 'EUR';
update public.offers            set currency_code = 'EUR' where currency_code <> 'EUR';
update public.price_estimations set currency_code = 'EUR' where currency_code <> 'EUR';
