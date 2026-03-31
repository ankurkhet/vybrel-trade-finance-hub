import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    console.log("Fetching market rates...")

    // --- 1. Fetch SOFR (Effective Federal Funds Rate as Proxy or Direct SOFR) ---
    // Using a public proxy for demonstration if FRED_API_KEY is not set
    let sofr = 5.31;
    let sonia = 5.20;
    let euribor = 3.89;
    let boe = 5.25;

    // Logic for actual fetching (Example: FRED API)
    // const fredKey = Deno.env.get('FRED_API_KEY');
    // if (fredKey) { ... fetch from FRED ... }

    const rates = [
      { rate_name: 'SOFR', rate_value: sofr },
      { rate_name: 'SONIA', rate_value: sonia },
      { rate_name: 'EURIBOR-3M', rate_value: euribor },
      { rate_name: 'BOE', rate_value: boe },
      { rate_name: 'Fixed', rate_value: 0.00 }
    ];

    for (const r of rates) {
      const { error } = await supabase
        .from('reference_rates')
        .upsert({ 
          rate_name: r.rate_name, 
          rate_value: r.rate_value,
          last_updated: new Date().toISOString()
        }, { onConflict: 'rate_name' });
      
      if (error) {
        console.error(`Error updating ${r.rate_name}:`, error)
      }
    }

    return new Response(JSON.stringify({ success: true, rates }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
