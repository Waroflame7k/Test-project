create extension if not exists "pgcrypto";

create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  brand_name text not null,
  phone text,
  address text,
  created_at timestamptz not null default now()
);

create type app_role as enum ('admin', 'manager', 'legal_staff', 'accountant', 'viewer');
create type payment_type as enum ('Thu', 'Chi', 'Chi hộ');

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  organization_id uuid not null references organizations(id),
  full_name text not null,
  email text not null unique,
  phone text,
  role app_role not null default 'viewer',
  active boolean not null default true,
  avatar_url text,
  created_at timestamptz not null default now()
);

create table customers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  customer_code text not null,
  full_name text not null,
  phone text not null,
  zalo text,
  email text,
  address text,
  referral_source text,
  notes text,
  created_at timestamptz not null default now(),
  created_by uuid references profiles(id),
  unique (organization_id, customer_code)
);

create table properties (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  property_code text not null,
  province text not null,
  ward text not null,
  address text not null,
  map_sheet_number text,
  parcel_number text,
  area numeric(12,2),
  land_type text,
  certificate_number text,
  certificate_owner text,
  map_url text,
  notes text,
  created_at timestamptz not null default now(),
  unique (organization_id, property_code)
);

create table cases (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  case_code text not null,
  customer_id uuid not null references customers(id),
  title text not null,
  service_type text not null,
  status text not null,
  priority text not null,
  assigned_to uuid references profiles(id),
  received_date date not null,
  internal_due_date date not null,
  promised_date date not null,
  service_fee bigint not null default 0 check (service_fee >= 0),
  estimated_cost bigint not null default 0 check (estimated_cost >= 0),
  description text,
  hold_reason text,
  completed_at timestamptz,
  archived_at timestamptz,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, case_code)
);

create table case_properties (
  case_id uuid not null references cases(id) on delete cascade,
  property_id uuid not null references properties(id) on delete cascade,
  primary key (case_id, property_id)
);

create table submissions (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references cases(id) on delete cascade,
  submission_code text not null,
  procedure_type text not null,
  receiving_agency text not null,
  submitted_date date not null,
  expected_return_date date not null,
  actual_return_date date,
  submitted_by uuid references profiles(id),
  applicant_name text,
  submission_result text,
  officer_note text,
  lookup_url text,
  qr_content text,
  receipt_image_url text,
  status text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table documents (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references cases(id) on delete cascade,
  submission_id uuid references submissions(id) on delete set null,
  document_name text not null,
  document_type text not null,
  original_or_copy text not null,
  quantity integer not null default 1,
  file_url text,
  confidential boolean not null default false,
  current_holder_id uuid references profiles(id),
  storage_location text,
  received_date date,
  returned_date date,
  notes text,
  created_at timestamptz not null default now()
);

create table custody_transfers (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references documents(id) on delete cascade,
  from_user_id uuid references profiles(id),
  to_user_id uuid not null references profiles(id),
  transfer_type text not null,
  transferred_at timestamptz not null,
  note text,
  confirmation_image_url text,
  created_by uuid references profiles(id)
);

create table tasks (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references cases(id) on delete cascade,
  title text not null,
  description text,
  assigned_to uuid references profiles(id),
  due_date date not null,
  due_time time,
  status text not null,
  priority text not null,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table payments (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references cases(id) on delete cascade,
  payment_type payment_type not null,
  category text not null,
  amount bigint not null check (amount >= 0),
  payment_date date not null,
  payment_method text not null,
  payer text,
  receiver text,
  receipt_url text,
  note text,
  created_by uuid references profiles(id)
);

create table activity_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  case_id uuid references cases(id) on delete set null,
  actor_id uuid references profiles(id),
  action text not null,
  entity_type text not null,
  entity_id uuid,
  previous_value jsonb,
  new_value jsonb,
  created_at timestamptz not null default now()
);

create table notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  case_id uuid references cases(id) on delete cascade,
  title text not null,
  message text not null,
  notification_type text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_cases_org_status on cases (organization_id, status);
create index idx_cases_assigned_due on cases (assigned_to, promised_date);
create index idx_customers_search on customers (organization_id, full_name, phone);
create index idx_submissions_case on submissions (case_id);
create index idx_documents_case_confidential on documents (case_id, confidential);
create index idx_tasks_assigned_due on tasks (assigned_to, due_date);
create index idx_payments_case_type on payments (case_id, payment_type);
create index idx_activity_logs_case_time on activity_logs (case_id, created_at desc);

alter table organizations enable row level security;
alter table profiles enable row level security;
alter table customers enable row level security;
alter table properties enable row level security;
alter table cases enable row level security;
alter table case_properties enable row level security;
alter table submissions enable row level security;
alter table documents enable row level security;
alter table custody_transfers enable row level security;
alter table tasks enable row level security;
alter table payments enable row level security;
alter table activity_logs enable row level security;
alter table notifications enable row level security;

create or replace function current_profile()
returns profiles
language sql
stable
security definer
set search_path = public
as $$
  select * from profiles where id = auth.uid() and active = true limit 1
$$;

create or replace function same_org(target_org uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(select 1 from profiles where id = auth.uid() and active = true and organization_id = target_org)
$$;

create or replace function current_role()
returns app_role
language sql
stable
security definer
set search_path = public
as $$
  select role from profiles where id = auth.uid() and active = true limit 1
$$;

create policy "profiles read same organization" on profiles
for select using (same_org(organization_id));

create policy "organization read same organization" on organizations
for select using (same_org(id));

create policy "customers read same organization" on customers
for select using (same_org(organization_id));

create policy "properties read same organization" on properties
for select using (same_org(organization_id));

create policy "cases read by role or assignee" on cases
for select using (
  same_org(organization_id)
  and (current_role() in ('admin', 'manager', 'accountant') or assigned_to = auth.uid() or current_role() = 'viewer')
);

create policy "cases write admin manager staff" on cases
for all using (
  same_org(organization_id) and current_role() in ('admin', 'manager', 'legal_staff')
) with check (
  same_org(organization_id) and current_role() in ('admin', 'manager', 'legal_staff')
);

create policy "documents read with confidential guard" on documents
for select using (
  exists (
    select 1 from cases c
    where c.id = documents.case_id
      and same_org(c.organization_id)
      and (documents.confidential = false or current_role() in ('admin', 'manager', 'legal_staff'))
  )
);

create policy "payments read finance roles" on payments
for select using (
  current_role() in ('admin', 'manager', 'accountant')
  and exists (select 1 from cases c where c.id = payments.case_id and same_org(c.organization_id))
);

create policy "payments write accountant admin" on payments
for all using (
  current_role() in ('admin', 'accountant')
  and exists (select 1 from cases c where c.id = payments.case_id and same_org(c.organization_id))
);

create policy "case child records read same org" on submissions
for select using (exists (select 1 from cases c where c.id = submissions.case_id and same_org(c.organization_id)));
create policy "tasks read same org" on tasks
for select using (exists (select 1 from cases c where c.id = tasks.case_id and same_org(c.organization_id)));
create policy "activity logs read manager admin" on activity_logs
for select using (same_org(organization_id) and current_role() in ('admin', 'manager'));
create policy "notifications own read" on notifications
for select using (user_id = auth.uid());
