'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import ReactMarkdown from 'react-markdown';
import { createClient } from '@/lib/supabase/client';
import { useCanvasStore } from '@/stores/canvasStore';
import type { ChatNodeData, DbMessage } from '@/types';

interface FocusedChatProps {
  nodeId: string;
  data: ChatNodeData;
  onClose: () => void;
}

export default function FocusedChat({ nodeId, data, onClose }: FocusedChatProps) {
  const [input, setInput] = useState('');
  const [streamingContent, setStreamingContent] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();
  const { updateNodeMessages, updateNodeLoading, updateNodeTitle, updateNodeGeneratingTitle } = useCanvasStore();

  const { messages, seedText, title, isLoading, isGeneratingTitle } = data;

  // Generate title after first assistant response
  const generateTitle = useCallback(async (currentMessages: DbMessage[]) => {
    const hasAssistantMessage = currentMessages.some(m => m.role === 'assistant');
    if (title || !hasAssistantMessage) return;

    updateNodeGeneratingTitle(nodeId, true);

    try {
      const response = await fetch('/api/generate-title', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          messages: currentMessages,
          seedText 
        }),
      });

      if (response.ok) {
        const { title: generatedTitle } = await response.json();
        
        await supabase
          .from('nodes')
          .update({ title: generatedTitle })
          .eq('id', nodeId);

        updateNodeTitle(nodeId, generatedTitle);
      }
    } catch (error) {
      console.error('Error generating title:', error);
    } finally {
      updateNodeGeneratingTitle(nodeId, false);
    }
  }, [nodeId, title, seedText, supabase, updateNodeTitle, updateNodeGeneratingTitle]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Handle escape key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Send message
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: DbMessage = {
      id: uuidv4(),
      node_id: nodeId,
      role: 'user',
      content: input.trim(),
      created_at: new Date().toISOString(),
    };

    // Save user message to database
    await supabase.from('messages').insert({
      id: userMessage.id,
      node_id: nodeId,
      role: 'user',
      content: userMessage.content,
    });

    // Update local state
    const newMessages = [...messages, userMessage];
    updateNodeMessages(nodeId, newMessages);
    setInput('');
    updateNodeLoading(nodeId, true);
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
        node_id: nodeId,
        role: 'assistant',
        content: fullContent,
        created_at: new Date().toISOString(),
      };

      await supabase.from('messages').insert({
        id: assistantMessage.id,
        node_id: nodeId,
        role: 'assistant',
        content: assistantMessage.content,
      });

      // Update local state with final message
      const finalMessages = [...newMessages, assistantMessage];
      updateNodeMessages(nodeId, finalMessages);
      setStreamingContent('');

      // Generate title after first assistant response
      if (!title) {
        generateTitle(finalMessages);
      }
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      updateNodeLoading(nodeId, false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-stone-50 flex flex-col animate-in fade-in duration-200">
      {/* Header */}
      <header className="bg-white border-b border-stone-200 px-4 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="flex items-center gap-2 text-stone-500 hover:text-stone-700 transition-colors"
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
              <path d="m15 18-6-6 6-6" />
            </svg>
            <span className="text-sm font-medium">back to canvas</span>
          </button>
        </div>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${seedText ? 'bg-amber-400' : 'bg-emerald-400'}`} />
          <span className="text-sm font-medium text-stone-700">
            {isGeneratingTitle ? (
              <span className="italic text-stone-400">generating title...</span>
            ) : title ? (
              title
            ) : seedText ? (
              `branched: "${seedText.length > 40 ? seedText.slice(0, 40) + '...' : seedText}"`
            ) : (
              'new chat'
            )}
          </span>
        </div>
        <div className="text-sm text-stone-400">
          press <kbd className="px-1.5 py-0.5 bg-stone-100 rounded text-xs font-mono">esc</kbd> to exit
        </div>
      </header>

      {/* Seed text context */}
      {seedText && (
        <div className="bg-amber-50 border-b border-amber-100 px-4 py-3 shrink-0">
          <div className="max-w-3xl mx-auto">
            <div className="text-xs text-amber-600 font-medium mb-1">branched from:</div>
            <div className="text-sm text-amber-800">&ldquo;{seedText}&rdquo;</div>
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
          {messages.length === 0 && !streamingContent && (
            <div className="text-center text-stone-400 py-16">
              start a conversation...
            </div>
          )}

          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                  message.role === 'user'
                    ? 'bg-stone-900 text-white'
                    : 'bg-white border border-stone-200 text-stone-800'
                }`}
              >
                {message.role === 'user' ? (
                  <div className="whitespace-pre-wrap break-words">{message.content}</div>
                ) : (
                  <div className="prose prose-stone max-w-none break-words">
                    <ReactMarkdown>{message.content}</ReactMarkdown>
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Streaming content */}
          {streamingContent && (
            <div className="flex justify-start">
              <div className="max-w-[80%] rounded-2xl px-4 py-3 bg-white border border-stone-200 text-stone-800">
                <div className="prose prose-stone max-w-none break-words">
                  <ReactMarkdown>{streamingContent}</ReactMarkdown>
                </div>
              </div>
            </div>
          )}

          {/* Loading indicator */}
          {isLoading && !streamingContent && (
            <div className="flex justify-start">
              <div className="rounded-2xl px-4 py-3 bg-white border border-stone-200 text-stone-400">
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
      </div>

      {/* Input */}
      <div className="bg-white border-t border-stone-200 px-4 py-4 shrink-0">
        <form onSubmit={handleSubmit} className="max-w-3xl mx-auto">
          <div className="flex gap-3">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="type a message..."
              disabled={isLoading}
              className="flex-1 px-4 py-3 text-base rounded-xl border border-stone-200 focus:border-stone-400 focus:ring-2 focus:ring-stone-100 outline-none transition-all text-stone-900 placeholder:text-stone-400 disabled:bg-stone-50"
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="px-5 py-3 bg-stone-900 hover:bg-stone-800 disabled:bg-stone-300 text-white rounded-xl transition-colors"
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
                <path d="m22 2-7 20-4-9-9-4Z" />
                <path d="M22 2 11 13" />
              </svg>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

