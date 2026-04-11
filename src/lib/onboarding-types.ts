export interface AddressData {
  line1: string;
  line2: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
}

export const emptyAddress: AddressData = {
  line1: "",
  line2: "",
  city: "",
  state: "",
  postal_code: "",
  country: "",
};

export interface DirectorData {
  id?: string;
  first_name: string;
  middle_name: string;
  last_name: string;
  date_of_birth: string;
  nationality: string;
  role: "director" | "authorized_signatory" | "both";
  shareholding_pct: string;
  email: string;
  phone: string;
  id_document_path: string;
  residential_address: AddressData;
}

export const emptyDirector: DirectorData = {
  first_name: "",
  middle_name: "",
  last_name: "",
  date_of_birth: "",
  nationality: "",
  role: "director",
  shareholding_pct: "",
  email: "",
  phone: "",
  id_document_path: "",
  residential_address: { ...emptyAddress },
};

export interface CompanyFormData {
  company_name: string;
  trading_name: string;
  registration_number: string;
  country: string;
  incorporation_date: string;
  industry: string;
  registered_address: AddressData;
  trading_address: AddressData;
  phone: string;
  website: string;
  contact_email: string;
  contact_name: string;
  vat_tax_id: string;
  num_employees: string;
  annual_turnover: string;
  // New fields from flowchart
  is_part_of_group: boolean;
  parent_company_name: string;
  parent_shareholding_pct: string;
  sic_codes: string;
  has_credit_facilities: boolean;
  other_invoice_facilities: string;
  turnover_currency: string;
}

export const emptyCompanyForm: CompanyFormData = {
  company_name: "",
  trading_name: "",
  registration_number: "",
  country: "",
  incorporation_date: "",
  industry: "",
  registered_address: { ...emptyAddress },
  trading_address: { ...emptyAddress },
  phone: "",
  website: "",
  contact_email: "",
  contact_name: "",
  vat_tax_id: "",
  num_employees: "",
  annual_turnover: "",
  is_part_of_group: false,
  parent_company_name: "",
  parent_shareholding_pct: "",
  sic_codes: "",
  has_credit_facilities: false,
  other_invoice_facilities: "",
  turnover_currency: "GBP",
};

export interface SignatoryFormData {
  full_name: string;
  dob: string;
  designation: string;
  is_director: boolean | null;
  director_name: string;
  director_email: string;
  // New Flow Fields
  nric_passport: string;
  address: AddressData;
  phone: string;
  linkedin_url: string;
  board_resolution_path: string;
  nda_sign_method: "electronic" | "docusign" | "manual" | null;
  nda_status: "pending" | "sent" | "signed";
  docusign_envelope_id: string;
  nda_document_path: string;
}

export const emptySignatoryForm: SignatoryFormData = {
  full_name: "",
  dob: "",
  designation: "",
  is_director: null,
  director_name: "",
  director_email: "",
  nric_passport: "",
  address: { ...emptyAddress },
  phone: "",
  linkedin_url: "",
  board_resolution_path: "",
  nda_sign_method: null,
  nda_status: "pending",
  docusign_envelope_id: "",
  nda_document_path: "",
};

export interface FacilityRequestData {
  facility_type: string;
  amount: string;
  currency: string;
  tenor_months: string;
  pricing_notes: string;
}

export const emptyFacilityRequest: FacilityRequestData = {
  facility_type: "",
  amount: "",
  currency: "GBP",
  tenor_months: "",
  pricing_notes: "",
};

export interface LenderData {
  lender_name: string;
  has_facilities: boolean;
  facility_nature: string;
  facility_amount: string;
  currency: string;
  is_secured: boolean;
  repayment_schedule: string;
}

export const emptyLender: LenderData = {
  lender_name: "",
  has_facilities: false,
  facility_nature: "",
  facility_amount: "",
  currency: "GBP",
  is_secured: false,
  repayment_schedule: "",
};

export const FACILITY_CATEGORIES = [
  {
    category: "Funding",
    types: [
      "Receivables / Invoice Financing",
      "Inventory Financing",
      "Payable Financing",
      "Whole Turnover Financing",
    ],
  },
  {
    category: "Payment / Automation of Receivables",
    types: [] as string[], // No sub-options needed
  },
] as const;

export const FACILITY_TYPES = [
  "Receivables / Invoice Financing",
  "Inventory Financing",
  "Payable Financing",
  "Whole Turnover Financing",
  "Payment / Automation of Receivables",
  "Dynamic Discounting",
  "Other Short-Term Credit",
] as const;

export const ONBOARDING_DOCUMENT_TYPES = [
  { type: "incorporation_certificate", label: "Incorporation Certificate", required: true },
  { type: "vat_ein_certificate", label: "VAT/EIN/Tax Certificate", required: true },
  { type: "company_address_proof", label: "Company - Address Proof", required: false },
  { type: "company_utility_statement", label: "Company - Utility Statement (not older than 2 months)", required: false },
  { type: "company_bank_statement", label: "Company - Bank Statement (not older than 2 months)", required: false },
  { type: "company_rent_agreement", label: "Company - Rent Agreement", required: false },
  { type: "company_property_papers", label: "Company - Property Papers", required: false },
  { type: "individual_passport", label: "Individual - Copy of Passport", required: false },
  { type: "individual_driving_license", label: "Individual - Driving License", required: false },
  { type: "individual_address_proof", label: "Individual - Address Proof", required: false },
  { type: "individual_utility_statement", label: "Individual - Utility Statement (not older than 2 months)", required: false },
  { type: "individual_bank_statement", label: "Individual - Bank Statement (not older than 2 months)", required: false },
  { type: "individual_rent_agreement", label: "Individual - Rent Agreement", required: false },
  { type: "individual_property_papers", label: "Individual - Property Papers", required: false },
  { type: "annual_report", label: "Last Annual Report / Audited Financial Statement", required: true },
  { type: "provisional_financials", label: "Provisional Financial Statements (YTD)", required: false },
  { type: "projections", label: "Projections for next 2 years", required: false },
  { type: "company_presentation", label: "Company Presentation", required: false },
  { type: "customer_list", label: "List of Customers", required: false },
  { type: "supplier_list", label: "List of Suppliers", required: false },
  { type: "bank_statements_6m", label: "Bank Account Statements for last 6 months", required: true },
  { type: "customer_agreements", label: "Copy(ies) of latest Agreements with Customer(s)", required: false },
  { type: "supplier_agreements", label: "Copy(ies) of latest Agreements with Supplier(s)", required: false },
  { type: "board_resolution", label: "Relevant Board Resolution", required: false },
  { type: "nda_signed", label: "Signed NDA", required: true },
] as const;

export const ONBOARDING_STATUSES = [
  { key: "draft", label: "Draft", color: "outline" },
  { key: "invited", label: "Invited", color: "outline" },
  { key: "registered", label: "Registered", color: "secondary" },
  { key: "documents_pending", label: "Documents Pending", color: "outline" },
  { key: "documents_submitted", label: "Submitted for Review", color: "secondary" },
  { key: "documents_requested", label: "Documents Requested", color: "outline" },
  { key: "under_review", label: "Under KYB Review", color: "default" },
  { key: "approved", label: "Approved", color: "default" },
  { key: "rejected", label: "Rejected", color: "destructive" },
  { key: "onboarded", label: "Onboarded", color: "default" },
] as const;

export const INDUSTRIES = [
  "Agriculture & Farming",
  "Automotive",
  "Banking & Financial Services",
  "Construction & Real Estate",
  "Consumer Goods & Retail",
  "Education & Training",
  "Energy & Utilities",
  "Entertainment & Media",
  "Food & Beverage",
  "Healthcare & Pharmaceuticals",
  "Hospitality & Tourism",
  "Information Technology",
  "Insurance",
  "Logistics & Transportation",
  "Manufacturing",
  "Mining & Metals",
  "Professional Services",
  "Telecommunications",
  "Textiles & Apparel",
  "Other",
];

export const COUNTRIES = [
  { code: "GB", name: "United Kingdom" },
  { code: "US", name: "United States" },
  { code: "AU", name: "Australia" },
  { code: "AT", name: "Austria" },
  { code: "BE", name: "Belgium" },
  { code: "BR", name: "Brazil" },
  { code: "BG", name: "Bulgaria" },
  { code: "CA", name: "Canada" },
  { code: "CN", name: "China" },
  { code: "HR", name: "Croatia" },
  { code: "CY", name: "Cyprus" },
  { code: "CZ", name: "Czech Republic" },
  { code: "DK", name: "Denmark" },
  { code: "EE", name: "Estonia" },
  { code: "FI", name: "Finland" },
  { code: "FR", name: "France" },
  { code: "DE", name: "Germany" },
  { code: "GR", name: "Greece" },
  { code: "HK", name: "Hong Kong" },
  { code: "HU", name: "Hungary" },
  { code: "IN", name: "India" },
  { code: "ID", name: "Indonesia" },
  { code: "IE", name: "Ireland" },
  { code: "IL", name: "Israel" },
  { code: "IT", name: "Italy" },
  { code: "JP", name: "Japan" },
  { code: "KE", name: "Kenya" },
  { code: "KR", name: "South Korea" },
  { code: "LV", name: "Latvia" },
  { code: "LT", name: "Lithuania" },
  { code: "LU", name: "Luxembourg" },
  { code: "MY", name: "Malaysia" },
  { code: "MT", name: "Malta" },
  { code: "MX", name: "Mexico" },
  { code: "NL", name: "Netherlands" },
  { code: "NZ", name: "New Zealand" },
  { code: "NG", name: "Nigeria" },
  { code: "NO", name: "Norway" },
  { code: "PK", name: "Pakistan" },
  { code: "PH", name: "Philippines" },
  { code: "PL", name: "Poland" },
  { code: "PT", name: "Portugal" },
  { code: "RO", name: "Romania" },
  { code: "SA", name: "Saudi Arabia" },
  { code: "SG", name: "Singapore" },
  { code: "SK", name: "Slovakia" },
  { code: "SI", name: "Slovenia" },
  { code: "ZA", name: "South Africa" },
  { code: "ES", name: "Spain" },
  { code: "SE", name: "Sweden" },
  { code: "CH", name: "Switzerland" },
  { code: "TH", name: "Thailand" },
  { code: "TR", name: "Turkey" },
  { code: "UA", name: "Ukraine" },
  { code: "AE", name: "United Arab Emirates" },
  { code: "VN", name: "Vietnam" },
];

export interface RegistryApiConfig {
  id: string;
  country_code: string;
  country_name: string;
  registry_name: string;
  api_base_url: string;
  api_key_secret_name: string;
  is_active: boolean;
  capabilities: string[];
  last_health_check: string | null;
  health_status: string;
  health_message: string | null;
  registry_type?: "rest" | "ckan";
  ckan_dataset_id?: string;
  ckan_resource_id?: string;
  ckan_search_action?: string;
  ckan_show_action?: string;
  ckan_query_field_mapping?: Record<string, string>;
}

export const REGISTRY_CAPABILITIES = [
  "company_search",
  "company_profile",
  "directors",
  "shareholders",
  "filings",
  "insolvency",
  "charges",
  "disqualified_officers",
  "tax_registration",
  "address_verification",
  "address_lookup",
  "filing_history",
  "sanctions_screening",
  "pep_screening",
  "iban_validation",
  "sort_code_validation",
  "account_name_verification",
  "financial_data",
  "credit_scores",
  "financial_statements",
  "fraud_detection",
] as const;

export const DEFAULT_REGISTRIES: Omit<RegistryApiConfig, "id" | "last_health_check" | "health_status" | "health_message">[] = [
  {
    country_code: "GB",
    country_name: "United Kingdom",
    registry_name: "Companies House",
    api_base_url: "https://api.company-information.service.gov.uk",
    api_key_secret_name: "COMPANIES_HOUSE_API_KEY",
    is_active: false,
    capabilities: ["company_search", "company_profile", "directors", "filings", "insolvency", "charges", "disqualified_officers", "filing_history"],
  },
  {
    country_code: "EE",
    country_name: "Estonia",
    registry_name: "e-Business Register",
    api_base_url: "https://ariregister.rik.ee/est/api",
    api_key_secret_name: "ESTONIA_REGISTRY_API_KEY",
    is_active: false,
    capabilities: ["company_search", "company_profile", "directors", "shareholders"],
  },
  {
    country_code: "DK",
    country_name: "Denmark",
    registry_name: "CVR (Central Business Register)",
    api_base_url: "https://cvrapi.dk/api",
    api_key_secret_name: "CVR_DK_API_KEY",
    is_active: false,
    capabilities: ["company_search", "company_profile", "directors"],
  },
  {
    country_code: "FR",
    country_name: "France",
    registry_name: "INSEE Sirene",
    api_base_url: "https://api.insee.fr/entreprises/sirene/V3.11",
    api_key_secret_name: "INSEE_SIRENE_API_KEY",
    is_active: false,
    capabilities: ["company_search", "company_profile", "address_verification"],
  },
  {
    country_code: "AU",
    country_name: "Australia",
    registry_name: "Data.gov.au ASIC Companies",
    api_base_url: "https://data.gov.au",
    api_key_secret_name: "DATAGOV_AU_API_KEY",
    is_active: false,
    capabilities: ["company_search", "company_profile"],
    registry_type: "ckan",
    ckan_dataset_id: "asic-companies",
    ckan_search_action: "package_search",
    ckan_show_action: "package_show",
    ckan_query_field_mapping: { acn: "q", name: "q", abn: "q" },
  },
  {
    country_code: "DE",
    country_name: "Germany",
    registry_name: "Handelsregister",
    api_base_url: "https://www.handelsregister.de/rp_web/search.xhtml",
    api_key_secret_name: "HANDELSREGISTER_API_KEY",
    is_active: false,
    capabilities: ["company_search", "company_profile"],
  },
  {
    country_code: "NL",
    country_name: "Netherlands",
    registry_name: "KVK (Kamer van Koophandel)",
    api_base_url: "https://api.kvk.nl/api/v1",
    api_key_secret_name: "KVK_NL_API_KEY",
    is_active: false,
    capabilities: ["company_search", "company_profile", "directors"],
  },
  {
    country_code: "IE",
    country_name: "Ireland",
    registry_name: "CRO (Companies Registration Office)",
    api_base_url: "https://services.cro.ie/cws/companies",
    api_key_secret_name: "CRO_IE_API_KEY",
    is_active: false,
    capabilities: ["company_search", "company_profile", "directors", "filings"],
  },
  {
    country_code: "SG",
    country_name: "Singapore",
    registry_name: "ACRA (Accounting & Corporate Regulatory Authority)",
    api_base_url: "https://data.gov.sg/api/action/datastore_search",
    api_key_secret_name: "ACRA_SG_API_KEY",
    is_active: false,
    capabilities: ["company_search", "company_profile", "directors", "shareholders"],
  },
  {
    country_code: "IN",
    country_name: "India",
    registry_name: "MCA (Ministry of Corporate Affairs)",
    api_base_url: "https://api.mca.gov.in",
    api_key_secret_name: "MCA_IN_API_KEY",
    is_active: false,
    capabilities: ["company_search", "company_profile", "directors", "charges", "filings"],
  },
  {
    country_code: "ZA",
    country_name: "South Africa",
    registry_name: "CIPC (Companies & Intellectual Property Commission)",
    api_base_url: "https://eservices.cipc.co.za/Search.aspx",
    api_key_secret_name: "CIPC_ZA_API_KEY",
    is_active: false,
    capabilities: ["company_search", "company_profile", "directors"],
  },
  {
    country_code: "HK",
    country_name: "Hong Kong",
    registry_name: "Companies Registry",
    api_base_url: "https://www.icris.cr.gov.hk/csci",
    api_key_secret_name: "ICRIS_HK_API_KEY",
    is_active: false,
    capabilities: ["company_search", "company_profile", "directors", "charges"],
  },
  // ─── Legal Entity Identifier (LEI) ──────────────────────────
  {
    country_code: "GLOBAL",
    country_name: "Global",
    registry_name: "GLEIF (Global LEI Foundation)",
    api_base_url: "https://api.gleif.org/api/v1",
    api_key_secret_name: "GLEIF_API_KEY",
    is_active: false,
    capabilities: ["company_search", "company_profile"],
  },
  // ─── Sanctions Screening ─────────────────────────────────────
  {
    country_code: "GLOBAL",
    country_name: "Global",
    registry_name: "OpenSanctions",
    api_base_url: "https://api.opensanctions.org",
    api_key_secret_name: "OPENSANCTIONS_API_KEY",
    is_active: false,
    capabilities: ["sanctions_screening", "pep_screening"],
  },
  // ─── Bank Account Validation ─────────────────────────────────
  {
    country_code: "GLOBAL",
    country_name: "Global",
    registry_name: "OpenIBAN",
    api_base_url: "https://openiban.com/validate",
    api_key_secret_name: "OPENIBAN_API_KEY",
    is_active: false,
    capabilities: ["iban_validation"],
  },
  {
    country_code: "GB",
    country_name: "United Kingdom",
    registry_name: "Sortcode.co.uk",
    api_base_url: "https://www.sortcode.co.uk",
    api_key_secret_name: "SORTCODE_UK_API_KEY",
    is_active: false,
    capabilities: ["sort_code_validation"],
  },
  {
    country_code: "GLOBAL",
    country_name: "Global",
    registry_name: "TrueLayer Account Holder Verification",
    api_base_url: "https://api.truelayer-sandbox.com",
    api_key_secret_name: "TRUELAYER_CLIENT_SECRET",
    is_active: false,
    capabilities: ["account_name_verification"],
  },
  // ─── Financial Inputs ────────────────────────────────────────
  {
    country_code: "GLOBAL",
    country_name: "Global",
    registry_name: "Creditsafe",
    api_base_url: "https://connect.creditsafe.com/v1",
    api_key_secret_name: "CREDITSAFE_API_KEY",
    is_active: false,
    capabilities: ["financial_data", "credit_scores", "company_profile"],
  },
  {
    country_code: "GLOBAL",
    country_name: "Global",
    registry_name: "Financial Modeling Prep (FMP)",
    api_base_url: "https://financialmodelingprep.com/api/v3",
    api_key_secret_name: "FMP_API_KEY",
    is_active: false,
    capabilities: ["financial_data", "financial_statements"],
  },
  // ─── Address Lookup ─────────────────────────────────────────
  {
    country_code: "GLOBAL",
    country_name: "Global",
    registry_name: "Google Places",
    api_base_url: "https://maps.googleapis.com/maps/api",
    api_key_secret_name: "GOOGLE_PLACES_API_KEY",
    is_active: false,
    capabilities: ["address_lookup"],
  },
  {
    country_code: "GLOBAL",
    country_name: "Global",
    registry_name: "Loqate (GBG)",
    api_base_url: "https://api.addressy.com/Capture/Interactive/Find/v1.10/json3.ws",
    api_key_secret_name: "LOQATE_API_KEY",
    is_active: false,
    capabilities: ["address_lookup"],
  },
  {
    country_code: "GLOBAL",
    country_name: "Global",
    registry_name: "Photon (OpenStreetMap)",
    api_base_url: "https://photon.komoot.io",
    api_key_secret_name: "NO_AUTH_NEEDED",
    is_active: true,
    capabilities: ["address_lookup"],
  },
];
