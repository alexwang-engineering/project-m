-- A grant revoked in the same transaction in which it was created has a
-- zero-length validity window. Permit equality so revocation is immediate
-- and the historical row remains intact.
alter table public.role_assignments drop constraint role_assignment_window;
alter table public.role_assignments add constraint role_assignment_window
  check (valid_until is null or valid_until >= valid_from);

alter table public.tag_memberships drop constraint tag_membership_window;
alter table public.tag_memberships add constraint tag_membership_window
  check (valid_until is null or valid_until >= valid_from);
