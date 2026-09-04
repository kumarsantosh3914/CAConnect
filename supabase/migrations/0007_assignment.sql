-- Staff task assignment.
--
-- Two levels, because that is how a small firm actually talks about work:
-- a client belongs to someone ("Priya handles Ramesh Traders"), and an
-- individual filing belongs to someone ("you file their August GSTR-1").
--
-- Deliberately NOT enforced in RLS. The roadmap said "a staff login sees only
-- their queue", and that is implemented as the default VIEW rather than a hard
-- data partition. A one-to-five person CA firm covers for each other
-- constantly — the person who did not file it still answers the phone about
-- it. Partitioning reads would turn every such moment into "why can't I see
-- this client?", and would block a staff member from picking up work nobody
-- has claimed. Assignment here is for organising and filtering, and every
-- member of a firm can still read the firm's data.
--
-- assigned_to references auth.users rather than firm_members so that removing
-- someone from a firm does not cascade-delete their assignment history. The
-- app clears assignments explicitly when a member is removed (removeMember in
-- app/(dashboard)/team/actions.ts), which is the visible, intentional version
-- of the same thing.

begin;

alter table clients add column assigned_to uuid references auth.users on delete set null;
alter table deadlines add column assigned_to uuid references auth.users on delete set null;

create index clients_assigned_idx on clients (assigned_to) where assigned_to is not null;
create index deadlines_assigned_idx on deadlines (assigned_to) where assigned_to is not null;

commit;
