'use client';

import { memo, useState, useCallback, useRef, useEffect } from 'react';
import { NodeResizer, type NodeProps } from 'reactflow';
import { createClient } from '@/lib/supabase/client';
import { useCanvasStore } from '@/stores/canvasStore';
import { TEXT_STYLE_DEFAULTS } from '@/lib/canvasDefaults';
import type { TextNodeData } from '@/types';

const FONT_SIZE_OPTIONS = [
  8, 10, 12, 14, 16, 18, 20, 22, 24, 28, 32, 36, 40, 48, 56, 64, 72, 80, 96, 112, 128,
  160, 200, 256, 320, 400, 512, 640, 800, 1000, 1500, 2000, 3000, 4000, 5000,
];
const FONT_FAMILY_OPTIONS = [
  { label: 'Sans', value: 'sans', css: 'ui-sans-serif, system-ui, sans-serif' },
  { label: 'Serif', value: 'serif', css: 'ui-serif, Georgia, serif' },
  { label: 'Mono', value: 'mono', css: 'ui-monospace, SFMono-Regular, Menlo, monospace' },
];

const FONT_FAMILY_MAP = FONT_FAMILY_OPTIONS.reduce<Record<string, string>>(
  (acc, option) => {
    acc[option.value] = option.css;
    return acc;
  },
  {}
);

function TextNode({ id, data, selected }: NodeProps<TextNodeData>) {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(data.content || '');
  const [dimensions, setDimensions] = useState({ width: 300, height: 180 });
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const supabase = createClient();
  const { updateTextContent, updateTextStyle } = useCanvasStore();

  const fontSize = data.fontSize ?? TEXT_STYLE_DEFAULTS.fontSize;
  const fontFamily = data.fontFamily || TEXT_STYLE_DEFAULTS.fontFamily;
  const textColor = data.color || TEXT_STYLE_DEFAULTS.color;
  const isBulleted = data.isBulleted ?? TEXT_STYLE_DEFAULTS.isBulleted;
  const backgroundColor = data.background ?? TEXT_STYLE_DEFAULTS.background;
  const isBackgroundEnabled = backgroundColor !== 'transparent';
  const resolvedFontFamily =
    FONT_FAMILY_MAP[fontFamily] || FONT_FAMILY_MAP[TEXT_STYLE_DEFAULTS.fontFamily];
  const textStyle = {
    fontSize: `${fontSize}px`,
    fontFamily: resolvedFontFamily,
    color: textColor,
  };
  const backgroundStyle = {
    backgroundColor,
  };

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

  const handleStyleUpdate = useCallback(
    async (updates: Partial<TextNodeData>) => {
      updateTextStyle(id, updates);

      const dbUpdates: Record<string, string | number | boolean> = {};
      if (updates.fontSize !== undefined) dbUpdates.text_font_size = updates.fontSize;
      if (updates.fontFamily !== undefined) dbUpdates.text_font_family = updates.fontFamily;
      if (updates.color !== undefined) dbUpdates.text_color = updates.color;
      if (updates.isBulleted !== undefined) dbUpdates.text_is_bulleted = updates.isBulleted;
      if (updates.background !== undefined) dbUpdates.text_background = updates.background;

      if (Object.keys(dbUpdates).length === 0) return;

      await supabase.from('nodes').update(dbUpdates).eq('id', id);
    },
    [id, supabase, updateTextStyle]
  );

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

  const bulletLines = data.content
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const showToolbar = selected || isEditing;
  const minHeight = 60;

  const handleAutoFit = useCallback(() => {
    const toolbarHeight = showToolbar ? toolbarRef.current?.offsetHeight ?? 0 : 0;
    const paddingHeight = 24;
    let contentHeight = 0;

    if (isEditing && textareaRef.current) {
      contentHeight = textareaRef.current.scrollHeight + paddingHeight;
    } else if (contentRef.current) {
      contentHeight = contentRef.current.scrollHeight;
    }

    const nextHeight = Math.max(minHeight, Math.ceil(contentHeight + toolbarHeight));
    setDimensions((prev) => ({ ...prev, height: nextHeight }));
  }, [isEditing, showToolbar]);

  return (
    <>
      <NodeResizer
        minWidth={120}
        minHeight={60}
        isVisible={true}
        lineClassName="!border-amber-200"
        handleClassName="!w-2.5 !h-2.5 !bg-amber-300 !border-white !border-2 !rounded-full"
        onResize={(_, params) => {
          setDimensions({ width: params.width, height: params.height });
        }}
      />
      <div
        ref={containerRef}
        className={`relative bg-transparent rounded-lg shadow-md transition-shadow flex flex-col ${
          selected ? 'shadow-lg' : ''
        }`}
        style={{ width: dimensions.width, height: dimensions.height }}
        onDoubleClick={handleDoubleClick}
      >
        {showToolbar && (
          <div
            ref={toolbarRef}
            className="flex flex-wrap items-center gap-2 px-3 py-2 border-b border-stone-200 bg-white/80 backdrop-blur-sm text-xs nodrag"
          >
            <select
              value={fontSize}
              onChange={(e) => handleStyleUpdate({ fontSize: Number(e.target.value) })}
              className="rounded border border-stone-200 bg-white px-1.5 py-0.5 text-stone-700 focus:border-stone-400 outline-none"
              aria-label="font size"
            >
              {FONT_SIZE_OPTIONS.map((size) => (
                <option key={size} value={size}>
                  {size}px
                </option>
              ))}
            </select>
            <select
              value={fontFamily}
              onChange={(e) => handleStyleUpdate({ fontFamily: e.target.value })}
              className="rounded border border-stone-200 bg-white px-1.5 py-0.5 text-stone-700 focus:border-stone-400 outline-none"
              aria-label="font family"
            >
              {FONT_FAMILY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <label className="flex items-center gap-1 text-stone-500">
              <span>color</span>
              <input
                type="color"
                value={textColor}
                onChange={(e) => handleStyleUpdate({ color: e.target.value })}
                className="h-5 w-6 cursor-pointer rounded border border-stone-200 bg-white p-0"
                aria-label="text color"
              />
            </label>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() =>
                  handleStyleUpdate({
                    background: isBackgroundEnabled ? 'transparent' : '#ffffff',
                  })
                }
                className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 transition-colors ${
                  isBackgroundEnabled
                    ? 'border-stone-700 bg-stone-700 text-white'
                    : 'border-stone-200 bg-white text-stone-500 hover:border-stone-300'
                }`}
                title="toggle background"
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
                  <path d="M19 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2Z" />
                  <path d="M7 9h10" />
                  <path d="M7 13h10" />
                  <path d="M7 17h6" />
                </svg>
                bg
              </button>
              <input
                type="color"
                value={isBackgroundEnabled ? backgroundColor : '#ffffff'}
                onChange={(e) => handleStyleUpdate({ background: e.target.value })}
                disabled={!isBackgroundEnabled}
                className="h-5 w-6 cursor-pointer rounded border border-stone-200 bg-white p-0 disabled:cursor-not-allowed disabled:opacity-60"
                aria-label="background color"
              />
            </div>
            <button
              type="button"
              onClick={handleAutoFit}
              className="inline-flex items-center gap-1 rounded border border-stone-200 bg-white px-2 py-0.5 text-stone-500 hover:border-stone-300 transition-colors"
              title="auto-fit height"
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
                <path d="M3 3h18" />
                <path d="M3 21h18" />
                <path d="M8 7l4-4 4 4" />
                <path d="M16 17l-4 4-4-4" />
              </svg>
              fit
            </button>
            <button
              type="button"
              onClick={() => handleStyleUpdate({ isBulleted: !isBulleted })}
              className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 transition-colors ${
                isBulleted
                  ? 'border-stone-700 bg-stone-700 text-white'
                  : 'border-stone-200 bg-white text-stone-500 hover:border-stone-300'
              }`}
              title="toggle bullet list"
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
                <line x1="9" x2="21" y1="6" y2="6" />
                <line x1="9" x2="21" y1="12" y2="12" />
                <line x1="9" x2="21" y1="18" y2="18" />
                <circle cx="4" cy="6" r="1" />
                <circle cx="4" cy="12" r="1" />
                <circle cx="4" cy="18" r="1" />
              </svg>
              bullets
            </button>
          </div>
        )}
        <div className="flex-1 min-h-0">
          {isEditing ? (
            <div className="w-full h-full p-3 rounded-md" style={backgroundStyle}>
              <textarea
                ref={textareaRef}
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                onBlur={(e) => {
                  if (containerRef.current?.contains(e.relatedTarget as Node)) return;
                  handleSave();
                }}
                onKeyDown={handleKeyDown}
                className="w-full h-full bg-transparent resize-none outline-none nodrag"
                style={textStyle}
                placeholder="type something..."
              />
            </div>
          ) : (
            <div
              ref={contentRef}
              className="w-full h-full p-3 overflow-auto custom-scrollbar rounded-md"
              style={backgroundStyle}
            >
              {data.content ? (
                isBulleted ? (
                  <ul
                    className="list-disc list-inside space-y-1 whitespace-pre-wrap break-words"
                    style={textStyle}
                  >
                    {(bulletLines.length > 0 ? bulletLines : [data.content]).map(
                      (line, index) => (
                        <li key={`${id}-line-${index}`}>{line}</li>
                      )
                    )}
                  </ul>
                ) : (
                  <p className="whitespace-pre-wrap break-words" style={textStyle}>
                    {data.content}
                  </p>
                )
              ) : (
                <p className="text-sm text-stone-400 italic">
                  double-click to edit...
                </p>
              )}
            </div>
          )}
        </div>
        
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
