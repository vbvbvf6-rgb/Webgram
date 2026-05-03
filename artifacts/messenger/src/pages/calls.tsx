import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Phone, Video, PhoneIncoming, PhoneMissed, PhoneOff, Clock, Search, Mic, MicOff, Volume2, VolumeX, VideoOff, PhoneCall } from "lucide-react";
import { useGetMe } from "@workspace/api-client-react";
import { motion, AnimatePresence } from "framer-motion";

type CallEntry = {
  id: number;
  name: string;
  avatar?: string;
  type: "audio" | "video";
  direction: "incoming" | "outgoing" | "missed";
  duration?: number;
  time: Date;
};

type CallPhase = "ringing" | "connected";

function formatDuration(secs: number) {
  const m = Math.floor(secs / 60).toString().padStart(2, "0");
  const s = (secs % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function timeAgo(date: Date) {
  const diff = Date.now() - date.getTime();
  if (diff < 60000) return "Just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  if (diff < 604800000) return date.toLocaleDateString([], { weekday: "short" });
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

function Avatar({ src, name, size = 44 }: { src?: string; name: string; size?: number }) {
  const hue = (name.charCodeAt(0) * 37 + (name.charCodeAt(1) || 0) * 17) % 360;
  return src ? (
    <img src={src} alt={name} className="rounded-full object-cover" style={{ width: size, height: size }} />
  ) : (
    <div className="rounded-full flex items-center justify-center text-white font-bold" style={{ width: size, height: size, background: `hsl(${hue},65%,50%)`, fontSize: size * 0.36 }}>
      {name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
    </div>
  );
}

const MOCK_CALLS: CallEntry[] = [
  { id: 1, name: "Alex K.", type: "video", direction: "incoming", duration: 1823, time: new Date(Date.now() - 12 * 60000) },
  { id: 2, name: "Sarah M.", type: "audio", direction: "outgoing", duration: 342, time: new Date(Date.now() - 2 * 3600000) },
  { id: 3, name: "Team Alpha", type: "video", direction: "missed", time: new Date(Date.now() - 5 * 3600000) },
  { id: 4, name: "David L.", type: "audio", direction: "outgoing", duration: 5432, time: new Date(Date.now() - 86400000) },
  { id: 5, name: "Alex K.", type: "audio", direction: "incoming", duration: 270, time: new Date(Date.now() - 2 * 86400000) },
  { id: 6, name: "Maria V.", type: "video", direction: "missed", time: new Date(Date.now() - 3 * 86400000) },
  { id: 7, name: "Sarah M.", type: "video", direction: "incoming", duration: 4200, time: new Date(Date.now() - 5 * 86400000) },
];

function buildRingtone(outgoing: boolean): () => void {
  let stopped = false;
  let ctx: AudioContext | null = null;
  function ring() {
    if (stopped) return;
    try {
      if (!ctx || ctx.state === "closed") ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const now = ctx.currentTime;
      if (outgoing) {
        [0, 0.45].forEach((delay, idx) => {
          const osc = ctx!.createOscillator(); const gain = ctx!.createGain();
          osc.connect(gain); gain.connect(ctx!.destination);
          osc.frequency.value = idx === 0 ? 440 : 480;
          gain.gain.setValueAtTime(0, now + delay);
          gain.gain.linearRampToValueAtTime(0.18, now + delay + 0.04);
          gain.gain.setValueAtTime(0.18, now + delay + 0.35);
          gain.gain.linearRampToValueAtTime(0, now + delay + 0.43);
          osc.start(now + delay); osc.stop(now + delay + 0.46);
        });
        if (!stopped) setTimeout(ring, 3200);
      } else {
        [0, 0.22, 0.44].forEach(delay => {
          const osc = ctx!.createOscillator(); const gain = ctx!.createGain();
          osc.connect(gain); gain.connect(ctx!.destination);
          osc.frequency.value = 880;
          gain.gain.setValueAtTime(0, now + delay);
          gain.gain.linearRampToValueAtTime(0.28, now + delay + 0.03);
          gain.gain.setValueAtTime(0.28, now + delay + 0.16);
          gain.gain.linearRampToValueAtTime(0, now + delay + 0.21);
          osc.start(now + delay); osc.stop(now + delay + 0.23);
        });
        if (!stopped) setTimeout(ring, 2400);
      }
    } catch {}
  }
  ring();
  return () => { stopped = true; ctx?.close().catch(() => {}); };
}

export default function CallsPage() {
  const [, setLocation] = useLocation();
  const { data: me } = useGetMe();
  const [filter, setFilter] = useState<"all" | "missed" | "incoming" | "outgoing">("all");
  const [search, setSearch] = useState("");
  const [activeCall, setActiveCall] = useState<{ name: string; type: "audio" | "video"; phase: CallPhase } | null>(null);
  const [callDuration, setCallDuration] = useState(0);
  const [muted, setMuted] = useState(false);
  const [speaker, setSpeaker] = useState(true);
  const [videoOff, setVideoOff] = useState(false);
  const callTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const callRingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ringtoneStopRef = useRef<(() => void) | null>(null);

  const calls = MOCK_CALLS
    .filter(c => filter === "all" || c.direction === filter)
    .filter(c => !search || c.name.toLowerCase().includes(search.toLowerCase()));

  function stopRingtone() {
    ringtoneStopRef.current?.();
    ringtoneStopRef.current = null;
  }

  function startCall(name: string, type: "audio" | "video") {
    setActiveCall({ name, type, phase: "ringing" });
    setCallDuration(0);
    setMuted(false);
    setSpeaker(true);
    setVideoOff(false);
    ringtoneStopRef.current = buildRingtone(true);
    // Simulate other user answering after 4-7 seconds
    const answerDelay = 4000 + Math.random() * 3000;
    callRingTimeoutRef.current = setTimeout(() => {
      stopRingtone();
      setActiveCall(prev => prev ? { ...prev, phase: "connected" } : null);
      callTimerRef.current = setInterval(() => setCallDuration(d => d + 1), 1000);
    }, answerDelay);
  }

  function endCall() {
    stopRingtone();
    if (callRingTimeoutRef.current) { clearTimeout(callRingTimeoutRef.current); callRingTimeoutRef.current = null; }
    if (callTimerRef.current) { clearInterval(callTimerRef.current); callTimerRef.current = null; }
    setActiveCall(null);
    setCallDuration(0);
    setMuted(false);
    setSpeaker(true);
    setVideoOff(false);
  }

  useEffect(() => {
    return () => {
      stopRingtone();
      if (callRingTimeoutRef.current) clearTimeout(callRingTimeoutRef.current);
      if (callTimerRef.current) clearInterval(callTimerRef.current);
    };
  }, []);

  const dirIcon = (d: string) => {
    if (d === "missed") return <PhoneMissed size={14} className="text-red-400" />;
    if (d === "incoming") return <PhoneIncoming size={14} className="text-green-400" />;
    return <Phone size={14} className="text-primary" />;
  };

  return (
    <div className="min-h-screen bg-background flex flex-col pb-16 md:pb-0">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-sidebar/90 backdrop-blur-xl border-b border-border">
        <div className="flex items-center gap-3 px-4 py-3">
          <button onClick={() => setLocation("/chats")} className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-accent transition-colors md:hidden">
            <ArrowLeft size={18} />
          </button>
          <h1 className="font-bold text-lg">Calls</h1>
          <div className="ml-auto relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search calls..."
              className="bg-accent rounded-xl pl-8 pr-3 py-2 text-sm outline-none placeholder:text-muted-foreground w-40 focus:w-52 transition-all focus:ring-1 ring-primary/50"
            />
          </div>
        </div>
        <div className="flex gap-2 px-4 pb-2 overflow-x-auto">
          {(["all", "missed", "incoming", "outgoing"] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)} className={`text-xs font-semibold px-3 py-1.5 rounded-lg capitalize transition-all shrink-0 ${filter === f ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground"}`}>
              {f === "all" ? "All calls" : f === "missed" ? "🔴 Missed" : f === "incoming" ? "🟢 Incoming" : "🔵 Outgoing"}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-lg mx-auto w-full px-4 py-4 space-y-2">
        {calls.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4 text-muted-foreground">
            <div className="w-16 h-16 bg-accent rounded-2xl flex items-center justify-center">
              <PhoneOff size={28} className="text-primary/60" />
            </div>
            <p className="text-sm font-medium text-foreground">No calls yet</p>
            <p className="text-xs">Call history will appear here</p>
          </div>
        ) : (
          calls.map((call, i) => (
            <motion.div
              key={call.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className="flex items-center gap-3 bg-card border border-border rounded-2xl px-4 py-3 hover:border-primary/20 transition-all"
            >
              <Avatar name={call.name} size={46} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <p className={`font-semibold text-sm ${call.direction === "missed" ? "text-red-400" : ""}`}>{call.name}</p>
                  {call.type === "video" && <Video size={11} className="text-muted-foreground" />}
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  {dirIcon(call.direction)}
                  <span className="capitalize">{call.direction}</span>
                  {call.duration && (
                    <><span>·</span><Clock size={10} /><span>{formatDuration(call.duration)}</span></>
                  )}
                  <span>·</span>
                  <span>{timeAgo(call.time)}</span>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={() => startCall(call.name, "audio")}
                  className="w-9 h-9 flex items-center justify-center rounded-xl bg-green-500/10 hover:bg-green-500/20 text-green-500 transition-colors"
                  title="Call"
                >
                  <Phone size={15} />
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={() => startCall(call.name, "video")}
                  className="w-9 h-9 flex items-center justify-center rounded-xl bg-primary/10 hover:bg-primary/20 text-primary transition-colors"
                  title="Video call"
                >
                  <Video size={15} />
                </motion.button>
              </div>
            </motion.div>
          ))
        )}
      </div>

      {/* Call overlay */}
      <AnimatePresence>
        {activeCall && (
          <motion.div
            key="call-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex flex-col items-center justify-between bg-gradient-to-b from-slate-900 via-indigo-950 to-slate-900 px-6 py-12"
          >
            {/* Animated rings */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              {[1, 2, 3].map(i => (
                <motion.div
                  key={i}
                  className="absolute rounded-full border border-primary/20"
                  animate={{ scale: [1, 1.5 + i * 0.3, 1], opacity: [0.3, 0, 0.3] }}
                  transition={{ duration: activeCall.phase === "ringing" ? 1.6 : 2.5, repeat: Infinity, delay: i * 0.4 }}
                  style={{ width: 120 + i * 60, height: 120 + i * 60 }}
                />
              ))}
            </div>

            {/* Top info */}
            <div className="text-center z-10">
              <p className="text-sm text-primary/70 font-medium mb-1">
                {activeCall.type === "video" ? "📹 Video call" : "📞 Voice call"}
              </p>
              <h2 className="text-3xl font-bold text-white">{activeCall.name}</h2>
              <AnimatePresence mode="wait">
                {activeCall.phase === "ringing" ? (
                  <motion.p key="ringing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="text-primary/50 text-sm mt-2">
                    <motion.span animate={{ opacity: [1, 0.4, 1] }} transition={{ duration: 1.5, repeat: Infinity }}>
                      Calling…
                    </motion.span>
                  </motion.p>
                ) : (
                  <motion.p key="connected" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="text-green-400/80 text-sm mt-2 font-mono">
                    {formatDuration(callDuration)}
                  </motion.p>
                )}
              </AnimatePresence>
            </div>

            {/* Avatar */}
            <motion.div className="relative z-10" animate={{ scale: [1, 1.03, 1] }} transition={{ duration: activeCall.phase === "ringing" ? 1.2 : 2, repeat: Infinity }}>
              <div className="w-32 h-32 rounded-full bg-gradient-to-br from-primary to-indigo-500 flex items-center justify-center text-5xl font-black text-white ring-4 ring-primary/30 shadow-2xl">
                {activeCall.name.charAt(0)}
              </div>
              {activeCall.type === "video" && activeCall.phase === "connected" && (
                <div className="absolute bottom-2 right-2 bg-green-500 rounded-full p-1.5"><Video size={12} className="text-white" /></div>
              )}
            </motion.div>

            {/* Controls */}
            <div className="z-10 flex flex-col items-center gap-6 w-full">
              {activeCall.phase === "ringing" ? (
                /* Ringing — cancel only */
                <div className="flex flex-col items-center gap-2">
                  <motion.button whileTap={{ scale: 0.95 }} onClick={endCall}
                    className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center shadow-2xl shadow-red-500/40 transition-colors">
                    <PhoneOff size={26} />
                  </motion.button>
                  <span className="text-xs text-white/40">Cancel</span>
                </div>
              ) : (
                /* Connected — full controls */
                <>
                  <div className="flex justify-center gap-6">
                    <div className="flex flex-col items-center gap-2">
                      <motion.button whileTap={{ scale: 0.9 }} onClick={() => setMuted(!muted)}
                        className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${muted ? "bg-red-500 text-white" : "bg-white/10 text-white hover:bg-white/20"}`}>
                        {muted ? <MicOff size={22} /> : <Mic size={22} />}
                      </motion.button>
                      <span className="text-xs text-white/50">{muted ? "Unmute" : "Mute"}</span>
                    </div>
                    <div className="flex flex-col items-center gap-2">
                      <motion.button whileTap={{ scale: 0.9 }} onClick={() => setSpeaker(!speaker)}
                        className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${!speaker ? "bg-white/10" : "bg-primary/30"} text-white hover:bg-white/20`}>
                        {speaker ? <Volume2 size={22} /> : <VolumeX size={22} />}
                      </motion.button>
                      <span className="text-xs text-white/50">Speaker</span>
                    </div>
                    {activeCall.type === "video" && (
                      <div className="flex flex-col items-center gap-2">
                        <motion.button whileTap={{ scale: 0.9 }} onClick={() => setVideoOff(!videoOff)}
                          className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${videoOff ? "bg-red-500 text-white" : "bg-white/10 text-white hover:bg-white/20"}`}>
                          {videoOff ? <VideoOff size={22} /> : <Video size={22} />}
                        </motion.button>
                        <span className="text-xs text-white/50">{videoOff ? "Camera off" : "Camera"}</span>
                      </div>
                    )}
                  </div>
                  <motion.button whileTap={{ scale: 0.95 }} onClick={endCall}
                    className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center shadow-2xl shadow-red-500/40 transition-colors">
                    <PhoneOff size={26} />
                  </motion.button>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
