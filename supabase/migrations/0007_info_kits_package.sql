-- Let an info kit be scoped to one specific package/product, not just a whole brand.
-- Null package_id = general kit shown for every package under that brand.

alter table public.info_kits add column package_id text references public.packages (id);

create index info_kits_package_id_idx on public.info_kits (package_id);
