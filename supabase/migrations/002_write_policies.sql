-- Migration 002: Add write RLS policies for child and related tables

-- Customers write policy
create policy "customers write same organization" on customers
for all using (same_org(organization_id))
with check (same_org(organization_id));

-- Properties write policy
create policy "properties write same organization" on properties
for all using (same_org(organization_id))
with check (same_org(organization_id));

-- Submissions write policy
create policy "submissions write same organization" on submissions
for all using (
  exists (select 1 from cases c where c.id = submissions.case_id and same_org(c.organization_id))
  and current_role() in ('admin', 'manager', 'legal_staff')
) with check (
  exists (select 1 from cases c where c.id = submissions.case_id and same_org(c.organization_id))
  and current_role() in ('admin', 'manager', 'legal_staff')
);

-- Documents write policy
create policy "documents write same organization" on documents
for all using (
  exists (select 1 from cases c where c.id = documents.case_id and same_org(c.organization_id))
  and current_role() in ('admin', 'manager', 'legal_staff')
) with check (
  exists (select 1 from cases c where c.id = documents.case_id and same_org(c.organization_id))
  and current_role() in ('admin', 'manager', 'legal_staff')
);

-- Custody transfers write policy
create policy "custody transfers write same organization" on custody_transfers
for all using (
  exists (
    select 1 from documents d
    join cases c on c.id = d.case_id
    where d.id = custody_transfers.document_id and same_org(c.organization_id)
  )
  and current_role() in ('admin', 'manager', 'legal_staff')
) with check (
  exists (
    select 1 from documents d
    join cases c on c.id = d.case_id
    where d.id = custody_transfers.document_id and same_org(c.organization_id)
  )
  and current_role() in ('admin', 'manager', 'legal_staff')
);

-- Tasks write policy
create policy "tasks write same organization" on tasks
for all using (
  exists (select 1 from cases c where c.id = tasks.case_id and same_org(c.organization_id))
  and current_role() in ('admin', 'manager', 'legal_staff')
) with check (
  exists (select 1 from cases c where c.id = tasks.case_id and same_org(c.organization_id))
  and current_role() in ('admin', 'manager', 'legal_staff')
);

-- Notifications write policy
create policy "notifications write admin manager staff" on notifications
for insert with check (true);

-- Activity logs write policy
create policy "activity logs write all authenticated" on activity_logs
for insert with check (same_org(organization_id));
