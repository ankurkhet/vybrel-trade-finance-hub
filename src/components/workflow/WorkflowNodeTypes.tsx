import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { cn } from "@/lib/utils";
import {
  Circle,
  Diamond,
  Zap,
  Play,
  Square,
  GitBranch,
  Bell,
  Settings2,
} from "lucide-react";

function StatusNode({ data, selected }: NodeProps) {
  const colorMap: Record<string, string> = {
    emerald: "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30",
    red: "border-red-500 bg-red-50 dark:bg-red-950/30",
    amber: "border-amber-500 bg-amber-50 dark:bg-amber-950/30",
    blue: "border-blue-500 bg-blue-50 dark:bg-blue-950/30",
    default: "border-primary/40 bg-card",
  };
  const color = (data as any).color || "default";

  return (
    <div
      className={cn(
        "rounded-xl border-2 px-5 py-3 shadow-md min-w-[160px] text-center transition-all",
        colorMap[color] || colorMap.default,
        selected && "ring-2 ring-primary ring-offset-2"
      )}
    >
      <Handle type="target" position={Position.Top} className="!bg-primary !w-3 !h-3" />
      <div className="flex items-center justify-center gap-2">
        <Circle className="h-3.5 w-3.5 text-primary shrink-0" />
        <span className="text-sm font-semibold">{(data as any).label}</span>
      </div>
      {(data as any).description && (
        <p className="text-[10px] text-muted-foreground mt-1 leading-tight">{(data as any).description}</p>
      )}
      <Handle type="source" position={Position.Bottom} className="!bg-primary !w-3 !h-3" />
    </div>
  );
}

function ConditionNode({ data, selected }: NodeProps) {
  return (
    <div
      className={cn(
        "rounded-lg border-2 border-amber-500 bg-amber-50 dark:bg-amber-950/30 px-5 py-3 shadow-md min-w-[160px] text-center transition-all",
        selected && "ring-2 ring-amber-500 ring-offset-2"
      )}
      style={{ transform: "rotate(0deg)" }}
    >
      <Handle type="target" position={Position.Top} className="!bg-amber-500 !w-3 !h-3" />
      <div className="flex items-center justify-center gap-2">
        <GitBranch className="h-3.5 w-3.5 text-amber-600 shrink-0" />
        <span className="text-sm font-semibold text-amber-900 dark:text-amber-200">{(data as any).label}</span>
      </div>
      <Handle type="source" position={Position.Bottom} id="yes" className="!bg-emerald-500 !w-3 !h-3 !left-[30%]" />
      <Handle type="source" position={Position.Bottom} id="no" className="!bg-red-500 !w-3 !h-3 !left-[70%]" />
      <Handle type="source" position={Position.Right} id="reject" className="!bg-red-500 !w-2.5 !h-2.5" />
    </div>
  );
}

function ActionNode({ data, selected }: NodeProps) {
  return (
    <div
      className={cn(
        "rounded-lg border-2 border-blue-500 bg-blue-50 dark:bg-blue-950/30 px-5 py-3 shadow-md min-w-[160px] text-center transition-all",
        selected && "ring-2 ring-blue-500 ring-offset-2"
      )}
    >
      <Handle type="target" position={Position.Top} className="!bg-blue-500 !w-3 !h-3" />
      <div className="flex items-center justify-center gap-2">
        <Zap className="h-3.5 w-3.5 text-blue-600 shrink-0" />
        <span className="text-sm font-semibold text-blue-900 dark:text-blue-200">{(data as any).label}</span>
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-blue-500 !w-3 !h-3" />
    </div>
  );
}

function TriggerNode({ data, selected }: NodeProps) {
  return (
    <div
      className={cn(
        "rounded-full border-2 border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 px-6 py-3 shadow-md min-w-[160px] text-center transition-all",
        selected && "ring-2 ring-emerald-500 ring-offset-2"
      )}
    >
      <div className="flex items-center justify-center gap-2">
        <Play className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
        <span className="text-sm font-semibold text-emerald-900 dark:text-emerald-200">{(data as any).label}</span>
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-emerald-500 !w-3 !h-3" />
    </div>
  );
}

function EndNode({ data, selected }: NodeProps) {
  const colorMap: Record<string, string> = {
    emerald: "border-emerald-500 bg-emerald-100 dark:bg-emerald-950/50",
    red: "border-red-500 bg-red-100 dark:bg-red-950/50",
    default: "border-muted-foreground/40 bg-muted",
  };
  const color = (data as any).color || "default";
  return (
    <div
      className={cn(
        "rounded-full border-2 px-6 py-3 shadow-md min-w-[120px] text-center transition-all",
        colorMap[color] || colorMap.default,
        selected && "ring-2 ring-primary ring-offset-2"
      )}
    >
      <Handle type="target" position={Position.Top} className="!bg-muted-foreground !w-3 !h-3" />
      <div className="flex items-center justify-center gap-2">
        <Square className="h-3 w-3 text-muted-foreground shrink-0" />
        <span className="text-sm font-semibold">{(data as any).label}</span>
      </div>
    </div>
  );
}

export const nodeTypes = {
  status: memo(StatusNode),
  condition: memo(ConditionNode),
  action: memo(ActionNode),
  trigger: memo(TriggerNode),
  end: memo(EndNode),
};

export const NODE_PALETTE = [
  { type: "trigger", label: "Trigger", icon: Play, color: "text-emerald-600" },
  { type: "status", label: "Status", icon: Circle, color: "text-primary" },
  { type: "condition", label: "Condition", icon: GitBranch, color: "text-amber-600" },
  { type: "action", label: "Action", icon: Zap, color: "text-blue-600" },
  { type: "end", label: "End", icon: Square, color: "text-muted-foreground" },
];
