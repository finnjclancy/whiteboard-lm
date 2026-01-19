import type { Node, Edge, NodeChange, EdgeChange } from 'reactflow';

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
  node_type: 'chat' | 'text' | 'image';
  text_content: string | null;
  text_font_family: string | null;
  text_font_size: number | null;
  text_color: string | null;
  text_is_bulleted: boolean | null;
  text_background: string | null;
  image_data: string | null;
  image_width: number | null;
  image_height: number | null;
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

// React Flow node data for chat nodes
export interface ChatNodeData {
  messages: DbMessage[];
  seedText: string | null;
  parentNodeId: string | null;
  title: string | null;
  isLoading?: boolean;
  isGeneratingTitle?: boolean;
}

// React Flow node data for text nodes
export interface TextNodeData {
  content: string;
  fontSize: number;
  fontFamily: string;
  color: string;
  isBulleted: boolean;
  background: string;
}

// React Flow node data for image nodes
export interface ImageNodeData {
  src: string;
  width: number;
  height: number;
}

// React Flow typed nodes
export type ChatNode = Node<ChatNodeData>;
export type TextNode = Node<TextNodeData>;
export type ImageNode = Node<ImageNodeData>;
export type CanvasNode = ChatNode | TextNode | ImageNode;

// React Flow typed edge
export type BranchEdge = Edge;

// Canvas store state
export interface CanvasState {
  canvasId: string | null;
  nodes: CanvasNode[];
  edges: BranchEdge[];
  focusedNodeId: string | null;
  queue: QueueItem[];
  setCanvasId: (id: string) => void;
  setNodes: (nodes: CanvasNode[]) => void;
  setEdges: (edges: BranchEdge[]) => void;
  addNode: (node: CanvasNode) => void;
  addEdge: (edge: BranchEdge) => void;
  updateNodeMessages: (nodeId: string, messages: DbMessage[]) => void;
  updateNodeLoading: (nodeId: string, isLoading: boolean) => void;
  updateNodeTitle: (nodeId: string, title: string | null) => void;
  updateNodeGeneratingTitle: (nodeId: string, isGenerating: boolean) => void;
  updateTextContent: (nodeId: string, content: string) => void;
  updateTextStyle: (nodeId: string, updates: Partial<TextNodeData>) => void;
  setFocusedNode: (nodeId: string | null) => void;
  addToQueue: (text: string, sourceNodeId: string) => void;
  removeFromQueue: (id: string) => void;
  clearQueue: () => void;
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
}

// Text selection for branching
export interface TextSelection {
  text: string;
  nodeId: string;
  rect: DOMRect | null;
}

// Queue item for saved snippets
export interface QueueItem {
  id: string;
  text: string;
  sourceNodeId: string;
  createdAt: string;
}
