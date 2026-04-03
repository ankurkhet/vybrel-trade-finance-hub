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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      ai_analyses: {
        Row: {
          analysis_type: Database["public"]["Enums"]["ai_analysis_type"]
          annotations: Json | null
          borrower_id: string | null
          completed_at: string | null
          created_at: string
          findings: Json | null
          id: string
          organization_id: string
          requested_by: string | null
          risk_score: number | null
          source_contract_id: string | null
          source_document_id: string | null
          source_invoice_id: string | null
          status: Database["public"]["Enums"]["ai_analysis_status"]
          summary: string | null
          updated_at: string
        }
        Insert: {
          analysis_type: Database["public"]["Enums"]["ai_analysis_type"]
          annotations?: Json | null
          borrower_id?: string | null
          completed_at?: string | null
          created_at?: string
          findings?: Json | null
          id?: string
          organization_id: string
          requested_by?: string | null
          risk_score?: number | null
          source_contract_id?: string | null
          source_document_id?: string | null
          source_invoice_id?: string | null
          status?: Database["public"]["Enums"]["ai_analysis_status"]
          summary?: string | null
          updated_at?: string
        }
        Update: {
          analysis_type?: Database["public"]["Enums"]["ai_analysis_type"]
          annotations?: Json | null
          borrower_id?: string | null
          completed_at?: string | null
          created_at?: string
          findings?: Json | null
          id?: string
          organization_id?: string
          requested_by?: string | null
          risk_score?: number | null
          source_contract_id?: string | null
          source_document_id?: string | null
          source_invoice_id?: string | null
          status?: Database["public"]["Enums"]["ai_analysis_status"]
          summary?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_analyses_borrower_id_fkey"
            columns: ["borrower_id"]
            isOneToOne: false
            referencedRelation: "borrowers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_analyses_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_analyses_source_contract_id_fkey"
            columns: ["source_contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_analyses_source_document_id_fkey"
            columns: ["source_document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_analyses_source_invoice_id_fkey"
            columns: ["source_invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          id: string
          ip_address: string | null
          resource_id: string | null
          resource_type: string
          user_agent: string | null
          user_email: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: string | null
          resource_id?: string | null
          resource_type: string
          user_agent?: string | null
          user_email?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: string | null
          resource_id?: string | null
          resource_type?: string
          user_agent?: string | null
          user_email?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      borrower_counterparties: {
        Row: {
          borrower_id: string
          counterparty_id: string
          created_at: string
          id: string
          organization_id: string
        }
        Insert: {
          borrower_id: string
          counterparty_id: string
          created_at?: string
          id?: string
          organization_id: string
        }
        Update: {
          borrower_id?: string
          counterparty_id?: string
          created_at?: string
          id?: string
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "borrower_counterparties_borrower_id_fkey"
            columns: ["borrower_id"]
            isOneToOne: false
            referencedRelation: "borrowers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "borrower_counterparties_counterparty_id_fkey"
            columns: ["counterparty_id"]
            isOneToOne: false
            referencedRelation: "counterparties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "borrower_counterparties_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      borrower_directors: {
        Row: {
          borrower_id: string
          created_at: string
          date_of_birth: string | null
          email: string | null
          first_name: string
          id: string
          id_document_path: string | null
          last_name: string
          middle_name: string | null
          nationality: string | null
          organization_id: string
          phone: string | null
          residential_address: Json | null
          role: string
          shareholding_pct: number | null
          updated_at: string
        }
        Insert: {
          borrower_id: string
          created_at?: string
          date_of_birth?: string | null
          email?: string | null
          first_name: string
          id?: string
          id_document_path?: string | null
          last_name: string
          middle_name?: string | null
          nationality?: string | null
          organization_id: string
          phone?: string | null
          residential_address?: Json | null
          role?: string
          shareholding_pct?: number | null
          updated_at?: string
        }
        Update: {
          borrower_id?: string
          created_at?: string
          date_of_birth?: string | null
          email?: string | null
          first_name?: string
          id?: string
          id_document_path?: string | null
          last_name?: string
          middle_name?: string | null
          nationality?: string | null
          organization_id?: string
          phone?: string | null
          residential_address?: Json | null
          role?: string
          shareholding_pct?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "borrower_directors_borrower_id_fkey"
            columns: ["borrower_id"]
            isOneToOne: false
            referencedRelation: "borrowers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "borrower_directors_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      borrower_lenders: {
        Row: {
          borrower_id: string
          created_at: string
          currency: string
          facility_amount: number | null
          facility_nature: string | null
          id: string
          is_secured: boolean | null
          lender_name: string
          notes: string | null
          organization_id: string
          repayment_schedule: string | null
          updated_at: string
        }
        Insert: {
          borrower_id: string
          created_at?: string
          currency?: string
          facility_amount?: number | null
          facility_nature?: string | null
          id?: string
          is_secured?: boolean | null
          lender_name: string
          notes?: string | null
          organization_id: string
          repayment_schedule?: string | null
          updated_at?: string
        }
        Update: {
          borrower_id?: string
          created_at?: string
          currency?: string
          facility_amount?: number | null
          facility_nature?: string | null
          id?: string
          is_secured?: boolean | null
          lender_name?: string
          notes?: string | null
          organization_id?: string
          repayment_schedule?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "borrower_lenders_borrower_id_fkey"
            columns: ["borrower_id"]
            isOneToOne: false
            referencedRelation: "borrowers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "borrower_lenders_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      borrowers: {
        Row: {
          aml_cleared: boolean
          annual_turnover: number | null
          bank_details: Json | null
          broker_user_id: string | null
          company_name: string
          contact_email: string
          contact_name: string | null
          contact_phone: string | null
          country: string | null
          created_at: string
          credit_limit: number | null
          funding_status: string | null
          has_credit_facilities: boolean | null
          id: string
          incorporation_date: string | null
          industry: string | null
          is_part_of_group: boolean | null
          kyb_status: string | null
          kyc_completed: boolean
          linkedin_url: string | null
          metadata: Json | null
          nda_document_id: string | null
          nda_signed: boolean | null
          nda_signed_at: string | null
          num_employees: number | null
          onboarding_status: Database["public"]["Enums"]["onboarding_status"]
          organization_id: string
          other_invoice_facilities: string | null
          parent_company_name: string | null
          parent_shareholding_pct: number | null
          phone: string | null
          registered_address: Json | null
          registration_number: string | null
          sic_codes: string[] | null
          signatory_designation: string | null
          signatory_dob: string | null
          signatory_email: string | null
          signatory_is_director: boolean | null
          signatory_name: string | null
          trading_address: Json | null
          trading_name: string | null
          updated_at: string
          user_id: string | null
          vat_tax_id: string | null
          website: string | null
        }
        Insert: {
          aml_cleared?: boolean
          annual_turnover?: number | null
          bank_details?: Json | null
          broker_user_id?: string | null
          company_name: string
          contact_email: string
          contact_name?: string | null
          contact_phone?: string | null
          country?: string | null
          created_at?: string
          credit_limit?: number | null
          funding_status?: string | null
          has_credit_facilities?: boolean | null
          id?: string
          incorporation_date?: string | null
          industry?: string | null
          is_part_of_group?: boolean | null
          kyb_status?: string | null
          kyc_completed?: boolean
          linkedin_url?: string | null
          metadata?: Json | null
          nda_document_id?: string | null
          nda_signed?: boolean | null
          nda_signed_at?: string | null
          num_employees?: number | null
          onboarding_status?: Database["public"]["Enums"]["onboarding_status"]
          organization_id: string
          other_invoice_facilities?: string | null
          parent_company_name?: string | null
          parent_shareholding_pct?: number | null
          phone?: string | null
          registered_address?: Json | null
          registration_number?: string | null
          sic_codes?: string[] | null
          signatory_designation?: string | null
          signatory_dob?: string | null
          signatory_email?: string | null
          signatory_is_director?: boolean | null
          signatory_name?: string | null
          trading_address?: Json | null
          trading_name?: string | null
          updated_at?: string
          user_id?: string | null
          vat_tax_id?: string | null
          website?: string | null
        }
        Update: {
          aml_cleared?: boolean
          annual_turnover?: number | null
          bank_details?: Json | null
          broker_user_id?: string | null
          company_name?: string
          contact_email?: string
          contact_name?: string | null
          contact_phone?: string | null
          country?: string | null
          created_at?: string
          credit_limit?: number | null
          funding_status?: string | null
          has_credit_facilities?: boolean | null
          id?: string
          incorporation_date?: string | null
          industry?: string | null
          is_part_of_group?: boolean | null
          kyb_status?: string | null
          kyc_completed?: boolean
          linkedin_url?: string | null
          metadata?: Json | null
          nda_document_id?: string | null
          nda_signed?: boolean | null
          nda_signed_at?: string | null
          num_employees?: number | null
          onboarding_status?: Database["public"]["Enums"]["onboarding_status"]
          organization_id?: string
          other_invoice_facilities?: string | null
          parent_company_name?: string | null
          parent_shareholding_pct?: number | null
          phone?: string | null
          registered_address?: Json | null
          registration_number?: string | null
          sic_codes?: string[] | null
          signatory_designation?: string | null
          signatory_dob?: string | null
          signatory_email?: string | null
          signatory_is_director?: boolean | null
          signatory_name?: string | null
          trading_address?: Json | null
          trading_name?: string | null
          updated_at?: string
          user_id?: string | null
          vat_tax_id?: string | null
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "borrowers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      branding_profiles: {
        Row: {
          colors: Json
          created_at: string
          custom_domain: string | null
          email_footer_text: string | null
          email_from_name: string | null
          favicon_url: string | null
          font_family: string | null
          id: string
          is_active: boolean
          login_welcome_text: string | null
          logo_icon_url: string | null
          logo_url: string | null
          organization_id: string
          profile_name: string
          support_email: string | null
          updated_at: string
        }
        Insert: {
          colors?: Json
          created_at?: string
          custom_domain?: string | null
          email_footer_text?: string | null
          email_from_name?: string | null
          favicon_url?: string | null
          font_family?: string | null
          id?: string
          is_active?: boolean
          login_welcome_text?: string | null
          logo_icon_url?: string | null
          logo_url?: string | null
          organization_id: string
          profile_name?: string
          support_email?: string | null
          updated_at?: string
        }
        Update: {
          colors?: Json
          created_at?: string
          custom_domain?: string | null
          email_footer_text?: string | null
          email_from_name?: string | null
          favicon_url?: string | null
          font_family?: string | null
          id?: string
          is_active?: boolean
          login_welcome_text?: string | null
          logo_icon_url?: string | null
          logo_url?: string | null
          organization_id?: string
          profile_name?: string
          support_email?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "branding_profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      collections: {
        Row: {
          collected_amount: number
          collection_date: string
          confirmed_at: string | null
          confirmed_by: string | null
          created_at: string
          currency: string
          debtor_name: string | null
          id: string
          invoice_id: string
          metadata: Json | null
          notes: string | null
          organization_id: string
          payment_reference: string | null
          status: Database["public"]["Enums"]["collection_status"]
          updated_at: string
        }
        Insert: {
          collected_amount: number
          collection_date?: string
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          currency?: string
          debtor_name?: string | null
          id?: string
          invoice_id: string
          metadata?: Json | null
          notes?: string | null
          organization_id: string
          payment_reference?: string | null
          status?: Database["public"]["Enums"]["collection_status"]
          updated_at?: string
        }
        Update: {
          collected_amount?: number
          collection_date?: string
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          currency?: string
          debtor_name?: string | null
          id?: string
          invoice_id?: string
          metadata?: Json | null
          notes?: string | null
          organization_id?: string
          payment_reference?: string | null
          status?: Database["public"]["Enums"]["collection_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "collections_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collections_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      contracts: {
        Row: {
          borrower_id: string
          contract_number: string | null
          contract_value: number | null
          counterparty: string | null
          created_at: string
          currency: string | null
          document_id: string | null
          end_date: string | null
          id: string
          organization_id: string
          risk_flags: Json | null
          start_date: string | null
          status: string
          terms_summary: Json | null
          title: string
          updated_at: string
        }
        Insert: {
          borrower_id: string
          contract_number?: string | null
          contract_value?: number | null
          counterparty?: string | null
          created_at?: string
          currency?: string | null
          document_id?: string | null
          end_date?: string | null
          id?: string
          organization_id: string
          risk_flags?: Json | null
          start_date?: string | null
          status?: string
          terms_summary?: Json | null
          title: string
          updated_at?: string
        }
        Update: {
          borrower_id?: string
          contract_number?: string | null
          contract_value?: number | null
          counterparty?: string | null
          created_at?: string
          currency?: string | null
          document_id?: string | null
          end_date?: string | null
          id?: string
          organization_id?: string
          risk_flags?: Json | null
          start_date?: string | null
          status?: string
          terms_summary?: Json | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contracts_borrower_id_fkey"
            columns: ["borrower_id"]
            isOneToOne: false
            referencedRelation: "borrowers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      counterparties: {
        Row: {
          company_name: string
          contact_email: string
          contact_name: string | null
          contact_phone: string | null
          country: string | null
          created_at: string
          id: string
          organization_id: string
          registration_number: string | null
          updated_at: string
        }
        Insert: {
          company_name: string
          contact_email: string
          contact_name?: string | null
          contact_phone?: string | null
          country?: string | null
          created_at?: string
          id?: string
          organization_id: string
          registration_number?: string | null
          updated_at?: string
        }
        Update: {
          company_name?: string
          contact_email?: string
          contact_name?: string | null
          contact_phone?: string | null
          country?: string | null
          created_at?: string
          id?: string
          organization_id?: string
          registration_number?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "counterparties_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_committee_applications: {
        Row: {
          application_number: string | null
          borrower_id: string | null
          created_at: string
          created_by: string | null
          credit_memo_id: string | null
          debtor_name: string | null
          decision: string | null
          decision_notes: string | null
          id: string
          metadata: Json | null
          organization_id: string
          parent_application_id: string | null
          reviewed_at: string | null
          status: string
          submitted_at: string | null
          type: string
          type_enum: Database["public"]["Enums"]["application_type"] | null
          updated_at: string
        }
        Insert: {
          application_number?: string | null
          borrower_id?: string | null
          created_at?: string
          created_by?: string | null
          credit_memo_id?: string | null
          debtor_name?: string | null
          decision?: string | null
          decision_notes?: string | null
          id?: string
          metadata?: Json | null
          organization_id: string
          parent_application_id?: string | null
          reviewed_at?: string | null
          status?: string
          submitted_at?: string | null
          type: string
          type_enum?: Database["public"]["Enums"]["application_type"] | null
          updated_at?: string
        }
        Update: {
          application_number?: string | null
          borrower_id?: string | null
          created_at?: string
          created_by?: string | null
          credit_memo_id?: string | null
          debtor_name?: string | null
          decision?: string | null
          decision_notes?: string | null
          id?: string
          metadata?: Json | null
          organization_id?: string
          parent_application_id?: string | null
          reviewed_at?: string | null
          status?: string
          submitted_at?: string | null
          type?: string
          type_enum?: Database["public"]["Enums"]["application_type"] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_committee_applications_borrower_id_fkey"
            columns: ["borrower_id"]
            isOneToOne: false
            referencedRelation: "borrowers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_committee_applications_credit_memo_id_fkey"
            columns: ["credit_memo_id"]
            isOneToOne: false
            referencedRelation: "credit_memos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_committee_applications_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_committee_applications_parent_application_id_fkey"
            columns: ["parent_application_id"]
            isOneToOne: false
            referencedRelation: "credit_committee_applications"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_committee_config: {
        Row: {
          minimum_votes_required: number
          organization_id: string
          quorum_type: string
          total_active_members: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          minimum_votes_required?: number
          organization_id: string
          quorum_type?: string
          total_active_members?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          minimum_votes_required?: number
          organization_id?: string
          quorum_type?: string
          total_active_members?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "credit_committee_config_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_committee_info_requests: {
        Row: {
          answer: string | null
          answered_at: string | null
          application_id: string
          created_at: string
          id: string
          question: string
          requested_by: string | null
          requested_to: string | null
          status: string
        }
        Insert: {
          answer?: string | null
          answered_at?: string | null
          application_id: string
          created_at?: string
          id?: string
          question: string
          requested_by?: string | null
          requested_to?: string | null
          status?: string
        }
        Update: {
          answer?: string | null
          answered_at?: string | null
          application_id?: string
          created_at?: string
          id?: string
          question?: string
          requested_by?: string | null
          requested_to?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_committee_info_requests_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "credit_committee_applications"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_committee_members: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          organization_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          organization_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          organization_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_committee_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_committee_minutes: {
        Row: {
          application_id: string
          attachments: Json | null
          attendees: string[] | null
          created_at: string
          id: string
          meeting_date: string | null
          minutes_text: string | null
          updated_at: string
          votes: Json | null
        }
        Insert: {
          application_id: string
          attachments?: Json | null
          attendees?: string[] | null
          created_at?: string
          id?: string
          meeting_date?: string | null
          minutes_text?: string | null
          updated_at?: string
          votes?: Json | null
        }
        Update: {
          application_id?: string
          attachments?: Json | null
          attendees?: string[] | null
          created_at?: string
          id?: string
          meeting_date?: string | null
          minutes_text?: string | null
          updated_at?: string
          votes?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "credit_committee_minutes_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "credit_committee_applications"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_committee_votes: {
        Row: {
          application_id: string
          conditions_text: string | null
          created_at: string
          id: string
          product_limits: Json | null
          user_id: string
          vote: Database["public"]["Enums"]["cc_vote_type"]
          voted_at: string
        }
        Insert: {
          application_id: string
          conditions_text?: string | null
          created_at?: string
          id?: string
          product_limits?: Json | null
          user_id: string
          vote: Database["public"]["Enums"]["cc_vote_type"]
          voted_at?: string
        }
        Update: {
          application_id?: string
          conditions_text?: string | null
          created_at?: string
          id?: string
          product_limits?: Json | null
          user_id?: string
          vote?: Database["public"]["Enums"]["cc_vote_type"]
          voted_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_committee_votes_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "credit_committee_applications"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_limit_recommendations: {
        Row: {
          application_id: string
          borrower_id: string
          counterparty_limits: Json | null
          created_at: string
          created_by: string | null
          currency: string
          id: string
          limit_payables_finance: number | null
          limit_receivables_purchase: number | null
          limit_reverse_factoring: number | null
          organization_id: string
          recommended_overall_limit: number
          recommended_rate: number | null
          risk_grade: string | null
          status: Database["public"]["Enums"]["recommendation_status"]
          updated_at: string
          valid_from: string | null
          valid_to: string | null
        }
        Insert: {
          application_id: string
          borrower_id: string
          counterparty_limits?: Json | null
          created_at?: string
          created_by?: string | null
          currency?: string
          id?: string
          limit_payables_finance?: number | null
          limit_receivables_purchase?: number | null
          limit_reverse_factoring?: number | null
          organization_id: string
          recommended_overall_limit?: number
          recommended_rate?: number | null
          risk_grade?: string | null
          status?: Database["public"]["Enums"]["recommendation_status"]
          updated_at?: string
          valid_from?: string | null
          valid_to?: string | null
        }
        Update: {
          application_id?: string
          borrower_id?: string
          counterparty_limits?: Json | null
          created_at?: string
          created_by?: string | null
          currency?: string
          id?: string
          limit_payables_finance?: number | null
          limit_receivables_purchase?: number | null
          limit_reverse_factoring?: number | null
          organization_id?: string
          recommended_overall_limit?: number
          recommended_rate?: number | null
          risk_grade?: string | null
          status?: Database["public"]["Enums"]["recommendation_status"]
          updated_at?: string
          valid_from?: string | null
          valid_to?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "credit_limit_recommendations_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "credit_committee_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_limit_recommendations_borrower_id_fkey"
            columns: ["borrower_id"]
            isOneToOne: false
            referencedRelation: "borrowers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_limit_recommendations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_memos: {
        Row: {
          ai_analysis_id: string | null
          ai_draft: string | null
          analyst_edits: string | null
          approved_at: string | null
          approved_by: string | null
          borrower_id: string
          borrower_profile: Json | null
          created_at: string
          final_memo: string | null
          id: string
          memo_number: string | null
          organization_id: string
          recommended_limit: number | null
          reviewed_at: string | null
          reviewed_by: string | null
          risk_rating: string | null
          status: Database["public"]["Enums"]["credit_memo_status"]
          transaction_type: string | null
          updated_at: string
        }
        Insert: {
          ai_analysis_id?: string | null
          ai_draft?: string | null
          analyst_edits?: string | null
          approved_at?: string | null
          approved_by?: string | null
          borrower_id: string
          borrower_profile?: Json | null
          created_at?: string
          final_memo?: string | null
          id?: string
          memo_number?: string | null
          organization_id: string
          recommended_limit?: number | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          risk_rating?: string | null
          status?: Database["public"]["Enums"]["credit_memo_status"]
          transaction_type?: string | null
          updated_at?: string
        }
        Update: {
          ai_analysis_id?: string | null
          ai_draft?: string | null
          analyst_edits?: string | null
          approved_at?: string | null
          approved_by?: string | null
          borrower_id?: string
          borrower_profile?: Json | null
          created_at?: string
          final_memo?: string | null
          id?: string
          memo_number?: string | null
          organization_id?: string
          recommended_limit?: number | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          risk_rating?: string | null
          status?: Database["public"]["Enums"]["credit_memo_status"]
          transaction_type?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_memos_ai_analysis_id_fkey"
            columns: ["ai_analysis_id"]
            isOneToOne: false
            referencedRelation: "ai_analyses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_memos_borrower_id_fkey"
            columns: ["borrower_id"]
            isOneToOne: false
            referencedRelation: "borrowers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_memos_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      dashboard_preferences: {
        Row: {
          created_at: string
          id: string
          updated_at: string
          user_id: string
          widget_config: Json
        }
        Insert: {
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
          widget_config?: Json
        }
        Update: {
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
          widget_config?: Json
        }
        Relationships: []
      }
      disbursement_memos: {
        Row: {
          advance_amount: number
          advance_rate: number | null
          approved_at: string | null
          approved_by: string | null
          borrower_id: string
          counterparty_name: string | null
          created_at: string
          disbursed_at: string | null
          disbursement_amount: number
          facility_request_id: string | null
          funder_fee: number | null
          funder_name: string | null
          id: string
          invoice_date: string | null
          invoice_due_date: string | null
          invoice_id: string
          invoice_number: string | null
          invoice_value: number
          memo_number: string | null
          metadata: Json | null
          organization_id: string
          originator_fee: number | null
          payment_date: string | null
          payment_reference: string | null
          retained_amount: number
          status: string
          status_enum: Database["public"]["Enums"]["disbursement_status"] | null
          total_fee: number | null
          updated_at: string
        }
        Insert: {
          advance_amount: number
          advance_rate?: number | null
          approved_at?: string | null
          approved_by?: string | null
          borrower_id: string
          counterparty_name?: string | null
          created_at?: string
          disbursed_at?: string | null
          disbursement_amount: number
          facility_request_id?: string | null
          funder_fee?: number | null
          funder_name?: string | null
          id?: string
          invoice_date?: string | null
          invoice_due_date?: string | null
          invoice_id: string
          invoice_number?: string | null
          invoice_value: number
          memo_number?: string | null
          metadata?: Json | null
          organization_id: string
          originator_fee?: number | null
          payment_date?: string | null
          payment_reference?: string | null
          retained_amount: number
          status?: string
          status_enum?:
            | Database["public"]["Enums"]["disbursement_status"]
            | null
          total_fee?: number | null
          updated_at?: string
        }
        Update: {
          advance_amount?: number
          advance_rate?: number | null
          approved_at?: string | null
          approved_by?: string | null
          borrower_id?: string
          counterparty_name?: string | null
          created_at?: string
          disbursed_at?: string | null
          disbursement_amount?: number
          facility_request_id?: string | null
          funder_fee?: number | null
          funder_name?: string | null
          id?: string
          invoice_date?: string | null
          invoice_due_date?: string | null
          invoice_id?: string
          invoice_number?: string | null
          invoice_value?: number
          memo_number?: string | null
          metadata?: Json | null
          organization_id?: string
          originator_fee?: number | null
          payment_date?: string | null
          payment_reference?: string | null
          retained_amount?: number
          status?: string
          status_enum?:
            | Database["public"]["Enums"]["disbursement_status"]
            | null
          total_fee?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "disbursement_memos_borrower_id_fkey"
            columns: ["borrower_id"]
            isOneToOne: false
            referencedRelation: "borrowers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "disbursement_memos_facility_request_id_fkey"
            columns: ["facility_request_id"]
            isOneToOne: false
            referencedRelation: "facility_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "disbursement_memos_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "disbursement_memos_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      document_templates: {
        Row: {
          content: string | null
          created_at: string
          created_by: string | null
          file_path: string | null
          id: string
          is_active: boolean
          name: string
          organization_id: string
          template_type: string
          updated_at: string
        }
        Insert: {
          content?: string | null
          created_at?: string
          created_by?: string | null
          file_path?: string | null
          id?: string
          is_active?: boolean
          name: string
          organization_id: string
          template_type?: string
          updated_at?: string
        }
        Update: {
          content?: string | null
          created_at?: string
          created_by?: string | null
          file_path?: string | null
          id?: string
          is_active?: boolean
          name?: string
          organization_id?: string
          template_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_templates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          borrower_id: string | null
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          document_type: Database["public"]["Enums"]["document_type"]
          file_name: string
          file_path: string
          file_size: number | null
          id: string
          is_deleted: boolean
          metadata: Json | null
          mime_type: string | null
          notes: string | null
          organization_id: string
          parent_document_id: string | null
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
          uploaded_by: string | null
          version: number
        }
        Insert: {
          borrower_id?: string | null
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          document_type: Database["public"]["Enums"]["document_type"]
          file_name: string
          file_path: string
          file_size?: number | null
          id?: string
          is_deleted?: boolean
          metadata?: Json | null
          mime_type?: string | null
          notes?: string | null
          organization_id: string
          parent_document_id?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          uploaded_by?: string | null
          version?: number
        }
        Update: {
          borrower_id?: string | null
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          document_type?: Database["public"]["Enums"]["document_type"]
          file_name?: string
          file_path?: string
          file_size?: number | null
          id?: string
          is_deleted?: boolean
          metadata?: Json | null
          mime_type?: string | null
          notes?: string | null
          organization_id?: string
          parent_document_id?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          uploaded_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "documents_borrower_id_fkey"
            columns: ["borrower_id"]
            isOneToOne: false
            referencedRelation: "borrowers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_parent_document_id_fkey"
            columns: ["parent_document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      facility_requests: {
        Row: {
          advance_rate: number | null
          amount_requested: number | null
          approved_amount: number | null
          approved_at: string | null
          approved_by: string | null
          approved_tenor_months: number | null
          borrower_id: string
          created_at: string
          currency: string
          facility_type: string
          final_discounting_rate: number | null
          funder_base_rate: number | null
          funder_margin: number | null
          id: string
          metadata: Json | null
          organization_id: string
          originator_margin: number | null
          overdue_fee_pct: number | null
          pricing_notes: string | null
          rejection_reason: string | null
          status: string
          tenor_months: number | null
          updated_at: string
        }
        Insert: {
          advance_rate?: number | null
          amount_requested?: number | null
          approved_amount?: number | null
          approved_at?: string | null
          approved_by?: string | null
          approved_tenor_months?: number | null
          borrower_id: string
          created_at?: string
          currency?: string
          facility_type: string
          final_discounting_rate?: number | null
          funder_base_rate?: number | null
          funder_margin?: number | null
          id?: string
          metadata?: Json | null
          organization_id: string
          originator_margin?: number | null
          overdue_fee_pct?: number | null
          pricing_notes?: string | null
          rejection_reason?: string | null
          status?: string
          tenor_months?: number | null
          updated_at?: string
        }
        Update: {
          advance_rate?: number | null
          amount_requested?: number | null
          approved_amount?: number | null
          approved_at?: string | null
          approved_by?: string | null
          approved_tenor_months?: number | null
          borrower_id?: string
          created_at?: string
          currency?: string
          facility_type?: string
          final_discounting_rate?: number | null
          funder_base_rate?: number | null
          funder_margin?: number | null
          id?: string
          metadata?: Json | null
          organization_id?: string
          originator_margin?: number | null
          overdue_fee_pct?: number | null
          pricing_notes?: string | null
          rejection_reason?: string | null
          status?: string
          tenor_months?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "facility_requests_borrower_id_fkey"
            columns: ["borrower_id"]
            isOneToOne: false
            referencedRelation: "borrowers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facility_requests_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      funder_kyc: {
        Row: {
          aml_policy_confirmed: boolean | null
          bank_account_name: string | null
          bank_account_number: string | null
          bank_iban: string | null
          bank_name: string | null
          bank_sort_code: string | null
          bank_swift: string | null
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          country_of_incorporation: string | null
          created_at: string
          entity_name: string
          entity_type: string
          id: string
          licence_number: string | null
          notes: string | null
          organization_id: string | null
          pep_screening_confirmed: boolean | null
          registered_address: string | null
          registration_number: string | null
          regulator_name: string | null
          regulatory_status: string | null
          sanctions_screening_confirmed: boolean | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          aml_policy_confirmed?: boolean | null
          bank_account_name?: string | null
          bank_account_number?: string | null
          bank_iban?: string | null
          bank_name?: string | null
          bank_sort_code?: string | null
          bank_swift?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          country_of_incorporation?: string | null
          created_at?: string
          entity_name?: string
          entity_type?: string
          id?: string
          licence_number?: string | null
          notes?: string | null
          organization_id?: string | null
          pep_screening_confirmed?: boolean | null
          registered_address?: string | null
          registration_number?: string | null
          regulator_name?: string | null
          regulatory_status?: string | null
          sanctions_screening_confirmed?: boolean | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          aml_policy_confirmed?: boolean | null
          bank_account_name?: string | null
          bank_account_number?: string | null
          bank_iban?: string | null
          bank_name?: string | null
          bank_sort_code?: string | null
          bank_swift?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          country_of_incorporation?: string | null
          created_at?: string
          entity_name?: string
          entity_type?: string
          id?: string
          licence_number?: string | null
          notes?: string | null
          organization_id?: string | null
          pep_screening_confirmed?: boolean | null
          registered_address?: string | null
          registration_number?: string | null
          regulator_name?: string | null
          regulatory_status?: string | null
          sanctions_screening_confirmed?: boolean | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      funder_limits: {
        Row: {
          approval_notes: string | null
          base_rate_type: string | null
          base_rate_value: number | null
          borrower_id: string
          counterparty_id: string | null
          counterparty_name: string | null
          created_at: string
          currency: string
          funder_approved_amount: number | null
          funder_user_id: string
          id: string
          limit_amount: number
          limit_payable_finance: number | null
          limit_receivables_purchase: number | null
          limit_reverse_factoring: number | null
          margin_pct: number | null
          organization_id: string
          overall_limit: number | null
          referral_id: string | null
          scope: string | null
          status: string
          updated_at: string
          valid_from: string | null
          valid_to: string | null
        }
        Insert: {
          approval_notes?: string | null
          base_rate_type?: string | null
          base_rate_value?: number | null
          borrower_id: string
          counterparty_id?: string | null
          counterparty_name?: string | null
          created_at?: string
          currency?: string
          funder_approved_amount?: number | null
          funder_user_id: string
          id?: string
          limit_amount?: number
          limit_payable_finance?: number | null
          limit_receivables_purchase?: number | null
          limit_reverse_factoring?: number | null
          margin_pct?: number | null
          organization_id: string
          overall_limit?: number | null
          referral_id?: string | null
          scope?: string | null
          status?: string
          updated_at?: string
          valid_from?: string | null
          valid_to?: string | null
        }
        Update: {
          approval_notes?: string | null
          base_rate_type?: string | null
          base_rate_value?: number | null
          borrower_id?: string
          counterparty_id?: string | null
          counterparty_name?: string | null
          created_at?: string
          currency?: string
          funder_approved_amount?: number | null
          funder_user_id?: string
          id?: string
          limit_amount?: number
          limit_payable_finance?: number | null
          limit_receivables_purchase?: number | null
          limit_reverse_factoring?: number | null
          margin_pct?: number | null
          organization_id?: string
          overall_limit?: number | null
          referral_id?: string | null
          scope?: string | null
          status?: string
          updated_at?: string
          valid_from?: string | null
          valid_to?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "funder_limits_borrower_id_fkey"
            columns: ["borrower_id"]
            isOneToOne: false
            referencedRelation: "borrowers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funder_limits_counterparty_id_fkey"
            columns: ["counterparty_id"]
            isOneToOne: false
            referencedRelation: "counterparties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funder_limits_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funder_limits_referral_id_fkey"
            columns: ["referral_id"]
            isOneToOne: false
            referencedRelation: "funder_referrals"
            referencedColumns: ["id"]
          },
        ]
      }
      funder_referrals: {
        Row: {
          counterparty_scope: string | null
          created_at: string
          created_by: string | null
          funder_approved_amount: number | null
          funder_notes: string | null
          funder_user_id: string
          id: string
          organization_id: string
          recommendation_id: string
          referred_at: string
          referred_limit_amount: number
          referred_limit_pf: number | null
          referred_limit_rf: number | null
          referred_limit_rp: number | null
          referred_rate: number | null
          responded_at: string | null
          status: Database["public"]["Enums"]["referral_status"]
          updated_at: string
        }
        Insert: {
          counterparty_scope?: string | null
          created_at?: string
          created_by?: string | null
          funder_approved_amount?: number | null
          funder_notes?: string | null
          funder_user_id: string
          id?: string
          organization_id: string
          recommendation_id: string
          referred_at?: string
          referred_limit_amount?: number
          referred_limit_pf?: number | null
          referred_limit_rf?: number | null
          referred_limit_rp?: number | null
          referred_rate?: number | null
          responded_at?: string | null
          status?: Database["public"]["Enums"]["referral_status"]
          updated_at?: string
        }
        Update: {
          counterparty_scope?: string | null
          created_at?: string
          created_by?: string | null
          funder_approved_amount?: number | null
          funder_notes?: string | null
          funder_user_id?: string
          id?: string
          organization_id?: string
          recommendation_id?: string
          referred_at?: string
          referred_limit_amount?: number
          referred_limit_pf?: number | null
          referred_limit_rf?: number | null
          referred_limit_rp?: number | null
          referred_rate?: number | null
          responded_at?: string | null
          status?: Database["public"]["Enums"]["referral_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "funder_referrals_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funder_referrals_recommendation_id_fkey"
            columns: ["recommendation_id"]
            isOneToOne: false
            referencedRelation: "credit_limit_recommendations"
            referencedColumns: ["id"]
          },
        ]
      }
      funder_relationships: {
        Row: {
          agreement_status: string
          base_rate_type: string | null
          created_at: string
          funder_user_id: string
          id: string
          margin_payable_finance: number | null
          margin_receivable_purchase: number | null
          margin_reverse_factoring: number | null
          master_base_rate_type: string | null
          master_base_rate_value: number | null
          master_margin_pct: number | null
          organization_id: string
          updated_at: string
        }
        Insert: {
          agreement_status?: string
          base_rate_type?: string | null
          created_at?: string
          funder_user_id: string
          id?: string
          margin_payable_finance?: number | null
          margin_receivable_purchase?: number | null
          margin_reverse_factoring?: number | null
          master_base_rate_type?: string | null
          master_base_rate_value?: number | null
          master_margin_pct?: number | null
          organization_id: string
          updated_at?: string
        }
        Update: {
          agreement_status?: string
          base_rate_type?: string | null
          created_at?: string
          funder_user_id?: string
          id?: string
          margin_payable_finance?: number | null
          margin_receivable_purchase?: number | null
          margin_reverse_factoring?: number | null
          master_base_rate_type?: string | null
          master_base_rate_value?: number | null
          master_margin_pct?: number | null
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "funder_relationships_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      funding_offers: {
        Row: {
          accepted_at: string | null
          created_at: string
          discount_rate: number | null
          funder_user_id: string
          id: string
          invoice_id: string
          notes: string | null
          offer_amount: number
          offered_at: string
          organization_id: string
          status: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          discount_rate?: number | null
          funder_user_id: string
          id?: string
          invoice_id: string
          notes?: string | null
          offer_amount: number
          offered_at?: string
          organization_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          discount_rate?: number | null
          funder_user_id?: string
          id?: string
          invoice_id?: string
          notes?: string | null
          offer_amount?: number
          offered_at?: string
          organization_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "funding_offers_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funding_offers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      invitations: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string | null
          organization_id: string
          role: Database["public"]["Enums"]["app_role"]
          token: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          organization_id: string
          role: Database["public"]["Enums"]["app_role"]
          token?: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          organization_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "invitations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_acceptances: {
        Row: {
          accepted_by_email: string | null
          accepted_by_user_id: string | null
          created_at: string
          document_id: string | null
          id: string
          invoice_id: string
          method: Database["public"]["Enums"]["acceptance_method"]
          notes: string | null
          organization_id: string
          status: Database["public"]["Enums"]["acceptance_status"]
          updated_at: string
        }
        Insert: {
          accepted_by_email?: string | null
          accepted_by_user_id?: string | null
          created_at?: string
          document_id?: string | null
          id?: string
          invoice_id: string
          method: Database["public"]["Enums"]["acceptance_method"]
          notes?: string | null
          organization_id: string
          status?: Database["public"]["Enums"]["acceptance_status"]
          updated_at?: string
        }
        Update: {
          accepted_by_email?: string | null
          accepted_by_user_id?: string | null
          created_at?: string
          document_id?: string | null
          id?: string
          invoice_id?: string
          method?: Database["public"]["Enums"]["acceptance_method"]
          notes?: string | null
          organization_id?: string
          status?: Database["public"]["Enums"]["acceptance_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_acceptances_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_acceptances_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_acceptances_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_submission_documents: {
        Row: {
          ai_confidence: number | null
          ai_extracted: Json | null
          ai_tag: string | null
          borrower_comment: string | null
          created_at: string
          document_id: string
          id: string
          submission_id: string
        }
        Insert: {
          ai_confidence?: number | null
          ai_extracted?: Json | null
          ai_tag?: string | null
          borrower_comment?: string | null
          created_at?: string
          document_id: string
          id?: string
          submission_id: string
        }
        Update: {
          ai_confidence?: number | null
          ai_extracted?: Json | null
          ai_tag?: string | null
          borrower_comment?: string | null
          created_at?: string
          document_id?: string
          id?: string
          submission_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_submission_documents_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_submission_documents_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "invoice_submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_submissions: {
        Row: {
          ai_analysis: Json | null
          borrower_comments: Json | null
          borrower_id: string
          created_at: string
          document_comments: Json | null
          extracted_data: Json | null
          funding_id: string | null
          id: string
          invoice_id: string | null
          observations: Json | null
          organization_id: string
          overall_comment: string | null
          request_number: string
          status: string
          submitted_at: string | null
          submitted_by: string | null
          updated_at: string
        }
        Insert: {
          ai_analysis?: Json | null
          borrower_comments?: Json | null
          borrower_id: string
          created_at?: string
          document_comments?: Json | null
          extracted_data?: Json | null
          funding_id?: string | null
          id?: string
          invoice_id?: string | null
          observations?: Json | null
          organization_id: string
          overall_comment?: string | null
          request_number: string
          status?: string
          submitted_at?: string | null
          submitted_by?: string | null
          updated_at?: string
        }
        Update: {
          ai_analysis?: Json | null
          borrower_comments?: Json | null
          borrower_id?: string
          created_at?: string
          document_comments?: Json | null
          extracted_data?: Json | null
          funding_id?: string | null
          id?: string
          invoice_id?: string | null
          observations?: Json | null
          organization_id?: string
          overall_comment?: string | null
          request_number?: string
          status?: string
          submitted_at?: string | null
          submitted_by?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_submissions_borrower_id_fkey"
            columns: ["borrower_id"]
            isOneToOne: false
            referencedRelation: "borrowers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_submissions_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_submissions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          acceptance_status:
            | Database["public"]["Enums"]["acceptance_status"]
            | null
          acceptance_token: string | null
          accrued_late_fees: number | null
          amount: number
          borrower_id: string
          contract_id: string | null
          counterparty_email: string | null
          counterparty_name: string | null
          created_at: string
          currency: string | null
          debtor_name: string
          document_id: string | null
          due_date: string
          id: string
          invoice_number: string
          issue_date: string
          last_dunning_date: string | null
          match_details: Json | null
          match_score: number | null
          organization_id: string
          product_type: Database["public"]["Enums"]["product_type"] | null
          requires_counterparty_acceptance: boolean | null
          status: string
          updated_at: string
        }
        Insert: {
          acceptance_status?:
            | Database["public"]["Enums"]["acceptance_status"]
            | null
          acceptance_token?: string | null
          accrued_late_fees?: number | null
          amount: number
          borrower_id: string
          contract_id?: string | null
          counterparty_email?: string | null
          counterparty_name?: string | null
          created_at?: string
          currency?: string | null
          debtor_name: string
          document_id?: string | null
          due_date: string
          id?: string
          invoice_number: string
          issue_date: string
          last_dunning_date?: string | null
          match_details?: Json | null
          match_score?: number | null
          organization_id: string
          product_type?: Database["public"]["Enums"]["product_type"] | null
          requires_counterparty_acceptance?: boolean | null
          status?: string
          updated_at?: string
        }
        Update: {
          acceptance_status?:
            | Database["public"]["Enums"]["acceptance_status"]
            | null
          acceptance_token?: string | null
          accrued_late_fees?: number | null
          amount?: number
          borrower_id?: string
          contract_id?: string | null
          counterparty_email?: string | null
          counterparty_name?: string | null
          created_at?: string
          currency?: string | null
          debtor_name?: string
          document_id?: string | null
          due_date?: string
          id?: string
          invoice_number?: string
          issue_date?: string
          last_dunning_date?: string | null
          match_details?: Json | null
          match_score?: number | null
          organization_id?: string
          product_type?: Database["public"]["Enums"]["product_type"] | null
          requires_counterparty_acceptance?: boolean | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_borrower_id_fkey"
            columns: ["borrower_id"]
            isOneToOne: false
            referencedRelation: "borrowers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          body: string
          created_at: string
          id: string
          is_read: boolean
          message_type: string
          organization_id: string | null
          parent_message_id: string | null
          recipient_id: string
          related_entity_id: string | null
          related_entity_type: string | null
          sender_id: string
          subject: string
          updated_at: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          is_read?: boolean
          message_type?: string
          organization_id?: string | null
          parent_message_id?: string | null
          recipient_id: string
          related_entity_id?: string | null
          related_entity_type?: string | null
          sender_id: string
          subject: string
          updated_at?: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          is_read?: boolean
          message_type?: string
          organization_id?: string | null
          parent_message_id?: string | null
          recipient_id?: string
          related_entity_id?: string | null
          related_entity_type?: string | null
          sender_id?: string
          subject?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_parent_message_id_fkey"
            columns: ["parent_message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      org_contacts: {
        Row: {
          created_at: string
          designation: string
          email: string
          full_name: string
          id: string
          invited_at: string | null
          is_primary: boolean
          organization_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          designation: string
          email: string
          full_name: string
          id?: string
          invited_at?: string | null
          is_primary?: boolean
          organization_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          designation?: string
          email?: string
          full_name?: string
          id?: string
          invited_at?: string | null
          is_primary?: boolean
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_contacts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      org_documents: {
        Row: {
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          document_label: string
          document_type: string
          file_name: string
          file_path: string
          file_size: number | null
          id: string
          is_deleted: boolean
          mime_type: string | null
          notes: string | null
          organization_id: string
          parent_document_id: string | null
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
          uploaded_by: string | null
          version: number
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          document_label: string
          document_type: string
          file_name: string
          file_path: string
          file_size?: number | null
          id?: string
          is_deleted?: boolean
          mime_type?: string | null
          notes?: string | null
          organization_id: string
          parent_document_id?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          uploaded_by?: string | null
          version?: number
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          document_label?: string
          document_type?: string
          file_name?: string
          file_path?: string
          file_size?: number | null
          id?: string
          is_deleted?: boolean
          mime_type?: string | null
          notes?: string | null
          organization_id?: string
          parent_document_id?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          uploaded_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "org_documents_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_documents_parent_document_id_fkey"
            columns: ["parent_document_id"]
            isOneToOne: false
            referencedRelation: "org_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_settings: {
        Row: {
          auto_approve_below: number | null
          created_at: string
          default_credit_limit: number | null
          id: string
          max_credit_limit: number | null
          notes: string | null
          organization_id: string
          required_document_types: string[] | null
          review_threshold: number | null
          updated_at: string
        }
        Insert: {
          auto_approve_below?: number | null
          created_at?: string
          default_credit_limit?: number | null
          id?: string
          max_credit_limit?: number | null
          notes?: string | null
          organization_id: string
          required_document_types?: string[] | null
          review_threshold?: number | null
          updated_at?: string
        }
        Update: {
          auto_approve_below?: number | null
          created_at?: string
          default_credit_limit?: number | null
          id?: string
          max_credit_limit?: number | null
          notes?: string | null
          organization_id?: string
          required_document_types?: string[] | null
          review_threshold?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_settings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          branding: Json | null
          created_at: string
          custom_domain: string | null
          id: string
          is_active: boolean
          labelling_mode: Database["public"]["Enums"]["labelling_mode"]
          name: string
          onboarding_status: Database["public"]["Enums"]["org_onboarding_status"]
          slug: string
          updated_at: string
        }
        Insert: {
          branding?: Json | null
          created_at?: string
          custom_domain?: string | null
          id?: string
          is_active?: boolean
          labelling_mode?: Database["public"]["Enums"]["labelling_mode"]
          name: string
          onboarding_status?: Database["public"]["Enums"]["org_onboarding_status"]
          slug: string
          updated_at?: string
        }
        Update: {
          branding?: Json | null
          created_at?: string
          custom_domain?: string | null
          id?: string
          is_active?: boolean
          labelling_mode?: Database["public"]["Enums"]["labelling_mode"]
          name?: string
          onboarding_status?: Database["public"]["Enums"]["org_onboarding_status"]
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      product_fee_configs: {
        Row: {
          broker_fee_pct: number | null
          created_at: string
          default_discount_rate: number
          id: string
          notes: string | null
          organization_id: string
          originator_fee_pct: number
          payment_instructions: Json | null
          platform_fee_pct: number
          product_type: Database["public"]["Enums"]["product_type"]
          settlement_days: number
          settlement_timing: Database["public"]["Enums"]["settlement_timing"]
          updated_at: string
        }
        Insert: {
          broker_fee_pct?: number | null
          created_at?: string
          default_discount_rate?: number
          id?: string
          notes?: string | null
          organization_id: string
          originator_fee_pct?: number
          payment_instructions?: Json | null
          platform_fee_pct?: number
          product_type: Database["public"]["Enums"]["product_type"]
          settlement_days?: number
          settlement_timing?: Database["public"]["Enums"]["settlement_timing"]
          updated_at?: string
        }
        Update: {
          broker_fee_pct?: number | null
          created_at?: string
          default_discount_rate?: number
          id?: string
          notes?: string | null
          organization_id?: string
          originator_fee_pct?: number
          payment_instructions?: Json | null
          platform_fee_pct?: number
          product_type?: Database["public"]["Enums"]["product_type"]
          settlement_days?: number
          settlement_timing?: Database["public"]["Enums"]["settlement_timing"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_fee_configs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          is_active: boolean
          organization_id: string | null
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          is_active?: boolean
          organization_id?: string | null
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          is_active?: boolean
          organization_id?: string | null
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      reference_rates: {
        Row: {
          created_at: string | null
          id: string
          last_updated: string | null
          rate_name: string
          rate_value: number
          source: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          last_updated?: string | null
          rate_name: string
          rate_value: number
          source?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          last_updated?: string | null
          rate_name?: string
          rate_value?: number
          source?: string | null
        }
        Relationships: []
      }
      registry_api_configs: {
        Row: {
          api_base_url: string
          api_key_secret_name: string
          api_key_value: string | null
          capabilities: string[] | null
          ckan_dataset_id: string | null
          ckan_query_field_mapping: Json | null
          ckan_resource_id: string | null
          ckan_search_action: string | null
          ckan_show_action: string | null
          client_id: string | null
          country_code: string
          country_name: string
          created_at: string
          health_message: string | null
          health_status: string | null
          id: string
          is_active: boolean
          last_health_check: string | null
          registry_name: string
          registry_type: string
          updated_at: string
        }
        Insert: {
          api_base_url: string
          api_key_secret_name: string
          api_key_value?: string | null
          capabilities?: string[] | null
          ckan_dataset_id?: string | null
          ckan_query_field_mapping?: Json | null
          ckan_resource_id?: string | null
          ckan_search_action?: string | null
          ckan_show_action?: string | null
          client_id?: string | null
          country_code: string
          country_name: string
          created_at?: string
          health_message?: string | null
          health_status?: string | null
          id?: string
          is_active?: boolean
          last_health_check?: string | null
          registry_name: string
          registry_type?: string
          updated_at?: string
        }
        Update: {
          api_base_url?: string
          api_key_secret_name?: string
          api_key_value?: string | null
          capabilities?: string[] | null
          ckan_dataset_id?: string | null
          ckan_query_field_mapping?: Json | null
          ckan_resource_id?: string | null
          ckan_search_action?: string | null
          ckan_show_action?: string | null
          client_id?: string | null
          country_code?: string
          country_name?: string
          created_at?: string
          health_message?: string | null
          health_status?: string | null
          id?: string
          is_active?: boolean
          last_health_check?: string | null
          registry_name?: string
          registry_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      registry_results: {
        Row: {
          borrower_id: string
          created_at: string
          data: Json
          fetched_at: string
          id: string
          match_analysis: Json | null
          organization_id: string
          registry_api_id: string | null
          result_type: string
        }
        Insert: {
          borrower_id: string
          created_at?: string
          data?: Json
          fetched_at?: string
          id?: string
          match_analysis?: Json | null
          organization_id: string
          registry_api_id?: string | null
          result_type: string
        }
        Update: {
          borrower_id?: string
          created_at?: string
          data?: Json
          fetched_at?: string
          id?: string
          match_analysis?: Json | null
          organization_id?: string
          registry_api_id?: string | null
          result_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "registry_results_borrower_id_fkey"
            columns: ["borrower_id"]
            isOneToOne: false
            referencedRelation: "borrowers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registry_results_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registry_results_registry_api_id_fkey"
            columns: ["registry_api_id"]
            isOneToOne: false
            referencedRelation: "registry_api_configs"
            referencedColumns: ["id"]
          },
        ]
      }
      repayment_memos: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          balance_due: number | null
          borrower_id: string
          counterparty_name: string | null
          created_at: string
          disbursement_amount: number
          disbursement_memo_id: string
          funder_fee: number | null
          funder_name: string | null
          funding_amount: number
          id: string
          invoice_date: string | null
          invoice_due_date: string | null
          invoice_id: string
          invoice_number: string | null
          invoice_value: number
          memo_number: string | null
          metadata: Json | null
          organization_id: string
          originator_fee: number | null
          overdue_fee: number | null
          payment_confirmed_at: string | null
          payment_reference: string | null
          repayment_date: string | null
          retained_reimbursement: number | null
          status: string
          total_fee: number | null
          total_repayment: number
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          balance_due?: number | null
          borrower_id: string
          counterparty_name?: string | null
          created_at?: string
          disbursement_amount: number
          disbursement_memo_id: string
          funder_fee?: number | null
          funder_name?: string | null
          funding_amount: number
          id?: string
          invoice_date?: string | null
          invoice_due_date?: string | null
          invoice_id: string
          invoice_number?: string | null
          invoice_value: number
          memo_number?: string | null
          metadata?: Json | null
          organization_id: string
          originator_fee?: number | null
          overdue_fee?: number | null
          payment_confirmed_at?: string | null
          payment_reference?: string | null
          repayment_date?: string | null
          retained_reimbursement?: number | null
          status?: string
          total_fee?: number | null
          total_repayment: number
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          balance_due?: number | null
          borrower_id?: string
          counterparty_name?: string | null
          created_at?: string
          disbursement_amount?: number
          disbursement_memo_id?: string
          funder_fee?: number | null
          funder_name?: string | null
          funding_amount?: number
          id?: string
          invoice_date?: string | null
          invoice_due_date?: string | null
          invoice_id?: string
          invoice_number?: string | null
          invoice_value?: number
          memo_number?: string | null
          metadata?: Json | null
          organization_id?: string
          originator_fee?: number | null
          overdue_fee?: number | null
          payment_confirmed_at?: string | null
          payment_reference?: string | null
          repayment_date?: string | null
          retained_reimbursement?: number | null
          status?: string
          total_fee?: number | null
          total_repayment?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "repayment_memos_borrower_id_fkey"
            columns: ["borrower_id"]
            isOneToOne: false
            referencedRelation: "borrowers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "repayment_memos_disbursement_memo_id_fkey"
            columns: ["disbursement_memo_id"]
            isOneToOne: false
            referencedRelation: "disbursement_memos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "repayment_memos_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "repayment_memos_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      settlement_advices: {
        Row: {
          acknowledged_at: string | null
          advice_number: string
          advice_type: Database["public"]["Enums"]["settlement_advice_type"]
          collection_id: string
          created_at: string
          currency: string
          discount_amount: number
          fee_breakdown: Json | null
          from_party_name: string
          gross_amount: number
          id: string
          invoice_id: string | null
          issued_at: string | null
          metadata: Json | null
          net_amount: number
          notes: string | null
          organization_id: string
          originator_fee: number
          other_deductions: number
          paid_at: string | null
          payment_instructions: Json | null
          pdf_path: string | null
          platform_fee: number
          product_type: Database["public"]["Enums"]["product_type"] | null
          status: Database["public"]["Enums"]["settlement_advice_status"]
          to_borrower_id: string | null
          to_funder_user_id: string | null
          to_party_email: string | null
          to_party_name: string
          updated_at: string
        }
        Insert: {
          acknowledged_at?: string | null
          advice_number: string
          advice_type: Database["public"]["Enums"]["settlement_advice_type"]
          collection_id: string
          created_at?: string
          currency?: string
          discount_amount?: number
          fee_breakdown?: Json | null
          from_party_name: string
          gross_amount: number
          id?: string
          invoice_id?: string | null
          issued_at?: string | null
          metadata?: Json | null
          net_amount: number
          notes?: string | null
          organization_id: string
          originator_fee?: number
          other_deductions?: number
          paid_at?: string | null
          payment_instructions?: Json | null
          pdf_path?: string | null
          platform_fee?: number
          product_type?: Database["public"]["Enums"]["product_type"] | null
          status?: Database["public"]["Enums"]["settlement_advice_status"]
          to_borrower_id?: string | null
          to_funder_user_id?: string | null
          to_party_email?: string | null
          to_party_name: string
          updated_at?: string
        }
        Update: {
          acknowledged_at?: string | null
          advice_number?: string
          advice_type?: Database["public"]["Enums"]["settlement_advice_type"]
          collection_id?: string
          created_at?: string
          currency?: string
          discount_amount?: number
          fee_breakdown?: Json | null
          from_party_name?: string
          gross_amount?: number
          id?: string
          invoice_id?: string | null
          issued_at?: string | null
          metadata?: Json | null
          net_amount?: number
          notes?: string | null
          organization_id?: string
          originator_fee?: number
          other_deductions?: number
          paid_at?: string | null
          payment_instructions?: Json | null
          pdf_path?: string | null
          platform_fee?: number
          product_type?: Database["public"]["Enums"]["product_type"] | null
          status?: Database["public"]["Enums"]["settlement_advice_status"]
          to_borrower_id?: string | null
          to_funder_user_id?: string | null
          to_party_email?: string | null
          to_party_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "settlement_advices_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "settlement_advices_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "settlement_advices_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "settlement_advices_to_borrower_id_fkey"
            columns: ["to_borrower_id"]
            isOneToOne: false
            referencedRelation: "borrowers"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_plans: {
        Row: {
          created_at: string
          features: Json
          id: string
          is_active: boolean
          is_popular: boolean
          max_borrowers: number
          max_funders: number
          max_monthly_volume_gbp: number
          name: string
          price_gbp: number
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          features?: Json
          id?: string
          is_active?: boolean
          is_popular?: boolean
          max_borrowers?: number
          max_funders?: number
          max_monthly_volume_gbp?: number
          name: string
          price_gbp?: number
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          features?: Json
          id?: string
          is_active?: boolean
          is_popular?: boolean
          max_borrowers?: number
          max_funders?: number
          max_monthly_volume_gbp?: number
          name?: string
          price_gbp?: number
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
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
      workflow_versions: {
        Row: {
          created_at: string
          created_by: string | null
          edges: Json
          id: string
          nodes: Json
          published_at: string | null
          published_by: string | null
          rules: Json
          status: string
          updated_at: string
          version_label: string | null
          version_number: number
          workflow_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          edges?: Json
          id?: string
          nodes?: Json
          published_at?: string | null
          published_by?: string | null
          rules?: Json
          status?: string
          updated_at?: string
          version_label?: string | null
          version_number?: number
          workflow_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          edges?: Json
          id?: string
          nodes?: Json
          published_at?: string | null
          published_by?: string | null
          rules?: Json
          status?: string
          updated_at?: string
          version_label?: string | null
          version_number?: number
          workflow_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_versions_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "workflows"
            referencedColumns: ["id"]
          },
        ]
      }
      workflows: {
        Row: {
          category: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_system: boolean
          name: string
          organization_id: string | null
          slug: string
          updated_at: string
        }
        Insert: {
          category?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_system?: boolean
          name: string
          organization_id?: string | null
          slug: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_system?: boolean
          name?: string
          organization_id?: string | null
          slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflows_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_invoice_by_token: {
        Args: {
          _email: string
          _notes?: string
          _status: Database["public"]["Enums"]["acceptance_status"]
          _token: string
        }
        Returns: boolean
      }
      accrue_daily_interest: { Args: never; Returns: undefined }
      check_funder_eligibility:
        | {
            Args: {
              _borrower_id: string
              _funder_user_id: string
              _invoice_amount: number
              _organization_id: string
              _product_type?: string
            }
            Returns: {
              available_limit: number
              eligible: boolean
              message: string
            }[]
          }
        | {
            Args: {
              _borrower_id: string
              _counterparty_id?: string
              _funder_user_id: string
              _invoice_amount: number
              _organization_id: string
              _product_type?: string
            }
            Returns: {
              available_limit: number
              eligible: boolean
              message: string
            }[]
          }
      compute_facility_rate: {
        Args: {
          _funder_base_rate: number
          _funder_margin: number
          _originator_margin: number
        }
        Returns: number
      }
      get_borrower_exposure: {
        Args: { _borrower_id: string; _organization_id: string }
        Returns: {
          total_collected: number
          total_funded: number
          total_invoices: number
        }[]
      }
      get_org_funder_profiles: {
        Args: { _org_id: string }
        Returns: {
          full_name: string
          user_id: string
        }[]
      }
      get_user_organization_id: { Args: { _user_id: string }; Returns: string }
      get_user_roles: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"][]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      acceptance_method: "direct_counterparty" | "document_upload"
      acceptance_status:
        | "pending"
        | "accepted"
        | "rejected"
        | "accepted_via_document"
        | "pending_document_review"
      ai_analysis_status: "pending" | "processing" | "completed" | "failed"
      ai_analysis_type:
        | "document_analysis"
        | "contract_review"
        | "invoice_contract_match"
        | "credit_memo"
      app_role:
        | "admin"
        | "originator_admin"
        | "originator_user"
        | "borrower"
        | "funder"
        | "broker_admin"
        | "credit_committee_member"
        | "account_manager"
        | "operations_manager"
      application_type:
        | "new_facility"
        | "limit_increase"
        | "limit_renewal"
        | "counterparty_limit"
        | "facility_addition"
      cc_vote_type: "approve" | "reject" | "abstain" | "approve_with_conditions"
      collection_status: "received" | "confirmed" | "disputed" | "reversed"
      credit_memo_status:
        | "draft"
        | "ai_generated"
        | "under_review"
        | "approved"
        | "rejected"
        | "submitted_to_committee"
      disbursement_status:
        | "draft"
        | "pending_approval"
        | "approved"
        | "disbursed"
        | "cancelled"
      document_type:
        | "kyc"
        | "financial_statement"
        | "incorporation"
        | "contract"
        | "invoice"
        | "credit_memo"
        | "nda"
        | "other"
      labelling_mode: "white_label" | "joint_label" | "platform_label"
      onboarding_status:
        | "invited"
        | "registered"
        | "documents_pending"
        | "documents_submitted"
        | "under_review"
        | "approved"
        | "rejected"
        | "draft"
        | "documents_requested"
        | "onboarded"
      org_onboarding_status:
        | "pending_documents"
        | "documents_submitted"
        | "under_review"
        | "approved"
        | "rejected"
        | "on_hold"
      product_type:
        | "receivables_purchase"
        | "reverse_factoring"
        | "payables_finance"
      recommendation_status: "draft" | "active" | "expired" | "superseded"
      referral_status:
        | "referred"
        | "under_review"
        | "approved"
        | "rejected"
        | "counter_offered"
      settlement_advice_status: "draft" | "issued" | "acknowledged" | "paid"
      settlement_advice_type: "borrower_settlement" | "funder_settlement"
      settlement_timing: "advance" | "arrears"
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
      acceptance_method: ["direct_counterparty", "document_upload"],
      acceptance_status: [
        "pending",
        "accepted",
        "rejected",
        "accepted_via_document",
        "pending_document_review",
      ],
      ai_analysis_status: ["pending", "processing", "completed", "failed"],
      ai_analysis_type: [
        "document_analysis",
        "contract_review",
        "invoice_contract_match",
        "credit_memo",
      ],
      app_role: [
        "admin",
        "originator_admin",
        "originator_user",
        "borrower",
        "funder",
        "broker_admin",
        "credit_committee_member",
        "account_manager",
        "operations_manager",
      ],
      application_type: [
        "new_facility",
        "limit_increase",
        "limit_renewal",
        "counterparty_limit",
        "facility_addition",
      ],
      cc_vote_type: ["approve", "reject", "abstain", "approve_with_conditions"],
      collection_status: ["received", "confirmed", "disputed", "reversed"],
      credit_memo_status: [
        "draft",
        "ai_generated",
        "under_review",
        "approved",
        "rejected",
        "submitted_to_committee",
      ],
      disbursement_status: [
        "draft",
        "pending_approval",
        "approved",
        "disbursed",
        "cancelled",
      ],
      document_type: [
        "kyc",
        "financial_statement",
        "incorporation",
        "contract",
        "invoice",
        "credit_memo",
        "nda",
        "other",
      ],
      labelling_mode: ["white_label", "joint_label", "platform_label"],
      onboarding_status: [
        "invited",
        "registered",
        "documents_pending",
        "documents_submitted",
        "under_review",
        "approved",
        "rejected",
        "draft",
        "documents_requested",
        "onboarded",
      ],
      org_onboarding_status: [
        "pending_documents",
        "documents_submitted",
        "under_review",
        "approved",
        "rejected",
        "on_hold",
      ],
      product_type: [
        "receivables_purchase",
        "reverse_factoring",
        "payables_finance",
      ],
      recommendation_status: ["draft", "active", "expired", "superseded"],
      referral_status: [
        "referred",
        "under_review",
        "approved",
        "rejected",
        "counter_offered",
      ],
      settlement_advice_status: ["draft", "issued", "acknowledged", "paid"],
      settlement_advice_type: ["borrower_settlement", "funder_settlement"],
      settlement_timing: ["advance", "arrears"],
    },
  },
} as const
