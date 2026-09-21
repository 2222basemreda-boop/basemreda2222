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
      activity_logs: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          entity_id: string | null
          entity_label: string | null
          entity_type: string
          id: string
          user_id: string | null
          user_name: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_label?: string | null
          entity_type: string
          id?: string
          user_id?: string | null
          user_name?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_label?: string | null
          entity_type?: string
          id?: string
          user_id?: string | null
          user_name?: string | null
        }
        Relationships: []
      }
      animal_customer_history: {
        Row: {
          animal_id: string
          changed_at: string
          changed_by: string | null
          customer_id: string | null
          event: string | null
          id: string
          note: string | null
          status: Database["public"]["Enums"]["animal_status"]
        }
        Insert: {
          animal_id: string
          changed_at?: string
          changed_by?: string | null
          customer_id?: string | null
          event?: string | null
          id?: string
          note?: string | null
          status: Database["public"]["Enums"]["animal_status"]
        }
        Update: {
          animal_id?: string
          changed_at?: string
          changed_by?: string | null
          customer_id?: string | null
          event?: string | null
          id?: string
          note?: string | null
          status?: Database["public"]["Enums"]["animal_status"]
        }
        Relationships: [
          {
            foreignKeyName: "animal_customer_history_animal_id_fkey"
            columns: ["animal_id"]
            isOneToOne: false
            referencedRelation: "animals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "animal_customer_history_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      animals: {
        Row: {
          barn_id: string | null
          color: string | null
          created_at: string
          created_by: string | null
          current_weight: number | null
          customer_id: string | null
          entry_date: string
          id: string
          notes: string | null
          status: Database["public"]["Enums"]["animal_status"]
          supplier_name: string | null
          tag_number: string
          updated_at: string
        }
        Insert: {
          barn_id?: string | null
          color?: string | null
          created_at?: string
          created_by?: string | null
          current_weight?: number | null
          customer_id?: string | null
          entry_date?: string
          id?: string
          notes?: string | null
          status?: Database["public"]["Enums"]["animal_status"]
          supplier_name?: string | null
          tag_number: string
          updated_at?: string
        }
        Update: {
          barn_id?: string | null
          color?: string | null
          created_at?: string
          created_by?: string | null
          current_weight?: number | null
          customer_id?: string | null
          entry_date?: string
          id?: string
          notes?: string | null
          status?: Database["public"]["Enums"]["animal_status"]
          supplier_name?: string | null
          tag_number?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "animals_barn_id_fkey"
            columns: ["barn_id"]
            isOneToOne: false
            referencedRelation: "barns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "animals_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      barn_movements: {
        Row: {
          animal_id: string
          from_barn_id: string | null
          id: string
          moved_at: string
          moved_by: string | null
          notes: string | null
          to_barn_id: string | null
        }
        Insert: {
          animal_id: string
          from_barn_id?: string | null
          id?: string
          moved_at?: string
          moved_by?: string | null
          notes?: string | null
          to_barn_id?: string | null
        }
        Update: {
          animal_id?: string
          from_barn_id?: string | null
          id?: string
          moved_at?: string
          moved_by?: string | null
          notes?: string | null
          to_barn_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "barn_movements_animal_id_fkey"
            columns: ["animal_id"]
            isOneToOne: false
            referencedRelation: "animals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "barn_movements_from_barn_id_fkey"
            columns: ["from_barn_id"]
            isOneToOne: false
            referencedRelation: "barns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "barn_movements_to_barn_id_fkey"
            columns: ["to_barn_id"]
            isOneToOne: false
            referencedRelation: "barns"
            referencedColumns: ["id"]
          },
        ]
      }
      barns: {
        Row: {
          capacity: number | null
          created_at: string
          id: string
          name: string
          notes: string | null
          updated_at: string
        }
        Insert: {
          capacity?: number | null
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          updated_at?: string
        }
        Update: {
          capacity?: number | null
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      customers: {
        Row: {
          address: string | null
          code: string
          created_at: string
          id: string
          name: string
          notes: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          code: string
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          code?: string
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      feed_records: {
        Row: {
          barn_id: string | null
          cost: number
          created_at: string
          created_by: string | null
          feed_date: string
          feed_type: string
          id: string
          notes: string | null
          quantity: number
          unit: string
        }
        Insert: {
          barn_id?: string | null
          cost?: number
          created_at?: string
          created_by?: string | null
          feed_date?: string
          feed_type: string
          id?: string
          notes?: string | null
          quantity: number
          unit?: string
        }
        Update: {
          barn_id?: string | null
          cost?: number
          created_at?: string
          created_by?: string | null
          feed_date?: string
          feed_type?: string
          id?: string
          notes?: string | null
          quantity?: number
          unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "feed_records_barn_id_fkey"
            columns: ["barn_id"]
            isOneToOne: false
            referencedRelation: "barns"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string
          id: string
          is_active: boolean
        }
        Insert: {
          created_at?: string
          email?: string
          full_name?: string
          id: string
          is_active?: boolean
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          is_active?: boolean
        }
        Relationships: []
      }
      sales: {
        Row: {
          animal_id: string
          created_at: string
          created_by: string | null
          customer_id: string | null
          id: string
          invoice_number: string | null
          notes: string | null
          paid_amount: number
          payment_method: string | null
          payment_status: Database["public"]["Enums"]["payment_status"]
          price_per_kg: number
          sale_date: string
          slaughtering: number
          total_price: number | null
          transportation: number
          updated_at: string
          weight: number
          worker_tip: number
        }
        Insert: {
          animal_id: string
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          id?: string
          invoice_number?: string | null
          notes?: string | null
          paid_amount?: number
          payment_method?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          price_per_kg: number
          sale_date?: string
          slaughtering?: number
          total_price?: number | null
          transportation?: number
          updated_at?: string
          weight: number
          worker_tip?: number
        }
        Update: {
          animal_id?: string
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          id?: string
          invoice_number?: string | null
          notes?: string | null
          paid_amount?: number
          payment_method?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          price_per_kg?: number
          sale_date?: string
          slaughtering?: number
          total_price?: number | null
          transportation?: number
          updated_at?: string
          weight?: number
          worker_tip?: number
        }
        Relationships: [
          {
            foreignKeyName: "sales_animal_id_fkey"
            columns: ["animal_id"]
            isOneToOne: false
            referencedRelation: "animals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      treatments: {
        Row: {
          animal_id: string
          created_at: string
          created_by: string | null
          diagnosis: string
          dose: string | null
          id: string
          medicine: string | null
          notes: string | null
          treatment_date: string
        }
        Insert: {
          animal_id: string
          created_at?: string
          created_by?: string | null
          diagnosis: string
          dose?: string | null
          id?: string
          medicine?: string | null
          notes?: string | null
          treatment_date?: string
        }
        Update: {
          animal_id?: string
          created_at?: string
          created_by?: string | null
          diagnosis?: string
          dose?: string | null
          id?: string
          medicine?: string | null
          notes?: string | null
          treatment_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "treatments_animal_id_fkey"
            columns: ["animal_id"]
            isOneToOne: false
            referencedRelation: "animals"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      weight_records: {
        Row: {
          animal_id: string
          created_at: string
          id: string
          notes: string | null
          recorded_at: string
          recorded_by: string | null
          weight: number
        }
        Insert: {
          animal_id: string
          created_at?: string
          id?: string
          notes?: string | null
          recorded_at?: string
          recorded_by?: string | null
          weight: number
        }
        Update: {
          animal_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          recorded_at?: string
          recorded_by?: string | null
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "weight_records_animal_id_fkey"
            columns: ["animal_id"]
            isOneToOne: false
            referencedRelation: "animals"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cancel_reservation: {
        Args: { _animal_id: string; _reason?: string }
        Returns: undefined
      }
      has_any_role: {
        Args: {
          _roles: Database["public"]["Enums"]["app_role"][]
          _user_id: string
        }
        Returns: boolean
      }
      has_any_users: { Args: never; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
      reserve_animal: {
        Args: { _animal_id: string; _customer_id: string; _note?: string }
        Returns: undefined
      }
    }
    Enums: {
      animal_status: "available" | "reserved" | "sold"
      app_role: "admin" | "manager" | "worker" | "accountant"
      payment_status: "paid" | "partial" | "unpaid"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      animal_status: ["available", "reserved", "sold"],
      app_role: ["admin", "manager", "worker", "accountant"],
      payment_status: ["paid", "partial", "unpaid"],
    },
  },
} as const
