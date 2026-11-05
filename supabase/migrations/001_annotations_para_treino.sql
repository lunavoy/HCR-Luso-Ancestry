alter table public.annotations
  add column if not exists source_xml_id text,
  add column if not exists origin text not null default 'kraken'
    check (origin in ('kraken', 'human')),
  add column if not exists original_polygon jsonb,
  add column if not exists original_baseline jsonb,
  add column if not exists line_type text,
  add column if not exists verified_by uuid references auth.users(id),
  add column if not exists verified_at timestamptz;

alter table public.pages
  add column if not exists pagexml_storage_path text;

create unique index if not exists annotations_page_xml_id_uq
  on public.annotations (page_id, source_xml_id)
  where source_xml_id is not null;
create index if not exists annotations_page_idx
  on public.annotations (page_id, element_type, reading_order);
create index if not exists annotations_parent_idx
  on public.annotations (parent_id);
create unique index if not exists pages_document_page_uq
  on public.pages (document_id, page_number);
create unique index if not exists pages_sha256_uq
  on public.pages (sha256)
  where sha256 is not null;

create or replace function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end
$$;

drop trigger if exists annotations_touch on public.annotations;
create trigger annotations_touch before update on public.annotations
for each row execute function public.touch_updated_at();

create or replace view public.v_training_lines
with (security_invoker = true) as
select a.id, a.page_id, p.storage_bucket, p.storage_path,
       p.width_px, p.height_px, a.reading_order, a.polygon,
       a.baseline, a.corrected_text, a.origin
from public.annotations a
join public.pages p on p.id = a.page_id
where a.element_type = 'line' and a.is_verified;
