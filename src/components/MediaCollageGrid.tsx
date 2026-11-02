import React from 'react';
import { Play, Film } from 'lucide-react';

export interface CollageMediaItem {
  googleDriveId?: string;
  fileName?: string;
  mimeType?: string;
  viewUrl: string;
  thumbnailUrl?: string;
}

interface MediaCollageGridProps {
  media: CollageMediaItem[];
  onOpenLightbox: (index: number) => void;
  className?: string;
}

export const MediaCollageGrid: React.FC<MediaCollageGridProps> = ({
  media,
  onOpenLightbox,
  className = ''
}) => {
  if (!media || media.length === 0) return null;

  const count = media.length;

  // ── 1 Photo or Video ──
  if (count === 1) {
    const item = media[0];
    const isVideo = item.mimeType?.startsWith('video/');
    return (
      <div 
        onClick={() => onOpenLightbox(0)}
        className={`relative w-full rounded-2xl overflow-hidden bg-slate-950 aspect-video sm:aspect-[16/9] max-h-[460px] cursor-pointer group shadow-sm ${className}`}
      >
        {isVideo ? (
          <div className="w-full h-full flex flex-col items-center justify-center relative">
            <video
              src={item.viewUrl}
              playsInline
              preload="metadata"
              className="w-full h-full object-contain pointer-events-none"
            />
            {/* Play Button Overlay */}
            <div className="absolute inset-0 bg-black/30 group-hover:bg-black/20 flex items-center justify-center transition">
              <div className="w-14 h-14 rounded-full bg-blue-600/90 text-white flex items-center justify-center shadow-xl group-hover:scale-110 transition">
                <Play className="w-6 h-6 ml-0.5 fill-white" />
              </div>
            </div>
            <span className="text-[10px] font-mono text-slate-300 absolute bottom-3 left-3 bg-black/60 px-2 py-0.5 rounded truncate max-w-[80%] flex items-center gap-1">
              <Film className="w-3 h-3 text-blue-400" />
              {item.fileName}
            </span>
          </div>
        ) : (
          <img
            src={item.viewUrl}
            alt={item.fileName || 'Memory photo'}
            className="w-full h-full object-contain group-hover:scale-[1.02] transition duration-300"
            loading="lazy"
          />
        )}
        {item.mimeType === 'image/gif' && (
          <span className="absolute top-3 left-3 bg-purple-600/90 text-white text-[9px] font-black px-2 py-0.5 rounded shadow-sm">
            GIF
          </span>
        )}
      </div>
    );
  }

  // Helper tile renderer
  const renderTile = (item: CollageMediaItem, idx: number, extraOverlay?: React.ReactNode) => {
    const isVideo = item.mimeType?.startsWith('video/');
    return (
      <div
        key={item.googleDriveId || idx}
        onClick={() => onOpenLightbox(idx)}
        className="relative w-full h-full bg-slate-900 overflow-hidden cursor-pointer group select-none"
      >
        <img
          src={item.thumbnailUrl || item.viewUrl}
          alt={item.fileName || `Photo ${idx + 1}`}
          className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
          loading="lazy"
        />

        {/* Video Play Overlay */}
        {isVideo && (
          <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
            <div className="w-10 h-10 rounded-full bg-black/60 border border-white/40 text-white flex items-center justify-center shadow-lg group-hover:scale-110 transition">
              <Play className="w-4 h-4 ml-0.5 fill-white" />
            </div>
          </div>
        )}

        {/* GIF badge */}
        {item.mimeType === 'image/gif' && (
          <span className="absolute top-2 left-2 bg-purple-600/90 text-white text-[9px] font-black px-1.5 py-0.5 rounded shadow-xs">
            GIF
          </span>
        )}

        {/* Custom extra overlay (e.g. +3 more) */}
        {extraOverlay}
      </div>
    );
  };

  // ── 2 Photos: Side by Side (50% / 50%) ──
  if (count === 2) {
    return (
      <div className={`grid grid-cols-2 gap-1.5 rounded-2xl overflow-hidden aspect-[16/10] sm:aspect-[16/9] bg-slate-950 ${className}`}>
        {renderTile(media[0], 0)}
        {renderTile(media[1], 1)}
      </div>
    );
  }

  // ── 3 Photos: 1 Tall Left (60%), 2 Stacked Right (40%) ──
  if (count === 3) {
    return (
      <div className={`grid grid-cols-3 grid-rows-2 gap-1.5 rounded-2xl overflow-hidden aspect-[16/10] sm:aspect-[16/9] bg-slate-950 ${className}`}>
        <div className="col-span-2 row-span-2 h-full">
          {renderTile(media[0], 0)}
        </div>
        <div className="col-span-1 row-span-1 h-full">
          {renderTile(media[1], 1)}
        </div>
        <div className="col-span-1 row-span-1 h-full">
          {renderTile(media[2], 2)}
        </div>
      </div>
    );
  }

  // ── 4 Photos: 2x2 Equal Grid ──
  if (count === 4) {
    return (
      <div className={`grid grid-cols-2 grid-rows-2 gap-1.5 rounded-2xl overflow-hidden aspect-square sm:aspect-[16/10] bg-slate-950 ${className}`}>
        {renderTile(media[0], 0)}
        {renderTile(media[1], 1)}
        {renderTile(media[2], 2)}
        {renderTile(media[3], 3)}
      </div>
    );
  }

  // ── 5+ Photos: 2x2 Grid with +N Overlay on the 4th tile ──
  const remaining = count - 4;
  return (
    <div className={`grid grid-cols-2 grid-rows-2 gap-1.5 rounded-2xl overflow-hidden aspect-square sm:aspect-[16/10] bg-slate-950 ${className}`}>
      {renderTile(media[0], 0)}
      {renderTile(media[1], 1)}
      {renderTile(media[2], 2)}
      {renderTile(
        media[3],
        3,
        <div className="absolute inset-0 bg-black/65 backdrop-blur-xs flex flex-col items-center justify-center text-white group-hover:bg-black/75 transition">
          <span className="text-2xl sm:text-3xl font-black tracking-tight">+{remaining + 1}</span>
          <span className="text-[11px] font-bold text-slate-200">More Photos</span>
        </div>
      )}
    </div>
  );
};
