// Pre-built workflow templates for Vybrel processes

export interface WorkflowNode {
  id: string;
  type: 'status' | 'condition' | 'action' | 'trigger' | 'end';
  position: { x: number; y: number };
  data: {
    label: string;
    description?: string;
    statusValue?: string;
    conditionType?: 'field_check' | 'role_check' | 'amount_threshold' | 'custom';
    conditionConfig?: Record<string, unknown>;
    actionType?: 'update_field' | 'send_notification' | 'call_function' | 'set_status' | 'auto_approve';
    actionConfig?: Record<string, unknown>;
    triggerType?: 'on_create' | 'on_update' | 'on_status_change' | 'scheduled';
    triggerConfig?: Record<string, unknown>;
    color?: string;
  };
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  label?: string;
  animated?: boolean;
  data?: {
    conditionLabel?: string;
  };
}

export interface WorkflowRule {
  id: string;
  name: string;
  description: string;
  trigger: {
    table: string;
    event: 'INSERT' | 'UPDATE' | 'STATUS_CHANGE';
    field?: string;
  };
  conditions: Array<{
    field: string;
    operator: 'eq' | 'neq' | 'gt' | 'lt' | 'gte' | 'lte' | 'in' | 'contains';
    value: unknown;
  }>;
  actions: Array<{
    type: 'set_field' | 'send_notification' | 'call_edge_function' | 'transition_status';
    config: Record<string, unknown>;
  }>;
}

export interface WorkflowTemplate {
  name: string;
  slug: string;
  description: string;
  category: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  rules: WorkflowRule[];
}

export const WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
  {
    name: 'Invoice Lifecycle',
    slug: 'invoice-lifecycle',
    description: 'Controls the full invoice journey from submission to settlement',
    category: 'invoices',
    nodes: [
      { id: 'trigger-1', type: 'trigger', position: { x: 400, y: 0 }, data: { label: 'Invoice Created', triggerType: 'on_create', triggerConfig: { table: 'invoices' }, color: 'emerald' } },
      { id: 'status-pending', type: 'status', position: { x: 400, y: 120 }, data: { label: 'Pending', statusValue: 'pending', description: 'Invoice submitted, awaiting review' } },
      { id: 'cond-counterparty', type: 'condition', position: { x: 400, y: 240 }, data: { label: 'Requires Counterparty?', conditionType: 'field_check', conditionConfig: { field: 'requires_counterparty_acceptance', value: true } } },
      { id: 'action-notify-cp', type: 'action', position: { x: 150, y: 360 }, data: { label: 'Notify Counterparty', actionType: 'send_notification', actionConfig: { template: 'counterparty_verification', to: 'counterparty_email' } } },
      { id: 'status-awaiting-cp', type: 'status', position: { x: 150, y: 480 }, data: { label: 'Awaiting Acceptance', statusValue: 'awaiting_acceptance' } },
      { id: 'status-review', type: 'status', position: { x: 400, y: 480 }, data: { label: 'Under Review', statusValue: 'under_review' } },
      { id: 'cond-auto-approve', type: 'condition', position: { x: 400, y: 600 }, data: { label: 'Auto-approve?', conditionType: 'amount_threshold', conditionConfig: { field: 'amount', operator: 'lte', threshold_field: 'auto_approve_below' } } },
      { id: 'action-auto-approve', type: 'action', position: { x: 150, y: 720 }, data: { label: 'Auto Approve', actionType: 'auto_approve' } },
      { id: 'status-approved', type: 'status', position: { x: 400, y: 840 }, data: { label: 'Approved', statusValue: 'approved', color: 'emerald' } },
      { id: 'status-rejected', type: 'status', position: { x: 700, y: 720 }, data: { label: 'Rejected', statusValue: 'rejected', color: 'red' } },
      { id: 'status-funded', type: 'status', position: { x: 400, y: 960 }, data: { label: 'Funded', statusValue: 'funded' } },
      { id: 'action-settlement', type: 'action', position: { x: 400, y: 1080 }, data: { label: 'Generate Settlement', actionType: 'call_function', actionConfig: { function: 'generate-settlement' } } },
      { id: 'end-settled', type: 'end', position: { x: 400, y: 1200 }, data: { label: 'Settled' } },
    ],
    edges: [
      { id: 'e1', source: 'trigger-1', target: 'status-pending' },
      { id: 'e2', source: 'status-pending', target: 'cond-counterparty' },
      { id: 'e3', source: 'cond-counterparty', target: 'action-notify-cp', sourceHandle: 'yes', label: 'Yes' },
      { id: 'e4', source: 'cond-counterparty', target: 'status-review', sourceHandle: 'no', label: 'No' },
      { id: 'e5', source: 'action-notify-cp', target: 'status-awaiting-cp' },
      { id: 'e6', source: 'status-awaiting-cp', target: 'status-review', label: 'Accepted' },
      { id: 'e7', source: 'status-review', target: 'cond-auto-approve' },
      { id: 'e8', source: 'cond-auto-approve', target: 'action-auto-approve', sourceHandle: 'yes', label: 'Yes' },
      { id: 'e9', source: 'cond-auto-approve', target: 'status-approved', sourceHandle: 'no', label: 'Manual Approve' },
      { id: 'e10', source: 'action-auto-approve', target: 'status-approved' },
      { id: 'e11', source: 'cond-auto-approve', target: 'status-rejected', sourceHandle: 'reject', label: 'Reject' },
      { id: 'e12', source: 'status-approved', target: 'status-funded' },
      { id: 'e13', source: 'status-funded', target: 'action-settlement' },
      { id: 'e14', source: 'action-settlement', target: 'end-settled' },
    ],
    rules: [
      {
        id: 'rule-inv-1',
        name: 'Auto-notify counterparty',
        description: 'Send verification email when invoice requires counterparty acceptance',
        trigger: { table: 'invoices', event: 'INSERT' },
        conditions: [{ field: 'requires_counterparty_acceptance', operator: 'eq', value: true }],
        actions: [{ type: 'call_edge_function', config: { function: 'notify-counterparty' } }],
      },
      {
        id: 'rule-inv-2',
        name: 'Auto-approve small invoices',
        description: 'Automatically approve invoices below the org threshold',
        trigger: { table: 'invoices', event: 'STATUS_CHANGE', field: 'under_review' },
        conditions: [{ field: 'amount', operator: 'lte', value: '{org.auto_approve_below}' }],
        actions: [{ type: 'transition_status', config: { to: 'approved' } }],
      },
    ],
  },
  {
    name: 'Borrower Onboarding',
    slug: 'borrower-onboarding',
    description: 'Manages the borrower journey from invitation to active status',
    category: 'borrowers',
    nodes: [
      { id: 'trigger-1', type: 'trigger', position: { x: 400, y: 0 }, data: { label: 'Borrower Invited', triggerType: 'on_create', triggerConfig: { table: 'borrowers' }, color: 'blue' } },
      { id: 'status-invited', type: 'status', position: { x: 400, y: 120 }, data: { label: 'Invited', statusValue: 'invited' } },
      { id: 'action-send-invite', type: 'action', position: { x: 150, y: 120 }, data: { label: 'Send Invitation Email', actionType: 'send_notification', actionConfig: { template: 'borrower_invite' } } },
      { id: 'status-registered', type: 'status', position: { x: 400, y: 260 }, data: { label: 'Registered', statusValue: 'registered' } },
      { id: 'status-docs-pending', type: 'status', position: { x: 400, y: 400 }, data: { label: 'Documents Pending', statusValue: 'documents_pending' } },
      { id: 'cond-docs-complete', type: 'condition', position: { x: 400, y: 540 }, data: { label: 'All Docs Submitted?', conditionType: 'field_check', conditionConfig: { check: 'required_documents_uploaded' } } },
      { id: 'status-docs-submitted', type: 'status', position: { x: 400, y: 680 }, data: { label: 'Documents Submitted', statusValue: 'documents_submitted' } },
      { id: 'action-ai-kyc', type: 'action', position: { x: 150, y: 680 }, data: { label: 'AI KYC/AML Check', actionType: 'call_function', actionConfig: { function: 'ai-analyze-document' } } },
      { id: 'cond-kyc-pass', type: 'condition', position: { x: 400, y: 820 }, data: { label: 'KYC & AML Cleared?', conditionType: 'field_check', conditionConfig: { fields: ['kyc_completed', 'aml_cleared'] } } },
      { id: 'action-set-limit', type: 'action', position: { x: 400, y: 960 }, data: { label: 'Set Credit Limit', actionType: 'update_field', actionConfig: { field: 'credit_limit', source: 'ai_recommendation' } } },
      { id: 'end-active', type: 'end', position: { x: 400, y: 1080 }, data: { label: 'Active Borrower', color: 'emerald' } },
      { id: 'end-rejected', type: 'end', position: { x: 700, y: 820 }, data: { label: 'Rejected', color: 'red' } },
    ],
    edges: [
      { id: 'e1', source: 'trigger-1', target: 'status-invited' },
      { id: 'e1b', source: 'status-invited', target: 'action-send-invite' },
      { id: 'e2', source: 'status-invited', target: 'status-registered', label: 'Signs Up' },
      { id: 'e3', source: 'status-registered', target: 'status-docs-pending' },
      { id: 'e4', source: 'status-docs-pending', target: 'cond-docs-complete' },
      { id: 'e5', source: 'cond-docs-complete', target: 'status-docs-submitted', sourceHandle: 'yes', label: 'Yes' },
      { id: 'e5b', source: 'cond-docs-complete', target: 'status-docs-pending', sourceHandle: 'no', label: 'No' },
      { id: 'e6', source: 'status-docs-submitted', target: 'action-ai-kyc' },
      { id: 'e7', source: 'action-ai-kyc', target: 'cond-kyc-pass' },
      { id: 'e8', source: 'cond-kyc-pass', target: 'action-set-limit', sourceHandle: 'yes', label: 'Pass' },
      { id: 'e9', source: 'cond-kyc-pass', target: 'end-rejected', sourceHandle: 'no', label: 'Fail' },
      { id: 'e10', source: 'action-set-limit', target: 'end-active' },
    ],
    rules: [
      {
        id: 'rule-borr-1',
        name: 'Send invite email on create',
        description: 'Automatically send invitation email when a borrower is created',
        trigger: { table: 'borrowers', event: 'INSERT' },
        conditions: [],
        actions: [{ type: 'send_notification', config: { template: 'borrower_invite', to_field: 'contact_email' } }],
      },
    ],
  },
  {
    name: 'Originator Onboarding',
    slug: 'originator-onboarding',
    description: 'Manages the originator organization journey from creation to approval and activation',
    category: 'organizations',
    nodes: [
      { id: 'trigger-1', type: 'trigger', position: { x: 400, y: 0 }, data: { label: 'Originator Created', triggerType: 'on_create', triggerConfig: { table: 'organizations' }, color: 'indigo' } },
      { id: 'status-pending-docs', type: 'status', position: { x: 400, y: 120 }, data: { label: 'Pending Documents', statusValue: 'pending_documents' } },
      { id: 'action-send-invite', type: 'action', position: { x: 150, y: 120 }, data: { label: 'Send Contact Invitations', actionType: 'send_notification', actionConfig: { template: 'originator_invite', to: 'org_contacts' } } },
      { id: 'status-docs-submitted', type: 'status', position: { x: 400, y: 260 }, data: { label: 'Documents Submitted', statusValue: 'documents_submitted' } },
      { id: 'status-under-review', type: 'status', position: { x: 400, y: 400 }, data: { label: 'Under Review', statusValue: 'under_review' } },
      { id: 'action-review-kyc', type: 'action', position: { x: 150, y: 400 }, data: { label: 'Admin Reviews KYC/KYB', actionType: 'call_function', actionConfig: { manual: true } } },
      { id: 'cond-all-approved', type: 'condition', position: { x: 400, y: 540 }, data: { label: 'All Docs Approved?', conditionType: 'field_check', conditionConfig: { check: 'all_org_documents_approved' } } },
      { id: 'status-on-hold', type: 'status', position: { x: 700, y: 400 }, data: { label: 'On Hold', statusValue: 'on_hold', color: 'amber' } },
      { id: 'status-approved', type: 'status', position: { x: 400, y: 680 }, data: { label: 'Approved & Active', statusValue: 'approved', color: 'emerald' } },
      { id: 'action-activate', type: 'action', position: { x: 400, y: 800 }, data: { label: 'Activate Organization', actionType: 'update_field', actionConfig: { field: 'is_active', value: true } } },
      { id: 'end-active', type: 'end', position: { x: 400, y: 920 }, data: { label: 'Live Originator', color: 'emerald' } },
      { id: 'end-rejected', type: 'end', position: { x: 700, y: 680 }, data: { label: 'Rejected', color: 'red' } },
    ],
    edges: [
      { id: 'e1', source: 'trigger-1', target: 'status-pending-docs' },
      { id: 'e1b', source: 'status-pending-docs', target: 'action-send-invite' },
      { id: 'e2', source: 'status-pending-docs', target: 'status-docs-submitted', label: 'Docs Uploaded' },
      { id: 'e3', source: 'status-docs-submitted', target: 'status-under-review', label: 'Start Review' },
      { id: 'e4', source: 'status-under-review', target: 'action-review-kyc' },
      { id: 'e5', source: 'action-review-kyc', target: 'cond-all-approved' },
      { id: 'e6', source: 'cond-all-approved', target: 'status-approved', sourceHandle: 'yes', label: 'Yes' },
      { id: 'e7', source: 'cond-all-approved', target: 'end-rejected', sourceHandle: 'reject', label: 'Reject' },
      { id: 'e8', source: 'status-under-review', target: 'status-on-hold', label: 'Put On Hold' },
      { id: 'e9', source: 'status-on-hold', target: 'status-under-review', label: 'Resume' },
      { id: 'e10', source: 'status-approved', target: 'action-activate' },
      { id: 'e11', source: 'action-activate', target: 'end-active' },
    ],
    rules: [
      {
        id: 'rule-org-1',
        name: 'Send invitations on org creation',
        description: 'Automatically send invitation emails to org contacts when organization is created',
        trigger: { table: 'organizations', event: 'INSERT' },
        conditions: [],
        actions: [{ type: 'send_notification', config: { template: 'originator_invite', to: 'org_contacts' } }],
      },
      {
        id: 'rule-org-2',
        name: 'Activate on approval',
        description: 'Set organization as active when approved',
        trigger: { table: 'organizations', event: 'STATUS_CHANGE', field: 'approved' },
        conditions: [],
        actions: [{ type: 'set_field', config: { field: 'is_active', value: true } }],
      },
    ],
  },
  {
    name: 'Credit Committee Review',
    slug: 'credit-committee-review',
    description: 'Manages the credit committee application and voting workflow',
    category: 'credit_committee',
    nodes: [
      { id: 'trigger-1', type: 'trigger', position: { x: 400, y: 0 }, data: { label: 'Application Created', triggerType: 'on_create', triggerConfig: { table: 'credit_committee_applications' }, color: 'purple' } },
      { id: 'status-draft', type: 'status', position: { x: 400, y: 120 }, data: { label: 'Draft', statusValue: 'draft' } },
      { id: 'status-submitted', type: 'status', position: { x: 400, y: 260 }, data: { label: 'Submitted', statusValue: 'submitted' } },
      { id: 'action-notify-members', type: 'action', position: { x: 150, y: 260 }, data: { label: 'Notify Committee Members', actionType: 'send_notification', actionConfig: { template: 'cc_vote_requested', to: 'committee_members' } } },
      { id: 'status-under-review', type: 'status', position: { x: 400, y: 400 }, data: { label: 'Under Review', statusValue: 'under_review' } },
      { id: 'cond-info-request', type: 'condition', position: { x: 150, y: 530 }, data: { label: 'Info Requested?', conditionType: 'field_check', conditionConfig: { check: 'has_open_info_requests' } } },
      { id: 'status-pending-info', type: 'status', position: { x: 0, y: 660 }, data: { label: 'Pending Info', statusValue: 'pending_info', color: 'amber' } },
      { id: 'cond-quorum', type: 'condition', position: { x: 400, y: 530 }, data: { label: 'Quorum Reached?', conditionType: 'custom', conditionConfig: { check: 'quorum_met', source: 'credit_committee_config' } } },
      { id: 'action-decide', type: 'action', position: { x: 400, y: 660 }, data: { label: 'Execute Decision', actionType: 'call_function', actionConfig: { function: 'credit-committee-decide' } } },
      { id: 'status-approved', type: 'status', position: { x: 250, y: 800 }, data: { label: 'Approved', statusValue: 'approved', color: 'emerald' } },
      { id: 'status-rejected', type: 'status', position: { x: 550, y: 800 }, data: { label: 'Rejected', statusValue: 'rejected', color: 'red' } },
      { id: 'action-minutes', type: 'action', position: { x: 400, y: 940 }, data: { label: 'Generate Minutes', actionType: 'call_function', actionConfig: { function: 'generate-minutes' } } },
      { id: 'cond-reopen', type: 'condition', position: { x: 400, y: 1060 }, data: { label: 'Re-raised?', conditionType: 'field_check', conditionConfig: { check: 'has_child_application' } } },
      { id: 'end-final', type: 'end', position: { x: 400, y: 1180 }, data: { label: 'Finalized' } },
    ],
    edges: [
      { id: 'e1', source: 'trigger-1', target: 'status-draft' },
      { id: 'e2', source: 'status-draft', target: 'status-submitted', label: 'Submit' },
      { id: 'e3', source: 'status-submitted', target: 'action-notify-members' },
      { id: 'e4', source: 'status-submitted', target: 'status-under-review' },
      { id: 'e5', source: 'status-under-review', target: 'cond-info-request' },
      { id: 'e5b', source: 'status-under-review', target: 'cond-quorum' },
      { id: 'e6', source: 'cond-info-request', target: 'status-pending-info', sourceHandle: 'yes', label: 'Yes' },
      { id: 'e6b', source: 'status-pending-info', target: 'status-under-review', label: 'Info Provided' },
      { id: 'e7', source: 'cond-quorum', target: 'action-decide', sourceHandle: 'yes', label: 'Yes' },
      { id: 'e8', source: 'action-decide', target: 'status-approved', label: 'Approve' },
      { id: 'e9', source: 'action-decide', target: 'status-rejected', label: 'Reject' },
      { id: 'e10', source: 'status-approved', target: 'action-minutes' },
      { id: 'e10b', source: 'status-rejected', target: 'action-minutes' },
      { id: 'e11', source: 'action-minutes', target: 'cond-reopen' },
      { id: 'e12', source: 'cond-reopen', target: 'status-draft', sourceHandle: 'yes', label: 'Re-raised' },
      { id: 'e13', source: 'cond-reopen', target: 'end-final', sourceHandle: 'no', label: 'No' },
    ],
    rules: [
      {
        id: 'rule-cc-1',
        name: 'Notify committee on submission',
        description: 'Notify all active committee members when application is submitted',
        trigger: { table: 'credit_committee_applications', event: 'STATUS_CHANGE', field: 'submitted' },
        conditions: [],
        actions: [{ type: 'send_notification', config: { template: 'cc_vote_requested', to: 'active_committee_members' } }],
      },
      {
        id: 'rule-cc-2',
        name: 'Auto-execute on quorum',
        description: 'Execute decision when minimum votes reached',
        trigger: { table: 'credit_committee_minutes', event: 'UPDATE' },
        conditions: [{ field: 'votes_count', operator: 'gte', value: '{config.minimum_votes_required}' }],
        actions: [{ type: 'call_edge_function', config: { function: 'credit-committee-decide' } }],
      },
    ],
  },
  {
    name: 'Collection & Settlement',
    slug: 'collection-settlement',
    description: 'Manages collections from receipt to final settlement distribution',
    category: 'settlements',
    nodes: [
      { id: 'trigger-1', type: 'trigger', position: { x: 400, y: 0 }, data: { label: 'Collection Received', triggerType: 'on_create', triggerConfig: { table: 'collections' }, color: 'teal' } },
      { id: 'status-received', type: 'status', position: { x: 400, y: 120 }, data: { label: 'Received', statusValue: 'received' } },
      { id: 'action-match', type: 'action', position: { x: 150, y: 120 }, data: { label: 'Auto-match Invoice', actionType: 'call_function', actionConfig: { function: 'ai-match-invoice' } } },
      { id: 'cond-matched', type: 'condition', position: { x: 400, y: 260 }, data: { label: 'Invoice Matched?', conditionType: 'field_check', conditionConfig: { field: 'invoice_id', operator: 'not_null' } } },
      { id: 'status-confirmed', type: 'status', position: { x: 400, y: 400 }, data: { label: 'Confirmed', statusValue: 'confirmed', color: 'emerald' } },
      { id: 'status-disputed', type: 'status', position: { x: 700, y: 260 }, data: { label: 'Disputed', statusValue: 'disputed', color: 'red' } },
      { id: 'action-gen-settlement', type: 'action', position: { x: 400, y: 540 }, data: { label: 'Generate Settlement Advices', actionType: 'call_function', actionConfig: { function: 'generate-settlement' } } },
      { id: 'action-notify-parties', type: 'action', position: { x: 400, y: 680 }, data: { label: 'Notify All Parties', actionType: 'send_notification', actionConfig: { template: 'settlement_ready', to: ['borrower', 'funder'] } } },
      { id: 'cond-all-paid', type: 'condition', position: { x: 400, y: 820 }, data: { label: 'All Settled?', conditionType: 'field_check', conditionConfig: { check: 'all_advices_paid' } } },
      { id: 'end-settled', type: 'end', position: { x: 400, y: 960 }, data: { label: 'Fully Settled', color: 'emerald' } },
    ],
    edges: [
      { id: 'e1', source: 'trigger-1', target: 'status-received' },
      { id: 'e1b', source: 'status-received', target: 'action-match' },
      { id: 'e2', source: 'status-received', target: 'cond-matched' },
      { id: 'e3', source: 'cond-matched', target: 'status-confirmed', sourceHandle: 'yes', label: 'Yes' },
      { id: 'e4', source: 'cond-matched', target: 'status-disputed', sourceHandle: 'no', label: 'Mismatch' },
      { id: 'e5', source: 'status-disputed', target: 'status-received', label: 'Resolved' },
      { id: 'e6', source: 'status-confirmed', target: 'action-gen-settlement' },
      { id: 'e7', source: 'action-gen-settlement', target: 'action-notify-parties' },
      { id: 'e8', source: 'action-notify-parties', target: 'cond-all-paid' },
      { id: 'e9', source: 'cond-all-paid', target: 'end-settled', sourceHandle: 'yes', label: 'Yes' },
    ],
    rules: [
      {
        id: 'rule-coll-1',
        name: 'Auto-generate settlement on confirm',
        description: 'Generate settlement advices when a collection is confirmed',
        trigger: { table: 'collections', event: 'STATUS_CHANGE', field: 'confirmed' },
        conditions: [],
        actions: [{ type: 'call_edge_function', config: { function: 'generate-settlement' } }],
      },
    ],
  },
  {
    name: 'Disbursement Processing',
    slug: 'disbursement-processing',
    description: 'Manages the disbursement memo lifecycle from creation to payment',
    category: 'disbursements',
    nodes: [
      { id: 'trigger-1', type: 'trigger', position: { x: 400, y: 0 }, data: { label: 'Disbursement Created', triggerType: 'on_create', triggerConfig: { table: 'disbursement_memos' }, color: 'cyan' } },
      { id: 'status-draft', type: 'status', position: { x: 400, y: 120 }, data: { label: 'Draft', statusValue: 'draft' } },
      { id: 'status-pending', type: 'status', position: { x: 400, y: 260 }, data: { label: 'Pending Approval', statusValue: 'pending_approval' } },
      { id: 'cond-amount', type: 'condition', position: { x: 400, y: 400 }, data: { label: 'Above Threshold?', conditionType: 'amount_threshold', conditionConfig: { field: 'disbursement_amount' } } },
      { id: 'status-approved', type: 'status', position: { x: 400, y: 540 }, data: { label: 'Approved', statusValue: 'approved', color: 'emerald' } },
      { id: 'action-pay', type: 'action', position: { x: 400, y: 680 }, data: { label: 'Process Payment', actionType: 'call_function', actionConfig: { function: 'process-disbursement' } } },
      { id: 'end-disbursed', type: 'end', position: { x: 400, y: 800 }, data: { label: 'Disbursed', color: 'emerald' } },
      { id: 'end-rejected', type: 'end', position: { x: 700, y: 540 }, data: { label: 'Rejected', color: 'red' } },
    ],
    edges: [
      { id: 'e1', source: 'trigger-1', target: 'status-draft' },
      { id: 'e2', source: 'status-draft', target: 'status-pending', label: 'Submit' },
      { id: 'e3', source: 'status-pending', target: 'cond-amount' },
      { id: 'e4', source: 'cond-amount', target: 'status-approved', sourceHandle: 'yes', label: 'Approve' },
      { id: 'e5', source: 'cond-amount', target: 'end-rejected', sourceHandle: 'no', label: 'Reject' },
      { id: 'e6', source: 'status-approved', target: 'action-pay' },
      { id: 'e7', source: 'action-pay', target: 'end-disbursed' },
    ],
    rules: [],
  },
  {
    name: 'Facility Request Processing',
    slug: 'facility-request-processing',
    description: 'Manages facility requests from submission through approval and activation',
    category: 'facilities',
    nodes: [
      { id: 'trigger-1', type: 'trigger', position: { x: 400, y: 0 }, data: { label: 'Facility Requested', triggerType: 'on_create', triggerConfig: { table: 'facility_requests' }, color: 'violet' } },
      { id: 'status-requested', type: 'status', position: { x: 400, y: 120 }, data: { label: 'Requested', statusValue: 'requested' } },
      { id: 'status-under-review', type: 'status', position: { x: 400, y: 260 }, data: { label: 'Under Review', statusValue: 'under_review' } },
      { id: 'cond-credit-check', type: 'condition', position: { x: 400, y: 400 }, data: { label: 'Credit Assessment Passed?', conditionType: 'custom', conditionConfig: { check: 'credit_memo_approved' } } },
      { id: 'status-approved', type: 'status', position: { x: 250, y: 540 }, data: { label: 'Approved', statusValue: 'approved', color: 'emerald' } },
      { id: 'status-rejected', type: 'status', position: { x: 550, y: 540 }, data: { label: 'Rejected', statusValue: 'rejected', color: 'red' } },
      { id: 'action-set-limit', type: 'action', position: { x: 250, y: 680 }, data: { label: 'Update Credit Limit', actionType: 'update_field', actionConfig: { target_table: 'borrowers', field: 'credit_limit' } } },
      { id: 'end-active', type: 'end', position: { x: 400, y: 800 }, data: { label: 'Facility Active', color: 'emerald' } },
    ],
    edges: [
      { id: 'e1', source: 'trigger-1', target: 'status-requested' },
      { id: 'e2', source: 'status-requested', target: 'status-under-review', label: 'Review' },
      { id: 'e3', source: 'status-under-review', target: 'cond-credit-check' },
      { id: 'e4', source: 'cond-credit-check', target: 'status-approved', sourceHandle: 'yes', label: 'Pass' },
      { id: 'e5', source: 'cond-credit-check', target: 'status-rejected', sourceHandle: 'no', label: 'Fail' },
      { id: 'e6', source: 'status-approved', target: 'action-set-limit' },
      { id: 'e7', source: 'action-set-limit', target: 'end-active' },
    ],
    rules: [],
  },
];
