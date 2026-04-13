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
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: any }>;
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
    let initialized = false;

    // FIRST restore any existing session synchronously
    supabase.auth.getSession().then(async ({ data: { session: existingSession } }) => {
      if (!mounted) return;
      initialized = true;
      setSession(existingSession);
      setUser(existingSession?.user ?? null);
      if (existingSession?.user) {
        await fetchProfileAndRoles(existingSession.user.id, existingSession);
      }
      if (mounted) setLoading(false);
    });

    // THEN listen for auth state changes (sign in, sign out, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      if (!mounted) return;

      // Skip the initial INITIAL_SESSION event if getSession() already handled it
      if (event === "INITIAL_SESSION" && initialized) return;

      setSession(newSession);
      setUser(newSession?.user ?? null);

      if (newSession?.user) {
        await fetchProfileAndRoles(newSession.user.id, newSession);
        if (mounted) setLoading(false);
      } else {
        setProfile(null);
        setRoles([]);
        if (mounted) setLoading(false);
      }
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
    // Decode access token directly — custom hook claims live at JWT top level, not app_metadata
    const jwtPayload = currentSession?.access_token ? decodeJwt(currentSession.access_token) : {};
    const jwtRoles = (jwtPayload.roles ?? currentSession?.user?.app_metadata?.roles) as AppRole[] | undefined;

    // profiles.id = auth.users.id (standard Supabase convention on this project)
    const profileRes = await supabase.from("profiles").select("*").eq("id", userId).single();
    if (profileRes.data) setProfile(profileRes.data);

    // Flush any pending NDA acceptance recorded at signup time
    const pendingNda = localStorage.getItem("pending_nda_acceptance");
    if (pendingNda) {
      try {
        const ndaData = JSON.parse(pendingNda);
        // Check not already recorded
        const { count } = await supabase
          .from("document_acceptances" as any)
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId)
          .eq("document_type", "nda");
        if (!count || count === 0) {
          await supabase.from("document_acceptances" as any).insert({
            actor_type: "originator_user",
            actor_id: userId,
            actor_email: ndaData.actor_email,
            user_id: userId,
            document_type: "nda",
            document_version: ndaData.document_version || "1.0",
            acceptance_method: "in_app_checkbox",
            accepted_at: ndaData.accepted_at,
          });
        }
        localStorage.removeItem("pending_nda_acceptance");
      } catch {
        localStorage.removeItem("pending_nda_acceptance");
      }
    }

    if (jwtRoles && jwtRoles.length > 0) {
      // Fast path: roles from JWT claim (no extra DB round-trip)
      setRoles(jwtRoles);
    } else {
      // Fallback: DB RPC for users who haven't re-logged in since hook registration
      const rolesRes = await supabase.rpc("get_user_roles", { _user_id: userId });
      if (rolesRes.data) setRoles(rolesRes.data as AppRole[]);
    }
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (!error) {
      auditLogger.log(AuditLogger.Actions.LOGIN, "session", undefined, { email });
    }
    return { error };
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
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
