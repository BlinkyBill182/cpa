export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type AccountingStatus =
  | "in_progress"
  | "ready_missing"
  | "ready_for_review"
  | "issue"
  | "skip";

export type ReportStatus =
  | "ready_missing"
  | "missing_completed"
  | "ready_for_check"
  | "issue"
  | "ready_for_signature"
  | "submitted";

export type TenantRoleDb =
  | "tenant_admin"
  | "manager"
  | "staff"
  | "reviewer"
  | "contractor";

export type Database = {
  public: {
    Tables: {
      office_action_configs: {
        Row: {
          id: string;
          tenant_id: string;
          action_key: string;
          is_enabled: boolean;
          config: Json | null;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          action_key: string;
          is_enabled?: boolean;
          config?: Json | null;
          updated_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          action_key?: string;
          is_enabled?: boolean;
          config?: Json | null;
          updated_at?: string;
        };
      };
      audit_logs: {
        Row: {
          id: string;
          tenant_id: string | null;
          actor_user_id: string | null;
          action: string;
          payload: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          tenant_id?: string | null;
          actor_user_id?: string | null;
          action: string;
          payload?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string | null;
          actor_user_id?: string | null;
          action?: string;
          payload?: Json;
          created_at?: string;
        };
      };
      client_year_documents: {
        Row: {
          id: string;
          client_year_id: string;
          document_type_id: string | null;
          custom_name: string | null;
          free_text: string | null;
          allowed_formats: string[] | null;
          is_required: boolean;
          client_marked_none: boolean;
          none_reason: string | null;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          client_year_id: string;
          document_type_id?: string | null;
          custom_name?: string | null;
          free_text?: string | null;
          allowed_formats?: string[] | null;
          is_required?: boolean;
          client_marked_none?: boolean;
          none_reason?: string | null;
          sort_order?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          client_year_id?: string;
          document_type_id?: string | null;
          custom_name?: string | null;
          free_text?: string | null;
          allowed_formats?: string[] | null;
          is_required?: boolean;
          client_marked_none?: boolean;
          none_reason?: string | null;
          sort_order?: number;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "client_year_documents_client_year_id_fkey";
            columns: ["client_year_id"];
            isOneToOne: true;
            referencedRelation: "client_years";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "client_year_documents_document_type_id_fkey";
            columns: ["document_type_id"];
            isOneToOne: true;
            referencedRelation: "document_types";
            referencedColumns: ["id"];
          },
        ];
      };
      client_years: {
        Row: {
          id: string;
          tenant_id: string;
          client_id: string;
          year: number;
          accountant_id: string | null;
          contractor_id: string | null;
          accounting_status: AccountingStatus;
          report_status: ReportStatus | null;
          issue_notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          client_id: string;
          year: number;
          accountant_id?: string | null;
          contractor_id?: string | null;
          accounting_status?: AccountingStatus;
          report_status?: ReportStatus | null;
          issue_notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          client_id?: string;
          year?: number;
          accountant_id?: string | null;
          contractor_id?: string | null;
          accounting_status?: AccountingStatus;
          report_status?: ReportStatus | null;
          issue_notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "client_years_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: true;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "client_years_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: true;
            referencedRelation: "office_clients";
            referencedColumns: ["id"];
          },
        ];
      };
      document_types: {
        Row: {
          id: string;
          tenant_id: string;
          name: string;
          allowed_formats: string[];
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          name: string;
          allowed_formats?: string[];
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          name?: string;
          allowed_formats?: string[];
          is_active?: boolean;
          created_at?: string;
        };
      };
      office_clients: {
        Row: {
          id: string;
          tenant_id: string;
          name: string;
          tax_id: string | null;
          first_name: string | null;
          last_name: string | null;
          phone: string | null;
          email: string | null;
          created_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          name: string;
          tax_id?: string | null;
          first_name?: string | null;
          last_name?: string | null;
          phone?: string | null;
          email?: string | null;
          created_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          name?: string;
          tax_id?: string | null;
          first_name?: string | null;
          last_name?: string | null;
          phone?: string | null;
          email?: string | null;
          created_at?: string;
          deleted_at?: string | null;
        };
      };
      profiles: {
        Row: {
          id: string;
          full_name: string | null;
          is_platform_owner: boolean;
          created_at: string;
        };
        Insert: {
          id: string;
          full_name?: string | null;
          is_platform_owner?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string | null;
          is_platform_owner?: boolean;
          created_at?: string;
        };
      };
      seasonal_income_records: {
        Row: {
          id: string;
          tenant_id: string;
          office_client_id: string;
          year: number;
          status: "pending_review" | "approved" | "rejected";
          gross_income: number;
          taxable_income: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          office_client_id: string;
          year: number;
          status?: "pending_review" | "approved" | "rejected";
          gross_income: number;
          taxable_income: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          office_client_id?: string;
          year?: number;
          status?: "pending_review" | "approved" | "rejected";
          gross_income?: number;
          taxable_income?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      tenant_access_requests: {
        Row: {
          id: string;
          tenant_id: string;
          email: string;
          status: "pending" | "approved" | "rejected";
          role: TenantRoleDb | null;
          requested_at: string;
          reviewed_by: string | null;
          reviewed_at: string | null;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          email: string;
          status?: "pending" | "approved" | "rejected";
          role?: TenantRoleDb | null;
          requested_at?: string;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          email?: string;
          status?: "pending" | "approved" | "rejected";
          role?: TenantRoleDb | null;
          requested_at?: string;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
        };
      };
      tenant_invitations: {
        Row: {
          id: string;
          tenant_id: string;
          invited_email: string;
          role: TenantRoleDb;
          status: "pending" | "accepted" | "revoked";
          invited_by: string;
          accepted_user_id: string | null;
          invited_at: string;
          accepted_at: string | null;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          invited_email: string;
          role: TenantRoleDb;
          status?: "pending" | "accepted" | "revoked";
          invited_by: string;
          accepted_user_id?: string | null;
          invited_at?: string;
          accepted_at?: string | null;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          invited_email?: string;
          role?: TenantRoleDb;
          status?: "pending" | "accepted" | "revoked";
          invited_by?: string;
          accepted_user_id?: string | null;
          invited_at?: string;
          accepted_at?: string | null;
        };
      };
      tenant_memberships: {
        Row: {
          tenant_id: string;
          user_id: string;
          role: TenantRoleDb;
          created_at: string;
        };
        Insert: {
          tenant_id: string;
          user_id: string;
          role: TenantRoleDb;
          created_at?: string;
        };
        Update: {
          tenant_id?: string;
          user_id?: string;
          role?: TenantRoleDb;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "tenant_memberships_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: true;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tenant_memberships_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      tenant_secrets: {
        Row: {
          id: string;
          tenant_id: string;
          service: string;
          encrypted_key: string;
          created_at: string;
          last_used_at: string | null;
          is_active: boolean;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          service: string;
          encrypted_key: string;
          created_at?: string;
          last_used_at?: string | null;
          is_active?: boolean;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          service?: string;
          encrypted_key?: string;
          created_at?: string;
          last_used_at?: string | null;
          is_active?: boolean;
        };
      };
      tenants: {
        Row: {
          id: string;
          name: string;
          slug: string;
          created_by: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          created_by: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          created_by?: string;
          created_at?: string;
        };
      };
      uploaded_files: {
        Row: {
          id: string;
          client_year_document_id: string;
          drive_url: string;
          upload_status: "in_drive" | "failed";
          original_filename: string;
          file_size_kb: number | null;
          uploaded_at: string;
          ai_status: "pending" | "valid" | "invalid";
          ai_notes: string | null;
          accountant_approved: boolean | null;
          accountant_rejection_reason: string | null;
        };
        Insert: {
          id?: string;
          client_year_document_id: string;
          drive_url: string;
          upload_status?: "in_drive" | "failed";
          original_filename: string;
          file_size_kb?: number | null;
          uploaded_at?: string;
          ai_status?: "pending" | "valid" | "invalid";
          ai_notes?: string | null;
          accountant_approved?: boolean | null;
          accountant_rejection_reason?: string | null;
        };
        Update: {
          id?: string;
          client_year_document_id?: string;
          drive_url?: string;
          upload_status?: "in_drive" | "failed";
          original_filename?: string;
          file_size_kb?: number | null;
          uploaded_at?: string;
          ai_status?: "pending" | "valid" | "invalid";
          ai_notes?: string | null;
          accountant_approved?: boolean | null;
          accountant_rejection_reason?: string | null;
        };
      };
      workflow_runs: {
        Row: {
          id: string;
          tenant_id: string;
          flow_type: string;
          status: "queued" | "running" | "failed" | "completed";
          started_at: string | null;
          completed_at: string | null;
          payload: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          flow_type: string;
          status?: "queued" | "running" | "failed" | "completed";
          started_at?: string | null;
          completed_at?: string | null;
          payload?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          flow_type?: string;
          status?: "queued" | "running" | "failed" | "completed";
          started_at?: string | null;
          completed_at?: string | null;
          payload?: Json;
          created_at?: string;
        };
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
