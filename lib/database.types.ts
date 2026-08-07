export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      assignment_submissions: {
        Row: {
          assignment_id: string
          file_id: string
          grade: number | null
          grade_feedback: string | null
          graded_at: string | null
          graded_by: string | null
          id: string
          note: string | null
          student_id: string
          submitted_at: string
        }
        Insert: {
          assignment_id: string
          file_id: string
          grade?: number | null
          grade_feedback?: string | null
          graded_at?: string | null
          graded_by?: string | null
          id?: string
          note?: string | null
          student_id: string
          submitted_at?: string
        }
        Update: {
          assignment_id?: string
          file_id?: string
          grade?: number | null
          grade_feedback?: string | null
          graded_at?: string | null
          graded_by?: string | null
          id?: string
          note?: string | null
          student_id?: string
          submitted_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assignment_submissions_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignment_submissions_file_id_fkey"
            columns: ["file_id"]
            isOneToOne: false
            referencedRelation: "files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignment_submissions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      assignment_tags: {
        Row: {
          added_by: string
          assignment_id: string
          created_at: string
          tag_id: string
        }
        Insert: {
          added_by: string
          assignment_id: string
          created_at?: string
          tag_id: string
        }
        Update: {
          added_by?: string
          assignment_id?: string
          created_at?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assignment_tags_added_by_fkey"
            columns: ["added_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignment_tags_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignment_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      assignments: {
        Row: {
          allow_resubmission: boolean
          archived_at: string | null
          created_at: string
          created_by: string
          due_at: string | null
          id: string
          instructions_page_id: string | null
          title: string
        }
        Insert: {
          allow_resubmission?: boolean
          archived_at?: string | null
          created_at?: string
          created_by: string
          due_at?: string | null
          id?: string
          instructions_page_id?: string | null
          title: string
        }
        Update: {
          allow_resubmission?: boolean
          archived_at?: string | null
          created_at?: string
          created_by?: string
          due_at?: string | null
          id?: string
          instructions_page_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "assignments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignments_instructions_page_id_fkey"
            columns: ["instructions_page_id"]
            isOneToOne: false
            referencedRelation: "pages"
            referencedColumns: ["id"]
          },
        ]
      }
      guardian_links: {
        Row: {
          activated_at: string | null
          created_at: string
          created_by: string
          guardian_email: string
          guardian_profile_id: string | null
          id: string
          pupil_id: string
          reason: string
          revoked_at: string | null
        }
        Insert: {
          activated_at?: string | null
          created_at?: string
          created_by: string
          guardian_email: string
          guardian_profile_id?: string | null
          id?: string
          pupil_id: string
          reason: string
          revoked_at?: string | null
        }
        Update: {
          activated_at?: string | null
          created_at?: string
          created_by?: string
          guardian_email?: string
          guardian_profile_id?: string | null
          id?: string
          pupil_id?: string
          reason?: string
          revoked_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "guardian_links_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guardian_links_guardian_profile_id_fkey"
            columns: ["guardian_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guardian_links_pupil_id_fkey"
            columns: ["pupil_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      announcements: {
        Row: {
          archived_at: string | null
          body: string
          created_at: string
          created_by: string
          id: string
          is_broadcast: boolean
          title: string
        }
        Insert: {
          archived_at?: string | null
          body: string
          created_at?: string
          created_by: string
          id?: string
          is_broadcast?: boolean
          title: string
        }
        Update: {
          archived_at?: string | null
          body?: string
          created_at?: string
          created_by?: string
          id?: string
          is_broadcast?: boolean
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      announcement_tags: {
        Row: {
          added_by: string
          announcement_id: string
          created_at: string
          tag_id: string
        }
        Insert: {
          added_by: string
          announcement_id: string
          created_at?: string
          tag_id: string
        }
        Update: {
          added_by?: string
          announcement_id?: string
          created_at?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcement_tags_announcement_id_fkey"
            columns: ["announcement_id"]
            isOneToOne: false
            referencedRelation: "announcements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcement_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_events: {
        Row: {
          archived_at: string | null
          created_at: string
          created_by: string
          description: string | null
          ends_at: string | null
          id: string
          is_broadcast: boolean
          starts_at: string
          title: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          ends_at?: string | null
          id?: string
          is_broadcast?: boolean
          starts_at: string
          title: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          ends_at?: string | null
          id?: string
          is_broadcast?: boolean
          starts_at?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_event_tags: {
        Row: {
          added_by: string
          created_at: string
          event_id: string
          tag_id: string
        }
        Insert: {
          added_by: string
          created_at?: string
          event_id: string
          tag_id: string
        }
        Update: {
          added_by?: string
          created_at?: string
          event_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_event_tags_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "calendar_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_event_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      quizzes: {
        Row: {
          archived_at: string | null
          author_id: string
          created_at: string
          due_at: string | null
          id: string
          title: string
        }
        Insert: {
          archived_at?: string | null
          author_id: string
          created_at?: string
          due_at?: string | null
          id?: string
          title: string
        }
        Update: {
          archived_at?: string | null
          author_id?: string
          created_at?: string
          due_at?: string | null
          id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "quizzes_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_tags: {
        Row: {
          added_by: string
          created_at: string
          quiz_id: string
          tag_id: string
        }
        Insert: {
          added_by: string
          created_at?: string
          quiz_id: string
          tag_id: string
        }
        Update: {
          added_by?: string
          created_at?: string
          quiz_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_tags_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_questions: {
        Row: {
          choices: Json
          id: string
          position: number
          prompt: string
          quiz_id: string
          sourced_from_bank_item_id: string | null
        }
        Insert: {
          choices: Json
          id?: string
          position: number
          prompt: string
          quiz_id: string
          sourced_from_bank_item_id?: string | null
        }
        Update: {
          choices?: Json
          id?: string
          position?: number
          prompt?: string
          quiz_id?: string
          sourced_from_bank_item_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quiz_questions_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_questions_sourced_from_bank_item_id_fkey"
            columns: ["sourced_from_bank_item_id"]
            isOneToOne: false
            referencedRelation: "question_bank_items"
            referencedColumns: ["id"]
          },
        ]
      }
      question_bank_items: {
        Row: {
          archived_at: string | null
          choices: Json
          correct_choice_id: string
          created_at: string
          created_by: string
          id: string
          prompt: string
        }
        Insert: {
          archived_at?: string | null
          choices: Json
          correct_choice_id: string
          created_at?: string
          created_by: string
          id?: string
          prompt: string
        }
        Update: {
          archived_at?: string | null
          choices?: Json
          correct_choice_id?: string
          created_at?: string
          created_by?: string
          id?: string
          prompt?: string
        }
        Relationships: [
          {
            foreignKeyName: "question_bank_items_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      question_bank_item_tags: {
        Row: {
          added_by: string
          created_at: string
          item_id: string
          tag_id: string
        }
        Insert: {
          added_by: string
          created_at?: string
          item_id: string
          tag_id: string
        }
        Update: {
          added_by?: string
          created_at?: string
          item_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "question_bank_item_tags_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "question_bank_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_bank_item_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_answer_keys: {
        Row: {
          correct_choice_id: string
          question_id: string
        }
        Insert: {
          correct_choice_id: string
          question_id: string
        }
        Update: {
          correct_choice_id?: string
          question_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_answer_keys_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: true
            referencedRelation: "quiz_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_attempts: {
        Row: {
          answers: Json
          id: string
          max_score: number
          quiz_id: string
          score: number
          student_id: string
          submitted_at: string
        }
        Insert: {
          answers: Json
          id?: string
          max_score: number
          quiz_id: string
          score: number
          student_id: string
          submitted_at?: string
        }
        Update: {
          answers?: Json
          id?: string
          max_score?: number
          quiz_id?: string
          score?: number
          student_id?: string
          submitted_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_attempts_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_attempts_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_events: {
        Row: {
          action: string
          actor_id: string | null
          after_data: Json | null
          before_data: Json | null
          correlation_id: string | null
          created_at: string
          id: number
          source: string
          target_id: string | null
          target_type: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          after_data?: Json | null
          before_data?: Json | null
          correlation_id?: string | null
          created_at?: string
          id?: never
          source: string
          target_id?: string | null
          target_type: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          after_data?: Json | null
          before_data?: Json | null
          correlation_id?: string | null
          created_at?: string
          id?: never
          source?: string
          target_id?: string | null
          target_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      canonical_redirects: {
        Row: {
          created_at: string
          created_by: string
          old_path: string
          page_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          old_path: string
          page_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          old_path?: string
          page_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "canonical_redirects_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "canonical_redirects_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "pages"
            referencedColumns: ["id"]
          },
        ]
      }
      files: {
        Row: {
          archived_at: string | null
          bucket_id: string
          created_at: string
          id: string
          media_type: string
          object_name: string
          original_name: string
          owner_id: string
          sha256: string
          size_bytes: number
          state: Database["public"]["Enums"]["file_state"]
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          bucket_id?: string
          created_at?: string
          id?: string
          media_type: string
          object_name: string
          original_name: string
          owner_id: string
          sha256: string
          size_bytes: number
          state?: Database["public"]["Enums"]["file_state"]
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          bucket_id?: string
          created_at?: string
          id?: string
          media_type?: string
          object_name?: string
          original_name?: string
          owner_id?: string
          sha256?: string
          size_bytes?: number
          state?: Database["public"]["Enums"]["file_state"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "files_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      institutional_auth_config: {
        Row: {
          email_domain: string
          enabled: boolean
          singleton: boolean
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          email_domain?: string
          enabled?: boolean
          singleton?: boolean
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          email_domain?: string
          enabled?: boolean
          singleton?: boolean
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      page_editors: {
        Row: {
          created_at: string
          granted_by: string
          page_id: string
          profile_id: string
          reason: string
          valid_until: string | null
        }
        Insert: {
          created_at?: string
          granted_by: string
          page_id: string
          profile_id: string
          reason: string
          valid_until?: string | null
        }
        Update: {
          created_at?: string
          granted_by?: string
          page_id?: string
          profile_id?: string
          reason?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "page_editors_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "page_editors_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "page_editors_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      page_files: {
        Row: {
          added_by: string
          created_at: string
          file_id: string
          page_id: string
        }
        Insert: {
          added_by: string
          created_at?: string
          file_id: string
          page_id: string
        }
        Update: {
          added_by?: string
          created_at?: string
          file_id?: string
          page_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "page_files_added_by_fkey"
            columns: ["added_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "page_files_file_id_fkey"
            columns: ["file_id"]
            isOneToOne: false
            referencedRelation: "files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "page_files_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "pages"
            referencedColumns: ["id"]
          },
        ]
      }
      page_revisions: {
        Row: {
          actor_id: string
          content_json: Json
          content_schema_version: number
          created_at: string
          id: string
          lifecycle: Database["public"]["Enums"]["content_state"]
          page_id: string
          title: string
          version: number
        }
        Insert: {
          actor_id: string
          content_json: Json
          content_schema_version: number
          created_at?: string
          id?: string
          lifecycle: Database["public"]["Enums"]["content_state"]
          page_id: string
          title: string
          version: number
        }
        Update: {
          actor_id?: string
          content_json?: Json
          content_schema_version?: number
          created_at?: string
          id?: string
          lifecycle?: Database["public"]["Enums"]["content_state"]
          page_id?: string
          title?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "page_revisions_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "page_revisions_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "pages"
            referencedColumns: ["id"]
          },
        ]
      }
      page_tags: {
        Row: {
          added_by: string
          created_at: string
          page_id: string
          tag_id: string
        }
        Insert: {
          added_by: string
          created_at?: string
          page_id: string
          tag_id: string
        }
        Update: {
          added_by?: string
          created_at?: string
          page_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "page_tags_added_by_fkey"
            columns: ["added_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "page_tags_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "page_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      pages: {
        Row: {
          archived_at: string | null
          author_id: string
          canonical_url: string
          content_json: Json
          content_schema_version: number
          created_at: string
          id: string
          is_public: boolean
          lifecycle: Database["public"]["Enums"]["content_state"]
          parent_id: string | null
          published_at: string | null
          slug: string
          title: string
          updated_at: string
          version: number
        }
        Insert: {
          archived_at?: string | null
          author_id: string
          canonical_url: string
          content_json: Json
          content_schema_version?: number
          created_at?: string
          id?: string
          is_public?: boolean
          lifecycle?: Database["public"]["Enums"]["content_state"]
          parent_id?: string | null
          published_at?: string | null
          slug: string
          title: string
          updated_at?: string
          version?: number
        }
        Update: {
          archived_at?: string | null
          author_id?: string
          canonical_url?: string
          content_json?: Json
          content_schema_version?: number
          created_at?: string
          id?: string
          is_public?: boolean
          lifecycle?: Database["public"]["Enums"]["content_state"]
          parent_id?: string | null
          published_at?: string | null
          slug?: string
          title?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "pages_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pages_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "pages"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          admitted_at: string
          admitted_by: string | null
          created_at: string
          disabled_at: string | null
          email: string
          id: string
          kind: Database["public"]["Enums"]["principal_kind"]
          state: Database["public"]["Enums"]["principal_state"]
          updated_at: string
        }
        Insert: {
          admitted_at?: string
          admitted_by?: string | null
          created_at?: string
          disabled_at?: string | null
          email: string
          id: string
          kind: Database["public"]["Enums"]["principal_kind"]
          state?: Database["public"]["Enums"]["principal_state"]
          updated_at?: string
        }
        Update: {
          admitted_at?: string
          admitted_by?: string | null
          created_at?: string
          disabled_at?: string | null
          email?: string
          id?: string
          kind?: Database["public"]["Enums"]["principal_kind"]
          state?: Database["public"]["Enums"]["principal_state"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_admitted_by_fkey"
            columns: ["admitted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      role_assignments: {
        Row: {
          created_at: string
          granted_by: string | null
          profile_id: string
          reason: string
          role: Database["public"]["Enums"]["system_role"]
          valid_from: string
          valid_until: string | null
        }
        Insert: {
          created_at?: string
          granted_by?: string | null
          profile_id: string
          reason: string
          role: Database["public"]["Enums"]["system_role"]
          valid_from?: string
          valid_until?: string | null
        }
        Update: {
          created_at?: string
          granted_by?: string | null
          profile_id?: string
          reason?: string
          role?: Database["public"]["Enums"]["system_role"]
          valid_from?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "role_assignments_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_assignments_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tag_memberships: {
        Row: {
          created_at: string
          granted_by: string | null
          membership_role: Database["public"]["Enums"]["membership_role"]
          profile_id: string
          reason: string | null
          source: string
          tag_id: string
          valid_from: string
          valid_until: string | null
        }
        Insert: {
          created_at?: string
          granted_by?: string | null
          membership_role?: Database["public"]["Enums"]["membership_role"]
          profile_id: string
          reason?: string | null
          source: string
          tag_id: string
          valid_from?: string
          valid_until?: string | null
        }
        Update: {
          created_at?: string
          granted_by?: string | null
          membership_role?: Database["public"]["Enums"]["membership_role"]
          profile_id?: string
          reason?: string | null
          source?: string
          tag_id?: string
          valid_from?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tag_memberships_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tag_memberships_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tag_memberships_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      tags: {
        Row: {
          archived_at: string | null
          created_at: string
          created_by: string
          display_name: string
          id: string
          is_active: boolean
          tag_name: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          created_by: string
          display_name: string
          id?: string
          is_active?: boolean
          tag_name: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          created_by?: string
          display_name?: string
          id?: string
          is_active?: boolean
          tag_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "tags_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      assert_can_assign_tags: {
        Args: { actor: string; tag_ids: string[] }
        Returns: undefined
      }
      assert_institution_admin: { Args: { actor?: string }; Returns: undefined }
      assert_safe_rich_html: {
        Args: { field_path: string; value: Json }
        Returns: undefined
      }
      assert_valid_content: {
        Args: { payload: Json; schema_version: number }
        Returns: undefined
      }
      assign_system_role: {
        Args: {
          assigned_role: Database["public"]["Enums"]["system_role"]
          assignment_reason: string
          assignment_valid_until?: string
          correlation_id?: string
          target_profile: string
        }
        Returns: undefined
      }
      assign_tag_membership: {
        Args: {
          assigned_membership_role: Database["public"]["Enums"]["membership_role"]
          assignment_reason?: string
          assignment_source: string
          assignment_valid_until?: string
          correlation_id?: string
          target_profile: string
          target_tag: string
        }
        Returns: undefined
      }
      attach_ready_file_to_page: {
        Args: {
          correlation_id?: string
          target_file_id: string
          target_page_id: string
        }
        Returns: undefined
      }
      before_user_created_institutional: {
        Args: { event: Json }
        Returns: Json
      }
      begin_file_upload: {
        Args: {
          correlation_id?: string
          declared_media_type: string
          declared_sha256: string
          declared_size_bytes: number
          original_filename: string
        }
        Returns: {
          archived_at: string | null
          bucket_id: string
          created_at: string
          id: string
          media_type: string
          object_name: string
          original_name: string
          owner_id: string
          sha256: string
          size_bytes: number
          state: Database["public"]["Enums"]["file_state"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "files"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      can_edit_page: { Args: { target_page: string }; Returns: boolean }
      can_manage_assignment: {
        Args: { target_assignment: string }
        Returns: boolean
      }
      can_manage_announcement: {
        Args: { target_announcement: string }
        Returns: boolean
      }
      can_manage_calendar_event: {
        Args: { target_event: string }
        Returns: boolean
      }
      can_access_bank_item: { Args: { target_item: string }; Returns: boolean }
      can_manage_quiz: { Args: { target_quiz: string }; Returns: boolean }
      can_read_announcement: {
        Args: { target_announcement: string }
        Returns: boolean
      }
      can_read_assignment: {
        Args: { target_assignment: string }
        Returns: boolean
      }
      can_read_calendar_event: {
        Args: { target_event: string }
        Returns: boolean
      }
      can_read_quiz: { Args: { target_quiz: string }; Returns: boolean }
      can_read_page: { Args: { target_page: string }; Returns: boolean }
      assert_guardian_of: {
        Args: { target_pupil_id: string }
        Returns: undefined
      }
      cancel_announcement: {
        Args: { correlation_id?: string; target_announcement_id: string }
        Returns: undefined
      }
      cancel_calendar_event: {
        Args: { correlation_id?: string; target_event_id: string }
        Returns: undefined
      }
      guardian_view_calendar: {
        Args: { target_pupil_id: string }
        Returns: {
          item_id: string
          item_kind: string
          title: string
          occurs_at: string
          ends_at: string | null
          is_broadcast: boolean
        }[]
      }
      guardian_view_announcements: {
        Args: { target_pupil_id: string }
        Returns: {
          item_id: string
          title: string
          body: string
          is_broadcast: boolean
          created_at: string
        }[]
      }
      guardian_view_grades: {
        Args: { target_pupil_id: string }
        Returns: {
          submission_id: string
          assignment_title: string
          grade: number | null
          grade_feedback: string | null
          graded_at: string | null
        }[]
      }
      link_guardian: {
        Args: {
          correlation_id?: string
          guardian_email: string
          link_reason: string
          target_pupil_id: string
        }
        Returns: {
          activated_at: string | null
          created_at: string
          created_by: string
          guardian_email: string
          guardian_profile_id: string | null
          id: string
          pupil_id: string
          reason: string
          revoked_at: string | null
        }
        SetofOptions: {
          from: "*"
          to: "guardian_links"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      list_my_pupils: {
        Args: Record<PropertyKey, never>
        Returns: { pupil_id: string; pupil_email: string }[]
      }
      revoke_guardian_link: {
        Args: { correlation_id?: string; target_link_id: string }
        Returns: undefined
      }
      create_announcement: {
        Args: {
          announcement_body: string
          announcement_title: string
          audience_tag_ids: string[]
          broadcast: boolean
          correlation_id?: string
        }
        Returns: {
          archived_at: string | null
          body: string
          created_at: string
          created_by: string
          id: string
          is_broadcast: boolean
          title: string
        }
        SetofOptions: {
          from: "*"
          to: "announcements"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_calendar_event: {
        Args: {
          audience_tag_ids: string[]
          broadcast: boolean
          correlation_id?: string
          event_description?: string | null
          event_ends_at?: string | null
          event_starts_at: string
          event_title: string
        }
        Returns: {
          archived_at: string | null
          created_at: string
          created_by: string
          description: string | null
          ends_at: string | null
          id: string
          is_broadcast: boolean
          starts_at: string
          title: string
        }
        SetofOptions: {
          from: "*"
          to: "calendar_events"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_bank_item: {
        Args: {
          audience_tag_ids: string[]
          correlation_id?: string
          item_choices: Json
          item_correct_choice_id: string
          item_prompt: string
        }
        Returns: {
          archived_at: string | null
          choices: Json
          correct_choice_id: string
          created_at: string
          created_by: string
          id: string
          prompt: string
        }
        SetofOptions: {
          from: "*"
          to: "question_bank_items"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      archive_bank_item: {
        Args: { correlation_id?: string; target_item_id: string }
        Returns: {
          archived_at: string | null
          choices: Json
          correct_choice_id: string
          created_at: string
          created_by: string
          id: string
          prompt: string
        }
        SetofOptions: {
          from: "*"
          to: "question_bank_items"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      sync_roster: {
        Args: { correlation_id?: string; dry_run?: boolean; rows: Json }
        Returns: Json
      }
      create_tag: {
        Args: {
          correlation_id?: string
          creation_reason?: string | null
          new_display_name: string
          new_tag_name: string
        }
        Returns: {
          archived_at: string | null
          created_at: string
          created_by: string
          display_name: string
          id: string
          is_active: boolean
          tag_name: string
        }
        SetofOptions: {
          from: "*"
          to: "tags"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_quiz: {
        Args: {
          audience_tag_ids: string[]
          correlation_id?: string
          quiz_due_at: string | null
          quiz_questions: Json
          quiz_title: string
        }
        Returns: {
          archived_at: string | null
          author_id: string
          created_at: string
          due_at: string | null
          id: string
          title: string
        }
        SetofOptions: {
          from: "*"
          to: "quizzes"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      submit_quiz_attempt: {
        Args: {
          correlation_id?: string
          submitted_answers: Json
          target_quiz_id: string
        }
        Returns: {
          answers: Json
          id: string
          max_score: number
          quiz_id: string
          score: number
          student_id: string
          submitted_at: string
        }
        SetofOptions: {
          from: "*"
          to: "quiz_attempts"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      grade_assignment_submission: {
        Args: {
          correlation_id?: string
          feedback_text?: string | null
          grade_value: number
          target_submission_id: string
        }
        Returns: {
          assignment_id: string
          file_id: string
          grade: number | null
          grade_feedback: string | null
          graded_at: string | null
          graded_by: string | null
          id: string
          note: string | null
          student_id: string
          submitted_at: string
        }
        SetofOptions: {
          from: "*"
          to: "assignment_submissions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_assignment: {
        Args: {
          assignment_due_at: string
          assignment_title: string
          audience_tag_ids: string[]
          correlation_id?: string
          instructions_page: string
          resubmission_allowed: boolean
        }
        Returns: {
          allow_resubmission: boolean
          archived_at: string | null
          created_at: string
          created_by: string
          due_at: string | null
          id: string
          instructions_page_id: string | null
          title: string
        }
        SetofOptions: {
          from: "*"
          to: "assignments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_page: {
        Args: {
          audience_tag_ids: string[]
          correlation_id?: string
          page_content: Json
          page_content_schema_version: number
          page_parent_id: string
          page_slug: string
          page_title: string
        }
        Returns: {
          archived_at: string | null
          author_id: string
          canonical_url: string
          content_json: Json
          content_schema_version: number
          created_at: string
          id: string
          is_public: boolean
          lifecycle: Database["public"]["Enums"]["content_state"]
          parent_id: string | null
          published_at: string | null
          slug: string
          title: string
          updated_at: string
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "pages"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      current_principal_is_active: { Args: never; Returns: boolean }
      current_principal_is_admin: { Args: never; Returns: boolean }
      get_file_download_target: {
        Args: { target_file_id: string }
        Returns: {
          bucket_id: string
          media_type: string
          object_name: string
          original_name: string
          size_bytes: number
        }[]
      }
      grant_page_editor: {
        Args: {
          correlation_id?: string
          grant_reason: string
          grant_valid_until?: string
          target_page: string
          target_profile: string
        }
        Returns: undefined
      }
      has_system_role: {
        Args: {
          required_role: Database["public"]["Enums"]["system_role"]
          target_id?: string
        }
        Returns: boolean
      }
      has_tag_membership: {
        Args: {
          allowed_roles: Database["public"]["Enums"]["membership_role"][]
          target_id?: string
          target_tag: string
        }
        Returns: boolean
      }
      is_active_principal: { Args: { target_id?: string }; Returns: boolean }
      jsonb_has_only_keys: {
        Args: { allowed: string[]; value: Json }
        Returns: boolean
      }
      page_path: {
        Args: { target_parent: string; target_slug: string }
        Returns: string
      }
      restore_page_revision: {
        Args: {
          correlation_id?: string
          expected_version: number
          target_page_id: string
          target_revision_id: string
        }
        Returns: {
          archived_at: string | null
          author_id: string
          canonical_url: string
          content_json: Json
          content_schema_version: number
          created_at: string
          id: string
          is_public: boolean
          lifecycle: Database["public"]["Enums"]["content_state"]
          parent_id: string | null
          published_at: string | null
          slug: string
          title: string
          updated_at: string
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "pages"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_page_lifecycle: {
        Args: {
          correlation_id?: string
          expected_version: number
          make_public?: boolean
          next_state: Database["public"]["Enums"]["content_state"]
          target_page_id: string
        }
        Returns: {
          archived_at: string | null
          author_id: string
          canonical_url: string
          content_json: Json
          content_schema_version: number
          created_at: string
          id: string
          is_public: boolean
          lifecycle: Database["public"]["Enums"]["content_state"]
          parent_id: string | null
          published_at: string | null
          slug: string
          title: string
          updated_at: string
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "pages"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_profile_state: {
        Args: {
          change_reason: string
          correlation_id?: string
          next_state: Database["public"]["Enums"]["principal_state"]
          target_profile: string
        }
        Returns: undefined
      }
      submit_assignment: {
        Args: {
          correlation_id?: string
          submission_note?: string
          target_assignment_id: string
          target_file_id: string
        }
        Returns: {
          assignment_id: string
          file_id: string
          id: string
          note: string | null
          student_id: string
          submitted_at: string
        }
        SetofOptions: {
          from: "*"
          to: "assignment_submissions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      update_page: {
        Args: {
          audience_tag_ids: string[]
          correlation_id?: string
          expected_version: number
          page_content: Json
          page_content_schema_version: number
          page_parent_id: string
          page_slug: string
          page_title: string
          target_page_id: string
        }
        Returns: {
          archived_at: string | null
          author_id: string
          canonical_url: string
          content_json: Json
          content_schema_version: number
          created_at: string
          id: string
          is_public: boolean
          lifecycle: Database["public"]["Enums"]["content_state"]
          parent_id: string | null
          published_at: string | null
          slug: string
          title: string
          updated_at: string
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "pages"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      content_state: "draft" | "published" | "archived"
      file_state: "pending" | "ready" | "quarantined" | "failed" | "archived"
      membership_role: "member" | "teacher" | "manager"
      principal_kind: "institutional" | "guardian" | "service"
      principal_state: "active" | "disabled"
      system_role: "institution_admin" | "teacher" | "student"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      content_state: ["draft", "published", "archived"],
      file_state: ["pending", "ready", "quarantined", "failed", "archived"],
      membership_role: ["member", "teacher", "manager"],
      principal_kind: ["institutional", "guardian", "service"],
      principal_state: ["active", "disabled"],
      system_role: ["institution_admin", "teacher", "student"],
    },
  },
} as const

