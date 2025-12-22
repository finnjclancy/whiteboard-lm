'use client';

import { useState, useMemo } from 'react';
import { useReactFlow } from 'reactflow';
import { useCanvasStore } from '@/stores/canvasStore';
import type { ChatNode } from '@/types';

interface TreeNodeProps {
  node: ChatNode;
  children: ChatNode[];
  allNodes: ChatNode[];
  level: number;
  onNodeClick: (nodeId: string) => void;
  selectedNodeId: string | null;
}

function TreeNode({ node, children, allNodes, level, onNodeClick, selectedNodeId }: TreeNodeProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const hasChildren = children.length > 0;

  const title = node.data.title || (node.data.seedText 
    ? `branched: "${node.data.seedText.slice(0, 20)}${node.data.seedText.length > 20 ? '...' : ''}"`
    : 'new chat');

  const isSelected = selectedNodeId === node.id;

  return (
    <div>
      <div
        className={`flex items-center gap-1 py-1.5 px-2 rounded-md cursor-pointer transition-colors ${
          isSelected 
            ? 'bg-stone-200 text-stone-900' 
            : 'hover:bg-stone-100 text-stone-600'
        }`}
        style={{ paddingLeft: `${level * 12 + 8}px` }}
        onClick={() => onNodeClick(node.id)}
      >
        {/* Expand/collapse button */}
        {hasChildren ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }}
            className="p-0.5 hover:bg-stone-200 rounded transition-colors"
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
              className={`transition-transform ${isExpanded ? 'rotate-90' : ''}`}
            >
              <path d="m9 18 6-6-6-6" />
            </svg>
          </button>
        ) : (
          <span className="w-4" />
        )}

        {/* Node indicator */}
        <div className={`w-2 h-2 rounded-full shrink-0 ${
          node.data.seedText ? 'bg-amber-400' : 'bg-emerald-400'
        }`} />

        {/* Title */}
        <span className="text-sm truncate flex-1" title={title}>
          {title}
        </span>

        {/* Branch count badge */}
        {hasChildren && (
          <span className="text-xs text-stone-400 bg-stone-100 px-1.5 py-0.5 rounded">
            {children.length}
          </span>
        )}
      </div>

      {/* Children */}
      {hasChildren && isExpanded && (
        <div>
          {children.map((child) => {
            const grandchildren = allNodes.filter((n) => n.data.parentNodeId === child.id);
            return (
              <TreeNode
                key={child.id}
                node={child}
                children={grandchildren}
                allNodes={allNodes}
                level={level + 1}
                onNodeClick={onNodeClick}
                selectedNodeId={selectedNodeId}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

interface TreeSidebarProps {
  isOpen: boolean;
  onToggle: () => void;
}

export default function TreeSidebar({ isOpen, onToggle }: TreeSidebarProps) {
  const { nodes, setFocusedNode } = useCanvasStore();
  const { fitView, setCenter } = useReactFlow();
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  // Build tree structure
  const rootNodes = useMemo(() => {
    return nodes.filter((node) => !node.data.parentNodeId);
  }, [nodes]);

  const handleNodeClick = (nodeId: string) => {
    setSelectedNodeId(nodeId);
    
    // Find the node and center the view on it
    const node = nodes.find((n) => n.id === nodeId);
    if (node) {
      setCenter(node.position.x + 200, node.position.y + 200, {
        zoom: 1,
        duration: 500,
      });
    }
  };

  const handleDoubleClick = (nodeId: string) => {
    setFocusedNode(nodeId);
  };

  return (
    <>
      {/* Toggle button (always visible) */}
      <button
        onClick={onToggle}
        className={`absolute top-4 z-20 bg-white border border-stone-200 rounded-lg p-2 shadow-sm hover:bg-stone-50 transition-all ${
          isOpen ? 'left-[268px]' : 'left-4'
        }`}
        title={isOpen ? 'hide sidebar' : 'show sidebar'}
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
          className={`transition-transform ${isOpen ? '' : 'rotate-180'}`}
        >
          <path d="m15 18-6-6 6-6" />
        </svg>
      </button>

      {/* Sidebar */}
      <div
        className={`absolute top-0 left-0 h-full bg-white border-r border-stone-200 z-10 transition-transform duration-300 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{ width: '260px' }}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="px-4 py-3 border-b border-stone-100">
            <h2 className="text-sm font-semibold text-stone-700">conversations</h2>
            <p className="text-xs text-stone-400 mt-0.5">
              {nodes.length} chat{nodes.length !== 1 ? 's' : ''}
            </p>
          </div>

          {/* Tree */}
          <div className="flex-1 overflow-y-auto py-2">
            {rootNodes.length === 0 ? (
              <div className="px-4 py-8 text-center text-stone-400 text-sm">
                no conversations yet
                <br />
                <span className="text-xs">right-click to create one</span>
              </div>
            ) : (
              rootNodes.map((node) => {
                const children = nodes.filter((n) => n.data.parentNodeId === node.id);
                return (
                  <div 
                    key={node.id} 
                    onDoubleClick={() => handleDoubleClick(node.id)}
                  >
                    <TreeNode
                      node={node}
                      children={children}
                      allNodes={nodes}
                      level={0}
                      onNodeClick={handleNodeClick}
                      selectedNodeId={selectedNodeId}
                    />
                  </div>
                );
              })
            )}
          </div>

          {/* Footer hint */}
          <div className="px-4 py-2 border-t border-stone-100 text-xs text-stone-400">
            click to center • double-click to focus
          </div>
        </div>
      </div>
    </>
  );
}

