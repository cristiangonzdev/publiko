// Placeholder — sustituir con tipos generados por `supabase gen types typescript`.
// Hasta entonces los clientes operan con tipado mínimo para no bloquear el build.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface Database {
  public: {
    Tables: Record<string, { Row: Record<string, unknown>; Insert: Record<string, unknown>; Update: Record<string, unknown> }>
    Views: Record<string, { Row: Record<string, unknown> }>
    Functions: Record<string, { Args: Record<string, unknown>; Returns: unknown }>
    Enums: Record<string, string>
    CompositeTypes: Record<string, Record<string, unknown>>
  }
}
