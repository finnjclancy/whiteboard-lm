-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Canvases table
create table public.canvases (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  name text default 'untitled' not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Nodes table (chat cards)
create table public.nodes (
  id uuid default uuid_generate_v4() primary key,
  canvas_id uuid references public.canvases(id) on delete cascade not null,
  parent_node_id uuid references public.nodes(id) on delete set null,
  position_x float default 0 not null,
  position_y float default 0 not null,
  seed_text text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Messages table
create table public.messages (
  id uuid default uuid_generate_v4() primary key,
  node_id uuid references public.nodes(id) on delete cascade not null,
  role text check (role in ('user', 'assistant', 'system')) not null,
  content text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Edges table (visual connections between nodes)
create table public.edges (
  id uuid default uuid_generate_v4() primary key,
  canvas_id uuid references public.canvases(id) on delete cascade not null,
  source_node_id uuid references public.nodes(id) on delete cascade not null,
  target_node_id uuid references public.nodes(id) on delete cascade not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Indexes for performance
create index canvases_user_id_idx on public.canvases(user_id);
create index nodes_canvas_id_idx on public.nodes(canvas_id);
create index messages_node_id_idx on public.messages(node_id);
create index edges_canvas_id_idx on public.edges(canvas_id);

-- Row Level Security (RLS)
alter table public.canvases enable row level security;
alter table public.nodes enable row level security;
alter table public.messages enable row level security;
alter table public.edges enable row level security;

-- Canvases policies
create policy "Users can view their own canvases"
  on public.canvases for select
  using (auth.uid() = user_id);

create policy "Users can create their own canvases"
  on public.canvases for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own canvases"
  on public.canvases for update
  using (auth.uid() = user_id);

create policy "Users can delete their own canvases"
  on public.canvases for delete
  using (auth.uid() = user_id);

-- Nodes policies (through canvas ownership)
create policy "Users can view nodes in their canvases"
  on public.nodes for select
  using (
    exists (
      select 1 from public.canvases
      where canvases.id = nodes.canvas_id
      and canvases.user_id = auth.uid()
    )
  );

create policy "Users can create nodes in their canvases"
  on public.nodes for insert
  with check (
    exists (
      select 1 from public.canvases
      where canvases.id = canvas_id
      and canvases.user_id = auth.uid()
    )
  );

create policy "Users can update nodes in their canvases"
  on public.nodes for update
  using (
    exists (
      select 1 from public.canvases
      where canvases.id = nodes.canvas_id
      and canvases.user_id = auth.uid()
    )
  );

create policy "Users can delete nodes in their canvases"
  on public.nodes for delete
  using (
    exists (
      select 1 from public.canvases
      where canvases.id = nodes.canvas_id
      and canvases.user_id = auth.uid()
    )
  );

-- Messages policies (through node → canvas ownership)
create policy "Users can view messages in their nodes"
  on public.messages for select
  using (
    exists (
      select 1 from public.nodes
      join public.canvases on canvases.id = nodes.canvas_id
      where nodes.id = messages.node_id
      and canvases.user_id = auth.uid()
    )
  );

create policy "Users can create messages in their nodes"
  on public.messages for insert
  with check (
    exists (
      select 1 from public.nodes
      join public.canvases on canvases.id = nodes.canvas_id
      where nodes.id = node_id
      and canvases.user_id = auth.uid()
    )
  );

create policy "Users can update messages in their nodes"
  on public.messages for update
  using (
    exists (
      select 1 from public.nodes
      join public.canvases on canvases.id = nodes.canvas_id
      where nodes.id = messages.node_id
      and canvases.user_id = auth.uid()
    )
  );

create policy "Users can delete messages in their nodes"
  on public.messages for delete
  using (
    exists (
      select 1 from public.nodes
      join public.canvases on canvases.id = nodes.canvas_id
      where nodes.id = messages.node_id
      and canvases.user_id = auth.uid()
    )
  );

-- Edges policies (through canvas ownership)
create policy "Users can view edges in their canvases"
  on public.edges for select
  using (
    exists (
      select 1 from public.canvases
      where canvases.id = edges.canvas_id
      and canvases.user_id = auth.uid()
    )
  );

create policy "Users can create edges in their canvases"
  on public.edges for insert
  with check (
    exists (
      select 1 from public.canvases
      where canvases.id = canvas_id
      and canvases.user_id = auth.uid()
    )
  );

create policy "Users can delete edges in their canvases"
  on public.edges for delete
  using (
    exists (
      select 1 from public.canvases
      where canvases.id = edges.canvas_id
      and canvases.user_id = auth.uid()
    )
  );

-- Function to auto-create first canvas on user signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.canvases (user_id, name)
  values (new.id, 'my first canvas');
  return new;
end;
$$ language plpgsql security definer;

-- Trigger to call the function on new user
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Function to update updated_at timestamp
create or replace function public.update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$ language plpgsql;

-- Triggers for updated_at
create trigger update_canvases_updated_at
  before update on public.canvases
  for each row execute procedure public.update_updated_at_column();

create trigger update_nodes_updated_at
  before update on public.nodes
  for each row execute procedure public.update_updated_at_column();

