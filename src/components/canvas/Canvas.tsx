'use client';

import { useCallback, useEffect, useState, useRef, createContext, useContext } from 'react';
import ReactFlow, {
  Background,
  Controls,
  useReactFlow,
  ReactFlowProvider,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { useRouter } from 'next/navigation';
import { v4 as uuidv4 } from 'uuid';
import { createClient } from '@/lib/supabase/client';
import { useCanvasStore } from '@/stores/canvasStore';
import ChatNode from './ChatNode';
import BranchPill from './BranchPill';
import ContextMenu from './ContextMenu';
import FocusedChat from '@/components/chat/FocusedChat';
import type { ChatNode as ChatNodeType, BranchEdge, TextSelection } from '@/types';

const nodeTypes = {
  chatNode: ChatNode,
};

// Context for passing selection handler to ChatNode
export const SelectionContext = createContext<{
  onSelectionChange: (selection: TextSelection | null) => void;
}>({
  onSelectionChange: () => {},
});

export const useSelection = () => useContext(SelectionContext);

interface CanvasProps {
  canvasId: string;
  canvasName: string;
  initialNodes: ChatNodeType[];
  initialEdges: BranchEdge[];
}

export default function Canvas(props: CanvasProps) {
  const [mounted, setMounted] = useState(false);
  const selectionRef = useRef<{
    onSelectionChange: (selection: TextSelection | null) => void;
  }>({ onSelectionChange: () => {} });

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-stone-100">
        <div className="text-stone-400">loading canvas...</div>
      </div>
    );
  }

  return (
    <ReactFlowProvider>
      <CanvasInner {...props} selectionRef={selectionRef} />
    </ReactFlowProvider>
  );
}

interface ContextMenuState {
  show: boolean;
  x: number;
  y: number;
  flowX: number;
  flowY: number;
}

function CanvasInner({
  canvasId,
  canvasName,
  initialNodes,
  initialEdges,
  selectionRef,
}: CanvasProps & {
  selectionRef: React.MutableRefObject<{
    onSelectionChange: (selection: TextSelection | null) => void;
  }>;
}) {
  const router = useRouter();
  const supabase = createClient();
  const { screenToFlowPosition } = useReactFlow();

  const {
    nodes,
    edges,
    focusedNodeId,
    setCanvasId,
    setNodes,
    setEdges,
    addNode,
    addEdge,
    setFocusedNode,
    onNodesChange,
    onEdgesChange,
  } = useCanvasStore();

  const [selection, setSelection] = useState<TextSelection | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    show: false,
    x: 0,
    y: 0,
    flowX: 0,
    flowY: 0,
  });

  // Set up selection handler for context
  useEffect(() => {
    selectionRef.current.onSelectionChange = setSelection;
  }, [selectionRef]);

  // Initialize store with server data - only on mount or canvas change
  const initializedRef = useRef(false);
  useEffect(() => {
    if (!initializedRef.current || canvasId !== useCanvasStore.getState().canvasId) {
      setCanvasId(canvasId);
      setNodes(initialNodes);
      setEdges(initialEdges);
      initializedRef.current = true;
    }
  }, [canvasId, initialNodes, initialEdges, setCanvasId, setNodes, setEdges]);

  // Handle node changes (position and deletion) - persist to DB
  const handleNodesChange = useCallback(
    async (changes: any) => {
      onNodesChange(changes);

      // Persist position changes
      const positionChanges = changes.filter(
        (change: any) => change.type === 'position' && change.dragging === false
      );

      for (const change of positionChanges) {
        const node = nodes.find((n) => n.id === change.id);
        if (node) {
          await supabase
            .from('nodes')
            .update({
              position_x: node.position.x,
              position_y: node.position.y,
            })
            .eq('id', node.id);
        }
      }

      // Persist deletions
      const removeChanges = changes.filter(
        (change: any) => change.type === 'remove'
      );

      for (const change of removeChanges) {
        // Delete the node (cascade will delete messages and edges)
        await supabase.from('nodes').delete().eq('id', change.id);
        
        // Also remove any edges connected to this node from local state
        const edgesToRemove = edges.filter(
          (e) => e.source === change.id || e.target === change.id
        );
        for (const edge of edgesToRemove) {
          await supabase.from('edges').delete().eq('id', edge.id);
        }
      }
    },
    [onNodesChange, nodes, edges, supabase]
  );

  // Handle right-click context menu
  const handleContextMenu = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault();

      const target = event.target as HTMLElement;
      // Don't show context menu if clicking on a node
      if (target.closest('.react-flow__node')) return;

      const flowPosition = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      setContextMenu({
        show: true,
        x: event.clientX,
        y: event.clientY,
        flowX: flowPosition.x,
        flowY: flowPosition.y,
      });
    },
    [screenToFlowPosition]
  );

  // Create a new chat node
  const handleCreateNode = useCallback(
    async (x: number, y: number) => {
      const nodeId = uuidv4();

      // Create in database
      const { error } = await supabase.from('nodes').insert({
        id: nodeId,
        canvas_id: canvasId,
        position_x: x,
        position_y: y,
      });

      if (error) {
        console.error('Error creating node:', error);
        return;
      }

      // Add to store
      const newNode: ChatNodeType = {
        id: nodeId,
        type: 'chatNode',
        position: { x, y },
        data: {
          messages: [],
          seedText: null,
          parentNodeId: null,
          title: null,
          isLoading: false,
          isGeneratingTitle: false,
        },
      };

      addNode(newNode);
      setContextMenu({ show: false, x: 0, y: 0, flowX: 0, flowY: 0 });
    },
    [canvasId, supabase, addNode]
  );

  // Create branch from selection
  const handleBranch = useCallback(
    async (seedText: string, parentNodeId: string) => {
      const parentNode = nodes.find((n) => n.id === parentNodeId);
      if (!parentNode) return;

      const nodeId = uuidv4();
      const edgeId = uuidv4();

      // Position new node to the right and slightly down from parent
      const position = {
        x: parentNode.position.x + 450,
        y: parentNode.position.y + 100,
      };

      // Create node in database
      const { error: nodeError } = await supabase.from('nodes').insert({
        id: nodeId,
        canvas_id: canvasId,
        parent_node_id: parentNodeId,
        position_x: position.x,
        position_y: position.y,
        seed_text: seedText,
      });

      if (nodeError) {
        console.error('Error creating branch node:', nodeError);
        return;
      }

      // Create edge in database
      const { error: edgeError } = await supabase.from('edges').insert({
        id: edgeId,
        canvas_id: canvasId,
        source_node_id: parentNodeId,
        target_node_id: nodeId,
      });

      if (edgeError) {
        console.error('Error creating edge:', edgeError);
        return;
      }

      // Add to store
      const newNode: ChatNodeType = {
        id: nodeId,
        type: 'chatNode',
        position,
        data: {
          messages: [],
          seedText,
          parentNodeId,
          title: null,
          isLoading: false,
          isGeneratingTitle: false,
        },
      };

      const newEdge: BranchEdge = {
        id: edgeId,
        source: parentNodeId,
        target: nodeId,
        type: 'smoothstep',
        animated: false,
        style: { stroke: '#a8a29e', strokeWidth: 2 },
        markerEnd: {
          type: 'arrowclosed' as const,
          color: '#a8a29e',
        },
      };

      addNode(newNode);
      addEdge(newEdge);
      setSelection(null);
    },
    [canvasId, nodes, supabase, addNode, addEdge]
  );

  // Close context menu on click outside
  const handlePaneClick = useCallback(() => {
    setContextMenu({ show: false, x: 0, y: 0, flowX: 0, flowY: 0 });
  }, []);

  // Clear selection when clicking outside
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.branch-pill') && !window.getSelection()?.toString()) {
        setSelection(null);
      }
    };

    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  // Handle node deletion from custom event
  useEffect(() => {
    const handleDeleteNode = async (e: CustomEvent<{ nodeId: string }>) => {
      const { nodeId } = e.detail;
      
      // Delete from database first
      await supabase.from('nodes').delete().eq('id', nodeId);
      
      // Remove connected edges from database
      const connectedEdges = edges.filter(
        (edge) => edge.source === nodeId || edge.target === nodeId
      );
      for (const edge of connectedEdges) {
        await supabase.from('edges').delete().eq('id', edge.id);
      }
      
      // Update local state
      onNodesChange([{ type: 'remove', id: nodeId }]);
      
      // Remove connected edges from local state
      const edgeChanges = connectedEdges.map((edge) => ({
        type: 'remove' as const,
        id: edge.id,
      }));
      if (edgeChanges.length > 0) {
        onEdgesChange(edgeChanges);
      }
    };

    window.addEventListener('deleteNode', handleDeleteNode as EventListener);
    return () => window.removeEventListener('deleteNode', handleDeleteNode as EventListener);
  }, [edges, supabase, onNodesChange, onEdgesChange]);

  return (
    <SelectionContext.Provider value={selectionRef.current}>
      <div className="h-screen w-screen flex flex-col bg-stone-100">
        {/* Header */}
        <header className="bg-white border-b border-stone-200 px-4 py-3 flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/canvases')}
              className="text-stone-500 hover:text-stone-700 transition-colors"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="m15 18-6-6 6-6" />
              </svg>
            </button>
            <h1 className="font-medium text-stone-900">{canvasName}</h1>
          </div>
          <div className="text-sm text-stone-400">
            right-click to create a chat
          </div>
        </header>

        {/* Canvas */}
        <div className="flex-1 relative">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={handleNodesChange}
            onEdgesChange={onEdgesChange}
            nodeTypes={nodeTypes}
            onPaneClick={handlePaneClick}
            onPaneContextMenu={handleContextMenu}
            fitView
            fitViewOptions={{ padding: 0.5 }}
            minZoom={0.1}
            maxZoom={2}
            nodesDraggable
            nodesConnectable={false}
            elementsSelectable
            selectNodesOnDrag={false}
            defaultEdgeOptions={{
              type: 'smoothstep',
              style: { stroke: '#a8a29e', strokeWidth: 2 },
            }}
            proOptions={{ hideAttribution: true }}
          >
            <Background color="#d6d3d1" gap={20} size={1} />
            <Controls className="bg-white border border-stone-200 rounded-lg shadow-sm" />
          </ReactFlow>

          {/* Context menu */}
          {contextMenu.show && (
            <ContextMenu
              x={contextMenu.x}
              y={contextMenu.y}
              onCreateChat={() => handleCreateNode(contextMenu.flowX, contextMenu.flowY)}
              onClose={() => setContextMenu({ show: false, x: 0, y: 0, flowX: 0, flowY: 0 })}
            />
          )}

          {/* Branch pill */}
          {selection && selection.rect && (
            <BranchPill
              selection={selection}
              onBranch={handleBranch}
              onClose={() => setSelection(null)}
            />
          )}
        </div>
      </div>

      {/* Focused chat fullscreen overlay */}
      {focusedNodeId && (() => {
        const focusedNode = nodes.find((n) => n.id === focusedNodeId);
        if (!focusedNode) return null;
        return (
          <FocusedChat
            nodeId={focusedNodeId}
            data={focusedNode.data}
            onClose={() => setFocusedNode(null)}
          />
        );
      })()}
    </SelectionContext.Provider>
  );
}
