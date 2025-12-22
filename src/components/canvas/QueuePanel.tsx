'use client';

import { useState } from 'react';
import { useCanvasStore } from '@/stores/canvasStore';

interface QueuePanelProps {
  onInsert?: (text: string) => void;
}

export default function QueuePanel({ onInsert }: QueuePanelProps) {
  const { queue, removeFromQueue, clearQueue } = useCanvasStore();
  const [isExpanded, setIsExpanded] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  if (queue.length === 0) return null;

  const handleCopy = async (id: string, text: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const handleInsert = (id: string, text: string) => {
    if (onInsert) {
      onInsert(text);
      removeFromQueue(id);
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-40 w-80 bg-white rounded-xl shadow-xl border border-stone-200 overflow-hidden animate-in slide-in-from-bottom-4 duration-200">
      {/* Header */}
      <div
        className="px-4 py-3 bg-stone-50 border-b border-stone-200 flex items-center justify-between cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-stone-500"
          >
            <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
            <rect width="8" height="4" x="8" y="2" rx="1" ry="1" />
          </svg>
          <span className="text-sm font-medium text-stone-700">
            queue ({queue.length})
          </span>
        </div>
        <div className="flex items-center gap-2">
          {queue.length > 0 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                clearQueue();
              }}
              className="text-xs text-stone-400 hover:text-red-500 transition-colors"
            >
              clear all
            </button>
          )}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`text-stone-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          >
            <path d="m18 15-6-6-6 6" />
          </svg>
        </div>
      </div>

      {/* Queue items */}
      {isExpanded && (
        <div className="max-h-64 overflow-y-auto">
          {queue.map((item) => (
            <div
              key={item.id}
              className="px-4 py-3 border-b border-stone-100 last:border-b-0 hover:bg-stone-50 group"
            >
              <div className="text-sm text-stone-600 line-clamp-2 mb-2">
                &ldquo;{item.text}&rdquo;
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleCopy(item.id, item.text)}
                  className="flex items-center gap-1 px-2 py-1 text-xs text-stone-500 hover:text-stone-700 hover:bg-stone-100 rounded transition-colors"
                >
                  {copiedId === item.id ? (
                    <>
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="text-green-500"
                      >
                        <path d="M20 6 9 17l-5-5" />
                      </svg>
                      copied!
                    </>
                  ) : (
                    <>
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
                        <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
                      </svg>
                      copy
                    </>
                  )}
                </button>
                {onInsert && (
                  <button
                    onClick={() => handleInsert(item.id, item.text)}
                    className="flex items-center gap-1 px-2 py-1 text-xs text-stone-500 hover:text-stone-700 hover:bg-stone-100 rounded transition-colors"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M5 12h14" />
                      <path d="m12 5 7 7-7 7" />
                    </svg>
                    insert
                  </button>
                )}
                <button
                  onClick={() => removeFromQueue(item.id)}
                  className="flex items-center gap-1 px-2 py-1 text-xs text-stone-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors ml-auto"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M18 6 6 18" />
                    <path d="m6 6 12 12" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

