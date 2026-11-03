/**
 * Supabase Database interface mapping.
 * Aligns with the PostgreSQL schema including Phase 6 championships & technical setup.
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
          venue_name: string | null
          visibility: 'public' | 'private' | 'invitational'
          status: 'draft' | 'registration_open' | 'registration_closed' | 'in_progress' | 'completed' | 'archived'
          ruleset_version: string
          scoring_schema_version: string
          banner_url: string | null
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
          venue_name?: string | null
          visibility?: 'public' | 'private' | 'invitational'
          status?: 'draft' | 'registration_open' | 'registration_closed' | 'in_progress' | 'completed' | 'archived'
          ruleset_version?: string
          scoring_schema_version?: string
          banner_url?: string | null
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
          venue_name?: string | null
          visibility?: 'public' | 'private' | 'invitational'
          status?: 'draft' | 'registration_open' | 'registration_closed' | 'in_progress' | 'completed' | 'archived'
          ruleset_version?: string
          scoring_schema_version?: string
          banner_url?: string | null
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
      apparatuses: {
        Row: {
          id: string
          discipline: 'GAF' | 'GAM' | 'GR' | 'TRA' | 'AER' | 'ACRO'
          code: string
          name: string
          sort_order: number
          icon_name: string | null
        }
        Insert: {
          id?: string
          discipline: 'GAF' | 'GAM' | 'GR' | 'TRA' | 'AER' | 'ACRO'
          code: string
          name: string
          sort_order?: number
          icon_name?: string | null
        }
        Update: {
          id?: string
          discipline?: 'GAF' | 'GAM' | 'GR' | 'TRA' | 'AER' | 'ACRO'
          code?: string
          name?: string
          sort_order?: number
          icon_name?: string | null
        }
        Relationships: []
      }
      categories: {
        Row: {
          id: string
          championship_id: string
          discipline: 'GAF' | 'GAM' | 'GR' | 'TRA' | 'AER' | 'ACRO'
          name: string
          code: string
          gender: 'female' | 'male' | 'mixed'
          min_age: number | null
          max_age: number | null
          sort_order: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          championship_id: string
          discipline?: 'GAF' | 'GAM' | 'GR' | 'TRA' | 'AER' | 'ACRO'
          name: string
          code: string
          gender?: 'female' | 'male' | 'mixed'
          min_age?: number | null
          max_age?: number | null
          sort_order?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          championship_id?: string
          discipline?: 'GAF' | 'GAM' | 'GR' | 'TRA' | 'AER' | 'ACRO'
          name?: string
          code?: string
          gender?: 'female' | 'male' | 'mixed'
          min_age?: number | null
          max_age?: number | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_championship_id_fkey"
            columns: ["championship_id"]
            isOneToOne: false
            referencedRelation: "championships"
            referencedColumns: ["id"]
          }
        ]
      }
      subcategories: {
        Row: {
          id: string
          category_id: string
          name: string
          min_age: number | null
          max_age: number | null
          sort_order: number
          created_at: string
        }
        Insert: {
          id?: string
          category_id: string
          name: string
          min_age?: number | null
          max_age?: number | null
          sort_order?: number
          created_at?: string
        }
        Update: {
          id?: string
          category_id?: string
          name?: string
          min_age?: number | null
          max_age?: number | null
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "subcategories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          }
        ]
      }
      category_apparatuses: {
        Row: {
          id: string
          category_id: string
          apparatus_id: string
          sort_order: number
        }
        Insert: {
          id?: string
          category_id: string
          apparatus_id: string
          sort_order?: number
        }
        Update: {
          id?: string
          category_id?: string
          apparatus_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "category_apparatuses_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "category_apparatuses_apparatus_id_fkey"
            columns: ["apparatus_id"]
            isOneToOne: false
            referencedRelation: "apparatuses"
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
      championship_visibility: 'public' | 'private' | 'invitational'
      championship_status:
        | 'draft'
        | 'registration_open'
        | 'registration_closed'
        | 'in_progress'
        | 'completed'
        | 'archived'
      gymnastics_discipline_code: 'GAF' | 'GAM' | 'GR' | 'TRA' | 'AER' | 'ACRO'
      gender_category: 'female' | 'male' | 'mixed'
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
