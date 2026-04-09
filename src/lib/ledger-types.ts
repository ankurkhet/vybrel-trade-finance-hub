export interface PspAccount {
  id: string;
  actor_id: string;
  organization_id: string;
  psp_reference: string;
  status: 'active' | 'inactive';
  created_at: string;
}

export interface JournalEntry {
  id: string;
  organization_id: string;
  transaction_date: string;
  journal_type: 'disbursement' | 'collection' | 'fee' | 'margin' | 'top-up' | 'withdrawal';
  reference_id: string | null;
  account_id: string | null;
  system_account: string | null;
  amount: number;
  direction: 'credit' | 'debit';
  currency: string;
  description: string | null;
  created_by: string | null;
  created_at: string;
}

export interface WalletBalance {
  actor_id: string;
  system_account: string | null;
  organization_id: string;
  currency: string;
  balance: number;
  last_updated_at: string;
}

export interface WalletTransaction {
  journal_id: string;
  actor_id: string;
  system_account: string | null;
  organization_id: string;
  transaction_date: string;
  journal_type: string;
  reference_id: string | null;
  amount: number;
  direction: 'credit' | 'debit';
  currency: string;
  description: string | null;
}

export interface Facility {
  id: string;
  organization_id: string;
  borrower_id: string;
  product_type: string;
  currency: string;
  advance_rate: number;
  settlement_type: 'advance' | 'accrual';
  status: 'active' | 'inactive' | 'closed';
  created_at: string;
}

export interface FacilityFunderPricing {
  id: string;
  facility_id: string;
  funder_user_id: string;
  funder_base_rate: number;
  funder_margin: number;
  originator_margin: number;
  broker_margin: number;
  final_discounting_rate: number;
  valid_from: string;
  valid_to: string | null;
}
