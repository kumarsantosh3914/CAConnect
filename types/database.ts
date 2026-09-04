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
export type NoticeSource = 'paste' | 'pdf'
export type PlanTier = 'starter' | 'solo' | 'pro' | 'team'

export type ProfileRow = {
  id: string
  firm_name: string | null
  full_name: string | null
  phone: string | null
  city: string | null
  plan: PlanTier
  onboarded_at: string | null
  created_at: string
  updated_at: string
}

export type ClientRow = {
  id: string
  user_id: string
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
  user_id: string
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
  user_id: string
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
  user_id: string
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

export type DocumentRequestItemRow = {
  id: string
  user_id: string
  request_id: string
  label: string
  is_required: boolean
  sort_order: number
  fulfilled_document_id: string | null
  created_at: string
}

export type DocumentRow = {
  id: string
  user_id: string
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
  user_id: string
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
  user_id: string
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

export type EmailLogRow = {
  id: string
  user_id: string
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
      clients: {
        Row: ClientRow
        Insert: Insertable<ClientRow, 'user_id' | 'name'>
        Update: Partial<ClientRow>
        Relationships: []
      }
      client_services: {
        Row: ClientServiceRow
        Insert: Insertable<ClientServiceRow, 'user_id' | 'client_id' | 'service_type'>
        Update: Partial<ClientServiceRow>
        Relationships: []
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
          'user_id' | 'client_id' | 'service_type' | 'label' | 'period_label' | 'due_date'
        >
        Update: Partial<DeadlineRow>
        Relationships: []
      }
      document_requests: {
        Row: DocumentRequestRow
        Insert: Insertable<
          DocumentRequestRow,
          'user_id' | 'client_id' | 'token' | 'title' | 'expires_at'
        >
        Update: Partial<DocumentRequestRow>
        Relationships: []
      }
      document_request_items: {
        Row: DocumentRequestItemRow
        Insert: Insertable<DocumentRequestItemRow, 'user_id' | 'request_id' | 'label'>
        Update: Partial<DocumentRequestItemRow>
        Relationships: []
      }
      documents: {
        Row: DocumentRow
        Insert: Insertable<
          DocumentRow,
          'user_id' | 'client_id' | 'storage_path' | 'file_name' | 'mime_type' | 'size_bytes'
        >
        Update: Partial<DocumentRow>
        Relationships: []
      }
      fees: {
        Row: FeeRow
        Insert: Insertable<FeeRow, 'user_id' | 'client_id' | 'description' | 'amount_paise'>
        Update: Partial<FeeRow>
        Relationships: []
      }
      notices: {
        Row: NoticeRow
        Insert: Insertable<NoticeRow, 'user_id' | 'title' | 'notice_text'>
        Update: Partial<NoticeRow>
        Relationships: []
      }
      email_log: {
        Row: EmailLogRow
        Insert: Insertable<EmailLogRow, 'user_id' | 'kind' | 'subject_id' | 'recipient'>
        Update: Partial<EmailLogRow>
        Relationships: []
      }
    }
    Views: Record<never, never>
    Functions: Record<never, never>
    Enums: {
      service_type: ServiceType
      client_type: ClientType
      deadline_status: DeadlineStatus
      fee_status: FeeStatus
      document_request_status: DocumentRequestStatus
      document_uploader: DocumentUploader
      notice_status: NoticeStatus
      notice_source: NoticeSource
      plan_tier: PlanTier
    }
    CompositeTypes: Record<never, never>
  }
}
