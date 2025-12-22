-- Add node_type column to differentiate between chat nodes and text nodes
alter table public.nodes add column node_type text default 'chat' not null;

-- Add text_content column for text nodes
alter table public.nodes add column text_content text;

-- Add comment explaining the columns
comment on column public.nodes.node_type is 'Type of node: chat or text';
comment on column public.nodes.text_content is 'Content for text nodes';

