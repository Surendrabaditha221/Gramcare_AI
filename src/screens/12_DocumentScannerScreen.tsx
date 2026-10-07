import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  ScanLine, Camera, Upload, CheckCircle2, Loader2, Save, WifiOff,
  AlertTriangle, X, RotateCcw, FlipHorizontal2, Image as ImageIcon, FileText,
  CameraOff, AlertCircle, ChevronRight, Check, Maximize2, Minimize2, Zap, ZapOff,
  RefreshCw, Crop, Undo2, RotateCw, Sliders
} from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { DocumentScanResult } from '../types/records';
import { UserProfile } from '../types/user';
import { PrimaryButton } from '../components/Common/PrimaryButton';
import { SecondaryButton } from '../components/Common/SecondaryButton';
import { DocumentCropModal, CropResult } from '../components/Scanner/DocumentCropModal';
import { HospitalMedicalReport } from '../components/Scanner/HospitalMedicalReport';
import {
  detectDocumentCorners,
  warpPerspective,
  rotateImage90,
  DetectionResult,
  QuadCorners
} from '../utils/documentCV';
import { CornerAdjustModal } from '../components/Scanner/CornerAdjustModal';
import { API_BASE_URL } from '../config/apiConfig';

interface DocumentScannerScreenProps {
  activePatientName: string;
  userProfile?: UserProfile | null;
  onSaveRecord: (scanResult: DocumentScanResult) => void;
}

export type CameraLifecycleState =
  | 'idle'
  | 'requesting_permission'
  | 'initializing'
  | 'ready'
  | 'capturing'
  | 'captured'
  | 'error'
  | 'stopped';

type ScanState = 'idle' | 'scanning' | 'done' | 'error';
type CameraError =
  | 'denied'
  | 'unavailable'
  | 'in_use'
  | 'timeout'
  | 'playback'
  | 'insecure'
  | 'stalled'
  | 'disconnected'
  | 'unknown';

export interface DeviceEnvironment {
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  platform: string;
}

// Centralized API_BASE_URL imported from ../config/apiConfig


async function uploadDocumentFile(
  file: File,
  docType: string,
  patientName: string
): Promise<any | null> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('doc_type', docType);
  formData.append('patient_name', patientName);
  const token = typeof localStorage !== 'undefined' ? localStorage.getItem('gramcare_access_token') : null;
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const response = await fetch(`${API_BASE_URL}/api/document/upload`, {
    method: 'POST',
    headers,
    body: formData,
  });
  if (!response.ok) {
    const errBody = await response.json().catch(() => ({}));
    throw new Error(errBody?.detail || `HTTP ${response.status}`);
  }
  return await response.json();
}

function dataURLtoFile(dataUrl: string, filename: string): File {
  const [header, data] = dataUrl.split(',');
  const mime = header.match(/:(.*?);/)?.[1] || 'image/jpeg';
  const bytes = atob(data);
  const arr = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
  return new File([arr], filename, { type: mime });
}

const CAMERA_ERROR_MESSAGES: Record<CameraError, string> = {
  denied: 'Camera permission was denied. Please click the camera or lock icon in your browser address bar to allow camera access on this site, then click Try Again.',
  unavailable: 'No camera hardware was found on your device. Please ensure your webcam is connected or upload a document photo instead.',
  in_use: 'Your camera is currently in use by another application or browser tab. Please close other camera windows (such as another tab, Zoom, or Teams) and click Try Again.',
  timeout: 'Camera connection timed out. Another browser tab or app may be holding the camera hardware lock, or the driver did not respond. Close other camera tabs and click Try Again.',
  playback: 'The camera stream connected, but video playback could not start. Please click Try Again or reload the page.',
  insecure: 'Camera access requires a secure connection (HTTPS) when accessed over a network. On localhost, use http://localhost:5174 or http://localhost:5173.',
  stalled: 'Camera connected but video frames are paused. If your laptop has a physical webcam privacy shutter switch, please slide it open.',
  disconnected: 'The camera device was disconnected. Please reconnect your webcam and click Try Again.',
  unknown: 'Unable to start camera. Please verify device permissions and settings, or upload a photo instead.',
};

/**
 * Robust device environment detector combining navigator.userAgentData client hints,
 * touch capability, screen characteristics, and user-agent fallbacks.
 */
function detectDeviceEnvironment(): DeviceEnvironment {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return { isMobile: false, isTablet: false, isDesktop: true, platform: 'desktop' };
  }

  // 1. Standards-compliant Client Hints: navigator.userAgentData
  const uaData = (navigator as any).userAgentData;
  if (uaData && typeof uaData.mobile === 'boolean') {
    const isMobileHint = uaData.mobile;
    const platformHint = (uaData.platform || '').toLowerCase();
    const maxTouch = navigator.maxTouchPoints || 0;
    const isTablet = isMobileHint && (maxTouch > 1 && window.innerWidth >= 600);
    return {
      isMobile: isMobileHint && !isTablet,
      isTablet,
      isDesktop: !isMobileHint,
      platform: platformHint || (isMobileHint ? 'mobile' : 'desktop'),
    };
  }

  // 2. Touch points & media queries
  const maxTouchPoints = navigator.maxTouchPoints || 0;
  const ua = navigator.userAgent || '';
  const isIPad = /iPad/i.test(ua) || (maxTouchPoints > 1 && /Macintosh/i.test(ua));
  const isAndroid = /Android/i.test(ua);
  const isIPhone = /iPhone|iPod/i.test(ua);
  const isMobileUa = /Mobile|Android|iPhone|iPod|Windows Phone|webOS|BlackBerry/i.test(ua);

  const hasTabletWidth = typeof window !== 'undefined' && window.innerWidth >= 600;
  const isTablet = isIPad || (isAndroid && !/Mobile/i.test(ua)) || (maxTouchPoints > 1 && hasTabletWidth && isMobileUa);
  const isMobile = (isIPhone || isMobileUa) && !isTablet;
  const isDesktop = !isMobile && !isTablet;

  let platform = 'desktop';
  if (isIPad) platform = 'ipad';
  else if (isIPhone) platform = 'iphone';
  else if (isAndroid) platform = 'android';
  else if (isDesktop) platform = 'desktop';

  return {
    isMobile,
    isTablet,
    isDesktop,
    platform,
  };
}

const REMOTE_OR_VIRTUAL_PATTERNS = [
  /phone\s*link/i,
  /link\s*to\s*windows/i,
  /droidcam/i,
  /iriun/i,
  /obs\s*virtual/i,
  /epoccam/i,
  /camo/i,
  /virtual\s*camera/i,
  /virtual\s*webcam/i,
  /remote\s*camera/i,
  /continuity/i,
  /ip\s*camera/i,
  /ivcam/i,
];

function isRemoteOrVirtualCamera(label: string): boolean {
  if (!label) return false;
  return REMOTE_OR_VIRTUAL_PATTERNS.some(pattern => pattern.test(label));
}

const LOCAL_WEBCAM_PATTERNS = [
  /integrated/i,
  /built-?in/i,
  /chicony/i,
  /facetime/i,
  /sunplus/i,
  /realtek/i,
  /bison/i,
  /usb\s*video\s*device/i,
  /usb2\.0\s*camera/i,
  /usb\s*camera/i,
  /webcam/i,
  /front/i,
  /hd\s*camera/i,
  /laptop/i,
];

function isLocalWebcam(label: string): boolean {
  if (!label) return false;
  if (isRemoteOrVirtualCamera(label)) return false;
  return LOCAL_WEBCAM_PATTERNS.some(pattern => pattern.test(label));
}

/**
 * Chooses the best camera device for the current platform.
 * - On desktop/laptop: selects the local integrated/USB webcam and avoids remote/virtual phone links.
 * - On mobile/tablet: selects rear camera for document scanning, or front camera if requested.
 */
function findBestCameraDevice(
  devices: MediaDeviceInfo[],
  env: DeviceEnvironment,
  facing: 'environment' | 'user'
): MediaDeviceInfo | null {
  const videoInputs = devices.filter(d => d.kind === 'videoinput');
  if (videoInputs.length === 0) return null;
  if (videoInputs.length === 1) return videoInputs[0];

  if (env.isDesktop) {
    // 1. Prefer explicitly matched local hardware webcam
    const localHardwareWebcam = videoInputs.find(d => isLocalWebcam(d.label));
    if (localHardwareWebcam) {
      console.log(`[GramCare Camera] Selected local hardware webcam: "${localHardwareWebcam.label}"`);
      return localHardwareWebcam;
    }

    // 2. Prefer any non-virtual, non-remote camera
    const nonRemoteWebcam = videoInputs.find(d => !isRemoteOrVirtualCamera(d.label));
    if (nonRemoteWebcam) {
      console.log(`[GramCare Camera] Selected non-remote webcam: "${nonRemoteWebcam.label}"`);
      return nonRemoteWebcam;
    }

    return videoInputs[0];
  }

  // Mobile / Tablet: Match requested facing mode
  if (facing === 'environment') {
    const rearCamera = videoInputs.find(d => /back|rear|environment|main|0/i.test(d.label));
    if (rearCamera) {
      console.log(`[GramCare Camera] Selected mobile rear camera: "${rearCamera.label}"`);
      return rearCamera;
    }
  } else {
    const frontCamera = videoInputs.find(d => /front|user|selfie|face|1/i.test(d.label));
    if (frontCamera) {
      console.log(`[GramCare Camera] Selected mobile front camera: "${frontCamera.label}"`);
      return frontCamera;
    }
  }

  return videoInputs[0];
}

/**
 * Executes getUserMedia with a bounded timeout per attempt to prevent infinite hanging.
 */
function getUserMediaWithTimeout(constraints: MediaStreamConstraints, timeoutMs = 5000): Promise<MediaStream> {
  return new Promise((resolve, reject) => {
    let finished = false;
    const timer = setTimeout(() => {
      if (!finished) {
        finished = true;
        const err = new Error(`getUserMedia timed out after ${timeoutMs}ms`);
        err.name = 'TimeoutError';
        reject(err);
      }
    }, timeoutMs);

    navigator.mediaDevices.getUserMedia(constraints)
      .then((stream) => {
        if (!finished) {
          finished = true;
          clearTimeout(timer);
          resolve(stream);
        } else {
          // If resolved after timeout expired, immediately release tracks
          stream.getTracks().forEach((t) => t.stop());
        }
      })
      .catch((err) => {
        if (!finished) {
          finished = true;
          clearTimeout(timer);
          reject(err);
        }
      });
  });
}

/**
 * Automatically requests the camera of the current device running the browser:
 * - On laptops/desktops: selects the locally available integrated/USB webcam, bypassing remote/virtual cameras.
 * - On Android/iPhone/iPad: selects the rear camera for document scanning, supporting front/rear switching.
 */
async function requestCameraStream(
  facing: 'environment' | 'user',
  preferredDeviceId?: string | null
): Promise<MediaStream> {
  const env = detectDeviceEnvironment();
  console.log(`[GramCare Camera] Initiating stream request. Facing: ${facing}, Environment:`, env);

  let targetDeviceId = preferredDeviceId || null;

  // Check existing device enumeration if permissions are already unlocked
  if (!targetDeviceId && typeof navigator !== 'undefined' && navigator.mediaDevices?.enumerateDevices) {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoInputs = devices.filter(d => d.kind === 'videoinput');
      const hasLabels = videoInputs.some(d => d.label && d.label.trim().length > 0);

      if (hasLabels) {
        const bestDevice = findBestCameraDevice(videoInputs, env, facing);
        if (bestDevice && bestDevice.deviceId) {
          targetDeviceId = bestDevice.deviceId;
          console.log(`[GramCare Camera] Pre-selected camera from device list: "${bestDevice.label}" (id: ${targetDeviceId})`);
        }
      }
    } catch {
      // Ignore before permission
    }
  }

  const constraintsList: MediaStreamConstraints[] = [];

  // If a specific local hardware device has been identified:
  if (targetDeviceId) {
    constraintsList.push({
      video: {
        deviceId: { exact: targetDeviceId },
        width: { ideal: env.isMobile ? 1920 : 1280 },
        height: { ideal: env.isMobile ? 1080 : 720 },
      },
      audio: false,
    });
    constraintsList.push({
      video: {
        deviceId: { ideal: targetDeviceId },
      },
      audio: false,
    });
  }

  // Device-specific constraint tiers:
  if (env.isMobile || env.isTablet) {
    // Mobile / Tablet: prioritize rear camera with HD resolution for medical documents
    constraintsList.push({
      video: {
        facingMode: { ideal: facing },
        width: { ideal: 1920, min: 640 },
        height: { ideal: 1080, min: 480 },
      },
      audio: false,
    });
    constraintsList.push({
      video: { facingMode: facing },
      audio: false,
    });
  } else {
    // Desktop / Laptop: standard webcam 1280x720 with 'user' facingMode (avoids 1080p environment stalls on webcams)
    constraintsList.push({
      video: {
        facingMode: { ideal: 'user' },
        width: { ideal: 1280, min: 640 },
        height: { ideal: 720, min: 480 },
      },
      audio: false,
    });
    constraintsList.push({
      video: {
        width: { ideal: 1280, min: 640 },
        height: { ideal: 720, min: 480 },
      },
      audio: false,
    });
  }

  // Universal catch-all fallback
  constraintsList.push({
    video: true,
    audio: false,
  });

  let lastError: any = null;
  for (let i = 0; i < constraintsList.length; i++) {
    try {
      console.log(`[GramCare Camera] Requesting stream via constraint tier #${i + 1}`);
      const stream = await getUserMediaWithTimeout(constraintsList[i], 5000);
      console.log(`[GramCare Camera] Stream acquired via tier #${i + 1}`);

      // Post-acquisition verification on desktop/laptop:
      // If the acquired stream happens to be a remote/virtual camera while a local hardware webcam is present, switch to local.
      if (env.isDesktop && typeof navigator !== 'undefined' && navigator.mediaDevices?.enumerateDevices) {
        const activeTrack = stream.getVideoTracks()[0];
        if (activeTrack && isRemoteOrVirtualCamera(activeTrack.label)) {
          console.warn(`[GramCare Camera] Acquired camera is remote/virtual ("${activeTrack.label}"). Checking for local hardware webcam...`);
          try {
            const allDevices = await navigator.mediaDevices.enumerateDevices();
            const localHardwareDevice = allDevices.find(d => d.kind === 'videoinput' && isLocalWebcam(d.label));
            if (localHardwareDevice && localHardwareDevice.deviceId) {
              console.log(`[GramCare Camera] Switching to local webcam: "${localHardwareDevice.label}"`);
              activeTrack.stop();
              return await getUserMediaWithTimeout({
                video: { deviceId: { exact: localHardwareDevice.deviceId } },
                audio: false,
              }, 5000);
            }
          } catch (switchErr) {
            console.warn('[GramCare Camera] Fallback switch to local webcam failed, keeping current stream:', switchErr);
          }
        }
      }

      return stream;
    } catch (err: any) {
      console.warn(`[GramCare Camera] Tier #${i + 1} failed (${err?.name}):`, err?.message);
      lastError = err;
    }
  }

  throw lastError || new Error('Failed to acquire camera stream with all constraint tiers');
}

export const DocumentScannerScreen: React.FC<DocumentScannerScreenProps> = ({
  activePatientName,
  userProfile,
  onSaveRecord
}) => {
  const { isOnline, backendStatus, isBackendAvailable } = useOnlineStatus();
  const deviceEnv = detectDeviceEnvironment();

  const [docType, setDocType] = useState<'Prescription' | 'Medical Report' | 'Health Record'>('Prescription');

  // Camera state with 8 explicit lifecycle states
  const [cameraState, setCameraState] = useState<CameraLifecycleState>('idle');
  const [cameraError, setCameraError] = useState<CameraError | null>(null);
  const [capturedDataUrl, setCapturedDataUrl] = useState<string | null>(null);
  const [capturedFile, setCapturedFile] = useState<File | null>(null);
  const [capturedPreviewUrl, setCapturedPreviewUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedFilePreview, setSelectedFilePreview] = useState<string | null>(null);

  // Professional Cropping and Adjustment State
  const [isCropModalOpen, setIsCropModalOpen] = useState(false);
  const [cropSourceImage, setCropSourceImage] = useState<string | null>(null);
  const [cropSourceType, setCropSourceType] = useState<'camera' | 'upload'>('camera');
  const [isImageCropped, setIsImageCropped] = useState(false);
  const [rawCapturedFile, setRawCapturedFile] = useState<File | null>(null);
  const [rawCapturedDataUrl, setRawCapturedDataUrl] = useState<string | null>(null);
  const [rawSelectedFile, setRawSelectedFile] = useState<File | null>(null);
  const [rawSelectedPreview, setRawSelectedPreview] = useState<string | null>(null);

  // Computer Vision Document Detection & Perspective Warp State
  const [liveDetection, setLiveDetection] = useState<DetectionResult | null>(null);
  const [liveStatusText, setLiveStatusText] = useState<string>('Searching for document...');
  const [videoDisplayRect, setVideoDisplayRect] = useState<{ width: number; height: number; offsetX: number; offsetY: number }>({ width: 0, height: 0, offsetX: 0, offsetY: 0 });
  const [capturedCorners, setCapturedCorners] = useState<QuadCorners | null>(null);
  const [isPerspectiveCorrected, setIsPerspectiveCorrected] = useState(false);
  const [isCornerAdjustModalOpen, setIsCornerAdjustModalOpen] = useState(false);

  // Default to rear camera on mobile/tablet for scanning documents, or front on desktop/laptop
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>(
    deviceEnv.isMobile || deviceEnv.isTablet ? 'environment' : 'user'
  );
  const [availableVideoDevices, setAvailableVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [hasMultipleCameras, setHasMultipleCameras] = useState(false);
  const [isFrameReady, setIsFrameReady] = useState(false);
  const [_frameStalledWarning, setFrameStalledWarning] = useState(false);
  const [trackMuted, setTrackMuted] = useState(false);
  const [activeCameraLabel, setActiveCameraLabel] = useState<string>('');

  // Full-screen and professional document framing guide state
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [torchAvailable, setTorchAvailable] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [guideOrientation, setGuideOrientation] = useState<'portrait' | 'landscape'>('portrait');

  // Scan state
  const [scanState, setScanState] = useState<ScanState>('idle');
  const [scanResult, setScanResult] = useState<DocumentScanResult | null>(null);
  const [backendResult, setBackendResult] = useState<any>(null);
  const [scanError, setScanError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewUrlRef = useRef<string | null>(null);

  // Concurrency guard and session generation tracking to ignore stale async callbacks
  const isOpeningRef = useRef<boolean>(false);
  const sessionRef = useRef<number>(0);

  const isFeatureAvailable = isOnline && isBackendAvailable;

  // Enumerate camera devices to detect available hardware
  const updateAvailableCameras = useCallback(async () => {
    if (typeof navigator !== 'undefined' && navigator.mediaDevices?.enumerateDevices) {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(d => d.kind === 'videoinput');
        setAvailableVideoDevices(videoDevices);
        setHasMultipleCameras(videoDevices.length > 1);
        console.log(`[GramCare Camera] Available video input devices (${videoDevices.length}):`,
          videoDevices.map(d => ({ label: d.label || '(unlabeled)', deviceId: d.deviceId }))
        );
      } catch (err) {
        console.warn('[GramCare Camera] Error during enumerateDevices:', err);
      }
    }
  }, []);

  useEffect(() => {
    updateAvailableCameras();
  }, [updateAvailableCameras]);

  const stopCameraStream = useCallback(() => {
    if (streamRef.current) {
      console.log('[GramCare Camera] Stopping camera tracks and releasing hardware');
      try {
        streamRef.current.getTracks().forEach((track) => {
          track.stop();
          console.log(`[GramCare Camera] Track ${track.id} (${track.kind}) stopped`);
        });
      } catch (e) {
        console.warn('[GramCare Camera] Error stopping track:', e);
      }
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsFrameReady(false);
    setFrameStalledWarning(false);
    setTrackMuted(false);
    setActiveCameraLabel('');
    setTorchOn(false);
    setTorchAvailable(false);
  }, []);

  const toggleTorch = useCallback(async () => {
    if (!streamRef.current || !torchAvailable) return;
    const track = streamRef.current.getVideoTracks()[0];
    if (!track) return;
    try {
      const nextState = !torchOn;
      await (track as any).applyConstraints({
        advanced: [{ torch: nextState }]
      });
      setTorchOn(nextState);
      console.log(`[GramCare Camera] Flashlight toggled: ${nextState ? 'ON' : 'OFF'}`);
    } catch (err) {
      console.warn('[GramCare Camera] Flashlight toggle failed:', err);
    }
  }, [torchAvailable, torchOn]);

  // Cleanup camera stream and object URLs strictly on component unmount
  useEffect(() => {
    const activeStreamRef = streamRef;
    const activeVideoRef = videoRef;
    const activePreviewRef = previewUrlRef;
    const activeSessionRef = sessionRef;
    const activeOpeningRef = isOpeningRef;

    return () => {
      console.log('[GramCare Camera] Component unmounting: performing complete cleanup');
      activeSessionRef.current++;
      activeOpeningRef.current = false;
      if (activeStreamRef.current) {
        activeStreamRef.current.getTracks().forEach((t) => t.stop());
        activeStreamRef.current = null;
      }
      if (activeVideoRef.current) {
        activeVideoRef.current.srcObject = null;
      }
      if (activePreviewRef.current && activePreviewRef.current.startsWith('blob:')) {
        URL.revokeObjectURL(activePreviewRef.current);
        activePreviewRef.current = null;
      }
    };
  }, []);

  // Master Watchdog Timer: prevents permanent loading if camera startup hangs
  useEffect(() => {
    let watchdogTimer: any = null;
    if (cameraState === 'requesting_permission' || cameraState === 'initializing') {
      watchdogTimer = setTimeout(() => {
        console.warn('[GramCare Camera] Master Watchdog: Camera initialization exceeded 10s timeout');
        stopCameraStream();
        isOpeningRef.current = false;
        setCameraError('timeout');
        setCameraState('error');
      }, 10000);
    }
    return () => {
      if (watchdogTimer) clearTimeout(watchdogTimer);
    };
  }, [cameraState, stopCameraStream]);

  // Synchronize stream with video element when camera is initializing or ready
  useEffect(() => {
    if ((cameraState === 'initializing' || cameraState === 'ready') && videoRef.current && streamRef.current) {
      const video = videoRef.current;
      video.muted = true;
      video.playsInline = true;
      video.autoplay = true;

      if (video.srcObject !== streamRef.current) {
        console.log('[GramCare Camera] Syncing active stream to videoRef.current.srcObject');
        video.srcObject = streamRef.current;
      }

      const playPromise = video.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            console.log(`[GramCare Camera] video.play() resolved. Dimensions: ${video.videoWidth}x${video.videoHeight}`);
            if (video.videoWidth > 0 && video.videoHeight > 0) {
              setIsFrameReady(true);
              setCameraState('ready');
            }
          })
          .catch((err) => {
            console.warn('[GramCare Camera] video.play() warning:', err?.message || err);
          });
      }
    }
  }, [cameraState]);

  // Check if camera stream stalls (no frames received within 5 seconds of ready)
  useEffect(() => {
    let timer: any = null;
    if (cameraState === 'ready') {
      timer = setTimeout(() => {
        if (!isFrameReady && videoRef.current) {
          if (videoRef.current.videoWidth === 0 || videoRef.current.readyState < 2) {
            console.warn('[GramCare Camera] Watchdog: No video frames received within 5s');
            setFrameStalledWarning(true);
          }
        }
      }, 5000);
    } else {
      setFrameStalledWarning(false);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [cameraState, isFrameReady]);

  // Callback ref to attach stream immediately upon video element mount into DOM
  const setVideoRef = useCallback((element: HTMLVideoElement | null) => {
    videoRef.current = element;
    if (element && streamRef.current) {
      console.log('[GramCare Camera] Video element mounted into DOM. Assigning stream.');
      element.muted = true;
      element.playsInline = true;
      element.autoplay = true;
      if (element.srcObject !== streamRef.current) {
        element.srcObject = streamRef.current;
      }
      const playPromise = element.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            console.log(`[GramCare Camera] Ref playback resolved. Dimensions: ${element.videoWidth}x${element.videoHeight}`);
            if (element.videoWidth > 0 && element.videoHeight > 0) {
              setIsFrameReady(true);
              setCameraState('ready');
            }
          })
          .catch((err) => console.warn('[GramCare Camera] Autoplay error in ref:', err?.message || err));
      }
    }
  }, []);

  // Live Automatic Document Detection Loop
  useEffect(() => {
    let intervalId: any = null;
    const offscreenCanvas = document.createElement('canvas');

    if (isFullScreen && cameraState === 'ready' && isFrameReady) {
      intervalId = setInterval(() => {
        const video = videoRef.current;
        if (!video || video.readyState < 2 || video.videoWidth === 0 || video.videoHeight === 0) {
          return;
        }

        // Measure container and video aspect ratio to position overlay precisely over video
        const container = video.parentElement;
        if (container) {
          const containerW = container.clientWidth;
          const containerH = container.clientHeight;
          const videoW = video.videoWidth;
          const videoH = video.videoHeight;
          const videoAspect = videoW / videoH;
          const containerAspect = containerW / containerH;

          let w = containerW;
          let h = containerH;
          let ox = 0;
          let oy = 0;

          if (containerAspect > videoAspect) {
            h = containerH;
            w = containerH * videoAspect;
            ox = (containerW - w) / 2;
          } else {
            w = containerW;
            h = containerW / videoAspect;
            oy = (containerH - h) / 2;
          }
          setVideoDisplayRect({ width: w, height: h, offsetX: ox, offsetY: oy });
        }

        // Use 320px width downsampled canvas for ultra-fast, non-blocking CV analysis
        const detW = 320;
        const detH = Math.round((video.videoHeight / video.videoWidth) * detW) || 240;
        offscreenCanvas.width = detW;
        offscreenCanvas.height = detH;
        const ctx = offscreenCanvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) return;

        try {
          ctx.drawImage(video, 0, 0, detW, detH);
          const result = detectDocumentCorners(offscreenCanvas);
          setLiveDetection(result);

          if (!result.detected || result.confidence < 0.4) {
            setLiveStatusText('Searching for document');
          } else if (result.quality.isLowLight) {
            setLiveStatusText('Move closer or improve lighting');
          } else if (result.quality.isEdgeCutOff) {
            setLiveStatusText('Move closer or fit entire paper in frame');
          } else if (result.quality.isBlurry) {
            setLiveStatusText('Hold steady (Blur detected)');
          } else {
            setLiveStatusText('Document detected');
          }
        } catch (err) {
          console.warn('[GramCare CV] Detection tick error:', err);
        }
      }, 250);
    } else {
      setLiveDetection(null);
      setLiveStatusText('Searching for document');
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [isFullScreen, cameraState, isFrameReady]);

  const openCamera = useCallback(async (
    facing: 'environment' | 'user' = facingMode,
    preferredDeviceId?: string | null
  ) => {
    // Guard against simultaneous duplicate invocations
    if (isOpeningRef.current) {
      console.warn('[GramCare Camera] Camera opening already in progress. Ignoring duplicate invocation.');
      return;
    }
    isOpeningRef.current = true;
    const currentSession = ++sessionRef.current;

    setCameraError(null);
    setScanError(null);
    setFrameStalledWarning(false);
    setIsFrameReady(false);
    setTrackMuted(false);
    setCameraState('requesting_permission');
    setIsFullScreen(true);

    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      console.error('[GramCare Camera] getUserMedia not supported or insecure origin');
      isOpeningRef.current = false;
      setCameraError('insecure');
      setCameraState('error');
      return;
    }

    try {
      stopCameraStream();
      const targetDevId = preferredDeviceId || (selectedDeviceId || null);
      console.log(`[GramCare Camera Session #${currentSession}] Requesting camera stream. Facing: ${facing}, DeviceId: ${targetDevId || 'auto'}`);

      const stream = await requestCameraStream(facing, targetDevId);

      // Verify session is still valid (not cancelled or superseded)
      if (currentSession !== sessionRef.current) {
        console.log(`[GramCare Camera] Session #${currentSession} was cancelled or superseded by #${sessionRef.current}. Releasing stream.`);
        stream.getTracks().forEach((t) => t.stop());
        return;
      }

      streamRef.current = stream;
      setCameraState('initializing');

      // Inspect active video track
      const tracks = stream.getVideoTracks();
      if (tracks.length > 0) {
        const track = tracks[0];
        const settings = track.getSettings ? track.getSettings() : {};
        const label = track.label || (deviceEnv.isMobile ? 'Mobile Camera' : 'Local Webcam');
        setActiveCameraLabel(label);
        if (settings.deviceId) {
          setSelectedDeviceId(settings.deviceId);
        }

        // Detect torch/flashlight capability on device
        try {
          const caps = (track.getCapabilities ? track.getCapabilities() : {}) as any;
          setTorchAvailable(Boolean(caps && typeof caps.torch === 'boolean'));
          setTorchOn(false);
        } catch {
          setTorchAvailable(false);
        }

        console.log(`[GramCare Camera Session #${currentSession}] Active video track inspection:`, {
          label,
          id: track.id,
          readyState: track.readyState,
          enabled: track.enabled,
          muted: track.muted,
          settings: {
            deviceId: settings.deviceId,
            width: settings.width,
            height: settings.height,
            frameRate: settings.frameRate,
            facingMode: settings.facingMode,
          }
        });

        setTrackMuted(track.muted);

        track.onmute = () => {
          console.warn('[GramCare Camera] Track MUTED by hardware/OS. Frames paused.');
          setTrackMuted(true);
        };
        track.onunmute = () => {
          console.log('[GramCare Camera] Track UNMUTED. Frames now streaming.');
          setTrackMuted(false);
          setIsFrameReady(true);
        };
        track.onended = () => {
          console.warn('[GramCare Camera] Track ended unexpectedly by hardware/system.');
          stopCameraStream();
          setCameraError('disconnected');
          setCameraState('error');
        };
      }

      // Refresh camera enumeration once user grants permission
      updateAvailableCameras();

      // If video element is already mounted in DOM, connect and start playback
      if (videoRef.current) {
        const video = videoRef.current;
        video.muted = true;
        video.playsInline = true;
        video.autoplay = true;
        video.srcObject = stream;
        const playPromise = video.play();
        if (playPromise !== undefined) {
          playPromise
            .then(() => {
              if (currentSession !== sessionRef.current) return;
              console.log(`[GramCare Camera] video.play() successful. Dimensions: ${video.videoWidth}x${video.videoHeight}`);
              if (video.videoWidth > 0 && video.videoHeight > 0) {
                setIsFrameReady(true);
                setCameraState('ready');
              }
            })
            .catch((e) => console.warn('[GramCare Camera] Play error:', e?.message || e));
        }
      }
    } catch (err: any) {
      if (currentSession !== sessionRef.current) return;
      stopCameraStream();
      const name = err?.name || '';
      console.warn('[GramCare Camera] Camera access rejected/failed:', name, err?.message);
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        setCameraError('denied');
      } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
        setCameraError('unavailable');
      } else if (name === 'NotReadableError' || name === 'TrackStartError') {
        setCameraError('in_use');
      } else if (name === 'TimeoutError') {
        setCameraError('timeout');
      } else if (name === 'SecurityError') {
        setCameraError('insecure');
      } else {
        setCameraError('unknown');
      }
      setCameraState('error');
    } finally {
      if (currentSession === sessionRef.current) {
        isOpeningRef.current = false;
      }
    }
  }, [facingMode, selectedDeviceId, stopCameraStream, updateAvailableCameras, deviceEnv.isMobile]);

  const switchCamera = useCallback(async () => {
    const next: 'environment' | 'user' = facingMode === 'environment' ? 'user' : 'environment';
    console.log(`[GramCare Camera] Switching camera facing mode to: ${next}`);
    setFacingMode(next);
    stopCameraStream();
    await openCamera(next);
  }, [facingMode, openCamera, stopCameraStream]);

  const switchCameraDevice = useCallback(async (deviceId: string) => {
    console.log(`[GramCare Camera] Switching camera device to deviceId: ${deviceId}`);
    setSelectedDeviceId(deviceId);
    stopCameraStream();
    await openCamera(facingMode, deviceId);
  }, [facingMode, openCamera, stopCameraStream]);

  const capturePhoto = useCallback(async () => {
    console.log('[GramCare Camera] Capture photo triggered');
    if (!streamRef.current || !streamRef.current.active) {
      console.warn('[GramCare Camera] Capture aborted: Stream not active');
      setScanError('Camera stream is not active. Please open the camera again.');
      return;
    }
    const video = videoRef.current;
    if (!video) {
      console.warn('[GramCare Camera] Capture aborted: videoRef is null');
      setScanError('Camera preview element not found.');
      return;
    }

    // Verify video element is ready and dimensions are valid
    console.log(`[GramCare Camera] Capture check: readyState=${video.readyState}, dimensions=${video.videoWidth}x${video.videoHeight}`);
    if (video.readyState < 2 || video.videoWidth === 0 || video.videoHeight === 0) {
      setScanError('Camera feed is still initializing. Please wait a moment and tap capture again.');
      return;
    }

    setCameraState('capturing');
    const width = video.videoWidth;
    const height = video.videoHeight;
    const canvas = canvasRef.current || document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      setScanError('Unable to create canvas context for photo capture.');
      setCameraState('ready');
      return;
    }

    // Draw full resolution video frame onto canvas
    ctx.drawImage(video, 0, 0, width, height);

    const rawDataUrl = canvas.toDataURL('image/jpeg', 0.95);
    const rawFile = dataURLtoFile(rawDataUrl, `gramcare_raw_${Date.now()}.jpg`);
    setRawCapturedDataUrl(rawDataUrl);
    setRawCapturedFile(rawFile);

    // Stop camera hardware immediately after video frame is captured to release device lock
    stopCameraStream();

    // Run automatic document corner detection and perspective warp
    try {
      const detection = detectDocumentCorners(canvas);
      console.log('[GramCare CV] Captured frame detection result:', detection);

      const fallbackCorners: QuadCorners = {
        topLeft: { x: Math.round(width * 0.08), y: Math.round(height * 0.08) },
        topRight: { x: Math.round(width * 0.92), y: Math.round(height * 0.08) },
        bottomRight: { x: Math.round(width * 0.92), y: Math.round(height * 0.92) },
        bottomLeft: { x: Math.round(width * 0.08), y: Math.round(height * 0.92) },
      };

      if (detection.detected && detection.quad && detection.confidence >= 0.55) {
        console.log('[GramCare CV] Reliable document detected. Applying perspective warp...');
        setCapturedCorners(detection.quad);

        // Apply perspective transformation to produce flat rectangular document
        const warped = await warpPerspective(canvas, detection.quad);

        if (previewUrlRef.current && previewUrlRef.current.startsWith('blob:')) {
          URL.revokeObjectURL(previewUrlRef.current);
        }
        const previewUrl = URL.createObjectURL(warped.blob);
        previewUrlRef.current = previewUrl;

        setCapturedFile(warped.file);
        setCapturedDataUrl(warped.dataUrl);
        setCapturedPreviewUrl(previewUrl);
        setIsPerspectiveCorrected(true);
        setIsImageCropped(true);
      } else {
        console.log('[GramCare CV] Detection confidence low (<0.55). Preserving unwarped photo for manual adjustment.');
        setCapturedCorners(detection.quad || fallbackCorners);

        if (previewUrlRef.current && previewUrlRef.current.startsWith('blob:')) {
          URL.revokeObjectURL(previewUrlRef.current);
        }
        const previewUrl = URL.createObjectURL(rawFile);
        previewUrlRef.current = previewUrl;

        setCapturedFile(rawFile);
        setCapturedDataUrl(rawDataUrl);
        setCapturedPreviewUrl(previewUrl);
        setIsPerspectiveCorrected(false);
        setIsImageCropped(false);
      }
    } catch (cvErr) {
      console.warn('[GramCare CV] Perspective warp error on capture:', cvErr);
      setCapturedCorners({
        topLeft: { x: Math.round(width * 0.08), y: Math.round(height * 0.08) },
        topRight: { x: Math.round(width * 0.92), y: Math.round(height * 0.08) },
        bottomRight: { x: Math.round(width * 0.92), y: Math.round(height * 0.92) },
        bottomLeft: { x: Math.round(width * 0.08), y: Math.round(height * 0.92) },
      });
      setCapturedFile(rawFile);
      setCapturedDataUrl(rawDataUrl);
      setCapturedPreviewUrl(rawDataUrl);
      setIsPerspectiveCorrected(false);
      setIsImageCropped(false);
    }

    setCameraState('captured');
    setScanError(null);
  }, [stopCameraStream]);

  const handleRotateCaptured = useCallback(async (degrees: number) => {
    const isCamera = cameraState === 'captured' || isFullScreen;
    const currentSrc = isCamera
      ? (capturedDataUrl || capturedPreviewUrl)
      : (selectedFilePreview || (selectedFile ? URL.createObjectURL(selectedFile) : null));

    if (!currentSrc) return;

    try {
      const rotated = await rotateImage90(currentSrc, degrees);
      if (isCamera) {
        if (previewUrlRef.current && previewUrlRef.current.startsWith('blob:')) {
          URL.revokeObjectURL(previewUrlRef.current);
        }
        const previewUrl = URL.createObjectURL(rotated.blob);
        previewUrlRef.current = previewUrl;
        setCapturedFile(rotated.file);
        setCapturedDataUrl(rotated.dataUrl);
        setCapturedPreviewUrl(previewUrl);
        setIsImageCropped(true);
      } else {
        setSelectedFile(rotated.file);
        setSelectedFilePreview(rotated.dataUrl);
        setIsImageCropped(true);
      }
    } catch (err) {
      console.warn('[GramCare Scanner] Rotation error:', err);
    }
  }, [cameraState, isFullScreen, capturedDataUrl, capturedPreviewUrl, selectedFilePreview, selectedFile]);

  const handleApplyAdjustedCorners = useCallback(async (quad: QuadCorners) => {
    const isCamera = cameraState === 'captured' || isFullScreen;
    const src = isCamera
      ? (rawCapturedDataUrl || capturedDataUrl || capturedPreviewUrl)
      : (rawSelectedPreview || selectedFilePreview);

    if (!src) {
      setScanError('Unable to apply perspective correction: image source not found.');
      return;
    }

    try {
      const warped = await warpPerspective(src, quad);
      if (isCamera) {
        if (previewUrlRef.current && previewUrlRef.current.startsWith('blob:')) {
          URL.revokeObjectURL(previewUrlRef.current);
        }
        const previewUrl = URL.createObjectURL(warped.blob);
        previewUrlRef.current = previewUrl;
        setCapturedFile(warped.file);
        setCapturedDataUrl(warped.dataUrl);
        setCapturedPreviewUrl(previewUrl);
        setCapturedCorners(quad);
        setIsPerspectiveCorrected(true);
        setIsImageCropped(true);
      } else {
        setSelectedFile(warped.file);
        setSelectedFilePreview(warped.dataUrl);
        setCapturedCorners(quad);
        setIsPerspectiveCorrected(true);
        setIsImageCropped(true);
      }
      setIsCornerAdjustModalOpen(false);
    } catch (err: any) {
      console.error('[GramCare Scanner] Corner adjustment error:', err);
      setScanError('Failed to apply perspective correction to document.');
    }
  }, [cameraState, isFullScreen, rawCapturedDataUrl, capturedDataUrl, capturedPreviewUrl, rawSelectedPreview, selectedFilePreview]);

  const retakePhoto = useCallback(() => {
    console.log('[GramCare Camera] Retaking photo');
    if (previewUrlRef.current && previewUrlRef.current.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
    setCapturedFile(null);
    setCapturedDataUrl(null);
    setCapturedPreviewUrl(null);
    setRawCapturedFile(null);
    setRawCapturedDataUrl(null);
    setCapturedCorners(null);
    setIsPerspectiveCorrected(false);
    setIsCornerAdjustModalOpen(false);
    setIsImageCropped(false);
    openCamera();
  }, [openCamera]);

  const confirmCapturedPhoto = useCallback(() => {
    console.log('[GramCare Camera] User confirmed captured photo');
    if (!capturedFile && !capturedDataUrl) return;
    const file = capturedFile || (capturedDataUrl ? dataURLtoFile(capturedDataUrl, `gramcare_scan_${Date.now()}.jpg`) : null);
    if (!file) return;

    setSelectedFile(file);
    setSelectedFilePreview(capturedPreviewUrl || capturedDataUrl);
    setRawSelectedFile(rawCapturedFile || file);
    setRawSelectedPreview(rawCapturedDataUrl || capturedDataUrl || capturedPreviewUrl);
    setIsFullScreen(false);
    setCameraState('idle');
  }, [capturedFile, capturedDataUrl, capturedPreviewUrl, rawCapturedFile, rawCapturedDataUrl]);

  const closeCamera = useCallback(() => {
    console.log('[GramCare Camera] Closing camera preview');
    sessionRef.current++;
    isOpeningRef.current = false;
    stopCameraStream();
    if (previewUrlRef.current && previewUrlRef.current.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
    setCameraState('stopped');
    setCameraError(null);
    setCapturedFile(null);
    setCapturedDataUrl(null);
    setCapturedPreviewUrl(null);
    setCapturedCorners(null);
    setIsPerspectiveCorrected(false);
    setIsCornerAdjustModalOpen(false);
    setLiveDetection(null);
    setIsFrameReady(false);
    setFrameStalledWarning(false);
    setTrackMuted(false);
    setActiveCameraLabel('');
    setIsFullScreen(false);
    setTorchOn(false);
    setTimeout(() => {
      setCameraState('idle');
    }, 50);
  }, [stopCameraStream]);

  // Global Keyboard Shortcuts (Space to capture, Esc to exit, Enter to use, R to retake)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isCameraActive = ['requesting_permission', 'initializing', 'ready', 'capturing', 'captured', 'error'].includes(cameraState);
      if (!isCameraActive) return;

      const target = e.target as HTMLElement;
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;

      if (e.code === 'Space' && cameraState === 'ready' && isFrameReady) {
        e.preventDefault();
        capturePhoto();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        closeCamera();
      } else if (e.key === 'Enter' && cameraState === 'captured') {
        e.preventDefault();
        confirmCapturedPhoto();
      } else if ((e.key === 'r' || e.key === 'R') && cameraState === 'captured') {
        e.preventDefault();
        retakePhoto();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cameraState, isFrameReady, capturePhoto, closeCamera, confirmCapturedPhoto, retakePhoto]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      setScanError('Unsupported file type. Please select a JPG, PNG, or PDF file.');
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      setScanError('File is too large. Maximum size is 15 MB.');
      return;
    }
    setScanError(null);
    closeCamera();
    setSelectedFile(file);
    setRawSelectedFile(file);
    setIsImageCropped(false);
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = () => {
        const resultUrl = reader.result as string;
        setSelectedFilePreview(resultUrl);
        setRawSelectedPreview(resultUrl);
      };
      reader.readAsDataURL(file);
    } else {
      setSelectedFilePreview(null);
      setRawSelectedPreview(null);
    }
    e.target.value = '';
  };

  const clearSelection = () => {
    if (previewUrlRef.current && previewUrlRef.current.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
    stopCameraStream();
    setCapturedFile(null);
    setCapturedPreviewUrl(null);
    setSelectedFile(null);
    setSelectedFilePreview(null);
    setCapturedDataUrl(null);
    setRawCapturedFile(null);
    setRawCapturedDataUrl(null);
    setRawSelectedFile(null);
    setRawSelectedPreview(null);
    setIsImageCropped(false);
    setIsCropModalOpen(false);
    setCropSourceImage(null);
    setScanError(null);
    setScanResult(null);
    setBackendResult(null);
    setCameraState('idle');
    setScanState('idle');
  };

  const handleOpenCropModal = (source: 'camera' | 'upload') => {
    setCropSourceType(source);
    const src =
      source === 'camera'
        ? (rawCapturedDataUrl || capturedDataUrl || capturedPreviewUrl)
        : (rawSelectedPreview || selectedFilePreview);

    if (src) {
      setCropSourceImage(src);
      setIsCropModalOpen(true);
    } else {
      setScanError('Unable to open crop editor: image source not found.');
    }
  };

  const handleApplyCropResult = (result: CropResult) => {
    if (cropSourceType === 'camera') {
      setCapturedFile(result.file);
      setCapturedDataUrl(result.dataUrl);
      setCapturedPreviewUrl(result.dataUrl);
      setIsImageCropped(true);
    } else {
      setSelectedFile(result.file);
      setSelectedFilePreview(result.dataUrl);
      setIsImageCropped(true);
    }
    setIsCropModalOpen(false);
  };

  const handleResetToOriginal = (source: 'camera' | 'upload') => {
    if (source === 'camera') {
      if (rawCapturedDataUrl) {
        setCapturedDataUrl(rawCapturedDataUrl);
        setCapturedPreviewUrl(rawCapturedDataUrl);
        setCapturedFile(rawCapturedFile);
        setIsImageCropped(false);
      }
    } else {
      if (rawSelectedPreview) {
        setSelectedFilePreview(rawSelectedPreview);
        setSelectedFile(rawSelectedFile);
        setIsImageCropped(false);
      }
    }
  };

  const handleScan = async () => {
    if (!isFeatureAvailable) return;
    setScanError(null);
    setScanState('scanning');

    try {
      let fileToUpload: File | null = null;

      if (capturedFile) {
        fileToUpload = capturedFile;
      } else if (capturedDataUrl) {
        fileToUpload = dataURLtoFile(capturedDataUrl, `gramcare_scan_${Date.now()}.jpg`);
      } else if (selectedFile) {
        fileToUpload = selectedFile;
      } else {
        setScanError('Please capture a photo or select a file first.');
        setScanState('idle');
        return;
      }

      const result = await uploadDocumentFile(fileToUpload, docType, activePatientName);

      if (!result) {
        throw new Error('No response from server');
      }

      setBackendResult(result);

      if (result.success || result.ocr_performed) {
        const currentPreview = capturedDataUrl || capturedPreviewUrl || selectedFilePreview || undefined;
        const mapped: DocumentScanResult = {
          id: `scan_${Date.now()}`,
          docType: result.doc_type || docType,
          extractedPatientName: result.extracted_patient_name || activePatientName,
          doctorOrLabName: result.doctor_or_lab_name || '',
          date: result.date || new Date().toISOString().split('T')[0],
          keyFindings: result.key_findings || [],
          medicationsMentioned: result.medications_mentioned || [],
          rawTextPreview: result.follow_up_instructions || result.raw_extracted_text || '',
          scanImageUrl: currentPreview,
          patientDetails: result.patient_details,
          reportDetails: result.report_details,
          testPanels: result.test_panels,
          narrativeSections: result.narrative_sections,
          abnormalAlerts: result.abnormal_alerts,
          aiSummary: result.ai_summary,
          extractionStatus: result.extraction_status,
          rawBackendJson: result,
        };
        setScanResult(mapped);
        setScanState('done');
      } else {
        setScanState('done');
      }
    } catch (err: any) {
      console.error('[GramCare Scanner] Scan error:', err);
      const msg = err?.message || 'Document processing failed';
      if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) {
        setScanError('Unable to reach GramCare server. Please check your connection or ensure backend is running.');
      } else {
        setScanError(msg);
      }
      setScanState('error');
    }
  };

  const hasFileSelected = Boolean(capturedFile || selectedFile || capturedDataUrl);

  const cardStyle: React.CSSProperties = {
    backgroundColor: '#ffffff',
    border: '1.5px solid #e2e8f0',
    borderRadius: '16px',
    padding: '20px',
    marginBottom: '16px',
  };

  const captureAreaStyle: React.CSSProperties = {
    border: '2px dashed #94a3b8',
    borderRadius: '14px',
    backgroundColor: '#f8fafc',
    overflow: 'hidden',
    position: 'relative',
    minHeight: '280px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '16px',
  };

  // Structured scan result view - Multispeciality Hospital Report
  if (scanResult && scanState === 'done') {
    return (
      <HospitalMedicalReport
        scanResult={scanResult}
        backendResult={backendResult}
        userProfile={userProfile}
        activePatientName={activePatientName}
        capturedImageUrl={capturedDataUrl || capturedPreviewUrl || selectedFilePreview}
        onSaveRecord={(record) => {
          onSaveRecord(record);
        }}
        onScanAnother={clearSelection}
      />
    );
  }

  // Message-only result (e.g. PDF guidance or unreadable OCR)
  if (scanState === 'done' && backendResult && !scanResult) {
    return (
      <div>
        <div style={{ marginBottom: '16px' }}>
          <h2 style={{ fontSize: '22px', color: '#0f766e', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
            <ScanLine size={24} />Health Document Scanner
          </h2>
        </div>
        <div style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '16px' }}>
            <AlertCircle size={22} color="#c2410c" style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>
              <div style={{ fontWeight: 700, color: '#9a3412', marginBottom: '6px' }}>Scanning Notice</div>
              <div style={{ fontSize: '14px', color: '#c2410c', lineHeight: 1.5 }}>{backendResult.message}</div>
            </div>
          </div>
          <SecondaryButton onClick={clearSelection}>Try Again</SecondaryButton>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Title */}
      <div style={{ marginBottom: '16px' }}>
        <h2 style={{ fontSize: '22px', color: '#0f766e', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
          <ScanLine size={24} />
          Health Document Scanner
        </h2>
        <p style={{ fontSize: '13px', color: '#64748b', margin: '4px 0 0' }}>
          Capture or upload prescriptions, lab reports and health documents for AI analysis.
        </p>
      </div>

      {/* Offline banner */}
      {!isOnline && (
        <div style={{ backgroundColor: '#fef2f2', border: '1.5px solid #fca5a5', borderRadius: '12px', padding: '14px 16px', marginBottom: '16px', display: 'flex', gap: '12px' }}>
          <WifiOff size={22} color="#dc2626" style={{ flexShrink: 0, marginTop: '2px' }} />
          <div>
            <h4 style={{ margin: 0, fontSize: '14px', color: '#991b1b', fontWeight: 700 }}>You're Currently Offline</h4>
            <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#b91c1c', lineHeight: 1.4 }}>
              Connect to the internet to use the document scanner.
            </p>
          </div>
        </div>
      )}

      {/* Backend unreachable */}
      {isOnline && backendStatus === 'UNREACHABLE' && (
        <div style={{ backgroundColor: '#fff7ed', border: '1.5px solid #fed7aa', borderRadius: '12px', padding: '14px 16px', marginBottom: '16px', display: 'flex', gap: '12px' }}>
          <AlertTriangle size={22} color="#c2410c" style={{ flexShrink: 0, marginTop: '2px' }} />
          <div>
            <h4 style={{ margin: 0, fontSize: '14px', color: '#9a3412', fontWeight: 700 }}>GramCare Server Unreachable</h4>
            <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#c2410c', lineHeight: 1.4 }}>
              The scanning service is temporarily unavailable. Please verify the backend server is running on port 8000.
            </p>
          </div>
        </div>
      )}

      {/* Scan error banner */}
      {scanError && (
        <div style={{ backgroundColor: '#fef2f2', border: '1.5px solid #fca5a5', borderRadius: '12px', padding: '12px 14px', marginBottom: '16px', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
          <AlertCircle size={18} color="#dc2626" style={{ flexShrink: 0, marginTop: '2px' }} />
          <div style={{ fontSize: '13px', color: '#991b1b', flex: 1 }}>{scanError}</div>
          <button onClick={() => setScanError(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: '#991b1b' }}>
            <X size={16} />
          </button>
        </div>
      )}

      <div style={cardStyle}>
        {/* Document type selection */}
        <label style={{ fontSize: '13px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '8px' }}>Document Type:</label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '20px' }}>
          {(['Prescription', 'Medical Report', 'Health Record'] as const).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setDocType(type)}
              style={{
                padding: '8px 4px',
                borderRadius: '8px',
                border: `1.5px solid ${docType === type ? '#0f766e' : '#cbd5e1'}`,
                backgroundColor: docType === type ? '#f0fdf4' : '#ffffff',
                color: docType === type ? '#0f766e' : '#475569',
                fontWeight: docType === type ? 700 : 500,
                fontSize: '12px',
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              {type}
            </button>
          ))}
        </div>

        {/* ── FULL-SCREEN DOCUMENT SCANNER MODAL OVERLAY ── */}
        {isFullScreen && ['requesting_permission', 'initializing', 'ready', 'capturing', 'captured', 'error'].includes(cameraState) && (
          <div style={{
            position: 'fixed',
            inset: 0,
            zIndex: 99999,
            backgroundColor: '#050c14',
            display: 'flex',
            flexDirection: 'column',
            width: '100vw',
            height: '100vh',
            overflow: 'hidden',
            userSelect: 'none',
          }}>
            {/* 1. Header Bar Overlay (Visible during live feed or error) */}
            {cameraState !== 'captured' && (
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                padding: '16px 20px',
                background: 'linear-gradient(to bottom, rgba(5, 12, 20, 0.92) 0%, rgba(5, 12, 20, 0) 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
                zIndex: 40,
              }}>
                {/* Left: GramCare Badge & Document Category Tag */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{
                    backgroundColor: '#0f766e',
                    color: '#fff',
                    padding: '6px 14px',
                    borderRadius: '20px',
                    fontSize: '12px',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: '0 2px 10px rgba(15, 118, 110, 0.4)',
                  }}>
                    <ScanLine size={15} />
                    <span>{docType}</span>
                  </div>

                  {activeCameraLabel && availableVideoDevices.length <= 1 && (
                    <div style={{
                      backgroundColor: 'rgba(15, 23, 42, 0.75)',
                      color: '#e2e8f0',
                      padding: '5px 10px',
                      borderRadius: '16px',
                      fontSize: '11px',
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      backdropFilter: 'blur(4px)',
                    }}>
                      <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#22c55e' }} />
                      <span style={{ maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{activeCameraLabel}</span>
                    </div>
                  )}

                  {availableVideoDevices.length > 1 && (
                    <select
                      value={selectedDeviceId}
                      onChange={(e) => switchCameraDevice(e.target.value)}
                      style={{
                        backgroundColor: 'rgba(15, 23, 42, 0.85)',
                        color: '#f8fafc',
                        border: '1px solid rgba(255, 255, 255, 0.25)',
                        borderRadius: '8px',
                        padding: '5px 10px',
                        fontSize: '11px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        outline: 'none',
                        maxWidth: '180px',
                        textOverflow: 'ellipsis',
                      }}
                      aria-label="Select camera device"
                    >
                      {availableVideoDevices.map((d, i) => (
                        <option key={d.deviceId || i} value={d.deviceId} style={{ backgroundColor: '#0f172a', color: '#fff' }}>
                          {d.label || `Camera ${i + 1}`}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {/* Center: Instruction badge */}
                <div style={{
                  backgroundColor: 'rgba(15, 23, 42, 0.8)',
                  border: '1px solid rgba(20, 184, 166, 0.4)',
                  color: '#f1f5f9',
                  padding: '6px 16px',
                  borderRadius: '20px',
                  fontSize: '12px',
                  fontWeight: 600,
                  backdropFilter: 'blur(6px)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: '0 2px 10px rgba(0,0,0,0.3)',
                }}>
                  <span style={{ color: '#14b8a6', fontSize: '10px' }}>●</span>
                  <span>Align the entire document within the frame</span>
                </div>

                {/* Right: Controls (Orientation toggle, Torch, Exit) */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {/* A4 Orientation Toggle Button */}
                  <button
                    type="button"
                    onClick={() => setGuideOrientation(prev => prev === 'portrait' ? 'landscape' : 'portrait')}
                    title={`Switch to ${guideOrientation === 'portrait' ? 'Landscape' : 'Portrait'} A4 Guide`}
                    style={{
                      backgroundColor: 'rgba(15, 23, 42, 0.75)',
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                      borderRadius: '20px',
                      padding: '5px 12px',
                      color: '#e2e8f0',
                      fontSize: '11px',
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      cursor: 'pointer',
                      backdropFilter: 'blur(4px)',
                    }}
                  >
                    <RefreshCw size={13} />
                    <span>{guideOrientation === 'portrait' ? 'A4 Portrait' : 'A4 Landscape'}</span>
                  </button>

                  {/* Torch / Flash Toggle Button */}
                  {torchAvailable && (
                    <button
                      type="button"
                      onClick={toggleTorch}
                      title={torchOn ? 'Turn Flashlight OFF' : 'Turn Flashlight ON'}
                      style={{
                        backgroundColor: torchOn ? '#eab308' : 'rgba(15, 23, 42, 0.75)',
                        color: torchOn ? '#000' : '#fff',
                        border: '1px solid rgba(255, 255, 255, 0.2)',
                        borderRadius: '50%',
                        width: '36px',
                        height: '36px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        backdropFilter: 'blur(4px)',
                      }}
                    >
                      {torchOn ? <Zap size={16} /> : <ZapOff size={16} />}
                    </button>
                  )}

                  {/* Close / Exit Fullscreen Button */}
                  <button
                    type="button"
                    onClick={closeCamera}
                    title="Exit Full Screen (Esc)"
                    style={{
                      backgroundColor: 'rgba(239, 68, 68, 0.85)',
                      border: 'none',
                      borderRadius: '50%',
                      width: '36px',
                      height: '36px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#fff',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>
            )}

            {/* 2. Main Center Viewport */}
            {cameraState !== 'captured' && (
              <div style={{
                flex: 1,
                position: 'relative',
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                backgroundColor: '#050c14',
              }}>
                <video
                  ref={setVideoRef}
                  autoPlay
                  playsInline
                  muted
                  onLoadedMetadata={(e) => {
                    const video = e.currentTarget;
                    console.log(`[GramCare Camera] Event 'loadedmetadata': ${video.videoWidth}x${video.videoHeight}, readyState=${video.readyState}`);
                    if (video.videoWidth > 0 && video.videoHeight > 0) {
                      setIsFrameReady(true);
                      setFrameStalledWarning(false);
                      setCameraState('ready');
                    }
                    const p = video.play();
                    if (p !== undefined) {
                      p.catch((err) => console.warn('[GramCare Camera] Play error in metadata:', err));
                    }
                  }}
                  onCanPlay={(e) => {
                    const video = e.currentTarget;
                    console.log(`[GramCare Camera] Event 'canplay': readyState=${video.readyState}, ${video.videoWidth}x${video.videoHeight}`);
                    if (video.videoWidth > 0 && video.videoHeight > 0) {
                      setIsFrameReady(true);
                      setCameraState('ready');
                    }
                  }}
                  onPlaying={(e) => {
                    const video = e.currentTarget;
                    console.log(`[GramCare Camera] Event 'playing': ${video.videoWidth}x${video.videoHeight}, readyState=${video.readyState}`);
                    if (video.videoWidth > 0 && video.videoHeight > 0) {
                      setIsFrameReady(true);
                      setFrameStalledWarning(false);
                    }
                    setCameraState('ready');
                  }}
                  onStalled={() => {
                    console.warn('[GramCare Camera] Event "stalled": stream data stalled');
                  }}
                  onWaiting={() => {
                    console.warn('[GramCare Camera] Event "waiting": awaiting camera data');
                  }}
                  onError={(e) => {
                    const err = e.currentTarget.error;
                    console.error('[GramCare Camera] Video element playback error:', err?.message || err);
                    setCameraError('playback');
                    setCameraState('error');
                  }}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'contain',
                    display: 'block',
                    backgroundColor: '#000',
                  }}
                />

                {/* ── Document Framing Guide Overlay (A4 Aspect Ratio) ── */}
                {cameraState === 'ready' && (
                  <div style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    pointerEvents: 'none',
                    zIndex: 20,
                  }}>
                    <div style={{
                      position: 'relative',
                      width: guideOrientation === 'portrait' ? 'min(76vw, 440px)' : 'min(86vw, 680px)',
                      aspectRatio: guideOrientation === 'portrait' ? '1 / 1.414' : '1.414 / 1',
                      maxHeight: guideOrientation === 'portrait' ? '68vh' : '62vh',
                      boxShadow: '0 0 0 9999px rgba(5, 12, 20, 0.52)',
                      border: '1.5px dashed rgba(20, 184, 166, 0.45)',
                      borderRadius: '12px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'flex-end',
                      padding: '16px',
                      transition: 'all 0.25s ease-in-out',
                    }}>
                      {/* Four L-Shaped Corner Alignment Markers */}
                      <div style={{
                        position: 'absolute',
                        top: '-2px',
                        left: '-2px',
                        width: '34px',
                        height: '34px',
                        borderTop: '4px solid #14b8a6',
                        borderLeft: '4px solid #14b8a6',
                        borderTopLeftRadius: '10px',
                        filter: 'drop-shadow(0 0 6px rgba(20, 184, 166, 0.7))',
                      }} />
                      <div style={{
                        position: 'absolute',
                        top: '-2px',
                        right: '-2px',
                        width: '34px',
                        height: '34px',
                        borderTop: '4px solid #14b8a6',
                        borderRight: '4px solid #14b8a6',
                        borderTopRightRadius: '10px',
                        filter: 'drop-shadow(0 0 6px rgba(20, 184, 166, 0.7))',
                      }} />
                      <div style={{
                        position: 'absolute',
                        bottom: '-2px',
                        left: '-2px',
                        width: '34px',
                        height: '34px',
                        borderBottom: '4px solid #14b8a6',
                        borderLeft: '4px solid #14b8a6',
                        borderBottomLeftRadius: '10px',
                        filter: 'drop-shadow(0 0 6px rgba(20, 184, 166, 0.7))',
                      }} />
                      <div style={{
                        position: 'absolute',
                        bottom: '-2px',
                        right: '-2px',
                        width: '34px',
                        height: '34px',
                        borderBottom: '4px solid #14b8a6',
                        borderRight: '4px solid #14b8a6',
                        borderBottomRightRadius: '10px',
                        filter: 'drop-shadow(0 0 6px rgba(20, 184, 166, 0.7))',
                      }} />

                      {/* Reminder inside the document guide */}
                      <div style={{
                        backgroundColor: 'rgba(15, 23, 42, 0.8)',
                        color: '#e2e8f0',
                        padding: '6px 14px',
                        borderRadius: '16px',
                        fontSize: '11px',
                        fontWeight: 600,
                        border: '1px solid rgba(255, 255, 255, 0.15)',
                        backdropFilter: 'blur(4px)',
                        textAlign: 'center',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
                      }}>
                        Ensure all four corners are visible and the text is readable.
                      </div>
                    </div>
                  </div>
                )}

                {/* ── Real-Time Automatic Document Detection Teal Outline ── */}
                {cameraState === 'ready' && videoDisplayRect.width > 0 && liveDetection?.detected && liveDetection.normalizedQuad && (
                  <svg
                    viewBox="0 0 1000 1000"
                    style={{
                      position: 'absolute',
                      left: `${videoDisplayRect.offsetX}px`,
                      top: `${videoDisplayRect.offsetY}px`,
                      width: `${videoDisplayRect.width}px`,
                      height: `${videoDisplayRect.height}px`,
                      pointerEvents: 'none',
                      zIndex: 22,
                      transition: 'all 0.15s ease-out',
                    }}
                  >
                    {/* Teal outline around detected paper document */}
                    <polygon
                      points={`
                        ${liveDetection.normalizedQuad.topLeft.x * 1000},${liveDetection.normalizedQuad.topLeft.y * 1000}
                        ${liveDetection.normalizedQuad.topRight.x * 1000},${liveDetection.normalizedQuad.topRight.y * 1000}
                        ${liveDetection.normalizedQuad.bottomRight.x * 1000},${liveDetection.normalizedQuad.bottomRight.y * 1000}
                        ${liveDetection.normalizedQuad.bottomLeft.x * 1000},${liveDetection.normalizedQuad.bottomLeft.y * 1000}
                      `}
                      fill="rgba(20, 184, 166, 0.18)"
                      stroke="#14b8a6"
                      strokeWidth="4"
                      strokeLinejoin="round"
                      strokeDasharray="12 6"
                    />
                    {/* Corner circular markers with halo */}
                    {[
                      liveDetection.normalizedQuad.topLeft,
                      liveDetection.normalizedQuad.topRight,
                      liveDetection.normalizedQuad.bottomRight,
                      liveDetection.normalizedQuad.bottomLeft,
                    ].map((pt, idx) => (
                      <g key={idx}>
                        <circle
                          cx={pt.x * 1000}
                          cy={pt.y * 1000}
                          r="10"
                          fill="#14b8a6"
                          stroke="#ffffff"
                          strokeWidth="3"
                        />
                        <circle
                          cx={pt.x * 1000}
                          cy={pt.y * 1000}
                          r="18"
                          fill="none"
                          stroke="#14b8a6"
                          strokeWidth="1.5"
                          opacity="0.6"
                        />
                      </g>
                    ))}
                  </svg>
                )}

                {/* ── Real-Time Document Detection Guidance Status Pill ── */}
                {cameraState === 'ready' && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '72px',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      backgroundColor: liveDetection?.detected
                        ? (liveDetection.quality.isLowLight || liveDetection.quality.isBlurry || liveDetection.quality.isEdgeCutOff
                          ? 'rgba(217, 119, 6, 0.92)'
                          : 'rgba(15, 118, 110, 0.92)')
                        : 'rgba(15, 23, 42, 0.85)',
                      border: `1.5px solid ${
                        liveDetection?.detected
                          ? (liveDetection.quality.isLowLight || liveDetection.quality.isBlurry || liveDetection.quality.isEdgeCutOff
                            ? '#f59e0b'
                            : '#2dd4bf')
                          : 'rgba(255, 255, 255, 0.2)'
                      }`,
                      color: '#ffffff',
                      padding: '7px 18px',
                      borderRadius: '24px',
                      fontSize: '12px',
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      zIndex: 35,
                      boxShadow: '0 4px 16px rgba(0, 0, 0, 0.4)',
                      backdropFilter: 'blur(6px)',
                      transition: 'all 0.2s ease',
                      maxWidth: '90vw',
                      textAlign: 'center',
                    }}
                  >
                    <div
                      style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        backgroundColor: liveDetection?.detected
                          ? (liveDetection.quality.isLowLight || liveDetection.quality.isBlurry || liveDetection.quality.isEdgeCutOff
                            ? '#fef08a'
                            : '#4ade80')
                          : '#94a3b8',
                        boxShadow: liveDetection?.detected ? '0 0 8px currentColor' : 'none',
                        flexShrink: 0,
                      }}
                    />
                    <span>{liveStatusText}</span>
                  </div>
                )}

                {/* Connecting overlay: requesting_permission */}
                {cameraState === 'requesting_permission' && (
                  <div style={{
                    position: 'absolute',
                    inset: 0,
                    backgroundColor: 'rgba(15, 23, 42, 0.92)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fff',
                    zIndex: 25,
                    padding: '20px',
                    textAlign: 'center',
                  }}>
                    <Loader2 size={40} style={{ animation: 'spin 1s linear infinite', marginBottom: '14px', color: '#14b8a6' }} />
                    <p style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>Requesting Camera Access...</p>
                    <p style={{ margin: '8px 0 0', fontSize: '13px', color: '#94a3b8' }}>Please allow camera permission in your browser prompt</p>
                  </div>
                )}

                {/* Connecting overlay: initializing */}
                {cameraState === 'initializing' && (
                  <div style={{
                    position: 'absolute',
                    inset: 0,
                    backgroundColor: 'rgba(15, 23, 42, 0.90)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fff',
                    zIndex: 25,
                    padding: '20px',
                    textAlign: 'center',
                  }}>
                    <Loader2 size={40} style={{ animation: 'spin 1s linear infinite', marginBottom: '14px', color: '#14b8a6' }} />
                    <p style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>Starting Your Camera...</p>
                    <p style={{ margin: '8px 0 0', fontSize: '13px', color: '#94a3b8' }}>Connecting live video feed...</p>
                  </div>
                )}

                {/* Connecting overlay: capturing */}
                {cameraState === 'capturing' && (
                  <div style={{
                    position: 'absolute',
                    inset: 0,
                    backgroundColor: 'rgba(15, 23, 42, 0.85)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fff',
                    zIndex: 30,
                  }}>
                    <Loader2 size={42} style={{ animation: 'spin 1s linear infinite', marginBottom: '12px', color: '#14b8a6' }} />
                    <p style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>Capturing Document Photo...</p>
                  </div>
                )}

                {/* Hardware Track Muted Alert */}
                {cameraState === 'ready' && trackMuted && (
                  <div style={{
                    position: 'absolute',
                    top: '70px',
                    left: '20px',
                    right: '20px',
                    maxWidth: '480px',
                    margin: '0 auto',
                    backgroundColor: 'rgba(254, 242, 242, 0.95)',
                    border: '1.5px solid #ef4444',
                    borderRadius: '10px',
                    padding: '10px 14px',
                    fontSize: '12px',
                    color: '#991b1b',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    zIndex: 25,
                    boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
                  }}>
                    <AlertCircle size={18} color="#dc2626" style={{ flexShrink: 0 }} />
                    <div>
                      <div style={{ fontWeight: 700 }}>Camera hardware frames paused</div>
                      <div>If your device has a physical webcam privacy slider switch, slide it open.</div>
                    </div>
                  </div>
                )}

                {/* Error State Card in Full-Screen */}
                {cameraState === 'error' && cameraError && (
                  <div style={{
                    position: 'absolute',
                    inset: 0,
                    backgroundColor: 'rgba(15, 23, 42, 0.96)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '24px',
                    textAlign: 'center',
                    zIndex: 35,
                  }}>
                    <CameraOff size={42} color="#dc2626" style={{ marginBottom: '14px' }} />
                    <h3 style={{ margin: '0 0 8px', color: '#f87171', fontSize: '18px', fontWeight: 700 }}>
                      {cameraError === 'denied' ? 'Camera Permission Denied' :
                       cameraError === 'in_use' ? 'Camera Currently In Use' :
                       cameraError === 'timeout' ? 'Camera Connection Timed Out' :
                       cameraError === 'unavailable' ? 'No Camera Found' :
                       cameraError === 'playback' ? 'Video Playback Error' :
                       cameraError === 'stalled' ? 'No Video Frames Received' :
                       cameraError === 'disconnected' ? 'Camera Disconnected' :
                       cameraError === 'insecure' ? 'Secure Connection Required' : 'Camera Unavailable'}
                    </h3>
                    <p style={{ margin: '0 0 20px', color: '#fca5a5', fontSize: '14px', maxWidth: '420px', lineHeight: 1.5 }}>
                      {CAMERA_ERROR_MESSAGES[cameraError]}
                    </p>
                    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
                      {cameraError !== 'unavailable' && cameraError !== 'insecure' && (
                        <button
                          type="button"
                          onClick={() => openCamera()}
                          style={{
                            backgroundColor: '#0f766e',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '24px',
                            padding: '10px 22px',
                            fontSize: '14px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                          }}
                        >
                          <Camera size={16} /> Try Again
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          closeCamera();
                          fileInputRef.current?.click();
                        }}
                        style={{
                          backgroundColor: '#fff',
                          color: '#0f766e',
                          border: 'none',
                          borderRadius: '24px',
                          padding: '10px 22px',
                          fontSize: '14px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                        }}
                      >
                        <Upload size={16} /> Upload File Instead
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 3. Review & Verification View (when cameraState === 'captured') */}
            {cameraState === 'captured' && (capturedPreviewUrl || capturedDataUrl) && (
              <div style={{
                flex: 1,
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                width: '100%',
                height: '100%',
                backgroundColor: '#050c14',
              }}>
                {/* Captured Top Header */}
                <div style={{
                  padding: '16px 24px',
                  backgroundColor: 'rgba(15, 23, 42, 0.95)',
                  borderBottom: '1px solid rgba(255,255,255,0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  zIndex: 35,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <CheckCircle2 size={22} color="#22c55e" />
                    <div>
                      <div style={{ color: '#fff', fontWeight: 700, fontSize: '15px' }}>Document Photo Captured</div>
                      <div style={{ color: '#94a3b8', fontSize: '12px' }}>Review the document before AI scanning</div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={closeCamera}
                    style={{
                      backgroundColor: 'transparent',
                      border: 'none',
                      color: '#94a3b8',
                      cursor: 'pointer',
                      padding: '6px',
                    }}
                    title="Discard and exit (Esc)"
                  >
                    <X size={22} />
                  </button>
                </div>

                {/* Captured Image Preview Area */}
                <div style={{
                  flex: 1,
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '24px',
                  overflow: 'auto',
                  backgroundColor: '#030712',
                }}>
                  <img
                    src={capturedPreviewUrl || capturedDataUrl || ''}
                    alt="Captured Document"
                    style={{
                      maxWidth: '100%',
                      maxHeight: '100%',
                      objectFit: 'contain',
                      borderRadius: '10px',
                      boxShadow: '0 12px 40px rgba(0,0,0,0.85), 0 0 0 1px rgba(255,255,255,0.15)',
                    }}
                  />
                </div>

                {/* Verification Reminder Pill & Actions */}
                <div style={{
                  backgroundColor: 'rgba(15, 23, 42, 0.95)',
                  borderTop: '1px solid rgba(255,255,255,0.1)',
                  padding: '16px 20px 24px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '14px',
                  zIndex: 35,
                }}>
                  <div style={{ color: '#e2e8f0', fontSize: '13px', textAlign: 'center', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
                    <span>Ensure the entire document is visible and all text is readable.</span>
                    {isPerspectiveCorrected ? (
                      <span
                        style={{
                          backgroundColor: 'rgba(20, 184, 166, 0.25)',
                          border: '1px solid #14b8a6',
                          color: '#2dd4bf',
                          padding: '3px 12px',
                          borderRadius: '14px',
                          fontSize: '11px',
                          fontWeight: 700,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '5px',
                        }}
                      >
                        ✓ Auto-Cropped & Perspective Corrected
                      </span>
                    ) : isImageCropped ? (
                      <span
                        style={{
                          backgroundColor: 'rgba(34, 197, 94, 0.2)',
                          border: '1px solid #22c55e',
                          color: '#4ade80',
                          padding: '3px 12px',
                          borderRadius: '14px',
                          fontSize: '11px',
                          fontWeight: 700,
                        }}
                      >
                        ✓ Adjusted & Rotated
                      </span>
                    ) : (
                      <span
                        style={{
                          backgroundColor: 'rgba(100, 116, 139, 0.25)',
                          border: '1px solid #94a3b8',
                          color: '#cbd5e1',
                          padding: '3px 12px',
                          borderRadius: '14px',
                          fontSize: '11px',
                          fontWeight: 600,
                        }}
                      >
                        Original Photo
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center' }}>
                    {/* 1. Retake */}
                    <button
                      type="button"
                      onClick={retakePhoto}
                      style={{
                        backgroundColor: 'rgba(51, 65, 85, 0.85)',
                        border: '1.5px solid rgba(255,255,255,0.2)',
                        color: '#fff',
                        borderRadius: '24px',
                        padding: '10px 18px',
                        fontSize: '13px',
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        cursor: 'pointer',
                      }}
                    >
                      <RotateCcw size={15} />
                      <span>Retake</span>
                    </button>

                    {/* 2. Adjust Crop */}
                    <button
                      type="button"
                      onClick={() => {
                        setCropSourceImage(rawCapturedDataUrl || capturedDataUrl || capturedPreviewUrl);
                        setCropSourceType('camera');
                        setIsCornerAdjustModalOpen(true);
                      }}
                      title="Adjust 4 crop corners and perspective transform"
                      style={{
                        backgroundColor: isPerspectiveCorrected ? 'rgba(20, 184, 166, 0.25)' : 'rgba(30, 41, 59, 0.9)',
                        border: '1.5px solid #14b8a6',
                        color: '#2dd4bf',
                        borderRadius: '24px',
                        padding: '10px 20px',
                        fontSize: '13px',
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '7px',
                        cursor: 'pointer',
                        boxShadow: '0 4px 14px rgba(20, 184, 166, 0.25)',
                      }}
                    >
                      <Sliders size={15} />
                      <span>Adjust Crop</span>
                    </button>

                    {/* 3. Rotate Left */}
                    <button
                      type="button"
                      onClick={() => handleRotateCaptured(-90)}
                      title="Rotate 90 degrees left"
                      style={{
                        backgroundColor: 'rgba(51, 65, 85, 0.85)',
                        border: '1.5px solid rgba(255,255,255,0.2)',
                        color: '#fff',
                        borderRadius: '24px',
                        padding: '10px 16px',
                        fontSize: '13px',
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        cursor: 'pointer',
                      }}
                    >
                      <RotateCcw size={15} />
                      <span>Rotate Left</span>
                    </button>

                    {/* 4. Rotate Right */}
                    <button
                      type="button"
                      onClick={() => handleRotateCaptured(90)}
                      title="Rotate 90 degrees right"
                      style={{
                        backgroundColor: 'rgba(51, 65, 85, 0.85)',
                        border: '1.5px solid rgba(255,255,255,0.2)',
                        color: '#fff',
                        borderRadius: '24px',
                        padding: '10px 16px',
                        fontSize: '13px',
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        cursor: 'pointer',
                      }}
                    >
                      <RotateCw size={15} />
                      <span>Rotate Right</span>
                    </button>

                    {/* Reset Option */}
                    {(isPerspectiveCorrected || isImageCropped) && rawCapturedDataUrl && (
                      <button
                        type="button"
                        onClick={() => {
                          setCapturedDataUrl(rawCapturedDataUrl);
                          setCapturedPreviewUrl(rawCapturedDataUrl);
                          setCapturedFile(rawCapturedFile);
                          setIsPerspectiveCorrected(false);
                          setIsImageCropped(false);
                        }}
                        title="Revert back to original uncropped photo"
                        style={{
                          backgroundColor: 'rgba(51, 65, 85, 0.65)',
                          border: '1px solid rgba(255,255,255,0.2)',
                          color: '#cbd5e1',
                          borderRadius: '24px',
                          padding: '10px 14px',
                          fontSize: '12px',
                          fontWeight: 600,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '5px',
                          cursor: 'pointer',
                        }}
                      >
                        <Undo2 size={14} />
                        <span>Reset</span>
                      </button>
                    )}

                    {/* 5. Use Document */}
                    <button
                      type="button"
                      onClick={confirmCapturedPhoto}
                      style={{
                        backgroundColor: '#0f766e',
                        border: 'none',
                        color: '#fff',
                        borderRadius: '24px',
                        padding: '10px 24px',
                        fontSize: '13px',
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '7px',
                        cursor: 'pointer',
                        boxShadow: '0 4px 16px rgba(15, 118, 110, 0.4)',
                      }}
                    >
                      <Check size={16} />
                      <span>Use Document</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* 4. Full-Screen Bottom Controls Bar (Visible during ready state) */}
            {cameraState === 'ready' && (
              <div style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                padding: '24px 20px 28px',
                background: 'linear-gradient(to top, rgba(5, 12, 20, 0.95) 0%, rgba(5, 12, 20, 0) 100%)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '12px',
                zIndex: 35,
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '32px',
                  width: '100%',
                  maxWidth: '440px',
                }}>
                  {/* Mobile Switch Front/Rear Camera */}
                  {(deviceEnv.isMobile || deviceEnv.isTablet) && hasMultipleCameras ? (
                    <button
                      type="button"
                      onClick={switchCamera}
                      title="Switch Front/Rear Camera"
                      style={{
                        backgroundColor: 'rgba(30, 41, 59, 0.85)',
                        border: '1.5px solid rgba(255,255,255,0.2)',
                        borderRadius: '50%',
                        width: '50px',
                        height: '50px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#fff',
                        cursor: 'pointer',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                      }}
                    >
                      <FlipHorizontal2 size={22} />
                    </button>
                  ) : (
                    <div style={{ width: '50px' }} />
                  )}

                  {/* Main Shutter Capture Button */}
                  <button
                    type="button"
                    onClick={capturePhoto}
                    disabled={!isFrameReady}
                    title={isFrameReady ? 'Capture Document (Space)' : 'Waiting for camera frames...'}
                    aria-label="Capture photo"
                    style={{
                      width: '76px',
                      height: '76px',
                      borderRadius: '50%',
                      backgroundColor: isFrameReady ? '#ffffff' : '#94a3b8',
                      border: `5px solid ${isFrameReady ? '#14b8a6' : '#64748b'}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: isFrameReady ? 'pointer' : 'not-allowed',
                      boxShadow: '0 6px 24px rgba(0, 0, 0, 0.6), 0 0 16px rgba(20, 184, 166, 0.5)',
                      transform: isFrameReady ? 'scale(1)' : 'scale(0.96)',
                      transition: 'all 0.15s cubic-bezier(0.4, 0, 0.2, 1)',
                    }}
                  >
                    <div style={{
                      width: '58px',
                      height: '58px',
                      borderRadius: '50%',
                      backgroundColor: isFrameReady ? '#0f766e' : '#cbd5e1',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#fff',
                    }}>
                      <Camera size={28} />
                    </div>
                  </button>

                  {/* Exit Button */}
                  <button
                    type="button"
                    onClick={closeCamera}
                    title="Exit Full Screen (Esc)"
                    style={{
                      backgroundColor: 'rgba(30, 41, 59, 0.85)',
                      border: '1.5px solid rgba(255,255,255,0.2)',
                      borderRadius: '50%',
                      width: '50px',
                      height: '50px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#fff',
                      cursor: 'pointer',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                    }}
                  >
                    <Minimize2 size={22} />
                  </button>
                </div>

                {/* Keyboard helper hint on desktop */}
                {!deviceEnv.isMobile && (
                  <div style={{ fontSize: '11px', color: '#94a3b8', letterSpacing: '0.3px' }}>
                    Press <kbd style={{ backgroundColor: 'rgba(255,255,255,0.15)', padding: '2px 6px', borderRadius: '4px', color: '#fff' }}>Space</kbd> to capture · <kbd style={{ backgroundColor: 'rgba(255,255,255,0.15)', padding: '2px 6px', borderRadius: '4px', color: '#fff' }}>Esc</kbd> to exit
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Standard Scanner Card Area ── */}
        <div style={captureAreaStyle}>

          {/* IDLE state — camera not open, no file selected */}
          {cameraState === 'idle' && !hasFileSelected && (
            <div style={{ textAlign: 'center', padding: '36px 20px' }}>
              <div style={{
                backgroundColor: '#e0f2fe',
                borderRadius: '50%',
                width: '68px',
                height: '68px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px',
                boxShadow: '0 4px 14px rgba(3, 105, 161, 0.15)',
              }}>
                <Camera size={34} color="#0369a1" />
              </div>
              <p style={{ margin: '0 0 6px', fontSize: '16px', fontWeight: 700, color: '#1e293b' }}>
                Capture Prescription or Medical Report
              </p>
              <p style={{ margin: '0 0 20px', fontSize: '13px', color: '#64748b', maxWidth: '380px', lineHeight: 1.5 }}>
                Open the professional full-screen scanner to align your document with A4 framing guides, or upload a saved file.
              </p>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => openCamera()}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    backgroundColor: '#0f766e',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '10px',
                    padding: '11px 22px',
                    fontSize: '14px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    boxShadow: '0 4px 14px rgba(15, 118, 110, 0.3)',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <Maximize2 size={18} />
                  <span>Open Full-Screen Camera</span>
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    backgroundColor: '#fff',
                    color: '#0f766e',
                    border: '1.5px solid #0f766e',
                    borderRadius: '10px',
                    padding: '11px 22px',
                    fontSize: '14px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  <Upload size={18} />
                  <span>Upload File</span>
                </button>
              </div>
            </div>
          )}

          {/* Confirmed / Selected File preview in main screen */}
          {hasFileSelected && !isFullScreen && (
            <div style={{ width: '100%', padding: '16px' }}>
              {selectedFilePreview ? (
                <div style={{ position: 'relative', textAlign: 'center' }}>
                  <img
                    src={selectedFilePreview}
                    alt="Selected document"
                    style={{
                      width: '100%',
                      borderRadius: '12px',
                      maxHeight: '340px',
                      objectFit: 'contain',
                      backgroundColor: '#f1f5f9',
                      border: '1px solid #e2e8f0',
                    }}
                  />
                  <button
                    type="button"
                    onClick={clearSelection}
                    title="Remove selected document"
                    style={{
                      position: 'absolute',
                      top: '10px',
                      right: '10px',
                      backgroundColor: 'rgba(0,0,0,0.65)',
                      border: 'none',
                      borderRadius: '50%',
                      width: '32px',
                      height: '32px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      color: '#fff',
                    }}
                  >
                    <X size={16} />
                  </button>

                  {/* Actions strip for image: Crop & Rotate, Reset, Status Badge */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '10px',
                      marginTop: '12px',
                      flexWrap: 'wrap',
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        const src = rawSelectedPreview || selectedFilePreview;
                        if (src) {
                          setCropSourceImage(src);
                          setCropSourceType('upload');
                          setIsCornerAdjustModalOpen(true);
                        }
                      }}
                      style={{
                        backgroundColor: '#f0fdfa',
                        border: '1.5px solid #0f766e',
                        color: '#0f766e',
                        borderRadius: '20px',
                        padding: '7px 16px',
                        fontSize: '13px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        boxShadow: '0 2px 6px rgba(15, 118, 110, 0.1)',
                      }}
                    >
                      <Sliders size={15} />
                      <span>Adjust 4 Corners</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleOpenCropModal('upload')}
                      style={{
                        backgroundColor: '#ffffff',
                        border: '1.5px solid #cbd5e1',
                        color: '#475569',
                        borderRadius: '20px',
                        padding: '7px 16px',
                        fontSize: '13px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      <Crop size={15} />
                      <span>{isImageCropped ? 'Box Crop' : 'Box Crop & Rotate'}</span>
                    </button>

                    {isImageCropped && (
                      <button
                        type="button"
                        onClick={() => handleResetToOriginal('upload')}
                        title="Revert back to original uncropped image"
                        style={{
                          backgroundColor: '#f8fafc',
                          border: '1px solid #cbd5e1',
                          color: '#64748b',
                          borderRadius: '20px',
                          padding: '7px 14px',
                          fontSize: '12px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                        }}
                      >
                        <Undo2 size={14} />
                        <span>Reset to Original</span>
                      </button>
                    )}

                    {isImageCropped && (
                      <span
                        style={{
                          backgroundColor: '#dcfce7',
                          color: '#166534',
                          border: '1px solid #bbf7d0',
                          borderRadius: '16px',
                          padding: '4px 10px',
                          fontSize: '11px',
                          fontWeight: 600,
                        }}
                      >
                        ✓ Cropped
                      </span>
                    )}
                  </div>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '24px 20px' }}>
                  <FileText size={44} color="#0f766e" style={{ marginBottom: '10px' }} />
                  <p style={{ margin: '0 0 4px', fontWeight: 700, color: '#1e293b', fontSize: '15px' }}>
                    {selectedFile?.name}
                  </p>
                  <p style={{ margin: '0 0 14px', fontSize: '13px', color: '#64748b' }}>
                    {((selectedFile?.size || 0) / 1024).toFixed(1)} KB · Document Ready to Scan
                  </p>
                  <button
                    type="button"
                    onClick={clearSelection}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#dc2626',
                      fontSize: '13px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      textDecoration: 'underline',
                    }}
                  >
                    Remove Document
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Hidden canvas for capture */}
        <canvas ref={canvasRef} style={{ display: 'none' }} />

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          onChange={handleFileSelect}
          style={{ display: 'none' }}
        />

        {/* Action buttons row when in idle with no selection */}
        {cameraState === 'idle' && !hasFileSelected && (
          <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', backgroundColor: '#f8fafc', border: '1.5px solid #e2e8f0', borderRadius: '10px', padding: '10px', fontSize: '13px', color: '#475569', cursor: 'pointer' }}
            >
              <ImageIcon size={16} /> Upload Image
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', backgroundColor: '#f8fafc', border: '1.5px solid #e2e8f0', borderRadius: '10px', padding: '10px', fontSize: '13px', color: '#475569', cursor: 'pointer' }}
            >
              <FileText size={16} /> Upload PDF
            </button>
          </div>
        )}

        {/* "Scan Document Now" processing / action button */}
        {scanState === 'scanning' ? (
          <div style={{ textAlign: 'center', padding: '14px 0', color: '#0f766e' }}>
            <Loader2 size={24} style={{ animation: 'spin 1s linear infinite', marginBottom: '8px' }} />
            <p style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>
              GramCare AI is analyzing your document...
            </p>
            <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#64748b' }}>This may take a few seconds</p>
          </div>
        ) : hasFileSelected ? (
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <PrimaryButton
              disabled={!isFeatureAvailable}
              onClick={handleScan}
            >
              <ScanLine size={16} />
              <span>{isFeatureAvailable ? `Scan ${docType} Now` : 'Scan Unavailable Offline'}</span>
              {isFeatureAvailable && <ChevronRight size={16} />}
            </PrimaryButton>
            <SecondaryButton onClick={clearSelection}>
              Clear
            </SecondaryButton>
          </div>
        ) : null}

        {/* Hint for HTTPS when accessed remotely */}
        {typeof window !== 'undefined' && window.location.protocol === 'http:' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1' && (
          <div style={{ marginTop: '12px', backgroundColor: '#fff7ed', border: '1px solid #fed7aa', borderRadius: '8px', padding: '10px 14px', fontSize: '12px', color: '#92400e' }}>
            ℹ️ Camera access requires HTTPS when accessed remotely. This is a browser security standard.
          </div>
        )}

        {/* Professional Document Crop & Rotate Modal */}
        {isCropModalOpen && cropSourceImage && (
          <DocumentCropModal
            imageSrc={cropSourceImage}
            docType={docType}
            onApplyCrop={handleApplyCropResult}
            onCancel={() => setIsCropModalOpen(false)}
          />
        )}

        {/* Professional 4-Corner Document Detection & Perspective Adjustment Modal */}
        {isCornerAdjustModalOpen && (cropSourceImage || rawCapturedDataUrl || capturedDataUrl || rawSelectedPreview || selectedFilePreview) && (
          <CornerAdjustModal
            imageSrc={(cropSourceImage || rawCapturedDataUrl || capturedDataUrl || rawSelectedPreview || selectedFilePreview)!}
            initialQuad={capturedCorners || {
              topLeft: { x: 50, y: 50 },
              topRight: { x: 750, y: 50 },
              bottomRight: { x: 750, y: 550 },
              bottomLeft: { x: 50, y: 550 },
            }}
            onApplyQuad={handleApplyAdjustedCorners}
            onCancel={() => setIsCornerAdjustModalOpen(false)}
          />
        )}
      </div>
    </div>
  );
};
