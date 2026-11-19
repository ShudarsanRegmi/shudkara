import React, { useRef, useEffect, useCallback } from 'react';
import { Clock, Sparkles } from 'lucide-react';

interface ModernTimeWheelPickerProps {
  value?: string; // "HH:mm" (24-hour format e.g. "13:08" or "08:45")
  onChange: (time24: string) => void;
  className?: string;
  label?: string;
}

export function getCurrentLocalTime24(): string {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

export function parse24to12(timeStr?: string): { hour: number; minute: number; isPm: boolean } {
  const effective = timeStr && timeStr.length >= 4 ? timeStr : getCurrentLocalTime24();
  const [hStr, mStr] = effective.split(':');
  let h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);
  if (isNaN(h)) h = new Date().getHours();
  const isPm = h >= 12;
  let h12 = h % 12;
  if (h12 === 0) h12 = 12;
  return {
    hour: h12,
    minute: isNaN(m) ? new Date().getMinutes() : Math.min(59, Math.max(0, m)),
    isPm
  };
}

export function format12to24(hour12: number, minute: number, isPm: boolean): string {
  let h24 = hour12 % 12;
  if (isPm) h24 += 12;
  const hh = String(h24).padStart(2, '0');
  const mm = String(minute).padStart(2, '0');
  return `${hh}:${mm}`;
}

// ── Web Audio API Tick Synthesizer (Realistic iPhone Crown / Mechanical Wheel Click) ──
let audioCtx: AudioContext | null = null;
function playTickSound() {
  try {
    if (!audioCtx) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) audioCtx = new AudioContextClass();
    }
    if (audioCtx) {
      if (audioCtx.state === 'suspended') {
        audioCtx.resume().catch(() => {});
      }
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      // Sharp micro-click impulse (1200Hz down to 250Hz in 12ms)
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(1400, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(280, audioCtx.currentTime + 0.012);

      gain.gain.setValueAtTime(0.045, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0005, audioCtx.currentTime + 0.012);

      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.012);
    }
  } catch {
    // Autoplay restrictions or headless browsers
  }

  // Tactile haptic feedback on supported mobile devices
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try { navigator.vibrate?.(5); } catch {}
  }
}

const HOURS = Array.from({ length: 12 }, (_, i) => i + 1); // 1..12
const MINUTES = Array.from({ length: 60 }, (_, i) => i); // 00..59
const PERIODS = ['AM', 'PM'] as const;

const ITEM_HEIGHT = 44; // standard iOS row height (px)

export const ModernTimeWheelPicker: React.FC<ModernTimeWheelPickerProps> = ({
  value,
  onChange,
  className = '',
  label = 'Moment Time'
}) => {
  const effectiveValue = value || getCurrentLocalTime24();
  const { hour, minute, isPm } = parse24to12(effectiveValue);

  const hoursContainerRef = useRef<HTMLDivElement>(null);
  const minutesContainerRef = useRef<HTMLDivElement>(null);
  const periodsContainerRef = useRef<HTMLDivElement>(null);

  const isUserScrollingRef = useRef(false);
  const scrollTimeoutRef = useRef<any>(null);

  const prevHourRef = useRef(hour);
  const prevMinRef = useRef(minute);
  const prevPeriodRef = useRef(isPm);

  // Sync scroll positions when value prop changes externally (e.g. initial load or reset to now)
  const syncScrollPositions = useCallback((h: number, m: number, pm: boolean, smooth = false) => {
    const behavior: ScrollBehavior = smooth ? 'smooth' : 'auto';

    // Hours (1..12 -> index 0..11)
    const hourIdx = HOURS.indexOf(h);
    if (hoursContainerRef.current && hourIdx >= 0) {
      hoursContainerRef.current.scrollTo({ top: hourIdx * ITEM_HEIGHT, behavior });
    }

    // Minutes (0..59 -> index 0..59)
    if (minutesContainerRef.current && m >= 0 && m < 60) {
      minutesContainerRef.current.scrollTo({ top: m * ITEM_HEIGHT, behavior });
    }

    // Period (AM = index 0, PM = index 1)
    const periodIdx = pm ? 1 : 0;
    if (periodsContainerRef.current) {
      periodsContainerRef.current.scrollTo({ top: periodIdx * ITEM_HEIGHT, behavior });
    }
  }, []);

  // Initial and reactive alignment
  useEffect(() => {
    if (!isUserScrollingRef.current) {
      syncScrollPositions(hour, minute, isPm, false);
    }
  }, [hour, minute, isPm, syncScrollPositions]);

  // Handle Scroll on Hours
  const handleHoursScroll = () => {
    if (!hoursContainerRef.current) return;
    isUserScrollingRef.current = true;
    clearTimeout(scrollTimeoutRef.current);

    const st = hoursContainerRef.current.scrollTop;
    const idx = Math.min(HOURS.length - 1, Math.max(0, Math.round(st / ITEM_HEIGHT)));
    const targetH = HOURS[idx];

    if (targetH !== prevHourRef.current) {
      prevHourRef.current = targetH;
      playTickSound();
      onChange(format12to24(targetH, minute, isPm));
    }

    scrollTimeoutRef.current = setTimeout(() => {
      isUserScrollingRef.current = false;
    }, 150);
  };

  // Handle Scroll on Minutes
  const handleMinutesScroll = () => {
    if (!minutesContainerRef.current) return;
    isUserScrollingRef.current = true;
    clearTimeout(scrollTimeoutRef.current);

    const st = minutesContainerRef.current.scrollTop;
    const idx = Math.min(MINUTES.length - 1, Math.max(0, Math.round(st / ITEM_HEIGHT)));
    const targetM = MINUTES[idx];

    if (targetM !== prevMinRef.current) {
      prevMinRef.current = targetM;
      playTickSound();
      onChange(format12to24(hour, targetM, isPm));
    }

    scrollTimeoutRef.current = setTimeout(() => {
      isUserScrollingRef.current = false;
    }, 150);
  };

  // Handle Scroll on Periods
  const handlePeriodsScroll = () => {
    if (!periodsContainerRef.current) return;
    isUserScrollingRef.current = true;
    clearTimeout(scrollTimeoutRef.current);

    const st = periodsContainerRef.current.scrollTop;
    const idx = Math.min(PERIODS.length - 1, Math.max(0, Math.round(st / ITEM_HEIGHT)));
    const targetPm = idx === 1;

    if (targetPm !== prevPeriodRef.current) {
      prevPeriodRef.current = targetPm;
      playTickSound();
      onChange(format12to24(hour, minute, targetPm));
    }

    scrollTimeoutRef.current = setTimeout(() => {
      isUserScrollingRef.current = false;
    }, 150);
  };

  // Mouse wheel step navigation for desktop
  const handleColumnWheel = (
    e: React.WheelEvent,
    type: 'hour' | 'minute' | 'period'
  ) => {
    e.preventDefault();
    e.stopPropagation();
    const delta = e.deltaY > 0 ? 1 : -1;

    if (type === 'hour') {
      let nextH = hour + delta;
      if (nextH > 12) nextH = 1;
      if (nextH < 1) nextH = 12;
      playTickSound();
      onChange(format12to24(nextH, minute, isPm));
      syncScrollPositions(nextH, minute, isPm, true);
    } else if (type === 'minute') {
      const step = e.shiftKey ? 5 : 1;
      const nextM = (minute + (delta * step) + 60) % 60;
      playTickSound();
      onChange(format12to24(hour, nextM, isPm));
      syncScrollPositions(hour, nextM, isPm, true);
    } else if (type === 'period') {
      playTickSound();
      onChange(format12to24(hour, minute, !isPm));
      syncScrollPositions(hour, minute, !isPm, true);
    }
  };

  // Click on a specific row
  const selectHour = (h: number) => {
    playTickSound();
    onChange(format12to24(h, minute, isPm));
    syncScrollPositions(h, minute, isPm, true);
  };

  const selectMinute = (m: number) => {
    playTickSound();
    onChange(format12to24(hour, m, isPm));
    syncScrollPositions(hour, m, isPm, true);
  };

  const selectPeriod = (pm: boolean) => {
    playTickSound();
    onChange(format12to24(hour, minute, pm));
    syncScrollPositions(hour, minute, pm, true);
  };

  const formattedDisplay = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')} ${isPm ? 'PM' : 'AM'}`;

  return (
    <div className={`bg-slate-50/90 border border-slate-200/90 rounded-2xl p-3 sm:p-3.5 space-y-2.5 select-none ${className}`}>
      
      {/* ── Top Readout & Quick Current Time Reset ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
            <Clock className="w-3.5 h-3.5 text-blue-600" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}:</span>
            <span className="text-xs sm:text-sm font-black text-slate-900 font-mono tracking-tight">
              {formattedDisplay}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            playTickSound();
            const now = getCurrentLocalTime24();
            onChange(now);
            const p = parse24to12(now);
            syncScrollPositions(p.hour, p.minute, p.isPm, true);
          }}
          className="px-2.5 py-1 bg-white hover:bg-blue-50 text-blue-700 border border-slate-200 hover:border-blue-300 rounded-xl text-[11px] font-bold transition flex items-center gap-1 shadow-2xs active:scale-95 cursor-pointer"
          title="Reset to current local clock"
        >
          <Sparkles className="w-3 h-3 text-blue-500" />
          <span>Now</span>
        </button>
      </div>

      {/* ── iPhone Style 3-Column Scrollable Wheel Boxes (No Arrows, Native Snap) ── */}
      <div className="relative bg-white border border-slate-200 rounded-2xl p-1.5 shadow-inner flex items-center justify-center gap-1.5 sm:gap-3 overflow-hidden h-[150px]">
        
        {/* Optical center lens highlight band across all 3 columns */}
        <div 
          className="absolute inset-x-2 top-1/2 -translate-y-1/2 h-[44px] bg-slate-100/90 border-y border-slate-300/80 rounded-xl pointer-events-none z-0" 
        />

        {/* ── Box 1: Hours (1..12) ── */}
        <div className="flex-1 flex flex-col items-center h-full relative z-10">
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider -mb-0.5 z-20">Hour</span>
          <div
            ref={hoursContainerRef}
            onScroll={handleHoursScroll}
            onWheel={(e) => handleColumnWheel(e, 'hour')}
            className="w-full h-full overflow-y-auto snap-y snap-mandatory scroll-smooth no-scrollbar"
            style={{
              paddingTop: 'calc(75px - 22px)',
              paddingBottom: 'calc(75px - 22px)',
              scrollbarWidth: 'none',
              msOverflowStyle: 'none'
            }}
          >
            {HOURS.map((h) => {
              const isSelected = h === hour;
              return (
                <div
                  key={h}
                  onClick={() => selectHour(h)}
                  className={`h-[44px] flex items-center justify-center snap-center cursor-pointer font-mono transition-all duration-150 ${
                    isSelected
                      ? 'text-lg sm:text-xl font-black text-blue-600 scale-105'
                      : 'text-sm font-semibold text-slate-300 hover:text-slate-500 scale-95'
                  }`}
                >
                  {String(h).padStart(2, '0')}
                </div>
              );
            })}
          </div>
        </div>

        {/* Colon Divider */}
        <div className="text-xl sm:text-2xl font-black text-slate-300 font-mono select-none z-10 -mt-1">
          :
        </div>

        {/* ── Box 2: Minutes (00..59) ── */}
        <div className="flex-1 flex flex-col items-center h-full relative z-10">
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider -mb-0.5 z-20">Min</span>
          <div
            ref={minutesContainerRef}
            onScroll={handleMinutesScroll}
            onWheel={(e) => handleColumnWheel(e, 'minute')}
            className="w-full h-full overflow-y-auto snap-y snap-mandatory scroll-smooth no-scrollbar"
            style={{
              paddingTop: 'calc(75px - 22px)',
              paddingBottom: 'calc(75px - 22px)',
              scrollbarWidth: 'none',
              msOverflowStyle: 'none'
            }}
          >
            {MINUTES.map((m) => {
              const isSelected = m === minute;
              return (
                <div
                  key={m}
                  onClick={() => selectMinute(m)}
                  className={`h-[44px] flex items-center justify-center snap-center cursor-pointer font-mono transition-all duration-150 ${
                    isSelected
                      ? 'text-lg sm:text-xl font-black text-blue-600 scale-105'
                      : 'text-sm font-semibold text-slate-300 hover:text-slate-500 scale-95'
                  }`}
                >
                  {String(m).padStart(2, '0')}
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Box 3: Period (AM / PM) ── */}
        <div className="w-16 sm:w-20 flex flex-col items-center h-full relative z-10">
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider -mb-0.5 z-20">AM / PM</span>
          <div
            ref={periodsContainerRef}
            onScroll={handlePeriodsScroll}
            onWheel={(e) => handleColumnWheel(e, 'period')}
            className="w-full h-full overflow-y-auto snap-y snap-mandatory scroll-smooth no-scrollbar"
            style={{
              paddingTop: 'calc(75px - 22px)',
              paddingBottom: 'calc(75px - 22px)',
              scrollbarWidth: 'none',
              msOverflowStyle: 'none'
            }}
          >
            {PERIODS.map((p) => {
              const isSelected = (p === 'PM') === isPm;
              return (
                <div
                  key={p}
                  onClick={() => selectPeriod(p === 'PM')}
                  className={`h-[44px] flex items-center justify-center snap-center cursor-pointer font-sans transition-all duration-150 ${
                    isSelected
                      ? 'text-sm sm:text-base font-black text-blue-600 scale-105'
                      : 'text-xs font-semibold text-slate-300 hover:text-slate-500 scale-95'
                  }`}
                >
                  {p}
                </div>
              );
            })}
          </div>
        </div>

      </div>

    </div>
  );
};
