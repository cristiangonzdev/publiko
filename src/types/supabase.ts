export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type UserRole = 'admin' | 'editor' | 'grabador' | 'cliente'
export type ClientStatus = 'lead' | 'proposal_sent' | 'negotiation' | 'active' | 'paused' | 'churned'
export type ContentStatus = 'idea' | 'approved_idea' | 'brief_sent' | 'recording' | 'brutos_ready' | 'editing' | 'delivered' | 'revision' | 'approved' | 'scheduled' | 'published' | 'failed'
export type ContentType = 'reel' | 'post' | 'story' | 'carrusel' | 'gmb_post'
export type ContentOrigin = 'system' | 'human'
export type IdeaAngle = 'emocional' | 'informativo' | 'humor' | 'social_proof' | 'educativo' | 'aspiracional' | 'detras_escenas' | 'anuncio' | 'opinion' | 'historia'
export type Platform = 'instagram' | 'facebook' | 'tiktok' | 'gmb' | 'youtube_shorts'

type R = never[]

/** Línea de factura almacenada en invoices.lines (jsonb). Importes en euros. */
export interface InvoiceLine {
  description: string
  quantity: number
  unit_price: number
  tax_rate: number
  subtotal: number
}

export interface PostToPublish {
  post_id: string
  client_id: string
  platform: Platform
  content_type: string
  copy: string
  hashtags: string[]
  asset_id: string
  external_post_id: string | null
  meta_system_user_token: string
  meta_business_id: string
  facebook_page_id: string | null
  attempts_made: number
}

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: { id: string; role: UserRole; full_name: string; email: string; phone: string | null; telegram_chat_id: string | null; avatar_url: string | null; is_active: boolean; created_at: string; updated_at: string }
        Insert: { id: string; role?: UserRole; full_name: string; email: string; phone?: string | null; telegram_chat_id?: string | null; avatar_url?: string | null; is_active?: boolean; created_at?: string; updated_at?: string }
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>
        Relationships: R
      }
      clients: {
        Row: { id: string; business_name: string; slug: string; status: ClientStatus; contact_name: string; contact_email: string | null; contact_phone: string | null; contact_whatsapp: string | null; fiscal_name: string | null; nif: string | null; fiscal_address: string | null; fiscal_city: string | null; fiscal_postal_code: string | null; fiscal_country: string; billing_email: string | null; monthly_fee: number; setup_fee: number; contract_start: string | null; contract_end: string | null; billing_day: number | null; payment_method: string | null; meta_business_id: string | null; meta_system_user_token: string | null; facebook_page_id: string | null; drive_folder_id: string | null; gmb_account_id: string | null; gmb_location_id: string | null; geo_tracking_enabled: boolean | null; geo_location: string | null; client_user_id: string | null; assigned_editor_id: string | null; assigned_grabador_id: string | null; pipeline_stage: string | null; pipeline_notes: string | null; lost_reason: string | null; current_followers: Json; daily_generation_config: Json; is_active: boolean; created_at: string; updated_at: string; deleted_at: string | null }
        Insert: { id?: string; business_name: string; slug: string; status?: ClientStatus; contact_name: string; contact_email?: string | null; contact_phone?: string | null; contact_whatsapp?: string | null; fiscal_name?: string | null; nif?: string | null; fiscal_address?: string | null; fiscal_city?: string | null; fiscal_postal_code?: string | null; fiscal_country?: string; billing_email?: string | null; monthly_fee?: number; setup_fee?: number; contract_start?: string | null; contract_end?: string | null; billing_day?: number | null; payment_method?: string | null; meta_business_id?: string | null; meta_system_user_token?: string | null; facebook_page_id?: string | null; drive_folder_id?: string | null; gmb_account_id?: string | null; gmb_location_id?: string | null; geo_tracking_enabled?: boolean | null; geo_location?: string | null; client_user_id?: string | null; assigned_editor_id?: string | null; assigned_grabador_id?: string | null; pipeline_stage?: string | null; pipeline_notes?: string | null; lost_reason?: string | null; current_followers?: Json; daily_generation_config?: Json; is_active?: boolean; created_at?: string; updated_at?: string; deleted_at?: string | null }
        Update: Partial<Database['public']['Tables']['clients']['Insert']>
        Relationships: R
      }
      brand_brains: {
        Row: { id: string; client_id: string; identity: Json; audience: Json; voice: Json; products: Json; content_pillars: Json; platforms: Json; competitive: Json; visual_identity: Json; operations: Json; performance_learning: Json; onboarding_completed: boolean; onboarding_step: number; onboarding_completed_at: string | null; version: number; created_at: string; updated_at: string }
        Insert: { id?: string; client_id: string; identity?: Json; audience?: Json; voice?: Json; products?: Json; content_pillars?: Json; platforms?: Json; competitive?: Json; visual_identity?: Json; operations?: Json; performance_learning?: Json; onboarding_completed?: boolean; onboarding_step?: number; onboarding_completed_at?: string | null; version?: number; created_at?: string; updated_at?: string }
        Update: Partial<Database['public']['Tables']['brand_brains']['Insert']>
        Relationships: R
      }
      assets: {
        Row: { id: string; client_id: string; file_name: string; file_type: string; file_size: number | null; storage_type: string; storage_path: string; public_url: string | null; drive_file_id: string | null; asset_category: string | null; tags: string[]; description: string | null; uploaded_by: string | null; created_at: string; updated_at: string; deleted_at: string | null }
        Insert: { id?: string; client_id: string; file_name: string; file_type: string; file_size?: number | null; storage_type: string; storage_path: string; public_url?: string | null; drive_file_id?: string | null; asset_category?: string | null; tags?: string[]; description?: string | null; uploaded_by?: string | null; created_at?: string; updated_at?: string; deleted_at?: string | null }
        Update: Partial<Database['public']['Tables']['assets']['Insert']>
        Relationships: R
      }
      content_ideas: {
        Row: { id: string; client_id: string; concept: string; full_description: string | null; content_type: ContentType; content_origin: ContentOrigin; angle: IdeaAngle | null; content_pillar: string | null; human_input: string | null; status: string; approved_at: string | null; approved_by: string | null; discarded_reason: string | null; concept_hash: string | null; can_recycle_after: string | null; content_task_id: string | null; published_reach: number | null; published_engagement_rate: number | null; approval_tier: string; scheduled_for_date: string | null; suggested_publish_time: string | null; created_at: string; updated_at: string }
        Insert: { id?: string; client_id: string; concept: string; full_description?: string | null; content_type: ContentType; content_origin?: ContentOrigin; angle?: IdeaAngle | null; content_pillar?: string | null; human_input?: string | null; status?: string; approved_at?: string | null; approved_by?: string | null; discarded_reason?: string | null; concept_hash?: string | null; can_recycle_after?: string | null; content_task_id?: string | null; published_reach?: number | null; published_engagement_rate?: number | null; approval_tier?: string; scheduled_for_date?: string | null; suggested_publish_time?: string | null; created_at?: string; updated_at?: string }
        Update: Partial<Database['public']['Tables']['content_ideas']['Insert']>
        Relationships: R
      }
      content_tasks: {
        Row: { id: string; client_id: string; idea_id: string | null; title: string; content_type: ContentType; copy_options: Json; copy_selected: string | null; hashtags: string[] | null; cta: string | null; recording_brief: Json; editing_brief: Json; target_platforms: Platform[]; publish_at: string | null; status: ContentStatus; grabador_id: string | null; editor_id: string | null; brief_sent_at: string | null; recording_started_at: string | null; brutos_uploaded_at: string | null; editing_started_at: string | null; delivered_at: string | null; approved_at: string | null; published_at: string | null; bruto_asset_ids: string[]; final_asset_id: string | null; admin_notes: string | null; revision_notes: string | null; revision_count: number; deadline: string | null; approval_tier: string; copies_per_platform: Json; judge_verdict: Json | null; judge_run_at: string | null; auto_publish_blocked_reason: string | null; created_at: string; updated_at: string }
        Insert: { id?: string; client_id: string; idea_id?: string | null; title: string; content_type: ContentType; copy_options?: Json; copy_selected?: string | null; hashtags?: string[] | null; cta?: string | null; recording_brief?: Json; editing_brief?: Json; target_platforms?: Platform[]; publish_at?: string | null; status?: ContentStatus; grabador_id?: string | null; editor_id?: string | null; brief_sent_at?: string | null; recording_started_at?: string | null; brutos_uploaded_at?: string | null; editing_started_at?: string | null; delivered_at?: string | null; approved_at?: string | null; published_at?: string | null; bruto_asset_ids?: string[]; final_asset_id?: string | null; admin_notes?: string | null; revision_notes?: string | null; revision_count?: number; deadline?: string | null; approval_tier?: string; copies_per_platform?: Json; judge_verdict?: Json | null; judge_run_at?: string | null; auto_publish_blocked_reason?: string | null; created_at?: string; updated_at?: string }
        Update: Partial<Database['public']['Tables']['content_tasks']['Insert']>
        Relationships: R
      }
      posts: {
        Row: { id: string; client_id: string; task_id: string; platform: Platform; external_post_id: string | null; external_url: string | null; copy: string; hashtags: string[] | null; asset_id: string | null; status: string; scheduled_at: string | null; published_at: string | null; failed_at: string | null; failure_reason: string | null; retry_count: number; scheduled_retry_at: string | null; last_attempt_at: string | null; is_winner: boolean; winner_source: string | null; winner_score: number | null; winner_marked_at: string | null; baseline_engagement_at_publish: number | null; reach: number | null; impressions: number | null; likes: number | null; comments: number | null; shares: number | null; saves: number | null; profile_visits: number | null; link_clicks: number | null; engagement_rate: number | null; metrics_updated_at: string | null; created_at: string; updated_at: string }
        Insert: { id?: string; client_id: string; task_id: string; platform: Platform; external_post_id?: string | null; external_url?: string | null; copy: string; hashtags?: string[] | null; asset_id?: string | null; status?: string; scheduled_at?: string | null; published_at?: string | null; failed_at?: string | null; failure_reason?: string | null; retry_count?: number; scheduled_retry_at?: string | null; last_attempt_at?: string | null; is_winner?: boolean; winner_source?: string | null; winner_score?: number | null; winner_marked_at?: string | null; baseline_engagement_at_publish?: number | null; reach?: number | null; impressions?: number | null; likes?: number | null; comments?: number | null; shares?: number | null; saves?: number | null; profile_visits?: number | null; link_clicks?: number | null; engagement_rate?: number | null; metrics_updated_at?: string | null; created_at?: string; updated_at?: string }
        Update: Partial<Database['public']['Tables']['posts']['Insert']>
        Relationships: R
      }
      reviews: {
        Row: { id: string; client_id: string; source: string; external_id: string | null; external_review_id: string | null; author_name: string | null; rating: number | null; text: string | null; review_date: string | null; response_options: Json; response_selected: string | null; response_published_at: string | null; responded_by: string | null; status: string; sentiment: string | null; ai_draft: string | null; ai_draft_at: string | null; created_at: string; updated_at: string }
        Insert: { id?: string; client_id: string; source: string; external_id?: string | null; external_review_id?: string | null; author_name?: string | null; rating?: number | null; text?: string | null; review_date?: string | null; response_options?: Json; response_selected?: string | null; response_published_at?: string | null; responded_by?: string | null; status?: string; sentiment?: string | null; ai_draft?: string | null; ai_draft_at?: string | null; created_at?: string; updated_at?: string }
        Update: Partial<Database['public']['Tables']['reviews']['Insert']>
        Relationships: R
      }
      weekly_reports: {
        Row: { id: string; client_id: string; week_start: string; week_end: string; posts_published: number; total_reach: number; total_impressions: number; total_likes: number; total_saves: number; total_comments: number; net_followers_gained: number; avg_engagement_rate: number | null; top_post_id: string | null; ai_summary: string | null; ai_recommendations: string | null; engagement_change_pct: number | null; churn_risk_level: 'low' | 'medium' | 'high' | null; churn_risk_factors: Json; executive_narrative: string | null; pdf_url: string | null; pdf_generated_at: string | null; sent_to_client: boolean; sent_at: string | null; created_at: string }
        Insert: { id?: string; client_id: string; week_start: string; week_end: string; posts_published?: number; total_reach?: number; total_impressions?: number; total_likes?: number; total_saves?: number; total_comments?: number; net_followers_gained?: number; avg_engagement_rate?: number | null; top_post_id?: string | null; ai_summary?: string | null; ai_recommendations?: string | null; engagement_change_pct?: number | null; churn_risk_level?: 'low' | 'medium' | 'high' | null; churn_risk_factors?: Json; executive_narrative?: string | null; pdf_url?: string | null; pdf_generated_at?: string | null; sent_to_client?: boolean; sent_at?: string | null; created_at?: string }
        Update: Partial<Database['public']['Tables']['weekly_reports']['Insert']>
        Relationships: R
      }
      crm_activities: {
        Row: { id: string; client_id: string; activity_type: string; title: string; description: string | null; outcome: string | null; next_action: string | null; next_action_date: string | null; created_by: string | null; created_at: string }
        Insert: { id?: string; client_id: string; activity_type: string; title: string; description?: string | null; outcome?: string | null; next_action?: string | null; next_action_date?: string | null; created_by?: string | null; created_at?: string }
        Update: Partial<Database['public']['Tables']['crm_activities']['Insert']>
        Relationships: R
      }
      invoices: {
        Row: { id: string; client_id: string; invoice_number: string; amount: number; invoice_type: string; description: string | null; period_start: string | null; period_end: string | null; status: string; due_date: string | null; paid_at: string | null; payment_method: string | null; pdf_url: string | null; lines: Json; subtotal: number | null; tax_amount: number | null; irpf_amount: number | null; notes: string | null; sent_at: string | null; created_by: string | null; created_at: string; updated_at: string }
        Insert: { id?: string; client_id: string; invoice_number: string; amount: number; invoice_type: string; description?: string | null; period_start?: string | null; period_end?: string | null; status?: string; due_date?: string | null; paid_at?: string | null; payment_method?: string | null; pdf_url?: string | null; lines?: Json; subtotal?: number | null; tax_amount?: number | null; irpf_amount?: number | null; notes?: string | null; sent_at?: string | null; created_by?: string | null; created_at?: string; updated_at?: string }
        Update: Partial<Database['public']['Tables']['invoices']['Insert']>
        Relationships: R
      }
      notifications: {
        Row: { id: string; user_id: string | null; channel: string | null; type: string | null; title: string; body: string | null; task_id: string | null; client_name: string | null; data: Json; sent: boolean; sent_at: string | null; read_at: string | null; created_at: string }
        Insert: { id?: string; user_id?: string | null; channel?: string | null; type?: string | null; title: string; body?: string | null; task_id?: string | null; client_name?: string | null; data?: Json; sent?: boolean; sent_at?: string | null; read_at?: string | null; created_at?: string }
        Update: Partial<Database['public']['Tables']['notifications']['Insert']>
        Relationships: R
      }
      client_performance_baselines: {
        Row: { client_id: string; platform: Platform; content_type: ContentType; median_engagement_rate: number | null; p75_engagement_rate: number | null; p90_engagement_rate: number | null; median_reach: number | null; sample_size: number; computed_at: string }
        Insert: { client_id: string; platform: Platform; content_type: ContentType; median_engagement_rate?: number | null; p75_engagement_rate?: number | null; p90_engagement_rate?: number | null; median_reach?: number | null; sample_size?: number; computed_at?: string }
        Update: Partial<Database['public']['Tables']['client_performance_baselines']['Insert']>
        Relationships: R
      }
      winning_patterns: {
        Row: { id: string; client_id: string; post_id: string | null; source: string; features: Json; manual_reason: string | null; metrics_snapshot: Json; impact_multiplier: number | null; active: boolean; archived_reason: string | null; marked_by: string | null; created_at: string; updated_at: string }
        Insert: { id?: string; client_id: string; post_id?: string | null; source: string; features?: Json; manual_reason?: string | null; metrics_snapshot?: Json; impact_multiplier?: number | null; active?: boolean; archived_reason?: string | null; marked_by?: string | null; created_at?: string; updated_at?: string }
        Update: Partial<Database['public']['Tables']['winning_patterns']['Insert']>
        Relationships: R
      }
      ai_visibility_snapshots: {
        Row: { id: string; client_id: string; query: string; ai_response_excerpt: string | null; brand_mentioned: boolean; brand_position: number | null; brand_sentiment: 'positive' | 'neutral' | 'negative' | null; snapshot_date: string; created_at: string }
        Insert: { id?: string; client_id: string; query: string; ai_response_excerpt?: string | null; brand_mentioned?: boolean; brand_position?: number | null; brand_sentiment?: 'positive' | 'neutral' | 'negative' | null; snapshot_date?: string; created_at?: string }
        Update: Partial<Database['public']['Tables']['ai_visibility_snapshots']['Insert']>
        Relationships: R
      }
      agency_settings: {
        Row: { id: string; agency_name: string; nif: string; address: string | null; city: string | null; postal_code: string | null; country: string; email: string | null; phone: string | null; logo_url: string | null; iban: string | null; payment_terms_days: number; invoice_prefix: string; next_invoice_number: number; igic_rate: number; irpf_rate: number; created_at: string; updated_at: string }
        Insert: { id?: string; agency_name: string; nif: string; address?: string | null; city?: string | null; postal_code?: string | null; country?: string; email?: string | null; phone?: string | null; logo_url?: string | null; iban?: string | null; payment_terms_days?: number; invoice_prefix?: string; next_invoice_number?: number; igic_rate?: number; irpf_rate?: number; created_at?: string; updated_at?: string }
        Update: Partial<Database['public']['Tables']['agency_settings']['Insert']>
        Relationships: R
      }
      brand_brain_revisions: {
        Row: { id: string; client_id: string; section: string; proposed_changes: Json; reasoning: string; status: 'pending' | 'approved' | 'rejected'; reviewed_by: string | null; reviewed_at: string | null; created_at: string; updated_at: string }
        Insert: { id?: string; client_id: string; section: string; proposed_changes: Json; reasoning: string; status?: 'pending' | 'approved' | 'rejected'; reviewed_by?: string | null; reviewed_at?: string | null; created_at?: string; updated_at?: string }
        Update: Partial<Database['public']['Tables']['brand_brain_revisions']['Insert']>
        Relationships: R
      }
    }
    Views: Record<string, never>
    Functions: {
      get_mrr_total: { Args: Record<string, never>; Returns: number }
      get_upcoming_renewals: { Args: { days_ahead?: number }; Returns: Array<{ client_id: string; business_name: string; monthly_fee: number; renewal_date: string }> }
      get_posts_to_publish: { Args: Record<string, never>; Returns: Array<PostToPublish> }
      claim_posts_to_publish: { Args: { batch_size?: number }; Returns: Array<PostToPublish> }
      compute_client_baseline: { Args: { p_client_id: string }; Returns: undefined }
      append_bruto_asset: { Args: { p_task_id: string; p_asset_id: string }; Returns: undefined }
      get_winning_patterns_for_prompt: { Args: { p_client_id: string; p_limit?: number }; Returns: Json }
      current_user_role: { Args: Record<string, never>; Returns: UserRole }
      next_invoice_number: { Args: Record<string, never>; Returns: string }
    }
    Enums: {
      user_role: UserRole; client_status: ClientStatus; content_status: ContentStatus; content_type: ContentType; content_origin: ContentOrigin; idea_angle: IdeaAngle; platform: Platform
    }
    CompositeTypes: Record<string, never>
  }
}
