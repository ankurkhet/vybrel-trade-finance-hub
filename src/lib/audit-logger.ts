/**
 * Client-side audit logger for tracking user actions.
 * In production, these entries would be sent to the audit_log table via Supabase.
 */

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

    // Batch flush every 5 seconds or when queue reaches 10 entries
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

    // TODO: Send to Supabase audit_log table
    // await supabase.from('audit_log').insert(entries.map(e => ({
    //   ...e,
    //   user_id: currentUserId,
    // })));

    if (import.meta.env.DEV) {
      console.debug("[Audit]", entries);
    }
  }

  // Pre-defined audit actions for consistency
  static Actions = {
    // Auth
    LOGIN: "auth.login",
    LOGOUT: "auth.logout",
    MFA_ENROLL: "auth.mfa_enroll",
    MFA_VERIFY: "auth.mfa_verify",
    PASSWORD_CHANGE: "auth.password_change",
    SESSION_EXPIRED: "auth.session_expired",

    // Data access
    VIEW: "data.view",
    CREATE: "data.create",
    UPDATE: "data.update",
    DELETE: "data.delete",
    EXPORT: "data.export",

    // Financial
    TRANSACTION_INITIATE: "financial.transaction_initiate",
    TRANSACTION_APPROVE: "financial.transaction_approve",
    TRANSACTION_REJECT: "financial.transaction_reject",
    DISBURSEMENT_APPROVE: "financial.disbursement_approve",
    FACILITY_CHANGE: "financial.facility_change",

    // Compliance
    KYC_CHECK: "compliance.kyc_check",
    AML_SCREENING: "compliance.aml_screening",
    DOCUMENT_UPLOAD: "compliance.document_upload",
    CREDIT_DECISION: "compliance.credit_decision",

    // Admin
    USER_CREATE: "admin.user_create",
    USER_ROLE_CHANGE: "admin.user_role_change",
    SETTINGS_CHANGE: "admin.settings_change",
    IP_WHITELIST_CHANGE: "admin.ip_whitelist_change",
  } as const;
}

export const auditLogger = new AuditLogger();
export { AuditLogger };
