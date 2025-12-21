import type { Node, Edge } from 'reactflow';

// Database types (matching Supabase schema)
export interface DbCanvas {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface DbNode {
  id: string;
  canvas_id: string;
  parent_node_id: string | null;
  position_x: number;
  position_y: number;
  seed_text: string | null;
  title: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbMessage {
  id: string;
  node_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  created_at: string;
}

export interface DbEdge {
  id: string;
  canvas_id: string;
  source_node_id: string;
  target_node_id: string;
  created_at: string;
}

// React Flow node data
export interface ChatNodeData {
  messages: DbMessage[];
  seedText: string | null;
  parentNodeId: string | null;
  title: string | null;
  isLoading?: boolean;
  isGeneratingTitle?: boolean;
}

// React Flow typed node
export type ChatNode = Node<ChatNodeData>;

// React Flow typed edge
export type BranchEdge = Edge;

// Canvas store state
export interface CanvasState {
  canvasId: string | null;
  nodes: ChatNode[];
  edges: BranchEdge[];
  focusedNodeId: string | null;
  setCanvasId: (id: string) => void;
  setNodes: (nodes: ChatNode[]) => void;
  setEdges: (edges: BranchEdge[]) => void;
  addNode: (node: ChatNode) => void;
  addEdge: (edge: BranchEdge) => void;
  updateNodeMessages: (nodeId: string, messages: DbMessage[]) => void;
  updateNodeLoading: (nodeId: string, isLoading: boolean) => void;
  updateNodeTitle: (nodeId: string, title: string | null) => void;
  updateNodeGeneratingTitle: (nodeId: string, isGenerating: boolean) => void;
  setFocusedNode: (nodeId: string | null) => void;
  onNodesChange: (changes: any) => void;
  onEdgesChange: (changes: any) => void;
}

// Text selection for branching
export interface TextSelection {
  text: string;
  nodeId: string;
  rect: DOMRect | null;
}

