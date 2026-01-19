'use client';

import { memo, useState } from 'react';
import Image from 'next/image';
import { NodeResizer, type NodeProps } from 'reactflow';
import { IMAGE_NODE_DEFAULTS } from '@/lib/canvasDefaults';
import type { ImageNodeData } from '@/types';

function ImageNode({ id, data, selected }: NodeProps<ImageNodeData>) {
  const [dimensions, setDimensions] = useState({
    width: data.width || IMAGE_NODE_DEFAULTS.width,
    height: data.height || IMAGE_NODE_DEFAULTS.height,
  });

  return (
    <>
      <NodeResizer
        minWidth={160}
        minHeight={120}
        maxWidth={1200}
        maxHeight={1200}
        isVisible={true}
        lineClassName="!border-stone-200"
        handleClassName="!w-2.5 !h-2.5 !bg-stone-300 !border-white !border-2 !rounded-full"
        onResize={(_, params) => {
          setDimensions({ width: params.width, height: params.height });
        }}
      />
      <div
        className={`relative rounded-lg border-2 bg-white shadow-md transition-colors ${
          selected ? 'border-stone-400' : 'border-stone-200'
        }`}
        style={{ width: dimensions.width, height: dimensions.height }}
      >
        {data.src ? (
          <Image
            src={data.src}
            alt="pdf page"
            fill
            sizes="100vw"
            className="rounded-lg object-contain select-none pointer-events-none"
            unoptimized
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-sm text-stone-400">
            image unavailable
          </div>
        )}

        {/* Delete button */}
        <button
          onClick={() => {
            const event = new CustomEvent('deleteNode', { detail: { nodeId: id } });
            window.dispatchEvent(event);
          }}
          className="absolute -top-2 -right-2 p-1 bg-white border border-stone-200 rounded-full shadow-sm opacity-0 hover:opacity-100 focus:opacity-100 transition-opacity text-stone-400 hover:text-red-500 nodrag"
          title="delete image"
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

export default memo(ImageNode);
