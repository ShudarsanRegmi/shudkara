import React, { useState, useEffect, useRef } from 'react';
import { 
  Camera, X, RotateCw, FlipHorizontal, RefreshCw, Check, Maximize2, Minimize2, Image as ImageIcon
} from 'lucide-react';

export interface SnappedPhoto {
  name: string;
  type: string;
  base64: string;
}

interface TimelineCameraModalProps {
  onCaptureSnaps: (snaps: SnappedPhoto[]) => void;
  onClose: () => void;
}

export const TimelineCameraModal: React.FC<TimelineCameraModalProps> = ({
  onCaptureSnaps,
  onClose
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [rotation, setRotation] = useState<number>(0); // 0, 90, 180, 270
  const [isMirrored, setIsMirrored] = useState<boolean>(false);
  const [fitMode, setFitMode] = useState<'cover' | 'contain'>('cover');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [capturedSnaps, setCapturedSnaps] = useState<SnappedPhoto[]>([]);
  const [flashAnimation, setFlashAnimation] = useState(false);

  // Initialize and switch camera stream
  useEffect(() => {
    let active = true;

    const stopCurrentStream = () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => {
          track.stop();
        });
        streamRef.current = null;
      }
    };

    const startStream = async () => {
      stopCurrentStream();
      setErrorMsg(null);

      try {
        const constraints: MediaStreamConstraints = {
          audio: false,
          video: {
            facingMode: { ideal: facingMode },
            width: { ideal: 1920 },
            height: { ideal: 1080 }
          }
        };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        if (!active) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }

        // Default mirror to true if front camera ('user'), false if rear ('environment')
        setIsMirrored(facingMode === 'user');
        // Reset rotation on camera switch
        setRotation(0);
      } catch (err: any) {
        console.error('Camera stream error:', err);
        setErrorMsg(
          err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError'
            ? 'Camera access permission was denied. Please allow camera permissions in your browser.'
            : 'Unable to access camera device. Please verify your camera is connected and not in use by another app.'
        );
      }
    };

    startStream();

    return () => {
      active = false;
      stopCurrentStream();
    };
  }, [facingMode]);

  // Flip camera rear <-> front
  const handleFlipCamera = () => {
    setFacingMode(prev => (prev === 'environment' ? 'user' : 'environment'));
  };

  // Rotate camera view (fixes upside down or landscape issues)
  const handleRotate = () => {
    setRotation(prev => (prev + 90) % 360);
  };

  // Toggle horizontal mirror
  const handleToggleMirror = () => {
    setIsMirrored(prev => !prev);
  };

  // Capture snapshot from video with rotation and mirror transforms
  const handleTakeSnapshot = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    if (video.videoWidth === 0 || video.videoHeight === 0) return;

    // Trigger visual flash
    setFlashAnimation(true);
    setTimeout(() => setFlashAnimation(false), 200);

    const canvas = canvasRef.current || document.createElement('canvas');
    const isSideways = rotation === 90 || rotation === 270;
    
    // Set canvas dimensions respecting rotation
    canvas.width = isSideways ? video.videoHeight : video.videoWidth;
    canvas.height = isSideways ? video.videoWidth : video.videoHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.save();
    // Move origin to center of canvas for rotation & mirror
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((rotation * Math.PI) / 180);

    if (isMirrored) {
      ctx.scale(-1, 1);
    }

    ctx.drawImage(
      video,
      -video.videoWidth / 2,
      -video.videoHeight / 2,
      video.videoWidth,
      video.videoHeight
    );
    ctx.restore();

    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    const fileName = `snap_${Date.now()}_${capturedSnaps.length + 1}.jpg`;

    setCapturedSnaps(prev => [
      ...prev,
      {
        name: fileName,
        type: 'image/jpeg',
        base64: dataUrl
      }
    ]);
  };

  // Finish capturing and send snaps to wizard
  const handleDone = () => {
    if (capturedSnaps.length > 0) {
      onCaptureSnaps(capturedSnaps);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black text-white flex flex-col justify-between overflow-hidden select-none animate-in fade-in duration-200">
      
      {/* ── Visual Shutter Flash Effect ── */}
      {flashAnimation && (
        <div className="absolute inset-0 bg-white/90 z-50 pointer-events-none animate-out fade-out duration-200" />
      )}

      {/* ── Top Floating Navigation & Controls Bar ── */}
      <div className="relative z-30 flex items-center justify-between p-4 sm:p-6 bg-gradient-to-b from-black/80 via-black/40 to-transparent">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            className="p-2.5 rounded-full bg-slate-900/70 hover:bg-slate-800 text-white backdrop-blur-md border border-white/10 transition active:scale-90"
            title="Close Camera"
          >
            <X className="w-5 h-5" />
          </button>
          
          <div className="flex items-center gap-1.5 px-3 py-1 bg-white/10 backdrop-blur-md rounded-full border border-white/10 text-xs font-bold text-white">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span>LIVE</span>
            {facingMode === 'user' ? '(Front Selfie)' : '(Rear Camera)'}
          </div>
        </div>

        {/* Viewfinder Adjustments: Rotate / Mirror / Fit */}
        <div className="flex items-center gap-2">
          {/* Rotate 90 deg button (fixes upside down camera issues) */}
          <button
            type="button"
            onClick={handleRotate}
            className={`p-2.5 rounded-full backdrop-blur-md border transition active:scale-90 flex items-center gap-1 text-xs font-bold ${
              rotation !== 0 
                ? 'bg-amber-500/80 text-white border-amber-400' 
                : 'bg-slate-900/70 hover:bg-slate-800 text-white border-white/10'
            }`}
            title={`Rotate Orientation (Current: ${rotation}°)`}
          >
            <RotateCw className="w-4 h-4" />
            {rotation !== 0 && <span>{rotation}°</span>}
          </button>

          {/* Mirror Toggle Button */}
          <button
            type="button"
            onClick={handleToggleMirror}
            className={`p-2.5 rounded-full backdrop-blur-md border transition active:scale-90 ${
              isMirrored 
                ? 'bg-blue-600/80 text-white border-blue-400' 
                : 'bg-slate-900/70 hover:bg-slate-800 text-white border-white/10'
            }`}
            title="Mirror Horizontally"
          >
            <FlipHorizontal className="w-4 h-4" />
          </button>

          {/* Aspect Fit / Cover Toggle */}
          <button
            type="button"
            onClick={() => setFitMode(prev => (prev === 'cover' ? 'contain' : 'cover'))}
            className="p-2.5 rounded-full bg-slate-900/70 hover:bg-slate-800 text-white backdrop-blur-md border border-white/10 transition active:scale-90"
            title={fitMode === 'cover' ? 'Switch to Fit' : 'Switch to Full Screen Cover'}
          >
            {fitMode === 'cover' ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* ── Main Full-Screen Viewfinder Canvas Area ── */}
      <div className="relative flex-1 w-full h-full flex items-center justify-center overflow-hidden bg-black">
        {errorMsg ? (
          <div className="p-6 max-w-sm text-center bg-red-950/80 border border-red-800/80 rounded-3xl text-xs text-red-200 space-y-3 mx-4 backdrop-blur-md">
            <Camera className="w-8 h-8 text-red-400 mx-auto" />
            <p className="font-semibold">{errorMsg}</p>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white font-bold rounded-xl text-xs transition"
            >
              Use File Upload Instead
            </button>
          </div>
        ) : (
          <div className="relative w-full h-full flex items-center justify-center">
            {/* Real Full Screen Camera Stream */}
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              style={{
                transform: `${isMirrored ? 'scaleX(-1)' : ''} rotate(${rotation}deg)`,
                transformOrigin: 'center center'
              }}
              className={`w-full h-full transition-all duration-150 ${
                fitMode === 'cover' ? 'object-cover' : 'object-contain'
              }`}
            />

            {/* Subtle Rule of Thirds Viewfinder Grid Overlay */}
            <div className="absolute inset-0 pointer-events-none grid grid-cols-3 grid-rows-3 border border-white/10 opacity-30">
              <div className="border-r border-b border-white/20" />
              <div className="border-r border-b border-white/20" />
              <div className="border-b border-white/20" />
              <div className="border-r border-b border-white/20" />
              <div className="border-r border-b border-white/20" />
              <div className="border-b border-white/20" />
              <div className="border-r border-white/20" />
              <div className="border-r border-white/20" />
              <div />
            </div>

            <canvas ref={canvasRef} className="hidden" />
          </div>
        )}
      </div>

      {/* ── Bottom Floating Controls & Multi-Snap Gallery ── */}
      <div className="relative z-30 flex flex-col items-center gap-4 p-6 bg-gradient-to-t from-black/90 via-black/60 to-transparent">
        
        {/* Gallery Strip of Snaps Taken in Current Session */}
        {capturedSnaps.length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto max-w-full px-2 py-1 scrollbar-none animate-in fade-in slide-in-from-bottom-2">
            <div className="text-[11px] font-bold text-slate-300 pr-1 flex items-center gap-1">
              <ImageIcon className="w-3.5 h-3.5 text-blue-400" />
              <span>{capturedSnaps.length} Snapped</span>
            </div>
            {capturedSnaps.map((snap, sIdx) => (
              <div
                key={sIdx}
                className="relative w-12 h-12 rounded-xl overflow-hidden border-2 border-white/80 shrink-0 shadow-lg group"
              >
                <img src={snap.base64} alt="snap preview" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => setCapturedSnaps(prev => prev.filter((_, i) => i !== sIdx))}
                  className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition"
                  title="Remove this snap"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Shutter Bar */}
        <div className="w-full max-w-md flex items-center justify-between px-4">
          {/* Flip Camera Facing Mode (Front <-> Rear) */}
          <button
            type="button"
            onClick={handleFlipCamera}
            className="w-12 h-12 rounded-full bg-slate-900/80 hover:bg-slate-800 text-white backdrop-blur-md border border-white/15 flex items-center justify-center shadow-lg transition active:scale-90"
            title="Flip Front / Rear Camera"
          >
            <RefreshCw className="w-5 h-5 text-slate-200" />
          </button>

          {/* Main Shutter Button */}
          <button
            type="button"
            onClick={handleTakeSnapshot}
            disabled={!!errorMsg}
            className="w-20 h-20 rounded-full border-4 border-white/80 bg-white/20 backdrop-blur-sm p-1 shadow-2xl transition hover:scale-105 active:scale-95 flex items-center justify-center group"
            title="Capture Photo"
          >
            <div className="w-full h-full rounded-full bg-white group-hover:bg-slate-100 transition shadow-inner flex items-center justify-center">
              <Camera className="w-7 h-7 text-slate-900" />
            </div>
          </button>

          {/* Done / Accept Captured Snaps Button */}
          <button
            type="button"
            onClick={handleDone}
            className={`px-4 py-3 rounded-2xl font-bold text-xs shadow-lg transition active:scale-95 flex items-center gap-1.5 ${
              capturedSnaps.length > 0
                ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-500/30'
                : 'bg-slate-900/80 hover:bg-slate-800 text-slate-300 border border-white/10'
            }`}
          >
            {capturedSnaps.length > 0 ? (
              <>
                <Check className="w-4 h-4" />
                <span>Done ({capturedSnaps.length})</span>
              </>
            ) : (
              <span>Cancel</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
