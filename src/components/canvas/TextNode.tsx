'use client';

import { memo, useState, useCallback, useRef, useEffect } from 'react';
import { NodeResizer, type NodeProps } from 'reactflow';
import { createClient } from '@/lib/supabase/client';
import { useCanvasStore } from '@/stores/canvasStore';
import type { TextNodeData } from '@/types';

function TextNode({ id, data, selected }: NodeProps<TextNodeData>) {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(data.content || '');
  const [dimensions, setDimensions] = useState({ width: 200, height: 100 });
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const supabase = createClient();
  const { updateTextContent } = useCanvasStore();

  // Focus textarea when editing starts
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.select();
    }
  }, [isEditing]);

  // Start editing on double click
  const handleDoubleClick = useCallback(() => {
    setEditContent(data.content || '');
    setIsEditing(true);
  }, [data.content]);

  // Save content
  const handleSave = useCallback(async () => {
    const trimmedContent = editContent.trim();
    
    // Update in database
    await supabase
      .from('nodes')
      .update({ text_content: trimmedContent })
      .eq('id', id);
    
    // Update local state
    updateTextContent(id, trimmedContent);
    setIsEditing(false);
  }, [id, editContent, supabase, updateTextContent]);

  // Handle key events
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsEditing(false);
      setEditContent(data.content || '');
    }
    // Ctrl/Cmd + Enter to save
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      handleSave();
    }
  }, [data.content, handleSave]);

  return (
    <>
      <NodeResizer
        minWidth={120}
        minHeight={60}
        maxWidth={600}
        maxHeight={400}
        isVisible={true}
        lineClassName="!border-amber-200"
        handleClassName="!w-2.5 !h-2.5 !bg-amber-300 !border-white !border-2 !rounded-full"
        onResize={(_, params) => {
          setDimensions({ width: params.width, height: params.height });
        }}
      />
      <div
        className={`bg-amber-50 rounded-lg shadow-md border-2 transition-colors ${
          selected ? 'border-amber-400' : 'border-amber-200'
        }`}
        style={{ width: dimensions.width, height: dimensions.height }}
        onDoubleClick={handleDoubleClick}
      >
        {isEditing ? (
          <div className="w-full h-full p-3">
            <textarea
              ref={textareaRef}
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              onBlur={handleSave}
              onKeyDown={handleKeyDown}
              className="w-full h-full bg-transparent text-sm text-stone-700 resize-none outline-none nodrag"
              placeholder="type something..."
            />
          </div>
        ) : (
          <div className="w-full h-full p-3 overflow-auto custom-scrollbar">
            {data.content ? (
              <p className="text-sm text-stone-700 whitespace-pre-wrap break-words">
                {data.content}
              </p>
            ) : (
              <p className="text-sm text-stone-400 italic">
                double-click to edit...
              </p>
            )}
          </div>
        )}
        
        {/* Delete button */}
        <button
          onClick={() => {
            const event = new CustomEvent('deleteNode', { detail: { nodeId: id } });
            window.dispatchEvent(event);
          }}
          className="absolute -top-2 -right-2 p-1 bg-white border border-stone-200 rounded-full shadow-sm opacity-0 hover:opacity-100 focus:opacity-100 transition-opacity text-stone-400 hover:text-red-500 nodrag"
          title="delete text box"
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
    </>
  );
}

export default memo(TextNode);

