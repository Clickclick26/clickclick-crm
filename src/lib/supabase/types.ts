// Hand-written to match supabase/migrations/0001_init.sql.
// Regenerate with the Supabase CLI once this project is linked:
//   supabase gen types typescript --project-id gapybapywpdogexibtgj > src/lib/supabase/types.ts

export type Json = string | number | boolean | null | { [key: string]: Json } | Json[]

type Row<T> = { Row: T; Insert: Partial<T>; Update: Partial<T>; Relationships: [] }

export type Database = {
  public: {
    Views: Record<string, never>
    Functions: Record<string, never>
    Tables: {
      agents: Row<{
        id: string
        name: string
        role: 'agent' | 'admin'
        online: boolean
        on_call_with: string | null
        personal_number_id: string | null
        avatar_url: string | null
        created_at: string
      }>
      brands: Row<{ id: string; label: string }>
      outbound_numbers: Row<{
        id: string
        label: string
        e164: string
        display: string
        brand_id: string
        region: 'belfast' | 'london' | 'scotland' | 'wales' | 'other'
        kind: 'personal' | 'local' | 'main'
        agent_id: string | null
      }>
      contacts: Row<{
        id: string
        name: string
        company: string
        phone: string
        email: string
        avatar_url: string | null
        owner_id: string | null
        stage: 'new' | 'talking' | 'proposal' | 'won' | 'lost'
        source: string
        timezone: string
        quiet_hours: string
        do_not_call: boolean
        notes: string
        tags: string[]
        next_callback: string | null
        region: 'belfast' | 'london' | 'scotland' | 'wales' | 'other'
        brand_id: string
        industry: 'Dining' | 'Wellness' | 'Nightlife' | 'Retail' | 'Coffee' | 'Events' | null
        locality: string
        tps_status: 'unscreened' | 'clear' | 'tps_registered' | 'ctps_registered' | 'check_failed'
        tps_screened_at: string | null
        archived_at: string | null
        created_at: string
        updated_at: string
      }>
      dialer_lists: Row<{ id: string; name: string; emoji: string; sort_order: number }>
      dialer_list_members: Row<{ list_id: string; contact_id: string }>
      calls: Row<{
        id: string
        contact_id: string
        phone: string
        status: 'missed' | 'inbound' | 'outbound'
        extension: string | null
        channel: 'phone' | 'lark_video'
        occurred_at: string
        duration_sec: number | null
        recording_url: string | null
        outcome:
          | 'sold'
          | 'callback'
          | 'no_answer'
          | 'not_interested'
          | 'do_not_call'
          | 'wrong_number'
          | null
        agent_id: string | null
        from_number_id: string | null
        created_at: string
      }>
      call_feedback: Row<{
        id: string
        call_id: string
        agent_id: string
        admin_id: string
        note: string
        created_at: string
      }>
      scripts: Row<{
        id: string
        scope: 'everyone' | 'agent'
        agent_id: string | null
        title: string
        body: string
        updated_at: string
      }>
      objections: Row<{
        id: string
        brand_id: string | null
        label: string
        reply: string
        sort_order: number
      }>
      packages: Row<{
        id: string
        brand_id: string
        name: string
        blurb: string
        default_price: number
        default_monthly: number | null
      }>
      info_kits: Row<{
        id: string
        brand_id: string
        package_id: string | null
        name: string
        blurb: string
        subject: string
      }>
      contract_templates: Row<{
        id: string
        brand_id: string
        pay_type: 'one_off' | 'deposit' | 'monthly' | 'direct_debit'
        name: string
        body: string
        updated_at: string
      }>
      deals: Row<{
        id: string
        contact_id: string | null
        brand_id: string
        package_ids: string[]
        pay_type: 'one_off' | 'deposit' | 'monthly' | 'direct_debit'
        status:
          | 'draft'
          | 'contract_sent'
          | 'signed'
          | 'pay_sent'
          | 'deposit_paid'
          | 'active'
          | 'closed'
        client_name: string
        company: string
        start_date: string | null
        end_date: string | null
        total_price: number | null
        deposit_amount: number | null
        monthly_amount: number | null
        custom_notes: string
        agent_id: string | null
        signed_pdf_path: string | null
        stripe_customer_id: string | null
        stripe_subscription_id: string | null
        gocardless_mandate_id: string | null
        created_at: string
        updated_at: string
      }>
      commission_events: Row<{
        id: string
        deal_id: string
        agent_id: string
        amount: number
        basis: string
        status: string
        created_at: string
      }>
      referrals: Row<{
        id: string
        code: string
        referrer_contact_id: string
        referred_contact_id: string | null
        referred_deal_id: string | null
        status: 'pending' | 'referred' | 'won' | 'rewarded' | 'expired'
        reward_type: 'discount_percent' | 'discount_amount' | 'cash' | 'credit' | null
        reward_value: number | null
        notes: string
        created_at: string
        updated_at: string
      }>
    }
  }
}
