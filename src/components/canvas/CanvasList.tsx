'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { DbCanvas } from '@/types';

interface CanvasListProps {
  initialCanvases: DbCanvas[];
}

export default function CanvasList({ initialCanvases }: CanvasListProps) {
  const [canvases, setCanvases] = useState<DbCanvas[]>(initialCanvases);
  const [isCreating, setIsCreating] = useState(false);
  const [newCanvasName, setNewCanvasName] = useState('');
  const router = useRouter();
  const supabase = createClient();

  const handleCreateCanvas = async () => {
    if (!newCanvasName.trim()) return;

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    const { data, error } = await supabase
      .from('canvases')
      .insert({
        user_id: user.id,
        name: newCanvasName.trim(),
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating canvas:', error);
      return;
    }

    setCanvases([data, ...canvases]);
    setNewCanvasName('');
    setIsCreating(false);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <div>
      {/* Create new canvas */}
      <div className="mb-8">
        {isCreating ? (
          <div className="flex gap-3">
            <input
              type="text"
              value={newCanvasName}
              onChange={(e) => setNewCanvasName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreateCanvas();
                if (e.key === 'Escape') {
                  setIsCreating(false);
                  setNewCanvasName('');
                }
              }}
              placeholder="canvas name..."
              autoFocus
              className="flex-1 px-4 py-2.5 rounded-lg border border-stone-300 focus:border-stone-500 focus:ring-2 focus:ring-stone-200 outline-none transition-all text-stone-900 placeholder:text-stone-400"
            />
            <button
              onClick={handleCreateCanvas}
              className="px-4 py-2.5 bg-stone-900 hover:bg-stone-800 text-white font-medium rounded-lg transition-colors"
            >
              create
            </button>
            <button
              onClick={() => {
                setIsCreating(false);
                setNewCanvasName('');
              }}
              className="px-4 py-2.5 text-stone-600 hover:text-stone-800 font-medium rounded-lg transition-colors"
            >
              cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setIsCreating(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-stone-900 hover:bg-stone-800 text-white font-medium rounded-lg transition-colors"
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
              <path d="M5 12h14" />
              <path d="M12 5v14" />
            </svg>
            new canvas
          </button>
        )}
      </div>

      {/* Canvas grid */}
      {canvases.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-stone-400 mb-2">no canvases yet</div>
          <p className="text-stone-500 text-sm">
            create your first canvas to get started
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {canvases.map((canvas) => (
            <button
              key={canvas.id}
              onClick={() => router.push(`/canvas/${canvas.id}`)}
              className="text-left p-5 bg-white rounded-xl border border-stone-200 hover:border-stone-300 hover:shadow-sm transition-all group"
            >
              <h3 className="font-medium text-stone-900 group-hover:text-stone-700 mb-1 truncate">
                {canvas.name}
              </h3>
              <p className="text-sm text-stone-400">
                updated {formatDate(canvas.updated_at)}
              </p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

