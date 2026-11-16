import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  X, ChevronLeft, ChevronRight, ExternalLink, 
  Sun, Moon, RotateCcw, 
  Film, Tv, Play 
} from 'lucide-react';

export interface LightboxMediaItem {
  url: string;
  thumbnailUrl?: string;
  name?: string;
  type?: string;
  size?: number;
  previewUrl?: string;
  streamUrl?: string;
  googleDriveId?: string;
}

interface MediaLightboxModalProps {
  items: LightboxMediaItem[];
  initialIndex?: number;
  onClose: () => void;
}

function extractDriveId(item: LightboxMediaItem): string | null {
  if (item.googleDriveId) return item.googleDriveId;
  const match1 = item.url?.match(/id=([a-zA-Z0-9_-]+)/);
  if (match1) return match1[1];
  const match2 = item.url?.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (match2) return match2[1];
  if (item.previewUrl) {
    const match3 = item.previewUrl?.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (match3) return match3[1];
  }
  return null;
}

export const MediaLightboxModal: React.FC<MediaLightboxModalProps> = ({
  items,
  initialIndex = 0,
  onClose
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  // Background Theme: 'black' | 'white' (persisted in localStorage)
  const [theme, setTheme] = useState<'black' | 'white'>(() => {
    try {
      return localStorage.getItem('shudkara_lightbox_theme') === 'white' ? 'white' : 'black';
    } catch {
      return 'black';
    }
  });

  const toggleTheme = useCallback(() => {
    setTheme(prev => {
      const next = prev === 'black' ? 'white' : 'black';
      try { localStorage.setItem('shudkara_lightbox_theme', next); } catch {}
      return next;
    });
  }, []);

  // Zoom & Pan state for photos
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPinching, setIsPinching] = useState(false);

  // Video player mode: 'stream' (Google Drive embedded preview) vs 'direct' (native <video>)
  const [videoPlayerMode, setVideoPlayerMode] = useState<'stream' | 'direct'>('stream');

  // Touch gesture refs
  const touchStartDistRef = useRef(0);
  const initialScaleRef = useRef(1);
  const lastTouchPosRef = useRef({ x: 0, y: 0 });
  const lastTapTimeRef = useRef(0);
  const isDraggingRef = useRef(false);

  useEffect(() => {
    setCurrentIndex(initialIndex);
  }, [initialIndex]);

  // Reset zoom on index change
  useEffect(() => {
    setScale(1);
    setPan({ x: 0, y: 0 });
  }, [currentIndex]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (scale === 1) {
        if (e.key === 'ArrowRight') handleNext();
        if (e.key === 'ArrowLeft') handlePrev();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, items.length, scale]);

  if (!items || items.length === 0) return null;

  const current = items[currentIndex] || items[0];

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % items.length);
  };

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev - 1 + items.length) % items.length);
  };

  // Video detection
  const isVideo = Boolean(
    current.type?.startsWith('video/') ||
    /\.(mp4|webm|mov|m4v|mkv|avi|3gp)($|\?)/i.test(current.url) ||
    /\.(mp4|webm|mov|m4v|mkv|avi|3gp)($|\?)/i.test(current.name || '')
  );

  const driveId = extractDriveId(current);
  const streamEmbedUrl = driveId ? `https://drive.google.com/file/d/${driveId}/preview` : null;
  const isLocalOrDirect = current.url.startsWith('blob:') || current.url.startsWith('data:') || current.url.includes('.mp4');
  const showIframeStream = Boolean(streamEmbedUrl && (videoPlayerMode === 'stream' || !isLocalOrDirect));

  // Multi-Touch Pinch & Pan Handlers (Prevents entire website from zooming)
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      setIsPinching(true);
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      touchStartDistRef.current = dist;
      initialScaleRef.current = scale;
    } else if (e.touches.length === 1) {
      const now = Date.now();
      const touch = e.touches[0];
      lastTouchPosRef.current = { x: touch.clientX, y: touch.clientY };
      isDraggingRef.current = false;

      // Double tap to zoom 1x <-> 2.5x
      if (now - lastTapTimeRef.current < 300) {
        lastTapTimeRef.current = 0;
        if (scale > 1) {
          setScale(1);
          setPan({ x: 0, y: 0 });
        } else {
          setScale(2.5);
          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
          const offsetX = (touch.clientX - (rect.left + rect.width / 2)) * -0.5;
          const offsetY = (touch.clientY - (rect.top + rect.height / 2)) * -0.5;
          setPan({ x: Math.max(-140, Math.min(140, offsetX)), y: Math.max(-140, Math.min(140, offsetY)) });
        }
      } else {
        lastTapTimeRef.current = now;
      }
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && isPinching) {
      // Pinch to zoom photo only - block browser default zoom
      e.preventDefault();
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      if (touchStartDistRef.current > 0) {
        const factor = dist / touchStartDistRef.current;
        const newScale = Math.min(Math.max(initialScaleRef.current * factor, 1), 4.5);
        setScale(newScale);
        if (newScale <= 1.05) {
          setPan({ x: 0, y: 0 });
        }
      }
    } else if (e.touches.length === 1 && scale > 1) {
      // Pan photo while zoomed in - block browser default scroll
      e.preventDefault();
      isDraggingRef.current = true;
      const touch = e.touches[0];
      const dx = touch.clientX - lastTouchPosRef.current.x;
      const dy = touch.clientY - lastTouchPosRef.current.y;
      lastTouchPosRef.current = { x: touch.clientX, y: touch.clientY };

      const maxPanX = (scale - 1) * 220;
      const maxPanY = (scale - 1) * 280;
      setPan(prev => ({
        x: Math.max(-maxPanX, Math.min(maxPanX, prev.x + dx)),
        y: Math.max(-maxPanY, Math.min(maxPanY, prev.y + dy))
      }));
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (e.touches.length < 2) {
      setIsPinching(false);
    }
    if (scale < 1.08) {
      setScale(1);
      setPan({ x: 0, y: 0 });
    }
  };

  // Tap stage to toggle background black/white
  const handleStageClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && scale === 1 && !isDraggingRef.current) {
      toggleTheme();
    }
  };

  const isWhite = theme === 'white';

  return (
    <div 
      className={`fixed inset-0 z-[100] flex flex-col justify-between p-3 sm:p-4 select-none transition-colors duration-200 overflow-hidden ${
        isWhite ? 'bg-white text-slate-900' : 'bg-black text-white'
      }`}
      style={{ touchAction: 'none' }}
    >
      
      {/* ── Top Control Bar ── */}
      <div className={`flex items-center justify-between px-3 py-2 rounded-2xl border backdrop-blur-md z-30 transition-colors ${
        isWhite 
          ? 'bg-slate-50/90 border-slate-200 text-slate-800 shadow-sm' 
          : 'bg-zinc-900/90 border-zinc-800 text-white shadow-xl'
      }`}>
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <span className={`px-2.5 py-1 rounded-full text-xs font-mono font-bold border shrink-0 ${
            isWhite 
              ? 'bg-white text-slate-700 border-slate-300' 
              : 'bg-zinc-800 text-slate-200 border-zinc-700'
          }`}>
            {currentIndex + 1} / {items.length}
          </span>
          {current.name && (
            <span className="truncate max-w-[140px] sm:max-w-xs text-xs font-semibold">
              {current.name}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Video Player Switcher (when video has Google Drive streaming preview) */}
          {isVideo && streamEmbedUrl && (
            <button
              type="button"
              onClick={() => setVideoPlayerMode(prev => prev === 'stream' ? 'direct' : 'stream')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold transition border ${
                isWhite
                  ? 'bg-white hover:bg-slate-100 text-slate-800 border-slate-200'
                  : 'bg-zinc-800 hover:bg-zinc-700 text-slate-200 border-zinc-700'
              }`}
              title="Toggle between Google Drive Streaming Player and Direct Video Player"
            >
              {videoPlayerMode === 'stream' ? (
                <>
                  <Tv className="w-3.5 h-3.5 text-blue-500" />
                  <span className="hidden sm:inline">Drive Stream</span>
                </>
              ) : (
                <>
                  <Film className="w-3.5 h-3.5 text-emerald-500" />
                  <span className="hidden sm:inline">Direct Player</span>
                </>
              )}
            </button>
          )}

          {/* Background Black / White Toggle Button */}
          <button
            type="button"
            onClick={toggleTheme}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold transition border ${
              isWhite
                ? 'bg-white hover:bg-slate-100 text-slate-800 border-slate-200'
                : 'bg-zinc-800 hover:bg-zinc-700 text-slate-200 border-zinc-700'
            }`}
            title={`Toggle background color (Currently ${theme})`}
          >
            {isWhite ? <Moon className="w-3.5 h-3.5 text-indigo-500" /> : <Sun className="w-3.5 h-3.5 text-amber-400" />}
            <span className="hidden sm:inline">{isWhite ? 'Dark BG' : 'Light BG'}</span>
          </button>

          {/* Zoom Reset Button (visible when photo is zoomed in) */}
          {!isVideo && scale > 1 && (
            <button
              type="button"
              onClick={() => { setScale(1); setPan({ x: 0, y: 0 }); }}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow transition animate-in fade-in"
              title="Reset Zoom (Double-tap also resets)"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{Math.round(scale * 100)}%</span>
            </button>
          )}

          {/* Open Original Source */}
          <a
            href={current.url}
            target="_blank"
            rel="noopener noreferrer"
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition border ${
              isWhite
                ? 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
                : 'bg-zinc-800 hover:bg-zinc-700 text-slate-200 border-zinc-700'
            }`}
            title="Open original file in new tab"
          >
            <span className="hidden sm:inline">Original</span>
            <ExternalLink className="w-3.5 h-3.5 text-blue-400" />
          </a>

          {/* Close Modal Button */}
          <button
            type="button"
            onClick={onClose}
            className={`p-1.5 rounded-xl transition border ${
              isWhite
                ? 'bg-white hover:bg-rose-50 text-slate-700 hover:text-rose-600 border-slate-200'
                : 'bg-zinc-800 hover:bg-rose-600 text-slate-300 hover:text-white border-zinc-700'
            }`}
            title="Close viewer (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* ── Main Media Display Stage (Tap empty area to toggle background color) ── */}
      <div 
        onClick={handleStageClick}
        className="relative flex-1 flex items-center justify-center my-2 overflow-hidden cursor-pointer"
        title="Tap empty background to switch between black and white mode"
      >
        
        {/* Prev Arrow (disabled while zoomed in) */}
        {items.length > 1 && scale === 1 && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); handlePrev(); }}
            className={`absolute left-3 z-30 p-3 rounded-2xl border transition shadow-xl hover:scale-105 active:scale-95 ${
              isWhite
                ? 'bg-white/90 hover:bg-white text-slate-800 border-slate-200'
                : 'bg-zinc-900/80 hover:bg-zinc-800 text-white border-zinc-700/80'
            }`}
            title="Previous (Left Arrow)"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
        )}

        {/* Media Container */}
        <div 
          onClick={(e) => e.stopPropagation()}
          className="max-h-full max-w-full flex items-center justify-center p-1 sm:p-2 relative cursor-default"
        >
          {isVideo ? (
            /* ── High-Performance Video Player ── */
            <div className="relative w-[92vw] max-w-4xl aspect-video rounded-2xl overflow-hidden bg-black shadow-2xl border border-zinc-800 flex items-center justify-center">
              {showIframeStream ? (
                /* Google Drive Embedded Streaming Player (Zero CORS issues, adaptive stream) */
                <iframe
                  src={streamEmbedUrl!}
                  className="w-full h-full border-0 rounded-2xl"
                  allow="autoplay; encrypted-media; fullscreen"
                  allowFullScreen
                  title={current.name || 'Video stream player'}
                />
              ) : (
                /* Native HTML5 Video Player */
                <video
                  src={current.streamUrl || current.url}
                  controls
                  autoPlay
                  playsInline
                  onError={() => {
                    if (streamEmbedUrl) setVideoPlayerMode('stream');
                  }}
                  className="max-h-full max-w-full object-contain"
                />
              )}
            </div>
          ) : (
            /* ── Pinch-to-Zoom / Double-Tap Zoom Image Stage ── */
            <div 
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              onDoubleClick={(e) => {
                e.stopPropagation();
                if (scale > 1) {
                  setScale(1);
                  setPan({ x: 0, y: 0 });
                } else {
                  setScale(2.5);
                }
              }}
              className="relative flex items-center justify-center overflow-visible"
              style={{ touchAction: 'none' }}
            >
              <img
                src={current.url}
                alt={current.name || 'Enlarged photo'}
                draggable={false}
                style={{
                  transform: `scale(${scale}) translate(${pan.x / scale}px, ${pan.y / scale}px)`,
                  transition: isPinching ? 'none' : 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                  touchAction: 'none'
                }}
                className="max-h-[76vh] max-w-full rounded-2xl object-contain shadow-2xl select-none"
              />
            </div>
          )}
        </div>

        {/* Next Arrow (disabled while zoomed in) */}
        {items.length > 1 && scale === 1 && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); handleNext(); }}
            className={`absolute right-3 z-30 p-3 rounded-2xl border transition shadow-xl hover:scale-105 active:scale-95 ${
              isWhite
                ? 'bg-white/90 hover:bg-white text-slate-800 border-slate-200'
                : 'bg-zinc-900/80 hover:bg-zinc-800 text-white border-zinc-700/80'
            }`}
            title="Next (Right Arrow)"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        )}
      </div>

      {/* ── Bottom Thumbnail Strip ── */}
      {items.length > 1 && (
        <div className={`flex items-center justify-center gap-2 overflow-x-auto py-2 px-4 max-w-full rounded-2xl border backdrop-blur-md z-30 transition-colors ${
          isWhite ? 'bg-slate-50/90 border-slate-200' : 'bg-zinc-900/90 border-zinc-800'
        }`}>
          {items.map((item, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setCurrentIndex(idx)}
              className={`relative w-14 h-14 rounded-xl overflow-hidden border-2 shrink-0 transition-all ${
                idx === currentIndex
                  ? 'border-blue-500 scale-105 ring-2 ring-blue-500/50 shadow-lg'
                  : isWhite
                  ? 'border-slate-300 opacity-60 hover:opacity-100 hover:border-slate-400'
                  : 'border-zinc-700 opacity-50 hover:opacity-100 hover:border-zinc-500'
              }`}
            >
              <img
                src={item.thumbnailUrl || item.url}
                alt={`Thumbnail ${idx + 1}`}
                className="w-full h-full object-cover"
              />
              {item.type?.startsWith('video/') && (
                <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                  <Play className="w-3.5 h-3.5 text-white fill-white" />
                </div>
              )}
            </button>
          ))}
        </div>
      )}

    </div>
  );
};
