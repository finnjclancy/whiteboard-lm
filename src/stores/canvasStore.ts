import { create } from 'zustand';
import {
  applyNodeChanges,
  applyEdgeChanges,
  type NodeChange,
  type EdgeChange,
} from 'reactflow';
import { v4 as uuidv4 } from 'uuid';
import type { ChatNode, BranchEdge, DbMessage, CanvasState, QueueItem } from '@/types';

export const useCanvasStore = create<CanvasState>((set, get) => ({
  canvasId: null,
  nodes: [],
  edges: [],
  focusedNodeId: null,
  queue: [],

  setCanvasId: (id: string) => set({ canvasId: id }),

  setNodes: (nodes: ChatNode[]) => set({ nodes }),

  setEdges: (edges: BranchEdge[]) => set({ edges }),

  addNode: (node: ChatNode) =>
    set((state) => ({ nodes: [...state.nodes, node] })),

  addEdge: (edge: BranchEdge) =>
    set((state) => ({ edges: [...state.edges, edge] })),

  updateNodeMessages: (nodeId: string, messages: DbMessage[]) =>
    set((state) => ({
      nodes: state.nodes.map((node) =>
        node.id === nodeId
          ? { ...node, data: { ...node.data, messages } }
          : node
      ),
    })),

  updateNodeLoading: (nodeId: string, isLoading: boolean) =>
    set((state) => ({
      nodes: state.nodes.map((node) =>
        node.id === nodeId
          ? { ...node, data: { ...node.data, isLoading } }
          : node
      ),
    })),

  updateNodeTitle: (nodeId: string, title: string | null) =>
    set((state) => ({
      nodes: state.nodes.map((node) =>
        node.id === nodeId
          ? { ...node, data: { ...node.data, title } }
          : node
      ),
    })),

  updateNodeGeneratingTitle: (nodeId: string, isGenerating: boolean) =>
    set((state) => ({
      nodes: state.nodes.map((node) =>
        node.id === nodeId
          ? { ...node, data: { ...node.data, isGeneratingTitle: isGenerating } }
          : node
      ),
    })),

  setFocusedNode: (nodeId: string | null) => set({ focusedNodeId: nodeId }),

  addToQueue: (text: string, sourceNodeId: string) =>
    set((state) => ({
      queue: [
        ...state.queue,
        {
          id: uuidv4(),
          text,
          sourceNodeId,
          createdAt: new Date().toISOString(),
        },
      ],
    })),

  removeFromQueue: (id: string) =>
    set((state) => ({
      queue: state.queue.filter((item) => item.id !== id),
    })),

  clearQueue: () => set({ queue: [] }),

  onNodesChange: (changes: NodeChange[]) =>
    set((state) => ({
      nodes: applyNodeChanges(changes, state.nodes) as ChatNode[],
    })),

  onEdgesChange: (changes: EdgeChange[]) =>
    set((state) => ({
      edges: applyEdgeChanges(changes, state.edges),
    })),
}));

