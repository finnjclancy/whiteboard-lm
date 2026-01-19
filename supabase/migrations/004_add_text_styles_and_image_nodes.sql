-- Add styling columns for text nodes
alter table public.nodes add column text_font_family text default 'sans';
alter table public.nodes add column text_font_size integer default 14;
alter table public.nodes add column text_color text default '#44403c';
alter table public.nodes add column text_is_bulleted boolean default false;

comment on column public.nodes.text_font_family is 'Font family key for text nodes (sans/serif/mono)';
comment on column public.nodes.text_font_size is 'Font size in pixels for text nodes';
comment on column public.nodes.text_color is 'Text color for text nodes';
comment on column public.nodes.text_is_bulleted is 'Render text node content as a bullet list';

-- Add image columns for PDF page nodes
alter table public.nodes add column image_data text;
alter table public.nodes add column image_width integer;
alter table public.nodes add column image_height integer;

comment on column public.nodes.image_data is 'Base64 data URL for image nodes';
comment on column public.nodes.image_width is 'Rendered image width in pixels';
comment on column public.nodes.image_height is 'Rendered image height in pixels';

comment on column public.nodes.node_type is 'Type of node: chat, text, or image';
