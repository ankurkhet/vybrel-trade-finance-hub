import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import type { Database } from "@/integrations/supabase/types";
import { Loader2 } from "lucide-react";

type AppRole = Database["public"]["Enums"]["app_role"];

interface ProtectedRouteProps {
  children: ReactNode;
  requiredRoles?: (AppRole | string)[];
}

export function ProtectedRoute({ children, requiredRoles }: ProtectedRouteProps) {
  const { user, roles, loading } = useAuth();

  if (!user) return <Navigate to="/auth" replace />;

  if (requiredRoles && requiredRoles.length > 0) {
    const hasRequiredRole = requiredRoles.some((r) => roles.includes(r as AppRole));
    if (!hasRequiredRole) return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
