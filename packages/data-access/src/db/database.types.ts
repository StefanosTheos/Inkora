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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      ai_previews: {
        Row: {
          completed_at: string | null
          created_at: string
          error: string | null
          id: string
          placement: string | null
          profile_id: string
          prompt: string | null
          result_image_path: string | null
          source_idea_id: string | null
          source_image_path: string | null
          status: Database["public"]["Enums"]["ai_preview_status"]
          style_id: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          error?: string | null
          id?: string
          placement?: string | null
          profile_id: string
          prompt?: string | null
          result_image_path?: string | null
          source_idea_id?: string | null
          source_image_path?: string | null
          status?: Database["public"]["Enums"]["ai_preview_status"]
          style_id?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          error?: string | null
          id?: string
          placement?: string | null
          profile_id?: string
          prompt?: string | null
          result_image_path?: string | null
          source_idea_id?: string | null
          source_image_path?: string | null
          status?: Database["public"]["Enums"]["ai_preview_status"]
          style_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_previews_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_previews_source_idea_id_fkey"
            columns: ["source_idea_id"]
            isOneToOne: false
            referencedRelation: "tattoo_ideas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_previews_style_id_fkey"
            columns: ["style_id"]
            isOneToOne: false
            referencedRelation: "tattoo_styles"
            referencedColumns: ["id"]
          },
        ]
      }
      appointment_requests: {
        Row: {
          approx_size: string | null
          artist_id: string
          budget_max: number | null
          budget_min: number | null
          client_id: string
          conversation_id: string | null
          created_at: string
          description: string | null
          id: string
          idea_id: string | null
          is_color: boolean | null
          placement: string | null
          preferred_dates: unknown[] | null
          reference_paths: string[]
          status: Database["public"]["Enums"]["request_status"]
          studio_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          approx_size?: string | null
          artist_id: string
          budget_max?: number | null
          budget_min?: number | null
          client_id: string
          conversation_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          idea_id?: string | null
          is_color?: boolean | null
          placement?: string | null
          preferred_dates?: unknown[] | null
          reference_paths?: string[]
          status?: Database["public"]["Enums"]["request_status"]
          studio_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          approx_size?: string | null
          artist_id?: string
          budget_max?: number | null
          budget_min?: number | null
          client_id?: string
          conversation_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          idea_id?: string | null
          is_color?: boolean | null
          placement?: string | null
          preferred_dates?: unknown[] | null
          reference_paths?: string[]
          status?: Database["public"]["Enums"]["request_status"]
          studio_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointment_requests_artist_id_fkey"
            columns: ["artist_id"]
            isOneToOne: false
            referencedRelation: "artists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_requests_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_requests_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_requests_idea_id_fkey"
            columns: ["idea_id"]
            isOneToOne: false
            referencedRelation: "tattoo_ideas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_requests_studio_id_fkey"
            columns: ["studio_id"]
            isOneToOne: false
            referencedRelation: "studios"
            referencedColumns: ["id"]
          },
        ]
      }
      appointments: {
        Row: {
          artist_id: string
          cancellation_reason: string | null
          cancelled_at: string | null
          client_id: string
          completed_at: string | null
          created_at: string
          deposit_amount: number | null
          deposit_paid: boolean
          id: string
          location_note: string | null
          notes: string | null
          offer_id: string | null
          price_amount: number | null
          request_id: string | null
          scheduled_end: string
          scheduled_start: string
          status: Database["public"]["Enums"]["appointment_status"]
          studio_id: string | null
          updated_at: string
        }
        Insert: {
          artist_id: string
          cancellation_reason?: string | null
          cancelled_at?: string | null
          client_id: string
          completed_at?: string | null
          created_at?: string
          deposit_amount?: number | null
          deposit_paid?: boolean
          id?: string
          location_note?: string | null
          notes?: string | null
          offer_id?: string | null
          price_amount?: number | null
          request_id?: string | null
          scheduled_end: string
          scheduled_start: string
          status?: Database["public"]["Enums"]["appointment_status"]
          studio_id?: string | null
          updated_at?: string
        }
        Update: {
          artist_id?: string
          cancellation_reason?: string | null
          cancelled_at?: string | null
          client_id?: string
          completed_at?: string | null
          created_at?: string
          deposit_amount?: number | null
          deposit_paid?: boolean
          id?: string
          location_note?: string | null
          notes?: string | null
          offer_id?: string | null
          price_amount?: number | null
          request_id?: string | null
          scheduled_end?: string
          scheduled_start?: string
          status?: Database["public"]["Enums"]["appointment_status"]
          studio_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_artist_id_fkey"
            columns: ["artist_id"]
            isOneToOne: false
            referencedRelation: "artists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "offers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "appointment_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_studio_id_fkey"
            columns: ["studio_id"]
            isOneToOne: false
            referencedRelation: "studios"
            referencedColumns: ["id"]
          },
        ]
      }
      artist_availability: {
        Row: {
          artist_id: string
          day_of_week: number
          end_time: string
          id: string
          is_active: boolean
          start_time: string
          timezone: string
        }
        Insert: {
          artist_id: string
          day_of_week: number
          end_time: string
          id?: string
          is_active?: boolean
          start_time: string
          timezone?: string
        }
        Update: {
          artist_id?: string
          day_of_week?: number
          end_time?: string
          id?: string
          is_active?: boolean
          start_time?: string
          timezone?: string
        }
        Relationships: [
          {
            foreignKeyName: "artist_availability_artist_id_fkey"
            columns: ["artist_id"]
            isOneToOne: false
            referencedRelation: "artists"
            referencedColumns: ["id"]
          },
        ]
      }
      artist_offers: {
        Row: {
          artist_id: string
          created_at: string
          currency_code: string
          description: string | null
          id: string
          is_active: boolean
          price_amount: number | null
          sort_order: number
          title: string
        }
        Insert: {
          artist_id: string
          created_at?: string
          currency_code?: string
          description?: string | null
          id?: string
          is_active?: boolean
          price_amount?: number | null
          sort_order?: number
          title: string
        }
        Update: {
          artist_id?: string
          created_at?: string
          currency_code?: string
          description?: string | null
          id?: string
          is_active?: boolean
          price_amount?: number | null
          sort_order?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "artist_offers_artist_id_fkey"
            columns: ["artist_id"]
            isOneToOne: false
            referencedRelation: "artists"
            referencedColumns: ["id"]
          },
        ]
      }
      artist_styles: {
        Row: {
          artist_id: string
          is_primary: boolean
          style_id: string
        }
        Insert: {
          artist_id: string
          is_primary?: boolean
          style_id: string
        }
        Update: {
          artist_id?: string
          is_primary?: boolean
          style_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "artist_styles_artist_id_fkey"
            columns: ["artist_id"]
            isOneToOne: false
            referencedRelation: "artists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "artist_styles_style_id_fkey"
            columns: ["style_id"]
            isOneToOne: false
            referencedRelation: "tattoo_styles"
            referencedColumns: ["id"]
          },
        ]
      }
      artist_unavailable_dates: {
        Row: {
          artist_id: string
          created_at: string
          during: unknown
          id: string
          reason: string | null
        }
        Insert: {
          artist_id: string
          created_at?: string
          during: unknown
          id?: string
          reason?: string | null
        }
        Update: {
          artist_id?: string
          created_at?: string
          during?: unknown
          id?: string
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "artist_unavailable_dates_artist_id_fkey"
            columns: ["artist_id"]
            isOneToOne: false
            referencedRelation: "artists"
            referencedColumns: ["id"]
          },
        ]
      }
      artists: {
        Row: {
          created_at: string
          currency_code: string
          headline: string | null
          hourly_rate: number | null
          id: string
          instagram_handle: string | null
          is_accepting: boolean
          is_guest_artist: boolean
          min_charge: number | null
          rating_avg: number
          rating_count: number
          updated_at: string
          verified_at: string | null
          years_experience: number | null
        }
        Insert: {
          created_at?: string
          currency_code?: string
          headline?: string | null
          hourly_rate?: number | null
          id: string
          instagram_handle?: string | null
          is_accepting?: boolean
          is_guest_artist?: boolean
          min_charge?: number | null
          rating_avg?: number
          rating_count?: number
          updated_at?: string
          verified_at?: string | null
          years_experience?: number | null
        }
        Update: {
          created_at?: string
          currency_code?: string
          headline?: string | null
          hourly_rate?: number | null
          id?: string
          instagram_handle?: string | null
          is_accepting?: boolean
          is_guest_artist?: boolean
          min_charge?: number | null
          rating_avg?: number
          rating_count?: number
          updated_at?: string
          verified_at?: string | null
          years_experience?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "artists_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          after: Json | null
          before: Json | null
          correlation_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          metadata: Json
        }
        Insert: {
          action: string
          actor_id?: string | null
          after?: Json | null
          before?: Json | null
          correlation_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          metadata?: Json
        }
        Update: {
          action?: string
          actor_id?: string | null
          after?: Json | null
          before?: Json | null
          correlation_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          metadata?: Json
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      boards: {
        Row: {
          cover_path: string | null
          created_at: string
          id: string
          is_private: boolean
          name: string
          profile_id: string
          updated_at: string
        }
        Insert: {
          cover_path?: string | null
          created_at?: string
          id?: string
          is_private?: boolean
          name: string
          profile_id: string
          updated_at?: string
        }
        Update: {
          cover_path?: string | null
          created_at?: string
          id?: string
          is_private?: boolean
          name?: string
          profile_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "boards_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_participants: {
        Row: {
          conversation_id: string
          is_archived: boolean
          is_muted: boolean
          joined_at: string
          last_read_at: string | null
          profile_id: string
        }
        Insert: {
          conversation_id: string
          is_archived?: boolean
          is_muted?: boolean
          joined_at?: string
          last_read_at?: string | null
          profile_id: string
        }
        Update: {
          conversation_id?: string
          is_archived?: boolean
          is_muted?: boolean
          joined_at?: string
          last_read_at?: string | null
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_participants_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_participants_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          last_message_at: string | null
          last_message_preview: string | null
          studio_id: string | null
          type: Database["public"]["Enums"]["conversation_type"]
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          last_message_at?: string | null
          last_message_preview?: string | null
          studio_id?: string | null
          type?: Database["public"]["Enums"]["conversation_type"]
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          last_message_at?: string | null
          last_message_preview?: string | null
          studio_id?: string | null
          type?: Database["public"]["Enums"]["conversation_type"]
        }
        Relationships: [
          {
            foreignKeyName: "conversations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_studio_id_fkey"
            columns: ["studio_id"]
            isOneToOne: false
            referencedRelation: "studios"
            referencedColumns: ["id"]
          },
        ]
      }
      device_tokens: {
        Row: {
          created_at: string
          disabled_at: string | null
          fcm_token: string
          id: string
          last_seen_at: string
          platform: Database["public"]["Enums"]["device_platform"]
          profile_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          disabled_at?: string | null
          fcm_token: string
          id?: string
          last_seen_at?: string
          platform: Database["public"]["Enums"]["device_platform"]
          profile_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          disabled_at?: string | null
          fcm_token?: string
          id?: string
          last_seen_at?: string
          platform?: Database["public"]["Enums"]["device_platform"]
          profile_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "device_tokens_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      favorites: {
        Row: {
          board_id: string | null
          created_at: string
          id: string
          profile_id: string
          target_id: string
          target_type: Database["public"]["Enums"]["favorite_target"]
        }
        Insert: {
          board_id?: string | null
          created_at?: string
          id?: string
          profile_id: string
          target_id: string
          target_type: Database["public"]["Enums"]["favorite_target"]
        }
        Update: {
          board_id?: string | null
          created_at?: string
          id?: string
          profile_id?: string
          target_id?: string
          target_type?: Database["public"]["Enums"]["favorite_target"]
        }
        Relationships: [
          {
            foreignKeyName: "favorites_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "boards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "favorites_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      idea_styles: {
        Row: {
          idea_id: string
          style_id: string
        }
        Insert: {
          idea_id: string
          style_id: string
        }
        Update: {
          idea_id?: string
          style_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "idea_styles_idea_id_fkey"
            columns: ["idea_id"]
            isOneToOne: false
            referencedRelation: "tattoo_ideas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "idea_styles_style_id_fkey"
            columns: ["style_id"]
            isOneToOne: false
            referencedRelation: "tattoo_styles"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          attachments: Json
          body: string | null
          conversation_id: string
          created_at: string
          deleted_at: string | null
          edited_at: string | null
          id: string
          metadata: Json
          request_id: string | null
          sender_id: string | null
          type: Database["public"]["Enums"]["message_type"]
        }
        Insert: {
          attachments?: Json
          body?: string | null
          conversation_id: string
          created_at?: string
          deleted_at?: string | null
          edited_at?: string | null
          id?: string
          metadata?: Json
          request_id?: string | null
          sender_id?: string | null
          type?: Database["public"]["Enums"]["message_type"]
        }
        Update: {
          attachments?: Json
          body?: string | null
          conversation_id?: string
          created_at?: string
          deleted_at?: string | null
          edited_at?: string | null
          id?: string
          metadata?: Json
          request_id?: string | null
          sender_id?: string | null
          type?: Database["public"]["Enums"]["message_type"]
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_request_fk"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "appointment_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      journey_milestones: {
        Row: {
          appointment_id: string
          completed_at: string | null
          created_at: string
          due_at: string
          id: string
          kind: string
          photo_path: string | null
          profile_id: string
          reminded_at: string | null
        }
        Insert: {
          appointment_id: string
          completed_at?: string | null
          created_at?: string
          due_at: string
          id?: string
          kind: string
          photo_path?: string | null
          profile_id: string
          reminded_at?: string | null
        }
        Update: {
          appointment_id?: string
          completed_at?: string | null
          created_at?: string
          due_at?: string
          id?: string
          kind?: string
          photo_path?: string | null
          profile_id?: string
          reminded_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "journey_milestones_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journey_milestones_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          channels: Json
          profile_id: string
          quiet_hours_end: string | null
          quiet_hours_start: string | null
          timezone: string
          updated_at: string
        }
        Insert: {
          channels?: Json
          profile_id: string
          quiet_hours_end?: string | null
          quiet_hours_start?: string | null
          timezone?: string
          updated_at?: string
        }
        Update: {
          channels?: Json
          profile_id?: string
          quiet_hours_end?: string | null
          quiet_hours_start?: string | null
          timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_preferences_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          data: Json
          entity_id: string | null
          entity_type: string | null
          id: string
          read_at: string | null
          recipient_id: string
          title: string
          type: Database["public"]["Enums"]["notification_type"]
        }
        Insert: {
          body?: string | null
          created_at?: string
          data?: Json
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          read_at?: string | null
          recipient_id: string
          title: string
          type: Database["public"]["Enums"]["notification_type"]
        }
        Update: {
          body?: string | null
          created_at?: string
          data?: Json
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          read_at?: string | null
          recipient_id?: string
          title?: string
          type?: Database["public"]["Enums"]["notification_type"]
        }
        Relationships: [
          {
            foreignKeyName: "notifications_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      offers: {
        Row: {
          artist_id: string
          created_at: string
          currency_code: string
          deposit_amount: number | null
          expires_at: string | null
          id: string
          message: string | null
          price_amount: number
          proposed_end: string | null
          proposed_start: string | null
          request_id: string
          status: Database["public"]["Enums"]["offer_status"]
          updated_at: string
        }
        Insert: {
          artist_id: string
          created_at?: string
          currency_code?: string
          deposit_amount?: number | null
          expires_at?: string | null
          id?: string
          message?: string | null
          price_amount: number
          proposed_end?: string | null
          proposed_start?: string | null
          request_id: string
          status?: Database["public"]["Enums"]["offer_status"]
          updated_at?: string
        }
        Update: {
          artist_id?: string
          created_at?: string
          currency_code?: string
          deposit_amount?: number | null
          expires_at?: string | null
          id?: string
          message?: string | null
          price_amount?: number
          proposed_end?: string | null
          proposed_start?: string | null
          request_id?: string
          status?: Database["public"]["Enums"]["offer_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "offers_artist_id_fkey"
            columns: ["artist_id"]
            isOneToOne: false
            referencedRelation: "artists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offers_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "appointment_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      portfolio_images: {
        Row: {
          artist_id: string
          caption: string | null
          created_at: string
          height: number | null
          id: string
          image_path: string
          kind: string
          moderation_status: Database["public"]["Enums"]["moderation_status"]
          placement: string | null
          portfolio_id: string
          sort_order: number
          width: number | null
        }
        Insert: {
          artist_id: string
          caption?: string | null
          created_at?: string
          height?: number | null
          id?: string
          image_path: string
          kind?: string
          moderation_status?: Database["public"]["Enums"]["moderation_status"]
          placement?: string | null
          portfolio_id: string
          sort_order?: number
          width?: number | null
        }
        Update: {
          artist_id?: string
          caption?: string | null
          created_at?: string
          height?: number | null
          id?: string
          image_path?: string
          kind?: string
          moderation_status?: Database["public"]["Enums"]["moderation_status"]
          placement?: string | null
          portfolio_id?: string
          sort_order?: number
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "portfolio_images_artist_id_fkey"
            columns: ["artist_id"]
            isOneToOne: false
            referencedRelation: "artists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portfolio_images_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "portfolios"
            referencedColumns: ["id"]
          },
        ]
      }
      portfolios: {
        Row: {
          artist_id: string
          created_at: string
          description: string | null
          id: string
          is_default: boolean
          sort_order: number
          title: string
          updated_at: string
        }
        Insert: {
          artist_id: string
          created_at?: string
          description?: string | null
          id?: string
          is_default?: boolean
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Update: {
          artist_id?: string
          created_at?: string
          description?: string | null
          id?: string
          is_default?: boolean
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "portfolios_artist_id_fkey"
            columns: ["artist_id"]
            isOneToOne: false
            referencedRelation: "artists"
            referencedColumns: ["id"]
          },
        ]
      }
      price_estimations: {
        Row: {
          amount_max: number
          amount_min: number
          approx_size: string | null
          artist_id: string
          client_id: string | null
          complexity: string | null
          created_at: string
          currency_code: string
          est_hours: number | null
          id: string
          idea_id: string | null
          notes: string | null
          placement: string | null
          request_id: string | null
          status: Database["public"]["Enums"]["estimation_status"]
        }
        Insert: {
          amount_max: number
          amount_min: number
          approx_size?: string | null
          artist_id: string
          client_id?: string | null
          complexity?: string | null
          created_at?: string
          currency_code?: string
          est_hours?: number | null
          id?: string
          idea_id?: string | null
          notes?: string | null
          placement?: string | null
          request_id?: string | null
          status?: Database["public"]["Enums"]["estimation_status"]
        }
        Update: {
          amount_max?: number
          amount_min?: number
          approx_size?: string | null
          artist_id?: string
          client_id?: string | null
          complexity?: string | null
          created_at?: string
          currency_code?: string
          est_hours?: number | null
          id?: string
          idea_id?: string | null
          notes?: string | null
          placement?: string | null
          request_id?: string | null
          status?: Database["public"]["Enums"]["estimation_status"]
        }
        Relationships: [
          {
            foreignKeyName: "price_estimations_artist_id_fkey"
            columns: ["artist_id"]
            isOneToOne: false
            referencedRelation: "artists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_estimations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_estimations_idea_id_fkey"
            columns: ["idea_id"]
            isOneToOne: false
            referencedRelation: "tattoo_ideas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_estimations_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "appointment_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_path: string | null
          bio: string | null
          city: string | null
          created_at: string
          deleted_at: string | null
          display_name: string
          id: string
          is_active: boolean
          onboarded_at: string | null
          pronouns: string | null
          search_radius_km: number
          updated_at: string
          username: string | null
        }
        Insert: {
          avatar_path?: string | null
          bio?: string | null
          city?: string | null
          created_at?: string
          deleted_at?: string | null
          display_name: string
          id: string
          is_active?: boolean
          onboarded_at?: string | null
          pronouns?: string | null
          search_radius_km?: number
          updated_at?: string
          username?: string | null
        }
        Update: {
          avatar_path?: string | null
          bio?: string | null
          city?: string | null
          created_at?: string
          deleted_at?: string | null
          display_name?: string
          id?: string
          is_active?: boolean
          onboarded_at?: string | null
          pronouns?: string | null
          search_radius_km?: number
          updated_at?: string
          username?: string | null
        }
        Relationships: []
      }
      profiles_private: {
        Row: {
          birthdate: string | null
          id: string
          latitude: number | null
          longitude: number | null
          updated_at: string
        }
        Insert: {
          birthdate?: string | null
          id: string
          latitude?: number | null
          longitude?: number | null
          updated_at?: string
        }
        Update: {
          birthdate?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_private_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      promotions: {
        Row: {
          created_at: string
          cta_label: string | null
          cta_route: string | null
          ends_at: string | null
          id: string
          image_path: string | null
          is_active: boolean
          sort_order: number
          starts_at: string | null
          subtitle: string | null
          title: string
        }
        Insert: {
          created_at?: string
          cta_label?: string | null
          cta_route?: string | null
          ends_at?: string | null
          id?: string
          image_path?: string | null
          is_active?: boolean
          sort_order?: number
          starts_at?: string | null
          subtitle?: string | null
          title: string
        }
        Update: {
          created_at?: string
          cta_label?: string | null
          cta_route?: string | null
          ends_at?: string | null
          id?: string
          image_path?: string | null
          is_active?: boolean
          sort_order?: number
          starts_at?: string | null
          subtitle?: string | null
          title?: string
        }
        Relationships: []
      }
      ratings: {
        Row: {
          dimension: string
          id: string
          review_id: string
          score: number
        }
        Insert: {
          dimension: string
          id?: string
          review_id: string
          score: number
        }
        Update: {
          dimension?: string
          id?: string
          review_id?: string
          score?: number
        }
        Relationships: [
          {
            foreignKeyName: "ratings_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_codes: {
        Row: {
          code: string
          created_at: string
          profile_id: string
        }
        Insert: {
          code: string
          created_at?: string
          profile_id: string
        }
        Update: {
          code?: string
          created_at?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "referral_codes_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      referrals: {
        Row: {
          code: string
          created_at: string
          id: string
          referred_id: string
          referrer_id: string
          rewarded: boolean
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          referred_id: string
          referrer_id: string
          rewarded?: boolean
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          referred_id?: string
          referrer_id?: string
          rewarded?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "referrals_referred_id_fkey"
            columns: ["referred_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referrals_referrer_id_fkey"
            columns: ["referrer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          appointment_id: string
          artist_id: string
          author_id: string
          body: string | null
          created_at: string
          id: string
          is_published: boolean
          overall_rating: number
          photo_paths: string[]
          studio_id: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          appointment_id: string
          artist_id: string
          author_id: string
          body?: string | null
          created_at?: string
          id?: string
          is_published?: boolean
          overall_rating: number
          photo_paths?: string[]
          studio_id?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          appointment_id?: string
          artist_id?: string
          author_id?: string
          body?: string | null
          created_at?: string
          id?: string
          is_published?: boolean
          overall_rating?: number
          photo_paths?: string[]
          studio_id?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: true
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_artist_id_fkey"
            columns: ["artist_id"]
            isOneToOne: false
            referencedRelation: "artists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_studio_id_fkey"
            columns: ["studio_id"]
            isOneToOne: false
            referencedRelation: "studios"
            referencedColumns: ["id"]
          },
        ]
      }
      reward_points: {
        Row: {
          balance: number
          lifetime_earned: number
          lifetime_redeemed: number
          profile_id: string
          tier: Database["public"]["Enums"]["reward_tier"]
          tier_updated_at: string
          updated_at: string
        }
        Insert: {
          balance?: number
          lifetime_earned?: number
          lifetime_redeemed?: number
          profile_id: string
          tier?: Database["public"]["Enums"]["reward_tier"]
          tier_updated_at?: string
          updated_at?: string
        }
        Update: {
          balance?: number
          lifetime_earned?: number
          lifetime_redeemed?: number
          profile_id?: string
          tier?: Database["public"]["Enums"]["reward_tier"]
          tier_updated_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reward_points_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reward_transactions: {
        Row: {
          amount: number
          balance_after: number
          created_at: string
          id: string
          idempotency_key: string | null
          profile_id: string
          reason: Database["public"]["Enums"]["reward_reason"]
          reference_id: string | null
          reference_type: string | null
          type: Database["public"]["Enums"]["reward_txn_type"]
        }
        Insert: {
          amount: number
          balance_after: number
          created_at?: string
          id?: string
          idempotency_key?: string | null
          profile_id: string
          reason: Database["public"]["Enums"]["reward_reason"]
          reference_id?: string | null
          reference_type?: string | null
          type: Database["public"]["Enums"]["reward_txn_type"]
        }
        Update: {
          amount?: number
          balance_after?: number
          created_at?: string
          id?: string
          idempotency_key?: string | null
          profile_id?: string
          reason?: Database["public"]["Enums"]["reward_reason"]
          reference_id?: string | null
          reference_type?: string | null
          type?: Database["public"]["Enums"]["reward_txn_type"]
        }
        Relationships: [
          {
            foreignKeyName: "reward_transactions_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      role_grants: {
        Row: {
          granted_at: string
          profile_id: string
          role: Database["public"]["Enums"]["user_role"]
        }
        Insert: {
          granted_at?: string
          profile_id: string
          role: Database["public"]["Enums"]["user_role"]
        }
        Update: {
          granted_at?: string
          profile_id?: string
          role?: Database["public"]["Enums"]["user_role"]
        }
        Relationships: [
          {
            foreignKeyName: "role_grants_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_designs: {
        Row: {
          ai_preview_id: string | null
          created_at: string
          id: string
          image_path: string
          notes: string | null
          placement: string | null
          profile_id: string
          source_idea_id: string | null
          style_id: string | null
          title: string | null
        }
        Insert: {
          ai_preview_id?: string | null
          created_at?: string
          id?: string
          image_path: string
          notes?: string | null
          placement?: string | null
          profile_id: string
          source_idea_id?: string | null
          style_id?: string | null
          title?: string | null
        }
        Update: {
          ai_preview_id?: string | null
          created_at?: string
          id?: string
          image_path?: string
          notes?: string | null
          placement?: string | null
          profile_id?: string
          source_idea_id?: string | null
          style_id?: string | null
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "saved_designs_ai_preview_fk"
            columns: ["ai_preview_id"]
            isOneToOne: false
            referencedRelation: "ai_previews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_designs_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_designs_source_idea_id_fkey"
            columns: ["source_idea_id"]
            isOneToOne: false
            referencedRelation: "tattoo_ideas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_designs_style_id_fkey"
            columns: ["style_id"]
            isOneToOne: false
            referencedRelation: "tattoo_styles"
            referencedColumns: ["id"]
          },
        ]
      }
      studio_memberships: {
        Row: {
          artist_id: string
          created_at: string
          invited_by: string | null
          joined_at: string | null
          role: Database["public"]["Enums"]["membership_role"]
          status: Database["public"]["Enums"]["membership_status"]
          studio_id: string
          updated_at: string
        }
        Insert: {
          artist_id: string
          created_at?: string
          invited_by?: string | null
          joined_at?: string | null
          role?: Database["public"]["Enums"]["membership_role"]
          status?: Database["public"]["Enums"]["membership_status"]
          studio_id: string
          updated_at?: string
        }
        Update: {
          artist_id?: string
          created_at?: string
          invited_by?: string | null
          joined_at?: string | null
          role?: Database["public"]["Enums"]["membership_role"]
          status?: Database["public"]["Enums"]["membership_status"]
          studio_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "studio_memberships_artist_id_fkey"
            columns: ["artist_id"]
            isOneToOne: false
            referencedRelation: "artists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "studio_memberships_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "studio_memberships_studio_id_fkey"
            columns: ["studio_id"]
            isOneToOne: false
            referencedRelation: "studios"
            referencedColumns: ["id"]
          },
        ]
      }
      studios: {
        Row: {
          address_line: string | null
          bio: string | null
          city: string | null
          country: string | null
          created_at: string
          email: string | null
          geo: unknown
          id: string
          is_active: boolean
          latitude: number
          logo_path: string | null
          longitude: number
          name: string
          opening_hours: Json
          owner_id: string
          phone: string | null
          slug: string
          updated_at: string
          website: string | null
        }
        Insert: {
          address_line?: string | null
          bio?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          geo?: unknown
          id?: string
          is_active?: boolean
          latitude: number
          logo_path?: string | null
          longitude: number
          name: string
          opening_hours?: Json
          owner_id: string
          phone?: string | null
          slug: string
          updated_at?: string
          website?: string | null
        }
        Update: {
          address_line?: string | null
          bio?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          geo?: unknown
          id?: string
          is_active?: boolean
          latitude?: number
          logo_path?: string | null
          longitude?: number
          name?: string
          opening_hours?: Json
          owner_id?: string
          phone?: string | null
          slug?: string
          updated_at?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "studios_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tattoo_ideas: {
        Row: {
          created_at: string
          created_by: string
          deleted_at: string | null
          description: string | null
          height: number | null
          id: string
          image_path: string
          is_public: boolean
          moderation_status: Database["public"]["Enums"]["moderation_status"]
          save_count: number
          search_tsv: unknown
          source_artist_id: string | null
          title: string | null
          updated_at: string
          width: number | null
        }
        Insert: {
          created_at?: string
          created_by: string
          deleted_at?: string | null
          description?: string | null
          height?: number | null
          id?: string
          image_path: string
          is_public?: boolean
          moderation_status?: Database["public"]["Enums"]["moderation_status"]
          save_count?: number
          search_tsv?: unknown
          source_artist_id?: string | null
          title?: string | null
          updated_at?: string
          width?: number | null
        }
        Update: {
          created_at?: string
          created_by?: string
          deleted_at?: string | null
          description?: string | null
          height?: number | null
          id?: string
          image_path?: string
          is_public?: boolean
          moderation_status?: Database["public"]["Enums"]["moderation_status"]
          save_count?: number
          search_tsv?: unknown
          source_artist_id?: string | null
          title?: string | null
          updated_at?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "tattoo_ideas_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tattoo_ideas_source_artist_id_fkey"
            columns: ["source_artist_id"]
            isOneToOne: false
            referencedRelation: "artists"
            referencedColumns: ["id"]
          },
        ]
      }
      tattoo_journey_entries: {
        Row: {
          appointment_id: string | null
          artist_id: string | null
          created_at: string
          entry_type: Database["public"]["Enums"]["journey_entry_type"]
          id: string
          idea_id: string | null
          image_paths: string[]
          notes: string | null
          occurred_on: string
          profile_id: string
          title: string | null
        }
        Insert: {
          appointment_id?: string | null
          artist_id?: string | null
          created_at?: string
          entry_type: Database["public"]["Enums"]["journey_entry_type"]
          id?: string
          idea_id?: string | null
          image_paths?: string[]
          notes?: string | null
          occurred_on: string
          profile_id: string
          title?: string | null
        }
        Update: {
          appointment_id?: string | null
          artist_id?: string | null
          created_at?: string
          entry_type?: Database["public"]["Enums"]["journey_entry_type"]
          id?: string
          idea_id?: string | null
          image_paths?: string[]
          notes?: string | null
          occurred_on?: string
          profile_id?: string
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tattoo_journey_entries_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tattoo_journey_entries_artist_id_fkey"
            columns: ["artist_id"]
            isOneToOne: false
            referencedRelation: "artists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tattoo_journey_entries_idea_id_fkey"
            columns: ["idea_id"]
            isOneToOne: false
            referencedRelation: "tattoo_ideas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tattoo_journey_entries_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tattoo_styles: {
        Row: {
          description: string | null
          id: string
          image_path: string | null
          is_active: boolean
          name: string
          slug: string
          sort_order: number
        }
        Insert: {
          description?: string | null
          id?: string
          image_path?: string | null
          is_active?: boolean
          name: string
          slug: string
          sort_order?: number
        }
        Update: {
          description?: string | null
          id?: string
          image_path?: string | null
          is_active?: boolean
          name?: string
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      user_style_preferences: {
        Row: {
          profile_id: string
          style_id: string
          updated_at: string
          weight: number
        }
        Insert: {
          profile_id: string
          style_id: string
          updated_at?: string
          weight?: number
        }
        Update: {
          profile_id?: string
          style_id?: string
          updated_at?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "user_style_preferences_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_style_preferences_style_id_fkey"
            columns: ["style_id"]
            isOneToOne: false
            referencedRelation: "tattoo_styles"
            referencedColumns: ["id"]
          },
        ]
      }
      voucher_redemptions: {
        Row: {
          code: string
          cost_points: number
          created_at: string
          expires_at: string | null
          id: string
          idempotency_key: string | null
          profile_id: string
          status: string
          used_at: string | null
          voucher_id: string
        }
        Insert: {
          code: string
          cost_points: number
          created_at?: string
          expires_at?: string | null
          id?: string
          idempotency_key?: string | null
          profile_id: string
          status?: string
          used_at?: string | null
          voucher_id: string
        }
        Update: {
          code?: string
          cost_points?: number
          created_at?: string
          expires_at?: string | null
          id?: string
          idempotency_key?: string | null
          profile_id?: string
          status?: string
          used_at?: string | null
          voucher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "voucher_redemptions_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voucher_redemptions_voucher_id_fkey"
            columns: ["voucher_id"]
            isOneToOne: false
            referencedRelation: "vouchers"
            referencedColumns: ["id"]
          },
        ]
      }
      vouchers: {
        Row: {
          cost_points: number
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          kind: string
          sort_order: number
          stock: number | null
          title: string
          value_text: string | null
        }
        Insert: {
          cost_points: number
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          kind?: string
          sort_order?: number
          stock?: number | null
          title: string
          value_text?: string | null
        }
        Update: {
          cost_points?: number
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          kind?: string
          sort_order?: number
          stock?: number | null
          title?: string
          value_text?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      apply_reward_transaction: {
        Args: {
          p_amount: number
          p_idempotency_key?: string
          p_profile_id: string
          p_reason: Database["public"]["Enums"]["reward_reason"]
          p_reference_id?: string
          p_reference_type?: string
          p_type: Database["public"]["Enums"]["reward_txn_type"]
        }
        Returns: {
          amount: number
          balance_after: number
          created_at: string
          id: string
          idempotency_key: string | null
          profile_id: string
          reason: Database["public"]["Enums"]["reward_reason"]
          reference_id: string | null
          reference_type: string | null
          type: Database["public"]["Enums"]["reward_txn_type"]
        }
        SetofOptions: {
          from: "*"
          to: "reward_transactions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      artist_day_slots: {
        Args: { p_artist: string; p_date: string; p_slot_minutes?: number }
        Returns: string[]
      }
      award_daily_active: {
        Args: never
        Returns: {
          amount: number
          balance_after: number
          created_at: string
          id: string
          idempotency_key: string | null
          profile_id: string
          reason: Database["public"]["Enums"]["reward_reason"]
          reference_id: string | null
          reference_type: string | null
          type: Database["public"]["Enums"]["reward_txn_type"]
        }
        SetofOptions: {
          from: "*"
          to: "reward_transactions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      award_points: {
        Args: {
          p_amount: number
          p_idem: string
          p_profile: string
          p_reason: Database["public"]["Enums"]["reward_reason"]
          p_ref_id: string
          p_ref_type: string
        }
        Returns: {
          amount: number
          balance_after: number
          created_at: string
          id: string
          idempotency_key: string | null
          profile_id: string
          reason: Database["public"]["Enums"]["reward_reason"]
          reference_id: string | null
          reference_type: string | null
          type: Database["public"]["Enums"]["reward_txn_type"]
        }
        SetofOptions: {
          from: "*"
          to: "reward_transactions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      claim_profile_completion: { Args: never; Returns: Json }
      custom_access_token_hook: { Args: { event: Json }; Returns: Json }
      get_referral_code: { Args: never; Returns: string }
      has_role: {
        Args: { r: Database["public"]["Enums"]["user_role"] }
        Returns: boolean
      }
      is_conversation_participant: { Args: { c_id: string }; Returns: boolean }
      is_studio_admin: { Args: { s_id: string }; Returns: boolean }
      nearby_studios: {
        Args: { p_lat: number; p_limit?: number; p_lng: number }
        Returns: {
          city: string
          distance_km: number
          id: string
          logo_path: string
          name: string
          slug: string
        }[]
      }
      push_notification: {
        Args: {
          p_body: string
          p_data?: Json
          p_entity_id: string
          p_entity_type: string
          p_recipient: string
          p_title: string
          p_type: Database["public"]["Enums"]["notification_type"]
        }
        Returns: undefined
      }
      recommended_artists: {
        Args: { p_limit?: number; p_style_slugs: string[] }
        Returns: {
          avatar_path: string
          display_name: string
          headline: string
          id: string
          match_count: number
          rating_avg: number
          rating_count: number
          styles: string[]
        }[]
      }
      recompute_artist_rating: {
        Args: { p_artist_id: string }
        Returns: undefined
      }
      recompute_idea_save_count: {
        Args: { p_idea_id: string }
        Returns: undefined
      }
      redeem_referral: { Args: { p_code: string }; Returns: undefined }
      redeem_voucher: {
        Args: { p_idempotency_key?: string; p_voucher: string }
        Returns: {
          code: string
          cost_points: number
          created_at: string
          expires_at: string | null
          id: string
          idempotency_key: string | null
          profile_id: string
          status: string
          used_at: string | null
          voucher_id: string
        }
        SetofOptions: {
          from: "*"
          to: "voucher_redemptions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      respond_offer: {
        Args: { p_accept: boolean; p_offer_id: string }
        Returns: string
      }
      artist_stats: {
        Args: { p_artist_id?: string }
        Returns: { saved_by: number; design_saves: number }[]
      }
      apply_to_studio: {
        Args: { p_studio_id: string }
        Returns: string
      }
      complete_journey_milestone: {
        Args: { p_appointment_id: string; p_kind: string; p_photo_path: string }
        Returns: undefined
      }
      delete_conversation: {
        Args: { p_conversation_id: string }
        Returns: undefined
      }
      public_seeker_profile: {
        Args: { p_profile_id: string }
        Returns: {
          id: string
          display_name: string
          username: string | null
          avatar_path: string | null
          city: string | null
          member_since: string
          bookings_count: number
          reviews_count: number
        }[]
      }
      withdraw_studio_application: {
        Args: { p_studio_id: string }
        Returns: undefined
      }
      respond_studio_application: {
        Args: { p_studio_id: string; p_artist_id: string; p_accept: boolean }
        Returns: string
      }
      search_artists: {
        Args: {
          p_accepting_only?: boolean
          p_after_id?: string
          p_after_rating?: number
          p_lat?: number
          p_limit?: number
          p_lng?: number
          p_min_rating?: number
          p_offset?: number
          p_q?: string
          p_radius_km?: number
          p_sort?: string
          p_style_slugs?: string[]
        }
        Returns: {
          avatar_path: string
          city: string
          display_name: string
          distance_km: number
          headline: string
          id: string
          is_accepting: boolean
          rating_avg: number
          rating_count: number
          relevance: number
          styles: string[]
        }[]
      }
      search_studios: {
        Args: {
          p_lat?: number
          p_limit?: number
          p_lng?: number
          p_min_rating?: number
          p_offset?: number
          p_q?: string
          p_radius_km?: number
          p_sort?: string
          p_style_slugs?: string[]
        }
        Returns: {
          artist_count: number
          city: string
          distance_km: number
          id: string
          logo_path: string
          name: string
          rating_avg: number
          rating_count: number
          relevance: number
          slug: string
          styles: string[]
        }[]
      }
      start_direct_conversation: { Args: { p_other: string }; Returns: string }
      start_studio_conversation: { Args: { p_studio: string }; Returns: string }
    }
    Enums: {
      ai_preview_status:
        | "draft"
        | "queued"
        | "processing"
        | "completed"
        | "failed"
      appointment_status:
        | "scheduled"
        | "rescheduled"
        | "completed"
        | "cancelled"
        | "no_show"
      conversation_type: "direct" | "support"
      device_platform: "ios" | "android" | "web"
      estimation_status: "draft" | "sent" | "accepted" | "expired"
      favorite_target: "idea" | "artist" | "studio" | "portfolio_image"
      journey_entry_type:
        | "idea"
        | "consultation"
        | "appointment"
        | "healing"
        | "milestone"
        | "completed"
      membership_role: "owner" | "manager" | "artist"
      membership_status: "invited" | "active" | "suspended" | "removed"
      message_type: "text" | "image" | "system" | "booking_card"
      moderation_status: "pending" | "approved" | "rejected"
      notification_type:
        | "message"
        | "booking_request"
        | "booking_update"
        | "offer"
        | "review"
        | "reward"
        | "follow"
        | "system"
      offer_status:
        | "pending"
        | "accepted"
        | "declined"
        | "withdrawn"
        | "expired"
      request_status:
        | "pending"
        | "reviewing"
        | "offered"
        | "accepted"
        | "declined"
        | "expired"
        | "cancelled"
        | "converted"
      reward_reason:
        | "signup"
        | "daily_active"
        | "save"
        | "message_sent"
        | "booking_completed"
        | "review_left"
        | "referral"
        | "redemption"
        | "manual_adjust"
      reward_tier: "bronze" | "silver" | "gold" | "platinum"
      reward_txn_type: "earn" | "redeem" | "adjust" | "expire" | "refund"
      user_role: "seeker" | "artist" | "studio_admin" | "moderator"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  storage: {
    Tables: {
      buckets: {
        Row: {
          allowed_mime_types: string[] | null
          avif_autodetection: boolean | null
          created_at: string | null
          file_size_limit: number | null
          id: string
          name: string
          owner: string | null
          owner_id: string | null
          public: boolean | null
          type: Database["storage"]["Enums"]["buckettype"]
          updated_at: string | null
        }
        Insert: {
          allowed_mime_types?: string[] | null
          avif_autodetection?: boolean | null
          created_at?: string | null
          file_size_limit?: number | null
          id: string
          name: string
          owner?: string | null
          owner_id?: string | null
          public?: boolean | null
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string | null
        }
        Update: {
          allowed_mime_types?: string[] | null
          avif_autodetection?: boolean | null
          created_at?: string | null
          file_size_limit?: number | null
          id?: string
          name?: string
          owner?: string | null
          owner_id?: string | null
          public?: boolean | null
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string | null
        }
        Relationships: []
      }
      buckets_analytics: {
        Row: {
          created_at: string
          deleted_at: string | null
          format: string
          id: string
          name: string
          type: Database["storage"]["Enums"]["buckettype"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          format?: string
          id?: string
          name: string
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          format?: string
          id?: string
          name?: string
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string
        }
        Relationships: []
      }
      buckets_vectors: {
        Row: {
          created_at: string
          id: string
          type: Database["storage"]["Enums"]["buckettype"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id: string
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string
        }
        Relationships: []
      }
      migrations: {
        Row: {
          executed_at: string | null
          hash: string
          id: number
          name: string
        }
        Insert: {
          executed_at?: string | null
          hash: string
          id: number
          name: string
        }
        Update: {
          executed_at?: string | null
          hash?: string
          id?: number
          name?: string
        }
        Relationships: []
      }
      objects: {
        Row: {
          bucket_id: string | null
          created_at: string | null
          id: string
          last_accessed_at: string | null
          metadata: Json | null
          name: string | null
          owner: string | null
          owner_id: string | null
          path_tokens: string[] | null
          updated_at: string | null
          user_metadata: Json | null
          version: string | null
        }
        Insert: {
          bucket_id?: string | null
          created_at?: string | null
          id?: string
          last_accessed_at?: string | null
          metadata?: Json | null
          name?: string | null
          owner?: string | null
          owner_id?: string | null
          path_tokens?: string[] | null
          updated_at?: string | null
          user_metadata?: Json | null
          version?: string | null
        }
        Update: {
          bucket_id?: string | null
          created_at?: string | null
          id?: string
          last_accessed_at?: string | null
          metadata?: Json | null
          name?: string | null
          owner?: string | null
          owner_id?: string | null
          path_tokens?: string[] | null
          updated_at?: string | null
          user_metadata?: Json | null
          version?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "objects_bucketId_fkey"
            columns: ["bucket_id"]
            isOneToOne: false
            referencedRelation: "buckets"
            referencedColumns: ["id"]
          },
        ]
      }
      s3_multipart_uploads: {
        Row: {
          bucket_id: string
          created_at: string
          id: string
          in_progress_size: number
          key: string
          metadata: Json | null
          owner_id: string | null
          upload_signature: string
          user_metadata: Json | null
          version: string
        }
        Insert: {
          bucket_id: string
          created_at?: string
          id: string
          in_progress_size?: number
          key: string
          metadata?: Json | null
          owner_id?: string | null
          upload_signature: string
          user_metadata?: Json | null
          version: string
        }
        Update: {
          bucket_id?: string
          created_at?: string
          id?: string
          in_progress_size?: number
          key?: string
          metadata?: Json | null
          owner_id?: string | null
          upload_signature?: string
          user_metadata?: Json | null
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "s3_multipart_uploads_bucket_id_fkey"
            columns: ["bucket_id"]
            isOneToOne: false
            referencedRelation: "buckets"
            referencedColumns: ["id"]
          },
        ]
      }
      s3_multipart_uploads_parts: {
        Row: {
          bucket_id: string
          created_at: string
          etag: string
          id: string
          key: string
          owner_id: string | null
          part_number: number
          size: number
          upload_id: string
          version: string
        }
        Insert: {
          bucket_id: string
          created_at?: string
          etag: string
          id?: string
          key: string
          owner_id?: string | null
          part_number: number
          size?: number
          upload_id: string
          version: string
        }
        Update: {
          bucket_id?: string
          created_at?: string
          etag?: string
          id?: string
          key?: string
          owner_id?: string | null
          part_number?: number
          size?: number
          upload_id?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "s3_multipart_uploads_parts_bucket_id_fkey"
            columns: ["bucket_id"]
            isOneToOne: false
            referencedRelation: "buckets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "s3_multipart_uploads_parts_upload_id_fkey"
            columns: ["upload_id"]
            isOneToOne: false
            referencedRelation: "s3_multipart_uploads"
            referencedColumns: ["id"]
          },
        ]
      }
      vector_indexes: {
        Row: {
          bucket_id: string
          created_at: string
          data_type: string
          dimension: number
          distance_metric: string
          id: string
          metadata_configuration: Json | null
          name: string
          updated_at: string
        }
        Insert: {
          bucket_id: string
          created_at?: string
          data_type: string
          dimension: number
          distance_metric: string
          id?: string
          metadata_configuration?: Json | null
          name: string
          updated_at?: string
        }
        Update: {
          bucket_id?: string
          created_at?: string
          data_type?: string
          dimension?: number
          distance_metric?: string
          id?: string
          metadata_configuration?: Json | null
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "vector_indexes_bucket_id_fkey"
            columns: ["bucket_id"]
            isOneToOne: false
            referencedRelation: "buckets_vectors"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      allow_any_operation: {
        Args: { expected_operations: string[] }
        Returns: boolean
      }
      allow_only_operation: {
        Args: { expected_operation: string }
        Returns: boolean
      }
      can_insert_object: {
        Args: { bucketid: string; metadata: Json; name: string; owner: string }
        Returns: undefined
      }
      extension: { Args: { name: string }; Returns: string }
      filename: { Args: { name: string }; Returns: string }
      foldername: { Args: { name: string }; Returns: string[] }
      get_common_prefix: {
        Args: { p_delimiter: string; p_key: string; p_prefix: string }
        Returns: string
      }
      get_size_by_bucket: {
        Args: never
        Returns: {
          bucket_id: string
          size: number
        }[]
      }
      list_multipart_uploads_with_delimiter: {
        Args: {
          bucket_id: string
          delimiter_param: string
          max_keys?: number
          next_key_token?: string
          next_upload_token?: string
          prefix_param: string
        }
        Returns: {
          created_at: string
          id: string
          key: string
        }[]
      }
      list_objects_with_delimiter: {
        Args: {
          _bucket_id: string
          delimiter_param: string
          max_keys?: number
          next_token?: string
          prefix_param: string
          sort_order?: string
          start_after?: string
        }
        Returns: {
          created_at: string
          id: string
          last_accessed_at: string
          metadata: Json
          name: string
          updated_at: string
        }[]
      }
      operation: { Args: never; Returns: string }
      search: {
        Args: {
          bucketname: string
          levels?: number
          limits?: number
          offsets?: number
          prefix: string
          search?: string
          sortcolumn?: string
          sortorder?: string
        }
        Returns: {
          created_at: string
          id: string
          last_accessed_at: string
          metadata: Json
          name: string
          updated_at: string
        }[]
      }
      search_by_timestamp: {
        Args: {
          p_bucket_id: string
          p_level: number
          p_limit: number
          p_prefix: string
          p_sort_column: string
          p_sort_column_after: string
          p_sort_order: string
          p_start_after: string
        }
        Returns: {
          created_at: string
          id: string
          key: string
          last_accessed_at: string
          metadata: Json
          name: string
          updated_at: string
        }[]
      }
      search_v2: {
        Args: {
          bucket_name: string
          levels?: number
          limits?: number
          prefix: string
          sort_column?: string
          sort_column_after?: string
          sort_order?: string
          start_after?: string
        }
        Returns: {
          created_at: string
          id: string
          key: string
          last_accessed_at: string
          metadata: Json
          name: string
          updated_at: string
        }[]
      }
    }
    Enums: {
      buckettype: "STANDARD" | "ANALYTICS" | "VECTOR"
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
      ai_preview_status: [
        "draft",
        "queued",
        "processing",
        "completed",
        "failed",
      ],
      appointment_status: [
        "scheduled",
        "rescheduled",
        "completed",
        "cancelled",
        "no_show",
      ],
      conversation_type: ["direct", "support"],
      device_platform: ["ios", "android", "web"],
      estimation_status: ["draft", "sent", "accepted", "expired"],
      favorite_target: ["idea", "artist", "studio", "portfolio_image"],
      journey_entry_type: [
        "idea",
        "consultation",
        "appointment",
        "healing",
        "milestone",
        "completed",
      ],
      membership_role: ["owner", "manager", "artist"],
      membership_status: ["invited", "active", "suspended", "removed"],
      message_type: ["text", "image", "system", "booking_card"],
      moderation_status: ["pending", "approved", "rejected"],
      notification_type: [
        "message",
        "booking_request",
        "booking_update",
        "offer",
        "review",
        "reward",
        "follow",
        "system",
      ],
      offer_status: ["pending", "accepted", "declined", "withdrawn", "expired"],
      request_status: [
        "pending",
        "reviewing",
        "offered",
        "accepted",
        "declined",
        "expired",
        "cancelled",
        "converted",
      ],
      reward_reason: [
        "signup",
        "daily_active",
        "save",
        "message_sent",
        "booking_completed",
        "review_left",
        "referral",
        "redemption",
        "manual_adjust",
      ],
      reward_tier: ["bronze", "silver", "gold", "platinum"],
      reward_txn_type: ["earn", "redeem", "adjust", "expire", "refund"],
      user_role: ["seeker", "artist", "studio_admin", "moderator"],
    },
  },
  storage: {
    Enums: {
      buckettype: ["STANDARD", "ANALYTICS", "VECTOR"],
    },
  },
} as const
