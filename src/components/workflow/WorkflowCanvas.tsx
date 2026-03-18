import { useCallback, useRef, useState } from "react";
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  addEdge,
  type Connection,
  type Edge,
  type Node,
  Panel,
  MarkerType,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { nodeTypes, NODE_PALETTE } from "./WorkflowNodeTypes";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Save, Undo2, Redo2, ZoomIn, ZoomOut, Maximize2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface WorkflowCanvasProps {
  initialNodes: Node[];
  initialEdges: Edge[];
  readOnly?: boolean;
  onSave?: (nodes: Node[], edges: Edge[]) => void;
  isDirty?: boolean;
}

let nodeId = 100;
const getId = () => `node_${nodeId++}`;

export function WorkflowCanvas({
  initialNodes,
  initialEdges,
  readOnly = false,
  onSave,
  isDirty,
}: WorkflowCanvasProps) {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [reactFlowInstance, setReactFlowInstance] = useState<any>(null);

  const onConnect = useCallback(
    (params: Connection) =>
      setEdges((eds) =>
        addEdge(
          {
            ...params,
            animated: true,
            markerEnd: { type: MarkerType.ArrowClosed },
            style: { strokeWidth: 2 },
          },
          eds
        )
      ),
    [setEdges]
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const type = event.dataTransfer.getData("application/reactflow");
      if (!type || !reactFlowInstance) return;

      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const newNode: Node = {
        id: getId(),
        type,
        position,
        data: { label: `New ${type}` },
      };

      setNodes((nds) => nds.concat(newNode));
    },
    [reactFlowInstance, setNodes]
  );

  const onDragStart = (event: React.DragEvent, nodeType: string) => {
    event.dataTransfer.setData("application/reactflow", nodeType);
    event.dataTransfer.effectAllowed = "move";
  };

  const handleSave = () => {
    onSave?.(nodes, edges);
  };

  return (
    <div className="flex h-full" ref={reactFlowWrapper}>
      {/* Node palette sidebar */}
      {!readOnly && (
        <div className="w-48 shrink-0 border-r bg-muted/30 p-3 space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Node Palette
          </p>
          {NODE_PALETTE.map((item) => (
            <div
              key={item.type}
              draggable
              onDragStart={(e) => onDragStart(e, item.type)}
              className="flex items-center gap-2 rounded-lg border bg-card p-2.5 cursor-grab hover:bg-accent/50 transition-colors active:cursor-grabbing"
            >
              <item.icon className={cn("h-4 w-4 shrink-0", item.color)} />
              <span className="text-xs font-medium">{item.label}</span>
            </div>
          ))}
        </div>
      )}

      {/* Canvas */}
      <div className="flex-1 relative">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={readOnly ? undefined : onNodesChange}
          onEdgesChange={readOnly ? undefined : onEdgesChange}
          onConnect={readOnly ? undefined : onConnect}
          onInit={setReactFlowInstance}
          onDrop={readOnly ? undefined : onDrop}
          onDragOver={readOnly ? undefined : onDragOver}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          defaultEdgeOptions={{
            animated: true,
            markerEnd: { type: MarkerType.ArrowClosed },
            style: { strokeWidth: 2, stroke: "hsl(var(--primary))" },
          }}
          nodesDraggable={!readOnly}
          nodesConnectable={!readOnly}
          elementsSelectable={!readOnly}
          proOptions={{ hideAttribution: true }}
          className="bg-background"
        >
          <Controls showInteractive={false} className="!bg-card !border !shadow-md" />
          <MiniMap
            className="!bg-card !border !shadow-md"
            nodeColor={(node) => {
              switch (node.type) {
                case "trigger": return "#10b981";
                case "condition": return "#f59e0b";
                case "action": return "#3b82f6";
                case "end": return "#6b7280";
                default: return "hsl(var(--primary))";
              }
            }}
            maskColor="rgba(0,0,0,0.1)"
          />
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="hsl(var(--muted-foreground) / 0.15)" />

          {/* Top toolbar */}
          {!readOnly && (
            <Panel position="top-right" className="flex items-center gap-2">
              {isDirty && (
                <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950 dark:text-amber-300">
                  Unsaved changes
                </Badge>
              )}
              <Button size="sm" variant="outline" onClick={handleSave}>
                <Save className="h-3.5 w-3.5 mr-1.5" />
                Save Draft
              </Button>
            </Panel>
          )}
        </ReactFlow>
      </div>
    </div>
  );
}
