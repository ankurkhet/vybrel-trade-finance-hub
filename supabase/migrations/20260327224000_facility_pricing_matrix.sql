-- Migration: facility_pricing_matrix
ALTER TABLE facility_requests
ADD COLUMN funder_base_rate_type VARCHAR(50),
ADD COLUMN funder_base_rate_value NUMERIC(10,4),
ADD COLUMN funder_margin_pct NUMERIC(10,4),
ADD COLUMN funder_discounting_rate NUMERIC(10,4),
ADD COLUMN funder_advance_rate NUMERIC(10,4),
ADD COLUMN originator_margin_pct NUMERIC(10,4),
ADD COLUMN originator_fixed_comparison_rate NUMERIC(10,4),
ADD COLUMN originator_recommended_rate NUMERIC(10,4),
ADD COLUMN final_discounting_rate NUMERIC(10,4),
ADD COLUMN final_advance_rate NUMERIC(10,4),
ADD COLUMN overdue_fee_pct NUMERIC(10,4);
