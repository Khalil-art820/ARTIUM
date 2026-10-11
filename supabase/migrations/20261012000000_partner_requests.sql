-- Partnership / advertising requests from the entry gate's "Your brand here"
-- spots. Any signed-in account may send one (as itself); only admins read and
-- work them. Lengths are capped so the table can't be used as a dump.
create table if not exists partner_requests (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  user_id uuid not null references auth.users(id) on delete cascade,
  brand text not null check (char_length(brand) between 1 and 120),
  contact_name text not null check (char_length(contact_name) between 1 and 120),
  email text not null check (char_length(email) between 3 and 200 and email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  phone text check (phone is null or char_length(phone) <= 40),
  website text check (website is null or char_length(website) <= 300),
  category text not null check (category in ('instruments', 'education', 'venue_festival', 'publishing', 'audio_recording', 'travel_lifestyle', 'other')),
  offering text not null check (char_length(offering) between 1 and 300),
  placement text not null check (placement in ('partner_logo', 'sponsored_spotlight', 'both', 'not_sure')),
  budget text check (budget is null or budget in ('under_500', '500_2000', '2000_5000', 'over_5000', 'discuss')),
  message text not null check (char_length(message) between 10 and 2000),
  consent boolean not null check (consent),
  status text not null default 'new' check (status in ('new', 'contacted', 'accepted', 'declined'))
);

create index if not exists partner_requests_created_idx on partner_requests (created_at desc);

alter table partner_requests enable row level security;

drop policy if exists "Members can send partner requests" on partner_requests;
create policy "Members can send partner requests"
  on partner_requests for insert to authenticated
  with check (auth.uid() = user_id and status = 'new');

drop policy if exists "Senders see their own partner requests" on partner_requests;
create policy "Senders see their own partner requests"
  on partner_requests for select to authenticated
  using (auth.uid() = user_id or public.is_admin());

drop policy if exists "Admins work partner requests" on partner_requests;
create policy "Admins work partner requests"
  on partner_requests for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Admins delete partner requests" on partner_requests;
create policy "Admins delete partner requests"
  on partner_requests for delete to authenticated
  using (public.is_admin());

-- Admins only move the status along.
revoke update on partner_requests from authenticated;
grant update (status, updated_at) on partner_requests to authenticated;

-- At most 3 requests per account per 24h.
create or replace function public.limit_partner_requests()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from partner_requests
      where user_id = new.user_id and created_at > now() - interval '24 hours') >= 3 then
    raise exception 'You have already sent several requests today. We will be in touch soon.';
  end if;
  return new;
end $$;
drop trigger if exists trg_limit_partner_requests on partner_requests;
create trigger trg_limit_partner_requests
  before insert on partner_requests
  for each row execute function public.limit_partner_requests();
