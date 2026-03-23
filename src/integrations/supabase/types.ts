export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      activity_logs: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          entity_id: string | null
          entity_name: string | null
          entity_type: string
          id: string
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_name?: string | null
          entity_type: string
          id?: string
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_name?: string | null
          entity_type?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      ad_launch_content: {
        Row: {
          ad_launch_id: string
          content_piece_id: string
          id: string
        }
        Insert: {
          ad_launch_id: string
          content_piece_id: string
          id?: string
        }
        Update: {
          ad_launch_id?: string
          content_piece_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ad_launch_content_ad_launch_id_fkey"
            columns: ["ad_launch_id"]
            isOneToOne: false
            referencedRelation: "ad_launches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ad_launch_content_content_piece_id_fkey"
            columns: ["content_piece_id"]
            isOneToOne: false
            referencedRelation: "content_pieces"
            referencedColumns: ["id"]
          },
        ]
      }
      ad_launches: {
        Row: {
          ad_account_link: string | null
          budget: number
          campaign_type: Database["public"]["Enums"]["campaign_type"]
          client_id: string
          created_at: string
          end_date: string | null
          id: string
          name: string
          notes: string | null
          platform: Database["public"]["Enums"]["ad_platform"]
          start_date: string
          status: Database["public"]["Enums"]["ad_status"]
          updated_at: string
        }
        Insert: {
          ad_account_link?: string | null
          budget?: number
          campaign_type: Database["public"]["Enums"]["campaign_type"]
          client_id: string
          created_at?: string
          end_date?: string | null
          id?: string
          name: string
          notes?: string | null
          platform: Database["public"]["Enums"]["ad_platform"]
          start_date: string
          status?: Database["public"]["Enums"]["ad_status"]
          updated_at?: string
        }
        Update: {
          ad_account_link?: string | null
          budget?: number
          campaign_type?: Database["public"]["Enums"]["campaign_type"]
          client_id?: string
          created_at?: string
          end_date?: string | null
          id?: string
          name?: string
          notes?: string | null
          platform?: Database["public"]["Enums"]["ad_platform"]
          start_date?: string
          status?: Database["public"]["Enums"]["ad_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ad_launches_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ad_launches_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients_public_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      ad_suggestions: {
        Row: {
          client_id: string
          created_at: string
          description: string
          format: string
          hook: string
          id: string
          platform: string
          target_emotion: string
        }
        Insert: {
          client_id: string
          created_at?: string
          description: string
          format: string
          hook: string
          id?: string
          platform: string
          target_emotion: string
        }
        Update: {
          client_id?: string
          created_at?: string
          description?: string
          format?: string
          hook?: string
          id?: string
          platform?: string
          target_emotion?: string
        }
        Relationships: [
          {
            foreignKeyName: "ad_suggestions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ad_suggestions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients_public_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      agency_settings: {
        Row: {
          agency_name: string | null
          created_at: string
          default_email_signature: string | null
          id: string
          logo_url: string | null
          primary_color: string | null
          secondary_color: string | null
          timezone: string | null
          updated_at: string
          user_id: string
          working_hours_end: string | null
          working_hours_start: string | null
        }
        Insert: {
          agency_name?: string | null
          created_at?: string
          default_email_signature?: string | null
          id?: string
          logo_url?: string | null
          primary_color?: string | null
          secondary_color?: string | null
          timezone?: string | null
          updated_at?: string
          user_id: string
          working_hours_end?: string | null
          working_hours_start?: string | null
        }
        Update: {
          agency_name?: string | null
          created_at?: string
          default_email_signature?: string | null
          id?: string
          logo_url?: string | null
          primary_color?: string | null
          secondary_color?: string | null
          timezone?: string | null
          updated_at?: string
          user_id?: string
          working_hours_end?: string | null
          working_hours_start?: string | null
        }
        Relationships: []
      }
      ai_prompt_templates: {
        Row: {
          category: string
          created_at: string
          id: string
          industry_filter: string | null
          is_default: boolean | null
          name: string
          prompt_text: string
          updated_at: string
          user_id: string
          variables: string[] | null
        }
        Insert: {
          category: string
          created_at?: string
          id?: string
          industry_filter?: string | null
          is_default?: boolean | null
          name: string
          prompt_text: string
          updated_at?: string
          user_id: string
          variables?: string[] | null
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          industry_filter?: string | null
          is_default?: boolean | null
          name?: string
          prompt_text?: string
          updated_at?: string
          user_id?: string
          variables?: string[] | null
        }
        Relationships: []
      }
      ai_sessions: {
        Row: {
          client_id: string
          created_at: string
          id: string
          session_data: Json | null
          session_type: string
          status: string | null
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          session_data?: Json | null
          session_type: string
          status?: string | null
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          session_data?: Json | null
          session_type?: string
          status?: string | null
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_sessions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_sessions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients_public_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_voice_settings: {
        Row: {
          avoid_phrases: string[] | null
          content_planner_master_prompt: string | null
          content_themes: string[] | null
          created_at: string
          creativity_level: number | null
          custom_instructions: string | null
          formality_level: number | null
          id: string
          preferred_formats: string[] | null
          preferred_hooks_style: string | null
          preferred_phrases: string[] | null
          preferred_platforms: string[] | null
          tone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avoid_phrases?: string[] | null
          content_planner_master_prompt?: string | null
          content_themes?: string[] | null
          created_at?: string
          creativity_level?: number | null
          custom_instructions?: string | null
          formality_level?: number | null
          id?: string
          preferred_formats?: string[] | null
          preferred_hooks_style?: string | null
          preferred_phrases?: string[] | null
          preferred_platforms?: string[] | null
          tone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avoid_phrases?: string[] | null
          content_planner_master_prompt?: string | null
          content_themes?: string[] | null
          created_at?: string
          creativity_level?: number | null
          custom_instructions?: string | null
          formality_level?: number | null
          id?: string
          preferred_formats?: string[] | null
          preferred_hooks_style?: string | null
          preferred_phrases?: string[] | null
          preferred_platforms?: string[] | null
          tone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      analytics_share_links: {
        Row: {
          client_id: string
          created_at: string | null
          created_by: string
          date_range_end: string | null
          date_range_start: string | null
          expires_at: string | null
          id: string
          is_active: boolean | null
          platforms: string[] | null
          share_id: string
        }
        Insert: {
          client_id: string
          created_at?: string | null
          created_by: string
          date_range_end?: string | null
          date_range_start?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          platforms?: string[] | null
          share_id: string
        }
        Update: {
          client_id?: string
          created_at?: string | null
          created_by?: string
          date_range_end?: string | null
          date_range_start?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          platforms?: string[] | null
          share_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "analytics_share_links_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "analytics_share_links_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients_public_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      assets: {
        Row: {
          asset_type: Database["public"]["Enums"]["asset_type"]
          client_id: string
          created_at: string
          id: string
          name: string
          storage_path: string
          tags: string[] | null
          thumbnail_url: string | null
          uploaded_by: string | null
        }
        Insert: {
          asset_type: Database["public"]["Enums"]["asset_type"]
          client_id: string
          created_at?: string
          id?: string
          name: string
          storage_path: string
          tags?: string[] | null
          thumbnail_url?: string | null
          uploaded_by?: string | null
        }
        Update: {
          asset_type?: Database["public"]["Enums"]["asset_type"]
          client_id?: string
          created_at?: string
          id?: string
          name?: string
          storage_path?: string
          tags?: string[] | null
          thumbnail_url?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assets_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assets_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients_public_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_share_links: {
        Row: {
          client_id: string
          created_at: string
          created_by: string
          end_date: string
          id: string
          is_active: boolean
          share_id: string
          start_date: string
        }
        Insert: {
          client_id: string
          created_at?: string
          created_by: string
          end_date: string
          id?: string
          is_active?: boolean
          share_id: string
          start_date: string
        }
        Update: {
          client_id?: string
          created_at?: string
          created_by?: string
          end_date?: string
          id?: string
          is_active?: boolean
          share_id?: string
          start_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_share_links_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_share_links_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients_public_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      client_assignments: {
        Row: {
          client_id: string
          created_at: string
          id: string
          is_primary: boolean | null
          user_id: string
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          is_primary?: boolean | null
          user_id: string
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          is_primary?: boolean | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_assignments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_assignments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients_public_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      client_reference_images: {
        Row: {
          client_id: string
          created_at: string | null
          created_by: string | null
          id: string
          is_active: boolean | null
          name: string
          storage_path: string
          thumbnail_url: string | null
        }
        Insert: {
          client_id: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          storage_path: string
          thumbnail_url?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          storage_path?: string
          thumbnail_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_reference_images_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_reference_images_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients_public_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          brand_accent_color: string | null
          brand_background_color: string | null
          brand_fonts: string[] | null
          brand_logo_url: string | null
          brand_primary_color: string | null
          brand_secondary_color: string | null
          brand_style_notes: string | null
          brand_text_color: string | null
          business_name: string
          contact_name: string
          contract_end: string | null
          contract_start: string | null
          converted_from_lead_id: string | null
          created_at: string
          email: string
          id: string
          industry: string
          is_personal: boolean
          late_api_key: string | null
          late_connected_at: string | null
          late_profile_id: string | null
          mrr: number
          phone: string | null
          status: Database["public"]["Enums"]["client_status"]
          updated_at: string
          user_id: string
          website: string | null
        }
        Insert: {
          brand_accent_color?: string | null
          brand_background_color?: string | null
          brand_fonts?: string[] | null
          brand_logo_url?: string | null
          brand_primary_color?: string | null
          brand_secondary_color?: string | null
          brand_style_notes?: string | null
          brand_text_color?: string | null
          business_name: string
          contact_name: string
          contract_end?: string | null
          contract_start?: string | null
          converted_from_lead_id?: string | null
          created_at?: string
          email: string
          id?: string
          industry: string
          is_personal?: boolean
          late_api_key?: string | null
          late_connected_at?: string | null
          late_profile_id?: string | null
          mrr?: number
          phone?: string | null
          status?: Database["public"]["Enums"]["client_status"]
          updated_at?: string
          user_id: string
          website?: string | null
        }
        Update: {
          brand_accent_color?: string | null
          brand_background_color?: string | null
          brand_fonts?: string[] | null
          brand_logo_url?: string | null
          brand_primary_color?: string | null
          brand_secondary_color?: string | null
          brand_style_notes?: string | null
          brand_text_color?: string | null
          business_name?: string
          contact_name?: string
          contract_end?: string | null
          contract_start?: string | null
          converted_from_lead_id?: string | null
          created_at?: string
          email?: string
          id?: string
          industry?: string
          is_personal?: boolean
          late_api_key?: string | null
          late_connected_at?: string | null
          late_profile_id?: string | null
          mrr?: number
          phone?: string | null
          status?: Database["public"]["Enums"]["client_status"]
          updated_at?: string
          user_id?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_converted_from_lead_id_fkey"
            columns: ["converted_from_lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      content_approvals: {
        Row: {
          approved_at: string | null
          content_piece_id: string
          created_at: string
          id: string
          review_notes: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["approval_status"]
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          content_piece_id: string
          created_at?: string
          id?: string
          review_notes?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["approval_status"]
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          content_piece_id?: string
          created_at?: string
          id?: string
          review_notes?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["approval_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_approvals_content_piece_id_fkey"
            columns: ["content_piece_id"]
            isOneToOne: false
            referencedRelation: "content_pieces"
            referencedColumns: ["id"]
          },
        ]
      }
      content_comments: {
        Row: {
          content: string
          content_piece_id: string
          created_at: string
          id: string
          is_internal: boolean | null
          user_id: string
        }
        Insert: {
          content: string
          content_piece_id: string
          created_at?: string
          id?: string
          is_internal?: boolean | null
          user_id: string
        }
        Update: {
          content?: string
          content_piece_id?: string
          created_at?: string
          id?: string
          is_internal?: boolean | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_comments_content_piece_id_fkey"
            columns: ["content_piece_id"]
            isOneToOne: false
            referencedRelation: "content_pieces"
            referencedColumns: ["id"]
          },
        ]
      }
      content_creative_links: {
        Row: {
          content_piece_id: string
          created_at: string
          creative_concept_id: string
          id: string
        }
        Insert: {
          content_piece_id: string
          created_at?: string
          creative_concept_id: string
          id?: string
        }
        Update: {
          content_piece_id?: string
          created_at?: string
          creative_concept_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_creative_links_content_piece_id_fkey"
            columns: ["content_piece_id"]
            isOneToOne: false
            referencedRelation: "content_pieces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_creative_links_creative_concept_id_fkey"
            columns: ["creative_concept_id"]
            isOneToOne: false
            referencedRelation: "creative_concepts"
            referencedColumns: ["id"]
          },
        ]
      }
      content_pieces: {
        Row: {
          asset_url: string | null
          b_roll_needed: string[] | null
          caption: string | null
          concept: string
          content_plan_id: string
          content_type: Database["public"]["Enums"]["content_type"]
          created_at: string
          cta: string | null
          edit_notes: string | null
          filming_day_id: string | null
          hashtags: string[] | null
          hook: string | null
          id: string
          instagram_collaborators: string[] | null
          instagram_first_comment: string | null
          late_error_message: string | null
          late_last_synced_at: string | null
          late_post_id: string | null
          late_sync_status: string | null
          platform: string
          platforms: string[] | null
          scheduled_date: string | null
          script: string | null
          shot_notes: string | null
          sort_order: number | null
          status: Database["public"]["Enums"]["content_status"]
          talent_notes: string | null
          target_duration: number | null
          updated_at: string
          version: number | null
        }
        Insert: {
          asset_url?: string | null
          b_roll_needed?: string[] | null
          caption?: string | null
          concept: string
          content_plan_id: string
          content_type: Database["public"]["Enums"]["content_type"]
          created_at?: string
          cta?: string | null
          edit_notes?: string | null
          filming_day_id?: string | null
          hashtags?: string[] | null
          hook?: string | null
          id?: string
          instagram_collaborators?: string[] | null
          instagram_first_comment?: string | null
          late_error_message?: string | null
          late_last_synced_at?: string | null
          late_post_id?: string | null
          late_sync_status?: string | null
          platform: string
          platforms?: string[] | null
          scheduled_date?: string | null
          script?: string | null
          shot_notes?: string | null
          sort_order?: number | null
          status?: Database["public"]["Enums"]["content_status"]
          talent_notes?: string | null
          target_duration?: number | null
          updated_at?: string
          version?: number | null
        }
        Update: {
          asset_url?: string | null
          b_roll_needed?: string[] | null
          caption?: string | null
          concept?: string
          content_plan_id?: string
          content_type?: Database["public"]["Enums"]["content_type"]
          created_at?: string
          cta?: string | null
          edit_notes?: string | null
          filming_day_id?: string | null
          hashtags?: string[] | null
          hook?: string | null
          id?: string
          instagram_collaborators?: string[] | null
          instagram_first_comment?: string | null
          late_error_message?: string | null
          late_last_synced_at?: string | null
          late_post_id?: string | null
          late_sync_status?: string | null
          platform?: string
          platforms?: string[] | null
          scheduled_date?: string | null
          script?: string | null
          shot_notes?: string | null
          sort_order?: number | null
          status?: Database["public"]["Enums"]["content_status"]
          talent_notes?: string | null
          target_duration?: number | null
          updated_at?: string
          version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "content_pieces_content_plan_id_fkey"
            columns: ["content_plan_id"]
            isOneToOne: false
            referencedRelation: "content_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_pieces_filming_day_id_fkey"
            columns: ["filming_day_id"]
            isOneToOne: false
            referencedRelation: "filming_days"
            referencedColumns: ["id"]
          },
        ]
      }
      content_planner_guidelines: {
        Row: {
          created_at: string | null
          id: string
          is_default: boolean | null
          name: string
          pdf_filename: string | null
          pdf_url: string | null
          platform: string
          text_guidelines: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_default?: boolean | null
          name: string
          pdf_filename?: string | null
          pdf_url?: string | null
          platform: string
          text_guidelines?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_default?: boolean | null
          name?: string
          pdf_filename?: string | null
          pdf_url?: string | null
          platform?: string
          text_guidelines?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      content_plans: {
        Row: {
          assigned_to: string | null
          brief: string | null
          client_id: string
          created_at: string
          filming_date: string | null
          id: string
          status: Database["public"]["Enums"]["content_plan_status"]
          strategy_notes: string | null
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          brief?: string | null
          client_id: string
          created_at?: string
          filming_date?: string | null
          id?: string
          status?: Database["public"]["Enums"]["content_plan_status"]
          strategy_notes?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          brief?: string | null
          client_id?: string
          created_at?: string
          filming_date?: string | null
          id?: string
          status?: Database["public"]["Enums"]["content_plan_status"]
          strategy_notes?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_plans_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_plans_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients_public_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_share_links: {
        Row: {
          contract_id: string
          created_at: string | null
          created_by: string
          expires_at: string | null
          id: string
          is_active: boolean | null
          share_id: string
        }
        Insert: {
          contract_id: string
          created_at?: string | null
          created_by: string
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          share_id: string
        }
        Update: {
          contract_id?: string
          created_at?: string | null
          created_by?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          share_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contract_share_links_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_signatures: {
        Row: {
          consent_to_electronic: boolean
          contract_id: string
          created_at: string | null
          id: string
          intent_confirmed: boolean
          ip_address: string | null
          signature_data: string | null
          signature_type: string | null
          signed_at: string | null
          signer_email: string
          signer_name: string
          signer_role: string
          signer_title: string | null
          user_agent: string | null
        }
        Insert: {
          consent_to_electronic?: boolean
          contract_id: string
          created_at?: string | null
          id?: string
          intent_confirmed?: boolean
          ip_address?: string | null
          signature_data?: string | null
          signature_type?: string | null
          signed_at?: string | null
          signer_email: string
          signer_name: string
          signer_role: string
          signer_title?: string | null
          user_agent?: string | null
        }
        Update: {
          consent_to_electronic?: boolean
          contract_id?: string
          created_at?: string | null
          id?: string
          intent_confirmed?: boolean
          ip_address?: string | null
          signature_data?: string | null
          signature_type?: string | null
          signed_at?: string | null
          signer_email?: string
          signer_name?: string
          signer_role?: string
          signer_title?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contract_signatures_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_templates: {
        Row: {
          content: string
          created_at: string
          id: string
          is_default: boolean | null
          name: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          is_default?: boolean | null
          name: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          is_default?: boolean | null
          name?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      contracts: {
        Row: {
          billing_interval: string | null
          client_id: string
          content: string
          contract_type: string | null
          created_at: string
          deliverables: string | null
          end_date: string | null
          governing_jurisdiction: string | null
          gst_percentage: number | null
          id: string
          include_gst: boolean | null
          initial_payment_amount: number | null
          paid_at: string | null
          payment_amount: number | null
          payment_currency: string | null
          payment_status: string | null
          payment_terms: string | null
          payment_type: string | null
          scope_of_work: string | null
          signed_pdf_url: string | null
          start_date: string | null
          status: string | null
          stripe_checkout_session_id: string | null
          stripe_customer_id: string | null
          stripe_payment_intent_id: string | null
          stripe_subscription_id: string | null
          title: string
          updated_at: string
          user_id: string
          version: number | null
        }
        Insert: {
          billing_interval?: string | null
          client_id: string
          content: string
          contract_type?: string | null
          created_at?: string
          deliverables?: string | null
          end_date?: string | null
          governing_jurisdiction?: string | null
          gst_percentage?: number | null
          id?: string
          include_gst?: boolean | null
          initial_payment_amount?: number | null
          paid_at?: string | null
          payment_amount?: number | null
          payment_currency?: string | null
          payment_status?: string | null
          payment_terms?: string | null
          payment_type?: string | null
          scope_of_work?: string | null
          signed_pdf_url?: string | null
          start_date?: string | null
          status?: string | null
          stripe_checkout_session_id?: string | null
          stripe_customer_id?: string | null
          stripe_payment_intent_id?: string | null
          stripe_subscription_id?: string | null
          title: string
          updated_at?: string
          user_id: string
          version?: number | null
        }
        Update: {
          billing_interval?: string | null
          client_id?: string
          content?: string
          contract_type?: string | null
          created_at?: string
          deliverables?: string | null
          end_date?: string | null
          governing_jurisdiction?: string | null
          gst_percentage?: number | null
          id?: string
          include_gst?: boolean | null
          initial_payment_amount?: number | null
          paid_at?: string | null
          payment_amount?: number | null
          payment_currency?: string | null
          payment_status?: string | null
          payment_terms?: string | null
          payment_type?: string | null
          scope_of_work?: string | null
          signed_pdf_url?: string | null
          start_date?: string | null
          status?: string | null
          stripe_checkout_session_id?: string | null
          stripe_customer_id?: string | null
          stripe_payment_intent_id?: string | null
          stripe_subscription_id?: string | null
          title?: string
          updated_at?: string
          user_id?: string
          version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "contracts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients_public_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      creative_concepts: {
        Row: {
          ai_generated: boolean | null
          client_id: string
          created_at: string
          cta_options: string[] | null
          description: string
          format: string
          hook: string
          id: string
          performance_notes: string | null
          platform: string
          status: string
          target_audiences: string[] | null
          target_emotion: string
          updated_at: string
        }
        Insert: {
          ai_generated?: boolean | null
          client_id: string
          created_at?: string
          cta_options?: string[] | null
          description: string
          format: string
          hook: string
          id?: string
          performance_notes?: string | null
          platform: string
          status?: string
          target_audiences?: string[] | null
          target_emotion: string
          updated_at?: string
        }
        Update: {
          ai_generated?: boolean | null
          client_id?: string
          created_at?: string
          cta_options?: string[] | null
          description?: string
          format?: string
          hook?: string
          id?: string
          performance_notes?: string | null
          platform?: string
          status?: string
          target_audiences?: string[] | null
          target_emotion?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "creative_concepts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creative_concepts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients_public_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      creative_variations: {
        Row: {
          body_copy: string | null
          created_at: string
          creative_concept_id: string
          cta: string | null
          headline: string
          id: string
          platform_notes: string | null
          status: string
        }
        Insert: {
          body_copy?: string | null
          created_at?: string
          creative_concept_id: string
          cta?: string | null
          headline: string
          id?: string
          platform_notes?: string | null
          status?: string
        }
        Update: {
          body_copy?: string | null
          created_at?: string
          creative_concept_id?: string
          cta?: string | null
          headline?: string
          id?: string
          platform_notes?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "creative_variations_creative_concept_id_fkey"
            columns: ["creative_concept_id"]
            isOneToOne: false
            referencedRelation: "creative_concepts"
            referencedColumns: ["id"]
          },
        ]
      }
      email_templates: {
        Row: {
          body: string
          created_at: string
          id: string
          name: string
          subject: string
          template_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          name: string
          subject: string
          template_type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          name?: string
          subject?: string
          template_type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      filming_days: {
        Row: {
          call_time: string | null
          client_change_notes: string | null
          client_change_requested: boolean | null
          client_change_requested_at: string | null
          client_id: string
          client_requested_date: string | null
          client_requested_time: string | null
          created_at: string
          date: string
          equipment_needed: string[] | null
          id: string
          location: string | null
          notes: string | null
          status: string
          team_members: string[] | null
          updated_at: string
          wrap_time: string | null
        }
        Insert: {
          call_time?: string | null
          client_change_notes?: string | null
          client_change_requested?: boolean | null
          client_change_requested_at?: string | null
          client_id: string
          client_requested_date?: string | null
          client_requested_time?: string | null
          created_at?: string
          date: string
          equipment_needed?: string[] | null
          id?: string
          location?: string | null
          notes?: string | null
          status?: string
          team_members?: string[] | null
          updated_at?: string
          wrap_time?: string | null
        }
        Update: {
          call_time?: string | null
          client_change_notes?: string | null
          client_change_requested?: boolean | null
          client_change_requested_at?: string | null
          client_id?: string
          client_requested_date?: string | null
          client_requested_time?: string | null
          created_at?: string
          date?: string
          equipment_needed?: string[] | null
          id?: string
          location?: string | null
          notes?: string | null
          status?: string
          team_members?: string[] | null
          updated_at?: string
          wrap_time?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "filming_days_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "filming_days_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients_public_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      image_batch_items: {
        Row: {
          asset_id: string | null
          attempts: number | null
          carousel_group_id: string | null
          concept: string
          created_at: string
          feedback: string | null
          generated_image_url: string | null
          id: string
          model_used: string | null
          platform: string | null
          prompt_additions: string | null
          sequence_number: number
          session_id: string
          status: string | null
          template_type: string
          updated_at: string
        }
        Insert: {
          asset_id?: string | null
          attempts?: number | null
          carousel_group_id?: string | null
          concept: string
          created_at?: string
          feedback?: string | null
          generated_image_url?: string | null
          id?: string
          model_used?: string | null
          platform?: string | null
          prompt_additions?: string | null
          sequence_number: number
          session_id: string
          status?: string | null
          template_type: string
          updated_at?: string
        }
        Update: {
          asset_id?: string | null
          attempts?: number | null
          carousel_group_id?: string | null
          concept?: string
          created_at?: string
          feedback?: string | null
          generated_image_url?: string | null
          id?: string
          model_used?: string | null
          platform?: string | null
          prompt_additions?: string | null
          sequence_number?: number
          session_id?: string
          status?: string | null
          template_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "image_batch_items_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "image_batch_items_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "ai_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      image_batch_revisions: {
        Row: {
          batch_item_id: string
          created_at: string | null
          feedback: string | null
          id: string
          image_url: string
          model_used: string | null
          version: number
        }
        Insert: {
          batch_item_id: string
          created_at?: string | null
          feedback?: string | null
          id?: string
          image_url: string
          model_used?: string | null
          version: number
        }
        Update: {
          batch_item_id?: string
          created_at?: string | null
          feedback?: string | null
          id?: string
          image_url?: string
          model_used?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "image_batch_revisions_batch_item_id_fkey"
            columns: ["batch_item_id"]
            isOneToOne: false
            referencedRelation: "image_batch_items"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_entries: {
        Row: {
          category: Database["public"]["Enums"]["knowledge_category"]
          client_id: string
          content: string
          created_at: string
          created_by: string | null
          id: string
          importance: string | null
          last_used_at: string | null
          source: string | null
          title: string
          updated_at: string
        }
        Insert: {
          category: Database["public"]["Enums"]["knowledge_category"]
          client_id: string
          content: string
          created_at?: string
          created_by?: string | null
          id?: string
          importance?: string | null
          last_used_at?: string | null
          source?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          category?: Database["public"]["Enums"]["knowledge_category"]
          client_id?: string
          content?: string
          created_at?: string
          created_by?: string | null
          id?: string
          importance?: string | null
          last_used_at?: string | null
          source?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_entries_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "knowledge_entries_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients_public_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_summary: {
        Row: {
          client_id: string
          compliance_flags: string[] | null
          content_opportunities: string[] | null
          generated_at: string
          id: string
          ideal_customer_profile: string | null
          key_differentiators: string[] | null
          positioning_summary: string | null
        }
        Insert: {
          client_id: string
          compliance_flags?: string[] | null
          content_opportunities?: string[] | null
          generated_at?: string
          id?: string
          ideal_customer_profile?: string | null
          key_differentiators?: string[] | null
          positioning_summary?: string | null
        }
        Update: {
          client_id?: string
          compliance_flags?: string[] | null
          content_opportunities?: string[] | null
          generated_at?: string
          id?: string
          ideal_customer_profile?: string | null
          key_differentiators?: string[] | null
          positioning_summary?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_summary_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: true
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "knowledge_summary_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: true
            referencedRelation: "clients_public_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      kpi_entries: {
        Row: {
          created_at: string
          id: string
          kpi_id: string
          recorded_date: string
          value: number
        }
        Insert: {
          created_at?: string
          id?: string
          kpi_id: string
          recorded_date: string
          value: number
        }
        Update: {
          created_at?: string
          id?: string
          kpi_id?: string
          recorded_date?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "kpi_entries_kpi_id_fkey"
            columns: ["kpi_id"]
            isOneToOne: false
            referencedRelation: "kpis"
            referencedColumns: ["id"]
          },
        ]
      }
      kpis: {
        Row: {
          client_id: string
          created_at: string
          id: string
          name: string
          target: number
          unit: string
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          name: string
          target: number
          unit: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          name?: string
          target?: number
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "kpis_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kpis_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients_public_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      late_account_mappings: {
        Row: {
          account_username: string | null
          client_id: string
          created_at: string | null
          id: string
          late_account_id: string
          platform: string
        }
        Insert: {
          account_username?: string | null
          client_id: string
          created_at?: string | null
          id?: string
          late_account_id: string
          platform: string
        }
        Update: {
          account_username?: string | null
          client_id?: string
          created_at?: string | null
          id?: string
          late_account_id?: string
          platform?: string
        }
        Relationships: [
          {
            foreignKeyName: "late_account_mappings_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "late_account_mappings_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients_public_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          assigned_to: string | null
          business_name: string
          contact_name: string
          created_at: string
          email: string
          id: string
          lost_reason: string | null
          next_follow_up: string | null
          notes: string | null
          phone: string | null
          proposal_value: number
          source: string
          stage: Database["public"]["Enums"]["pipeline_stage"]
          updated_at: string
          user_id: string
        }
        Insert: {
          assigned_to?: string | null
          business_name: string
          contact_name: string
          created_at?: string
          email: string
          id?: string
          lost_reason?: string | null
          next_follow_up?: string | null
          notes?: string | null
          phone?: string | null
          proposal_value?: number
          source: string
          stage?: Database["public"]["Enums"]["pipeline_stage"]
          updated_at?: string
          user_id: string
        }
        Update: {
          assigned_to?: string | null
          business_name?: string
          contact_name?: string
          created_at?: string
          email?: string
          id?: string
          lost_reason?: string | null
          next_follow_up?: string | null
          notes?: string | null
          phone?: string | null
          proposal_value?: number
          source?: string
          stage?: Database["public"]["Enums"]["pipeline_stage"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      plan_feedback: {
        Row: {
          content_plan_id: string
          feedback_text: string | null
          id: string
          idea_index: number
          idea_title: string | null
          share_link_id: string
          status: string
          submitted_at: string
          submitted_by_name: string | null
        }
        Insert: {
          content_plan_id: string
          feedback_text?: string | null
          id?: string
          idea_index: number
          idea_title?: string | null
          share_link_id: string
          status: string
          submitted_at?: string
          submitted_by_name?: string | null
        }
        Update: {
          content_plan_id?: string
          feedback_text?: string | null
          id?: string
          idea_index?: number
          idea_title?: string | null
          share_link_id?: string
          status?: string
          submitted_at?: string
          submitted_by_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "plan_feedback_content_plan_id_fkey"
            columns: ["content_plan_id"]
            isOneToOne: false
            referencedRelation: "content_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_feedback_share_link_id_fkey"
            columns: ["share_link_id"]
            isOneToOne: false
            referencedRelation: "plan_share_links"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_share_links: {
        Row: {
          client_name: string | null
          content_plan_id: string
          created_at: string
          created_by: string
          expires_at: string | null
          feedback_submitted_at: string | null
          id: string
          is_active: boolean
          share_id: string
        }
        Insert: {
          client_name?: string | null
          content_plan_id: string
          created_at?: string
          created_by: string
          expires_at?: string | null
          feedback_submitted_at?: string | null
          id?: string
          is_active?: boolean
          share_id: string
        }
        Update: {
          client_name?: string | null
          content_plan_id?: string
          created_at?: string
          created_by?: string
          expires_at?: string | null
          feedback_submitted_at?: string | null
          id?: string
          is_active?: boolean
          share_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_share_links_content_plan_id_fkey"
            columns: ["content_plan_id"]
            isOneToOne: false
            referencedRelation: "content_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          is_approved: boolean
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          is_approved?: boolean
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          is_approved?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      reminders: {
        Row: {
          created_at: string
          description: string | null
          due_date: string
          id: string
          is_dismissed: boolean | null
          is_read: boolean | null
          related_client_id: string | null
          related_content_plan_id: string | null
          related_lead_id: string | null
          related_task_id: string | null
          reminder_type: Database["public"]["Enums"]["reminder_type"]
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          due_date: string
          id?: string
          is_dismissed?: boolean | null
          is_read?: boolean | null
          related_client_id?: string | null
          related_content_plan_id?: string | null
          related_lead_id?: string | null
          related_task_id?: string | null
          reminder_type: Database["public"]["Enums"]["reminder_type"]
          title: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          due_date?: string
          id?: string
          is_dismissed?: boolean | null
          is_read?: boolean | null
          related_client_id?: string | null
          related_content_plan_id?: string | null
          related_lead_id?: string | null
          related_task_id?: string | null
          reminder_type?: Database["public"]["Enums"]["reminder_type"]
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reminders_related_client_id_fkey"
            columns: ["related_client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reminders_related_client_id_fkey"
            columns: ["related_client_id"]
            isOneToOne: false
            referencedRelation: "clients_public_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reminders_related_content_plan_id_fkey"
            columns: ["related_content_plan_id"]
            isOneToOne: false
            referencedRelation: "content_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reminders_related_lead_id_fkey"
            columns: ["related_lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reminders_related_task_id_fkey"
            columns: ["related_task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      revenue_goals: {
        Row: {
          created_at: string
          end_date: string
          id: string
          notes: string | null
          period: Database["public"]["Enums"]["goal_period"]
          start_date: string
          target_amount: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          end_date: string
          id?: string
          notes?: string | null
          period: Database["public"]["Enums"]["goal_period"]
          start_date: string
          target_amount?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          end_date?: string
          id?: string
          notes?: string | null
          period?: Database["public"]["Enums"]["goal_period"]
          start_date?: string
          target_amount?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      scope_deliverables: {
        Row: {
          created_at: string
          description: string
          frequency: string | null
          id: string
          scope_id: string
        }
        Insert: {
          created_at?: string
          description: string
          frequency?: string | null
          id?: string
          scope_id: string
        }
        Update: {
          created_at?: string
          description?: string
          frequency?: string | null
          id?: string
          scope_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scope_deliverables_scope_id_fkey"
            columns: ["scope_id"]
            isOneToOne: false
            referencedRelation: "scopes"
            referencedColumns: ["id"]
          },
        ]
      }
      scopes: {
        Row: {
          client_id: string
          created_at: string
          description: string | null
          end_date: string | null
          id: string
          retainer: number
          setup_fee: number | null
          start_date: string
          status: Database["public"]["Enums"]["scope_status"]
          title: string
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          description?: string | null
          end_date?: string | null
          id?: string
          retainer?: number
          setup_fee?: number | null
          start_date: string
          status?: Database["public"]["Enums"]["scope_status"]
          title: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          description?: string | null
          end_date?: string | null
          id?: string
          retainer?: number
          setup_fee?: number | null
          start_date?: string
          status?: Database["public"]["Enums"]["scope_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "scopes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scopes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients_public_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      shortform_ideas: {
        Row: {
          ai_generated: boolean | null
          audio_suggestion: string | null
          client_id: string
          created_at: string
          duration: number | null
          filming_day_id: string | null
          format_type: string
          hook: string
          id: string
          platform: string
          shot_list: string[] | null
          status: string | null
          trending_angle: string | null
          updated_at: string
        }
        Insert: {
          ai_generated?: boolean | null
          audio_suggestion?: string | null
          client_id: string
          created_at?: string
          duration?: number | null
          filming_day_id?: string | null
          format_type: string
          hook: string
          id?: string
          platform: string
          shot_list?: string[] | null
          status?: string | null
          trending_angle?: string | null
          updated_at?: string
        }
        Update: {
          ai_generated?: boolean | null
          audio_suggestion?: string | null
          client_id?: string
          created_at?: string
          duration?: number | null
          filming_day_id?: string | null
          format_type?: string
          hook?: string
          id?: string
          platform?: string
          shot_list?: string[] | null
          status?: string | null
          trending_angle?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shortform_ideas_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shortform_ideas_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients_public_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shortform_ideas_filming_day_id_fkey"
            columns: ["filming_day_id"]
            isOneToOne: false
            referencedRelation: "filming_days"
            referencedColumns: ["id"]
          },
        ]
      }
      task_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          task_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          task_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          task_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_comments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assigned_to: string | null
          client_id: string | null
          completed_at: string | null
          content_plan_id: string | null
          created_at: string
          description: string | null
          due_date: string | null
          id: string
          is_recurring: boolean | null
          parent_task_id: string | null
          priority: Database["public"]["Enums"]["task_priority"]
          recurrence_pattern: string | null
          status: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          assigned_to?: string | null
          client_id?: string | null
          completed_at?: string | null
          content_plan_id?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          is_recurring?: boolean | null
          parent_task_id?: string | null
          priority?: Database["public"]["Enums"]["task_priority"]
          recurrence_pattern?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          assigned_to?: string | null
          client_id?: string | null
          completed_at?: string | null
          content_plan_id?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          is_recurring?: boolean | null
          parent_task_id?: string | null
          priority?: Database["public"]["Enums"]["task_priority"]
          recurrence_pattern?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients_public_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_content_plan_id_fkey"
            columns: ["content_plan_id"]
            isOneToOne: false
            referencedRelation: "content_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_parent_task_id_fkey"
            columns: ["parent_task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      text_posts: {
        Row: {
          client_feedback: string | null
          client_feedback_at: string | null
          client_feedback_by: string | null
          client_id: string | null
          content: string
          created_at: string | null
          guideline_id: string | null
          id: string
          late_post_id: string | null
          platform: string
          published_at: string | null
          scheduled_date: string | null
          session_id: string | null
          sort_order: number | null
          status: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          client_feedback?: string | null
          client_feedback_at?: string | null
          client_feedback_by?: string | null
          client_id?: string | null
          content: string
          created_at?: string | null
          guideline_id?: string | null
          id?: string
          late_post_id?: string | null
          platform: string
          published_at?: string | null
          scheduled_date?: string | null
          session_id?: string | null
          sort_order?: number | null
          status?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          client_feedback?: string | null
          client_feedback_at?: string | null
          client_feedback_by?: string | null
          client_id?: string | null
          content?: string
          created_at?: string | null
          guideline_id?: string | null
          id?: string
          late_post_id?: string | null
          platform?: string
          published_at?: string | null
          scheduled_date?: string | null
          session_id?: string | null
          sort_order?: number | null
          status?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "text_posts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "text_posts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients_public_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "text_posts_guideline_id_fkey"
            columns: ["guideline_id"]
            isOneToOne: false
            referencedRelation: "content_planner_guidelines"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["team_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["team_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["team_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      clients_public_safe: {
        Row: {
          brand_accent_color: string | null
          brand_background_color: string | null
          brand_fonts: string[] | null
          brand_logo_url: string | null
          brand_primary_color: string | null
          brand_secondary_color: string | null
          brand_style_notes: string | null
          brand_text_color: string | null
          business_name: string | null
          id: string | null
          industry: string | null
        }
        Insert: {
          brand_accent_color?: string | null
          brand_background_color?: string | null
          brand_fonts?: string[] | null
          brand_logo_url?: string | null
          brand_primary_color?: string | null
          brand_secondary_color?: string | null
          brand_style_notes?: string | null
          brand_text_color?: string | null
          business_name?: string | null
          id?: string | null
          industry?: string | null
        }
        Update: {
          brand_accent_color?: string | null
          brand_background_color?: string | null
          brand_fonts?: string[] | null
          brand_logo_url?: string | null
          brand_primary_color?: string | null
          brand_secondary_color?: string | null
          brand_style_notes?: string | null
          brand_text_color?: string | null
          business_name?: string | null
          id?: string | null
          industry?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      get_user_role: {
        Args: { user_id: string }
        Returns: Database["public"]["Enums"]["team_role"]
      }
      has_active_contract_share_link: {
        Args: { contract_uuid: string }
        Returns: boolean
      }
      has_active_contract_share_link_for_client: {
        Args: { client_uuid: string }
        Returns: boolean
      }
      has_client_access: {
        Args: { client_id: string; user_id: string }
        Returns: boolean
      }
      is_admin_or_owner: { Args: { user_id: string }; Returns: boolean }
    }
    Enums: {
      ad_platform: "meta" | "google" | "tiktok" | "linkedin"
      ad_status: "draft" | "scheduled" | "live" | "paused" | "completed"
      approval_status:
        | "draft"
        | "internal_review"
        | "client_review"
        | "revision_requested"
        | "approved"
        | "published"
      asset_type: "logo" | "guidelines" | "footage" | "creative" | "document"
      campaign_type: "awareness" | "traffic" | "leads" | "sales"
      client_status: "onboarding" | "active" | "paused" | "churned"
      content_plan_status:
        | "planning"
        | "scheduled"
        | "filming"
        | "editing"
        | "complete"
      content_status:
        | "idea"
        | "scripted"
        | "filmed"
        | "edited"
        | "approved"
        | "live"
      content_type: "video" | "image" | "carousel" | "story" | "reel" | "ugc"
      goal_period: "monthly" | "quarterly" | "yearly"
      knowledge_category:
        | "brand"
        | "audience"
        | "competitors"
        | "offers"
        | "past_results"
        | "notes"
        | "compliance"
      pipeline_stage:
        | "new"
        | "contacted"
        | "proposal"
        | "negotiating"
        | "won"
        | "lost"
      reminder_type:
        | "filming"
        | "follow_up"
        | "contract_renewal"
        | "task_due"
        | "stale_lead"
        | "custom"
      scope_status: "draft" | "active" | "completed"
      task_priority: "low" | "medium" | "high" | "urgent"
      task_status: "todo" | "in_progress" | "review" | "complete"
      team_role: "owner" | "admin" | "strategist" | "contractor" | "editor"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      ad_platform: ["meta", "google", "tiktok", "linkedin"],
      ad_status: ["draft", "scheduled", "live", "paused", "completed"],
      approval_status: [
        "draft",
        "internal_review",
        "client_review",
        "revision_requested",
        "approved",
        "published",
      ],
      asset_type: ["logo", "guidelines", "footage", "creative", "document"],
      campaign_type: ["awareness", "traffic", "leads", "sales"],
      client_status: ["onboarding", "active", "paused", "churned"],
      content_plan_status: [
        "planning",
        "scheduled",
        "filming",
        "editing",
        "complete",
      ],
      content_status: [
        "idea",
        "scripted",
        "filmed",
        "edited",
        "approved",
        "live",
      ],
      content_type: ["video", "image", "carousel", "story", "reel", "ugc"],
      goal_period: ["monthly", "quarterly", "yearly"],
      knowledge_category: [
        "brand",
        "audience",
        "competitors",
        "offers",
        "past_results",
        "notes",
        "compliance",
      ],
      pipeline_stage: [
        "new",
        "contacted",
        "proposal",
        "negotiating",
        "won",
        "lost",
      ],
      reminder_type: [
        "filming",
        "follow_up",
        "contract_renewal",
        "task_due",
        "stale_lead",
        "custom",
      ],
      scope_status: ["draft", "active", "completed"],
      task_priority: ["low", "medium", "high", "urgent"],
      task_status: ["todo", "in_progress", "review", "complete"],
      team_role: ["owner", "admin", "strategist", "contractor", "editor"],
    },
  },
} as const
