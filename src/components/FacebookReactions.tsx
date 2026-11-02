import React, { useState, useRef, useEffect } from 'react';
import { ThumbsUp, Heart, Laugh, Sparkles, Frown, Flame } from 'lucide-react';

export interface FBReactionConfig {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  fill: string;
  badgeBg: string;
  ringColor: string;
}

export const FB_REACTIONS: FBReactionConfig[] = [
  { id: 'like', label: 'Like', icon: ThumbsUp, color: 'text-blue-600', fill: 'fill-blue-600', badgeBg: 'bg-blue-600 text-white', ringColor: 'ring-blue-500' },
  { id: 'love', label: 'Love', icon: Heart, color: 'text-rose-500', fill: 'fill-rose-500', badgeBg: 'bg-rose-500 text-white', ringColor: 'ring-rose-500' },
  { id: 'haha', label: 'Haha', icon: Laugh, color: 'text-amber-500', fill: 'fill-amber-500', badgeBg: 'bg-amber-500 text-white', ringColor: 'ring-amber-500' },
  { id: 'wow', label: 'Wow', icon: Sparkles, color: 'text-purple-500', fill: 'fill-purple-500', badgeBg: 'bg-purple-600 text-white', ringColor: 'ring-purple-500' },
  { id: 'sad', label: 'Sad', icon: Frown, color: 'text-sky-500', fill: 'fill-sky-500', badgeBg: 'bg-sky-500 text-white', ringColor: 'ring-sky-500' },
  { id: 'fire', label: 'Fire', icon: Flame, color: 'text-orange-500', fill: 'fill-orange-500', badgeBg: 'bg-orange-500 text-white', ringColor: 'ring-orange-500' }
];

export function getReactionConfig(key: string): FBReactionConfig {
  const norm = (key || '').toLowerCase();
  if (norm === 'like' || norm === '👍') return FB_REACTIONS[0];
  if (norm === 'love' || norm === '❤️') return FB_REACTIONS[1];
  if (norm === 'haha' || norm === '😂') return FB_REACTIONS[2];
  if (norm === 'wow' || norm === '🎉' || norm === '💡') return FB_REACTIONS[3];
  if (norm === 'sad' || norm === '😢') return FB_REACTIONS[4];
  if (norm === 'fire' || norm === '🔥') return FB_REACTIONS[5];
  return FB_REACTIONS[0];
}

// ── Overlapping Circular Icon Badge ──
export const FBReactionBadge: React.FC<{ reactionKey: string; size?: 'sm' | 'md' | 'lg' }> = ({
  reactionKey,
  size = 'md'
}) => {
  const config = getReactionConfig(reactionKey);
  const IconComp = config.icon;

  const sizeClasses = {
    sm: 'w-4 h-4 text-[9px]',
    md: 'w-5 h-5 text-[11px]',
    lg: 'w-7 h-7 text-xs'
  }[size];

  const iconSizeClasses = {
    sm: 'w-2.5 h-2.5',
    md: 'w-3 h-3',
    lg: 'w-4 h-4'
  }[size];

  return (
    <div
      className={`rounded-full flex items-center justify-center shadow-xs ring-2 ring-white shrink-0 ${config.badgeBg} ${sizeClasses}`}
      title={config.label}
    >
      <IconComp className={`${iconSizeClasses} fill-current text-white`} />
    </div>
  );
};

// ── Facebook-Style Overlapping Summary Component ──
interface FBReactionSummaryProps {
  reactions: Array<{ emoji: string; name: string }>;
  onOpenReactionsModal?: () => void;
  className?: string;
}

export const FBReactionSummary: React.FC<FBReactionSummaryProps> = ({
  reactions,
  onOpenReactionsModal,
  className = ''
}) => {
  if (!reactions || reactions.length === 0) return null;

  // Find distinct reaction types in order of frequency
  const countsMap: Record<string, number> = {};
  reactions.forEach(r => {
    const norm = r.emoji;
    countsMap[norm] = (countsMap[norm] || 0) + 1;
  });

  const sortedKeys = Object.keys(countsMap).sort((a, b) => countsMap[b] - countsMap[a]);
  const topKeys = sortedKeys.slice(0, 3);
  const names = Array.from(new Set(reactions.map(r => r.name)));

  const namesSummary = names.length === 1
    ? names[0]
    : names.length === 2
    ? `${names[0]} and ${names[1]}`
    : `${names[0]}, ${names[1]} and ${names.length - 2} others`;

  return (
    <div
      onClick={onOpenReactionsModal}
      className={`flex items-center gap-1.5 text-xs text-slate-600 select-none cursor-pointer hover:underline ${className}`}
      title={names.join(', ')}
    >
      {/* Stacked overlapping circle badges */}
      <div className="flex items-center -space-x-1.5">
        {topKeys.map(k => (
          <FBReactionBadge key={k} reactionKey={k} size="sm" />
        ))}
      </div>

      <span className="font-bold text-slate-800">{reactions.length}</span>
      <span className="text-[11px] text-slate-500 hidden sm:inline truncate max-w-xs">
        {namesSummary}
      </span>
    </div>
  );
};

// ── Facebook Floating Reaction Dock (Hover & Tap) ──
interface FBReactionDockProps {
  activeReactionKey?: string | null;
  onSelectReaction: (reactionId: string) => void;
  onQuickToggle: () => void;
  disabled?: boolean;
}

export const FBReactionDock: React.FC<FBReactionDockProps> = ({
  activeReactionKey,
  onSelectReaction,
  onQuickToggle,
  disabled = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dockRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<any>(null);

  const activeConfig = activeReactionKey ? getReactionConfig(activeReactionKey) : null;
  const ActiveIcon = activeConfig ? activeConfig.icon : ThumbsUp;

  // Handle hover enter with brief delay
  const handleMouseEnter = () => {
    if (disabled) return;
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setIsOpen(true), 150);
  };

  const handleMouseLeave = () => {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setIsOpen(false), 250);
  };

  useEffect(() => {
    return () => clearTimeout(timerRef.current);
  }, []);

  return (
    <div
      ref={dockRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className="relative inline-block"
    >
      {/* Floating Facebook Reactions Dock */}
      {isOpen && (
        <div
          className="absolute bottom-full left-0 mb-2 z-50 bg-white border border-slate-200/90 rounded-full shadow-2xl p-1.5 flex items-center gap-1.5 animate-in fade-in slide-in-from-bottom-2 duration-150 ring-1 ring-black/5"
          onClick={e => e.stopPropagation()}
        >
          {FB_REACTIONS.map(reaction => {
            const Icon = reaction.icon;
            const isCurrent = activeReactionKey && getReactionConfig(activeReactionKey).id === reaction.id;

            return (
              <button
                key={reaction.id}
                type="button"
                onClick={() => {
                  onSelectReaction(reaction.id);
                  setIsOpen(false);
                }}
                className={`p-2 rounded-full transition-all duration-200 flex items-center justify-center group relative hover:scale-130 hover:-translate-y-1 ${
                  isCurrent ? `${reaction.badgeBg} ring-2 ring-offset-1 ${reaction.ringColor}` : 'hover:bg-slate-100'
                }`}
                title={reaction.label}
              >
                <Icon className={`w-5 h-5 ${isCurrent ? 'fill-white text-white' : `${reaction.color} ${reaction.fill}`}`} />
                {/* Tooltip label */}
                <span className="absolute -top-7 scale-0 group-hover:scale-100 bg-slate-900 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-md whitespace-nowrap transition-transform duration-150 pointer-events-none">
                  {reaction.label}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Main Trigger Button */}
      <button
        type="button"
        onClick={() => {
          if (!activeReactionKey) {
            onSelectReaction('like');
          } else {
            onQuickToggle();
          }
        }}
        disabled={disabled}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition shadow-xs select-none active:scale-95 ${
          activeConfig
            ? `${activeConfig.color} bg-slate-100 border border-slate-200 ring-1 ${activeConfig.ringColor}/30`
            : 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200'
        }`}
      >
        <ActiveIcon className={`w-4 h-4 ${activeConfig ? `${activeConfig.color} ${activeConfig.fill}` : 'text-slate-600'}`} />
        <span>{activeConfig ? activeConfig.label : 'Like'}</span>
      </button>
    </div>
  );
};
