'use client';

import { memo, useState, useCallback, useRef, useEffect } from 'react';
import { Handle, Position, NodeResizer, type NodeProps } from 'reactflow';
import { v4 as uuidv4 } from 'uuid';
import ReactMarkdown from 'react-markdown';
import { createClient } from '@/lib/supabase/client';
import { useCanvasStore } from '@/stores/canvasStore';
import { useSelection } from './Canvas';
import type { ChatNodeData, DbMessage } from '@/types';

function ChatNode({ id, data, selected }: NodeProps<ChatNodeData>) {
  const [input, setInput] = useState('');
  const [streamingContent, setStreamingContent] = useState('');
  const [dimensions, setDimensions] = useState({ width: 400, height: 450 });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();
  const { updateNodeMessages, updateNodeLoading } = useCanvasStore();
  const { onSelectionChange } = useSelection();

  const { messages, seedText, isLoading } = data;

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
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
    setInput('');
    updateNodeLoading(id, true);
    setStreamingContent('');

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
      updateNodeMessages(id, [...newMessages, assistantMessage]);
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
        <div className="px-4 py-3 border-b border-stone-100 flex items-center gap-2 shrink-0">
          <div className="w-2 h-2 rounded-full bg-emerald-400" />
          <span className="text-sm font-medium text-stone-600">chat</span>
        </div>

        {/* Seed text chip */}
        {seedText && (
          <div className="px-4 py-2 bg-amber-50 border-b border-amber-100 shrink-0">
            <div className="text-xs text-amber-600 font-medium mb-1">branched from:</div>
            <div className="text-sm text-amber-800 line-clamp-2">&ldquo;{seedText}&rdquo;</div>
          </div>
        )}

        {/* Messages */}
        <div
          className="flex-1 overflow-y-auto p-4 space-y-3 nodrag nopan nowheel cursor-text select-text"
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
              className={`${
                message.role === 'user'
                  ? 'ml-8'
                  : 'mr-8 assistant-message'
              }`}
            >
              <div
                className={`rounded-lg px-3 py-2 text-sm ${
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
            <div className="mr-8 assistant-message">
              <div className="rounded-lg px-3 py-2 text-sm bg-stone-100 text-stone-800">
                <div className="prose prose-sm prose-stone max-w-none break-words">
                  <ReactMarkdown>{streamingContent}</ReactMarkdown>
                </div>
              </div>
            </div>
          )}

          {/* Loading indicator */}
          {isLoading && !streamingContent && (
            <div className="mr-8">
              <div className="rounded-lg px-3 py-2 text-sm bg-stone-100 text-stone-400">
                <div className="flex items-center gap-1">
                  <span className="animate-bounce">·</span>
                  <span className="animate-bounce" style={{ animationDelay: '0.1s' }}>·</span>
                  <span className="animate-bounce" style={{ animationDelay: '0.2s' }}>·</span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <form onSubmit={handleSubmit} className="p-3 border-t border-stone-100 shrink-0">
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="type a message..."
              disabled={isLoading}
              className="flex-1 px-3 py-2 text-sm rounded-lg border border-stone-200 focus:border-stone-400 focus:ring-1 focus:ring-stone-200 outline-none transition-all text-stone-900 placeholder:text-stone-400 disabled:bg-stone-50 nodrag"
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
