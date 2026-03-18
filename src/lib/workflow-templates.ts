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
];
