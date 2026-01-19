-- Add background color for text nodes
alter table public.nodes add column text_background text default 'transparent';

comment on column public.nodes.text_background is 'Background color for text nodes';
