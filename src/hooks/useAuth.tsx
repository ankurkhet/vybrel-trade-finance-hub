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

    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      if (!mounted) return;
      setSession(newSession);
      setUser(newSession?.user ?? null);

      if (newSession?.user) {
        // Use queueMicrotask instead of setTimeout for more reliable timing
        queueMicrotask(async () => {
          if (!mounted) return;
          await fetchProfileAndRoles(newSession.user.id, newSession);
          if (mounted) setLoading(false);
        });
      } else {
        setProfile(null);
        setRoles([]);
        setLoading(false);
      }
    });

    // THEN check for existing session
    supabase.auth.getSession().then(async ({ data: { session: existingSession } }) => {
      if (!mounted) return;
      setSession(existingSession);
      setUser(existingSession?.user ?? null);
      if (existingSession?.user) {
        await fetchProfileAndRoles(existingSession.user.id, existingSession);
      }
      if (mounted) setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const fetchProfileAndRoles = async (userId: string, currentSession?: Session | null) => {
    // Prefer JWT app_metadata claims (set by custom-jwt-claims hook after re-login)
    const appMeta = currentSession?.user?.app_metadata;
    const jwtRoles = appMeta?.roles as AppRole[] | undefined;

    const profileRes = await supabase.from("profiles").select("*").eq("id", userId).single();
    if (profileRes.data) setProfile(profileRes.data);

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
