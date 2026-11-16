import React, { useRef, useEffect } from 'react';
import { Clock, ChevronUp, ChevronDown, Sparkles } from 'lucide-react';

interface ModernTimeWheelPickerProps {
  value?: string; // "HH:mm" (24-hour format e.g. "13:08")
  onChange: (time24: string) => void;
  className?: string;
}

export function getCurrentLocalTime24(): string {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

export function parse24to12(timeStr?: string): { hour: number; minute: number; isPm: boolean } {
  const effective = timeStr || getCurrentLocalTime24();
  const [hStr, mStr] = effective.split(':');
  let h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);
  if (isNaN(h)) h = new Date().getHours();
  const isPm = h >= 12;
  let h12 = h % 12;
  if (h12 === 0) h12 = 12;
  return {
    hour: h12,
    minute: isNaN(m) ? new Date().getMinutes() : m,
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

export const ModernTimeWheelPicker: React.FC<ModernTimeWheelPickerProps> = ({
  value,
  onChange,
  className = ''
}) => {
  const effectiveValue = value || getCurrentLocalTime24();
  const { hour, minute, isPm } = parse24to12(effectiveValue);

  // Initialize with current time if empty
  useEffect(() => {
    if (!value) {
      onChange(getCurrentLocalTime24());
    }
  }, [value, onChange]);

  const updateTime = (newHour: number, newMinute: number, newIsPm: boolean) => {
    let validH = newHour;
    if (validH > 12) validH = 1;
    if (validH < 1) validH = 12;

    let validM = (newMinute + 60) % 60;
    const formatted24 = format12to24(validH, validM, newIsPm);
    onChange(formatted24);
  };

  // Wheel scroll handlers
  const handleHourWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const delta = e.deltaY > 0 ? 1 : -1;
    let nextH = hour + delta;
    if (nextH > 12) nextH = 1;
    if (nextH < 1) nextH = 12;
    updateTime(nextH, minute, isPm);
  };

  const handleMinuteWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const step = e.shiftKey ? 5 : 1;
    const delta = e.deltaY > 0 ? step : -step;
    const nextM = (minute + delta + 60) % 60;
    updateTime(hour, nextM, isPm);
  };

  const handleAmPmWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    e.stopPropagation();
    updateTime(hour, minute, !isPm);
  };

  // Touch swipe refs
  const touchStartYRef = useRef(0);
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartYRef.current = e.touches[0].clientY;
  };

  const handleHourTouchMove = (e: React.TouchEvent) => {
    const diff = touchStartYRef.current - e.touches[0].clientY;
    if (Math.abs(diff) > 25) {
      const delta = diff > 0 ? 1 : -1;
      let nextH = hour + delta;
      if (nextH > 12) nextH = 1;
      if (nextH < 1) nextH = 12;
      updateTime(nextH, minute, isPm);
      touchStartYRef.current = e.touches[0].clientY;
    }
  };

  const handleMinuteTouchMove = (e: React.TouchEvent) => {
    const diff = touchStartYRef.current - e.touches[0].clientY;
    if (Math.abs(diff) > 20) {
      const delta = diff > 0 ? 1 : -1;
      const nextM = (minute + delta + 60) % 60;
      updateTime(hour, nextM, isPm);
      touchStartYRef.current = e.touches[0].clientY;
    }
  };

  // Values before and after for 3-row drum effect
  const prevHour = hour === 1 ? 12 : hour - 1;
  const nextHour = hour === 12 ? 1 : hour + 1;

  const prevMinute = (minute - 1 + 60) % 60;
  const nextMinute = (minute + 1) % 60;

  // Preset quick times
  const presets = [
    { label: 'Now', action: () => onChange(getCurrentLocalTime24()) },
    { label: 'Morning (09:00)', action: () => onChange('09:00') },
    { label: 'Noon (12:00)', action: () => onChange('12:00') },
    { label: 'Sunset (18:00)', action: () => onChange('18:00') },
    { label: 'Night (21:30)', action: () => onChange('21:30') }
  ];

  const formattedDisplay = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')} ${isPm ? 'PM' : 'AM'}`;

  return (
    <div className={`bg-slate-50/90 border border-slate-200/90 rounded-2xl p-3 sm:p-4 space-y-3 select-none ${className}`}>
      
      {/* ── Top Readout & Reset to Now ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
            <Clock className="w-4 h-4 text-blue-600" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block -mb-0.5">Moment Time</span>
            <span className="text-sm sm:text-base font-black text-slate-900 font-mono tracking-tight">
              {formattedDisplay}
              <span className="text-[10px] text-slate-400 font-normal ml-1.5 font-sans">({effectiveValue})</span>
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onChange(getCurrentLocalTime24())}
          className="px-2.5 py-1 bg-white hover:bg-blue-50 text-blue-700 border border-slate-200 hover:border-blue-300 rounded-xl text-xs font-bold transition flex items-center gap-1 shadow-2xs active:scale-95"
          title="Reset to current real-time clock"
        >
          <Sparkles className="w-3 h-3 text-blue-500" />
          <span>Now</span>
        </button>
      </div>

      {/* ── Interactive 3-Column Drum Wheel Picker ── */}
      <div className="bg-white border border-slate-200 rounded-2xl p-2 sm:p-3 shadow-inner flex items-center justify-center gap-2 sm:gap-4 relative overflow-hidden">
        
        {/* Optical center lens highlight bar */}
        <div className="absolute inset-x-3 top-1/2 -translate-y-1/2 h-10 sm:h-12 bg-blue-50/80 border-y border-blue-200/80 rounded-xl pointer-events-none z-0" />

        {/* ── Hours Column ── */}
        <div className="flex flex-col items-center z-10 w-16 sm:w-20">
          <button
            type="button"
            onClick={() => updateTime(prevHour, minute, isPm)}
            className="p-1 text-slate-400 hover:text-slate-800 transition active:scale-90"
            title="Hour Up (Scroll up also works)"
          >
            <ChevronUp className="w-4 h-4" />
          </button>

          <div 
            onWheel={handleHourWheel}
            onTouchStart={handleTouchStart}
            onTouchMove={handleHourTouchMove}
            className="flex flex-col items-center justify-center py-1 cursor-ns-resize"
            title="Scroll mouse wheel over this column to change hour"
          >
            <span 
              onClick={() => updateTime(prevHour, minute, isPm)}
              className="text-xs sm:text-sm font-bold text-slate-300 font-mono py-0.5 cursor-pointer hover:text-slate-500 transition"
            >
              {String(prevHour).padStart(2, '0')}
            </span>
            <span className="text-xl sm:text-2xl font-black text-blue-600 font-mono py-0.5 scale-110 transition-transform">
              {String(hour).padStart(2, '0')}
            </span>
            <span 
              onClick={() => updateTime(nextHour, minute, isPm)}
              className="text-xs sm:text-sm font-bold text-slate-300 font-mono py-0.5 cursor-pointer hover:text-slate-500 transition"
            >
              {String(nextHour).padStart(2, '0')}
            </span>
          </div>

          <button
            type="button"
            onClick={() => updateTime(nextHour, minute, isPm)}
            className="p-1 text-slate-400 hover:text-slate-800 transition active:scale-90"
            title="Hour Down (Scroll down also works)"
          >
            <ChevronDown className="w-4 h-4" />
          </button>
          <span className="text-[9px] font-bold text-slate-400 uppercase mt-0.5">Hour</span>
        </div>

        {/* Colon Divider */}
        <div className="text-2xl sm:text-3xl font-black text-slate-300 font-mono select-none pt-2 z-10 animate-pulse">
          :
        </div>

        {/* ── Minutes Column ── */}
        <div className="flex flex-col items-center z-10 w-16 sm:w-20">
          <button
            type="button"
            onClick={() => updateTime(hour, prevMinute, isPm)}
            className="p-1 text-slate-400 hover:text-slate-800 transition active:scale-90"
            title="Minute Up (Scroll up also works)"
          >
            <ChevronUp className="w-4 h-4" />
          </button>

          <div 
            onWheel={handleMinuteWheel}
            onTouchStart={handleTouchStart}
            onTouchMove={handleMinuteTouchMove}
            className="flex flex-col items-center justify-center py-1 cursor-ns-resize"
            title="Scroll mouse wheel over this column to change minute"
          >
            <span 
              onClick={() => updateTime(hour, prevMinute, isPm)}
              className="text-xs sm:text-sm font-bold text-slate-300 font-mono py-0.5 cursor-pointer hover:text-slate-500 transition"
            >
              {String(prevMinute).padStart(2, '0')}
            </span>
            <span className="text-xl sm:text-2xl font-black text-blue-600 font-mono py-0.5 scale-110 transition-transform">
              {String(minute).padStart(2, '0')}
            </span>
            <span 
              onClick={() => updateTime(hour, nextMinute, isPm)}
              className="text-xs sm:text-sm font-bold text-slate-300 font-mono py-0.5 cursor-pointer hover:text-slate-500 transition"
            >
              {String(nextMinute).padStart(2, '0')}
            </span>
          </div>

          <button
            type="button"
            onClick={() => updateTime(hour, nextMinute, isPm)}
            className="p-1 text-slate-400 hover:text-slate-800 transition active:scale-90"
            title="Minute Down (Scroll down also works)"
          >
            <ChevronDown className="w-4 h-4" />
          </button>
          <span className="text-[9px] font-bold text-slate-400 uppercase mt-0.5">Min</span>
        </div>

        {/* ── AM / PM Toggle Column ── */}
        <div className="flex flex-col items-center z-10 w-16 sm:w-20 pl-1">
          <div 
            onWheel={handleAmPmWheel}
            className="flex flex-col items-center gap-1.5 p-1 bg-slate-100 rounded-xl border border-slate-200 cursor-pointer"
            title="Click or scroll to toggle AM/PM"
          >
            <button
              type="button"
              onClick={() => updateTime(hour, minute, false)}
              className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
                !isPm 
                  ? 'bg-blue-600 text-white shadow-xs scale-105' 
                  : 'text-slate-400 hover:text-slate-700'
              }`}
            >
              AM
            </button>
            <button
              type="button"
              onClick={() => updateTime(hour, minute, true)}
              className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
                isPm 
                  ? 'bg-blue-600 text-white shadow-xs scale-105' 
                  : 'text-slate-400 hover:text-slate-700'
              }`}
            >
              PM
            </button>
          </div>
          <span className="text-[9px] font-bold text-slate-400 uppercase mt-1">Period</span>
        </div>

      </div>

      {/* ── Quick Time Preset Chips ── */}
      <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
        <span className="text-[10px] font-bold text-slate-400 mr-0.5">Quick:</span>
        {presets.map((p, idx) => (
          <button
            key={idx}
            type="button"
            onClick={p.action}
            className="text-[10px] font-semibold px-2 py-0.5 bg-white hover:bg-slate-100 border border-slate-200 text-slate-600 rounded-md transition shadow-2xs active:scale-95"
          >
            {p.label}
          </button>
        ))}
      </div>

    </div>
  );
};
