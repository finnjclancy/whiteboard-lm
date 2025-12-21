import { create } from 'zustand';
import {
  applyNodeChanges,
  applyEdgeChanges,
  type NodeChange,
  type EdgeChange,
} from 'reactflow';
import type { ChatNode, BranchEdge, DbMessage, CanvasState } from '@/types';

export const useCanvasStore = create<CanvasState>((set, get) => ({
  canvasId: null,
  nodes: [],
  edges: [],

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

  onNodesChange: (changes: NodeChange[]) =>
    set((state) => ({
      nodes: applyNodeChanges(changes, state.nodes) as ChatNode[],
    })),

  onEdgesChange: (changes: EdgeChange[]) =>
    set((state) => ({
      edges: applyEdgeChanges(changes, state.edges),
    })),
}));

