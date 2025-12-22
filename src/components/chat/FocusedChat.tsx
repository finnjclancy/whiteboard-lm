'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import ReactMarkdown from 'react-markdown';
import { createClient } from '@/lib/supabase/client';
import { useCanvasStore } from '@/stores/canvasStore';
import QueuePanel from '@/components/canvas/QueuePanel';
import type { ChatNodeData, DbMessage } from '@/types';

interface TextSelection {
  text: string;
  rect: DOMRect;
}

interface FocusedChatProps {
  nodeId: string;
  data: ChatNodeData;
  onClose: () => void;
  onBranch: (seedText: string) => void;
}

export default function FocusedChat({ nodeId, data, onClose, onBranch }: FocusedChatProps) {
  const [input, setInput] = useState('');
  const [streamingContent, setStreamingContent] = useState('');
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState('');
  const [selection, setSelection] = useState<TextSelection | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();
  const { nodes, updateNodeMessages, updateNodeLoading, updateNodeTitle, updateNodeGeneratingTitle, addToQueue } = useCanvasStore();

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

    updateNodeGeneratingTitle(nodeId, true);

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
          .eq('id', nodeId);

        // Update local state
        updateNodeTitle(nodeId, generatedTitle);
      }
    } catch (error) {
      console.error('Error generating title:', error);
    } finally {
      updateNodeGeneratingTitle(nodeId, false);
    }
  }, [nodeId, title, messages.length, seedText, supabase, updateNodeTitle, updateNodeGeneratingTitle]);

  // Save edited title
  const handleSaveTitle = async () => {
    const trimmedTitle = editedTitle.trim();
    if (trimmedTitle && trimmedTitle !== title) {
      // Save to database
      await supabase
        .from('nodes')
        .update({ title: trimmedTitle })
        .eq('id', nodeId);
      
      // Update local state
      updateNodeTitle(nodeId, trimmedTitle);
    }
    setIsEditingTitle(false);
  };

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }, [messages, streamingContent]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Handle escape key to close (or clear selection first)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isEditingTitle) return;
        if (selection) {
          setSelection(null);
          return;
        }
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose, isEditingTitle, selection]);

  // Handle text selection for branching
  const handleMouseUp = useCallback(() => {
    const windowSelection = window.getSelection();
    if (!windowSelection || windowSelection.isCollapsed) return;

    const text = windowSelection.toString().trim();
    if (text.length < 10) return; // Ignore very short selections

    // Check if selection is within assistant message
    const range = windowSelection.getRangeAt(0);
    const container = range.commonAncestorContainer;
    const messageEl = (container as Element).closest?.('.assistant-message') ||
      (container.parentElement as Element)?.closest?.('.assistant-message');

    if (!messageEl) return;

    const rect = range.getBoundingClientRect();
    setSelection({ text, rect });
  }, []);

  // Clear selection when clicking outside
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.branch-pill') && !window.getSelection()?.toString()) {
        setSelection(null);
      }
    };

    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  // Handle branch click
  const handleBranch = useCallback(() => {
    if (!selection) return;
    onBranch(selection.text);
  }, [selection, onBranch]);

  // Handle add to queue click
  const handleAddToQueue = useCallback(() => {
    if (!selection) return;
    addToQueue(selection.text, nodeId);
    setSelection(null);
  }, [selection, nodeId, addToQueue]);

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
    const questionText = input.trim();
    setInput('');
    updateNodeLoading(nodeId, true);
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
          {isEditingTitle ? (
            <input
              ref={titleInputRef}
              type="text"
              value={editedTitle}
              onChange={(e) => setEditedTitle(e.target.value)}
              onBlur={handleSaveTitle}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveTitle();
                if (e.key === 'Escape') {
                  setIsEditingTitle(false);
                  e.stopPropagation(); // prevent closing fullscreen
                }
              }}
              className="text-sm font-medium text-stone-700 bg-stone-100 px-2 py-0.5 rounded border border-stone-300 outline-none focus:border-stone-400"
              placeholder="enter title..."
            />
          ) : isGeneratingTitle ? (
            <span className="text-sm font-medium text-stone-400 italic">generating title...</span>
          ) : title ? (
            <span
              className="text-sm font-medium text-stone-700 cursor-pointer hover:text-stone-900"
              title="click to edit title"
              onClick={() => {
                setEditedTitle(title);
                setIsEditingTitle(true);
              }}
            >
              {title}
            </span>
          ) : seedText ? (
            <span
              className="text-sm font-medium text-stone-700 cursor-pointer hover:text-stone-900"
              title="click to edit title"
              onClick={() => {
                setEditedTitle('');
                setIsEditingTitle(true);
              }}
            >
              branched: &ldquo;{seedText.length > 40 ? seedText.slice(0, 40) + '...' : seedText}&rdquo;
            </span>
          ) : (
            <span
              className="text-sm font-medium text-stone-700 cursor-pointer hover:text-stone-900"
              onClick={() => {
                setEditedTitle('');
                setIsEditingTitle(true);
              }}
            >
              new chat
            </span>
          )}
        </div>
        <div className="text-sm text-stone-400">
          press <kbd className="px-1.5 py-0.5 bg-stone-100 rounded text-xs font-mono">esc</kbd> to exit
        </div>
      </header>

      {/* Seed text context - shows parent info for branched chats */}
      {seedText && parentNodeId && (
        <div className="bg-amber-50 border-b border-amber-100 px-4 py-3 shrink-0">
          <div className="max-w-3xl mx-auto">
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
              branched from: {parentTitle}
            </div>
            <div className="text-sm text-amber-800">&ldquo;{seedText}&rdquo;</div>
          </div>
        </div>
      )}

      {/* Messages */}
      <div ref={messagesContainerRef} className="flex-1 overflow-y-auto custom-scrollbar" onMouseUp={handleMouseUp}>
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
                    : 'bg-white border border-stone-200 text-stone-800 assistant-message'
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
              <div className="max-w-[80%] rounded-2xl px-4 py-3 bg-white border border-stone-200 text-stone-800 assistant-message">
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
        </div>
      </div>

      {/* Input */}
      <div className="bg-white border-t border-stone-200 px-4 py-4 shrink-0">
        <form onSubmit={handleSubmit} className="max-w-3xl mx-auto">
          <div className="flex gap-3 items-end">
            <textarea
              ref={inputRef}
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
              placeholder="type a message... (shift+enter for new line)"
              disabled={isLoading}
              rows={1}
              className="flex-1 px-4 py-3 text-base rounded-xl border border-stone-200 focus:border-stone-400 focus:ring-2 focus:ring-stone-100 outline-none transition-all text-stone-900 placeholder:text-stone-400 disabled:bg-stone-50 resize-none min-h-[50px] max-h-[200px]"
              style={{ height: 'auto', overflow: 'hidden' }}
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement;
                target.style.height = 'auto';
                target.style.height = Math.min(target.scrollHeight, 200) + 'px';
              }}
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

      {/* Branch/Queue pill - appears when text is selected */}
      {selection && (
        <div
          className="branch-pill fixed z-[60] transform -translate-x-1/2 -translate-y-full animate-in fade-in slide-in-from-bottom-2 duration-150"
          style={{
            left: selection.rect.left + selection.rect.width / 2,
            top: selection.rect.top - 10,
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
      )}

      {/* Queue panel */}
      <QueuePanel onInsert={(text) => setInput((prev) => prev + text)} />
    </div>
  );
}
