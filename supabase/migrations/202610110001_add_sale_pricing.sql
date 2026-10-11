-- Existing installations: run this file in Supabase Dashboard > SQL Editor.
-- This migration preserves the catalog, stock, images, and admin permissions.
begin;

alter table public.products
  add column if not exists sale_price_cents integer;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.products'::regclass
      and conname = 'products_sale_price_valid'
  ) then
    alter table public.products add constraint products_sale_price_valid
      check (sale_price_cents is null or
        (sale_price_cents >= 0 and sale_price_cents < price_cents));
  end if;
end;
$$;

notify pgrst, 'reload schema';
commit;
