'use client';

import { useEffect, useState } from 'react';
import type { TextSelection } from '@/types';

interface BranchPillProps {
  selection: TextSelection;
  onBranch: (seedText: string, parentNodeId: string) => void;
  onClose: () => void;
}

export default function BranchPill({ selection, onBranch, onClose }: BranchPillProps) {
  const [position, setPosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (!selection.rect) return;

    // Position the pill above the selection
    setPosition({
      x: selection.rect.left + selection.rect.width / 2,
      y: selection.rect.top - 10,
    });
  }, [selection.rect]);

  const handleBranch = () => {
    onBranch(selection.text, selection.nodeId);
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
      <button
        onClick={handleBranch}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-stone-900 hover:bg-stone-800 text-white text-sm font-medium rounded-full shadow-lg transition-colors"
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
    </div>
  );
}

