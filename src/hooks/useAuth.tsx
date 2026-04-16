import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { auditLogger, AuditLogger } from "@/lib/audit-logger";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: any | null;
  roles: AppRole[];
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string, fullName: string, meta?: { company_name?: string; plan_id?: string }) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  hasRole: (role: AppRole) => boolean;
  isAdmin: boolean;
  isOriginatorAdmin: boolean;
  isOriginatorUser: boolean;
  isOperationsManager: boolean;
  isBorrower: boolean;
  isFunder: boolean;
  isBroker: boolean;
  isAccountManager: boolean;
  isCreditCommitteeMember: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    // Supabase docs: do NOT await async work inside onAuthStateChange — it causes
    // deadlocks. Set loading = false immediately after user/session state is set,
    // then let profile/roles populate asynchronously in the background.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (!mounted) return;

      setSession(newSession);
      setUser(newSession?.user ?? null);

      if (newSession?.user) {
        // Fire-and-forget — never await inside this callback
        fetchProfileAndRoles(newSession.user.id, newSession);
      } else {
        setProfile(null);
        setRoles([]);
      }

      // Always resolve loading immediately so ProtectedRoute never hangs
      if (mounted) setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const decodeJwt = (token: string): Record<string, any> => {
    try {
      return JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    } catch { return {}; }
  };

  const fetchProfileAndRoles = async (userId: string, currentSession?: Session | null) => {
    try {
      // Decode access token — custom JWT hook claims live at top level
      const jwtPayload = currentSession?.access_token ? decodeJwt(currentSession.access_token) : {};
      const jwtRoles = (jwtPayload.roles ?? currentSession?.user?.app_metadata?.roles) as AppRole[] | undefined;

      // profiles.id = auth.users.id on this project
      const { data: profileData } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();

      // CRIT-03: Auto-create org on first sign-in if profile has no org yet
      if (profileData && !profileData.organization_id) {
        const companyName =
          currentSession?.user?.user_metadata?.company_name ||
          (() => {
            try { return JSON.parse(localStorage.getItem("pending_org_setup") || "{}").company_name; } catch { return null; }
          })();

        if (companyName) {
          const { data: setupResult } = await supabase.functions.invoke("setup-originator-org", {
            body: { user_id: userId, company_name: companyName },
          });
          if (setupResult?.organization_id) {
            profileData.organization_id = setupResult.organization_id;
            localStorage.removeItem("pending_org_setup");
          }
        }
      }

      if (profileData) setProfile(profileData);

      if (jwtRoles && jwtRoles.length > 0) {
        // Fast path: roles from JWT claim — no extra DB round-trip
        setRoles(jwtRoles);
      } else {
        // Fallback: DB RPC
        const { data: rolesData } = await supabase.rpc("get_user_roles", { _user_id: userId });
        if (rolesData) setRoles(rolesData as AppRole[]);
      }
    } catch (err) {
      // Swallow — loading was already set to false; roles will just be empty
      console.warn("[useAuth] fetchProfileAndRoles error:", err);
    }
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (!error) {
      auditLogger.log(AuditLogger.Actions.LOGIN, "session", undefined, { email });
      // Eagerly sync session into context so navigation works immediately
      // without waiting for the async onAuthStateChange callback to fire.
      const { data: { session: newSess } } = await supabase.auth.getSession();
      if (newSess) {
        setSession(newSess);
        setUser(newSess.user);
        fetchProfileAndRoles(newSess.user.id, newSess); // fire-and-forget; roles populate async
      }
    }
    return { error };
  };

  const signUp = async (email: string, password: string, fullName: string, meta?: { company_name?: string; plan_id?: string }) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, company_name: meta?.company_name, plan_id: meta?.plan_id },
        emailRedirectTo: window.location.origin,
      },
    });
    return { error };
  };

  const signOut = async () => {
    auditLogger.log(AuditLogger.Actions.LOGOUT, "session");
    await auditLogger.forceFlush();
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
    setRoles([]);
  };

  const hasRole = (role: AppRole) => roles.includes(role);

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        roles,
        loading,
        signIn,
        signUp,
        signOut,
        hasRole,
        isAdmin: hasRole("admin"),
        isOriginatorAdmin: hasRole("originator_admin"),
        isOriginatorUser: hasRole("originator_user"),
        isOperationsManager: hasRole("operations_manager" as AppRole),
        isBorrower: hasRole("borrower"),
        isFunder: hasRole("funder"),
        isBroker: hasRole("broker_admin"),
        isAccountManager: hasRole("account_manager"),
        isCreditCommitteeMember: hasRole("credit_committee_member"),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
