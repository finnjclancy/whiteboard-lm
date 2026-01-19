import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { TEXT_STYLE_DEFAULTS, IMAGE_NODE_DEFAULTS } from '@/lib/canvasDefaults';
import CanvasClient from '@/components/canvas/CanvasClient';
import type { DbNode, DbMessage, DbEdge, CanvasNode, ChatNode, TextNode, ImageNode, BranchEdge } from '@/types';

interface CanvasPageProps {
  params: Promise<{ id: string }>;
}

export default async function CanvasPage({ params }: CanvasPageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login');
  }

  // Fetch canvas to verify ownership
  const { data: canvas, error: canvasError } = await supabase
    .from('canvases')
    .select('*')
    .eq('id', id)
    .single();

  if (canvasError || !canvas) {
    redirect('/canvases');
  }

  // Fetch nodes with their messages
  const { data: dbNodes } = await supabase
    .from('nodes')
    .select('*')
    .eq('canvas_id', id)
    .order('created_at', { ascending: true });

  // Fetch messages for all nodes
  const nodeIds = (dbNodes || []).map((n: DbNode) => n.id);
  const { data: dbMessages } = await supabase
    .from('messages')
    .select('*')
    .in('node_id', nodeIds.length > 0 ? nodeIds : [''])
    .order('created_at', { ascending: true });

  // Fetch edges
  const { data: dbEdges } = await supabase
    .from('edges')
    .select('*')
    .eq('canvas_id', id);

  // Transform to React Flow format - handle both chat and text nodes
  const nodes: CanvasNode[] = (dbNodes || []).map((node: DbNode) => {
    const nodeType = node.node_type || 'chat';
    
    if (nodeType === 'text') {
      return {
        id: node.id,
        type: 'textNode',
        position: { x: node.position_x, y: node.position_y },
        data: {
          content: node.text_content || '',
          fontSize: node.text_font_size ?? TEXT_STYLE_DEFAULTS.fontSize,
          fontFamily: node.text_font_family ?? TEXT_STYLE_DEFAULTS.fontFamily,
          color: node.text_color ?? TEXT_STYLE_DEFAULTS.color,
          isBulleted: node.text_is_bulleted ?? TEXT_STYLE_DEFAULTS.isBulleted,
          background: node.text_background ?? TEXT_STYLE_DEFAULTS.background,
        },
      } as TextNode;
    }

    if (nodeType === 'image') {
      return {
        id: node.id,
        type: 'imageNode',
        position: { x: node.position_x, y: node.position_y },
        data: {
          src: node.image_data || '',
          width: node.image_width ?? IMAGE_NODE_DEFAULTS.width,
          height: node.image_height ?? IMAGE_NODE_DEFAULTS.height,
        },
      } as ImageNode;
    }
    
    // Default to chat node
    return {
      id: node.id,
      type: 'chatNode',
      position: { x: node.position_x, y: node.position_y },
      data: {
        messages: (dbMessages || []).filter(
          (m: DbMessage) => m.node_id === node.id && m.role !== 'system'
        ),
        seedText: node.seed_text,
        parentNodeId: node.parent_node_id,
        title: node.title,
        isLoading: false,
        isGeneratingTitle: false,
      },
    } as ChatNode;
  });

  const edges: BranchEdge[] = (dbEdges || []).map((edge: DbEdge) => ({
    id: edge.id,
    source: edge.source_node_id,
    target: edge.target_node_id,
    type: 'smoothstep',
    animated: false,
    style: { stroke: '#a8a29e', strokeWidth: 2 },
    markerEnd: {
      type: 'arrowclosed' as const,
      color: '#a8a29e',
    },
  }));

  return (
    <CanvasClient
      canvasId={id}
      canvasName={canvas.name}
      initialNodes={nodes}
      initialEdges={edges}
    />
  );
}
