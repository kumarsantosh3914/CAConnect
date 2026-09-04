-- CAConnect V1 — the pre-loaded Indian compliance calendar.
--
-- These are global rows (no user_id), readable by every authenticated CA.
-- lib/deadlines/generate.ts turns them into dated `deadlines` rows per client.
--
-- Sources: CLAUDE.md "Indian Compliance Context".
--   ITR            31 July (non-audit) / 31 October (audit cases)
--   GSTR-1         11th of every month
--   GSTR-3B        20th of every month
--   TDS returns    quarterly — 15 Jul, 15 Oct, 15 Jan, 15 May
--   ROC annual     within 60 days of AGM

insert into deadline_templates (code, service_type, label, frequency, rule, applies_when, description, sort_order)
values
  (
    'itr_non_audit', 'itr', 'ITR filing (non-audit)', 'annual',
    '{"month": 7, "day": 31}'::jsonb,
    '{"is_audit_case": false}'::jsonb,
    'Income tax return due 31 July for individuals and non-audit cases.',
    10
  ),
  (
    'itr_audit', 'itr', 'ITR filing (audit case)', 'annual',
    '{"month": 10, "day": 31}'::jsonb,
    '{"is_audit_case": true}'::jsonb,
    'Income tax return due 31 October where accounts are subject to audit.',
    20
  ),
  (
    'gstr1_monthly', 'gstr1', 'GSTR-1', 'monthly',
    '{"day": 11}'::jsonb,
    null,
    'Outward supplies return, due the 11th of the following month.',
    30
  ),
  (
    'gstr3b_monthly', 'gstr3b', 'GSTR-3B', 'monthly',
    '{"day": 20}'::jsonb,
    null,
    'Summary return and tax payment, due the 20th of the following month.',
    40
  ),
  (
    'tds_quarterly', 'tds', 'TDS return', 'quarterly',
    '{"months": [7, 10, 1, 5], "day": 15}'::jsonb,
    null,
    'Quarterly TDS return — 15 Jul, 15 Oct, 15 Jan, 15 May.',
    50
  ),
  (
    'roc_annual_return', 'roc', 'ROC annual return', 'event',
    '{"offset_days": 60, "anchor": "agm_date"}'::jsonb,
    null,
    'Annual return due within 60 days of the AGM. Needs the client AGM date.',
    60
  )
on conflict (code) do update set
  service_type = excluded.service_type,
  label = excluded.label,
  frequency = excluded.frequency,
  rule = excluded.rule,
  applies_when = excluded.applies_when,
  description = excluded.description,
  sort_order = excluded.sort_order;
