import { useState, useRef, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { useUser, useClerk } from "@clerk/react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Send, Search, Plus, LogOut, Reply,
  Edit2, Trash2, Smile, X, Check, CheckCheck, Users, MessageSquare,
  ArrowLeft, ChevronDown, Hash, Phone, Video,
  PhoneOff, VideoOff, MicOff, Mic, Volume2, VolumeX, PhoneCall,
  Copy, Forward, MoreHorizontal,
} from "lucide-react";
import {
  useGetMe, useGetChats, useGetMessages, useSendMessage,
  useEditMessage, useDeleteMessage, useReactToMessage, useMarkMessageRead,
  useCreateChat, getGetChatsQueryKey, getGetMessagesQueryKey,
  useSearchUsers, useGetChatStats, useGetOnlineUsers, useUpdateMe,
  getGetMeQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

const EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🔥", "👏", "✅", "🎉", "💯"];

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

// ─── ChatsSidebar ─────────────────────────────────────────────────────────────

export default function ChatsPage({ activeChatId }: { activeChatId?: number }) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { signOut } = useClerk();
  const qc = useQueryClient();
  const { data: me } = useGetMe();
  const { data: chats, isLoading: chatsLoading } = useGetChats();
  const { data: stats } = useGetChatStats();
  const { data: onlineUsers } = useGetOnlineUsers({ query: { refetchInterval: 30000 } });

  const [searchQuery, setSearchQuery] = useState("");
  const [showNewChat, setShowNewChat] = useState(false);
  const [newChatSearch, setNewChatSearch] = useState("");
  const [groupMode, setGroupMode] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [selectedUsers, setSelectedUsers] = useState<any[]>([]);
  const [showOnline, setShowOnline] = useState(false);

  const { data: searchResults } = useSearchUsers(
    { q: newChatSearch },
    { query: { enabled: newChatSearch.length > 1 } }
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
    document.title = totalUnread > 0 ? `(${totalUnread}) Pulse` : "Pulse";
    return () => { document.title = "Pulse"; };
  }, [totalUnread]);

  return (
    <div className="h-screen flex bg-background overflow-hidden">
      <ClerkProfileSync meId={myId} />

      {/* Sidebar */}
      <div className={`${activeChatId ? "hidden md:flex" : "flex"} flex-col w-full md:w-80 lg:w-[340px] border-r border-border bg-sidebar shrink-0 pb-16 md:pb-0`}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <button onClick={() => setLocation("/settings")} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <Avatar src={(me as any)?.avatarUrl} name={(me as any)?.displayName || "Me"} size={34} online />
            <div className="text-left">
              <p className="font-semibold text-sm leading-tight">{(me as any)?.displayName || "Me"}</p>
              <p className="text-[10px] text-green-500 font-medium">Online</p>
            </div>
          </button>
          <div className="flex items-center gap-0.5">
            <button onClick={() => setLocation("/search")} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-accent transition-colors" title="Search users">
              <Search size={15} className="text-muted-foreground" />
            </button>
            <button onClick={() => setShowNewChat(true)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-accent transition-colors" title="New chat">
              <Plus size={15} className="text-muted-foreground" />
            </button>
            <button onClick={() => signOut()} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-accent transition-colors" title="Sign out">
              <LogOut size={15} className="text-muted-foreground" />
            </button>
          </div>
        </div>

        {/* Stats bar */}
        {stats && (
          <div className="grid grid-cols-3 gap-px bg-border mx-4 my-2 rounded-xl overflow-hidden text-center">
            {[
              { label: "Chats", value: (stats as any).totalChats ?? 0 },
              { label: "Unread", value: totalUnread },
              { label: "Online", value: (onlineUsers || []).length },
            ].map((s, i) => (
              <div key={i} className="bg-accent/40 px-2 py-2">
                <div className={`text-sm font-bold ${s.label === "Unread" && s.value > 0 ? "text-primary" : "text-foreground"}`}>{s.value}</div>
                <div className="text-[9px] text-muted-foreground uppercase tracking-wide">{s.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Search */}
        <div className="px-3 pb-2">
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search chats..."
              className="w-full bg-accent/50 rounded-xl pl-8 pr-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:ring-1 ring-primary/50 transition-all"
            />
          </div>
        </div>

        {/* Online users strip */}
        {(onlineUsers || []).length > 0 && (
          <div className="px-3 pb-2">
            <button onClick={() => setShowOnline(!showOnline)} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-1.5 w-full">
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
                        <span className="text-[9px] text-muted-foreground truncate w-10 text-center">{u.displayName.split(" ")[0]}</span>
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
            <div className="flex flex-col items-center justify-center h-52 gap-3 text-muted-foreground px-6 text-center">
              <div className="w-14 h-14 bg-accent rounded-2xl flex items-center justify-center">
                <MessageSquare size={28} className="text-primary/60" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">
                  {searchQuery ? "No chats found" : "No conversations yet"}
                </p>
                <p className="text-xs mt-1">{searchQuery ? "Try a different search" : "Start a new chat to get going"}</p>
              </div>
              {!searchQuery && (
                <button onClick={() => setShowNewChat(true)} className="text-xs bg-primary text-primary-foreground rounded-lg px-4 py-1.5 hover:bg-primary/90 transition-colors font-medium">
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
                    className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-accent/60 transition-all text-left relative ${isActive ? "bg-primary/10 border-r-2 border-primary" : ""}`}
                  >
                    <Avatar src={getChatAvatar(chat)} name={chatName} size={46} online={getChatOnline(chat)} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className={`text-sm truncate ${isActive ? "font-semibold text-primary" : "font-medium"}`}>{chatName}</span>
                        {lastMsg && (
                          <span className="text-[10px] text-muted-foreground shrink-0 ml-2">{formatTime(lastMsg.createdAt)}</span>
                        )}
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs text-muted-foreground truncate">
                          {lastMsg
                            ? (lastMsg.isDeleted
                              ? "🚫 Message deleted"
                              : (chat.type === "group" && lastMsg.sender?.displayName ? `${lastMsg.sender.displayName.split(" ")[0]}: ${lastMsg.content}` : lastMsg.content))
                            : "Tap to start chatting"}
                        </p>
                        {chat.unreadCount > 0 && (
                          <span className="bg-primary text-primary-foreground text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 shrink-0">
                            {chat.unreadCount > 99 ? "99+" : chat.unreadCount}
                          </span>
                        )}
                      </div>
                    </div>
                    {chat.type === "group" && (
                      <Hash size={10} className="absolute top-2 right-2 text-muted-foreground/40" />
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
        <div className="hidden md:flex flex-1 flex-col items-center justify-center bg-background gap-4 relative overflow-hidden">
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
          </div>
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 20 }}
            className="w-20 h-20 bg-gradient-to-br from-primary/20 to-indigo-500/20 rounded-3xl flex items-center justify-center border border-primary/20"
          >
            <MessageSquare size={36} className="text-primary" />
          </motion.div>
          <motion.div initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.15 }} className="text-center">
            <h3 className="font-bold text-xl mb-1">Your messages</h3>
            <p className="text-sm text-muted-foreground">Select a chat or start a new conversation</p>
          </motion.div>
          <motion.button
            initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.25 }}
            onClick={() => setShowNewChat(true)}
            className="bg-primary text-primary-foreground rounded-xl px-6 py-2.5 text-sm font-semibold hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20"
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
              className="bg-card border border-border rounded-t-3xl sm:rounded-2xl w-full sm:max-w-md shadow-2xl overflow-hidden"
            >
              <div className="w-10 h-1 bg-border rounded-full mx-auto mt-3 mb-1 sm:hidden" />
              <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                <div>
                  <h3 className="font-bold">{groupMode ? "New Group" : "New Chat"}</h3>
                  <button onClick={() => setGroupMode(!groupMode)} className="text-xs text-primary">
                    {groupMode ? "→ Direct message" : "→ Create group instead"}
                  </button>
                </div>
                <button onClick={() => { setShowNewChat(false); setGroupMode(false); setSelectedUsers([]); }} className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-accent text-muted-foreground">
                  <X size={16} />
                </button>
              </div>

              <div className="p-4 space-y-3 max-h-[70vh] overflow-y-auto">
                {groupMode && (
                  <input
                    value={groupName} onChange={e => setGroupName(e.target.value)}
                    placeholder="Group name..."
                    className="w-full bg-accent rounded-xl px-4 py-2.5 text-sm outline-none placeholder:text-muted-foreground focus:ring-1 ring-primary/50"
                    autoFocus
                  />
                )}
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    value={newChatSearch} onChange={e => setNewChatSearch(e.target.value)}
                    placeholder="Search people..."
                    className="w-full bg-accent rounded-xl pl-9 pr-3 py-2.5 text-sm outline-none placeholder:text-muted-foreground focus:ring-1 ring-primary/50"
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
                    <p className="text-sm text-muted-foreground text-center py-6">No users found for "{newChatSearch}"</p>
                  )}
                  {(searchResults || []).map((user: any) => (
                    <button
                      key={user.id}
                      onClick={() => groupMode ? setSelectedUsers(p => p.find((x: any) => x.id === user.id) ? p : [...p, user]) : startDirectChat(user.id)}
                      className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-accent transition-colors text-left"
                    >
                      <Avatar src={user.avatarUrl} name={user.displayName} size={40} online={user.isOnline} />
                      <div className="flex-1">
                        <p className="text-sm font-semibold">{user.displayName}</p>
                        <p className="text-xs text-muted-foreground">@{user.username} {user.isOnline ? "· 🟢 Online" : ""}</p>
                      </div>
                      {groupMode && selectedUsers.find((x: any) => x.id === user.id) && (
                        <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center"><Check size={12} className="text-white" /></div>
                      )}
                    </button>
                  ))}
                  {newChatSearch.length <= 1 && (
                    <p className="text-xs text-muted-foreground text-center py-4">Type a name or username to search</p>
                  )}
                </div>

                {groupMode && (
                  <button
                    onClick={createGroupChat}
                    disabled={!groupName.trim() || selectedUsers.length === 0 || createChat.isPending}
                    className="w-full bg-primary text-primary-foreground rounded-xl py-3 text-sm font-bold disabled:opacity-40 hover:bg-primary/90 transition-colors"
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
    { query: { refetchInterval: 3000, queryKey: getGetMessagesQueryKey(chatId, {}) } }
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
  const [, setLocation] = useLocation();

  // ── Call state ──────────────────────────────────────────────────────────────
  const [callState, setCallState] = useState<{
    active: boolean; type: "audio" | "video";
    muted: boolean; videoOff: boolean; speaker: boolean; duration: number;
  } | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const callTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const chat = (chats || []).find((c: any) => c.id === chatId);
  const chatName = chat ? (chat.type === "group" ? chat.name || "Group" : chat.members?.find((m: any) => m.id !== myId)?.displayName || "Chat") : "";
  const chatAvatar = chat?.type === "direct" ? chat.members?.find((m: any) => m.id !== myId)?.avatarUrl : null;
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
        // Play sound for new message from others
        playMessageSound();
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

  const clearInput = useCallback(() => {
    setInput("");
    if (inputRef.current) {
      inputRef.current.textContent = "";
    }
  }, []);

  async function handleSend() {
    const text = input.trim();
    if (!text) return;
    const rId = replyTo?.id ?? null;
    const wasEditing = editingMsg;
    clearInput();
    setReplyTo(null);
    setEditingMsg(null);
    try {
      if (wasEditing) {
        await editMessage.mutateAsync({ chatId, messageId: wasEditing.id, data: { content: text } });
      } else {
        await sendMessage.mutateAsync({ chatId, data: { content: text, replyToId: rId } });
      }
      qc.invalidateQueries({ queryKey: getGetMessagesQueryKey(chatId, {}) });
      qc.invalidateQueries({ queryKey: getGetChatsQueryKey() });
    } catch {
      toast({ title: wasEditing ? "Failed to edit message" : "Failed to send", variant: "destructive" });
    }
  }

  async function handleDelete(msg: Message) {
    try {
      await deleteMessage.mutateAsync({ chatId, messageId: msg.id });
      qc.invalidateQueries({ queryKey: getGetMessagesQueryKey(chatId, {}) });
      qc.invalidateQueries({ queryKey: getGetChatsQueryKey() });
    } catch { toast({ title: "Failed to delete", variant: "destructive" }); }
  }

  async function handleReact(msgId: number, emoji: string) {
    setShowEmojiFor(null);
    try {
      await reactToMessage.mutateAsync({ chatId, messageId: msgId, data: { emoji } });
      qc.invalidateQueries({ queryKey: getGetMessagesQueryKey(chatId, {}) });
    } catch {}
  }

  // ── Call handlers ────────────────────────────────────────────────────────────
  async function startCall(type: "audio" | "video") {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: type === "video" });
      localStreamRef.current = stream;
      if (localVideoRef.current) { localVideoRef.current.srcObject = stream; }
      setCallState({ active: true, type, muted: false, videoOff: false, speaker: true, duration: 0 });
      callTimerRef.current = setInterval(() => setCallState(prev => prev ? { ...prev, duration: prev.duration + 1 } : prev), 1000);
    } catch {
      toast({ title: "Could not access camera/microphone", variant: "destructive" });
    }
  }

  function endCall() {
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    localStreamRef.current = null;
    if (callTimerRef.current) { clearInterval(callTimerRef.current); callTimerRef.current = null; }
    setCallState(null);
  }

  function formatCallDur(s: number) {
    const m = Math.floor(s / 60).toString().padStart(2, "0");
    return `${m}:${(s % 60).toString().padStart(2, "0")}`;
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
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-sidebar/80 backdrop-blur-md shrink-0 z-10">
          <button onClick={onBack} className="md:hidden w-8 h-8 flex items-center justify-center rounded-xl hover:bg-accent shrink-0">
            <ArrowLeft size={18} />
          </button>
          {chat ? (
            <button onClick={() => chat.type === "group" && setShowMembersPanel(!showMembersPanel)} className="flex items-center gap-3 flex-1 min-w-0 text-left hover:opacity-80 transition-opacity">
              <Avatar src={chatAvatar} name={chatName} size={38} online={chatOnline !== undefined ? chatOnline : undefined} />
              <div className="min-w-0">
                <p className="font-bold text-sm truncate">{chatName}</p>
                <p className="text-[11px] text-muted-foreground truncate">
                  {chatOnline ? "🟢 Active now"
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

        {/* Messages */}
        <div
          ref={containerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto px-3 sm:px-4 py-4"
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

                return (
                  <div key={msg.id}>
                    {/* Date separator */}
                    {showDateSep && (
                      <div className="flex items-center gap-3 my-4">
                        <div className="flex-1 h-px bg-border" />
                        <span className="text-[10px] text-muted-foreground font-medium bg-background px-3 py-1 rounded-full border border-border">
                          {formatDate(msg.createdAt)}
                        </span>
                        <div className="flex-1 h-px bg-border" />
                      </div>
                    )}

                    <motion.div
                      initial={{ opacity: 0, y: 6, scale: 0.97 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ duration: 0.18 }}
                      className={`flex ${isOwn ? "justify-end" : "justify-start"} group relative ${isGrouped ? "mt-0.5" : "mt-3"}`}
                      onMouseEnter={() => setHoveredMsgId(msg.id)}
                      onMouseLeave={() => { setHoveredMsgId(null); }}
                    >
                      {/* Avatar spacer/avatar */}
                      {!isOwn && (
                        <div className="w-8 mr-2 mt-auto shrink-0">
                          {showAvatar ? (
                            <Avatar src={msg.sender?.avatarUrl} name={msg.sender?.displayName || "?"} size={28} />
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
                              <p className="text-[11px] text-muted-foreground truncate">{msg.replyTo.content}</p>
                            </div>
                          </div>
                        )}

                        {/* Message bubble */}
                        <div className={`relative rounded-2xl px-3.5 py-2.5 text-sm break-words
                          ${isOwn
                            ? "bg-primary text-primary-foreground rounded-br-md"
                            : "bg-card border border-border/60 text-foreground rounded-bl-md"
                          }
                          ${msg.isDeleted ? "opacity-50" : ""}
                        `}>
                          {msg.isDeleted ? (
                            <span className="italic text-xs opacity-70">Message was deleted</span>
                          ) : (
                            <p className="leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                          )}

                          {/* Timestamp + status */}
                          <div className={`flex items-center gap-1 mt-1 text-[10px] ${isOwn ? "text-primary-foreground/60 justify-end" : "text-muted-foreground"}`}>
                            <span>{new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                            {msg.isEdited && !msg.isDeleted && <span>· edited</span>}
                            {isOwn && !msg.isDeleted && (
                              msg.readBy.length > 1
                                ? <CheckCheck size={11} className="text-blue-300" />
                                : <Check size={11} className="opacity-70" />
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
                                    initial={{ opacity: 0, y: 4, scale: 0.9 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, y: 4, scale: 0.9 }}
                                    className={`absolute top-full mt-1 ${isOwn ? "right-0" : "left-0"} flex gap-0.5 bg-card border border-border rounded-2xl p-2 shadow-2xl z-30`}
                                    onMouseLeave={() => setShowEmojiFor(null)}
                                  >
                                    {EMOJIS.map(emoji => (
                                      <motion.button key={emoji} whileHover={{ scale: 1.3 }} whileTap={{ scale: 0.9 }} onClick={() => handleReact(msg.id, emoji)} className="text-base px-0.5">
                                        {emoji}
                                      </motion.button>
                                    ))}
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                            {isOwn && (
                              <>
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

        {/* Scroll to bottom */}
        <AnimatePresence>
          {!atBottom && !msgsLoading && (
            <motion.button
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              onClick={() => scrollToBottom()}
              className="absolute bottom-20 right-4 w-10 h-10 bg-primary text-primary-foreground rounded-full shadow-lg flex items-center justify-center hover:bg-primary/90 transition-colors z-10"
            >
              <ChevronDown size={18} />
            </motion.button>
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
                  <p className="text-xs text-muted-foreground truncate">{editingMsg?.content || replyTo?.content}</p>
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
          <div className="flex items-end gap-2">
            <div className={`flex-1 flex items-end gap-2 rounded-2xl px-3.5 py-2.5 transition-all ${editingMsg ? "bg-yellow-500/10 border border-yellow-500/30" : "bg-accent border border-transparent focus-within:border-primary/30"}`}>
              <div
                ref={inputRef}
                contentEditable
                suppressContentEditableWarning
                role="textbox"
                aria-multiline="true"
                data-placeholder={editingMsg ? "Edit message..." : `Message ${chatName || "..."}…`}
                className={`flex-1 outline-none text-sm max-h-32 overflow-y-auto py-0.5 break-words min-h-[20px] leading-relaxed
                  empty:before:content-[attr(data-placeholder)] empty:before:text-muted-foreground empty:before:pointer-events-none`}
                onInput={e => setInput(e.currentTarget.textContent || "")}
                onKeyDown={e => {
                  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
                  if (e.key === "Escape") { setReplyTo(null); setEditingMsg(null); clearInput(); }
                }}
              />
            </div>
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={handleSend}
              disabled={!input.trim() || sendMessage.isPending || editMessage.isPending}
              className={`w-10 h-10 flex items-center justify-center rounded-xl shrink-0 transition-all ${input.trim() ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20 hover:bg-primary/90" : "bg-accent text-muted-foreground"}`}
            >
              <Send size={16} />
            </motion.button>
          </div>
        </div>
      </div>

      {/* Call Modal */}
      <AnimatePresence>
        {callState && (
          <motion.div
            key="call-modal"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 z-50 flex flex-col items-center justify-between bg-gradient-to-b from-slate-900 via-indigo-950 to-slate-900 px-6 py-10"
          >
            {/* Rings */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              {[1, 2, 3].map(i => (
                <motion.div key={i} className="absolute rounded-full border border-primary/20"
                  animate={{ scale: [1, 1.5 + i * 0.3, 1], opacity: [0.25, 0, 0.25] }}
                  transition={{ duration: 2.5, repeat: Infinity, delay: i * 0.5 }}
                  style={{ width: 120 + i * 60, height: 120 + i * 60 }}
                />
              ))}
            </div>
            {/* Top info */}
            <div className="text-center z-10 mt-4">
              <p className="text-xs text-primary/60 font-medium mb-1">{callState.type === "video" ? "📹 Video call" : "📞 Voice call"}</p>
              <h2 className="text-3xl font-extrabold text-white">{chatName}</h2>
              <p className="text-primary/50 text-sm mt-1.5 font-mono">{formatCallDur(callState.duration)}</p>
            </div>
            {/* Avatar / Video */}
            <div className="z-10 relative">
              {callState.type === "video" && !callState.videoOff ? (
                <div className="w-48 h-64 rounded-3xl overflow-hidden bg-black border-2 border-primary/30 shadow-2xl">
                  <video ref={localVideoRef} autoPlay muted playsInline className="w-full h-full object-cover mirror" />
                </div>
              ) : (
                <motion.div animate={{ scale: [1, 1.04, 1] }} transition={{ duration: 2, repeat: Infinity }}>
                  <Avatar src={chatAvatar} name={chatName} size={120} />
                </motion.div>
              )}
            </div>
            {/* Controls */}
            <div className="z-10 flex flex-col items-center gap-5 w-full">
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
            </div>
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
    </div>
  );
}
