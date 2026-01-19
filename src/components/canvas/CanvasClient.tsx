'use client';

import dynamic from 'next/dynamic';
import type { CanvasNode, BranchEdge } from '@/types';

const Canvas = dynamic(() => import('@/components/canvas/Canvas'), {
  ssr: false,
  loading: () => (
    <div className="h-screen w-screen flex items-center justify-center bg-stone-100">
      <div className="text-stone-400">loading canvas...</div>
    </div>
  ),
});

interface CanvasClientProps {
  canvasId: string;
  canvasName: string;
  initialNodes: CanvasNode[];
  initialEdges: BranchEdge[];
}

export default function CanvasClient(props: CanvasClientProps) {
  return <Canvas {...props} />;
}
