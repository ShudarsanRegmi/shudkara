import React, { useState, useEffect, useRef } from 'react';
import {
  Bell,
  Clock,
  Calendar,
  Plus,
  Trash2,
  CheckCircle2,
  Smartphone,
  Volume2,
  AlertTriangle,
  RotateCw,
  X,
  Radio
} from 'lucide-react';

export interface AlarmItem {
  id: string;
  type: 'alarm' | 'reminder';
  title: string;
  label?: string;
  message?: string;
  hour?: number; // 0-23
  minutes?: number; // 0-59
  days?: number[]; // [1..7] Calendar.SUNDAY..SATURDAY
  targetDate?: string; // ISO string
  priority?: 'normal' | 'important' | 'urgent';
  notificationStyle?: 'clock_alarm' | 'in_app_popup' | 'web_push' | 'heads_up';
  isEnabled: boolean;
  isCompleted?: boolean;
  vibrate?: boolean;
  skipUi?: boolean;
  syncToDevice?: boolean;
  deviceSyncStatus?: 'pending' | 'synced' | 'failed' | 'skipped';
  syncedAt?: string | null;
  dismissedAt?: string | null;
  snoozedUntil?: string | null;
  createdAt: string;
  updatedAt: string;
}

interface AlarmsProps {
  authToken?: string | null;
}

const DAY_LABELS = [
  { day: 2, label: 'Mon', short: 'M' },
  { day: 3, label: 'Tue', short: 'T' },
  { day: 4, label: 'Wed', short: 'W' },
  { day: 5, label: 'Thu', short: 'T' },
  { day: 6, label: 'Fri', short: 'F' },
  { day: 7, label: 'Sat', short: 'S' },
  { day: 1, label: 'Sun', short: 'S' },
];

export function Alarms({ authToken }: AlarmsProps) {
  const [activeSubTab, setActiveSubTab] = useState<'alarms' | 'reminders'>('alarms');
  const [items, setItems] = useState<AlarmItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form states for System Alarm
  const [alarmHour, setAlarmHour] = useState<number>(7);
  const [alarmMinute, setAlarmMinute] = useState<number>(0);
  const [alarmAmPm, setAlarmAmPm] = useState<'AM' | 'PM'>('AM');
  const [alarmLabel, setAlarmLabel] = useState<string>('');
  const [alarmDays, setAlarmDays] = useState<number[]>([]);
  const [alarmVibrate, setAlarmVibrate] = useState<boolean>(true);
  const [alarmSyncDevice, setAlarmSyncDevice] = useState<boolean>(true);

  // Form states for Reminder
  const [reminderTitle, setReminderTitle] = useState<string>('');
  const [reminderNote, setReminderNote] = useState<string>('');
  const [reminderDate, setReminderDate] = useState<string>(() => {
    const d = new Date();
    d.setMinutes(d.getMinutes() + 30);
    return d.toISOString().slice(0, 16);
  });
  const [reminderPriority, setReminderPriority] = useState<'normal' | 'important' | 'urgent'>('important');
  const [reminderStyle, setReminderStyle] = useState<'clock_alarm' | 'in_app_popup' | 'web_push' | 'heads_up'>('in_app_popup');
  const [reminderSyncDevice, setReminderSyncDevice] = useState<boolean>(true);

  // In-app audio & alert modal state
  const [audioTesting, setAudioTesting] = useState(false);
  const [activeAlertItem, setActiveAlertItem] = useState<AlarmItem | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  // Fetch alarms from API
  const fetchAlarms = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const res = await fetch('/api/alarms', {
        headers: authToken ? { 'X-Session-Token': authToken } : {}
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setItems(data.alarms || []);
    } catch (err: any) {
      console.error('Failed to load alarms:', err);
      setErrorMsg('Could not fetch alarms. Offline mode or server unavailable.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlarms();
  }, [authToken]);

  // Audio tone generator using Web Audio API
  const playChime = (type: 'test' | 'alarm' = 'test') => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = audioCtxRef.current || new AudioCtx();
      audioCtxRef.current = ctx;

      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      setAudioTesting(true);

      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      if (type === 'alarm') {
        // Multi-frequency alert pattern
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(587.33, now); // D5
        osc.frequency.setValueAtTime(880.00, now + 0.15); // A5
        osc.frequency.setValueAtTime(587.33, now + 0.30);
        osc.frequency.setValueAtTime(880.00, now + 0.45);
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.65);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.65);
      } else {
        // Melodic test chime
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523.25, now); // C5
        osc.frequency.setValueAtTime(659.25, now + 0.12); // E5
        osc.frequency.setValueAtTime(783.99, now + 0.24); // G5
        osc.frequency.setValueAtTime(1046.50, now + 0.36); // C6
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.6);
      }

      setTimeout(() => setAudioTesting(false), 700);
    } catch (e) {
      console.warn('AudioContext playback error:', e);
      setAudioTesting(false);
    }
  };

  // Reminder trigger watcher (in-browser)
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      items.forEach(item => {
        if (item.type === 'reminder' && item.isEnabled && !item.isCompleted && item.targetDate) {
          const target = new Date(item.targetDate);
          // If within last 60 seconds
          const diff = now.getTime() - target.getTime();
          if (diff >= 0 && diff < 60000 && activeAlertItem?.id !== item.id) {
            setActiveAlertItem(item);
            playChime('alarm');
          }
        }
      });
    }, 5000);
    return () => clearInterval(timer);
  }, [items, activeAlertItem]);

  // Handle Day of Week toggle
  const toggleDay = (day: number) => {
    if (alarmDays.includes(day)) {
      setAlarmDays(alarmDays.filter(d => d !== day));
    } else {
      setAlarmDays([...alarmDays, day]);
    }
  };

  // Submit System Alarm
  const handleCreateAlarm = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      let finalHour = alarmHour;
      if (alarmAmPm === 'PM' && finalHour < 12) finalHour += 12;
      if (alarmAmPm === 'AM' && finalHour === 12) finalHour = 0;

      const payload = {
        type: 'alarm',
        title: alarmLabel.trim() || `Alarm ${alarmHour}:${String(alarmMinute).padStart(2, '0')} ${alarmAmPm}`,
        label: alarmLabel.trim() || undefined,
        hour: finalHour,
        minutes: alarmMinute,
        days: alarmDays,
        vibrate: alarmVibrate,
        skipUi: true,
        syncToDevice: alarmSyncDevice,
        isEnabled: true
      };

      const res = await fetch('/api/alarms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { 'X-Session-Token': authToken } : {})
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setItems([data.alarm, ...items]);
      setAlarmLabel('');
      setSuccessMsg('Alarm saved! Flagged for Android Companion sync.');
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      console.error('Failed to create alarm:', err);
      setErrorMsg('Failed to save alarm.');
    }
  };

  // Submit In-App Reminder
  const handleCreateReminder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reminderTitle.trim()) return;

    try {
      const payload = {
        type: 'reminder',
        title: reminderTitle.trim(),
        message: reminderNote.trim() || undefined,
        targetDate: new Date(reminderDate).toISOString(),
        priority: reminderPriority,
        notificationStyle: reminderStyle,
        syncToDevice: reminderSyncDevice,
        isEnabled: true,
        dispatchPush: reminderStyle === 'web_push'
      };

      const res = await fetch('/api/alarms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { 'X-Session-Token': authToken } : {})
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setItems([data.alarm, ...items]);
      setReminderTitle('');
      setReminderNote('');
      setSuccessMsg('Reminder scheduled!');
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      console.error('Failed to create reminder:', err);
      setErrorMsg('Failed to schedule reminder.');
    }
  };

  // Toggle active/inactive
  const toggleAlarmState = async (item: AlarmItem) => {
    try {
      const updated = !item.isEnabled;
      setItems(items.map(i => (i.id === item.id ? { ...i, isEnabled: updated } : i)));

      await fetch(`/api/alarms/${item.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { 'X-Session-Token': authToken } : {})
        },
        body: JSON.stringify({ isEnabled: updated })
      });
    } catch (err) {
      console.error('Failed to toggle alarm:', err);
    }
  };

  // Delete alarm or reminder
  const deleteItem = async (id: string) => {
    try {
      setItems(items.filter(i => i.id !== id));
      await fetch(`/api/alarms/${id}`, {
        method: 'DELETE',
        headers: authToken ? { 'X-Session-Token': authToken } : {}
      });
    } catch (err) {
      console.error('Failed to delete alarm:', err);
    }
  };

  // Trigger test push
  const handleTestPush = async () => {
    try {
      const res = await fetch('/api/alarms/test-trigger', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { 'X-Session-Token': authToken } : {})
        },
        body: JSON.stringify({
          title: '⏰ Shudkara Alarm Test',
          message: 'Audio chime and push notification tested successfully!'
        })
      });
      playChime('alarm');
      if (res.ok) {
        setSuccessMsg('Dispatched test alarm notification & tone!');
        setTimeout(() => setSuccessMsg(null), 3000);
      }
    } catch (err) {
      playChime('alarm');
    }
  };

  const filteredItems = items.filter(i =>
    activeSubTab === 'alarms' ? i.type === 'alarm' : i.type === 'reminder'
  );

  return (
    <div className="space-y-6">
      {/* Top Banner / Header */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2.5 bg-amber-50 rounded-xl text-amber-600">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">Alarms & Reminders</h1>
              <p className="text-xs text-slate-500">
                Schedule system alarms on your Android device and manage in-app auditory reminders
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Audio Chime Test Button */}
          <button
            onClick={() => playChime('test')}
            disabled={audioTesting}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition"
            title="Test Browser Sound"
          >
            <Volume2 className={`w-3.5 h-3.5 ${audioTesting ? 'text-amber-500 animate-pulse' : 'text-slate-500'}`} />
            <span>Test Chime</span>
          </button>

          {/* Cloud Push Test Button */}
          <button
            onClick={handleTestPush}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-amber-500 hover:bg-amber-600 text-white rounded-xl shadow-xs transition"
          >
            <Radio className="w-3.5 h-3.5" />
            <span>Test Alert Push</span>
          </button>

          <button
            onClick={fetchAlarms}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition"
            title="Refresh"
          >
            <RotateCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Sub-Tab Navigation */}
      <div className="flex gap-2 p-1 bg-slate-100/80 rounded-2xl max-w-sm">
        <button
          onClick={() => setActiveSubTab('alarms')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold rounded-xl transition ${
            activeSubTab === 'alarms'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Clock className="w-4 h-4 text-amber-500" />
          <span>System Alarms</span>
        </button>
        <button
          onClick={() => setActiveSubTab('reminders')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold rounded-xl transition ${
            activeSubTab === 'reminders'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Calendar className="w-4 h-4 text-indigo-500" />
          <span>In-App Reminders</span>
        </button>
      </div>

      {/* Messages */}
      {successMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium rounded-xl flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}
      {errorMsg && (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium rounded-xl flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* TAB 1: SYSTEM ALARMS */}
      {activeSubTab === 'alarms' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Alarm Form */}
          <div className="lg:col-span-1 bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs space-y-5">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
              <Clock className="w-4 h-4 text-amber-500" />
              <h2 className="text-sm font-bold text-slate-900">Set New System Alarm</h2>
            </div>

            <form onSubmit={handleCreateAlarm} className="space-y-4">
              {/* Time Picker */}
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Alarm Time
                </label>
                <div className="flex items-center gap-2">
                  <select
                    value={alarmHour}
                    onChange={e => setAlarmHour(Number(e.target.value))}
                    className="flex-1 p-2.5 text-center font-bold text-lg bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500 outline-hidden"
                  >
                    {Array.from({ length: 12 }, (_, i) => i + 1).map(h => (
                      <option key={h} value={h}>
                        {String(h).padStart(2, '0')}
                      </option>
                    ))}
                  </select>
                  <span className="font-bold text-slate-400 text-lg">:</span>
                  <select
                    value={alarmMinute}
                    onChange={e => setAlarmMinute(Number(e.target.value))}
                    className="flex-1 p-2.5 text-center font-bold text-lg bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500 outline-hidden"
                  >
                    {Array.from({ length: 60 }, (_, i) => i).map(m => (
                      <option key={m} value={m}>
                        {String(m).padStart(2, '0')}
                      </option>
                    ))}
                  </select>
                  <div className="flex bg-slate-100 p-1 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setAlarmAmPm('AM')}
                      className={`px-2.5 py-1.5 text-xs font-bold rounded-lg transition ${
                        alarmAmPm === 'AM' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500'
                      }`}
                    >
                      AM
                    </button>
                    <button
                      type="button"
                      onClick={() => setAlarmAmPm('PM')}
                      className={`px-2.5 py-1.5 text-xs font-bold rounded-lg transition ${
                        alarmAmPm === 'PM' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500'
                      }`}
                    >
                      PM
                    </button>
                  </div>
                </div>
              </div>

              {/* Days of Week Repeat */}
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Repeat Days (Empty = Once)
                </label>
                <div className="flex justify-between gap-1">
                  {DAY_LABELS.map(d => {
                    const active = alarmDays.includes(d.day);
                    return (
                      <button
                        key={d.day}
                        type="button"
                        onClick={() => toggleDay(d.day)}
                        className={`w-8 h-8 text-[11px] font-bold rounded-lg transition flex items-center justify-center ${
                          active
                            ? 'bg-amber-500 text-white shadow-2xs'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {d.short}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Label / Message */}
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Alarm Label / Message (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Wake up, Gym, Daily Review"
                  value={alarmLabel}
                  onChange={e => setAlarmLabel(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500 outline-hidden"
                />
              </div>

              {/* Toggles */}
              <div className="space-y-2 pt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={alarmSyncDevice}
                    onChange={e => setAlarmSyncDevice(e.target.checked)}
                    className="w-4 h-4 rounded-sm text-amber-500 focus:ring-amber-400"
                  />
                  <div className="text-xs">
                    <span className="font-semibold text-slate-700">Push to Android System Alarm</span>
                    <p className="text-[10px] text-slate-400">Instructs Companion app to set physical Clock alarm</p>
                  </div>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={alarmVibrate}
                    onChange={e => setAlarmVibrate(e.target.checked)}
                    className="w-4 h-4 rounded-sm text-amber-500 focus:ring-amber-400"
                  />
                  <span className="text-xs font-semibold text-slate-700">Vibrate on Device</span>
                </label>
              </div>

              <button
                type="submit"
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-xl shadow-xs transition"
              >
                <Plus className="w-4 h-4" />
                <span>Save & Set Alarm</span>
              </button>
            </form>
          </div>

          {/* Alarm Items List */}
          <div className="lg:col-span-2 space-y-3">
            <div className="flex items-center justify-between pb-1">
              <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Active & Scheduled Alarms ({filteredItems.length})
              </h2>
              <span className="text-[11px] text-slate-400">Android hardware bridge active</span>
            </div>

            {loading ? (
              <div className="p-8 text-center text-xs text-slate-400">Loading alarms...</div>
            ) : filteredItems.length === 0 ? (
              <div className="p-10 text-center bg-white border border-dashed border-slate-200 rounded-2xl space-y-2">
                <Clock className="w-8 h-8 text-slate-300 mx-auto" />
                <p className="text-xs font-semibold text-slate-600">No alarms created yet</p>
                <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
                  Set an alarm using the form on the left. The Android companion will automatically create it in your phone's default Clock app.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {filteredItems.map(item => {
                  const h = item.hour ?? 0;
                  const m = String(item.minutes ?? 0).padStart(2, '0');
                  const ampm = h >= 12 ? 'PM' : 'AM';
                  const dispH = h % 12 === 0 ? 12 : h % 12;

                  return (
                    <div
                      key={item.id}
                      className={`p-4 rounded-2xl border transition flex items-center justify-between gap-4 ${
                        item.isEnabled
                          ? 'bg-white border-slate-200/90 shadow-2xs'
                          : 'bg-slate-50/70 border-slate-200/50 opacity-60'
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-2xl font-black text-slate-900 tracking-tight">
                            {dispH}:{m}
                          </span>
                          <span className="text-xs font-extrabold text-slate-500">{ampm}</span>

                          {/* Companion Sync Badge */}
                          {item.syncToDevice && (
                            <span
                              className={`flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                item.deviceSyncStatus === 'synced'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : 'bg-amber-50 text-amber-700 border border-amber-200'
                              }`}
                              title={
                                item.deviceSyncStatus === 'synced'
                                  ? `Synced with Phone Clock (${item.syncedAt})`
                                  : 'Waiting for Companion App to register on hardware Clock'
                              }
                            >
                              <Smartphone className="w-3 h-3" />
                              {item.deviceSyncStatus === 'synced' ? 'Synced to Phone' : 'Pending Sync'}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 text-xs text-slate-600">
                          <span className="font-semibold">{item.title}</span>
                          {item.days && item.days.length > 0 ? (
                            <span className="text-[10px] text-slate-400">
                              • Every{' '}
                              {item.days
                                .map(d => DAY_LABELS.find(l => l.day === d)?.short)
                                .join(', ')}
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-400">• Rings once</span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        {/* Toggle switch */}
                        <button
                          type="button"
                          onClick={() => toggleAlarmState(item)}
                          className={`w-11 h-6 flex items-center rounded-full p-1 cursor-pointer transition ${
                            item.isEnabled ? 'bg-amber-500' : 'bg-slate-300'
                          }`}
                        >
                          <div
                            className={`bg-white w-4 h-4 rounded-full shadow-md transform transition ${
                              item.isEnabled ? 'translate-x-5' : ''
                            }`}
                          />
                        </button>

                        {/* Delete button */}
                        <button
                          onClick={() => deleteItem(item.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg transition"
                          title="Delete Alarm"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: IN-APP REMINDERS */}
      {activeSubTab === 'reminders' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Reminder Form */}
          <div className="lg:col-span-1 bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs space-y-5">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
              <Calendar className="w-4 h-4 text-indigo-500" />
              <h2 className="text-sm font-bold text-slate-900">Schedule In-App Reminder</h2>
            </div>

            <form onSubmit={handleCreateReminder} className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Reminder Title
                </label>
                <input
                  type="text"
                  placeholder="e.g. Call accountant, Medicine, Review budget"
                  value={reminderTitle}
                  onChange={e => setReminderTitle(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-hidden"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Date & Time
                </label>
                <input
                  type="datetime-local"
                  value={reminderDate}
                  onChange={e => setReminderDate(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-hidden"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Notes / Details (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Additional instructions or notes..."
                  value={reminderNote}
                  onChange={e => setReminderNote(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-hidden"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Urgency / Priority
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['normal', 'important', 'urgent'] as const).map(p => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setReminderPriority(p)}
                      className={`py-1.5 text-xs font-bold capitalize rounded-xl border transition ${
                        reminderPriority === p
                          ? p === 'urgent'
                            ? 'bg-rose-50 text-rose-700 border-rose-300'
                            : p === 'important'
                            ? 'bg-indigo-50 text-indigo-700 border-indigo-300'
                            : 'bg-slate-100 text-slate-800 border-slate-300'
                          : 'bg-white text-slate-500 border-slate-200'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Notification Delivery
                </label>
                <select
                  value={reminderStyle}
                  onChange={e => setReminderStyle(e.target.value as any)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-hidden"
                >
                  <option value="in_app_popup">🔊 Audio Chime & Heads-Up Modal</option>
                  <option value="web_push">📲 System Web Push Notification</option>
                  <option value="heads_up">⚡ Android Companion Overlay</option>
                </select>
              </div>

              <div className="pt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={reminderSyncDevice}
                    onChange={e => setReminderSyncDevice(e.target.checked)}
                    className="w-4 h-4 rounded-sm text-indigo-600 focus:ring-indigo-500"
                  />
                  <div className="text-xs">
                    <span className="font-semibold text-slate-700">Sync with Android Companion</span>
                    <p className="text-[10px] text-slate-400">Ring exact alarm on phone hardware</p>
                  </div>
                </label>
              </div>

              <button
                type="submit"
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs transition"
              >
                <Plus className="w-4 h-4" />
                <span>Schedule Reminder</span>
              </button>
            </form>
          </div>

          {/* Reminder Items List */}
          <div className="lg:col-span-2 space-y-3">
            <div className="flex items-center justify-between pb-1">
              <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Upcoming Reminders ({filteredItems.length})
              </h2>
              <span className="text-[11px] text-slate-400">In-browser and Android alerting</span>
            </div>

            {loading ? (
              <div className="p-8 text-center text-xs text-slate-400">Loading reminders...</div>
            ) : filteredItems.length === 0 ? (
              <div className="p-10 text-center bg-white border border-dashed border-slate-200 rounded-2xl space-y-2">
                <Calendar className="w-8 h-8 text-slate-300 mx-auto" />
                <p className="text-xs font-semibold text-slate-600">No upcoming reminders</p>
                <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
                  Create a reminder with notes and custom alert styling. Shudkara will chime and display a pop-up prompt when due.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {filteredItems.map(item => {
                  const target = item.targetDate ? new Date(item.targetDate) : null;
                  const isPast = target ? target.getTime() < Date.now() : false;

                  return (
                    <div
                      key={item.id}
                      className={`p-4 rounded-2xl border transition flex items-center justify-between gap-4 ${
                        item.isCompleted
                          ? 'bg-slate-50 border-slate-200 opacity-60'
                          : 'bg-white border-slate-200/90 shadow-2xs'
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-sm font-bold ${
                              item.isCompleted ? 'line-through text-slate-400' : 'text-slate-900'
                            }`}
                          >
                            {item.title}
                          </span>

                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                              item.priority === 'urgent'
                                ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                : item.priority === 'important'
                                ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {item.priority}
                          </span>

                          {item.syncToDevice && (
                            <span className="flex items-center gap-1 text-[10px] font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
                              <Smartphone className="w-3 h-3" />
                              Phone synced
                            </span>
                          )}
                        </div>

                        {item.message && (
                          <p className="text-xs text-slate-500 line-clamp-1">{item.message}</p>
                        )}

                        <div className="flex items-center gap-2 text-[11px] text-slate-400">
                          <Clock className="w-3.5 h-3.5" />
                          <span>{target ? target.toLocaleString() : 'No date'}</span>
                          {isPast && !item.isCompleted && (
                            <span className="text-rose-500 font-bold">• Due / Passed</span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {/* Play sound test for this reminder */}
                        <button
                          onClick={() => playChime('alarm')}
                          className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-slate-100 transition"
                          title="Trigger preview alert"
                        >
                          <Volume2 className="w-4 h-4" />
                        </button>

                        <button
                          onClick={() => deleteItem(item.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-slate-100 transition"
                          title="Delete Reminder"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* POPUP ALERT MODAL (when a reminder triggers in-app) */}
      {activeAlertItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-3 bg-amber-100 text-amber-700 rounded-2xl animate-bounce">
                  <Bell className="w-6 h-6" />
                </div>
                <div>
                  <span className="text-[10px] font-extrabold uppercase text-amber-600 tracking-wider">
                    Reminder Alert
                  </span>
                  <h3 className="text-base font-bold text-slate-900">{activeAlertItem.title}</h3>
                </div>
              </div>
              <button
                onClick={() => setActiveAlertItem(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {activeAlertItem.message && (
              <div className="p-3 bg-slate-50 rounded-xl text-xs text-slate-600">
                {activeAlertItem.message}
              </div>
            )}

            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={() => {
                  playChime('alarm');
                  setActiveAlertItem(null);
                }}
                className="flex-1 py-2.5 px-4 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-xl transition shadow-xs text-center"
              >
                Acknowledge & Dismiss
              </button>
              <button
                onClick={() => {
                  // Snooze 5 minutes
                  setActiveAlertItem(null);
                }}
                className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition text-center"
              >
                Snooze 5m
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
