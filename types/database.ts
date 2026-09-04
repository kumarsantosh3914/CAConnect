/**
 * Database types for CAConnect.
 *
 * Hand-written to match supabase/migrations/. Once the Supabase project exists,
 * regenerate with:
 *
 *   npx supabase gen types typescript --project-id <ref> --schema public > types/database.ts
 *
 * Keep this file and the migrations in step — the compiler is the only thing
 * stopping a column rename from silently breaking a query.
 */

/** Row minus the columns the database fills in itself. */
type Insertable<Row, Required extends keyof Row> = Partial<Row> & Pick<Row, Required>

/**
 * Foreign keys, so supabase-js can type nested selects like
 * `clients.select('*, client_services(service_type)')`. Without these the
 * client reports "could not find the relation" at the type level.
 */
type Rel<Table extends string, Column extends string> = {
  foreignKeyName: string
  columns: [Column]
  isOneToOne: false
  referencedRelation: Table
  referencedColumns: ['id']
}

type ClientFk = [Rel<'clients', 'client_id'>]
type FirmFk = [Rel<'firms', 'firm_id'>]
type RequestFk = [Rel<'document_requests', 'request_id'>]

export type ServiceType =
  | 'itr'
  | 'gstr1'
  | 'gstr3b'
  | 'tds'
  | 'roc'
  | 'company_registration'
  | 'other'

export type ClientType = 'individual' | 'company' | 'firm' | 'llp' | 'huf' | 'trust'
export type DeadlineStatus = 'pending' | 'in_progress' | 'filed' | 'done'
export type FeeStatus = 'draft' | 'invoiced' | 'paid'
export type DocumentRequestStatus = 'open' | 'completed' | 'expired'
export type DocumentUploader = 'ca' | 'client'
export type NoticeStatus = 'draft' | 'reviewed' | 'sent'
export type ClientEmailTopic = 'deadline_reminder' | 'document_followup' | 'fee_reminder' | 'custom'
export type NoticeSource = 'paste' | 'pdf'
export type PlanTier = 'starter' | 'solo' | 'pro' | 'team'
export type FirmRole = 'owner' | 'staff'

/** Per-person. Firm-level attributes live on FirmRow, not here. */
export type ProfileRow = {
  id: string
  email: string | null
  full_name: string | null
  phone: string | null
  onboarded_at: string | null
  created_at: string
  updated_at: string
}

export type FirmRow = {
  id: string
  name: string | null
  city: string | null
  created_by: string | null
  plan: PlanTier
  created_at: string
  updated_at: string
}

export type FirmMemberRow = {
  id: string
  firm_id: string
  user_id: string
  role: FirmRole
  created_at: string
}

export type FirmInviteRow = {
  id: string
  firm_id: string
  email: string
  role: FirmRole
  token: string
  invited_by: string | null
  expires_at: string
  accepted_at: string | null
  created_at: string
}

export type ClientRow = {
  id: string
  firm_id: string
  created_by: string | null
  assigned_to: string | null
  name: string
  client_type: ClientType
  pan: string | null
  gstin: string | null
  email: string | null
  phone: string | null
  notes: string | null
  agm_date: string | null
  is_audit_case: boolean
  archived_at: string | null
  created_at: string
  updated_at: string
}

export type ClientServiceRow = {
  id: string
  firm_id: string
  created_by: string | null
  client_id: string
  service_type: ServiceType
  is_active: boolean
  created_at: string
}

export type DeadlineTemplateRow = {
  id: string
  code: string
  service_type: ServiceType
  label: string
  frequency: string
  rule: unknown
  applies_when: unknown
  description: string | null
  sort_order: number
}

export type DeadlineRow = {
  id: string
  firm_id: string
  created_by: string | null
  assigned_to: string | null
  client_id: string
  template_id: string | null
  service_type: ServiceType
  label: string
  period_label: string
  due_date: string
  status: DeadlineStatus
  filed_at: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export type DocumentRequestRow = {
  id: string
  firm_id: string
  created_by: string | null
  client_id: string
  token: string
  title: string
  message: string | null
  status: DocumentRequestStatus
  expires_at: string
  completed_at: string | null
  created_at: string
  updated_at: string
}

/** One persistent read-only link per client. See 0009_client_portal.sql. */
export type ClientPortalRow = {
  id: string
  firm_id: string
  created_by: string | null
  client_id: string
  token: string
  is_active: boolean
  last_viewed_at: string | null
  view_count: number
  created_at: string
  updated_at: string
}

export type DocumentRequestItemRow = {
  id: string
  firm_id: string
  created_by: string | null
  request_id: string
  label: string
  is_required: boolean
  sort_order: number
  fulfilled_document_id: string | null
  created_at: string
}

export type DocumentRow = {
  id: string
  firm_id: string
  created_by: string | null
  client_id: string
  request_id: string | null
  item_id: string | null
  storage_path: string
  file_name: string
  mime_type: string
  size_bytes: number
  uploaded_by: DocumentUploader
  created_at: string
}

export type FeeRow = {
  id: string
  firm_id: string
  created_by: string | null
  client_id: string
  service_type: ServiceType | null
  description: string
  amount_paise: number
  status: FeeStatus
  due_date: string | null
  invoiced_at: string | null
  paid_at: string | null
  created_at: string
  updated_at: string
}

export type NoticeRow = {
  id: string
  firm_id: string
  created_by: string | null
  client_id: string | null
  title: string
  notice_type: string | null
  source: NoticeSource
  notice_text: string
  source_file_path: string | null
  draft_response: string | null
  edited_response: string | null
  model: string | null
  tokens_used: number | null
  status: NoticeStatus
  created_at: string
  updated_at: string
}

export type ClientEmailRow = {
  id: string
  firm_id: string
  created_by: string | null
  client_id: string
  topic: ClientEmailTopic
  subject_id: string | null
  notes: string | null
  draft_subject: string | null
  edited_subject: string | null
  draft_body: string | null
  edited_body: string | null
  model: string | null
  status: NoticeStatus
  created_at: string
  updated_at: string
}

export type EmailLogRow = {
  id: string
  firm_id: string
  created_by: string | null
  kind: string
  subject_id: string
  variant: string
  recipient: string
  sent_at: string
}

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: ProfileRow
        Insert: Insertable<ProfileRow, 'id'>
        Update: Partial<ProfileRow>
        Relationships: []
      }
      firms: {
        Row: FirmRow
        Insert: Insertable<FirmRow, never>
        Update: Partial<FirmRow>
        Relationships: []
      }
      firm_members: {
        Row: FirmMemberRow
        Insert: Insertable<FirmMemberRow, 'firm_id' | 'user_id'>
        Update: Partial<FirmMemberRow>
        Relationships: FirmFk
      }
      firm_invites: {
        Row: FirmInviteRow
        Insert: Insertable<FirmInviteRow, 'firm_id' | 'email' | 'token' | 'expires_at'>
        Update: Partial<FirmInviteRow>
        Relationships: FirmFk
      }
      clients: {
        Row: ClientRow
        Insert: Insertable<ClientRow, 'firm_id' | 'name'>
        Update: Partial<ClientRow>
        Relationships: []
      }
      client_services: {
        Row: ClientServiceRow
        Insert: Insertable<ClientServiceRow, 'firm_id' | 'client_id' | 'service_type'>
        Update: Partial<ClientServiceRow>
        Relationships: ClientFk
      }
      deadline_templates: {
        Row: DeadlineTemplateRow
        Insert: Insertable<
          DeadlineTemplateRow,
          'code' | 'service_type' | 'label' | 'frequency' | 'rule'
        >
        Update: Partial<DeadlineTemplateRow>
        Relationships: []
      }
      deadlines: {
        Row: DeadlineRow
        Insert: Insertable<
          DeadlineRow,
          'firm_id' | 'client_id' | 'service_type' | 'label' | 'period_label' | 'due_date'
        >
        Update: Partial<DeadlineRow>
        Relationships: ClientFk
      }
      document_requests: {
        Row: DocumentRequestRow
        Insert: Insertable<
          DocumentRequestRow,
          'firm_id' | 'client_id' | 'token' | 'title' | 'expires_at'
        >
        Update: Partial<DocumentRequestRow>
        Relationships: ClientFk
      }
      client_portals: {
        Row: ClientPortalRow
        Insert: Insertable<ClientPortalRow, 'firm_id' | 'client_id' | 'token'>
        Update: Partial<ClientPortalRow>
        Relationships: ClientFk
      }
      document_request_items: {
        Row: DocumentRequestItemRow
        Insert: Insertable<DocumentRequestItemRow, 'firm_id' | 'request_id' | 'label'>
        Update: Partial<DocumentRequestItemRow>
        Relationships: RequestFk
      }
      documents: {
        Row: DocumentRow
        Insert: Insertable<
          DocumentRow,
          'firm_id' | 'client_id' | 'storage_path' | 'file_name' | 'mime_type' | 'size_bytes'
        >
        Update: Partial<DocumentRow>
        Relationships: [...ClientFk, ...RequestFk]
      }
      fees: {
        Row: FeeRow
        Insert: Insertable<FeeRow, 'firm_id' | 'client_id' | 'description' | 'amount_paise'>
        Update: Partial<FeeRow>
        Relationships: ClientFk
      }
      notices: {
        Row: NoticeRow
        Insert: Insertable<NoticeRow, 'firm_id' | 'title' | 'notice_text'>
        Update: Partial<NoticeRow>
        Relationships: ClientFk
      }
      client_emails: {
        Row: ClientEmailRow
        Insert: Insertable<ClientEmailRow, 'firm_id' | 'client_id' | 'topic'>
        Update: Partial<ClientEmailRow>
        Relationships: ClientFk
      }
      email_log: {
        Row: EmailLogRow
        Insert: Insertable<EmailLogRow, 'firm_id' | 'kind' | 'subject_id' | 'recipient'>
        Update: Partial<EmailLogRow>
        Relationships: []
      }
    }
    Views: Record<never, never>
    Functions: {
      auth_firm_ids: { Args: Record<string, never>; Returns: string[] }
      firm_colleague_ids: { Args: Record<string, never>; Returns: string[] }
      firm_invite_preview: {
        Args: { invite_token: string }
        Returns: { firm_name: string | null; role: FirmRole; email: string }[]
      }
      accept_firm_invite: { Args: { invite_token: string }; Returns: string }
      touch_client_portal: { Args: { portal_id: string }; Returns: undefined }
    }
    Enums: {
      service_type: ServiceType
      client_type: ClientType
      deadline_status: DeadlineStatus
      fee_status: FeeStatus
      document_request_status: DocumentRequestStatus
      document_uploader: DocumentUploader
      notice_status: NoticeStatus
      notice_source: NoticeSource
      client_email_topic: ClientEmailTopic
      plan_tier: PlanTier
      firm_role: FirmRole
    }
    CompositeTypes: Record<never, never>
  }
}
