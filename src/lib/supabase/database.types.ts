export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

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
      office_clients: {
        Row: {
          id: string;
          tenant_id: string;
          name: string;
          tax_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          name: string;
          tax_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          name?: string;
          tax_id?: string | null;
          created_at?: string;
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
      tenant_memberships: {
        Row: {
          tenant_id: string;
          user_id: string;
          role: "tenant_admin" | "manager" | "staff" | "reviewer";
          created_at: string;
        };
        Insert: {
          tenant_id: string;
          user_id: string;
          role: "tenant_admin" | "manager" | "staff" | "reviewer";
          created_at?: string;
        };
        Update: {
          tenant_id?: string;
          user_id?: string;
          role?: "tenant_admin" | "manager" | "staff" | "reviewer";
          created_at?: string;
        };
      };
      tenant_access_requests: {
        Row: {
          id: string;
          tenant_id: string;
          email: string;
          status: "pending" | "approved" | "rejected";
          role: "tenant_admin" | "manager" | "staff" | "reviewer" | null;
          requested_at: string;
          reviewed_by: string | null;
          reviewed_at: string | null;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          email: string;
          status?: "pending" | "approved" | "rejected";
          role?: "tenant_admin" | "manager" | "staff" | "reviewer" | null;
          requested_at?: string;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          email?: string;
          status?: "pending" | "approved" | "rejected";
          role?: "tenant_admin" | "manager" | "staff" | "reviewer" | null;
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
          role: "tenant_admin" | "manager" | "staff" | "reviewer";
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
          role: "tenant_admin" | "manager" | "staff" | "reviewer";
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
          role?: "tenant_admin" | "manager" | "staff" | "reviewer";
          status?: "pending" | "accepted" | "revoked";
          invited_by?: string;
          accepted_user_id?: string | null;
          invited_at?: string;
          accepted_at?: string | null;
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
