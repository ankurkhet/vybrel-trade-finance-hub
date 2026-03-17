import { supabase } from "@/integrations/supabase/client";

export interface AuditEntry {
  action: string;
  resource_type: string;
  resource_id?: string;
  details?: Record<string, unknown>;
  ip_address?: string;
  user_agent?: string;
  timestamp: string;
}

class AuditLogger {
  private queue: AuditEntry[] = [];
  private flushTimeout: ReturnType<typeof setTimeout> | null = null;

  log(action: string, resourceType: string, resourceId?: string, details?: Record<string, unknown>) {
    const entry: AuditEntry = {
      action,
      resource_type: resourceType,
      resource_id: resourceId,
      details,
      user_agent: navigator.userAgent,
      timestamp: new Date().toISOString(),
    };

    this.queue.push(entry);

    if (this.queue.length >= 10) {
      this.flush();
    } else if (!this.flushTimeout) {
      this.flushTimeout = setTimeout(() => this.flush(), 5000);
    }
  }

  private async flush() {
    if (this.flushTimeout) {
      clearTimeout(this.flushTimeout);
      this.flushTimeout = null;
    }

    if (this.queue.length === 0) return;

    const entries = [...this.queue];
    this.queue = [];

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        if (import.meta.env.DEV) console.debug("[Audit] No user session, skipping persist", entries);
        return;
      }

      const rows = entries.map((e) => ({
        user_id: user.id,
        user_email: user.email || null,
        action: e.action,
        resource_type: e.resource_type,
        resource_id: e.resource_id || null,
        details: e.details || {},
        user_agent: e.user_agent || null,
        created_at: e.timestamp,
      }));

      const { error } = await supabase.from("audit_logs").insert(rows);

      if (error) {
        if (import.meta.env.DEV) console.warn("[Audit] Failed to persist:", error.message);
      }
    } catch (err) {
      if (import.meta.env.DEV) console.warn("[Audit] Flush error:", err);
    }
  }

  // Force flush (e.g. on logout)
  async forceFlush() {
    await this.flush();
  }

  static Actions = {
    LOGIN: "auth.login",
    LOGOUT: "auth.logout",
    MFA_ENROLL: "auth.mfa_enroll",
    MFA_VERIFY: "auth.mfa_verify",
    PASSWORD_CHANGE: "auth.password_change",
    SESSION_EXPIRED: "auth.session_expired",

    VIEW: "data.view",
    CREATE: "data.create",
    UPDATE: "data.update",
    DELETE: "data.delete",
    EXPORT: "data.export",

    TRANSACTION_INITIATE: "financial.transaction_initiate",
    TRANSACTION_APPROVE: "financial.transaction_approve",
    TRANSACTION_REJECT: "financial.transaction_reject",
    DISBURSEMENT_APPROVE: "financial.disbursement_approve",
    FACILITY_CHANGE: "financial.facility_change",

    KYC_CHECK: "compliance.kyc_check",
    AML_SCREENING: "compliance.aml_screening",
    DOCUMENT_UPLOAD: "compliance.document_upload",
    CREDIT_DECISION: "compliance.credit_decision",

    USER_CREATE: "admin.user_create",
    USER_ROLE_CHANGE: "admin.user_role_change",
    SETTINGS_CHANGE: "admin.settings_change",
    IP_WHITELIST_CHANGE: "admin.ip_whitelist_change",
  } as const;
}

export const auditLogger = new AuditLogger();
export { AuditLogger };
