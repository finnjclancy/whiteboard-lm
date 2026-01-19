'use client';

import { memo, useState, useCallback, useRef, useEffect } from 'react';
import { Handle, Position, NodeResizer, type NodeProps } from 'reactflow';
import { v4 as uuidv4 } from 'uuid';
import ReactMarkdown from 'react-markdown';
import { createClient } from '@/lib/supabase/client';
import { useCanvasStore } from '@/stores/canvasStore';
import { useSelection } from './Canvas';
import type { ChatNodeData, DbMessage } from '@/types';

function ChatNode({ id, data }: NodeProps<ChatNodeData>) {
  const [input, setInput] = useState('');
  const [streamingContent, setStreamingContent] = useState('');
  const [dimensions, setDimensions] = useState({ width: 400, height: 450 });
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState('');
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();
  const { nodes, updateNodeMessages, updateNodeLoading, updateNodeTitle, updateNodeGeneratingTitle, setFocusedNode } = useCanvasStore();
  const { onSelectionChange } = useSelection();

  const { messages, seedText, parentNodeId, title, isLoading, isGeneratingTitle } = data;

  // Look up parent node's title
  const parentNode = parentNodeId ? nodes.find((n) => n.id === parentNodeId) : null;
  const parentTitle = parentNode?.data?.title || 'untitled chat';

  // Focus title input when editing starts
  useEffect(() => {
    if (isEditingTitle && titleInputRef.current) {
      titleInputRef.current.focus();
      titleInputRef.current.select();
    }
  }, [isEditingTitle]);

  // Generate title from user's first question (runs in parallel with chat response)
  const generateTitleFromQuestion = useCallback(async (userQuestion: string) => {
    // Only generate if this is the first message and no title exists
    if (title || messages.length > 0) return;

    updateNodeGeneratingTitle(id, true);

    try {
      const response = await fetch('/api/generate-title', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          userQuestion,
          seedText 
        }),
      });

      if (response.ok) {
        const { title: generatedTitle } = await response.json();
        
        // Save to database
        await supabase
          .from('nodes')
          .update({ title: generatedTitle })
          .eq('id', id);

        // Update local state
        updateNodeTitle(id, generatedTitle);
      }
    } catch (error) {
      console.error('Error generating title:', error);
    } finally {
      updateNodeGeneratingTitle(id, false);
    }
  }, [id, title, messages.length, seedText, supabase, updateNodeTitle, updateNodeGeneratingTitle]);

  // Save edited title
  const handleSaveTitle = async () => {
    const trimmedTitle = editedTitle.trim();
    if (trimmedTitle && trimmedTitle !== title) {
      // Save to database
      await supabase
        .from('nodes')
        .update({ title: trimmedTitle })
        .eq('id', id);
      
      // Update local state
      updateNodeTitle(id, trimmedTitle);
    }
    setIsEditingTitle(false);
  };

  // Auto-scroll to bottom when messages change (scroll container directly to avoid canvas scroll)
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }, [messages, streamingContent]);

  // Handle text selection for branching
  const handleMouseUp = useCallback(() => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) return;

    const text = selection.toString().trim();
    if (text.length < 10) return; // Ignore very short selections

    // Check if selection is within assistant message
    const range = selection.getRangeAt(0);
    const container = range.commonAncestorContainer;
    const messageEl = (container as Element).closest?.('.assistant-message') ||
      (container.parentElement as Element)?.closest?.('.assistant-message');

    if (!messageEl) return;

    const rect = range.getBoundingClientRect();
    onSelectionChange({
      text,
      nodeId: id,
      rect,
    });
  }, [id, onSelectionChange]);

  // Send message
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: DbMessage = {
      id: uuidv4(),
      node_id: id,
      role: 'user',
      content: input.trim(),
      created_at: new Date().toISOString(),
    };

    // Save user message to database
    await supabase.from('messages').insert({
      id: userMessage.id,
      node_id: id,
      role: 'user',
      content: userMessage.content,
    });

    // Update local state
    const newMessages = [...messages, userMessage];
    updateNodeMessages(id, newMessages);
    const questionText = input.trim();
    setInput('');
    updateNodeLoading(id, true);
    setStreamingContent('');

    // Generate title in parallel if this is the first message
    if (messages.length === 0 && !title) {
      generateTitleFromQuestion(questionText);
    }

    try {
      // Build messages for API (include seed text as context if present)
      const apiMessages = [];

      if (seedText) {
        apiMessages.push({
          role: 'system' as const,
          content: `The user is continuing a conversation from this context: "${seedText}"`,
        });
      }

      // Add all previous messages
      for (const msg of newMessages) {
        apiMessages.push({
          role: msg.role as 'user' | 'assistant',
          content: msg.content,
        });
      }

      // Stream response
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: apiMessages }),
      });

      if (!response.ok) {
        throw new Error('Failed to get response');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullContent = '';

      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;

            try {
              const parsed = JSON.parse(data);
              if (parsed.content) {
                fullContent += parsed.content;
                setStreamingContent(fullContent);
              }
            } catch {
              // Ignore parse errors
            }
          }
        }
      }

      // Save assistant message to database
      const assistantMessage: DbMessage = {
        id: uuidv4(),
        node_id: id,
        role: 'assistant',
        content: fullContent,
        created_at: new Date().toISOString(),
      };

      await supabase.from('messages').insert({
        id: assistantMessage.id,
        node_id: id,
        role: 'assistant',
        content: assistantMessage.content,
      });

      // Update local state with final message
      const finalMessages = [...newMessages, assistantMessage];
      updateNodeMessages(id, finalMessages);
      setStreamingContent('');
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      updateNodeLoading(id, false);
    }
  };

  return (
    <>
      <NodeResizer
        minWidth={300}
        minHeight={250}
        maxWidth={800}
        maxHeight={800}
        isVisible={true}
        lineClassName="!border-stone-200"
        handleClassName="!w-3 !h-3 !bg-stone-300 !border-white !border-2 !rounded-full"
        onResize={(_, params) => {
          setDimensions({ width: params.width, height: params.height });
        }}
      />
      <div
        className="bg-white rounded-xl shadow-lg border border-stone-200 flex flex-col overflow-hidden"
        style={{ width: dimensions.width, height: dimensions.height }}
      >
        {/* Connection handles */}
        <Handle
          type="target"
          position={Position.Left}
          className="!w-3 !h-3 !bg-stone-400 !border-2 !border-white"
        />
        <Handle
          type="source"
          position={Position.Right}
          className="!w-3 !h-3 !bg-stone-400 !border-2 !border-white"
        />

        {/* Header */}
        <div className="px-4 py-3 border-b border-stone-100 flex items-center justify-between shrink-0 gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div className={`w-2 h-2 rounded-full shrink-0 ${seedText ? 'bg-amber-400' : 'bg-emerald-400'}`} />
            {isEditingTitle ? (
              <input
                ref={titleInputRef}
                type="text"
                value={editedTitle}
                onChange={(e) => setEditedTitle(e.target.value)}
                onBlur={handleSaveTitle}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveTitle();
                  if (e.key === 'Escape') setIsEditingTitle(false);
                }}
                className="text-sm font-medium text-stone-600 bg-stone-100 px-2 py-0.5 rounded border border-stone-300 outline-none focus:border-stone-400 min-w-0 flex-1 nodrag"
                placeholder="enter title..."
              />
            ) : isGeneratingTitle ? (
              <span className="text-sm font-medium text-stone-400 italic">generating title...</span>
            ) : title ? (
              <span
                className="text-sm font-medium text-stone-600 truncate cursor-pointer hover:text-stone-800 nodrag"
                title={`${title} (click to edit)`}
                onClick={() => {
                  setEditedTitle(title);
                  setIsEditingTitle(true);
                }}
              >
                {title}
              </span>
            ) : seedText ? (
              <span
                className="text-sm font-medium text-stone-600 truncate cursor-pointer hover:text-stone-800 nodrag"
                title={`branched from: "${seedText}" (click to edit)`}
                onClick={() => {
                  setEditedTitle('');
                  setIsEditingTitle(true);
                }}
              >
                branched: &ldquo;{seedText.length > 20 ? seedText.slice(0, 20) + '...' : seedText}&rdquo;
              </span>
            ) : (
              <span
                className="text-sm font-medium text-stone-600 cursor-pointer hover:text-stone-800 nodrag"
                onClick={() => {
                  setEditedTitle('');
                  setIsEditingTitle(true);
                }}
              >
                new chat
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setFocusedNode(id)}
              className="p-1.5 text-stone-400 hover:text-stone-600 hover:bg-stone-100 rounded-md transition-colors nodrag"
              title="expand to fullscreen"
            >
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
              >
                <path d="M8 3H5a2 2 0 0 0-2 2v3" />
                <path d="M21 8V5a2 2 0 0 0-2-2h-3" />
                <path d="M3 16v3a2 2 0 0 0 2 2h3" />
                <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
              </svg>
            </button>
            <button
              onClick={() => {
                // Trigger React Flow's delete by dispatching a remove change
                const event = new CustomEvent('deleteNode', { detail: { nodeId: id } });
                window.dispatchEvent(event);
              }}
              className="p-1.5 text-stone-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors nodrag"
              title="delete chat"
            >
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
              >
                <path d="M3 6h18" />
                <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                <line x1="10" x2="10" y1="11" y2="17" />
                <line x1="14" x2="14" y1="11" y2="17" />
              </svg>
            </button>
          </div>
        </div>

        {/* Seed text chip - shows parent info for branched nodes */}
        {seedText && parentNodeId && (
          <div className="px-4 py-2 bg-amber-50 border-b border-amber-100 shrink-0">
            <div className="flex items-center gap-1 text-xs text-amber-600 font-medium mb-1">
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
                <path d="M6 3v12" />
                <circle cx="18" cy="6" r="3" />
                <circle cx="6" cy="18" r="3" />
                <path d="M18 9a9 9 0 0 1-9 9" />
              </svg>
              from: {parentTitle}
            </div>
            <div className="text-sm text-amber-800 line-clamp-2">&ldquo;{seedText}&rdquo;</div>
          </div>
        )}

        {/* Messages */}
        <div
          ref={messagesContainerRef}
          className="flex-1 overflow-y-auto p-4 space-y-3 nodrag nopan nowheel cursor-text select-text custom-scrollbar"
          onMouseUp={handleMouseUp}
        >
          {messages.length === 0 && !streamingContent && (
            <div className="text-center text-stone-400 text-sm py-8">
              start a conversation...
            </div>
          )}

          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${
                message.role === 'user'
                  ? 'justify-end'
                  : 'justify-start assistant-message'
              }`}
            >
              <div
                className={`rounded-lg px-3 py-2 text-sm max-w-[85%] ${
                  message.role === 'user'
                    ? 'bg-stone-900 text-white'
                    : 'bg-stone-100 text-stone-800'
                }`}
              >
                {message.role === 'user' ? (
                  <div className="whitespace-pre-wrap break-words">{message.content}</div>
                ) : (
                  <div className="prose prose-sm prose-stone max-w-none break-words">
                    <ReactMarkdown>{message.content}</ReactMarkdown>
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Streaming content */}
          {streamingContent && (
            <div className="flex justify-start assistant-message">
              <div className="rounded-lg px-3 py-2 text-sm bg-stone-100 text-stone-800 max-w-[85%]">
                <div className="prose prose-sm prose-stone max-w-none break-words">
                  <ReactMarkdown>{streamingContent}</ReactMarkdown>
                </div>
              </div>
            </div>
          )}

          {/* Loading indicator */}
          {isLoading && !streamingContent && (
            <div className="flex justify-start">
              <div className="rounded-lg px-3 py-2 text-sm bg-stone-100 text-stone-400">
                <div className="flex items-center gap-1">
                  <span className="animate-bounce">·</span>
                  <span className="animate-bounce" style={{ animationDelay: '0.1s' }}>·</span>
                  <span className="animate-bounce" style={{ animationDelay: '0.2s' }}>·</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Input */}
        <form onSubmit={handleSubmit} className="p-3 border-t border-stone-100 shrink-0">
          <div className="flex gap-2 items-end">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  if (input.trim() && !isLoading) {
                    handleSubmit(e);
                  }
                }
              }}
              placeholder="type a message..."
              disabled={isLoading}
              rows={1}
              className="flex-1 px-3 py-2 text-sm rounded-lg border border-stone-200 focus:border-stone-400 focus:ring-1 focus:ring-stone-200 outline-none transition-all text-stone-900 placeholder:text-stone-400 disabled:bg-stone-50 nodrag resize-none min-h-[38px] max-h-[120px]"
              style={{ height: 'auto', overflow: 'hidden' }}
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement;
                target.style.height = 'auto';
                target.style.height = Math.min(target.scrollHeight, 120) + 'px';
              }}
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="px-3 py-2 bg-stone-900 hover:bg-stone-800 disabled:bg-stone-300 text-white rounded-lg transition-colors"
            >
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
              >
                <path d="m22 2-7 20-4-9-9-4Z" />
                <path d="M22 2 11 13" />
              </svg>
            </button>
          </div>
        </form>
      </div>
    </>
  );
}

export default memo(ChatNode);
