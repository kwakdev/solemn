-- Solemn Memory: Supabase database, admin access, and product image storage.
-- Run this entire file once in Supabase Dashboard > SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.admin_users (
  email text primary key,
  created_at timestamptz not null default now()
);

-- Existing Solemn Memory admin emails. Change these if needed.
insert into public.admin_users (email)
values
  ('evankwak19@gmail.com'),
  ('kwakdev03@gmail.com')
on conflict (email) do nothing;

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  price_cents integer not null default 0 check (price_cents >= 0),
  placement text not null default 'new_arrivals'
    check (placement in ('new_arrivals', 'collection', 'memories')),
  description jsonb not null default '[]'::jsonb,
  sizes jsonb not null default '[]'::jsonb,
  images text[] not null default array[]::text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists products_placement_updated_idx
  on public.products (placement, updated_at desc);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.admin_users
    where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

create or replace function public.set_product_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists products_set_updated_at on public.products;
create trigger products_set_updated_at
before update on public.products
for each row execute function public.set_product_updated_at();

alter table public.admin_users enable row level security;
alter table public.products enable row level security;

drop policy if exists "Admins can view their allowlist entry" on public.admin_users;
create policy "Admins can view their allowlist entry"
on public.admin_users for select
to authenticated
using (public.is_admin());

drop policy if exists "Anyone can view products" on public.products;
create policy "Anyone can view products"
on public.products for select
to anon, authenticated
using (true);

drop policy if exists "Admins can add products" on public.products;
create policy "Admins can add products"
on public.products for insert
to authenticated
with check (public.is_admin());

drop policy if exists "Admins can update products" on public.products;
create policy "Admins can update products"
on public.products for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Admins can delete products" on public.products;
create policy "Admins can delete products"
on public.products for delete
to authenticated
using (public.is_admin());

grant select on public.products to anon, authenticated;
grant insert, update, delete on public.products to authenticated;
grant select on public.admin_users to authenticated;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'product-images',
  'product-images',
  true,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Admins can upload product images" on storage.objects;
create policy "Admins can upload product images"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'product-images'
  and public.is_admin()
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Admins can update product images" on storage.objects;
create policy "Admins can update product images"
on storage.objects for update
to authenticated
using (bucket_id = 'product-images' and public.is_admin())
with check (bucket_id = 'product-images' and public.is_admin());

drop policy if exists "Admins can delete product images" on storage.objects;
create policy "Admins can delete product images"
on storage.objects for delete
to authenticated
using (bucket_id = 'product-images' and public.is_admin());

insert into public.products (
  slug,
  name,
  price_cents,
  placement,
  description,
  sizes,
  images
)
values
  (
    'tole-tole-cuddle',
    'TOLE TOLE “CUDDLE MODE”',
    13800,
    'new_arrivals',
    '["TOLE TOLE BEING HELD LIKE A TINY BABY", "EXTRA LARGE EYES AND A VERY SERIOUS FACE", "MAXIMUM CUDDLE MODE", "VERY PATIENT AND SLIGHTLY CONFUSED", "THE ORIGINAL TOLE TOLE PORTRAIT"]'::jsonb,
    '[{"label":"1","stock":8},{"label":"2","stock":8},{"label":"3","stock":8},{"label":"4","stock":8}]'::jsonb,
    array['/products/cat.png']
  ),
  (
    'tole-tole-pineapple',
    'TOLE TOLE “PINEAPPLE QUEEN”',
    24200,
    'new_arrivals',
    '["TOLE TOLE WEARING A PINEAPPLE CROWN", "FULL TROPICAL FRUIT ENERGY", "MATCHING PINEAPPLE SLICE INCLUDED IN THE PHOTO", "CALM, REGAL, AND SLIGHTLY JUICY", "THE QUEEN OF THE FRUIT BOWL"]'::jsonb,
    '[{"label":"1","stock":8},{"label":"2","stock":8},{"label":"3","stock":8},{"label":"4","stock":8}]'::jsonb,
    array['/products/cat2.png']
  ),
  (
    'tole-tole-strawberry-bob',
    'TOLE TOLE “STRAWBERRY BOB”',
    5800,
    'collection',
    '["TOLE TOLE WEARING A LONG BROWN BOB WIG", "STRAWBERRY HAIR CLIPS ON BOTH SIDES", "FRESH SALON LOOK", "SERVING A VERY SERIOUS BEAUTY POSE", "READY FOR HER CLOSE-UP"]'::jsonb,
    '[{"label":"1","stock":8},{"label":"2","stock":8},{"label":"3","stock":8},{"label":"4","stock":8}]'::jsonb,
    array['/products/cat3.png']
  ),
  (
    'tole-tole-busy-bee',
    'TOLE TOLE “BUSY BEE”',
    13800,
    'collection',
    '["TOLE TOLE WEARING A BLACK-AND-YELLOW BEE COSTUME", "HOOD WITH TWO SOFT ANTENNAE", "SITTING POLITELY IN THE KITCHEN", "BUSY BEE ENERGY WITHOUT THE BUZZING", "READY TO POLLINATE THE SNACK CABINET"]'::jsonb,
    '[{"label":"1","stock":8},{"label":"2","stock":8},{"label":"3","stock":8},{"label":"4","stock":8}]'::jsonb,
    array['/products/cat4.png']
  ),
  (
    'tole-tole-cheese-head',
    'TOLE TOLE “CHEESE HEAD”',
    23200,
    'memories',
    '["TOLE TOLE WEARING A GIANT CHEESE-SLICE HAT", "BOLD YELLOW COLOR", "A LITTLE ANNOYED BUT STILL FASHIONABLE", "SERVING SHARP CHEDDAR ATTITUDE", "NOT ACTUALLY MADE OF CHEESE"]'::jsonb,
    '[{"label":"1","stock":1},{"label":"2","stock":1},{"label":"3","stock":1},{"label":"4","stock":0}]'::jsonb,
    array['/products/cat5.png']
  )
on conflict (slug) do nothing;
