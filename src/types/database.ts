// Hand-written Supabase schema types (mirrors supabase/migrations/*).
// Regenerate with `npx supabase gen types typescript --project-id <id>` once
// the project is linked.

export type UserRole = 'admin' | 'marketing' | 'sales';
export type AuditAction = 'INSERT' | 'UPDATE' | 'DELETE';

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          role: UserRole;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string | null;
          role?: UserRole;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>;
        Relationships: [];
      };
      apps: {
        Row: {
          id: string;
          name: string;
          display_name: string | null;
          is_active: boolean;
          created_at: string;
          created_by: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          display_name?: string | null;
          is_active?: boolean;
          created_at?: string;
          created_by?: string | null;
        };
        Update: Partial<Database['public']['Tables']['apps']['Insert']>;
        Relationships: [];
      };
      transactions: {
        Row: {
          id: string;
          trx_id: string;
          transaction_date: string | null;
          payment_date: string;
          source_app: string;
          methode_name: string | null;
          revenue: number;
          promo_code: string | null;
          content_name: string | null;
          full_name: string | null;
          email: string | null;
          phone: string | null;
          payment_status: string | null;
          year: number;
          month: number;
          year_month: string;
          created_at: string;
          imported_by: string | null;
          import_batch_id: string | null;
        };
        Insert: {
          id?: string;
          trx_id: string;
          transaction_date?: string | null;
          payment_date: string;
          source_app: string;
          methode_name?: string | null;
          revenue?: number;
          promo_code?: string | null;
          content_name?: string | null;
          full_name?: string | null;
          email?: string | null;
          phone?: string | null;
          payment_status?: string | null;
          imported_by?: string | null;
          import_batch_id?: string | null;
        };
        Update: Partial<Database['public']['Tables']['transactions']['Insert']>;
        Relationships: [];
      };
      downloaders: {
        Row: {
          id: string;
          date: string;
          source_app: string;
          count: number;
          year: number;
          month: number;
          year_month: string;
          created_at: string;
          imported_by: string | null;
          import_batch_id: string | null;
        };
        Insert: {
          id?: string;
          date: string;
          source_app: string;
          count?: number;
          imported_by?: string | null;
          import_batch_id?: string | null;
        };
        Update: Partial<Database['public']['Tables']['downloaders']['Insert']>;
        Relationships: [];
      };
      target_configs: {
        Row: {
          id: string;
          app_id: string;
          target_month: string;
          target_downloader: number;
          target_user_premium: number;
          target_sales: number;
          target_conversion: number;
          avg_price: number;
          is_target_set: boolean;
          created_at: string;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          id?: string;
          app_id: string;
          target_month: string;
          target_downloader?: number;
          target_user_premium?: number;
          target_sales?: number;
          target_conversion?: number;
          avg_price?: number;
          is_target_set?: boolean;
          updated_by?: string | null;
        };
        Update: Partial<Database['public']['Tables']['target_configs']['Insert']>;
        Relationships: [];
      };
      daily_data: {
        Row: {
          id: string;
          app_id: string;
          date: string;
          target_downloader: number;
          target_sales: number;
          target_user_premium: number;
          manual_target_downloader: number | null;
          manual_target_sales: number | null;
          manual_target_premium: number | null;
          actual_downloader: number | null;
          actual_sales: number | null;
          actual_user_premium: number | null;
          estimasi_harga: number;
          channel: string | null;
          promo: string | null;
          premium: string | null;
          benefit: string | null;
          benefit2: string | null;
          event: string | null;
          activity: string | null;
          extra: string | null;
          bcan: string | null;
          story: string | null;
          chat: string | null;
          live: string | null;
          ads: string | null;
          daily_insight: string | null;
          created_at: string;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          id?: string;
          app_id: string;
          date: string;
          target_downloader?: number;
          target_sales?: number;
          target_user_premium?: number;
          manual_target_downloader?: number | null;
          manual_target_sales?: number | null;
          manual_target_premium?: number | null;
          actual_downloader?: number | null;
          actual_sales?: number | null;
          actual_user_premium?: number | null;
          estimasi_harga?: number;
          channel?: string | null;
          promo?: string | null;
          premium?: string | null;
          benefit?: string | null;
          benefit2?: string | null;
          event?: string | null;
          activity?: string | null;
          extra?: string | null;
          bcan?: string | null;
          story?: string | null;
          chat?: string | null;
          live?: string | null;
          ads?: string | null;
          daily_insight?: string | null;
          updated_by?: string | null;
        };
        Update: Partial<Database['public']['Tables']['daily_data']['Insert']>;
        Relationships: [];
      };
      social_media_contents: {
        Row: {
          id: string;
          daily_data_id: string;
          app_id: string;
          date: string;
          platform: string;
          posting_time: string | null;
          content_type: string | null;
          title: string | null;
          caption: string | null;
          cta: string | null;
          topic: string | null;
          objective: string | null;
          link: string | null;
          reach: number;
          engagement: number;
          views: number;
          created_at: string;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          id?: string;
          daily_data_id: string;
          app_id: string;
          date: string;
          platform: string;
          posting_time?: string | null;
          content_type?: string | null;
          title?: string | null;
          caption?: string | null;
          cta?: string | null;
          topic?: string | null;
          objective?: string | null;
          link?: string | null;
          reach?: number;
          engagement?: number;
          views?: number;
          updated_by?: string | null;
        };
        Update: Partial<
          Database['public']['Tables']['social_media_contents']['Insert']
        >;
        Relationships: [];
      };
      audit_logs: {
        Row: {
          id: string;
          table_name: string;
          record_id: string;
          action: AuditAction;
          old_data: Json | null;
          new_data: Json | null;
          changed_fields: string[] | null;
          user_id: string | null;
          user_email: string | null;
          user_role: UserRole | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          table_name: string;
          record_id: string;
          action: AuditAction;
          old_data?: Json | null;
          new_data?: Json | null;
          changed_fields?: string[] | null;
          user_id?: string | null;
          user_email?: string | null;
          user_role?: UserRole | null;
        };
        Update: Partial<Database['public']['Tables']['audit_logs']['Insert']>;
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: {
      user_role: UserRole;
      audit_action: AuditAction;
    };
    CompositeTypes: { [_ in never]: never };
  };
}
