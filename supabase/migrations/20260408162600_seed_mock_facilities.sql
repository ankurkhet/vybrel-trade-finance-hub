-- Phase: Seed Mock Facilities Data
-- Creates generic mock data for facilities as requested.

-- Since we don't know the precise UUIDs of current borrowers and funders, 
-- we use PL/pgSQL to gracefully link to whichever users exist as borrower or funder roles.
DO $$
DECLARE
    v_org_id UUID;
    v_borrower_role_id UUID;
    v_borrower_id UUID;
    v_funder_role_id UUID;
    v_funder_id UUID;
    v_funder2_id UUID;
    v_originator_id UUID;
    v_facility_id UUID;
BEGIN
    -- 1. Grab generic roles
    SELECT id INTO v_borrower_role_id FROM public.app_roles WHERE name = 'borrower';
    SELECT id INTO v_funder_role_id FROM public.app_roles WHERE name = 'funder';
    
    -- 2. Find any active borrower and funder
    SELECT user_id INTO v_borrower_id FROM public.user_roles WHERE role_id = v_borrower_role_id LIMIT 1;
    SELECT user_id INTO v_funder_id FROM public.user_roles WHERE role_id = v_funder_role_id LIMIT 1;
    SELECT user_id INTO v_funder2_id FROM public.user_roles WHERE role_id = v_funder_role_id OFFSET 1 LIMIT 1;

    -- Grab an organization (Originator) 
    SELECT organization_id INTO v_org_id FROM public.organization_members LIMIT 1;

    -- If we have enough data to mock, proceed:
    IF v_borrower_id IS NOT NULL AND v_funder_id IS NOT NULL AND v_org_id IS NOT NULL THEN
        
        -- Insert a mock Facility
        INSERT INTO public.facilities (
            organization_id, borrower_id, product_type, currency, advance_rate, settlement_type, status
        ) VALUES (
            v_org_id, v_borrower_id, 'Receivable Purchase', 'GBP', 85.00, 'advance', 'active'
        ) RETURNING id INTO v_facility_id;

        -- Insert Funder 1 Pricing Structure
        INSERT INTO public.facility_funder_pricing (
            facility_id, funder_user_id, funder_base_rate, funder_margin, originator_margin, broker_margin
        ) VALUES (
            v_facility_id, v_funder_id, 5.19, 1.25, 0.50, 0.10 -- Final generated rate will evaluate properly
        );

        -- Insert Funder 2 Pricing Structure if a second funder exists
        IF v_funder2_id IS NOT NULL THEN
            INSERT INTO public.facility_funder_pricing (
                facility_id, funder_user_id, funder_base_rate, funder_margin, originator_margin, broker_margin
            ) VALUES (
                v_facility_id, v_funder2_id, 5.19, 1.50, 0.50, 0.00
            );
        END IF;

    END IF;
END $$;
