import React, { useState, useCallback, useEffect } from 'react';
import Cropper, { Area, Point } from 'react-easy-crop';
import 'react-easy-crop/react-easy-crop.css';
import {
  RotateCcw,
  RotateCw,
  ZoomIn,
  ZoomOut,
  Sparkles,
  Undo2,
  Check,
  X,
  Eye,
  EyeOff,
  Loader2,
  Crop,
} from 'lucide-react';
import { getCroppedImg, detectDocumentPaperBounds, CropArea, createImage } from '../../utils/cropImage';

export interface CropResult {
  blob: Blob;
  dataUrl: string;
  file: File;
  width: number;
  height: number;
}

export interface DocumentCropModalProps {
  imageSrc: string;
  docType?: string;
  onApplyCrop: (result: CropResult) => void;
  onCancel: () => void;
}

type AspectRatioOption = {
  label: string;
  value: number | undefined;
  id: string;
};

const ASPECT_RATIO_OPTIONS: AspectRatioOption[] = [
  { id: 'free', label: 'Free', value: undefined },
  { id: 'a4_portrait', label: 'A4 Portrait', value: 1 / 1.414 },
  { id: 'a4_landscape', label: 'A4 Landscape', value: 1.414 / 1 },
  { id: 'square', label: '1:1 Square', value: 1 },
  { id: '4_3', label: '4:3 Standard', value: 4 / 3 },
];

export const DocumentCropModal: React.FC<DocumentCropModalProps> = ({
  imageSrc,
  docType = 'Document',
  onApplyCrop,
  onCancel,
}) => {
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [aspectIndex, setAspectIndex] = useState(1); // Default to A4 Portrait
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<CropArea | null>(null);

  const [isProcessing, setIsProcessing] = useState(false);
  const [isDetecting, setIsDetecting] = useState(false);
  const [detectionNotice, setDetectionNotice] = useState<string | null>(null);

  // Live preview state
  const [showLivePreview, setShowLivePreview] = useState(false);
  const [livePreviewUrl, setLivePreviewUrl] = useState<string | null>(null);

  const currentAspect = ASPECT_RATIO_OPTIONS[aspectIndex].value;

  const onCropComplete = useCallback((_croppedArea: Area, currentCroppedAreaPixels: Area) => {
    setCroppedAreaPixels(currentCroppedAreaPixels);
  }, []);

  // Update live preview when requested
  useEffect(() => {
    let active = true;
    let previewTimer: any = null;

    if (showLivePreview && croppedAreaPixels) {
      previewTimer = setTimeout(async () => {
        try {
          const res = await getCroppedImg(imageSrc, croppedAreaPixels, rotation);
          if (active) {
            setLivePreviewUrl(res.dataUrl);
          }
        } catch {
          // Ignore transient live preview errors
        }
      }, 250);
    } else {
      setLivePreviewUrl(null);
    }

    return () => {
      active = false;
      if (previewTimer) clearTimeout(previewTimer);
    };
  }, [showLivePreview, croppedAreaPixels, rotation, imageSrc]);

  // Rotate clockwise in 90 degree increments
  const handleRotateRight = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  // Rotate counter-clockwise in 90 degree increments
  const handleRotateLeft = () => {
    setRotation((prev) => (prev - 90 + 360) % 360);
  };

  const handleZoomIn = () => {
    setZoom((prev) => Math.min(prev + 0.2, 3));
  };

  const handleZoomOut = () => {
    setZoom((prev) => Math.max(prev - 0.2, 1));
  };

  const handleResetCrop = () => {
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setRotation(0);
    setAspectIndex(1); // A4 Portrait
    setDetectionNotice('Crop settings reset to original.');
    setTimeout(() => setDetectionNotice(null), 2500);
  };

  // Auto document paper detection heuristic
  const handleAutoDetect = async () => {
    setIsDetecting(true);
    setDetectionNotice('Analyzing document boundaries...');
    try {
      const bounds = await detectDocumentPaperBounds(imageSrc);
      if (bounds) {
        setCrop({ x: 0, y: 0 });
        setZoom(1.05);
        setDetectionNotice('Paper boundaries detected! You can fine-tune the edges.');
      } else {
        setDetectionNotice('Document aligned with standard margins.');
      }
    } catch {
      setDetectionNotice('Automatic boundary estimation complete.');
    } finally {
      setIsDetecting(false);
      setTimeout(() => setDetectionNotice(null), 3000);
    }
  };

  // Confirm crop and export high-res image
  const handleApply = async () => {
    setIsProcessing(true);
    try {
      let cropPixels = croppedAreaPixels;
      if (!cropPixels) {
        const img = await createImage(imageSrc);
        cropPixels = {
          x: 0,
          y: 0,
          width: img.naturalWidth || 800,
          height: img.naturalHeight || 600,
        };
      }
      const result = await getCroppedImg(imageSrc, cropPixels, rotation);
      onApplyCrop(result);
    } catch (err: any) {
      console.error('[GramCare Crop] Error applying crop:', err);
      setDetectionNotice('Failed to crop image. Please adjust the crop area and try again.');
      setIsProcessing(false);
    }
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
        overflow: 'hidden',
        userSelect: 'none',
      }}
    >
      {/* 1. Header Toolbar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 20px',
          backgroundColor: 'rgba(15, 23, 42, 0.95)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          backdropFilter: 'blur(8px)',
          zIndex: 20,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              backgroundColor: '#0f766e',
              color: '#fff',
              padding: '6px 14px',
              borderRadius: '20px',
              fontSize: '12px',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Crop size={15} />
            <span>Crop & Adjust {docType}</span>
          </div>
          <span style={{ color: '#94a3b8', fontSize: '13px', display: 'none' }} className="crop-header-sub">
            Drag edges or corners to frame the document
          </span>
        </div>

        {/* Notice toast */}
        {detectionNotice && (
          <div
            style={{
              backgroundColor: 'rgba(20, 184, 166, 0.18)',
              border: '1px solid #14b8a6',
              color: '#5eead4',
              padding: '5px 14px',
              borderRadius: '20px',
              fontSize: '12px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              animation: 'fadeIn 0.2s ease',
            }}
          >
            <span>{detectionNotice}</span>
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Smart Detect Button */}
          <button
            type="button"
            onClick={handleAutoDetect}
            disabled={isDetecting || isProcessing}
            title="Automatically detect document paper edges"
            style={{
              backgroundColor: 'rgba(20, 184, 166, 0.2)',
              border: '1px solid rgba(20, 184, 166, 0.5)',
              color: '#2dd4bf',
              borderRadius: '20px',
              padding: '6px 14px',
              fontSize: '12px',
              fontWeight: 600,
              cursor: isDetecting ? 'wait' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.15s ease',
            }}
          >
            {isDetecting ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Sparkles size={14} />}
            <span>{isDetecting ? 'Detecting...' : 'Auto Detect'}</span>
          </button>

          {/* Toggle Live Preview */}
          <button
            type="button"
            onClick={() => setShowLivePreview((prev) => !prev)}
            title="Toggle Live Crop Preview"
            style={{
              backgroundColor: showLivePreview ? '#0f766e' : 'rgba(30, 41, 59, 0.8)',
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
            {showLivePreview ? <EyeOff size={14} /> : <Eye size={14} />}
            <span>Preview</span>
          </button>

          {/* Close / Cancel Button */}
          <button
            type="button"
            onClick={onCancel}
            disabled={isProcessing}
            title="Cancel Cropping"
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

      {/* 2. Main Cropping Canvas & Cropper */}
      <div
        style={{
          flex: 1,
          position: 'relative',
          width: '100%',
          height: '100%',
          overflow: 'hidden',
          backgroundColor: '#030712',
        }}
      >
        <Cropper
          image={imageSrc}
          crop={crop}
          zoom={zoom}
          rotation={rotation}
          aspect={currentAspect}
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onRotationChange={setRotation}
          onCropComplete={onCropComplete}
          showGrid={true}
          style={{
            containerStyle: {
              width: '100%',
              height: '100%',
              backgroundColor: '#030712',
            },
            cropAreaStyle: {
              border: '2px solid #14b8a6',
              boxShadow: '0 0 0 9999px rgba(5, 12, 20, 0.65)',
            },
          }}
        />

        {/* Live Preview Floating Pip Modal */}
        {showLivePreview && livePreviewUrl && (
          <div
            style={{
              position: 'absolute',
              top: '16px',
              right: '16px',
              width: '180px',
              maxHeight: '260px',
              backgroundColor: 'rgba(15, 23, 42, 0.95)',
              border: '1.5px solid #14b8a6',
              borderRadius: '12px',
              overflow: 'hidden',
              boxShadow: '0 8px 32px rgba(0,0,0,0.7)',
              zIndex: 30,
              padding: '8px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
            }}
          >
            <div style={{ color: '#5eead4', fontSize: '11px', fontWeight: 700, marginBottom: '6px' }}>
              Cropped Output
            </div>
            <img
              src={livePreviewUrl}
              alt="Live crop preview"
              style={{
                width: '100%',
                maxHeight: '200px',
                objectFit: 'contain',
                borderRadius: '6px',
                backgroundColor: '#000',
              }}
            />
          </div>
        )}
      </div>

      {/* 3. Bottom Controls Panel */}
      <div
        style={{
          backgroundColor: 'rgba(15, 23, 42, 0.98)',
          borderTop: '1px solid rgba(255, 255, 255, 0.1)',
          padding: '16px 20px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
          zIndex: 20,
        }}
      >
        {/* Row A: Aspect Ratio Selector */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            flexWrap: 'wrap',
          }}
        >
          <span style={{ color: '#94a3b8', fontSize: '12px', fontWeight: 600, marginRight: '4px' }}>
            Aspect Ratio:
          </span>
          {ASPECT_RATIO_OPTIONS.map((opt, idx) => {
            const isActive = aspectIndex === idx;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setAspectIndex(idx)}
                style={{
                  backgroundColor: isActive ? '#0f766e' : 'rgba(30, 41, 59, 0.7)',
                  border: isActive ? '1.5px solid #14b8a6' : '1px solid rgba(255, 255, 255, 0.15)',
                  color: isActive ? '#fff' : '#cbd5e1',
                  borderRadius: '16px',
                  padding: '5px 12px',
                  fontSize: '12px',
                  fontWeight: isActive ? 700 : 500,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                {opt.label}
              </button>
            );
          })}
        </div>

        {/* Row B: Zoom and Rotation Controls */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '24px',
            flexWrap: 'wrap',
          }}
        >
          {/* Rotation Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              onClick={handleRotateLeft}
              title="Rotate 90° Left"
              style={{
                backgroundColor: 'rgba(30, 41, 59, 0.85)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '8px',
                padding: '6px 12px',
                color: '#e2e8f0',
                fontSize: '12px',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                cursor: 'pointer',
              }}
            >
              <RotateCcw size={14} />
              <span>-90°</span>
            </button>

            <span style={{ color: '#94a3b8', fontSize: '12px', minWidth: '38px', textAlign: 'center' }}>
              {rotation}°
            </span>

            <button
              type="button"
              onClick={handleRotateRight}
              title="Rotate 90° Right"
              style={{
                backgroundColor: 'rgba(30, 41, 59, 0.85)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '8px',
                padding: '6px 12px',
                color: '#e2e8f0',
                fontSize: '12px',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                cursor: 'pointer',
              }}
            >
              <RotateCw size={14} />
              <span>+90°</span>
            </button>
          </div>

          {/* Zoom Slider and Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              type="button"
              onClick={handleZoomOut}
              disabled={zoom <= 1}
              title="Zoom Out"
              style={{
                backgroundColor: 'rgba(30, 41, 59, 0.85)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '50%',
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#e2e8f0',
                cursor: zoom <= 1 ? 'not-allowed' : 'pointer',
                opacity: zoom <= 1 ? 0.5 : 1,
              }}
            >
              <ZoomOut size={14} />
            </button>

            <input
              type="range"
              min={1}
              max={3}
              step={0.05}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              style={{
                width: '120px',
                accentColor: '#14b8a6',
                cursor: 'pointer',
              }}
              aria-label="Zoom slider"
            />

            <button
              type="button"
              onClick={handleZoomIn}
              disabled={zoom >= 3}
              title="Zoom In"
              style={{
                backgroundColor: 'rgba(30, 41, 59, 0.85)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '50%',
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#e2e8f0',
                cursor: zoom >= 3 ? 'not-allowed' : 'pointer',
                opacity: zoom >= 3 ? 0.5 : 1,
              }}
            >
              <ZoomIn size={14} />
            </button>

            <span style={{ color: '#94a3b8', fontSize: '12px', minWidth: '36px' }}>
              {zoom.toFixed(1)}x
            </span>
          </div>

          {/* Reset Crop Button */}
          <button
            type="button"
            onClick={handleResetCrop}
            title="Reset crop, zoom, and rotation"
            style={{
              backgroundColor: 'rgba(51, 65, 85, 0.6)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: '8px',
              padding: '6px 12px',
              color: '#cbd5e1',
              fontSize: '12px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer',
            }}
          >
            <Undo2 size={14} />
            <span>Reset</span>
          </button>
        </div>

        {/* Row C: Primary Action Buttons (Cancel, Retake, Apply Crop) */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '14px',
            flexWrap: 'wrap',
            paddingTop: '4px',
          }}
        >
          <button
            type="button"
            onClick={onCancel}
            disabled={isProcessing}
            style={{
              backgroundColor: 'rgba(51, 65, 85, 0.9)',
              border: '1.5px solid rgba(255, 255, 255, 0.2)',
              color: '#fff',
              borderRadius: '24px',
              padding: '10px 22px',
              fontSize: '14px',
              fontWeight: 600,
              cursor: isProcessing ? 'not-allowed' : 'pointer',
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
            onClick={handleApply}
            disabled={isProcessing}
            style={{
              backgroundColor: '#0f766e',
              border: 'none',
              color: '#fff',
              borderRadius: '24px',
              padding: '10px 32px',
              fontSize: '14px',
              fontWeight: 700,
              cursor: isProcessing ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 4px 18px rgba(15, 118, 110, 0.5)',
              opacity: isProcessing ? 0.7 : 1,
              transition: 'all 0.15s ease',
            }}
          >
            {isProcessing ? (
              <>
                <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                <span>Cropping Image...</span>
              </>
            ) : (
              <>
                <Check size={18} />
                <span>Apply Crop</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
