-- Adds the 'scanning' file_state value in its own migration, ahead of the
-- migration that uses it. Postgres forbids using a value added by
-- `ALTER TYPE ... ADD VALUE` in the same transaction that added it, and
-- each migration file here runs as one transaction - splitting into two
-- ordered files is the standard, safe way around that restriction.
alter type public.file_state add value 'scanning' after 'pending';
