

# Fix Multi-Tenancy in Funder Referral + Add AI Help Chatbot

## Part 1: Multi-Tenancy Fix — Funder Profile Visibility

### Problem
When an originator admin queries funder profiles via `profiles.in("user_id", funderIds)`, RLS blocks the read because funders may belong to a different `organization_id` on their profile. The `funder_relationships` query itself is correctly scoped by `organization_id`, but the subsequent profile lookup leaks or fails across tenants.

### Solution
Create a `SECURITY DEFINER` database function that safely returns funder names scoped through the `funder_relationships` table, bypassing the profile RLS constraint while maintaining tenant isolation.

**Migration:**
```sql
CREATE OR REPLACE FUNCTION public.get_org_funder_profiles(_org_id uuid)
RETURNS TABLE(user_id uuid, full_name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT DISTINCT p.user_id, p.full_name
  FROM funder_relationships fr
  JOIN profiles p ON p.user_id = fr.funder_user_id
  WHERE fr.organization_id = _org_id
    AND fr.agreement_status = 'active'
$$;
```

**Files changed:**
| File | Change |
|------|--------|
| `src/components/credit-committee/ReferToFunderDialog.tsx` | Replace `profiles.in()` with `supabase.rpc("get_org_funder_profiles", { _org_id: organizationId })` |
| `src/pages/originator/FunderLimitsTab.tsx` | Same RPC fix for funder profile lookup |

---

## Part 2: AI Help Chatbot

### Solution
Create a floating chatbot widget accessible from all pages. It uses the existing `userManualData.ts` and `helpContent.ts` as knowledge base, the user's current roles from `useAuth`, and an edge function calling AI to answer "how to" questions. If the user lacks a role for something, the bot advises contacting their admin.

**New files:**
| File | Purpose |
|------|---------|
| `src/components/help/AIChatbot.tsx` | Floating chatbot UI — toggle button (bottom-right), chat panel with message history, input field |
| `supabase/functions/help-chatbot/index.ts` | Edge function that receives the user's question + roles, builds a system prompt from the user manual data, and calls the AI gateway to generate a response |

**Modified files:**
| File | Change |
|------|---------|
| `src/App.tsx` | Add `<AIChatbot />` inside the `AuthProvider` so it's available on all authenticated pages |

### Chatbot behavior
- Floating button with chat icon in bottom-right corner
- Opens a panel with conversation history (session-only, no DB persistence)
- System prompt includes: full user manual content, user's current roles, and instructions to advise contacting admin if role is missing
- Uses markdown rendering for responses
- Edge function calls Lovable AI (gemini-2.5-flash) with the manual as context

