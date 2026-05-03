import { useState, useRef, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { useUser, useClerk, useAuth } from "@clerk/react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Send, Search, Plus, LogOut, Reply,
  Edit2, Trash2, Smile, X, Check, CheckCheck, Users, MessageSquare,
  ArrowLeft, ChevronDown, Phone, Video,
  PhoneOff, VideoOff, MicOff, Mic, Volume2, VolumeX,
  Copy, MoreHorizontal, Pin, PinOff, ImageIcon, Play, Pause,
  Star, StopCircle, ExternalLink, Keyboard, Hash,
  BarChart2, Zap, Sparkles, Palette, UserCircle2,
  Slash, ChevronUp, Bookmark, Trophy, CornerUpLeft, Lock,
} from "lucide-react";
import {
  getOrCreateKeyPair, importPublicKey, deriveSharedKey, deriveGroupKey,
  encryptMsg, decryptMsg, isEncrypted, shouldEncrypt,
} from "@/lib/e2ee";
import {
  useGetMe, useGetChats, useGetMessages, useSendMessage,
  useEditMessage, useDeleteMessage, useReactToMessage, useMarkMessageRead,
  useCreateChat, getGetChatsQueryKey, getGetMessagesQueryKey,
  useSearchUsers, useGetChatStats, useGetOnlineUsers, useUpdateMe,
  getGetMeQueryKey, getGetOnlineUsersQueryKey, getSearchUsersQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

const EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🔥", "👏", "✅", "🎉", "💯"];

const STICKER_PACKS: Record<string, string[]> = {
  "❤️ Love":   ["❤️‍🔥","💕","🥰","😘","💝","🫀","😻","💌","🫦","💖","💗","🌹"],
  "😂 Funny":  ["🤣","😭","💀","🤦","🙈","🫡","🤡","🫠","💩","🤪","😜","🙃"],
  "🎉 Hype":   ["🎉","🥳","🎊","🔥","💯","⚡","🚀","🏆","👑","💫","✨","🎯"],
  "😤 Vibes":  ["😤","💪","🫶","✌️","🤙","😎","🤝","💥","🎯","🫸","🦾","⚔️"],
  "🐱 Cute":   ["🐱","🐶","🦊","🐻","🐼","🐨","🦋","🌸","🌟","✨","🌈","🍀"],
};


const CHAT_THEMES: { id: string; label: string; gradient: string; msgBg: string }[] = [
  { id: "default", label: "Default", gradient: "", msgBg: "" },
  { id: "ocean",   label: "🌊 Ocean",   gradient: "bg-gradient-to-b from-blue-900/40 to-cyan-900/20",   msgBg: "bg-cyan-500" },
  { id: "sunset",  label: "🌅 Sunset",  gradient: "bg-gradient-to-b from-orange-950/40 to-rose-950/20", msgBg: "bg-orange-600" },
  { id: "forest",  label: "🌿 Forest",  gradient: "bg-gradient-to-b from-green-950/40 to-emerald-950/20", msgBg: "bg-green-700" },
  { id: "galaxy",  label: "🌌 Galaxy",  gradient: "bg-gradient-to-b from-violet-900/40 to-indigo-900/20", msgBg: "bg-violet-500" },
  { id: "cherry",  label: "🌸 Cherry",  gradient: "bg-gradient-to-b from-pink-950/40 to-rose-950/20",   msgBg: "bg-pink-600" },
  { id: "midnight",label: "🌙 Midnight",gradient: "bg-gradient-to-b from-slate-900 to-slate-950",      msgBg: "bg-slate-700" },
  { id: "aurora",  label: "🌈 Aurora",  gradient: "bg-gradient-to-b from-sky-900/40 to-violet-900/20", msgBg: "bg-sky-500" },
];

const BOT_COMMANDS = [
  { cmd: "/poll",  desc: "Create a poll",              icon: "📊" },
  { cmd: "/coin",  desc: "/coin @user 10 — send ⚡",   icon: "⚡" },
  { cmd: "/me",    desc: "Describe what you're doing", icon: "✍️" },
  { cmd: "/shrug", desc: "¯\\_(ツ)_/¯",               icon: "🤷" },
  { cmd: "/flip",  desc: "Flip a coin",                icon: "🪙" },
  { cmd: "/roll",  desc: "Roll a dice 1-6",            icon: "🎲" },
];

const EMOJI_CATEGORIES: Record<string, string[]> = {
  "😀 Smileys": ["😀","😂","😍","🥰","😎","😭","😤","🤔","😴","🥳","😱","🤩","😅","🫡","🥲","😇"],
  "👋 People":  ["👍","👎","🙌","👏","🤝","✌️","🤞","💪","🫶","🙏","✋","👌","🫂","🤜","💅","🤙"],
  "❤️ Hearts":  ["❤️","🧡","💛","💚","💙","💜","🖤","🤍","💔","❣️","💕","💗","💓","💞","💖","🔥"],
  "🐱 Animals": ["🐱","🐶","🐼","🦊","🐨","🦁","🐸","🦋","🐝","🌸","🍀","⭐","🌈","☀️","🌙","❄️"],
  "🍕 Food":    ["🍕","🍔","🌮","🍜","🍣","🍰","🎂","🍺","☕","🧃","🍓","🍊","🥑","🌶️","🫙","🍫"],
  "🎉 Fun":     ["🎉","🎊","🎈","🎁","🏆","🥇","🎮","🎸","🎵","✈️","🚀","⚽","🎯","💎","🪄","🔮"],
  "💯 Symbols": ["💯","✅","❌","⚠️","💡","🔥","⚡","🌟","💫","🎯","🔑","💬","📱","💻","🖥️","🔔"],
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function Avatar({ src, name, size = 40, online }: { src?: string | null; name: string; size?: number; online?: boolean }) {
  const initials = name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
  const hue = (name.charCodeAt(0) * 37 + name.charCodeAt(1) * 17) % 360;
  const bg = `hsl(${hue}, 65%, 50%)`;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      {src ? (
        <img src={src} alt={name} className="rounded-full object-cover w-full h-full ring-1 ring-border/30" />
      ) : (
        <div className="rounded-full flex items-center justify-center text-white font-semibold w-full h-full" style={{ background: bg, fontSize: size * 0.38 }}>
          {initials || "?"}
        </div>
      )}
      {online !== undefined && (
        <span
          className={`absolute bottom-0 right-0 rounded-full border-2 border-sidebar transition-all ${online ? "bg-green-500 w-2.5 h-2.5" : "bg-muted-foreground/50 w-2 h-2"}`}
        />
      )}
    </div>
  );
}

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-accent/80 rounded-lg ${className}`} />;
}

function formatTime(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays === 0) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return d.toLocaleDateString([], { weekday: "short" });
  return d.toLocaleDateString([], { day: "2-digit", month: "short" });
}

// ─── PollMessage renderer ─────────────────────────────────────────────────────
function PollMessage({ pollId, pollsData, onVote, myId }: { pollId: number; pollsData: Map<number, any>; onVote: (id: number, choices: number[]) => void; myId: number }) {
  const poll = pollsData.get(pollId);
  if (!poll) return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground py-1">
      <BarChart2 size={13} /> Loading poll…
    </div>
  );
  // API returns: options[] (strings), optionCounts[] (numbers), myVote?.choices[], totalVoters
  const options: string[] = poll.options || [];
  const counts: number[] = poll.optionCounts || options.map(() => 0);
  const totalVotes: number = poll.totalVoters ?? counts.reduce((s: number, c: number) => s + c, 0);
  const myChoices: number[] = poll.myVote?.choices ?? [];
  const hasVoted = myChoices.length > 0;
  return (
    <div className="min-w-[200px] max-w-[280px]">
      <div className="flex items-center gap-1.5 mb-2">
        <BarChart2 size={12} className="opacity-70 shrink-0" />
        <p className="text-sm font-semibold leading-tight">{poll.question}</p>
      </div>
      <div className="space-y-1.5">
        {options.map((label: string, i: number) => {
          const votes = counts[i] || 0;
          const pct = totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0;
          const isMyVote = myChoices.includes(i);
          return (
            <button key={i} onClick={() => !hasVoted && onVote(pollId, [i])}
              disabled={hasVoted}
              className={`w-full text-left rounded-xl overflow-hidden relative transition-all ${hasVoted ? "cursor-default" : "hover:opacity-90 active:scale-[0.98]"}`}>
              {hasVoted && <div className="absolute inset-y-0 left-0 bg-primary/25 rounded-xl transition-all" style={{ width: `${pct}%` }} />}
              <div className={`relative flex items-center justify-between px-3 py-2 rounded-xl border ${isMyVote ? "border-primary/60 bg-primary/15" : "border-white/20 bg-white/10"}`}>
                <span className="text-xs font-medium truncate">{label}</span>
                {hasVoted && <span className="text-[10px] opacity-70 ml-2 shrink-0">{pct}%</span>}
              </div>
            </button>
          );
        })}
      </div>
      <p className="text-[10px] opacity-60 mt-1.5">{totalVotes} vote{totalVotes !== 1 ? "s" : ""}{poll.allowMultiple ? " · Multi-choice" : ""}</p>
    </div>
  );
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return d.toLocaleDateString([], { weekday: "long" });
  return d.toLocaleDateString([], { day: "numeric", month: "long", year: "numeric" });
}

function isSameDay(a: string, b: string) {
  const da = new Date(a), db = new Date(b);
  return da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth() && da.getDate() === db.getDate();
}

function playMessageSound() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.15);
  } catch {}
}

// ─── Interfaces ───────────────────────────────────────────────────────────────

interface ChatWithDetails {
  id: number;
  type: "direct" | "group";
  name?: string | null;
  avatarUrl?: string | null;
  createdAt: string;
  createdBy: number;
  members: any[];
  lastMessage?: any;
  unreadCount: number;
}

interface Message {
  id: number;
  chatId: number;
  senderId: number;
  sender: any;
  content?: string | null;
  type: string;
  replyToId?: number | null;
  replyTo?: any;
  reactions: Record<string, number[]>;
  isEdited: boolean;
  isDeleted: boolean;
  readBy: number[];
  createdAt: string;
  updatedAt: string;
}

// ─── Message preview formatter (for sidebar / reply quotes) ───────────────────

function formatMsgPreview(content: string | null | undefined): string {
  if (!content) return "";
  if (isEncrypted(content)) return "🔒 Encrypted message";
  if (content.startsWith("[voice:")) {
    const m = content.match(/^\[voice:(\d+):/);
    if (m) {
      const s = parseInt(m[1]);
      const t = `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;
      return `🎤 Voice message · ${t}`;
    }
    return "🎤 Voice message";
  }
  if (content.match(/^\[poll:\d+\]$/)) return "📊 Poll";
  return content;
}

// ─── Rich text renderer ───────────────────────────────────────────────────────

function renderRichText(content: string): React.ReactNode {
  if (!content) return null;
  const trimmed = content.trim();
  // Big emoji if message is purely 1-3 emoji
  if (/^(\p{Emoji_Presentation}|\p{Extended_Pictographic}){1,3}$/u.test(trimmed)) {
    return <span className="text-4xl leading-snug">{trimmed}</span>;
  }
  // Image URL → inline image
  if (/^https?:\/\/\S+\.(jpg|jpeg|png|gif|webp|svg|avif)(\?[^\s]*)?$/i.test(trimmed)) {
    return (
      <div className="space-y-1.5">
        <img src={trimmed} alt="" className="max-w-full rounded-xl max-h-60 object-cover shadow-lg cursor-pointer" onClick={() => window.open(trimmed, "_blank")} onError={e => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
        <a href={trimmed} target="_blank" rel="noopener noreferrer" className="text-[10px] opacity-50 hover:opacity-70 flex items-center gap-1 underline">
          <ExternalLink size={9} />Open image
        </a>
      </div>
    );
  }
  // Tokenize for bold/italic/code/links
  const tokens = content.split(/(\*\*[^*\n]+\*\*|_[^_\n]{1,80}_|`[^`\n]+`|https?:\/\/[^\s]+)/g);
  return (
    <p className="leading-relaxed whitespace-pre-wrap break-words">
      {tokens.map((tok, i) => {
        if (tok.startsWith("**") && tok.endsWith("**") && tok.length > 4)
          return <strong key={i} className="font-semibold">{tok.slice(2,-2)}</strong>;
        if (tok.startsWith("_") && tok.endsWith("_") && tok.length > 2)
          return <em key={i} className="italic">{tok.slice(1,-1)}</em>;
        if (tok.startsWith("`") && tok.endsWith("`") && tok.length > 2)
          return <code key={i} className="bg-black/20 px-1.5 py-0.5 rounded-md text-[0.82em] font-mono border border-white/10">{tok.slice(1,-1)}</code>;
        if (/^https?:\/\//.test(tok))
          return <a key={i} href={tok} target="_blank" rel="noopener noreferrer" className="underline decoration-dotted underline-offset-2 opacity-80 hover:opacity-100 inline-flex items-center gap-0.5 break-all">{tok.length>45?tok.slice(0,45)+"…":tok}<ExternalLink size={9}/></a>;
        return <span key={i}>{tok}</span>;
      })}
    </p>
  );
}

// ─── Voice message player ─────────────────────────────────────────────────────

function VoiceMessage({ content, isOwn }: { content: string; isOwn: boolean }) {
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);
  const match = content.match(/^\[voice:(\d+):(.+)\]$/s);
  if (!match) return <p className="leading-relaxed whitespace-pre-wrap">{content}</p>;
  const durationSecs = parseInt(match[1]);
  const dataUrl = match[2];
  const fmtDur = (s: number) => `${Math.floor(s/60).toString().padStart(2,"0")}:${(s%60).toString().padStart(2,"0")}`;
  return (
    <div className="flex items-center gap-3 min-w-[190px] max-w-[250px]">
      <audio ref={audioRef} src={dataUrl} onEnded={() => { setPlaying(false); setProgress(0); }}
        onTimeUpdate={() => { if (audioRef.current?.duration) setProgress(audioRef.current.currentTime/audioRef.current.duration); }} />
      <motion.button whileTap={{ scale: 0.9 }} onClick={() => { const a = audioRef.current; if (!a) return; if (playing) { a.pause(); setPlaying(false); } else { a.play(); setPlaying(true); } }}
        className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${isOwn?"bg-white/20 hover:bg-white/30":"bg-primary/20 hover:bg-primary/30"} transition-all`}>
        {playing ? <Pause size={15}/> : <Play size={15}/>}
      </motion.button>
      <div className="flex-1 flex flex-col gap-1">
        <div className="flex items-end gap-px h-6">
          {[...Array(28)].map((_,i) => {
            const h = 3 + Math.abs(Math.sin(i*1.3)*10 + Math.cos(i*0.6)*6);
            const filled = progress>0 && i/28<=progress;
            return <div key={i} className={`w-0.5 rounded-full flex-shrink-0 ${filled?(isOwn?"bg-white/80":"bg-primary"):(isOwn?"bg-white/25":"bg-primary/25")}`} style={{height:h}} />;
          })}
        </div>
        <span className="text-[10px] opacity-50">{fmtDur(durationSecs)}</span>
      </div>
    </div>
  );
}

// ─── ClerkSync ────────────────────────────────────────────────────────────────

function ClerkProfileSync({ meId }: { meId?: number }) {
  const { user } = useUser();
  const updateMe = useUpdateMe();
  const qc = useQueryClient();
  const synced = useRef(false);

  useEffect(() => {
    if (!user || !meId || synced.current) return;
    synced.current = true;
    const name = user.fullName || user.firstName || user.emailAddresses[0]?.emailAddress?.split("@")[0] || "";
    const avatar = user.imageUrl || null;
    if (!name && !avatar) return;
    updateMe.mutate(
      { data: { displayName: name, avatarUrl: avatar } },
      { onSuccess: () => qc.invalidateQueries({ queryKey: getGetMeQueryKey() }) }
    );
  }, [user, meId]);

  return null;
}

function clearCurrentSession() {
  const active = localStorage.getItem("pulse_active_account");
  if (active) localStorage.removeItem(`pulse_session_${active}`);
  localStorage.removeItem("pulse_active_account");
}

// ─── ChatsSidebar ─────────────────────────────────────────────────────────────

export default function ChatsPage({ activeChatId }: { activeChatId?: number }) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { signOut } = useClerk();
  const qc = useQueryClient();
  const { data: me } = useGetMe();
  const { data: chats, isLoading: chatsLoading } = useGetChats();
  const { data: stats } = useGetChatStats();
  const { data: onlineUsers } = useGetOnlineUsers({ query: { queryKey: getGetOnlineUsersQueryKey(), refetchInterval: 30000 } });

  const [searchQuery, setSearchQuery] = useState("");
  const [showNewChat, setShowNewChat] = useState(false);
  const [newChatSearch, setNewChatSearch] = useState("");
  const [groupMode, setGroupMode] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [selectedUsers, setSelectedUsers] = useState<any[]>([]);
  const [showOnline, setShowOnline] = useState(false);

  const { data: searchResults } = useSearchUsers(
    { q: newChatSearch },
    { query: { queryKey: getSearchUsersQueryKey({ q: newChatSearch }), enabled: newChatSearch.length > 1 } }
  );

  const createChat = useCreateChat();
  const myId = (me as any)?.id;

  const filteredChats = (chats || []).filter((c: ChatWithDetails) => {
    if (!searchQuery) return true;
    const name = c.type === "direct"
      ? c.members.find((m: any) => m.id !== myId)?.displayName || ""
      : c.name || "";
    return name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  function getChatName(chat: ChatWithDetails) {
    if (chat.type === "group") return chat.name || "Group Chat";
    const other = chat.members.find((m: any) => m.id !== myId);
    return other?.displayName || "Unknown";
  }
  function getChatAvatar(chat: ChatWithDetails) {
    if (chat.type === "group") return null;
    return chat.members.find((m: any) => m.id !== myId)?.avatarUrl || null;
  }
  function getChatOnline(chat: ChatWithDetails) {
    if (chat.type === "group") return false;
    return chat.members.find((m: any) => m.id !== myId)?.isOnline || false;
  }

  async function startDirectChat(userId: number) {
    try {
      const chat = await createChat.mutateAsync({ data: { type: "direct", memberIds: [userId] } });
      qc.invalidateQueries({ queryKey: getGetChatsQueryKey() });
      setShowNewChat(false); setNewChatSearch("");
      setLocation(`/chats/${(chat as any).id}`);
    } catch { toast({ title: "Failed to create chat", variant: "destructive" }); }
  }

  async function createGroupChat() {
    if (!groupName.trim() || selectedUsers.length === 0) return;
    try {
      const chat = await createChat.mutateAsync({ data: { type: "group", name: groupName, memberIds: selectedUsers.map((u: any) => u.id) } });
      qc.invalidateQueries({ queryKey: getGetChatsQueryKey() });
      setShowNewChat(false); setGroupMode(false); setGroupName(""); setSelectedUsers([]);
      setLocation(`/chats/${(chat as any).id}`);
    } catch { toast({ title: "Failed to create group", variant: "destructive" }); }
  }

  const totalUnread = (chats || []).reduce((acc: number, c: ChatWithDetails) => acc + (c.unreadCount || 0), 0);

  // Update document title with unread count
  useEffect(() => {
    document.title = totalUnread > 0 ? `(${totalUnread}) Droidgram` : "Droidgram";
    return () => { document.title = "Droidgram"; };
  }, [totalUnread]);

  return (
    <div className="h-screen flex bg-[#0b1020] text-slate-100 overflow-hidden">
      <ClerkProfileSync meId={myId} />

      {/* Sidebar */}
      <div className={`${activeChatId ? "hidden md:flex" : "flex"} flex-col w-full md:w-80 lg:w-[340px] border-r border-white/10 bg-[#13182b]/95 text-slate-100 backdrop-blur-xl shrink-0 pb-16 md:pb-0`}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 text-slate-100">
          <button onClick={() => setLocation("/settings")} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <Avatar src={(me as any)?.avatarUrl} name={(me as any)?.displayName || "Me"} size={34} online />
            <div className="text-left">
              <p className="font-semibold text-sm leading-tight">{(me as any)?.displayName || "Me"}</p>
              <p className="text-[10px] text-green-500 font-medium">Online</p>
            </div>
          </button>
          <div className="flex items-center gap-0.5">
            <button onClick={() => setLocation("/saved")} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors" title="Saved messages">
              <Bookmark size={15} className="text-slate-100" />
            </button>
            <button onClick={() => setLocation("/wallet")} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors" title="Droidgram coins wallet">
              <Zap size={15} className="text-slate-100" />
            </button>
            <button onClick={() => setLocation("/search")} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors" title="Search users">
              <Search size={15} className="text-slate-100" />
            </button>
            <button onClick={() => setShowNewChat(true)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors" title="New chat">
              <Plus size={15} className="text-slate-100" />
            </button>
            <button onClick={() => {
              clearCurrentSession();
              window.dispatchEvent(new Event("pulse-logout-overlay"));
              signOut();
            }} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors" title="Sign out">
              <LogOut size={15} className="text-slate-100" />
            </button>
          </div>
        </div>

        {/* Stats bar */}
        {stats && (
          <div className="grid grid-cols-3 gap-px bg-white/10 mx-4 my-2 rounded-xl overflow-hidden text-center">
            {[
              { label: "Chats", value: (stats as any).totalChats ?? 0 },
              { label: "Unread", value: totalUnread },
              { label: "Online", value: (onlineUsers || []).length },
            ].map((s, i) => (
              <div key={i} className="bg-white/5 px-2 py-2">
                <div className="text-sm font-bold text-slate-100">{s.value}</div>
                <div className="text-[9px] text-slate-400 uppercase tracking-wide">{s.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Search */}
        <div className="px-3 pb-2">
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search chats..."
              className="w-full bg-white/6 text-slate-100 rounded-xl pl-8 pr-3 py-2 text-sm outline-none placeholder:text-slate-500 focus:ring-1 ring-white/10 transition-all"
            />
          </div>
        </div>

        {/* Online users strip */}
        {(onlineUsers || []).length > 0 && (
          <div className="px-3 pb-2">
            <button onClick={() => setShowOnline(!showOnline)} className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors mb-1.5 w-full">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              <span className="font-medium">{(onlineUsers || []).length} online now</span>
              <ChevronDown size={11} className={`ml-auto transition-transform ${showOnline ? "rotate-180" : ""}`} />
            </button>
            <AnimatePresence>
              {showOnline && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                  <div className="flex gap-2 pb-2 overflow-x-auto">
                    {(onlineUsers || []).slice(0, 8).map((u: any) => (
                      <button key={u.id} onClick={() => startDirectChat(u.id)} className="flex flex-col items-center gap-1 shrink-0" title={u.displayName}>
                        <Avatar src={u.avatarUrl} name={u.displayName} size={36} online />
                        <span className="text-[9px] text-slate-400 truncate w-10 text-center">{u.displayName.split(" ")[0]}</span>
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Chat list */}
        <div className="flex-1 overflow-y-auto">
          {chatsLoading ? (
            <div className="space-y-1 p-2">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-3 py-2">
                  <Skeleton className="w-11 h-11 rounded-full" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3 w-3/4" />
                    <Skeleton className="h-2.5 w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredChats.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-52 gap-3 text-slate-400 px-6 text-center">
              <div className="w-14 h-14 bg-white/6 rounded-2xl flex items-center justify-center">
                <MessageSquare size={28} className="text-slate-100" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-100">
                  {searchQuery ? "No chats found" : "No conversations yet"}
                </p>
                <p className="text-xs mt-1 text-slate-400">{searchQuery ? "Try a different search" : "Start a new chat to get going"}</p>
              </div>
              {!searchQuery && (
                <button onClick={() => setShowNewChat(true)} className="text-xs bg-white text-[#111827] rounded-lg px-4 py-1.5 hover:bg-white/90 transition-colors font-medium">
                  New chat
                </button>
              )}
            </div>
          ) : (
            <div>
              {filteredChats.map((chat: ChatWithDetails) => {
                const isActive = activeChatId === chat.id;
                const chatName = getChatName(chat);
                const lastMsg = chat.lastMessage;
                return (
                  <button
                    key={chat.id}
                    onClick={() => setLocation(`/chats/${chat.id}`)}
                    className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-white/6 transition-all text-left relative ${isActive ? "bg-white/8 border-r-2 border-fuchsia-400" : ""}`}
                  >
                    <Avatar src={getChatAvatar(chat)} name={chatName} size={46} online={getChatOnline(chat)} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className={`text-sm truncate ${isActive ? "font-semibold text-white" : "font-medium text-slate-100"}`}>{chatName}</span>
                        {lastMsg && (
                          <span className="text-[10px] text-slate-400 shrink-0 ml-2">{formatTime(lastMsg.createdAt)}</span>
                        )}
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1 min-w-0">
                          {/* Read receipt for own last message */}
                          {lastMsg && lastMsg.senderId === myId && !lastMsg.isDeleted && (
                            lastMsg.readBy && lastMsg.readBy.length > 1
                              ? <CheckCheck size={11} className="text-blue-400 shrink-0" />
                              : <CheckCheck size={11} className="text-slate-500 shrink-0" />
                          )}
                          <p className="text-xs text-slate-400 truncate">
                            {lastMsg
                              ? (lastMsg.isDeleted
                                ? "🚫 Message deleted"
                                : (chat.type === "group" && lastMsg.sender?.displayName ? `${lastMsg.sender.displayName.split(" ")[0]}: ${formatMsgPreview(lastMsg.content)}` : formatMsgPreview(lastMsg.content)))
                              : "Tap to start chatting"}
                          </p>
                        </div>
                        {chat.unreadCount > 0 ? (
                          <span className="bg-fuchsia-400 text-[#111827] text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 shrink-0 shadow-sm shadow-fuchsia-500/20">
                            {chat.unreadCount > 99 ? "99+" : chat.unreadCount}
                          </span>
                        ) : isActive && (
                          <span className="w-1.5 h-1.5 rounded-full bg-primary/40 shrink-0" />
                        )}
                      </div>
                    </div>
                    {chat.type === "group" && (
                      <Hash size={10} className="absolute top-2 right-2 text-slate-500" />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Chat window or empty state */}
      {activeChatId ? (
        <ChatWindow chatId={activeChatId} myId={myId} me={me} onBack={() => setLocation("/chats")} />
      ) : (
        <div className="hidden md:flex flex-1 flex-col items-center justify-center bg-[#0b1020] gap-4 relative overflow-hidden">
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
          </div>
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 20 }}
            className="w-20 h-20 bg-gradient-to-br from-fuchsia-500/20 via-violet-500/20 to-sky-500/20 rounded-3xl flex items-center justify-center border border-white/10"
          >
            <MessageSquare size={36} className="text-slate-100" />
          </motion.div>
          <motion.div initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.15 }} className="text-center">
            <h3 className="font-bold text-xl mb-1 text-slate-100">Your messages</h3>
            <p className="text-sm text-slate-400">Select a chat or start a new conversation</p>
          </motion.div>
          <motion.button
            initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.25 }}
            onClick={() => setShowNewChat(true)}
            className="bg-white text-[#111827] rounded-xl px-6 py-2.5 text-sm font-semibold hover:bg-white/90 transition-colors shadow-lg shadow-white/10"
          >
            Start a conversation
          </motion.button>
        </div>
      )}

      {/* New Chat Modal */}
      <AnimatePresence>
        {showNewChat && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
            <motion.div
              initial={{ y: "100%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "100%", opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="bg-[#17182b] border border-white/10 rounded-t-3xl sm:rounded-2xl w-full sm:max-w-md shadow-2xl overflow-hidden text-slate-100"
            >
              <div className="w-10 h-1 bg-border rounded-full mx-auto mt-3 mb-1 sm:hidden" />
              <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                <div>
                  <h3 className="font-bold">{groupMode ? "New Group" : "New Chat"}</h3>
                  <button onClick={() => setGroupMode(!groupMode)} className="text-xs text-primary">
                    {groupMode ? "→ Direct message" : "→ Create group instead"}
                  </button>
                </div>
                <button onClick={() => { setShowNewChat(false); setGroupMode(false); setSelectedUsers([]); }} className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-white/8 text-slate-400">
                  <X size={16} />
                </button>
              </div>

              <div className="p-4 space-y-3 max-h-[70vh] overflow-y-auto">
                {groupMode && (
                  <input
                    value={groupName} onChange={e => setGroupName(e.target.value)}
                    placeholder="Group name..."
                    className="w-full bg-white/6 rounded-xl px-4 py-2.5 text-sm outline-none text-slate-100 placeholder:text-slate-500 focus:ring-1 ring-fuchsia-400/30"
                    autoFocus
                  />
                )}
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    value={newChatSearch} onChange={e => setNewChatSearch(e.target.value)}
                    placeholder="Search people..."
                    className="w-full bg-white/6 rounded-xl pl-9 pr-3 py-2.5 text-sm outline-none text-slate-100 placeholder:text-slate-500 focus:ring-1 ring-fuchsia-400/30"
                    autoFocus={!groupMode}
                  />
                </div>

                {groupMode && selectedUsers.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {selectedUsers.map((u: any) => (
                      <motion.span key={u.id} initial={{ scale: 0 }} animate={{ scale: 1 }} className="flex items-center gap-1.5 bg-primary/15 text-primary text-xs rounded-full px-3 py-1 font-medium">
                        {u.displayName}
                        <button onClick={() => setSelectedUsers(p => p.filter((x: any) => x.id !== u.id))}><X size={11} /></button>
                      </motion.span>
                    ))}
                  </div>
                )}

                <div className="space-y-1">
                  {newChatSearch.length > 1 && (searchResults || []).length === 0 && (
                    <p className="text-sm text-slate-400 text-center py-6">No users found for "{newChatSearch}"</p>
                  )}
                  {(searchResults || []).map((user: any) => (
                    <button
                      key={user.id}
                      onClick={() => groupMode ? setSelectedUsers(p => p.find((x: any) => x.id === user.id) ? p : [...p, user]) : startDirectChat(user.id)}
                      className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-white/6 transition-colors text-left"
                    >
                      <Avatar src={user.avatarUrl} name={user.displayName} size={40} online={user.isOnline} />
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-slate-100">{user.displayName}</p>
                        <p className="text-xs text-slate-400">@{user.username} {user.isOnline ? "· 🟢 Online" : ""}</p>
                      </div>
                      {groupMode && selectedUsers.find((x: any) => x.id === user.id) && (
                        <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center"><Check size={12} className="text-white" /></div>
                      )}
                    </button>
                  ))}
                  {newChatSearch.length <= 1 && (
                    <p className="text-xs text-slate-500 text-center py-4">Type a name or username to search</p>
                  )}
                </div>

                {groupMode && (
                  <button
                    onClick={createGroupChat}
                    disabled={!groupName.trim() || selectedUsers.length === 0 || createChat.isPending}
                    className="w-full bg-fuchsia-500 text-white rounded-xl py-3 text-sm font-bold disabled:opacity-40 hover:bg-fuchsia-400 transition-colors"
                  >
                    {createChat.isPending ? "Creating…" : `Create group with ${selectedUsers.length} member${selectedUsers.length !== 1 ? "s" : ""}`}
                  </button>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── ChatWindow ───────────────────────────────────────────────────────────────

function ChatWindow({ chatId, myId, me, onBack }: { chatId: number; myId: number; me: any; onBack: () => void }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const prevMsgCountRef = useRef(0);

  const { data: chats } = useGetChats();
  const { data: messages, isLoading: msgsLoading } = useGetMessages(
    chatId, {},
    { query: { refetchInterval: 1500, queryKey: getGetMessagesQueryKey(chatId, {}) } }
  );

  const sendMessage = useSendMessage();
  const editMessage = useEditMessage();
  const deleteMessage = useDeleteMessage();
  const reactToMessage = useReactToMessage();
  const markRead = useMarkMessageRead();

  const [input, setInput] = useState("");
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [editingMsg, setEditingMsg] = useState<Message | null>(null);
  const [hoveredMsgId, setHoveredMsgId] = useState<number | null>(null);
  const [showEmojiFor, setShowEmojiFor] = useState<number | null>(null);
  const [showMembersPanel, setShowMembersPanel] = useState(false);
  const [atBottom, setAtBottom] = useState(true);
  const [searchMode, setSearchMode] = useState(false);
  const [msgSearch, setMsgSearch] = useState("");
  const [contextMenu, setContextMenu] = useState<{ msg: Message; x: number; y: number } | null>(null);
  const longPressRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Swipe-to-reply tracking
  const swipeTouchStartX = useRef<number>(0);
  const swipeTouchMsgId = useRef<number | null>(null);
  const [swipeOffset, setSwipeOffset] = useState<{ id: number; x: number } | null>(null);
  const [, setLocation] = useLocation();

  // ── Call state ──────────────────────────────────────────────────────────────
  const [callState, setCallState] = useState<{
    phase: "ringing" | "connected"; type: "audio" | "video";
    muted: boolean; videoOff: boolean; speaker: boolean; duration: number;
  } | null>(null);
  const [lastCall, setLastCall] = useState<{ type: "audio" | "video"; chatId: number } | null>(null);
  const lastCallTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [callMinimized, setCallMinimized] = useState(false);
  const [incomingCall, setIncomingCall] = useState<{
    fromName: string; fromId: number; signalKey: string; type: "audio" | "video";
  } | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const callTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const callRingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ringtoneStopRef = useRef<(() => void) | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);

  // ── Extra feature state ──────────────────────────────────────────────────────
  const { getToken } = useAuth();
  const [typingUsers, setTypingUsers] = useState<{ userId: number; name: string }[]>([]);
  const [pinnedMsg, setPinnedMsg] = useState<Message | null>(null);
  const [forwardingMsg, setForwardingMsg] = useState<Message | null>(null);
  const [showImageInput, setShowImageInput] = useState(false);
  const [imageInputUrl, setImageInputUrl] = useState("");
  const [pickedMediaName, setPickedMediaName] = useState("");
  const [pickedMediaPreview, setPickedMediaPreview] = useState<{ url: string; type: "image" | "video" } | null>(null);
  const [voiceRecState, setVoiceRecState] = useState<"idle"|"recording"|"preview">("idle");
  const [voiceDuration, setVoiceDuration] = useState(0);
  const [voiceBlob, setVoiceBlob] = useState<Blob | null>(null);
  const [voiceUrl, setVoiceUrl] = useState<string | null>(null);
  const [starredMsgs, setStarredMsgs] = useState<Set<number>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem("pulse_starred") || "[]")); } catch { return new Set(); }
  });
  const [emojiCat, setEmojiCat] = useState(Object.keys(EMOJI_CATEGORIES)[0]);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const voiceChunksRef = useRef<Blob[]>([]);
  const voiceTimerRef2 = useRef<ReturnType<typeof setInterval> | null>(null);
  const isSendingVoiceRef = useRef(false);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── E2EE state ──────────────────────────────────────────────────────────────
  const keyPairRef = useRef<CryptoKeyPair | null>(null);
  const e2eeInitRef = useRef(false);
  const [chatKey, setChatKey] = useState<CryptoKey | null>(null);
  const [decryptedMsgs, setDecryptedMsgs] = useState<Map<number, string>>(new Map());

  // ── Extra features state ─────────────────────────────────────────────────────
  const [showStickers, setShowStickers] = useState(false);
  const [stickerPack, setStickerPack] = useState(Object.keys(STICKER_PACKS)[0]);
  const [chatTheme, setChatTheme] = useState<string>(() => {
    try { return localStorage.getItem(`pulse_theme_${chatId}`) || "default"; } catch { return "default"; }
  });
  const [showThemePicker, setShowThemePicker] = useState(false);
  const [profileViewer, setProfileViewer] = useState<any>(null);
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState(["", ""]);
  const [pollMultiple, setPollMultiple] = useState(false);
  const [pollsData, setPollsData] = useState<Map<number, any>>(new Map());
  const [cmdSuggestions, setCmdSuggestions] = useState<typeof BOT_COMMANDS>([]);
  const [walletBal, setWalletBal] = useState<number | null>(null);
  const [coinModal, setCoinModal] = useState<{
    step: "select_user" | "enter_amount";
    search: string;
    recipient: { id: number; displayName: string; avatarUrl?: string | null; isOnline?: boolean } | null;
    amount: string;
    loading: boolean;
  } | null>(null);

  const chat = (chats || []).find((c: any) => c.id === chatId);
  const chatName = chat ? (chat.type === "group" ? chat.name || "Group" : chat.members?.find((m: any) => m.id !== myId)?.displayName || "Chat") : "";
  const chatAvatar = chat?.type === "direct" ? chat.members?.find((m: any) => m.id !== myId)?.avatarUrl : null;
  const activeTheme = CHAT_THEMES.find(t => t.id === chatTheme) || CHAT_THEMES[0];
  const chatOnline = chat?.type === "direct" ? chat.members?.find((m: any) => m.id !== myId)?.isOnline : false;
  const msgList = messages || [];

  // Filter messages by search
  const displayedMessages = msgSearch.trim()
    ? msgList.filter((m: Message) => m.content?.toLowerCase().includes(msgSearch.toLowerCase()) && !m.isDeleted)
    : msgList;

  // Scroll to bottom
  const scrollToBottom = useCallback((smooth = true) => {
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? "smooth" : "instant" });
  }, []);

  // Auto-scroll on new messages only if at bottom
  useEffect(() => {
    if (!messages) return;
    const newCount = msgList.length;
    const lastMsg = msgList[msgList.length - 1];
    const isOwnMsg = lastMsg?.senderId === myId;
    if (newCount > prevMsgCountRef.current) {
      if (isOwnMsg || atBottom) {
        scrollToBottom();
      } else {
        playMessageSound();
        // Browser notification for new messages from others
        if (lastMsg && !isOwnMsg && !(lastMsg as any)._optimistic) {
          if (Notification.permission === "granted" && document.visibilityState !== "visible") {
            try {
              new Notification(`${lastMsg.sender?.displayName || "New message"} in ${chatName || "Droidgram"}`, {
                body: formatMsgPreview(lastMsg.content),
                icon: "/logo.svg",
                tag: `msg-${lastMsg.id}`,
              });
            } catch {}
          }
        }
      }
    }
    prevMsgCountRef.current = newCount;
  }, [messages?.length]);

  // Track scroll position
  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const dist = el.scrollHeight - el.scrollTop - el.clientHeight;
    setAtBottom(dist < 80);
  }, []);

  // Mark messages as read
  useEffect(() => {
    msgList.forEach((m: Message) => {
      if (!m.isDeleted && !m.readBy.includes(myId)) {
        markRead.mutate({ chatId, messageId: m.id });
      }
    });
  }, [messages, chatId]);

  // Request browser notification permission once
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
  }, []);

  // ── E2EE: init key pair + upload public key ──────────────────────────────────
  useEffect(() => {
    if (!myId || e2eeInitRef.current) return;
    e2eeInitRef.current = true;
    getOrCreateKeyPair().then(async ({ keyPair, publicKeyB64 }) => {
      keyPairRef.current = keyPair;
      const token = await getToken();
      fetch("/api/users/pubkey", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ publicKey: publicKeyB64 }),
      }).catch(() => {});
    }).catch(() => {});
  }, [myId]);

  // ── E2EE: derive per-chat encryption key ─────────────────────────────────────
  useEffect(() => {
    if (!chat || !myId) return;
    const currentChat = chat;
    setChatKey(null);
    setDecryptedMsgs(new Map());

    async function derive() {
      if (!keyPairRef.current) {
        const { keyPair } = await getOrCreateKeyPair();
        keyPairRef.current = keyPair;
      }
      const token = await getToken();

      if (currentChat.type === "direct") {
        const other = (currentChat as any).members?.find((m: any) => m.id !== myId);
        if (!other) return;
        const r = await fetch(`/api/users/${other.id}/pubkey`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!r.ok) return;
        const { publicKey: theirB64 } = await r.json();
        const theirKey = await importPublicKey(theirB64);
        const key = await deriveSharedKey(keyPairRef.current.privateKey, theirKey);
        setChatKey(key);
      } else {
        const ids: number[] = ((currentChat as any).members || []).map((m: any) => m.id as number);
        const key = await deriveGroupKey(ids, currentChat.id);
        setChatKey(key);
      }
    }

    derive().catch(() => {});
  }, [chatId, (chat as any)?.members?.length, myId]);

  // ── E2EE: decrypt incoming messages ──────────────────────────────────────────
  useEffect(() => {
    if (!chatKey || !messages) return;
    const encMsgs = (messages as Message[]).filter(m => isEncrypted(m.content));
    if (!encMsgs.length) return;

    Promise.all(
      encMsgs.map(async (m) => {
        const dec = await decryptMsg(chatKey, m.content!);
        return [m.id, dec] as [number, string];
      })
    ).then(pairs => {
      setDecryptedMsgs(prev => {
        const next = new Map(prev);
        pairs.forEach(([id, text]) => next.set(id, text));
        return next;
      });
    }).catch(() => {});
  }, [messages, chatKey]);

  // Typing indicator polling
  useEffect(() => {
    if (!chatId) return;
    const poll = async () => {
      try {
        const token = await getToken();
        const r = await fetch(`/api/chats/${chatId}/typing`, { headers: { Authorization: `Bearer ${token}` } });
        if (r.ok) setTypingUsers((await r.json()).typing || []);
      } catch {}
    };
    poll();
    const id = setInterval(poll, 2000);
    return () => clearInterval(id);
  }, [chatId]);

  // Pinned message
  useEffect(() => {
    if (!chatId) return;
    const fetchPin = async () => {
      try {
        const token = await getToken();
        const r = await fetch(`/api/chats/${chatId}/pin`, { headers: { Authorization: `Bearer ${token}` } });
        if (r.ok) { const d = await r.json(); setPinnedMsg(d.pinnedMessage || null); }
      } catch {}
    };
    fetchPin();
  }, [chatId]);

  // Wallet balance
  useEffect(() => {
    getToken().then(token => {
      fetch("/api/wallet", { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.json()).then(d => setWalletBal(d.balance ?? null)).catch(() => {});
    });
  }, []);

  // Theme persistence
  useEffect(() => {
    localStorage.setItem(`pulse_theme_${chatId}`, chatTheme);
  }, [chatTheme, chatId]);

  // Fetch poll data for [poll:ID] messages
  useEffect(() => {
    if (!messages) return;
    (messages as Message[]).forEach((m: Message) => {
      const match = m.content?.match(/^\[poll:(\d+)\]$/);
      if (match) {
        const pollId = Number(match[1]);
        if (!pollsData.has(pollId)) {
          getToken().then(token => {
            fetch(`/api/chats/${chatId}/polls/${pollId}`, { headers: { Authorization: `Bearer ${token}` } })
              .then(r => r.ok ? r.json() : null)
              .then(data => { if (data) setPollsData(prev => new Map(prev).set(pollId, data)); })
              .catch(() => {});
          });
        }
      }
    });
  }, [messages]);

  async function votePoll(pollId: number, choices: number[]) {
    const token = await getToken();
    const r = await fetch(`/api/chats/${chatId}/polls/${pollId}/vote`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ choices }),
    });
    if (r.ok) {
      const upd = await fetch(`/api/chats/${chatId}/polls/${pollId}`, { headers: { Authorization: `Bearer ${token}` } });
      if (upd.ok) { const d = await upd.json(); setPollsData(prev => new Map(prev).set(pollId, d)); }
      toast({ title: "✅ Voted!" });
    }
  }

  async function handleCreatePoll() {
    const opts = pollOptions.filter(o => o.trim());
    if (!pollQuestion.trim() || opts.length < 2) {
      toast({ title: "Need a question and at least 2 options", variant: "destructive" }); return;
    }
    const token = await getToken();
    const r = await fetch(`/api/chats/${chatId}/polls`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ question: pollQuestion.trim(), options: opts, allowMultiple: pollMultiple }),
    });
    if (r.ok) {
      const poll = await r.json();
      await sendMessage.mutateAsync({ chatId, data: { content: `[poll:${poll.id}]`, replyToId: null } });
      qc.invalidateQueries({ queryKey: getGetMessagesQueryKey(chatId, {}) });
      setPollQuestion(""); setPollOptions(["", ""]); setPollMultiple(false);
      toast({ title: "📊 Poll created!" });
    }
  }

  async function handleBotCommand(cmd: string, fullText: string): Promise<void> {
    clearInput(); setCmdSuggestions([]);
    if (cmd === "/shrug") {
      await sendMessage.mutateAsync({ chatId, data: { content: "¯\\_(ツ)_/¯", replyToId: null } });
    } else if (cmd === "/flip") {
      await sendMessage.mutateAsync({ chatId, data: { content: Math.random() > 0.5 ? "🪙 Heads!" : "🪙 Tails!", replyToId: null } });
    } else if (cmd === "/roll") {
      await sendMessage.mutateAsync({ chatId, data: { content: `🎲 Rolled a ${Math.floor(Math.random() * 6) + 1}!`, replyToId: null } });
    } else if (cmd === "/me") {
      const action = fullText.slice(3).trim();
      if (action) await sendMessage.mutateAsync({ chatId, data: { content: `_${action}_`, replyToId: null } });
      return;
    } else if (cmd === "/coin") {
      clearInput(); setCmdSuggestions([]);
      setCoinModal({ step: "select_user", search: "", recipient: null, amount: "", loading: false });
      return;
    }
    qc.invalidateQueries({ queryKey: getGetMessagesQueryKey(chatId, {}) });
  }

  const clearInput = useCallback(() => {
    setInput("");
    if (inputRef.current) {
      inputRef.current.textContent = "";
    }
  }, []);

  async function handleSend() {
    const text = input.trim();
    if (!text) return;
    // Bot command interception
    if (text.startsWith("/")) {
      const cmd = text.split(/\s+/)[0].toLowerCase();
      if (BOT_COMMANDS.find(c => c.cmd === cmd)) {
        await handleBotCommand(cmd, text);
        return;
      }
    }
    const rId = replyTo?.id ?? null;
    const wasEditing = editingMsg;
    clearInput();
    setReplyTo(null);
    setEditingMsg(null);

    if (wasEditing) {
      // Optimistic edit
      qc.setQueryData(getGetMessagesQueryKey(chatId, {}), (old: any) => {
        const patch = (msgs: any[]) => msgs.map(m => m.id === wasEditing.id ? { ...m, content: text, isEdited: true } : m);
        if (Array.isArray(old)) return patch(old);
        if (old?.messages) return { ...old, messages: patch(old.messages) };
        return old;
      });
      try {
        let editContent = text;
        if (chatKey && shouldEncrypt(text)) {
          editContent = await encryptMsg(chatKey, text);
        }
        const updated = await editMessage.mutateAsync({ chatId, messageId: wasEditing.id, data: { content: editContent } });
        if ((updated as any)?.id && editContent !== text) {
          setDecryptedMsgs(prev => new Map(prev).set((updated as any).id, text));
        }
        qc.invalidateQueries({ queryKey: getGetMessagesQueryKey(chatId, {}) });
      } catch {
        toast({ title: "Failed to edit message", variant: "destructive" });
        qc.invalidateQueries({ queryKey: getGetMessagesQueryKey(chatId, {}) });
      }
    } else {
      // Optimistic send — instantly show in UI
      const tempId = -(Date.now());
      const tempMsg: any = {
        id: tempId,
        chatId,
        senderId: myId,
        content: text,
        createdAt: new Date().toISOString(),
        isDeleted: false,
        isEdited: false,
        readBy: [myId],
        reactions: [],
        replyToId: rId,
        replyTo: rId ? msgList.find((m: Message) => m.id === rId) || null : null,
        sender: { id: myId, displayName: me?.displayName || "You", avatarUrl: me?.avatarUrl || null },
        _optimistic: true,
      };
      qc.setQueryData(getGetMessagesQueryKey(chatId, {}), (old: any) => {
        if (Array.isArray(old)) return [...old, tempMsg];
        if (old?.messages) return { ...old, messages: [...old.messages, tempMsg] };
        return old;
      });
      // Scroll to bottom immediately
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 30);
      try {
        let contentToSend = text;
        if (chatKey && shouldEncrypt(text)) {
          contentToSend = await encryptMsg(chatKey, text);
        }
        const sent = await sendMessage.mutateAsync({ chatId, data: { content: contentToSend, replyToId: rId } });
        // Pre-populate decrypted map so sent message renders instantly without flash
        if ((sent as any)?.id && contentToSend !== text) {
          setDecryptedMsgs(prev => new Map(prev).set((sent as any).id, text));
        }
        qc.invalidateQueries({ queryKey: getGetMessagesQueryKey(chatId, {}) });
        qc.invalidateQueries({ queryKey: getGetChatsQueryKey() });
      } catch {
        // Remove optimistic message on error
        qc.setQueryData(getGetMessagesQueryKey(chatId, {}), (old: any) => {
          const patch = (msgs: any[]) => msgs.filter(m => m.id !== tempId);
          if (Array.isArray(old)) return patch(old);
          if (old?.messages) return { ...old, messages: patch(old.messages) };
          return old;
        });
        toast({ title: "Failed to send", variant: "destructive" });
      }
    }
  }

  async function handleDelete(msg: Message) {
    try {
      await deleteMessage.mutateAsync({ chatId, messageId: msg.id });
      qc.invalidateQueries({ queryKey: getGetMessagesQueryKey(chatId, {}) });
      qc.invalidateQueries({ queryKey: getGetChatsQueryKey() });
    } catch { toast({ title: "Failed to delete", variant: "destructive" }); }
  }

  function handleReact(msgId: number, emoji: string) {
    setShowEmojiFor(null);
    // Optimistic update — reactions are Record<string, number[]> (emoji → userIds)
    qc.setQueryData(getGetMessagesQueryKey(chatId, {}), (old: any) => {
      if (!old) return old;
      const patch = (msgs: any[]) => msgs.map(m => {
        if (m.id !== msgId) return m;
        const reactions: Record<string, number[]> = { ...(m.reactions as Record<string, number[]> || {}) };
        if (!reactions[emoji]) reactions[emoji] = [];
        const idx = reactions[emoji].indexOf(myId);
        if (idx > -1) {
          reactions[emoji] = reactions[emoji].filter(id => id !== myId);
          if (!reactions[emoji].length) delete reactions[emoji];
        } else {
          reactions[emoji] = [...reactions[emoji], myId];
        }
        return { ...m, reactions };
      });
      if (Array.isArray(old)) return patch(old);
      if (old?.messages) return { ...old, messages: patch(old.messages) };
      return old;
    });
    reactToMessage.mutateAsync({ chatId, messageId: msgId, data: { emoji } })
      .then(() => qc.invalidateQueries({ queryKey: getGetMessagesQueryKey(chatId, {}) }))
      .catch(() => qc.invalidateQueries({ queryKey: getGetMessagesQueryKey(chatId, {}) }));
  }

  // ── Extra handlers ───────────────────────────────────────────────────────────
  function notifyTyping() {
    if (!chatId) return;
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    getToken().then(token => {
      fetch(`/api/chats/${chatId}/typing`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ isTyping: true }) }).catch(() => {});
    });
    typingTimeoutRef.current = setTimeout(() => {
      getToken().then(token => {
        fetch(`/api/chats/${chatId}/typing`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ isTyping: false }) }).catch(() => {});
      });
    }, 3000);
  }

  async function handlePin(msgId: number) {
    const isPinned = pinnedMsg?.id === msgId;
    try {
      const token = await getToken();
      await fetch(`/api/chats/${chatId}/pin`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ messageId: isPinned ? null : msgId }) });
      if (isPinned) { setPinnedMsg(null); }
      else { const m = (msgList as Message[]).find(m => m.id === msgId); if (m) setPinnedMsg(m); }
      toast({ title: isPinned ? "Message unpinned" : "📌 Message pinned" });
    } catch { toast({ title: "Failed to pin", variant: "destructive" }); }
  }

  async function handleForwardTo(targetChatId: number) {
    if (!forwardingMsg) return;
    try {
      const token = await getToken();
      await fetch(`/api/chats/${targetChatId}/messages`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ content: forwardingMsg.content, replyToId: null }) });
      qc.invalidateQueries({ queryKey: getGetMessagesQueryKey(targetChatId, {}) });
      qc.invalidateQueries({ queryKey: getGetChatsQueryKey() });
      setForwardingMsg(null);
      toast({ title: "↩ Message forwarded" });
    } catch { toast({ title: "Failed to forward", variant: "destructive" }); }
  }

  async function handleImageSend() {
    const url = pickedMediaPreview?.url || imageInputUrl.trim();
    if (!url) return;
    try {
      await sendMessage.mutateAsync({ chatId, data: { content: url, replyToId: null } });
      qc.invalidateQueries({ queryKey: getGetMessagesQueryKey(chatId, {}) });
      qc.invalidateQueries({ queryKey: getGetChatsQueryKey() });
      setShowImageInput(false); setImageInputUrl(""); setPickedMediaPreview(null); setPickedMediaName("");
    } catch { toast({ title: "Failed to send image", variant: "destructive" }); }
  }

  function handleMediaPick(file: File | null) {
    if (!file) return;
    if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) {
      toast({ title: "Choose an image or video file", variant: "destructive" });
      return;
    }
    const type = file.type.startsWith("video/") ? "video" : "image";
    const url = URL.createObjectURL(file);
    setPickedMediaPreview({ url, type });
    setPickedMediaName(file.name);
    setShowImageInput(true);
    setImageInputUrl("");
  }

  function toggleStar(msgId: number, msg?: Message) {
    setStarredMsgs(prev => {
      const next = new Set(prev);
      if (next.has(msgId)) {
        next.delete(msgId);
        try {
          const saved = JSON.parse(localStorage.getItem("pulse_saved_messages") || "[]");
          localStorage.setItem("pulse_saved_messages", JSON.stringify(saved.filter((m: any) => m.id !== msgId)));
        } catch {}
      } else {
        next.add(msgId);
        if (msg) {
          try {
            const saved = JSON.parse(localStorage.getItem("pulse_saved_messages") || "[]");
            if (!saved.find((m: any) => m.id === msgId)) {
              saved.unshift({ id: msgId, content: msg.content || "", senderName: msg.sender?.displayName, chatName, savedAt: new Date().toISOString() });
              localStorage.setItem("pulse_saved_messages", JSON.stringify(saved.slice(0, 200)));
            }
          } catch {}
        }
      }
      localStorage.setItem("pulse_starred", JSON.stringify([...next]));
      return next;
    });
  }

  async function startVoiceRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : "audio/webm";
      const rec = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = rec;
      voiceChunksRef.current = [];
      rec.ondataavailable = (e) => { if (e.data.size > 0) voiceChunksRef.current.push(e.data); };
      rec.onstop = () => {
        const blob = new Blob(voiceChunksRef.current, { type: mimeType });
        setVoiceBlob(blob);
        setVoiceUrl(URL.createObjectURL(blob));
        setVoiceRecState("preview");
        stream.getTracks().forEach(t => t.stop());
      };
      rec.start(250);
      setVoiceRecState("recording");
      setVoiceDuration(0);
      voiceTimerRef2.current = setInterval(() => setVoiceDuration(d => d + 1), 1000);
    } catch { toast({ title: "Could not access microphone", variant: "destructive" }); }
  }

  function stopVoiceRecording() {
    mediaRecorderRef.current?.stop();
    if (voiceTimerRef2.current) { clearInterval(voiceTimerRef2.current); voiceTimerRef2.current = null; }
  }

  function cancelVoice() {
    mediaRecorderRef.current?.stop();
    if (voiceTimerRef2.current) clearInterval(voiceTimerRef2.current);
    if (voiceUrl) URL.revokeObjectURL(voiceUrl);
    setVoiceRecState("idle"); setVoiceBlob(null); setVoiceUrl(null); setVoiceDuration(0);
  }

  async function sendVoiceMsg() {
    if (!voiceBlob || isSendingVoiceRef.current) return;
    isSendingVoiceRef.current = true;
    const reader = new FileReader();
    reader.readAsDataURL(voiceBlob);
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      const content = `[voice:${voiceDuration}:${dataUrl}]`;
      try {
        await sendMessage.mutateAsync({ chatId, data: { content, replyToId: null } });
        qc.invalidateQueries({ queryKey: getGetMessagesQueryKey(chatId, {}) });
        qc.invalidateQueries({ queryKey: getGetChatsQueryKey() });
        cancelVoice();
      } catch { toast({ title: "Failed to send voice message", variant: "destructive" }); }
      finally { isSendingVoiceRef.current = false; }
    };
    reader.onerror = () => { isSendingVoiceRef.current = false; };
  }

  // ── Ringtone helpers ─────────────────────────────────────────────────────────
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

  function stopRingtone() {
    ringtoneStopRef.current?.();
    ringtoneStopRef.current = null;
  }

  // ── Incoming call + accepted signal listeners ─────────────────────────────────
  useEffect(() => {
    const inKey = `pulse_call_in_${myId}`;
    const acceptKey = `pulse_call_accepted_${myId}`;
    const declineKey = `pulse_call_declined_${myId}`;

    function handleStorage(e: StorageEvent) {
      // Someone is calling me
      if (e.key === inKey && e.newValue) {
        try {
          const sig = JSON.parse(e.newValue);
          if (Date.now() - sig.timestamp > 30000) return;
          setIncomingCall({ fromName: sig.fromName, fromId: sig.fromId, signalKey: inKey, type: sig.type });
          ringtoneStopRef.current = buildRingtone(false);
        } catch {}
      }
      // Incoming call removed (caller cancelled)
      if (e.key === inKey && !e.newValue) {
        setIncomingCall(null);
        stopRingtone();
      }
      // Other user accepted MY outgoing call
      if (e.key === acceptKey && e.newValue) {
        localStorage.removeItem(acceptKey);
        stopRingtone();
        if (callRingTimeoutRef.current) { clearTimeout(callRingTimeoutRef.current); callRingTimeoutRef.current = null; }
        setCallState(prev => prev?.phase === "ringing" ? { ...prev, phase: "connected", duration: 0 } : prev);
        if (callTimerRef.current) clearInterval(callTimerRef.current);
        callTimerRef.current = setInterval(() => setCallState(p => p ? { ...p, duration: p.duration + 1 } : p), 1000);
      }
      // Other user declined MY outgoing call
      if (e.key === declineKey && e.newValue) {
        localStorage.removeItem(declineKey);
        stopRingtone();
        if (callRingTimeoutRef.current) { clearTimeout(callRingTimeoutRef.current); callRingTimeoutRef.current = null; }
        setCallState(null);
        toast({ title: "Call declined" });
      }
    }

    window.addEventListener("storage", handleStorage);

    // Check existing incoming call signal on mount
    const existing = localStorage.getItem(inKey);
    if (existing) {
      try {
        const sig = JSON.parse(existing);
        if (Date.now() - sig.timestamp <= 30000) {
          setIncomingCall({ fromName: sig.fromName, fromId: sig.fromId, signalKey: inKey, type: sig.type });
          ringtoneStopRef.current = buildRingtone(false);
        } else {
          localStorage.removeItem(inKey);
        }
      } catch {}
    }

    return () => window.removeEventListener("storage", handleStorage);
  }, [myId]);

  // ── Call handlers ────────────────────────────────────────────────────────────
  async function startCall(type: "audio" | "video") {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: type === "video" });
      localStreamRef.current = stream;
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;
      setCallState({ phase: "ringing", type, muted: false, videoOff: false, speaker: true, duration: 0 });
      ringtoneStopRef.current = buildRingtone(true);
      const otherUser = (chat as any)?.members?.find((m: any) => m.id !== myId);
      if (otherUser) {
        const sigKey = `pulse_call_in_${otherUser.id}`;
        const myName = me?.displayName || me?.username || "Someone";
        localStorage.setItem(sigKey, JSON.stringify({ fromName: myName, fromId: myId, chatId, type, timestamp: Date.now() }));
        // No-answer timeout — use functional setState to avoid stale closure
        callRingTimeoutRef.current = setTimeout(() => {
          stopRingtone();
          localStorage.removeItem(sigKey);
          setCallState(prev => {
            if (prev?.phase === "ringing") {
              setTimeout(() => toast({ title: "No answer" }), 0);
              return null;
            }
            return prev;
          });
        }, 30000);
      }
    } catch {
      toast({ title: "Could not access camera/microphone", variant: "destructive" });
    }
  }

  function endCall() {
    stopRingtone();
    if (callRingTimeoutRef.current) { clearTimeout(callRingTimeoutRef.current); callRingTimeoutRef.current = null; }
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    localStreamRef.current = null;
    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    if (remoteAudioRef.current) remoteAudioRef.current.srcObject = null;
    if (callTimerRef.current) { clearInterval(callTimerRef.current); callTimerRef.current = null; }
    const otherUser = (chat as any)?.members?.find((m: any) => m.id !== myId);
    if (otherUser) localStorage.removeItem(`pulse_call_in_${otherUser.id}`);
    // Save last call info so user can rejoin within 15 seconds
    const type = callState?.type ?? "audio";
    setLastCall({ type, chatId });
    setCallMinimized(false);
    if (lastCallTimerRef.current) clearTimeout(lastCallTimerRef.current);
    lastCallTimerRef.current = setTimeout(() => setLastCall(null), 15000);
    setCallState(null);
  }

  function acceptIncomingCall() {
    if (!incomingCall) return;
    stopRingtone();
    localStorage.removeItem(incomingCall.signalKey);
    // Signal the caller that we accepted
    localStorage.setItem(`pulse_call_accepted_${incomingCall.fromId}`, String(Date.now()));
    setTimeout(() => localStorage.removeItem(`pulse_call_accepted_${incomingCall.fromId}`), 3000);
    setIncomingCall(null);
    setCallState({ phase: "connected", type: incomingCall.type, muted: false, videoOff: false, speaker: true, duration: 0 });
    callTimerRef.current = setInterval(() => setCallState(prev => prev ? { ...prev, duration: prev.duration + 1 } : prev), 1000);
  }

  function declineIncomingCall() {
    if (!incomingCall) return;
    stopRingtone();
    localStorage.removeItem(incomingCall.signalKey);
    // Signal the caller that we declined
    localStorage.setItem(`pulse_call_declined_${incomingCall.fromId}`, String(Date.now()));
    setTimeout(() => localStorage.removeItem(`pulse_call_declined_${incomingCall.fromId}`), 3000);
    setIncomingCall(null);
  }

  function formatCallDur(s: number) {
    const m = Math.floor(s / 60).toString().padStart(2, "0");
    return `${m}:${(s % 60).toString().padStart(2, "0")}`;
  }

  function openContextMenu(e: React.MouseEvent | React.TouchEvent, msg: Message) {
    e.preventDefault();
    e.stopPropagation();
    let x: number, y: number;
    if ("touches" in e) {
      x = e.touches[0]?.clientX ?? (e as any).changedTouches?.[0]?.clientX ?? 0;
      y = e.touches[0]?.clientY ?? (e as any).changedTouches?.[0]?.clientY ?? 0;
    } else {
      x = (e as React.MouseEvent).clientX;
      y = (e as React.MouseEvent).clientY;
    }
    setContextMenu({ msg, x, y });
    setShowEmojiFor(null);
    setHoveredMsgId(null);
  }

  function closeContextMenu() {
    setContextMenu(null);
  }

  function startEdit(msg: Message) {
    setEditingMsg(msg);
    setInput(msg.content || "");
    setReplyTo(null);
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.textContent = msg.content || "";
        inputRef.current.focus();
        const range = document.createRange();
        const sel = window.getSelection();
        range.selectNodeContents(inputRef.current);
        range.collapse(false);
        sel?.removeAllRanges();
        sel?.addRange(range);
      }
    }, 10);
  }

  return (
    <div className="flex-1 flex min-w-0 h-[100dvh] relative overflow-hidden">
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-sidebar/90 backdrop-blur-md shrink-0 z-10">
          <button onClick={onBack} className="md:hidden w-8 h-8 flex items-center justify-center rounded-xl hover:bg-accent shrink-0">
            <ArrowLeft size={18} />
          </button>
          {chat ? (
            <button onClick={() => chat.type === "group" && setShowMembersPanel(!showMembersPanel)} className="flex items-center gap-3 flex-1 min-w-0 text-left hover:opacity-80 transition-opacity">
              <div className="relative shrink-0">
                <Avatar src={chatAvatar} name={chatName} size={38} online={false} />
                {chatOnline && (
                  <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-green-500 border-2 border-sidebar ring-0">
                    <span className="absolute inset-0 rounded-full bg-green-400 animate-ping opacity-75" />
                  </span>
                )}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="font-bold text-sm truncate">{chatName}</p>
                  {chatKey && (
                    <span title="End-to-end encrypted" className="flex items-center gap-0.5 shrink-0">
                      <Lock size={10} className="text-green-400" />
                    </span>
                  )}
                </div>
                <p className={`text-[11px] truncate ${chatOnline ? "text-green-400 font-medium" : "text-muted-foreground"}`}>
                  {typingUsers.length > 0
                    ? <span className="text-primary italic">{typingUsers[0].name} is typing…</span>
                    : chatKey ? (
                        chatOnline ? "Active now · End-to-end encrypted"
                        : chat.type === "group" ? `${chat.members?.length || 0} members · End-to-end encrypted`
                        : "End-to-end encrypted"
                      )
                    : chatOnline ? "Active now"
                    : chat.type === "group" ? `${chat.members?.length || 0} members`
                    : "Last seen recently"}
                </p>
              </div>
            </button>
          ) : (
            <div className="flex items-center gap-3 flex-1">
              <Skeleton className="w-10 h-10 rounded-full" />
              <div className="space-y-1.5 flex-1"><Skeleton className="h-3.5 w-32" /><Skeleton className="h-2.5 w-20" /></div>
            </div>
          )}
          <div className="flex items-center gap-0.5 shrink-0">
            <button onClick={() => startCall("audio")} className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-green-500/10 text-muted-foreground hover:text-green-400 transition-colors" title="Voice call">
              <Phone size={15} />
            </button>
            <button onClick={() => startCall("video")} className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors" title="Video call">
              <Video size={15} />
            </button>
            <button onClick={() => setShowThemePicker(!showThemePicker)} className={`w-8 h-8 flex items-center justify-center rounded-xl hover:bg-accent transition-colors ${showThemePicker ? "bg-primary/20 text-primary" : "text-muted-foreground"}`} title="Chat theme">
              <Palette size={15} />
            </button>
            <button onClick={() => { setSearchMode(!searchMode); setMsgSearch(""); }} className={`w-8 h-8 flex items-center justify-center rounded-xl hover:bg-accent transition-colors ${searchMode ? "bg-primary/20 text-primary" : "text-muted-foreground"}`} title="Search messages">
              <Search size={15} />
            </button>
            {chat?.type === "group" && (
              <button onClick={() => setShowMembersPanel(!showMembersPanel)} className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-accent text-muted-foreground" title="Members">
                <Users size={15} />
              </button>
            )}
          </div>
        </div>

        {/* Search bar */}
        <AnimatePresence>
          {searchMode && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden border-b border-border">
              <div className="px-4 py-2 flex items-center gap-2 bg-accent/20">
                <Search size={13} className="text-muted-foreground shrink-0" />
                <input
                  autoFocus
                  value={msgSearch} onChange={e => setMsgSearch(e.target.value)}
                  placeholder="Search in this chat..."
                  className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                />
                {msgSearch && (
                  <span className="text-xs text-muted-foreground">
                    {displayedMessages.length} result{displayedMessages.length !== 1 ? "s" : ""}
                  </span>
                )}
                <button onClick={() => { setSearchMode(false); setMsgSearch(""); }} className="text-muted-foreground hover:text-foreground"><X size={14} /></button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Pinned message banner */}
        <AnimatePresence>
          {pinnedMsg && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden border-b border-border/50 shrink-0">
              <div className="flex items-center gap-3 px-4 py-2 bg-primary/5 hover:bg-primary/8 transition-colors cursor-pointer group"
                onClick={() => document.getElementById(`msg-${pinnedMsg.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" })}>
                <Pin size={12} className="text-primary/60 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] text-primary font-semibold leading-none mb-0.5">Pinned message</p>
                  <p className="text-xs text-muted-foreground truncate">{pinnedMsg.content?.startsWith("[voice:") ? "🎤 Voice message" : pinnedMsg.content}</p>
                </div>
                <button onClick={e => { e.stopPropagation(); handlePin(pinnedMsg.id); }} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground transition-all">
                  <X size={13} />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Theme picker */}
        <AnimatePresence>
          {showThemePicker && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden shrink-0">
              <div className="px-4 py-3 border-b border-border bg-sidebar/80 backdrop-blur-sm">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-muted-foreground">Chat Theme</p>
                  <button onClick={() => setShowThemePicker(false)} className="text-muted-foreground hover:text-foreground"><X size={13}/></button>
                </div>
                <div className="flex gap-2 flex-wrap">
                  {CHAT_THEMES.map(t => (
                    <button key={t.id} onClick={() => { setChatTheme(t.id); setShowThemePicker(false); }}
                      className={`flex flex-col items-center gap-1 px-3 py-2 rounded-xl text-xs font-medium transition-all border ${chatTheme === t.id ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-primary/40 text-muted-foreground"}`}>
                      <div className={`w-8 h-5 rounded-md ${t.gradient || "bg-accent"}`} />
                      <span className="whitespace-nowrap">{t.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Messages */}
        <div
          ref={containerRef}
          onScroll={handleScroll}
          className={`flex-1 overflow-y-auto px-3 sm:px-4 py-4 ${activeTheme.gradient}`}
        >
          {msgsLoading ? (
            <div className="space-y-4">
              {[...Array(6)].map((_, i) => (
                <div key={i} className={`flex ${i % 2 === 0 ? "justify-start" : "justify-end"} gap-2`}>
                  {i % 2 === 0 && <Skeleton className="w-8 h-8 rounded-full shrink-0 mt-auto" />}
                  <Skeleton className={`h-10 rounded-2xl ${i % 2 === 0 ? "w-48 rounded-bl-sm" : "w-40 rounded-br-sm"}`} />
                </div>
              ))}
            </div>
          ) : displayedMessages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3">
              {msgSearch ? (
                <>
                  <Search size={32} className="opacity-20" />
                  <p className="text-sm">No messages match "{msgSearch}"</p>
                </>
              ) : (
                <>
                  <motion.div
                    initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 200 }}
                    className="w-16 h-16 bg-accent rounded-2xl flex items-center justify-center"
                  >
                    <MessageSquare size={28} className="text-primary/60" />
                  </motion.div>
                  <p className="text-sm font-medium text-foreground">Say hello!</p>
                  <p className="text-xs">Start the conversation with {chatName}</p>
                </>
              )}
            </div>
          ) : (
            <div className="space-y-0.5">
              {displayedMessages.map((msg: Message, idx: number) => {
                const isOwn = msg.senderId === myId;
                const prevMsg = displayedMessages[idx - 1];
                const nextMsg = displayedMessages[idx + 1];
                const showDateSep = !prevMsg || !isSameDay(prevMsg.createdAt, msg.createdAt);
                const showAvatar = !isOwn && (!prevMsg || prevMsg.senderId !== msg.senderId || showDateSep);
                const isGrouped = !showDateSep && prevMsg && prevMsg.senderId === msg.senderId && !msg.isDeleted;
                const nextIsOwn = nextMsg?.senderId === msg.senderId;
                const isFirstUnread = !isOwn && !msg.readBy.includes(myId) &&
                  (idx === 0 || displayedMessages[idx - 1].readBy.includes(myId) || displayedMessages[idx - 1].senderId === myId);

                return (
                  <div key={msg.id}>
                    {/* Unread divider */}
                    {isFirstUnread && !msgSearch && (
                      <div className="flex items-center gap-3 my-3">
                        <div className="flex-1 h-px bg-primary/20" />
                        <span className="text-[10px] text-primary font-semibold bg-primary/10 border border-primary/20 px-3 py-0.5 rounded-full">
                          ↓ New messages
                        </span>
                        <div className="flex-1 h-px bg-primary/20" />
                      </div>
                    )}

                    {/* Date separator */}
                    {showDateSep && (
                      <div className="flex items-center gap-3 my-4">
                        <div className="flex-1 h-px bg-border/60" />
                        <span className="text-[10px] text-muted-foreground font-medium bg-card/80 backdrop-blur-sm px-3 py-1 rounded-full border border-border/50 shadow-sm">
                          {formatDate(msg.createdAt)}
                        </span>
                        <div className="flex-1 h-px bg-border/60" />
                      </div>
                    )}

                    <motion.div
                      initial={{ opacity: 0, y: 6, scale: 0.97 }}
                      animate={{ opacity: 1, y: 0, scale: 1, x: swipeOffset?.id === msg.id ? Math.min(swipeOffset.x, 72) : 0 }}
                      transition={{ duration: swipeOffset?.id === msg.id ? 0 : 0.18 }}
                      style={{ opacity: (msg as any)._optimistic ? 0.75 : 1 }}
                      className={`flex ${isOwn ? "justify-end" : "justify-start"} group relative ${isGrouped ? "mt-0.5" : "mt-3"}`}
                      onMouseEnter={() => setHoveredMsgId(msg.id)}
                      onMouseLeave={() => { setHoveredMsgId(null); }}
                      onContextMenu={e => openContextMenu(e, msg)}
                      onTouchStart={e => {
                        longPressRef.current = setTimeout(() => openContextMenu(e, msg), 500);
                        swipeTouchStartX.current = e.touches[0].clientX;
                        swipeTouchMsgId.current = msg.id;
                      }}
                      onTouchMove={e => {
                        // Cancel long-press if moving
                        if (longPressRef.current) { clearTimeout(longPressRef.current); longPressRef.current = null; }
                        const dx = e.touches[0].clientX - swipeTouchStartX.current;
                        if (swipeTouchMsgId.current === msg.id && dx > 8) {
                          setSwipeOffset({ id: msg.id, x: dx });
                        }
                      }}
                      onTouchEnd={() => {
                        if (longPressRef.current) { clearTimeout(longPressRef.current); longPressRef.current = null; }
                        if (swipeTouchMsgId.current === msg.id && swipeOffset?.id === msg.id && swipeOffset.x >= 60) {
                          setReplyTo(msg);
                          if (inputRef.current) inputRef.current.focus();
                          if (navigator.vibrate) navigator.vibrate(30);
                        }
                        setSwipeOffset(null);
                        swipeTouchMsgId.current = null;
                      }}
                    >
                      {/* Swipe reply hint icon */}
                      {swipeOffset?.id === msg.id && swipeOffset.x > 20 && (
                        <div className={`absolute ${isOwn ? "right-full mr-2" : "left-full ml-2"} top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center transition-all`}
                          style={{ opacity: Math.min(swipeOffset.x / 60, 1) }}>
                          <CornerUpLeft size={14} className="text-primary" />
                        </div>
                      )}
                      {/* Avatar spacer/avatar */}
                      {!isOwn && (
                        <div className="w-8 mr-2 mt-auto shrink-0">
                          {showAvatar ? (
                            <button onClick={() => msg.sender && setProfileViewer(msg.sender)} className="hover:opacity-80 transition-opacity cursor-pointer">
                              <Avatar src={msg.sender?.avatarUrl} name={msg.sender?.displayName || "?"} size={28} />
                            </button>
                          ) : null}
                        </div>
                      )}

                      <div className="max-w-[72%] sm:max-w-[60%]">
                        {/* Sender name */}
                        {!isOwn && showAvatar && (
                          <p className="text-[11px] text-muted-foreground font-medium ml-1 mb-0.5">{msg.sender?.displayName}</p>
                        )}

                        {/* Reply quote */}
                        {msg.replyTo && !msg.replyTo.isDeleted && (
                          <div className={`flex rounded-xl mb-1 overflow-hidden ${isOwn ? "border-r-2 border-primary/40" : "border-l-2 border-primary/60"} bg-accent/50`}>
                            <div className="px-3 py-1.5 min-w-0">
                              <p className="text-[10px] text-primary/80 font-semibold">{msg.replyTo.sender?.displayName}</p>
                              <p className="text-[11px] text-muted-foreground truncate">{formatMsgPreview(msg.replyTo.content)}</p>
                            </div>
                          </div>
                        )}

                        {/* Message bubble */}
                        <div id={`msg-${msg.id}`} className={`relative rounded-2xl px-3.5 py-2.5 text-sm break-words
                          ${isOwn
                            ? `${activeTheme.msgBg || "bg-primary"} text-white rounded-br-md`
                            : "bg-card border border-border/80 text-foreground rounded-bl-md"
                          }
                          ${msg.isDeleted ? "opacity-50" : ""}
                          ${pinnedMsg?.id === msg.id ? "ring-1 ring-primary/40" : ""}
                        `}>
                          {(() => {
                            const rawContent = msg.content;
                            const displayContent = isEncrypted(rawContent)
                              ? (decryptedMsgs.get(msg.id) ?? "🔒 Decrypting…")
                              : rawContent;
                            if (msg.isDeleted) {
                              return <span className="italic text-xs opacity-70">Message was deleted</span>;
                            }
                            if (displayContent?.startsWith("[voice:")) {
                              return <VoiceMessage content={displayContent} isOwn={isOwn} />;
                            }
                            if (displayContent?.match(/^\[poll:(\d+)\]$/)) {
                              return <PollMessage pollId={Number(displayContent.match(/^\[poll:(\d+)\]$/)![1])} pollsData={pollsData} onVote={votePoll} myId={myId} />;
                            }
                            return renderRichText(displayContent || "");
                          })()}
                          {starredMsgs.has(msg.id) && <Star size={8} className={`absolute top-1 ${isOwn ? "right-1" : "left-1"} text-yellow-400 fill-yellow-400`} />}

                          {/* Timestamp + status */}
                          <div className={`flex items-center gap-1 mt-1 text-[10px] ${isOwn ? "text-white/60 justify-end" : "text-muted-foreground"}`}>
                            <span>{new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                            {msg.isEdited && !msg.isDeleted && <span>· edited</span>}
                            {isOwn && !msg.isDeleted && (
                              (msg as any)._optimistic ? (
                                <motion.div className="w-3 h-3 border border-white/30 border-t-white/80 rounded-full shrink-0"
                                  animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }} />
                              ) : msg.readBy.length > 1 ? (
                                <motion.span key="read" initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 400 }}>
                                  <CheckCheck size={12} className="text-blue-300 drop-shadow-sm" />
                                </motion.span>
                              ) : (
                                <CheckCheck size={12} className="opacity-40" />
                              )
                            )}
                          </div>
                        </div>

                        {/* Reactions */}
                        {Object.keys(msg.reactions || {}).length > 0 && (
                          <div className={`flex flex-wrap gap-1 mt-1 ${isOwn ? "justify-end" : "justify-start"}`}>
                            {Object.entries(msg.reactions).map(([emoji, uids]) => (
                              <motion.button
                                key={emoji}
                                whileTap={{ scale: 0.9 }}
                                onClick={() => handleReact(msg.id, emoji)}
                                className={`flex items-center gap-0.5 text-xs rounded-full px-2 py-0.5 border transition-all ${(uids as number[]).includes(myId) ? "bg-primary/20 border-primary/40 text-primary font-semibold" : "bg-card border-border hover:border-primary/40"}`}
                              >
                                <span>{emoji}</span>
                                <span className="text-[10px]">{(uids as number[]).length}</span>
                              </motion.button>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Message action toolbar */}
                      <AnimatePresence>
                        {hoveredMsgId === msg.id && !msg.isDeleted && (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.85 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.85 }}
                            transition={{ duration: 0.1 }}
                            className={`absolute top-0 ${isOwn ? "right-full mr-2" : "left-full ml-2"} flex items-center gap-0.5 bg-card border border-border rounded-xl p-1 shadow-xl z-20`}
                          >
                            <button onClick={() => setReplyTo(msg)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors" title="Reply">
                              <Reply size={13} />
                            </button>
                            <div className="relative">
                              <button
                                onClick={() => setShowEmojiFor(showEmojiFor === msg.id ? null : msg.id)}
                                className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                                title="React"
                              >
                                <Smile size={13} />
                              </button>
                              <AnimatePresence>
                                {showEmojiFor === msg.id && (
                                  <motion.div
                                    initial={{ opacity: 0, y: 4, scale: 0.96 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, y: 4, scale: 0.96 }}
                                    className={`absolute top-full mt-2 ${isOwn ? "right-0" : "left-0"} bg-card border border-border rounded-2xl p-3 shadow-2xl z-30 w-[19rem] max-w-[min(19rem,calc(100vw-2rem))]`}
                                    onMouseLeave={() => setShowEmojiFor(null)}
                                  >
                                    <div className="flex gap-1 mb-2.5 pb-2.5 border-b border-border overflow-x-auto scrollbar-none">
                                      {Object.keys(EMOJI_CATEGORIES).map(cat => (
                                        <button key={cat} onClick={() => setEmojiCat(cat)} title={cat}
                                          className={`text-xs px-2.5 py-1 rounded-full shrink-0 transition-colors whitespace-nowrap ${emojiCat === cat ? "bg-primary/20 text-primary" : "hover:bg-accent text-muted-foreground"}`}>
                                          {cat.split(" ")[0]}
                                        </button>
                                      ))}
                                    </div>
                                    <div className="grid grid-cols-8 gap-1 max-h-44 overflow-y-auto pr-0.5">
                                      {EMOJI_CATEGORIES[emojiCat]?.map(emoji => (
                                        <motion.button key={emoji} whileHover={{ scale: 1.25 }} whileTap={{ scale: 0.9 }} onClick={() => handleReact(msg.id, emoji)}
                                          className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-accent text-[1.05rem]">
                                          {emoji}
                                        </motion.button>
                                      ))}
                                    </div>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                            <button onClick={() => { navigator.clipboard.writeText(msg.content || ""); toast({ title: "Copied to clipboard" }); }} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors" title="Copy">
                              <Copy size={13} />
                            </button>
                            <button onClick={() => toggleStar(msg.id, msg)} className={`w-7 h-7 flex items-center justify-center rounded-lg hover:bg-accent transition-colors ${starredMsgs.has(msg.id) ? "text-yellow-400" : "text-muted-foreground hover:text-foreground"}`} title={starredMsgs.has(msg.id) ? "Unsave" : "Save message"}>
                              <Star size={13} />
                            </button>
                            <button onClick={() => setForwardingMsg(msg)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors" title="Forward">
                              <Hash size={13} />
                            </button>
                            <button onClick={() => handlePin(msg.id)} className={`w-7 h-7 flex items-center justify-center rounded-lg hover:bg-accent transition-colors ${pinnedMsg?.id === msg.id ? "text-primary" : "text-muted-foreground hover:text-foreground"}`} title={pinnedMsg?.id === msg.id ? "Unpin" : "Pin"}>
                              {pinnedMsg?.id === msg.id ? <PinOff size={13} /> : <Pin size={13} />}
                            </button>
                            {isOwn && (
                              <>
                                <div className="w-px h-5 bg-border mx-0.5" />
                                <button onClick={() => startEdit(msg)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors" title="Edit">
                                  <Edit2 size={13} />
                                </button>
                                <button onClick={() => handleDelete(msg)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-500/10 text-muted-foreground hover:text-red-400 transition-colors" title="Delete">
                                  <Trash2 size={13} />
                                </button>
                              </>
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} className="h-1" />
            </div>
          )}
        </div>

        {/* Context menu */}
        <AnimatePresence>
          {contextMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={closeContextMenu} onContextMenu={e => { e.preventDefault(); closeContextMenu(); }} />
              <motion.div
                initial={{ opacity: 0, scale: 0.88, y: -6 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.88, y: -6 }}
                transition={{ type: "spring", stiffness: 400, damping: 28 }}
                className="fixed z-50 w-60 bg-card border border-border/80 rounded-2xl shadow-2xl overflow-hidden"
                style={{
                  left: Math.min(contextMenu.x, window.innerWidth - 252),
                  top: Math.min(contextMenu.y, window.innerHeight - 340),
                }}
              >
                {/* Quick reactions row */}
                {!contextMenu.msg.isDeleted && (
                  <div className="flex items-center justify-around px-3 py-3 border-b border-border/50 bg-accent/30">
                    {["❤️","😂","😮","😢","👍","🔥","👎"].map(emoji => (
                      <motion.button
                        key={emoji}
                        whileHover={{ scale: 1.35 }}
                        whileTap={{ scale: 0.85 }}
                        onClick={() => { handleReact(contextMenu.msg.id, emoji); closeContextMenu(); }}
                        className={`text-xl w-8 h-8 flex items-center justify-center rounded-xl transition-colors ${(contextMenu.msg.reactions?.[emoji] as number[] | undefined)?.includes(myId) ? "bg-primary/20" : "hover:bg-accent"}`}
                      >
                        {emoji}
                      </motion.button>
                    ))}
                    <motion.button
                      whileHover={{ scale: 1.2 }}
                      whileTap={{ scale: 0.85 }}
                      onClick={() => { setShowEmojiFor(contextMenu.msg.id); closeContextMenu(); setHoveredMsgId(contextMenu.msg.id); }}
                      className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-accent text-muted-foreground"
                    >
                      <Smile size={15} />
                    </motion.button>
                  </div>
                )}
                {/* Actions */}
                <div className="py-1">
                  {!contextMenu.msg.isDeleted && (
                    <button onClick={() => { setReplyTo(contextMenu.msg); closeContextMenu(); setTimeout(() => inputRef.current?.focus(), 50); }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-accent/70 transition-colors text-sm text-left">
                      <Reply size={15} className="text-primary shrink-0" />Reply
                    </button>
                  )}
                  {!contextMenu.msg.isDeleted && (contextMenu.msg.content?.match(/^[^\[]/)) && (
                    <button onClick={() => { navigator.clipboard.writeText(contextMenu.msg.content || ""); toast({ title: "Copied ✓" }); closeContextMenu(); }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-accent/70 transition-colors text-sm text-left">
                      <Copy size={15} className="text-primary shrink-0" />Copy text
                    </button>
                  )}
                  <button onClick={() => { toggleStar(contextMenu.msg.id, contextMenu.msg); closeContextMenu(); }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-accent/70 transition-colors text-sm text-left">
                    <Star size={15} className={starredMsgs.has(contextMenu.msg.id) ? "text-yellow-400 fill-yellow-400" : "text-primary"} />
                    {starredMsgs.has(contextMenu.msg.id) ? "Unsave" : "Save message"}
                  </button>
                  <button onClick={() => { setForwardingMsg(contextMenu.msg); closeContextMenu(); }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-accent/70 transition-colors text-sm text-left">
                    <Hash size={15} className="text-primary shrink-0" />Forward
                  </button>
                  <button onClick={() => { handlePin(contextMenu.msg.id); closeContextMenu(); }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-accent/70 transition-colors text-sm text-left">
                    {pinnedMsg?.id === contextMenu.msg.id ? <PinOff size={15} className="text-primary shrink-0" /> : <Pin size={15} className="text-primary shrink-0" />}
                    {pinnedMsg?.id === contextMenu.msg.id ? "Unpin" : "Pin message"}
                  </button>
                  {!contextMenu.msg.isDeleted && contextMenu.msg.readBy.length > 1 && (
                    <button onClick={closeContextMenu}
                      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-accent/70 transition-colors text-sm text-left">
                      <CheckCheck size={15} className="text-blue-400 shrink-0" />
                      <span>Read by {contextMenu.msg.readBy.length - 1}</span>
                    </button>
                  )}
                  {contextMenu.msg.senderId === myId && !contextMenu.msg.isDeleted && (
                    <>
                      <div className="h-px bg-border/50 mx-3 my-1" />
                      <button onClick={() => { startEdit(contextMenu.msg); closeContextMenu(); }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-accent/70 transition-colors text-sm text-left">
                        <Edit2 size={15} className="text-primary shrink-0" />Edit
                      </button>
                      <button onClick={() => { handleDelete(contextMenu.msg); closeContextMenu(); }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-red-500/10 transition-colors text-sm text-left text-red-400">
                        <Trash2 size={15} className="shrink-0" />Delete
                      </button>
                    </>
                  )}
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Scroll to bottom */}
        <AnimatePresence>
          {!atBottom && !msgsLoading && (
            <motion.button
              initial={{ opacity: 0, scale: 0.8, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8, y: 10 }}
              onClick={() => scrollToBottom()}
              className="absolute bottom-20 right-4 w-10 h-10 bg-primary text-white rounded-full shadow-xl shadow-primary/30 flex items-center justify-center hover:bg-primary/90 transition-colors z-10"
            >
              {msgList.filter((m: Message) => !m.readBy.includes(myId) && m.senderId !== myId).length > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[9px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1 shadow">
                  {msgList.filter((m: Message) => !m.readBy.includes(myId) && m.senderId !== myId).length}
                </span>
              )}
              <ChevronDown size={18} />
            </motion.button>
          )}
        </AnimatePresence>

        {/* Typing indicator */}
        <AnimatePresence>
          {typingUsers.length > 0 && (
            <motion.div
              initial={{ height: 0, opacity: 0, y: 4 }}
              animate={{ height: "auto", opacity: 1, y: 0 }}
              exit={{ height: 0, opacity: 0, y: 4 }}
              className="overflow-hidden shrink-0"
            >
              <div className="px-4 py-1 flex items-center gap-2">
                {/* Animated bubble */}
                <div className="flex items-center gap-[3px] bg-card border border-border/70 rounded-2xl rounded-bl-sm px-3 py-1.5 shadow-sm">
                  {[0, 1, 2].map(i => (
                    <motion.span key={i}
                      className="w-1.5 h-1.5 rounded-full bg-primary block"
                      animate={{ y: [0, -5, 0], opacity: [0.4, 1, 0.4] }}
                      transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15, ease: "easeInOut" }}
                    />
                  ))}
                </div>
                <span className="text-[11px] text-muted-foreground">
                  {typingUsers.length === 1
                    ? <><span className="font-medium text-foreground/70">{typingUsers[0].name}</span> is typing</>
                    : <><span className="font-medium text-foreground/70">{typingUsers.map(u => u.name).join(", ")}</span> are typing</>}
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Reply / Edit preview bar */}
        <AnimatePresence>
          {(replyTo || editingMsg) && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden shrink-0"
            >
              <div className={`flex items-center gap-3 px-4 py-2.5 border-t border-primary/20 ${editingMsg ? "bg-yellow-500/5" : "bg-primary/5"}`}>
                <div className={`w-0.5 h-8 rounded-full ${editingMsg ? "bg-yellow-500" : "bg-primary"}`} />
                <div className="flex-1 min-w-0">
                  <p className={`text-[11px] font-semibold ${editingMsg ? "text-yellow-500" : "text-primary"}`}>
                    {editingMsg ? "✏️ Editing message" : `↩ Replying to ${replyTo?.sender?.displayName}`}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">{formatMsgPreview(editingMsg?.content) || formatMsgPreview(replyTo?.content)}</p>
                </div>
                <button onClick={() => { setReplyTo(null); setEditingMsg(null); clearInput(); }} className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-accent text-muted-foreground">
                  <X size={14} />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Input area */}
        <div className="px-3 pb-3 pt-2 border-t border-border bg-sidebar/50 backdrop-blur-sm shrink-0">
          {/* Image URL input */}
          <AnimatePresence>
            {showImageInput && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden mb-2">
                <div className="space-y-3 bg-accent/60 rounded-xl px-3 py-3 border border-border/50">
                  {pickedMediaPreview && (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[11px] text-muted-foreground truncate">{pickedMediaName || (pickedMediaPreview.type === "image" ? "Image selected" : "Video selected")}</p>
                        <button
                          type="button"
                          onClick={() => { setPickedMediaPreview(null); setPickedMediaName(""); }}
                          className="w-7 h-7 flex items-center justify-center rounded-full bg-background border border-border/60 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors shrink-0"
                          aria-label="Remove selected media"
                        >
                          <X size={13} />
                        </button>
                      </div>
                      <div className="rounded-lg overflow-hidden border border-border/60 bg-background">
                        {pickedMediaPreview.type === "image" ? (
                          <img src={pickedMediaPreview.url} alt="" className="w-full max-h-40 object-cover" />
                        ) : (
                          <video src={pickedMediaPreview.url} controls className="w-full max-h-40 object-cover" />
                        )}
                      </div>
                    </div>
                  )}
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <div className="flex items-center gap-2 min-w-0">
                      <ImageIcon size={13} className="text-muted-foreground shrink-0" />
                      <label className="text-xs px-2.5 py-1.5 rounded-lg bg-background border border-border/60 cursor-pointer hover:bg-accent transition-colors shrink-0">
                        Choose file
                        <input type="file" accept="image/*,video/*" className="hidden" onChange={e => handleMediaPick(e.target.files?.[0] || null)} />
                      </label>
                    </div>
                    <input autoFocus value={imageInputUrl} onChange={e => setImageInputUrl(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter") handleImageSend(); if (e.key === "Escape") { setShowImageInput(false); setImageInputUrl(""); setPickedMediaPreview(null); setPickedMediaName(""); } }}
                      placeholder="Or paste media URL" className="flex-1 min-w-0 bg-background/60 border border-border/50 rounded-lg px-3 py-2 text-xs outline-none placeholder:text-muted-foreground" />
                    <div className="flex items-center gap-2 self-end sm:self-auto">
                      <button onClick={handleImageSend} disabled={!imageInputUrl.trim() && !pickedMediaPreview} className="w-8 h-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 disabled:opacity-40 transition-colors"><Send size={12} /></button>
                      <button onClick={() => { setShowImageInput(false); setImageInputUrl(""); setPickedMediaPreview(null); setPickedMediaName(""); }} className="w-8 h-8 rounded-lg bg-background border border-border/60 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"><X size={13} /></button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Voice recorder */}
          <AnimatePresence>
            {voiceRecState !== "idle" && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} className="mb-2">
                <div className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 ${voiceRecState === "recording" ? "bg-red-500/10 border border-red-500/30" : "bg-accent border border-border/50"}`}>
                  {voiceRecState === "recording" ? (
                    <>
                      <motion.div className="w-2 h-2 rounded-full bg-red-500" animate={{ opacity: [1, 0, 1] }} transition={{ duration: 1, repeat: Infinity }} />
                      <div className="flex gap-0.5 flex-1 items-end h-5">
                        {[...Array(20)].map((_,i) => (
                          <motion.div key={i} className="w-0.5 rounded-full bg-red-400/70 flex-shrink-0"
                            animate={{ height: [3, 3 + Math.random() * 12, 3] }}
                            transition={{ duration: 0.4 + Math.random() * 0.4, repeat: Infinity, delay: i * 0.05 }} />
                        ))}
                      </div>
                      <span className="text-xs font-mono text-red-400 tabular-nums">{Math.floor(voiceDuration/60).toString().padStart(2,"0")}:{(voiceDuration%60).toString().padStart(2,"0")}</span>
                      <button onClick={stopVoiceRecording} className="w-7 h-7 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600 transition-colors" title="Stop">
                        <StopCircle size={14} />
                      </button>
                      <button onClick={cancelVoice} className="text-muted-foreground hover:text-foreground transition-colors" title="Cancel"><X size={14}/></button>
                    </>
                  ) : (
                    <>
                      {voiceUrl && <audio src={voiceUrl} controls className="h-7 flex-1 min-w-0" />}
                      <motion.button whileTap={{ scale: 0.9 }} onClick={sendVoiceMsg} disabled={isSendingVoiceRef.current} className="w-8 h-8 rounded-xl bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 disabled:opacity-50 transition-colors shrink-0" title="Send">
                        {isSendingVoiceRef.current
                          ? <motion.div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full" animate={{ rotate: 360 }} transition={{ duration: 0.7, repeat: Infinity, ease: "linear" }} />
                          : <Send size={14} />}
                      </motion.button>
                      <button onClick={cancelVoice} className="text-muted-foreground hover:text-foreground transition-colors shrink-0"><X size={14}/></button>
                    </>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Bot command suggestions */}
          <AnimatePresence>
            {cmdSuggestions.length > 0 && (
              <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }} className="mb-2">
                <div className="bg-card border border-border rounded-xl overflow-hidden shadow-xl">
                  {cmdSuggestions.map(c => (
                    <button key={c.cmd} onClick={() => { if (inputRef.current) { inputRef.current.textContent = c.cmd + " "; inputRef.current.focus(); setInput(c.cmd + " "); const r = document.createRange(); r.selectNodeContents(inputRef.current); r.collapse(false); window.getSelection()?.removeAllRanges(); window.getSelection()?.addRange(r); } setCmdSuggestions([]); }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-accent transition-colors text-left">
                      <span className="text-base">{c.icon}</span>
                      <div>
                        <p className="text-xs font-semibold text-primary">{c.cmd}</p>
                        <p className="text-[11px] text-muted-foreground">{c.desc}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Sticker picker */}
          <AnimatePresence>
            {showStickers && (
              <motion.div initial={{ opacity: 0, y: 6, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 6, scale: 0.98 }} transition={{ duration: 0.15 }} className="mb-2">
                <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-2xl">
                  {/* Header */}
                  <div className="flex items-center justify-between px-3.5 pt-3 pb-2">
                    <div className="flex items-center gap-2">
                      <Sparkles size={13} className="text-fuchsia-400" />
                      <p className="text-xs font-bold text-foreground">Stickers</p>
                    </div>
                    <button onClick={() => setShowStickers(false)} className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-accent text-muted-foreground hover:text-foreground transition-colors">
                      <X size={12}/>
                    </button>
                  </div>
                  {/* Pack tabs */}
                  <div className="flex gap-1.5 px-3.5 pb-2 overflow-x-auto scrollbar-none">
                    {Object.keys(STICKER_PACKS).map(pack => {
                      const icon = pack.split(" ")[0];
                      const isActive = stickerPack === pack;
                      return (
                        <button key={pack} onClick={() => setStickerPack(pack)} title={pack}
                          className={`w-9 h-9 flex items-center justify-center rounded-xl text-lg shrink-0 transition-all ${isActive ? "bg-fuchsia-500/20 ring-2 ring-fuchsia-500/40 scale-105" : "hover:bg-accent"}`}>
                          {icon}
                        </button>
                      );
                    })}
                  </div>
                  {/* Sticker grid */}
                  <div className="grid grid-cols-6 gap-1 px-3 pb-3">
                    {(STICKER_PACKS[stickerPack] || []).map(s => (
                      <motion.button key={s} whileHover={{ scale: 1.2 }} whileTap={{ scale: 0.9 }}
                        onClick={async () => { setShowStickers(false); await sendMessage.mutateAsync({ chatId, data: { content: s, replyToId: null } }); qc.invalidateQueries({ queryKey: getGetMessagesQueryKey(chatId, {}) }); }}
                        className="text-2xl flex items-center justify-center h-11 rounded-xl hover:bg-fuchsia-500/10 transition-colors">
                        {s}
                      </motion.button>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>


          {voiceRecState === "idle" && (
            <div className="flex items-end gap-2">
              <div className={`flex-1 flex items-end gap-1 rounded-2xl px-2 py-2 transition-all ${editingMsg ? "bg-yellow-500/10 border border-yellow-500/30" : "bg-accent border border-transparent focus-within:border-primary/30"}`}>
                <motion.button whileTap={{ scale: 0.9 }} onClick={() => setShowImageInput(!showImageInput)}
                  className={`w-8 h-8 flex items-center justify-center rounded-xl transition-all shrink-0 ${showImageInput ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground"}`} title="Share image">
                  <ImageIcon size={15} />
                </motion.button>
                <motion.button whileTap={{ scale: 0.9 }} onClick={() => setShowStickers(!showStickers)}
                  className={`w-8 h-8 flex items-center justify-center rounded-xl transition-all shrink-0 ${showStickers ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground"}`} title="Stickers">
                  <Sparkles size={15} />
                </motion.button>
                <motion.button whileTap={{ scale: 0.9 }} animate={{ rotate: [0, 10, -10, 0] }} transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }} onClick={startVoiceRecording}
                  className="w-8 h-8 flex items-center justify-center rounded-xl transition-all shrink-0 text-muted-foreground hover:text-foreground" title="Record voice message">
                  <Mic size={15} />
                </motion.button>
                <div
                  ref={inputRef}
                  contentEditable
                  suppressContentEditableWarning
                  role="textbox"
                  aria-multiline="true"
                  data-placeholder={editingMsg ? "Edit message..." : `Message ${chatName || "..."}… (/ for commands)`}
                  className={`flex-1 outline-none text-sm max-h-32 overflow-y-auto py-1.5 px-1.5 break-words min-h-[20px] leading-relaxed text-white
                    empty:before:content-[attr(data-placeholder)] empty:before:text-white/60 empty:before:pointer-events-none`}
                  onInput={e => {
                    const val = e.currentTarget.textContent || "";
                    setInput(val);
                    notifyTyping();
                    if (val.startsWith("/")) {
                      const q = val.toLowerCase();
                      setCmdSuggestions(BOT_COMMANDS.filter(c => c.cmd.startsWith(q) || q === "/"));
                    } else {
                      setCmdSuggestions([]);
                    }
                  }}
                  onKeyDown={e => {
                    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
                    if (e.key === "Escape") { setReplyTo(null); setEditingMsg(null); clearInput(); setCmdSuggestions([]); }
                  }}
                />
                {/* Send button — inside toolbar on the right */}
                <motion.button whileTap={{ scale: 0.9 }} onClick={handleSend}
                  disabled={(sendMessage.isPending || editMessage.isPending) && !!input.trim()}
                  className={`w-8 h-8 flex items-center justify-center rounded-xl shrink-0 transition-all ${input.trim() ? "bg-primary text-primary-foreground shadow-md shadow-primary/30 hover:bg-primary/90" : "text-muted-foreground hover:text-foreground"}`}
                  title="Send">
                  <Send size={15} />
                </motion.button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Rejoin call pill — appears for 15s after ending a call */}
      <AnimatePresence>
        {lastCall && !callState && (
          <motion.div
            key="rejoin-pill"
            initial={{ opacity: 0, y: 24, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 380, damping: 30 }}
            className="absolute bottom-24 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-green-600 text-white shadow-2xl shadow-green-600/40 cursor-pointer hover:bg-green-500 transition-colors select-none"
            onClick={() => {
              if (lastCallTimerRef.current) clearTimeout(lastCallTimerRef.current);
              setLastCall(null);
              startCall(lastCall.type);
            }}
          >
            <motion.div className="w-2 h-2 rounded-full bg-white/80" animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1.2, repeat: Infinity }} />
            <span className="text-sm font-semibold">{lastCall.type === "video" ? "📹" : "📞"} Rejoin call</span>
            <button
              className="ml-1 text-white/60 hover:text-white transition-colors"
              onClick={e => { e.stopPropagation(); if (lastCallTimerRef.current) clearTimeout(lastCallTimerRef.current); setLastCall(null); }}
            >
              <X size={14} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Minimized call bar — floating pill at top when call is active but minimized */}
      <AnimatePresence>
        {callState && callMinimized && (
          <motion.div
            key="mini-call"
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ type: "spring", stiffness: 400, damping: 32 }}
            className="absolute top-16 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-2 rounded-2xl bg-slate-900/95 backdrop-blur border border-primary/20 shadow-2xl cursor-pointer hover:bg-slate-800/95 transition-colors relative"
            onClick={() => setCallMinimized(false)}
          >
            <motion.div className="w-2 h-2 rounded-full bg-green-400" animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1.5, repeat: Infinity }} />
            <span className="text-xs font-semibold text-white">{callState.type === "video" ? "📹" : "📞"} {chatName}</span>
            <span className="text-xs text-green-400 font-mono">{formatCallDur(callState.duration)}</span>
            <button className="w-6 h-6 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center transition-colors" onClick={e => { e.stopPropagation(); endCall(); }}>
              <PhoneOff size={10} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Incoming Call Overlay */}
      <AnimatePresence>
        {incomingCall && !callState && (
          <motion.div
            key="incoming-call"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute inset-0 z-50 flex flex-col items-center justify-between bg-gradient-to-b from-slate-900 via-purple-950 to-slate-900 px-6 py-12"
          >
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              {[1, 2, 3].map(i => (
                <motion.div key={i} className="absolute rounded-full border border-green-400/20"
                  animate={{ scale: [1, 1.5 + i * 0.3, 1], opacity: [0.3, 0, 0.3] }}
                  transition={{ duration: 1.8, repeat: Infinity, delay: i * 0.4 }}
                  style={{ width: 110 + i * 60, height: 110 + i * 60 }}
                />
              ))}
            </div>
            <div className="text-center z-10 mt-2">
              <p className="text-xs text-green-400/80 font-semibold tracking-widest uppercase mb-2">
                {incomingCall.type === "video" ? "📹 Incoming video call" : "📞 Incoming call"}
              </p>
              <h2 className="text-3xl font-extrabold text-white">{incomingCall.fromName}</h2>
              <p className="text-white/40 text-sm mt-1">is calling you…</p>
            </div>
            <motion.div className="relative z-10" animate={{ scale: [1, 1.05, 1] }} transition={{ duration: 1.5, repeat: Infinity }}>
              <div className="w-32 h-32 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center text-5xl font-black text-white ring-4 ring-green-400/30 shadow-2xl shadow-green-500/30">
                {incomingCall.fromName.charAt(0).toUpperCase()}
              </div>
            </motion.div>
            <div className="z-10 flex items-center gap-12">
              <div className="flex flex-col items-center gap-2">
                <motion.button whileTap={{ scale: 0.9 }} onClick={declineIncomingCall}
                  className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center shadow-2xl shadow-red-500/40 transition-colors">
                  <PhoneOff size={26} />
                </motion.button>
                <span className="text-xs text-white/40">Decline</span>
              </div>
              <div className="flex flex-col items-center gap-2">
                <motion.button whileTap={{ scale: 0.9 }} onClick={acceptIncomingCall}
                  animate={{ scale: [1, 1.08, 1] }} transition={{ duration: 1, repeat: Infinity }}
                  className="w-16 h-16 rounded-full bg-green-500 hover:bg-green-400 text-white flex items-center justify-center shadow-2xl shadow-green-500/40 transition-colors">
                  <Phone size={26} />
                </motion.button>
                <span className="text-xs text-white/40">Accept</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Call Modal */}
      <AnimatePresence>
        {callState && (
          <motion.div
            key="call-modal"
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 z-50 flex flex-col items-center justify-between bg-gradient-to-b from-slate-900 via-indigo-950 to-slate-900 px-6 py-10"
          >
            {/* Minimize button */}
            <button
              onClick={() => setCallMinimized(true)}
              className="absolute top-4 right-4 z-20 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white/60 hover:text-white flex items-center justify-center transition-colors"
              title="Minimize"
            >
              <ChevronDown size={16} />
            </button>
            {/* Rings */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              {[1, 2, 3].map(i => (
                <motion.div key={i} className="absolute rounded-full border border-primary/20"
                  animate={{ scale: [1, 1.5 + i * 0.3, 1], opacity: [0.25, 0, 0.25] }}
                  transition={{ duration: callState.phase === "ringing" ? 1.6 : 2.5, repeat: Infinity, delay: i * 0.4 }}
                  style={{ width: 120 + i * 60, height: 120 + i * 60 }}
                />
              ))}
            </div>

            {/* Top info */}
            <div className="text-center z-10 mt-4">
              <p className="text-xs text-primary/60 font-medium mb-1">{callState.type === "video" ? "📹 Video call" : "📞 Voice call"}</p>
              <h2 className="text-3xl font-extrabold text-white">{chatName}</h2>
              <AnimatePresence mode="wait">
                {callState.phase === "ringing" ? (
                  <motion.p key="ringing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="text-primary/50 text-sm mt-1.5">
                    <motion.span animate={{ opacity: [1, 0.4, 1] }} transition={{ duration: 1.5, repeat: Infinity }}>
                      Calling…
                    </motion.span>
                  </motion.p>
                ) : (
                  <motion.p key="connected" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="text-green-400/80 text-sm mt-1.5 font-mono">
                    {formatCallDur(callState.duration)}
                  </motion.p>
                )}
              </AnimatePresence>
            </div>

            {/* Avatar / Video */}
            <div className="z-10 relative">
              {callState.phase === "connected" && callState.type === "video" && !callState.videoOff ? (
                <div className="w-48 h-64 rounded-3xl overflow-hidden bg-black border-2 border-primary/30 shadow-2xl">
                  <video ref={remoteVideoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
                  <video ref={localVideoRef} autoPlay muted playsInline className="w-24 h-32 object-cover absolute bottom-3 right-3 rounded-2xl border border-white/20 shadow-lg" />
                </div>
              ) : (
                <motion.div animate={{ scale: [1, 1.04, 1] }} transition={{ duration: callState.phase === "ringing" ? 1.2 : 2, repeat: Infinity }}>
                  <Avatar src={chatAvatar} name={chatName} size={120} />
                </motion.div>
              )}
            </div>

            {/* Controls */}
            <div className="z-10 flex flex-col items-center gap-5 w-full">
              {callState.phase === "ringing" ? (
                /* Ringing — only show cancel */
                <div className="flex flex-col items-center gap-2">
                  <motion.button whileTap={{ scale: 0.95 }} onClick={endCall}
                    className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center shadow-2xl shadow-red-500/40 transition-colors">
                    <PhoneOff size={26} />
                  </motion.button>
                  <span className="text-[11px] text-white/40">Cancel</span>
                </div>
              ) : (
                /* Connected — full controls */
                <>
                  <div className="flex justify-center gap-5">
                    {[
                      { icon: callState.muted ? MicOff : Mic, label: callState.muted ? "Unmute" : "Mute", active: callState.muted, color: "red", onClick: () => setCallState(p => p ? { ...p, muted: !p.muted } : p) },
                      { icon: callState.speaker ? Volume2 : VolumeX, label: "Speaker", active: !callState.speaker, color: "default", onClick: () => setCallState(p => p ? { ...p, speaker: !p.speaker } : p) },
                      ...(callState.type === "video" ? [{ icon: callState.videoOff ? VideoOff : Video, label: callState.videoOff ? "Camera off" : "Camera", active: callState.videoOff, color: "red", onClick: () => setCallState(p => p ? { ...p, videoOff: !p.videoOff } : p) }] : []),
                    ].map((btn, i) => (
                      <div key={i} className="flex flex-col items-center gap-1.5">
                        <motion.button whileTap={{ scale: 0.9 }} onClick={btn.onClick}
                          className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${btn.active && btn.color === "red" ? "bg-red-500 text-white" : "bg-white/10 text-white hover:bg-white/20"}`}>
                          <btn.icon size={22} />
                        </motion.button>
                        <span className="text-[10px] text-white/50">{btn.label}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex flex-col items-center gap-1.5">
                    <motion.button whileTap={{ scale: 0.95 }} onClick={endCall}
                      className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center shadow-2xl shadow-red-500/40 transition-colors">
                      <PhoneOff size={26} />
                    </motion.button>
                    <span className="text-[10px] text-white/40">End call</span>
                  </div>
                </>
              )}
            </div>
          </motion.div>
        )}

        {/* Forward Message Modal */}
        {forwardingMsg && (
          <motion.div key="forward-modal" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 z-40 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setForwardingMsg(null)}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-xs overflow-hidden"
              onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between p-4 border-b border-border">
                <div>
                  <h3 className="font-bold text-sm">Forward Message</h3>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-[200px]">{forwardingMsg.content?.startsWith("[voice:") ? "🎤 Voice message" : forwardingMsg.content?.slice(0, 50)}</p>
                </div>
                <button onClick={() => setForwardingMsg(null)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-accent text-muted-foreground"><X size={14}/></button>
              </div>
              <div className="max-h-64 overflow-y-auto p-2">
                {(chats || []).filter((c: any) => c.id !== chatId).map((c: any) => {
                  const name = c.type === "group" ? c.name || "Group" : c.members?.find((m: any) => m.id !== myId)?.displayName || "Chat";
                  const avatar = c.type === "direct" ? c.members?.find((m: any) => m.id !== myId)?.avatarUrl : null;
                  return (
                    <motion.button key={c.id} whileTap={{ scale: 0.97 }} onClick={() => handleForwardTo(c.id)}
                      className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-accent transition-colors text-left">
                      <Avatar src={avatar} name={name} size={36} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{name}</p>
                        <p className="text-xs text-muted-foreground">{c.type === "group" ? `${c.members?.length} members` : "Direct message"}</p>
                      </div>
                    </motion.button>
                  );
                })}
                {(chats || []).filter((c: any) => c.id !== chatId).length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-4">No other chats to forward to</p>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}

        {showMembersPanel && chat?.type === "group" && (
          <motion.div
            key="members-panel"
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 260, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="border-l border-border bg-sidebar overflow-hidden shrink-0 flex flex-col"
          >
            <div className="flex items-center justify-between p-4 border-b border-border">
              <div>
                <h3 className="font-bold text-sm">Members</h3>
                <p className="text-xs text-muted-foreground">{chat.members?.length} people</p>
              </div>
              <button onClick={() => setShowMembersPanel(false)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-accent text-muted-foreground"><X size={14} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
              {chat.members?.map((m: any) => (
                <div key={m.id} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-accent transition-colors">
                  <Avatar src={m.avatarUrl} name={m.displayName} size={36} online={m.isOnline} />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{m.displayName}{m.id === myId ? " (you)" : ""}</p>
                    <p className="text-[10px] text-muted-foreground">{m.isOnline ? "🟢 Online" : "Offline"}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Coin modal */}
      <AnimatePresence>
        {coinModal && (
          <motion.div key="coin-modal" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-end justify-center sm:items-center p-4"
            onClick={() => setCoinModal(null)}>
            <motion.div initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-xs overflow-hidden"
              onClick={e => e.stopPropagation()}>

              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <div className="flex items-center gap-2">
                  {coinModal.step === "enter_amount" && (
                    <button onClick={() => setCoinModal(m => m ? { ...m, step: "select_user", recipient: null, amount: "" } : null)}
                      className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-accent text-muted-foreground mr-0.5">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M15 18l-6-6 6-6"/></svg>
                    </button>
                  )}
                  <span className="text-base">⚡</span>
                  <div>
                    <h3 className="font-bold text-sm leading-none">Send Coins</h3>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {coinModal.step === "select_user" ? "Choose a recipient" : `To: ${coinModal.recipient?.displayName}`}
                    </p>
                  </div>
                </div>
                <button onClick={() => setCoinModal(null)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-accent text-muted-foreground">
                  <X size={14}/>
                </button>
              </div>

              {/* Step 1: select user */}
              {coinModal.step === "select_user" && (() => {
                const directContacts = (chats || [])
                  .filter((c: any) => c.type === "direct")
                  .map((c: any) => c.members?.find((m: any) => m.id !== myId))
                  .filter(Boolean)
                  .filter((u: any, idx: number, arr: any[]) => arr.findIndex((x: any) => x.id === u.id) === idx);
                const q = coinModal.search.toLowerCase().trim();
                const filtered = q
                  ? directContacts.filter((u: any) => u.displayName?.toLowerCase().includes(q))
                  : directContacts;
                return (
                  <>
                    <div className="px-3 pt-3 pb-2">
                      <input
                        autoFocus
                        type="text"
                        placeholder="Search contacts…"
                        value={coinModal.search}
                        onChange={e => setCoinModal(m => m ? { ...m, search: e.target.value } : null)}
                        className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-fuchsia-500/60 placeholder:text-muted-foreground"
                      />
                    </div>
                    <div className="max-h-56 overflow-y-auto p-2 space-y-0.5">
                      {filtered.length === 0 && (
                        <p className="text-xs text-muted-foreground text-center py-6">No contacts found</p>
                      )}
                      {filtered.map((u: any) => (
                        <motion.button key={u.id} whileTap={{ scale: 0.97 }}
                          onClick={() => setCoinModal(m => m ? { ...m, step: "enter_amount", recipient: u, amount: "" } : null)}
                          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-fuchsia-500/10 transition-colors text-left group">
                          <Avatar src={u.avatarUrl} name={u.displayName} size={36} online={u.isOnline} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{u.displayName}</p>
                            <p className="text-[10px] text-muted-foreground">{u.isOnline ? "🟢 Online" : "Offline"}</p>
                          </div>
                          <svg className="opacity-0 group-hover:opacity-100 transition-opacity text-fuchsia-400" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9 18l6-6-6-6"/></svg>
                        </motion.button>
                      ))}
                    </div>
                  </>
                );
              })()}

              {/* Step 2: enter amount */}
              {coinModal.step === "enter_amount" && coinModal.recipient && (
                <div className="p-4 space-y-4">
                  {/* Recipient card */}
                  <div className="flex items-center gap-3 bg-fuchsia-500/10 border border-fuchsia-500/20 rounded-xl px-3 py-2.5">
                    <Avatar src={coinModal.recipient.avatarUrl} name={coinModal.recipient.displayName} size={36} online={coinModal.recipient.isOnline} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{coinModal.recipient.displayName}</p>
                      <p className="text-[10px] text-muted-foreground">{coinModal.recipient.isOnline ? "🟢 Online" : "Offline"}</p>
                    </div>
                    <span className="text-lg">⚡</span>
                  </div>

                  {/* Amount input */}
                  <div>
                    <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">Amount</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-fuchsia-400 font-bold text-sm">⚡</span>
                      <input
                        autoFocus
                        disabled={coinModal.loading}
                        type="number"
                        min="1"
                        placeholder="0"
                        value={coinModal.amount}
                        onChange={e => setCoinModal(m => m ? { ...m, amount: e.target.value } : null)}
                        onKeyDown={async e => {
                          if (e.key === "Enter" && !coinModal.loading) {
                            e.preventDefault();
                            const amt = parseInt(coinModal.amount);
                            if (!amt || amt <= 0) return;
                            setCoinModal(m => m ? { ...m, loading: true } : null);
                            const token = await getToken();
                            try {
                              const wr = await fetch("/api/wallet/send", {
                                method: "POST",
                                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                                body: JSON.stringify({ toUserId: coinModal.recipient!.id, amount: amt, chatId }),
                              });
                              if (wr.ok) {
                                await sendMessage.mutateAsync({ chatId, data: { content: `⚡ Sent **${amt} Droidgram coins** to ${coinModal.recipient!.displayName}!`, replyToId: null } });
                                setWalletBal(prev => prev !== null ? prev - amt : null);
                                toast({ title: `⚡ ${amt} coins sent to ${coinModal.recipient!.displayName}!` });
                                setCoinModal(null);
                                qc.invalidateQueries({ queryKey: getGetMessagesQueryKey(chatId, {}) });
                              } else {
                                const err = await wr.json().catch(() => ({}));
                                toast({ title: err.error || "Failed to send coins", variant: "destructive" });
                                setCoinModal(m => m ? { ...m, loading: false } : null);
                              }
                            } catch (e) {
                              toast({ title: "Network error", variant: "destructive" });
                              setCoinModal(m => m ? { ...m, loading: false } : null);
                            }
                          }
                        }}
                        className="w-full bg-background border border-border rounded-xl pl-8 pr-4 py-2.5 text-base font-bold outline-none focus:ring-2 focus:ring-fuchsia-500/50 disabled:opacity-50 disabled:cursor-not-allowed [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                      />
                    </div>
                    {walletBal !== null && (
                      <p className="text-[11px] text-muted-foreground mt-1.5">Your balance: <span className="text-fuchsia-400 font-semibold">⚡ {walletBal}</span></p>
                    )}
                  </div>

                  {/* Quick amount chips */}
                  <div className="flex gap-2">
                    {[10, 25, 50, 100].map(n => (
                      <button key={n} onClick={() => setCoinModal(m => m ? { ...m, amount: String(n) } : null)}
                        className="flex-1 py-1.5 rounded-lg bg-fuchsia-500/10 hover:bg-fuchsia-500/20 border border-fuchsia-500/20 text-fuchsia-300 text-xs font-semibold transition-colors">
                        {n}
                      </button>
                    ))}
                  </div>

                  {/* Send button */}
                  <button
                    disabled={!coinModal.amount || parseInt(coinModal.amount) <= 0 || coinModal.loading}
                    onClick={async () => {
                      const amt = parseInt(coinModal.amount);
                      if (!amt || amt <= 0 || !coinModal.recipient) return;
                      setCoinModal(m => m ? { ...m, loading: true } : null);
                      const token = await getToken();
                      try {
                        const wr = await fetch("/api/wallet/send", {
                          method: "POST",
                          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                          body: JSON.stringify({ toUserId: coinModal.recipient.id, amount: amt, chatId }),
                        });
                        if (wr.ok) {
                          await sendMessage.mutateAsync({ chatId, data: { content: `⚡ Sent **${amt} Droidgram coins** to ${coinModal.recipient.displayName}!`, replyToId: null } });
                          setWalletBal(prev => prev !== null ? prev - amt : null);
                          toast({ title: `⚡ ${amt} coins sent to ${coinModal.recipient.displayName}!` });
                          setCoinModal(null);
                          qc.invalidateQueries({ queryKey: getGetMessagesQueryKey(chatId, {}) });
                        } else {
                          const err = await wr.json().catch(() => ({}));
                          toast({ title: err.error || "Failed to send coins", variant: "destructive" });
                          setCoinModal(m => m ? { ...m, loading: false } : null);
                        }
                      } catch (e) {
                        toast({ title: "Network error", variant: "destructive" });
                        setCoinModal(m => m ? { ...m, loading: false } : null);
                      }
                    }}
                    className="w-full bg-fuchsia-500 hover:bg-fuchsia-400 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold rounded-xl py-2.5 text-sm transition-colors flex items-center justify-center gap-2">
                    {coinModal.loading ? (
                      <><svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg> Sending…</>
                    ) : (
                      <>⚡ Send {coinModal.amount ? parseInt(coinModal.amount) || "" : ""} coins</>
                    )}
                  </button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Profile viewer modal */}
      <AnimatePresence>
        {profileViewer && (
          <motion.div key="profile-modal" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-end justify-center sm:items-center p-4"
            onClick={() => setProfileViewer(null)}>
            <motion.div initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-xs overflow-hidden"
              onClick={e => e.stopPropagation()}>
              <div className="relative">
                <div className={`h-24 bg-gradient-to-br from-primary/30 to-purple-900/40`} />
                <button onClick={() => setProfileViewer(null)} className="absolute top-3 right-3 w-7 h-7 flex items-center justify-center rounded-lg bg-black/30 text-white/80 hover:text-white">
                  <X size={14}/>
                </button>
                <div className="absolute -bottom-7 left-1/2 -translate-x-1/2">
                  <Avatar src={profileViewer.avatarUrl} name={profileViewer.displayName} size={56} online={profileViewer.isOnline} />
                </div>
              </div>
              <div className="pt-10 pb-5 px-5 text-center">
                <h3 className="font-bold text-base">{profileViewer.displayName}</h3>
                <p className="text-xs text-muted-foreground mt-0.5">{profileViewer.isOnline ? "🟢 Active now" : "Last seen recently"}</p>
                {profileViewer.bio && <p className="text-xs text-muted-foreground mt-3 leading-relaxed">{profileViewer.bio}</p>}
                {walletBal !== null && profileViewer.id !== myId && (
                  <button onClick={() => { setProfileViewer(null); if (inputRef.current) { inputRef.current.textContent = `/coin @${profileViewer.displayName} `; inputRef.current.focus(); setInput(`/coin @${profileViewer.displayName} `); } }}
                    className="mt-4 flex items-center gap-1.5 mx-auto px-4 py-2 rounded-xl bg-primary/10 text-primary text-xs font-semibold hover:bg-primary/20 transition-colors">
                    <Zap size={12} />
                    Send Droidgram coins
                  </button>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />
    </div>
  );
}
