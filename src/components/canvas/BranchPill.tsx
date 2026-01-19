'use client';

import { useEffect } from 'react';
import { useCanvasStore } from '@/stores/canvasStore';
import type { TextSelection } from '@/types';

interface BranchPillProps {
  selection: TextSelection;
  onBranch: (seedText: string, parentNodeId: string) => void;
  onClose: () => void;
}

export default function BranchPill({ selection, onBranch, onClose }: BranchPillProps) {
  const { addToQueue } = useCanvasStore();
  const position = selection.rect
    ? {
        x: selection.rect.left + selection.rect.width / 2,
        y: selection.rect.top - 10,
      }
    : { x: 0, y: 0 };

  const handleBranch = () => {
    onBranch(selection.text, selection.nodeId);
  };

  const handleAddToQueue = () => {
    addToQueue(selection.text, selection.nodeId);
    onClose();
  };

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="branch-pill fixed z-50 transform -translate-x-1/2 -translate-y-full animate-in fade-in slide-in-from-bottom-2 duration-150"
      style={{
        left: position.x,
        top: position.y,
      }}
    >
      <div className="flex items-center gap-1 bg-stone-900 rounded-full shadow-lg p-1">
        <button
          onClick={handleBranch}
          className="flex items-center gap-1.5 px-3 py-1.5 hover:bg-stone-700 text-white text-sm font-medium rounded-full transition-colors"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M6 3v12" />
            <circle cx="18" cy="6" r="3" />
            <circle cx="6" cy="18" r="3" />
            <path d="M18 9a9 9 0 0 1-9 9" />
          </svg>
          branch
        </button>
        <div className="w-px h-5 bg-stone-700" />
        <button
          onClick={handleAddToQueue}
          className="flex items-center gap-1.5 px-3 py-1.5 hover:bg-stone-700 text-white text-sm font-medium rounded-full transition-colors"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
            <rect width="8" height="4" x="8" y="2" rx="1" ry="1" />
            <path d="M12 11v6" />
            <path d="M9 14h6" />
          </svg>
          queue
        </button>
      </div>
    </div>
  );
}
