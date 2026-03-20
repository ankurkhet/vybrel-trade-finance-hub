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
};

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
  "filing_history",
  "sanctions_screening",
  "pep_screening",
  "iban_validation",
  "sort_code_validation",
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
];
