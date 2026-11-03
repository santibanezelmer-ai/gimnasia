/**
 * Supabase Database interface mapping.
 * Aligns with the PostgreSQL schema.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          full_name: string
          avatar_url: string | null
          platform_role: 'platform_admin' | 'platform_support' | 'none'
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          full_name?: string
          avatar_url?: string | null
          platform_role?: 'platform_admin' | 'platform_support' | 'none'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string
          avatar_url?: string | null
          platform_role?: 'platform_admin' | 'platform_support' | 'none'
          updated_at?: string
        }
        Relationships: []
      }
      organizations: {
        Row: {
          id: string
          slug: string
          name: string
          logo_url: string | null
          billing_plan: string
          subscription_status: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          slug: string
          name: string
          logo_url?: string | null
          billing_plan?: string
          subscription_status?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          slug?: string
          name?: string
          logo_url?: string | null
          billing_plan?: string
          subscription_status?: string
          updated_at?: string
        }
        Relationships: []
      }
      organization_members: {
        Row: {
          id: string
          organization_id: string
          user_id: string
          role: string
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          user_id: string
          role?: string
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          user_id?: string
          role?: string
          is_active?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      championships: {
        Row: {
          id: string
          organization_id: string
          name: string
          slug: string
          description: string | null
          start_date: string
          end_date: string
          location: string | null
          visibility: string
          status: string
          ruleset_version: string
          scoring_schema_version: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          name: string
          slug: string
          description?: string | null
          start_date: string
          end_date: string
          location?: string | null
          visibility?: string
          status?: string
          ruleset_version: string
          scoring_schema_version: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          name?: string
          slug?: string
          description?: string | null
          start_date?: string
          end_date?: string
          location?: string | null
          visibility?: string
          status?: string
          ruleset_version?: string
          scoring_schema_version?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "championships_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          }
        ]
      }
      score_audits: {
        Row: {
          id: string
          score_id: string
          organization_id: string
          modified_by_user_id: string
          reason: string
          previous_value: Json
          new_value: Json
          created_at: string
        }
        Insert: {
          id?: string
          score_id: string
          organization_id: string
          modified_by_user_id: string
          reason: string
          previous_value: Json
          new_value: Json
          created_at?: string
        }
        Update: {
          id?: string
          score_id?: string
          organization_id?: string
          modified_by_user_id?: string
          reason?: string
          previous_value?: Json
          new_value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "score_audits_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      platform_role: 'platform_admin' | 'platform_support' | 'none'
      organization_role:
        | 'org_admin'
        | 'competition_manager'
        | 'head_judge'
        | 'judge'
        | 'club_manager'
        | 'coach'
        | 'viewer'
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
