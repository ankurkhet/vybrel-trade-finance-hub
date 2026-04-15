import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: path.join(process.cwd(), ".env") });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing supabase credentials from .env");
  process.exit(1);
}

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function checkMissingUsers() {
  const { data: orgs, error: orgErr } = await supabaseAdmin.from("organizations").select("id, name");
  console.log("Orgs:", orgs?.length, orgErr);

  const { data: profiles, error: profErr } = await supabaseAdmin.from("profiles").select("id, email, organization_id");
  console.log("Profiles:", profiles?.length, profErr);

  let missing = 0;
  for (const p of (profiles || [])) {
    if (p.organization_id) {
      if (!orgs?.find((o) => o.id === p.organization_id)) {
        console.log("User missing from orgs list:", p.email, "org_id:", p.organization_id);
        missing++;
      }
    }
  }
  console.log("Total users with orphaned org:", missing);

  // Let's also check if user_roles are okay.
  const { data: roles, error: rolesErr } = await supabaseAdmin.from("user_roles").select("*");
  console.log("Roles mapping:", roles?.length, rolesErr);
}

checkMissingUsers();
