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
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      report_executions: {
        Row: {
          created_at: string
          error_message: string | null
          finished_at: string | null
          id: string
          next_retry_at: string | null
          pdf_path: string | null
          pdf_size_bytes: number | null
          period_end: string | null
          period_start: string | null
          retry_count: number
          schedule_id: string
          started_at: string | null
          status: Database["public"]["Enums"]["execution_status"]
          total_records: number | null
          user_id: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          finished_at?: string | null
          id?: string
          next_retry_at?: string | null
          pdf_path?: string | null
          pdf_size_bytes?: number | null
          period_end?: string | null
          period_start?: string | null
          retry_count?: number
          schedule_id: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["execution_status"]
          total_records?: number | null
          user_id: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          finished_at?: string | null
          id?: string
          next_retry_at?: string | null
          pdf_path?: string | null
          pdf_size_bytes?: number | null
          period_end?: string | null
          period_start?: string | null
          retry_count?: number
          schedule_id?: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["execution_status"]
          total_records?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_executions_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "report_schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      report_schedules: {
        Row: {
          bank_id: string
          bank_name: string
          created_at: string
          cron_expression: string
          custom_end_date: string | null
          custom_start_date: string | null
          id: string
          is_active: boolean
          last_run_at: string | null
          name: string
          next_run_at: string | null
          notification_email: string | null
          notify_email: boolean
          period_type: Database["public"]["Enums"]["schedule_period_type"]
          timezone: string
          tolerance_minutes: number
          updated_at: string
          user_id: string
        }
        Insert: {
          bank_id: string
          bank_name: string
          created_at?: string
          cron_expression: string
          custom_end_date?: string | null
          custom_start_date?: string | null
          id?: string
          is_active?: boolean
          last_run_at?: string | null
          name: string
          next_run_at?: string | null
          notification_email?: string | null
          notify_email?: boolean
          period_type: Database["public"]["Enums"]["schedule_period_type"]
          timezone?: string
          tolerance_minutes?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          bank_id?: string
          bank_name?: string
          created_at?: string
          cron_expression?: string
          custom_end_date?: string | null
          custom_start_date?: string | null
          id?: string
          is_active?: boolean
          last_run_at?: string | null
          name?: string
          next_run_at?: string | null
          notification_email?: string | null
          notify_email?: boolean
          period_type?: Database["public"]["Enums"]["schedule_period_type"]
          timezone?: string
          tolerance_minutes?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      secullum_credentials: {
        Row: {
          client_id: string
          created_at: string
          id: string
          secullum_password: string
          secullum_username: string
          updated_at: string
          user_id: string
        }
        Insert: {
          client_id?: string
          created_at?: string
          id?: string
          secullum_password: string
          secullum_username: string
          updated_at?: string
          user_id: string
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          secullum_password?: string
          secullum_username?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      execution_status: "pending" | "running" | "success" | "error"
      schedule_period_type:
        | "last_7_days"
        | "last_30_days"
        | "yesterday"
        | "current_month_until_yesterday"
        | "previous_month"
        | "last_week"
        | "custom_range"
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
      execution_status: ["pending", "running", "success", "error"],
      schedule_period_type: [
        "last_7_days",
        "last_30_days",
        "yesterday",
        "current_month_until_yesterday",
        "previous_month",
        "last_week",
        "custom_range",
      ],
    },
  },
} as const
