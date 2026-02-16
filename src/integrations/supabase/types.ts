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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      advertiser_conversions: {
        Row: {
          advertiser_id: string
          conversion: number
          created_at: string
          failed_leads: number
          id: string
          leads: number
          updated_at: string
        }
        Insert: {
          advertiser_id: string
          conversion?: number
          created_at?: string
          failed_leads?: number
          id?: string
          leads?: number
          updated_at?: string
        }
        Update: {
          advertiser_id?: string
          conversion?: number
          created_at?: string
          failed_leads?: number
          id?: string
          leads?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "advertiser_conversions_advertiser_id_fkey"
            columns: ["advertiser_id"]
            isOneToOne: true
            referencedRelation: "advertisers"
            referencedColumns: ["id"]
          },
        ]
      }
      advertiser_distribution_settings: {
        Row: {
          advertiser_id: string
          affiliates: string[] | null
          base_weight: number | null
          countries: string[] | null
          created_at: string
          default_daily_cap: number | null
          default_hourly_cap: number | null
          end_time: string | null
          id: string
          is_active: boolean
          priority: number
          start_time: string | null
          updated_at: string
          weekly_schedule: Json | null
        }
        Insert: {
          advertiser_id: string
          affiliates?: string[] | null
          base_weight?: number | null
          countries?: string[] | null
          created_at?: string
          default_daily_cap?: number | null
          default_hourly_cap?: number | null
          end_time?: string | null
          id?: string
          is_active?: boolean
          priority?: number
          start_time?: string | null
          updated_at?: string
          weekly_schedule?: Json | null
        }
        Update: {
          advertiser_id?: string
          affiliates?: string[] | null
          base_weight?: number | null
          countries?: string[] | null
          created_at?: string
          default_daily_cap?: number | null
          default_hourly_cap?: number | null
          end_time?: string | null
          id?: string
          is_active?: boolean
          priority?: number
          start_time?: string | null
          updated_at?: string
          weekly_schedule?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "advertiser_distribution_settings_advertiser_id_fkey"
            columns: ["advertiser_id"]
            isOneToOne: false
            referencedRelation: "advertisers"
            referencedColumns: ["id"]
          },
        ]
      }
      advertiser_email_rejections: {
        Row: {
          advertiser_id: string
          created_at: string
          email: string
          id: string
          rejection_reason: string | null
        }
        Insert: {
          advertiser_id: string
          created_at?: string
          email: string
          id?: string
          rejection_reason?: string | null
        }
        Update: {
          advertiser_id?: string
          created_at?: string
          email?: string
          id?: string
          rejection_reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "advertiser_email_rejections_advertiser_id_fkey"
            columns: ["advertiser_id"]
            isOneToOne: false
            referencedRelation: "advertisers"
            referencedColumns: ["id"]
          },
        ]
      }
      advertiser_integration_configs: {
        Row: {
          advertiser_id: string
          ai_analysis: Json | null
          auth_header_name: string | null
          auth_type: string
          autologin_url_path: string | null
          content_type: string
          created_at: string
          endpoint_url: string
          error_indicators: Json
          field_mappings: Json
          http_method: string
          id: string
          lead_id_path: string | null
          original_docs: string | null
          request_template: Json | null
          success_indicators: Json
          updated_at: string
        }
        Insert: {
          advertiser_id: string
          ai_analysis?: Json | null
          auth_header_name?: string | null
          auth_type?: string
          autologin_url_path?: string | null
          content_type?: string
          created_at?: string
          endpoint_url: string
          error_indicators?: Json
          field_mappings?: Json
          http_method?: string
          id?: string
          lead_id_path?: string | null
          original_docs?: string | null
          request_template?: Json | null
          success_indicators?: Json
          updated_at?: string
        }
        Update: {
          advertiser_id?: string
          ai_analysis?: Json | null
          auth_header_name?: string | null
          auth_type?: string
          autologin_url_path?: string | null
          content_type?: string
          created_at?: string
          endpoint_url?: string
          error_indicators?: Json
          field_mappings?: Json
          http_method?: string
          id?: string
          lead_id_path?: string | null
          original_docs?: string | null
          request_template?: Json | null
          success_indicators?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "advertiser_integration_configs_advertiser_id_fkey"
            columns: ["advertiser_id"]
            isOneToOne: false
            referencedRelation: "advertisers"
            referencedColumns: ["id"]
          },
        ]
      }
      advertiser_payouts: {
        Row: {
          advertiser_id: string
          country_code: string
          created_at: string
          crg_base_price: number | null
          crg_guarantee_percent: number | null
          currency: string
          deal_type: string
          id: string
          lead_count: number | null
          payout: number
          revenue: number
          updated_at: string
        }
        Insert: {
          advertiser_id: string
          country_code: string
          created_at?: string
          crg_base_price?: number | null
          crg_guarantee_percent?: number | null
          currency?: string
          deal_type?: string
          id?: string
          lead_count?: number | null
          payout?: number
          revenue?: number
          updated_at?: string
        }
        Update: {
          advertiser_id?: string
          country_code?: string
          created_at?: string
          crg_base_price?: number | null
          crg_guarantee_percent?: number | null
          currency?: string
          deal_type?: string
          id?: string
          lead_count?: number | null
          payout?: number
          revenue?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "advertiser_payouts_advertiser_id_fkey"
            columns: ["advertiser_id"]
            isOneToOne: false
            referencedRelation: "advertisers"
            referencedColumns: ["id"]
          },
        ]
      }
      advertisers: {
        Row: {
          advertiser_type: Database["public"]["Enums"]["advertiser_type"]
          api_key: string | null
          config: Json | null
          created_at: string
          daily_cap: number | null
          default_crg_base_price: number | null
          default_crg_guarantee_percent: number | null
          default_deal_type: string
          default_payout: number | null
          default_revenue: number | null
          hourly_cap: number | null
          id: string
          is_active: boolean
          name: string
          status_endpoint: string | null
          updated_at: string
          url: string | null
        }
        Insert: {
          advertiser_type?: Database["public"]["Enums"]["advertiser_type"]
          api_key?: string | null
          config?: Json | null
          created_at?: string
          daily_cap?: number | null
          default_crg_base_price?: number | null
          default_crg_guarantee_percent?: number | null
          default_deal_type?: string
          default_payout?: number | null
          default_revenue?: number | null
          hourly_cap?: number | null
          id?: string
          is_active?: boolean
          name: string
          status_endpoint?: string | null
          updated_at?: string
          url?: string | null
        }
        Update: {
          advertiser_type?: Database["public"]["Enums"]["advertiser_type"]
          api_key?: string | null
          config?: Json | null
          created_at?: string
          daily_cap?: number | null
          default_crg_base_price?: number | null
          default_crg_guarantee_percent?: number | null
          default_deal_type?: string
          default_payout?: number | null
          default_revenue?: number | null
          hourly_cap?: number | null
          id?: string
          is_active?: boolean
          name?: string
          status_endpoint?: string | null
          updated_at?: string
          url?: string | null
        }
        Relationships: []
      }
      affiliate_distribution_rules: {
        Row: {
          advertiser_id: string
          affiliate_id: string
          country_code: string
          created_at: string
          daily_cap: number | null
          end_time: string | null
          hourly_cap: number | null
          id: string
          is_active: boolean
          priority_type: string
          start_time: string | null
          timezone: string | null
          updated_at: string
          weekly_schedule: Json | null
          weight: number
        }
        Insert: {
          advertiser_id: string
          affiliate_id: string
          country_code: string
          created_at?: string
          daily_cap?: number | null
          end_time?: string | null
          hourly_cap?: number | null
          id?: string
          is_active?: boolean
          priority_type?: string
          start_time?: string | null
          timezone?: string | null
          updated_at?: string
          weekly_schedule?: Json | null
          weight?: number
        }
        Update: {
          advertiser_id?: string
          affiliate_id?: string
          country_code?: string
          created_at?: string
          daily_cap?: number | null
          end_time?: string | null
          hourly_cap?: number | null
          id?: string
          is_active?: boolean
          priority_type?: string
          start_time?: string | null
          timezone?: string | null
          updated_at?: string
          weekly_schedule?: Json | null
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_distribution_rules_advertiser_id_fkey"
            columns: ["advertiser_id"]
            isOneToOne: false
            referencedRelation: "advertisers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_distribution_rules_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliates"
            referencedColumns: ["id"]
          },
        ]
      }
      affiliate_payouts: {
        Row: {
          advertiser_id: string | null
          affiliate_id: string
          country_code: string
          created_at: string
          crg_base_price: number | null
          crg_guarantee_percent: number | null
          currency: string
          deal_type: string
          id: string
          lead_count: number | null
          payout: number
          revenue: number
          updated_at: string
        }
        Insert: {
          advertiser_id?: string | null
          affiliate_id: string
          country_code: string
          created_at?: string
          crg_base_price?: number | null
          crg_guarantee_percent?: number | null
          currency?: string
          deal_type?: string
          id?: string
          lead_count?: number | null
          payout?: number
          revenue?: number
          updated_at?: string
        }
        Update: {
          advertiser_id?: string | null
          affiliate_id?: string
          country_code?: string
          created_at?: string
          crg_base_price?: number | null
          crg_guarantee_percent?: number | null
          currency?: string
          deal_type?: string
          id?: string
          lead_count?: number | null
          payout?: number
          revenue?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_payouts_advertiser_id_fkey"
            columns: ["advertiser_id"]
            isOneToOne: false
            referencedRelation: "advertisers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_payouts_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliates"
            referencedColumns: ["id"]
          },
        ]
      }
      affiliate_submission_failures: {
        Row: {
          affiliate_id: string | null
          country_code: string | null
          created_at: string
          email: string
          firstname: string | null
          id: string
          lastname: string | null
          mobile: string | null
          raw_payload: Json | null
          rejection_code: string
          rejection_message: string | null
          target_advertiser_id: string | null
        }
        Insert: {
          affiliate_id?: string | null
          country_code?: string | null
          created_at?: string
          email: string
          firstname?: string | null
          id?: string
          lastname?: string | null
          mobile?: string | null
          raw_payload?: Json | null
          rejection_code: string
          rejection_message?: string | null
          target_advertiser_id?: string | null
        }
        Update: {
          affiliate_id?: string | null
          country_code?: string | null
          created_at?: string
          email?: string
          firstname?: string | null
          id?: string
          lastname?: string | null
          mobile?: string | null
          raw_payload?: Json | null
          rejection_code?: string
          rejection_message?: string | null
          target_advertiser_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_submission_failures_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_submission_failures_target_advertiser_id_fkey"
            columns: ["target_advertiser_id"]
            isOneToOne: false
            referencedRelation: "advertisers"
            referencedColumns: ["id"]
          },
        ]
      }
      affiliate_submission_stats: {
        Row: {
          affiliate_id: string
          avg_hourly_rate: number | null
          created_at: string
          date: string
          hour: number
          id: string
          lead_count: number
          spike_detected: boolean | null
          updated_at: string
        }
        Insert: {
          affiliate_id: string
          avg_hourly_rate?: number | null
          created_at?: string
          date?: string
          hour?: number
          id?: string
          lead_count?: number
          spike_detected?: boolean | null
          updated_at?: string
        }
        Update: {
          affiliate_id?: string
          avg_hourly_rate?: number | null
          created_at?: string
          date?: string
          hour?: number
          id?: string
          lead_count?: number
          spike_detected?: boolean | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_submission_stats_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliates"
            referencedColumns: ["id"]
          },
        ]
      }
      affiliates: {
        Row: {
          allowed_countries: string[] | null
          api_key: string
          callback_url: string | null
          created_at: string
          id: string
          is_active: boolean
          name: string
          test_mode: boolean
          updated_at: string
          user_id: string | null
        }
        Insert: {
          allowed_countries?: string[] | null
          api_key?: string
          callback_url?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          test_mode?: boolean
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          allowed_countries?: string[] | null
          api_key?: string
          callback_url?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          test_mode?: boolean
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          changes_summary: string | null
          created_at: string
          id: string
          ip_address: string | null
          new_data: Json | null
          old_data: Json | null
          record_id: string | null
          request_path: string | null
          table_name: string | null
          user_agent: string | null
          user_email: string | null
          user_id: string
        }
        Insert: {
          action: string
          changes_summary?: string | null
          created_at?: string
          id?: string
          ip_address?: string | null
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string | null
          request_path?: string | null
          table_name?: string | null
          user_agent?: string | null
          user_email?: string | null
          user_id: string
        }
        Update: {
          action?: string
          changes_summary?: string | null
          created_at?: string
          id?: string
          ip_address?: string | null
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string | null
          request_path?: string | null
          table_name?: string | null
          user_agent?: string | null
          user_email?: string | null
          user_id?: string
        }
        Relationships: []
      }
      callback_logs: {
        Row: {
          advertiser_id: string | null
          advertiser_name: string | null
          callback_type: string
          changes_applied: Json | null
          created_at: string
          id: string
          injection_lead_id: string | null
          ip_address: string | null
          lead_id: string | null
          matched_by: string | null
          processed_at: string | null
          processing_error: string | null
          processing_status: string
          request_headers: Json | null
          request_method: string
          request_payload: Json | null
          request_raw: string | null
          request_url: string | null
        }
        Insert: {
          advertiser_id?: string | null
          advertiser_name?: string | null
          callback_type?: string
          changes_applied?: Json | null
          created_at?: string
          id?: string
          injection_lead_id?: string | null
          ip_address?: string | null
          lead_id?: string | null
          matched_by?: string | null
          processed_at?: string | null
          processing_error?: string | null
          processing_status?: string
          request_headers?: Json | null
          request_method?: string
          request_payload?: Json | null
          request_raw?: string | null
          request_url?: string | null
        }
        Update: {
          advertiser_id?: string | null
          advertiser_name?: string | null
          callback_type?: string
          changes_applied?: Json | null
          created_at?: string
          id?: string
          injection_lead_id?: string | null
          ip_address?: string | null
          lead_id?: string | null
          matched_by?: string | null
          processed_at?: string | null
          processing_error?: string | null
          processing_status?: string
          request_headers?: Json | null
          request_method?: string
          request_payload?: Json | null
          request_raw?: string | null
          request_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "callback_logs_advertiser_id_fkey"
            columns: ["advertiser_id"]
            isOneToOne: false
            referencedRelation: "advertisers"
            referencedColumns: ["id"]
          },
        ]
      }
      country_phone_prefixes: {
        Row: {
          country_code: string
          created_at: string
          phone_length_max: number | null
          phone_length_min: number | null
          phone_prefix: string
        }
        Insert: {
          country_code: string
          created_at?: string
          phone_length_max?: number | null
          phone_length_min?: number | null
          phone_prefix: string
        }
        Update: {
          country_code?: string
          created_at?: string
          phone_length_max?: number | null
          phone_length_min?: number | null
          phone_prefix?: string
        }
        Relationships: []
      }
      crm_types: {
        Row: {
          ai_analysis: Json | null
          auth_header_name: string | null
          auth_type: string
          autologin_url_path: string | null
          code: string
          created_at: string
          default_url: string | null
          description: string | null
          error_check: Json | null
          extra_body_fields: Json
          extra_headers: Json
          field_descriptions: Json
          field_labels: Json
          field_mappings: Json
          id: string
          is_active: boolean
          lead_id_path: string | null
          name: string
          original_docs: string | null
          request_format: string
          required_fields: Json
          success_check: Json | null
          updated_at: string
          use_forwarder: boolean
        }
        Insert: {
          ai_analysis?: Json | null
          auth_header_name?: string | null
          auth_type?: string
          autologin_url_path?: string | null
          code: string
          created_at?: string
          default_url?: string | null
          description?: string | null
          error_check?: Json | null
          extra_body_fields?: Json
          extra_headers?: Json
          field_descriptions?: Json
          field_labels?: Json
          field_mappings?: Json
          id?: string
          is_active?: boolean
          lead_id_path?: string | null
          name: string
          original_docs?: string | null
          request_format?: string
          required_fields?: Json
          success_check?: Json | null
          updated_at?: string
          use_forwarder?: boolean
        }
        Update: {
          ai_analysis?: Json | null
          auth_header_name?: string | null
          auth_type?: string
          autologin_url_path?: string | null
          code?: string
          created_at?: string
          default_url?: string | null
          description?: string | null
          error_check?: Json | null
          extra_body_fields?: Json
          extra_headers?: Json
          field_descriptions?: Json
          field_labels?: Json
          field_mappings?: Json
          id?: string
          is_active?: boolean
          lead_id_path?: string | null
          name?: string
          original_docs?: string | null
          request_format?: string
          required_fields?: Json
          success_check?: Json | null
          updated_at?: string
          use_forwarder?: boolean
        }
        Relationships: []
      }
      distribution_round_robin: {
        Row: {
          id: string
          last_advertiser_id: string | null
          updated_at: string
          weight_group: number
        }
        Insert: {
          id?: string
          last_advertiser_id?: string | null
          updated_at?: string
          weight_group?: number
        }
        Update: {
          id?: string
          last_advertiser_id?: string | null
          updated_at?: string
          weight_group?: number
        }
        Relationships: [
          {
            foreignKeyName: "distribution_round_robin_last_advertiser_id_fkey"
            columns: ["last_advertiser_id"]
            isOneToOne: false
            referencedRelation: "advertisers"
            referencedColumns: ["id"]
          },
        ]
      }
      global_sent_leads: {
        Row: {
          advertiser_id: string
          country_code: string | null
          created_at: string
          email: string
          id: string
          injection_id: string | null
          sent_at: string
        }
        Insert: {
          advertiser_id: string
          country_code?: string | null
          created_at?: string
          email: string
          id?: string
          injection_id?: string | null
          sent_at?: string
        }
        Update: {
          advertiser_id?: string
          country_code?: string | null
          created_at?: string
          email?: string
          id?: string
          injection_id?: string | null
          sent_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "global_sent_leads_advertiser_id_fkey"
            columns: ["advertiser_id"]
            isOneToOne: false
            referencedRelation: "advertisers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "global_sent_leads_injection_id_fkey"
            columns: ["injection_id"]
            isOneToOne: false
            referencedRelation: "injections"
            referencedColumns: ["id"]
          },
        ]
      }
      injection_leads: {
        Row: {
          advertiser_id: string | null
          autologin_url: string | null
          browser_language: string | null
          city: string | null
          comment: string | null
          country: string | null
          country_code: string
          created_at: string
          custom1: string | null
          custom2: string | null
          custom3: string | null
          device_type: string | null
          email: string
          error_message: string | null
          external_lead_id: string | null
          firstname: string
          fraud_flags: Json | null
          fraud_score: number | null
          ftd_date: string | null
          id: string
          injection_id: string | null
          ip_address: string | null
          is_ftd: boolean
          is_hidden: boolean
          isp_name: string | null
          lastname: string
          mobile: string
          offer_name: string | null
          pool_lead_id: string | null
          response: string | null
          sale_status: string | null
          scheduled_at: string | null
          sent_at: string | null
          status: Database["public"]["Enums"]["injection_lead_status"]
          timezone: string | null
          user_agent: string | null
        }
        Insert: {
          advertiser_id?: string | null
          autologin_url?: string | null
          browser_language?: string | null
          city?: string | null
          comment?: string | null
          country?: string | null
          country_code: string
          created_at?: string
          custom1?: string | null
          custom2?: string | null
          custom3?: string | null
          device_type?: string | null
          email: string
          error_message?: string | null
          external_lead_id?: string | null
          firstname: string
          fraud_flags?: Json | null
          fraud_score?: number | null
          ftd_date?: string | null
          id?: string
          injection_id?: string | null
          ip_address?: string | null
          is_ftd?: boolean
          is_hidden?: boolean
          isp_name?: string | null
          lastname: string
          mobile: string
          offer_name?: string | null
          pool_lead_id?: string | null
          response?: string | null
          sale_status?: string | null
          scheduled_at?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["injection_lead_status"]
          timezone?: string | null
          user_agent?: string | null
        }
        Update: {
          advertiser_id?: string | null
          autologin_url?: string | null
          browser_language?: string | null
          city?: string | null
          comment?: string | null
          country?: string | null
          country_code?: string
          created_at?: string
          custom1?: string | null
          custom2?: string | null
          custom3?: string | null
          device_type?: string | null
          email?: string
          error_message?: string | null
          external_lead_id?: string | null
          firstname?: string
          fraud_flags?: Json | null
          fraud_score?: number | null
          ftd_date?: string | null
          id?: string
          injection_id?: string | null
          ip_address?: string | null
          is_ftd?: boolean
          is_hidden?: boolean
          isp_name?: string | null
          lastname?: string
          mobile?: string
          offer_name?: string | null
          pool_lead_id?: string | null
          response?: string | null
          sale_status?: string | null
          scheduled_at?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["injection_lead_status"]
          timezone?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "injection_leads_advertiser_id_fkey"
            columns: ["advertiser_id"]
            isOneToOne: false
            referencedRelation: "advertisers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "injection_leads_injection_id_fkey"
            columns: ["injection_id"]
            isOneToOne: false
            referencedRelation: "injections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "injection_leads_pool_lead_id_fkey"
            columns: ["pool_lead_id"]
            isOneToOne: false
            referencedRelation: "lead_pool_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      injection_pool_leads: {
        Row: {
          autologin_url: string | null
          comment: string | null
          country: string | null
          country_code: string
          created_at: string
          custom1: string | null
          custom2: string | null
          custom3: string | null
          email: string
          error_message: string | null
          external_lead_id: string | null
          firstname: string
          id: string
          ip_address: string | null
          lastname: string
          mobile: string
          offer_name: string | null
          pool_id: string
          response: string | null
          scheduled_at: string | null
          sent_at: string | null
          status: Database["public"]["Enums"]["injection_lead_status"]
        }
        Insert: {
          autologin_url?: string | null
          comment?: string | null
          country?: string | null
          country_code: string
          created_at?: string
          custom1?: string | null
          custom2?: string | null
          custom3?: string | null
          email: string
          error_message?: string | null
          external_lead_id?: string | null
          firstname: string
          id?: string
          ip_address?: string | null
          lastname: string
          mobile: string
          offer_name?: string | null
          pool_id: string
          response?: string | null
          scheduled_at?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["injection_lead_status"]
        }
        Update: {
          autologin_url?: string | null
          comment?: string | null
          country?: string | null
          country_code?: string
          created_at?: string
          custom1?: string | null
          custom2?: string | null
          custom3?: string | null
          email?: string
          error_message?: string | null
          external_lead_id?: string | null
          firstname?: string
          id?: string
          ip_address?: string | null
          lastname?: string
          mobile?: string
          offer_name?: string | null
          pool_id?: string
          response?: string | null
          scheduled_at?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["injection_lead_status"]
        }
        Relationships: [
          {
            foreignKeyName: "injection_pool_leads_pool_id_fkey"
            columns: ["pool_id"]
            isOneToOne: false
            referencedRelation: "injection_pools"
            referencedColumns: ["id"]
          },
        ]
      }
      injection_pools: {
        Row: {
          advertiser_id: string
          created_at: string
          created_by: string | null
          failed_count: number
          geo_caps: Json | null
          id: string
          max_delay_seconds: number
          min_delay_seconds: number
          name: string
          next_scheduled_at: string | null
          noise_level: string
          sent_count: number
          skipped_count: number
          source_affiliate_ids: string[] | null
          source_countries: string[] | null
          source_from_date: string | null
          source_to_date: string | null
          status: Database["public"]["Enums"]["injection_pool_status"]
          total_leads: number
          updated_at: string
          working_days: string[] | null
          working_end_time: string | null
          working_start_time: string | null
        }
        Insert: {
          advertiser_id: string
          created_at?: string
          created_by?: string | null
          failed_count?: number
          geo_caps?: Json | null
          id?: string
          max_delay_seconds?: number
          min_delay_seconds?: number
          name: string
          next_scheduled_at?: string | null
          noise_level?: string
          sent_count?: number
          skipped_count?: number
          source_affiliate_ids?: string[] | null
          source_countries?: string[] | null
          source_from_date?: string | null
          source_to_date?: string | null
          status?: Database["public"]["Enums"]["injection_pool_status"]
          total_leads?: number
          updated_at?: string
          working_days?: string[] | null
          working_end_time?: string | null
          working_start_time?: string | null
        }
        Update: {
          advertiser_id?: string
          created_at?: string
          created_by?: string | null
          failed_count?: number
          geo_caps?: Json | null
          id?: string
          max_delay_seconds?: number
          min_delay_seconds?: number
          name?: string
          next_scheduled_at?: string | null
          noise_level?: string
          sent_count?: number
          skipped_count?: number
          source_affiliate_ids?: string[] | null
          source_countries?: string[] | null
          source_from_date?: string | null
          source_to_date?: string | null
          status?: Database["public"]["Enums"]["injection_pool_status"]
          total_leads?: number
          updated_at?: string
          working_days?: string[] | null
          working_end_time?: string | null
          working_start_time?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "injection_pools_advertiser_id_fkey"
            columns: ["advertiser_id"]
            isOneToOne: false
            referencedRelation: "advertisers"
            referencedColumns: ["id"]
          },
        ]
      }
      injections: {
        Row: {
          advertiser_ids: string[] | null
          created_at: string
          created_by: string | null
          failed_count: number
          filter_affiliate_ids: string[] | null
          filter_countries: string[] | null
          filter_from_date: string | null
          filter_to_date: string | null
          geo_caps: Json | null
          geo_caps_baseline: Json | null
          id: string
          max_delay_seconds: number
          min_delay_seconds: number
          name: string
          next_scheduled_at: string | null
          noise_level: string
          offer_name: string | null
          pool_id: string
          sent_count: number
          skipped_count: number
          smart_distribution_state: Json | null
          smart_mode: boolean | null
          status: Database["public"]["Enums"]["injection_pool_status"]
          total_leads: number
          traffic_simulation_state: Json | null
          updated_at: string
          working_days: string[] | null
          working_end_time: string | null
          working_start_time: string | null
        }
        Insert: {
          advertiser_ids?: string[] | null
          created_at?: string
          created_by?: string | null
          failed_count?: number
          filter_affiliate_ids?: string[] | null
          filter_countries?: string[] | null
          filter_from_date?: string | null
          filter_to_date?: string | null
          geo_caps?: Json | null
          geo_caps_baseline?: Json | null
          id?: string
          max_delay_seconds?: number
          min_delay_seconds?: number
          name: string
          next_scheduled_at?: string | null
          noise_level?: string
          offer_name?: string | null
          pool_id: string
          sent_count?: number
          skipped_count?: number
          smart_distribution_state?: Json | null
          smart_mode?: boolean | null
          status?: Database["public"]["Enums"]["injection_pool_status"]
          total_leads?: number
          traffic_simulation_state?: Json | null
          updated_at?: string
          working_days?: string[] | null
          working_end_time?: string | null
          working_start_time?: string | null
        }
        Update: {
          advertiser_ids?: string[] | null
          created_at?: string
          created_by?: string | null
          failed_count?: number
          filter_affiliate_ids?: string[] | null
          filter_countries?: string[] | null
          filter_from_date?: string | null
          filter_to_date?: string | null
          geo_caps?: Json | null
          geo_caps_baseline?: Json | null
          id?: string
          max_delay_seconds?: number
          min_delay_seconds?: number
          name?: string
          next_scheduled_at?: string | null
          noise_level?: string
          offer_name?: string | null
          pool_id?: string
          sent_count?: number
          skipped_count?: number
          smart_distribution_state?: Json | null
          smart_mode?: boolean | null
          status?: Database["public"]["Enums"]["injection_pool_status"]
          total_leads?: number
          traffic_simulation_state?: Json | null
          updated_at?: string
          working_days?: string[] | null
          working_end_time?: string | null
          working_start_time?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "injections_pool_id_fkey"
            columns: ["pool_id"]
            isOneToOne: false
            referencedRelation: "lead_pools"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_distributions: {
        Row: {
          advertiser_id: string
          affiliate_id: string | null
          autologin_url: string | null
          created_at: string
          external_lead_id: string | null
          id: string
          last_polled_at: string | null
          lead_id: string
          response: string | null
          sent_at: string | null
          status: Database["public"]["Enums"]["distribution_status"]
          updated_at: string
        }
        Insert: {
          advertiser_id: string
          affiliate_id?: string | null
          autologin_url?: string | null
          created_at?: string
          external_lead_id?: string | null
          id?: string
          last_polled_at?: string | null
          lead_id: string
          response?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["distribution_status"]
          updated_at?: string
        }
        Update: {
          advertiser_id?: string
          affiliate_id?: string | null
          autologin_url?: string | null
          created_at?: string
          external_lead_id?: string | null
          id?: string
          last_polled_at?: string | null
          lead_id?: string
          response?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["distribution_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_distributions_advertiser_id_fkey"
            columns: ["advertiser_id"]
            isOneToOne: false
            referencedRelation: "advertisers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_distributions_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_distributions_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_pool_leads: {
        Row: {
          comment: string | null
          country: string | null
          country_code: string
          created_at: string
          custom1: string | null
          custom2: string | null
          custom3: string | null
          email: string
          firstname: string
          id: string
          ip_address: string | null
          is_hidden: boolean
          lastname: string
          mobile: string
          offer_name: string | null
          pool_id: string | null
          source_affiliate_id: string | null
          source_date: string | null
        }
        Insert: {
          comment?: string | null
          country?: string | null
          country_code: string
          created_at?: string
          custom1?: string | null
          custom2?: string | null
          custom3?: string | null
          email: string
          firstname: string
          id?: string
          ip_address?: string | null
          is_hidden?: boolean
          lastname: string
          mobile: string
          offer_name?: string | null
          pool_id?: string | null
          source_affiliate_id?: string | null
          source_date?: string | null
        }
        Update: {
          comment?: string | null
          country?: string | null
          country_code?: string
          created_at?: string
          custom1?: string | null
          custom2?: string | null
          custom3?: string | null
          email?: string
          firstname?: string
          id?: string
          ip_address?: string | null
          is_hidden?: boolean
          lastname?: string
          mobile?: string
          offer_name?: string | null
          pool_id?: string | null
          source_affiliate_id?: string | null
          source_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_pool_leads_pool_id_fkey"
            columns: ["pool_id"]
            isOneToOne: false
            referencedRelation: "lead_pools"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_pools: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      lead_queue: {
        Row: {
          attempts: number
          created_at: string
          error_message: string | null
          id: string
          lead_id: string
          max_attempts: number
          processed_at: string | null
          status: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          error_message?: string | null
          id?: string
          lead_id: string
          max_attempts?: number
          processed_at?: string | null
          status?: string
        }
        Update: {
          attempts?: number
          created_at?: string
          error_message?: string | null
          id?: string
          lead_id?: string
          max_attempts?: number
          processed_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_queue_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: true
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_status_history: {
        Row: {
          change_reason: string | null
          change_source: string
          changed_by: string | null
          created_at: string
          field_name: string
          id: string
          injection_lead_id: string | null
          ip_address: string | null
          lead_id: string | null
          new_value: string | null
          old_value: string | null
          user_agent: string | null
        }
        Insert: {
          change_reason?: string | null
          change_source?: string
          changed_by?: string | null
          created_at?: string
          field_name: string
          id?: string
          injection_lead_id?: string | null
          ip_address?: string | null
          lead_id?: string | null
          new_value?: string | null
          old_value?: string | null
          user_agent?: string | null
        }
        Update: {
          change_reason?: string | null
          change_source?: string
          changed_by?: string | null
          created_at?: string
          field_name?: string
          id?: string
          injection_lead_id?: string | null
          ip_address?: string | null
          lead_id?: string | null
          new_value?: string | null
          old_value?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_status_history_injection_lead_id_fkey"
            columns: ["injection_lead_id"]
            isOneToOne: false
            referencedRelation: "injection_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_status_history_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          affiliate_id: string | null
          assigned_to: string | null
          comment: string | null
          country: string | null
          country_code: string
          created_at: string
          custom1: string | null
          custom2: string | null
          custom3: string | null
          distributed_at: string | null
          email: string
          firstname: string
          fraud_flags: Json | null
          fraud_score: number | null
          ftd_date: string | null
          ftd_released: boolean
          ftd_released_at: string | null
          ftd_released_by: string | null
          id: string
          ip_address: string | null
          is_ftd: boolean
          lastname: string
          mobile: string
          needs_review: boolean | null
          offer_name: string | null
          request_id: string | null
          sale_status: string | null
          status: Database["public"]["Enums"]["lead_status"]
          updated_at: string
        }
        Insert: {
          affiliate_id?: string | null
          assigned_to?: string | null
          comment?: string | null
          country?: string | null
          country_code: string
          created_at?: string
          custom1?: string | null
          custom2?: string | null
          custom3?: string | null
          distributed_at?: string | null
          email: string
          firstname: string
          fraud_flags?: Json | null
          fraud_score?: number | null
          ftd_date?: string | null
          ftd_released?: boolean
          ftd_released_at?: string | null
          ftd_released_by?: string | null
          id?: string
          ip_address?: string | null
          is_ftd?: boolean
          lastname: string
          mobile: string
          needs_review?: boolean | null
          offer_name?: string | null
          request_id?: string | null
          sale_status?: string | null
          status?: Database["public"]["Enums"]["lead_status"]
          updated_at?: string
        }
        Update: {
          affiliate_id?: string | null
          assigned_to?: string | null
          comment?: string | null
          country?: string | null
          country_code?: string
          created_at?: string
          custom1?: string | null
          custom2?: string | null
          custom3?: string | null
          distributed_at?: string | null
          email?: string
          firstname?: string
          fraud_flags?: Json | null
          fraud_score?: number | null
          ftd_date?: string | null
          ftd_released?: boolean
          ftd_released_at?: string | null
          ftd_released_by?: string | null
          id?: string
          ip_address?: string | null
          is_ftd?: boolean
          lastname?: string
          mobile?: string
          needs_review?: boolean | null
          offer_name?: string | null
          request_id?: string | null
          sale_status?: string | null
          status?: Database["public"]["Enums"]["lead_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leads_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliates"
            referencedColumns: ["id"]
          },
        ]
      }
      login_attempts: {
        Row: {
          country_code: string | null
          created_at: string
          email: string
          failure_reason: string | null
          id: string
          ip_address: string
          success: boolean
          user_agent: string | null
        }
        Insert: {
          country_code?: string | null
          created_at?: string
          email: string
          failure_reason?: string | null
          id?: string
          ip_address: string
          success?: boolean
          user_agent?: string | null
        }
        Update: {
          country_code?: string | null
          created_at?: string
          email?: string
          failure_reason?: string | null
          id?: string
          ip_address?: string
          success?: boolean
          user_agent?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          last_sign_in_at: string | null
          updated_at: string
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          last_sign_in_at?: string | null
          updated_at?: string
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          last_sign_in_at?: string | null
          updated_at?: string
          username?: string | null
        }
        Relationships: []
      }
      rejected_leads: {
        Row: {
          advertiser_id: string
          created_at: string
          id: string
          lead_id: string
          reason: string | null
        }
        Insert: {
          advertiser_id: string
          created_at?: string
          id?: string
          lead_id: string
          reason?: string | null
        }
        Update: {
          advertiser_id?: string
          created_at?: string
          id?: string
          lead_id?: string
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rejected_leads_advertiser_id_fkey"
            columns: ["advertiser_id"]
            isOneToOne: false
            referencedRelation: "advertisers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rejected_leads_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          created_at: string
          id: string
          is_granted: boolean
          permission_key: string
          permission_type: Database["public"]["Enums"]["permission_type"]
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_granted?: boolean
          permission_key: string
          permission_type: Database["public"]["Enums"]["permission_type"]
          role: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_granted?: boolean
          permission_key?: string
          permission_type?: Database["public"]["Enums"]["permission_type"]
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Relationships: []
      }
      test_lead_logs: {
        Row: {
          advertiser_id: string
          created_at: string
          created_by: string | null
          id: string
          request_headers: Json | null
          request_payload: string | null
          request_url: string | null
          response: string | null
          success: boolean
          test_data: Json
        }
        Insert: {
          advertiser_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          request_headers?: Json | null
          request_payload?: string | null
          request_url?: string | null
          response?: string | null
          success?: boolean
          test_data: Json
        }
        Update: {
          advertiser_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          request_headers?: Json | null
          request_payload?: string | null
          request_url?: string | null
          response?: string | null
          success?: boolean
          test_data?: Json
        }
        Relationships: [
          {
            foreignKeyName: "test_lead_logs_advertiser_id_fkey"
            columns: ["advertiser_id"]
            isOneToOne: false
            referencedRelation: "advertisers"
            referencedColumns: ["id"]
          },
        ]
      }
      user_permissions: {
        Row: {
          created_at: string
          id: string
          permission: Database["public"]["Enums"]["user_permission"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          permission: Database["public"]["Enums"]["user_permission"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          permission?: Database["public"]["Enums"]["user_permission"]
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_affiliate_by_api_key: { Args: { _api_key: string }; Returns: string }
      get_email_by_username: {
        Args: { lookup_username: string }
        Returns: string
      }
      get_failed_login_count: {
        Args: { check_email: string; check_ip: string }
        Returns: number
      }
      get_injection_advertiser_stats: {
        Args: { p_injection_id: string }
        Returns: {
          advertiser_id: string
          conversion_rate: number
          total_failed: number
          total_ftd: number
          total_sent: number
        }[]
      }
      has_permission: {
        Args: {
          _permission: Database["public"]["Enums"]["user_permission"]
          _user_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_role_permission: {
        Args: { _permission_key: string; _user_id: string }
        Returns: boolean
      }
      is_account_locked: {
        Args: { check_email: string; check_ip: string }
        Returns: boolean
      }
      is_agent: { Args: { _user_id: string }; Returns: boolean }
      is_manager: { Args: { _user_id: string }; Returns: boolean }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
      log_status_change: {
        Args: {
          p_change_reason?: string
          p_change_source: string
          p_changed_by: string
          p_field_name: string
          p_injection_lead_id: string
          p_lead_id: string
          p_new_value: string
          p_old_value: string
        }
        Returns: string
      }
      set_user_roles: {
        Args: {
          _roles: Database["public"]["Enums"]["app_role"][]
          _target_user_id: string
        }
        Returns: undefined
      }
    }
    Enums: {
      advertiser_type:
        | "getlinked"
        | "trackbox"
        | "drmailer"
        | "enigma"
        | "timelocal"
        | "custom"
        | "elitecrm"
        | "gsi"
        | "mock"
        | "elnopy"
      app_role: "super_admin" | "manager" | "agent" | "affiliate"
      distribution_status: "pending" | "sent" | "failed"
      injection_lead_status:
        | "pending"
        | "scheduled"
        | "sending"
        | "sent"
        | "failed"
        | "skipped"
      injection_pool_status:
        | "draft"
        | "running"
        | "paused"
        | "completed"
        | "cancelled"
      lead_status:
        | "new"
        | "contacted"
        | "qualified"
        | "converted"
        | "lost"
        | "rejected"
      permission_type: "navigation" | "feature" | "data"
      user_permission:
        | "view_phone"
        | "view_email"
        | "export_leads"
        | "delete_leads"
        | "edit_leads"
        | "view_all_leads"
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
      advertiser_type: [
        "getlinked",
        "trackbox",
        "drmailer",
        "enigma",
        "timelocal",
        "custom",
        "elitecrm",
        "gsi",
        "mock",
        "elnopy",
      ],
      app_role: ["super_admin", "manager", "agent", "affiliate"],
      distribution_status: ["pending", "sent", "failed"],
      injection_lead_status: [
        "pending",
        "scheduled",
        "sending",
        "sent",
        "failed",
        "skipped",
      ],
      injection_pool_status: [
        "draft",
        "running",
        "paused",
        "completed",
        "cancelled",
      ],
      lead_status: [
        "new",
        "contacted",
        "qualified",
        "converted",
        "lost",
        "rejected",
      ],
      permission_type: ["navigation", "feature", "data"],
      user_permission: [
        "view_phone",
        "view_email",
        "export_leads",
        "delete_leads",
        "edit_leads",
        "view_all_leads",
      ],
    },
  },
} as const
