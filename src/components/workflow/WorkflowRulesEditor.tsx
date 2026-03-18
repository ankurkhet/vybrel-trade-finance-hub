import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Zap, GitBranch, Bell, Settings2 } from "lucide-react";
import type { WorkflowRule } from "@/lib/workflow-templates";

interface WorkflowRulesEditorProps {
  rules: WorkflowRule[];
  onChange: (rules: WorkflowRule[]) => void;
  readOnly?: boolean;
}

const TABLES = [
  "invoices",
  "borrowers",
  "contracts",
  "collections",
  "credit_committee_applications",
  "documents",
  "funding_offers",
];

const EVENTS = ["INSERT", "UPDATE", "STATUS_CHANGE"];

const OPERATORS = [
  { value: "eq", label: "equals" },
  { value: "neq", label: "not equals" },
  { value: "gt", label: "greater than" },
  { value: "lt", label: "less than" },
  { value: "gte", label: "≥" },
  { value: "lte", label: "≤" },
  { value: "in", label: "in list" },
  { value: "contains", label: "contains" },
];

const ACTION_TYPES = [
  { value: "set_field", label: "Set Field", icon: Settings2 },
  { value: "send_notification", label: "Send Notification", icon: Bell },
  { value: "call_edge_function", label: "Call Function", icon: Zap },
  { value: "transition_status", label: "Change Status", icon: GitBranch },
];

export function WorkflowRulesEditor({ rules, onChange, readOnly }: WorkflowRulesEditorProps) {
  const addRule = () => {
    onChange([
      ...rules,
      {
        id: `rule-${Date.now()}`,
        name: "New Rule",
        description: "",
        trigger: { table: "invoices", event: "INSERT" },
        conditions: [],
        actions: [],
      },
    ]);
  };

  const updateRule = (index: number, updates: Partial<WorkflowRule>) => {
    const updated = [...rules];
    updated[index] = { ...updated[index], ...updates };
    onChange(updated);
  };

  const removeRule = (index: number) => {
    onChange(rules.filter((_, i) => i !== index));
  };

  const addCondition = (ruleIndex: number) => {
    const updated = [...rules];
    updated[ruleIndex].conditions.push({ field: "", operator: "eq", value: "" });
    onChange(updated);
  };

  const addAction = (ruleIndex: number) => {
    const updated = [...rules];
    updated[ruleIndex].actions.push({ type: "set_field", config: {} });
    onChange(updated);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">Automation Rules</h3>
          <p className="text-xs text-muted-foreground">
            Define triggers, conditions, and actions that execute automatically
          </p>
        </div>
        {!readOnly && (
          <Button variant="outline" size="sm" onClick={addRule}>
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Add Rule
          </Button>
        )}
      </div>

      {rules.map((rule, ruleIdx) => (
        <Card key={rule.id} className="border-l-4 border-l-primary">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between">
              <div className="flex-1 space-y-2">
                {readOnly ? (
                  <CardTitle className="text-sm">{rule.name}</CardTitle>
                ) : (
                  <Input
                    value={rule.name}
                    onChange={(e) => updateRule(ruleIdx, { name: e.target.value })}
                    className="h-7 text-sm font-semibold"
                    placeholder="Rule name"
                  />
                )}
                {readOnly ? (
                  <p className="text-xs text-muted-foreground">{rule.description}</p>
                ) : (
                  <Input
                    value={rule.description}
                    onChange={(e) => updateRule(ruleIdx, { description: e.target.value })}
                    className="h-7 text-xs"
                    placeholder="Description"
                  />
                )}
              </div>
              {!readOnly && (
                <Button variant="ghost" size="sm" onClick={() => removeRule(ruleIdx)}>
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Trigger */}
            <div>
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                When
              </Label>
              <div className="flex gap-2 mt-1.5">
                <Select
                  value={rule.trigger.table}
                  onValueChange={(v) =>
                    updateRule(ruleIdx, { trigger: { ...rule.trigger, table: v } })
                  }
                  disabled={readOnly}
                >
                  <SelectTrigger className="h-8 text-xs flex-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TABLES.map((t) => (
                      <SelectItem key={t} value={t} className="text-xs">{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={rule.trigger.event}
                  onValueChange={(v) =>
                    updateRule(ruleIdx, {
                      trigger: { ...rule.trigger, event: v as any },
                    })
                  }
                  disabled={readOnly}
                >
                  <SelectTrigger className="h-8 text-xs w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EVENTS.map((e) => (
                      <SelectItem key={e} value={e} className="text-xs">{e}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Conditions */}
            <div>
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  If ({rule.conditions.length} condition{rule.conditions.length !== 1 ? "s" : ""})
                </Label>
                {!readOnly && (
                  <Button variant="ghost" size="sm" className="h-6 text-[10px]" onClick={() => addCondition(ruleIdx)}>
                    <Plus className="h-2.5 w-2.5 mr-1" /> Add
                  </Button>
                )}
              </div>
              {rule.conditions.map((cond, condIdx) => (
                <div key={condIdx} className="flex gap-2 mt-1.5 items-center">
                  <Input
                    value={cond.field}
                    onChange={(e) => {
                      const updated = [...rules];
                      updated[ruleIdx].conditions[condIdx].field = e.target.value;
                      onChange(updated);
                    }}
                    className="h-7 text-xs flex-1"
                    placeholder="field"
                    disabled={readOnly}
                  />
                  <Select
                    value={cond.operator}
                    onValueChange={(v) => {
                      const updated = [...rules];
                      updated[ruleIdx].conditions[condIdx].operator = v as any;
                      onChange(updated);
                    }}
                    disabled={readOnly}
                  >
                    <SelectTrigger className="h-7 text-xs w-28">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {OPERATORS.map((op) => (
                        <SelectItem key={op.value} value={op.value} className="text-xs">{op.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    value={String(cond.value)}
                    onChange={(e) => {
                      const updated = [...rules];
                      updated[ruleIdx].conditions[condIdx].value = e.target.value;
                      onChange(updated);
                    }}
                    className="h-7 text-xs flex-1"
                    placeholder="value"
                    disabled={readOnly}
                  />
                  {!readOnly && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      onClick={() => {
                        const updated = [...rules];
                        updated[ruleIdx].conditions.splice(condIdx, 1);
                        onChange(updated);
                      }}
                    >
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  )}
                </div>
              ))}
            </div>

            {/* Actions */}
            <div>
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Then ({rule.actions.length} action{rule.actions.length !== 1 ? "s" : ""})
                </Label>
                {!readOnly && (
                  <Button variant="ghost" size="sm" className="h-6 text-[10px]" onClick={() => addAction(ruleIdx)}>
                    <Plus className="h-2.5 w-2.5 mr-1" /> Add
                  </Button>
                )}
              </div>
              {rule.actions.map((act, actIdx) => {
                const actionDef = ACTION_TYPES.find((a) => a.value === act.type);
                return (
                  <div key={actIdx} className="flex gap-2 mt-1.5 items-center">
                    <Select
                      value={act.type}
                      onValueChange={(v) => {
                        const updated = [...rules];
                        updated[ruleIdx].actions[actIdx].type = v as any;
                        onChange(updated);
                      }}
                      disabled={readOnly}
                    >
                      <SelectTrigger className="h-7 text-xs w-44">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ACTION_TYPES.map((a) => (
                          <SelectItem key={a.value} value={a.value} className="text-xs">{a.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      value={JSON.stringify(act.config)}
                      onChange={(e) => {
                        try {
                          const updated = [...rules];
                          updated[ruleIdx].actions[actIdx].config = JSON.parse(e.target.value);
                          onChange(updated);
                        } catch {}
                      }}
                      className="h-7 text-xs flex-1 font-mono"
                      placeholder='{"key": "value"}'
                      disabled={readOnly}
                    />
                    {!readOnly && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() => {
                          const updated = [...rules];
                          updated[ruleIdx].actions.splice(actIdx, 1);
                          onChange(updated);
                        }}
                      >
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      ))}

      {rules.length === 0 && (
        <div className="text-center py-8 text-muted-foreground text-sm">
          No automation rules defined. Add rules to automate workflow behavior.
        </div>
      )}
    </div>
  );
}
