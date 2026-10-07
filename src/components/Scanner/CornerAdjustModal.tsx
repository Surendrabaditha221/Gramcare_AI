import React, { useState, useRef, useCallback } from 'react';
import { Check, X, Undo2, Sliders, Grid } from 'lucide-react';
import { QuadCorners } from '../../utils/documentCV';

export interface CornerAdjustModalProps {
  imageSrc: string;
  initialQuad: QuadCorners;
  onApplyQuad: (quad: QuadCorners) => void;
  onCancel: () => void;
}

export const CornerAdjustModal: React.FC<CornerAdjustModalProps> = ({
  imageSrc,
  initialQuad,
  onApplyQuad,
  onCancel,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [imageDims, setImageDims] = useState<{ width: number; height: number }>({ width: 800, height: 600 });
  const [showGrid, setShowGrid] = useState(true);

  // Normalized quad [0..1]
  const [normQuad, setNormQuad] = useState<QuadCorners>(() => {
    // If initialQuad is in pixels, we normalize once image loads
    return {
      topLeft: { x: 0.1, y: 0.1 },
      topRight: { x: 0.9, y: 0.1 },
      bottomRight: { x: 0.9, y: 0.9 },
      bottomLeft: { x: 0.1, y: 0.9 },
    };
  });

  const [activeCorner, setActiveCorner] = useState<'topLeft' | 'topRight' | 'bottomRight' | 'bottomLeft' | null>(null);

  // Initialize normalized quad from initialQuad once image dimensions are known
  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    const naturalW = img.naturalWidth || 800;
    const naturalH = img.naturalHeight || 600;
    setImageDims({ width: naturalW, height: naturalH });

    setNormQuad({
      topLeft: {
        x: Math.max(0, Math.min(1, initialQuad.topLeft.x / naturalW)),
        y: Math.max(0, Math.min(1, initialQuad.topLeft.y / naturalH)),
      },
      topRight: {
        x: Math.max(0, Math.min(1, initialQuad.topRight.x / naturalW)),
        y: Math.max(0, Math.min(1, initialQuad.topRight.y / naturalH)),
      },
      bottomRight: {
        x: Math.max(0, Math.min(1, initialQuad.bottomRight.x / naturalW)),
        y: Math.max(0, Math.min(1, initialQuad.bottomRight.y / naturalH)),
      },
      bottomLeft: {
        x: Math.max(0, Math.min(1, initialQuad.bottomLeft.x / naturalW)),
        y: Math.max(0, Math.min(1, initialQuad.bottomLeft.y / naturalH)),
      },
    });
  };

  const handlePointerDown = (corner: 'topLeft' | 'topRight' | 'bottomRight' | 'bottomLeft') => (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setActiveCorner(corner);
  };

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!activeCorner || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    const rawX = (e.clientX - rect.left) / rect.width;
    const rawY = (e.clientY - rect.top) / rect.height;

    const clampedX = Math.max(0.01, Math.min(0.99, rawX));
    const clampedY = Math.max(0.01, Math.min(0.99, rawY));

    setNormQuad((prev) => ({
      ...prev,
      [activeCorner]: { x: clampedX, y: clampedY },
    }));
  }, [activeCorner]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (activeCorner) {
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        // Ignore
      }
      setActiveCorner(null);
    }
  }, [activeCorner]);

  const handleReset = () => {
    setNormQuad({
      topLeft: { x: 0.08, y: 0.08 },
      topRight: { x: 0.92, y: 0.08 },
      bottomRight: { x: 0.92, y: 0.92 },
      bottomLeft: { x: 0.08, y: 0.92 },
    });
  };

  const handleConfirm = () => {
    const finalQuad: QuadCorners = {
      topLeft: {
        x: Math.round(normQuad.topLeft.x * imageDims.width),
        y: Math.round(normQuad.topLeft.y * imageDims.height),
      },
      topRight: {
        x: Math.round(normQuad.topRight.x * imageDims.width),
        y: Math.round(normQuad.topRight.y * imageDims.height),
      },
      bottomRight: {
        x: Math.round(normQuad.bottomRight.x * imageDims.width),
        y: Math.round(normQuad.bottomRight.y * imageDims.height),
      },
      bottomLeft: {
        x: Math.round(normQuad.bottomLeft.x * imageDims.width),
        y: Math.round(normQuad.bottomLeft.y * imageDims.height),
      },
    };
    onApplyQuad(finalQuad);
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: '#050c14',
        zIndex: 100000,
        display: 'flex',
        flexDirection: 'column',
        width: '100vw',
        height: '100vh',
        userSelect: 'none',
        overflow: 'hidden',
      }}
    >
      {/* 1. Header Toolbar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 20px',
          backgroundColor: 'rgba(15, 23, 42, 0.95)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          backdropFilter: 'blur(8px)',
          zIndex: 30,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              backgroundColor: '#0f766e',
              color: '#fff',
              padding: '6px 14px',
              borderRadius: '20px',
              fontSize: '13px',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Sliders size={15} />
            <span>Adjust 4 Document Corners</span>
          </div>
          <span style={{ color: '#94a3b8', fontSize: '12px' }}>
            Drag corner handles to align with the paper edges
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Toggle Grid */}
          <button
            type="button"
            onClick={() => setShowGrid((prev) => !prev)}
            title="Toggle Alignment Grid"
            style={{
              backgroundColor: showGrid ? '#0f766e' : 'rgba(30, 41, 59, 0.8)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              color: '#fff',
              borderRadius: '20px',
              padding: '6px 12px',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Grid size={14} />
            <span>Grid</span>
          </button>

          {/* Reset Corners */}
          <button
            type="button"
            onClick={handleReset}
            title="Reset Corners"
            style={{
              backgroundColor: 'rgba(51, 65, 85, 0.7)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              color: '#cbd5e1',
              borderRadius: '20px',
              padding: '6px 14px',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Undo2 size={14} />
            <span>Reset</span>
          </button>

          {/* Close / Cancel */}
          <button
            type="button"
            onClick={onCancel}
            title="Cancel (Esc)"
            style={{
              backgroundColor: 'rgba(239, 68, 68, 0.2)',
              border: '1px solid rgba(239, 68, 68, 0.5)',
              color: '#f87171',
              borderRadius: '50%',
              width: '34px',
              height: '34px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* 2. Interactive Main Workspace */}
      <div
        style={{
          flex: 1,
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px',
          overflow: 'hidden',
          backgroundColor: '#030712',
        }}
      >
        <div
          ref={containerRef}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          style={{
            position: 'relative',
            maxWidth: '100%',
            maxHeight: '100%',
            display: 'inline-block',
            boxShadow: '0 12px 40px rgba(0,0,0,0.8)',
            touchAction: 'none',
          }}
        >
          {/* Base captured image */}
          <img
            src={imageSrc}
            alt="Source Document"
            onLoad={handleImageLoad}
            style={{
              display: 'block',
              maxWidth: 'min(92vw, 840px)',
              maxHeight: 'min(72vh, 640px)',
              objectFit: 'contain',
              userSelect: 'none',
              pointerEvents: 'none',
            }}
          />

          {/* SVG Overlay: Semi-transparent vignette, polygon edge lines, grid lines */}
          <svg
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              pointerEvents: 'none',
            }}
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
          >
            {/* Dark mask outside quadrilateral */}
            <path
              d={`M 0 0 L 100 0 L 100 100 L 0 100 Z M ${normQuad.topLeft.x * 100} ${normQuad.topLeft.y * 100} L ${normQuad.topRight.x * 100} ${normQuad.topRight.y * 100} L ${normQuad.bottomRight.x * 100} ${normQuad.bottomRight.y * 100} L ${normQuad.bottomLeft.x * 100} ${normQuad.bottomLeft.y * 100} Z`}
              fillRule="evenodd"
              fill="rgba(5, 12, 20, 0.58)"
            />

            {/* Quadrilateral Border */}
            <polygon
              points={`${normQuad.topLeft.x * 100},${normQuad.topLeft.y * 100} ${normQuad.topRight.x * 100},${normQuad.topRight.y * 100} ${normQuad.bottomRight.x * 100},${normQuad.bottomRight.y * 100} ${normQuad.bottomLeft.x * 100},${normQuad.bottomLeft.y * 100}`}
              fill="rgba(20, 184, 166, 0.12)"
              stroke="#14b8a6"
              strokeWidth="0.75"
              strokeDasharray={activeCorner ? 'none' : '1.5 1'}
            />

            {/* Rule of thirds grid lines inside the quad */}
            {showGrid && (
              <>
                {/* Horizontal line 1/3 */}
                <line
                  x1={(normQuad.topLeft.x * 2 + normQuad.bottomLeft.x) / 3 * 100}
                  y1={(normQuad.topLeft.y * 2 + normQuad.bottomLeft.y) / 3 * 100}
                  x2={(normQuad.topRight.x * 2 + normQuad.bottomRight.x) / 3 * 100}
                  y2={(normQuad.topRight.y * 2 + normQuad.bottomRight.y) / 3 * 100}
                  stroke="rgba(20, 184, 166, 0.4)"
                  strokeWidth="0.35"
                />
                {/* Horizontal line 2/3 */}
                <line
                  x1={(normQuad.topLeft.x + normQuad.bottomLeft.x * 2) / 3 * 100}
                  y1={(normQuad.topLeft.y + normQuad.bottomLeft.y * 2) / 3 * 100}
                  x2={(normQuad.topRight.x + normQuad.bottomRight.x * 2) / 3 * 100}
                  y2={(normQuad.topRight.y + normQuad.bottomRight.y * 2) / 3 * 100}
                  stroke="rgba(20, 184, 166, 0.4)"
                  strokeWidth="0.35"
                />
                {/* Vertical line 1/3 */}
                <line
                  x1={(normQuad.topLeft.x * 2 + normQuad.topRight.x) / 3 * 100}
                  y1={(normQuad.topLeft.y * 2 + normQuad.topRight.y) / 3 * 100}
                  x2={(normQuad.bottomLeft.x * 2 + normQuad.bottomRight.x) / 3 * 100}
                  y2={(normQuad.bottomLeft.y * 2 + normQuad.bottomRight.y) / 3 * 100}
                  stroke="rgba(20, 184, 166, 0.4)"
                  strokeWidth="0.35"
                />
                {/* Vertical line 2/3 */}
                <line
                  x1={(normQuad.topLeft.x + normQuad.topRight.x * 2) / 3 * 100}
                  y1={(normQuad.topLeft.y + normQuad.topRight.y * 2) / 3 * 100}
                  x2={(normQuad.bottomLeft.x + normQuad.bottomRight.x * 2) / 3 * 100}
                  y2={(normQuad.bottomLeft.y + normQuad.bottomRight.y * 2) / 3 * 100}
                  stroke="rgba(20, 184, 166, 0.4)"
                  strokeWidth="0.35"
                />
              </>
            )}
          </svg>

          {/* 4 Interactive Draggable Corner Knobs */}
          {(['topLeft', 'topRight', 'bottomRight', 'bottomLeft'] as const).map((cornerKey) => {
            const pt = normQuad[cornerKey];
            const isDragging = activeCorner === cornerKey;
            const label = cornerKey === 'topLeft' ? 'TL' :
                          cornerKey === 'topRight' ? 'TR' :
                          cornerKey === 'bottomRight' ? 'BR' : 'BL';

            return (
              <div
                key={cornerKey}
                onPointerDown={handlePointerDown(cornerKey)}
                title={`Drag ${label} Corner`}
                style={{
                  position: 'absolute',
                  left: `${pt.x * 100}%`,
                  top: `${pt.y * 100}%`,
                  transform: 'translate(-50%, -50%)',
                  width: isDragging ? '44px' : '36px',
                  height: isDragging ? '44px' : '36px',
                  borderRadius: '50%',
                  backgroundColor: isDragging ? '#2dd4bf' : '#14b8a6',
                  border: '3px solid #ffffff',
                  boxShadow: '0 0 12px rgba(20, 184, 166, 0.8), 0 4px 10px rgba(0,0,0,0.5)',
                  cursor: 'grab',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#0f172a',
                  fontWeight: 800,
                  fontSize: '11px',
                  zIndex: 25,
                  transition: isDragging ? 'none' : 'transform 0.1s ease',
                  touchAction: 'none',
                }}
              >
                {label}
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. Bottom Action Bar */}
      <div
        style={{
          backgroundColor: 'rgba(15, 23, 42, 0.98)',
          borderTop: '1px solid rgba(255, 255, 255, 0.1)',
          padding: '16px 20px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '16px',
          zIndex: 30,
        }}
      >
        <button
          type="button"
          onClick={onCancel}
          style={{
            backgroundColor: 'rgba(51, 65, 85, 0.85)',
            border: '1.5px solid rgba(255, 255, 255, 0.2)',
            color: '#fff',
            borderRadius: '24px',
            padding: '10px 24px',
            fontSize: '14px',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <X size={16} />
          <span>Cancel</span>
        </button>

        <button
          type="button"
          onClick={handleConfirm}
          style={{
            backgroundColor: '#0f766e',
            border: 'none',
            color: '#fff',
            borderRadius: '24px',
            padding: '10px 32px',
            fontSize: '14px',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: '0 4px 16px rgba(15, 118, 110, 0.5)',
            transition: 'all 0.15s ease',
          }}
        >
          <Check size={18} />
          <span>Apply Perspective Correction</span>
        </button>
      </div>
    </div>
  );
};
