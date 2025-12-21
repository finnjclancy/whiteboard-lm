-- Add title column to nodes table
alter table public.nodes add column title text;

-- Add comment explaining the column
comment on column public.nodes.title is 'Auto-generated title summarizing the conversation';

