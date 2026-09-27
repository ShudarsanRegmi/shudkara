import React, { useState, useEffect } from 'react';
import { X, ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react';

export interface LightboxMediaItem {
  url: string;
  thumbnailUrl?: string;
  name?: string;
  type?: string;
}

interface MediaLightboxModalProps {
  items: LightboxMediaItem[];
  initialIndex?: number;
  onClose: () => void;
}

export const MediaLightboxModal: React.FC<MediaLightboxModalProps> = ({
  items,
  initialIndex = 0,
  onClose
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  useEffect(() => {
    setCurrentIndex(initialIndex);
  }, [initialIndex]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') handleNext();
      if (e.key === 'ArrowLeft') handlePrev();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, items.length]);

  if (!items || items.length === 0) return null;

  const current = items[currentIndex] || items[0];

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % items.length);
  };

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev - 1 + items.length) % items.length);
  };

  return (
    <div className="fixed inset-0 z-[100] bg-slate-950/95 backdrop-blur-lg flex flex-col justify-between p-4 animate-in fade-in duration-150 select-none">
      
      {/* ── Top Bar Controls ── */}
      <div className="flex items-center justify-between text-white px-3 py-2 border-b border-slate-800/80 z-20">
        <div className="flex items-center gap-3">
          <span className="bg-slate-800 px-3 py-1 rounded-full text-xs font-mono font-bold text-slate-300 border border-slate-700">
            {currentIndex + 1} / {items.length}
          </span>
          {current.name && (
            <span className="truncate max-w-xs text-xs font-semibold text-slate-300 hidden sm:inline">
              {current.name}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <a
            href={current.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold transition border border-slate-700"
          >
            <span>Open Original</span>
            <ExternalLink className="w-3.5 h-3.5 text-blue-400" />
          </a>
          <button
            onClick={onClose}
            className="p-1.5 bg-slate-800 hover:bg-rose-600 text-slate-300 hover:text-white rounded-xl transition border border-slate-700"
            title="Close (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* ── Main Media Display Stage ── */}
      <div className="relative flex-1 flex items-center justify-center my-3 overflow-hidden">
        
        {/* Prev Arrow */}
        {items.length > 1 && (
          <button
            onClick={handlePrev}
            className="absolute left-3 z-20 p-3 bg-slate-900/80 hover:bg-slate-800 text-white rounded-2xl border border-slate-700/80 transition shadow-xl hover:scale-105 active:scale-95"
            title="Previous (Left Arrow)"
          >
            <ChevronLeft className="w-6 h-6 text-slate-200" />
          </button>
        )}

        {/* Media Player / Image */}
        <div className="max-h-full max-w-full flex items-center justify-center p-2">
          {current.type?.startsWith('video/') ? (
            <video
              src={current.url}
              controls
              autoPlay
              className="max-h-[75vh] max-w-full rounded-2xl object-contain shadow-2xl border border-slate-800"
            />
          ) : (
            <img
              src={current.url}
              alt={current.name || 'Enlarged view'}
              className="max-h-[75vh] max-w-full rounded-2xl object-contain shadow-2xl transition-all duration-200"
            />
          )}
        </div>

        {/* Next Arrow */}
        {items.length > 1 && (
          <button
            onClick={handleNext}
            className="absolute right-3 z-20 p-3 bg-slate-900/80 hover:bg-slate-800 text-white rounded-2xl border border-slate-700/80 transition shadow-xl hover:scale-105 active:scale-95"
            title="Next (Right Arrow)"
          >
            <ChevronRight className="w-6 h-6 text-slate-200" />
          </button>
        )}
      </div>

      {/* ── Bottom Thumbnail Strip ── */}
      {items.length > 1 && (
        <div className="flex items-center justify-center gap-2 overflow-x-auto py-2 px-4 max-w-full border-t border-slate-800/80">
          {items.map((item, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentIndex(idx)}
              className={`relative w-14 h-14 rounded-xl overflow-hidden border-2 shrink-0 transition-all ${
                idx === currentIndex
                  ? 'border-blue-500 scale-105 ring-2 ring-blue-500/50 shadow-lg'
                  : 'border-slate-800 opacity-50 hover:opacity-100 hover:border-slate-600'
              }`}
            >
              <img
                src={item.thumbnailUrl || item.url}
                alt={`Thumbnail ${idx + 1}`}
                className="w-full h-full object-cover"
              />
            </button>
          ))}
        </div>
      )}

    </div>
  );
};
