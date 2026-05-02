import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { useUser, useClerk } from "@clerk/react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Send, Search, Plus, Settings, LogOut, MoreVertical, Reply,
  Edit2, Trash2, Smile, X, Check, CheckCheck, Users, MessageSquare,
  ChevronLeft, ArrowLeft
} from "lucide-react";
import {
  useGetMe, useGetChats, useGetMessages, useSendMessage,
  useEditMessage, useDeleteMessage, useReactToMessage, useMarkMessageRead,
  useCreateChat, getGetChatsQueryKey, getGetMessagesQueryKey,
  useSearchUsers, useGetChatStats, getGetChatStatsQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

const EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🔥", "👏", "✅"];

function Avatar({ src, name, size = 40, online }: { src?: string | null; name: string; size?: number; online?: boolean }) {
  const initials = name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
  const colors = ["#8B5CF6", "#6366F1", "#EC4899", "#14B8A6", "#F59E0B", "#10B981"];
  const color = colors[name.charCodeAt(0) % colors.length];
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      {src ? (
        <img src={src} alt={name} className="rounded-full object-cover w-full h-full" />
      ) : (
        <div className="rounded-full flex items-center justify-center text-white font-semibold w-full h-full text-sm" style={{ background: color, fontSize: size * 0.35 }}>
          {initials}
        </div>
      )}
      {online && (
        <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-sidebar" />
      )}
    </div>
  );
}

function formatTime(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 86400000) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (diff < 604800000) return d.toLocaleDateString([], { weekday: "short" });
  return d.toLocaleDateString([], { day: "2-digit", month: "2-digit" });
}

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

export default function ChatsPage({ activeChatId }: { activeChatId?: number }) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { signOut } = useClerk();
  const qc = useQueryClient();
  const { data: me } = useGetMe();
  const { data: chats } = useGetChats();
  const { data: stats } = useGetChatStats();

  const [searchQuery, setSearchQuery] = useState("");
  const [showNewChat, setShowNewChat] = useState(false);
  const [newChatSearch, setNewChatSearch] = useState("");
  const [groupMode, setGroupMode] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [selectedUsers, setSelectedUsers] = useState<any[]>([]);

  const { data: searchResults } = useSearchUsers(
    { q: newChatSearch },
    { query: { enabled: newChatSearch.length > 1 } }
  );

  const createChat = useCreateChat();

  const myId = (me as any)?.id;
  const filteredChats = ((chats as any) || []).filter((c: ChatWithDetails) => {
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
    const other = chat.members.find((m: any) => m.id !== myId);
    return other?.avatarUrl || null;
  }

  function getChatOnline(chat: ChatWithDetails) {
    if (chat.type === "group") return false;
    const other = chat.members.find((m: any) => m.id !== myId);
    return other?.isOnline || false;
  }

  async function startDirectChat(userId: number) {
    try {
      const chat = await createChat.mutateAsync({ data: { type: "direct", memberIds: [userId] } });
      qc.invalidateQueries({ queryKey: getGetChatsQueryKey() });
      setShowNewChat(false);
      setNewChatSearch("");
      setLocation(`/chats/${(chat as any).id}`);
    } catch {
      toast({ title: "Failed to create chat", variant: "destructive" });
    }
  }

  async function createGroupChat() {
    if (!groupName.trim() || selectedUsers.length === 0) return;
    try {
      const memberIds = selectedUsers.map((u: any) => u.id);
      const chat = await createChat.mutateAsync({ data: { type: "group", name: groupName, memberIds } });
      qc.invalidateQueries({ queryKey: getGetChatsQueryKey() });
      setShowNewChat(false);
      setGroupMode(false);
      setGroupName("");
      setSelectedUsers([]);
      setLocation(`/chats/${(chat as any).id}`);
    } catch {
      toast({ title: "Failed to create group", variant: "destructive" });
    }
  }

  const showSidebar = !activeChatId;
  const showChat = !!activeChatId;

  return (
    <div className="h-screen flex bg-background overflow-hidden">
      {/* Sidebar */}
      <div className={`${showChat ? "hidden md:flex" : "flex"} flex-col w-full md:w-80 lg:w-96 border-r border-border bg-sidebar shrink-0`}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Avatar src={(me as any)?.avatarUrl} name={(me as any)?.displayName || "Me"} size={32} online />
            <span className="font-semibold text-sm">{(me as any)?.displayName || "Pulse"}</span>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => setLocation("/search")} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-accent transition-colors" data-testid="button-search">
              <Search size={16} className="text-muted-foreground" />
            </button>
            <button onClick={() => setShowNewChat(true)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-accent transition-colors" data-testid="button-new-chat">
              <Plus size={16} className="text-muted-foreground" />
            </button>
            <button onClick={() => setLocation("/settings")} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-accent transition-colors" data-testid="button-settings">
              <Settings size={16} className="text-muted-foreground" />
            </button>
            <button onClick={() => signOut()} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-accent transition-colors" data-testid="button-signout">
              <LogOut size={16} className="text-muted-foreground" />
            </button>
          </div>
        </div>

        {/* Stats */}
        {stats && (
          <div className="flex gap-3 px-4 py-2 border-b border-border/50">
            {[
              { label: "Chats", value: (stats as any).totalChats },
              { label: "Unread", value: (stats as any).totalUnread },
              { label: "Active", value: (stats as any).activeChats },
            ].map((s, i) => (
              <div key={i} className="flex-1 text-center">
                <div className="text-base font-bold text-primary">{s.value}</div>
                <div className="text-[10px] text-muted-foreground">{s.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Search */}
        <div className="px-3 py-2">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search chats..."
              className="w-full bg-accent rounded-lg pl-8 pr-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:ring-1 ring-primary/50"
              data-testid="input-search-chats"
            />
          </div>
        </div>

        {/* Chat list */}
        <div className="flex-1 overflow-y-auto">
          {chats === undefined ? (
            <div className="flex items-center justify-center h-20">
              <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filteredChats.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 gap-2 text-muted-foreground">
              <MessageSquare size={32} className="opacity-30" />
              <p className="text-sm">No chats yet</p>
              <button onClick={() => setShowNewChat(true)} className="text-xs text-primary hover:underline">Start a conversation</button>
            </div>
          ) : (
            filteredChats.map((chat: ChatWithDetails) => (
              <button
                key={chat.id}
                onClick={() => setLocation(`/chats/${chat.id}`)}
                className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-accent transition-colors text-left ${activeChatId === chat.id ? "bg-accent border-r-2 border-primary" : ""}`}
                data-testid={`chat-item-${chat.id}`}
              >
                <Avatar src={getChatAvatar(chat)} name={getChatName(chat)} size={44} online={getChatOnline(chat)} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="font-medium text-sm truncate">{getChatName(chat)}</span>
                    {chat.lastMessage && (
                      <span className="text-xs text-muted-foreground shrink-0 ml-2">{formatTime(chat.lastMessage.createdAt)}</span>
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs text-muted-foreground truncate">
                      {chat.lastMessage ? (chat.lastMessage.isDeleted ? "Message deleted" : chat.lastMessage.content) : "No messages yet"}
                    </p>
                    {chat.unreadCount > 0 && (
                      <span className="bg-primary text-primary-foreground text-xs rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 shrink-0">
                        {chat.unreadCount}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Chat window */}
      {activeChatId ? (
        <ChatWindow chatId={activeChatId} myId={myId} me={me} onBack={() => setLocation("/chats")} />
      ) : (
        <div className="hidden md:flex flex-1 items-center justify-center bg-background">
          <div className="text-center">
            <div className="w-20 h-20 bg-accent rounded-full flex items-center justify-center mx-auto mb-4">
              <MessageSquare size={36} className="text-primary" />
            </div>
            <h3 className="font-semibold text-lg mb-2">Select a chat</h3>
            <p className="text-sm text-muted-foreground">Choose from your conversations or start a new one</p>
            <button onClick={() => setShowNewChat(true)} className="mt-4 bg-primary text-primary-foreground rounded-lg px-5 py-2 text-sm font-medium hover:bg-primary/90 transition-colors" data-testid="button-new-chat-empty">
              New conversation
            </button>
          </div>
        </div>
      )}

      {/* New Chat Modal */}
      <AnimatePresence>
        {showNewChat && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
              <div className="flex items-center justify-between p-4 border-b border-border">
                <div className="flex items-center gap-3">
                  <h3 className="font-semibold">{groupMode ? "New Group" : "New Chat"}</h3>
                  <button onClick={() => setGroupMode(!groupMode)} className="text-xs text-primary hover:underline">
                    {groupMode ? "Direct message" : "Create group"}
                  </button>
                </div>
                <button onClick={() => { setShowNewChat(false); setGroupMode(false); setSelectedUsers([]); }} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-accent">
                  <X size={16} />
                </button>
              </div>

              <div className="p-4 space-y-3">
                {groupMode && (
                  <input
                    value={groupName}
                    onChange={e => setGroupName(e.target.value)}
                    placeholder="Group name..."
                    className="w-full bg-accent rounded-lg px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:ring-1 ring-primary/50"
                    data-testid="input-group-name"
                  />
                )}
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    value={newChatSearch}
                    onChange={e => setNewChatSearch(e.target.value)}
                    placeholder="Search users..."
                    className="w-full bg-accent rounded-lg pl-8 pr-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:ring-1 ring-primary/50"
                    data-testid="input-search-users"
                    autoFocus
                  />
                </div>

                {groupMode && selectedUsers.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {selectedUsers.map((u: any) => (
                      <span key={u.id} className="flex items-center gap-1 bg-primary/20 text-primary text-xs rounded-full px-3 py-1">
                        {u.displayName}
                        <button onClick={() => setSelectedUsers(prev => prev.filter((p: any) => p.id !== u.id))}><X size={12} /></button>
                      </span>
                    ))}
                  </div>
                )}

                <div className="max-h-60 overflow-y-auto space-y-1">
                  {(searchResults as any)?.map?.((user: any) => (
                    <button
                      key={user.id}
                      onClick={() => groupMode ? setSelectedUsers(prev => prev.find((p: any) => p.id === user.id) ? prev : [...prev, user]) : startDirectChat(user.id)}
                      className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-accent transition-colors text-left"
                      data-testid={`user-result-${user.id}`}
                    >
                      <Avatar src={user.avatarUrl} name={user.displayName} size={36} online={user.isOnline} />
                      <div>
                        <p className="text-sm font-medium">{user.displayName}</p>
                        <p className="text-xs text-muted-foreground">@{user.username}</p>
                      </div>
                      {groupMode && selectedUsers.find((p: any) => p.id === user.id) && (
                        <Check size={16} className="ml-auto text-primary" />
                      )}
                    </button>
                  ))}
                  {newChatSearch.length > 1 && (searchResults as any)?.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">No users found</p>
                  )}
                </div>

                {groupMode && (
                  <button
                    onClick={createGroupChat}
                    disabled={!groupName.trim() || selectedUsers.length === 0 || createChat.isPending}
                    className="w-full bg-primary text-primary-foreground rounded-xl py-2.5 text-sm font-medium disabled:opacity-50 hover:bg-primary/90 transition-colors"
                    data-testid="button-create-group"
                  >
                    {createChat.isPending ? "Creating..." : `Create group (${selectedUsers.length} members)`}
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

function ChatWindow({ chatId, myId, me, onBack }: { chatId: number; myId: number; me: any; onBack: () => void }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLDivElement>(null);

  const { data: chats } = useGetChats();
  const { data: messages } = useGetMessages(
    chatId,
    {},
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
  const [, setLocation] = useLocation();

  const chat = (chats || []).find((c: any) => c.id === chatId);
  const chatName = chat
    ? chat.type === "group" ? chat.name || "Group" : chat.members?.find((m: any) => m.id !== myId)?.displayName || "Chat"
    : "Loading...";
  const chatAvatar = chat?.type === "direct" ? chat.members?.find((m: any) => m.id !== myId)?.avatarUrl : null;
  const chatOnline = chat?.type === "direct" ? chat.members?.find((m: any) => m.id !== myId)?.isOnline : false;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages?.length]);

  useEffect(() => {
    const msgs = messages || [];
    msgs.forEach((m: Message) => {
      if (!m.readBy.includes(myId)) {
        markRead.mutate({ chatId, messageId: m.id });
      }
    });
  }, [messages, myId, chatId]);

  async function handleSend() {
    const text = input.trim();
    if (!text) return;
    setInput("");
    const rId = replyTo?.id ?? null;
    setReplyTo(null);
    try {
      if (editingMsg) {
        await editMessage.mutateAsync({ chatId, messageId: editingMsg.id, data: { content: text } });
        setEditingMsg(null);
      } else {
        await sendMessage.mutateAsync({ chatId, data: { content: text, replyToId: rId } });
      }
      qc.invalidateQueries({ queryKey: getGetMessagesQueryKey(chatId, {}) });
      qc.invalidateQueries({ queryKey: getGetChatsQueryKey() });
    } catch {
      toast({ title: "Failed to send message", variant: "destructive" });
    }
  }

  async function handleDelete(msg: Message) {
    try {
      await deleteMessage.mutateAsync({ chatId, messageId: msg.id });
      qc.invalidateQueries({ queryKey: getGetMessagesQueryKey(chatId, {}) });
      qc.invalidateQueries({ queryKey: getGetChatsQueryKey() });
    } catch {
      toast({ title: "Failed to delete message", variant: "destructive" });
    }
  }

  async function handleReact(msgId: number, emoji: string) {
    setShowEmojiFor(null);
    try {
      await reactToMessage.mutateAsync({ chatId, messageId: msgId, data: { emoji } });
      qc.invalidateQueries({ queryKey: getGetMessagesQueryKey(chatId, {}) });
    } catch {}
  }

  function startEdit(msg: Message) {
    setEditingMsg(msg);
    setInput(msg.content || "");
    inputRef.current?.focus();
  }

  const msgList = messages || [];

  return (
    <div className="flex-1 flex flex-col min-w-0 h-screen">
      {/* Chat header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-sidebar shrink-0">
        <button onClick={onBack} className="md:hidden w-8 h-8 flex items-center justify-center rounded-lg hover:bg-accent" data-testid="button-back">
          <ArrowLeft size={18} />
        </button>
        <Avatar src={chatAvatar} name={chatName} size={36} online={chatOnline} />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm truncate">{chatName}</p>
          <p className="text-xs text-muted-foreground">
            {chatOnline ? "Online" : chat?.type === "group" ? `${chat?.members?.length || 0} members` : "Offline"}
          </p>
        </div>
        {chat?.type === "group" && (
          <button onClick={() => setShowMembersPanel(!showMembersPanel)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-accent" data-testid="button-members">
            <Users size={16} className="text-muted-foreground" />
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1" data-testid="messages-container">
        {messages === undefined ? (
          <div className="flex items-center justify-center h-20">
            <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : msgList.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
            <MessageSquare size={32} className="opacity-30 mb-2" />
            <p className="text-sm">No messages yet. Say hello!</p>
          </div>
        ) : (
          msgList.map((msg: Message, idx: number) => {
            const isOwn = msg.senderId === myId;
            const prevMsg = msgList[idx - 1];
            const showAvatar = !isOwn && (!prevMsg || prevMsg.senderId !== msg.senderId);
            return (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className={`flex ${isOwn ? "justify-end" : "justify-start"} group relative`}
                onMouseEnter={() => setHoveredMsgId(msg.id)}
                onMouseLeave={() => { setHoveredMsgId(null); setShowEmojiFor(null); }}
                data-testid={`message-${msg.id}`}
              >
                {!isOwn && showAvatar ? (
                  <div className="mr-2 mt-auto"><Avatar src={msg.sender?.avatarUrl} name={msg.sender?.displayName || "?"} size={28} /></div>
                ) : !isOwn ? <div className="w-9 mr-2" /> : null}

                <div className={`max-w-[70%] space-y-1`}>
                  {!isOwn && showAvatar && (
                    <p className="text-xs text-muted-foreground ml-1">{msg.sender?.displayName}</p>
                  )}
                  {msg.replyTo && !msg.replyTo.isDeleted && (
                    <div className={`rounded-lg px-3 py-1.5 border-l-2 border-primary/60 bg-accent/50 text-xs text-muted-foreground ml-1`}>
                      <span className="font-medium text-primary/80">{msg.replyTo.sender?.displayName}</span>
                      <p className="truncate">{msg.replyTo.content}</p>
                    </div>
                  )}
                  <div className={`relative rounded-2xl px-4 py-2.5 text-sm ${isOwn ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-card border border-border rounded-bl-sm"} ${msg.isDeleted ? "opacity-50 italic" : ""}`}>
                    <p className="leading-relaxed whitespace-pre-wrap break-words">{msg.isDeleted ? "Message deleted" : msg.content}</p>
                    <div className={`flex items-center gap-1 mt-1 text-xs ${isOwn ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                      <span>{formatTime(msg.createdAt)}</span>
                      {msg.isEdited && <span>(edited)</span>}
                      {isOwn && (
                        msg.readBy.length > 1
                          ? <CheckCheck size={12} className="text-blue-300" />
                          : <Check size={12} />
                      )}
                    </div>
                  </div>

                  {/* Reactions */}
                  {Object.keys(msg.reactions).length > 0 && (
                    <div className="flex flex-wrap gap-1 px-1">
                      {Object.entries(msg.reactions).map(([emoji, userIds]) => (
                        <button
                          key={emoji}
                          onClick={() => handleReact(msg.id, emoji)}
                          className={`flex items-center gap-1 text-xs rounded-full px-2 py-0.5 border transition-colors ${(userIds as number[]).includes(myId) ? "bg-primary/20 border-primary/40 text-primary" : "bg-accent border-border hover:border-primary/40"}`}
                          data-testid={`reaction-${msg.id}-${emoji}`}
                        >
                          {emoji} {(userIds as number[]).length}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Message actions */}
                {hoveredMsgId === msg.id && !msg.isDeleted && (
                  <div className={`absolute top-0 ${isOwn ? "right-full mr-2" : "left-full ml-2"} flex items-center gap-1 bg-card border border-border rounded-xl px-2 py-1 shadow-lg z-10`}>
                    <button onClick={() => setReplyTo(msg)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground" title="Reply" data-testid={`button-reply-${msg.id}`}>
                      <Reply size={14} />
                    </button>
                    <button onClick={() => setShowEmojiFor(showEmojiFor === msg.id ? null : msg.id)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground" title="React" data-testid={`button-react-${msg.id}`}>
                      <Smile size={14} />
                    </button>
                    {isOwn && (
                      <>
                        <button onClick={() => startEdit(msg)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground" title="Edit" data-testid={`button-edit-${msg.id}`}>
                          <Edit2 size={14} />
                        </button>
                        <button onClick={() => handleDelete(msg)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-accent text-red-400 hover:text-red-300" title="Delete" data-testid={`button-delete-${msg.id}`}>
                          <Trash2 size={14} />
                        </button>
                      </>
                    )}

                    {showEmojiFor === msg.id && (
                      <div className="absolute top-full mt-1 left-0 flex gap-1 bg-card border border-border rounded-xl p-2 shadow-xl z-20">
                        {EMOJIS.map(emoji => (
                          <button key={emoji} onClick={() => handleReact(msg.id, emoji)} className="text-lg hover:scale-125 transition-transform" data-testid={`emoji-${msg.id}-${emoji}`}>
                            {emoji}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Reply preview */}
      <AnimatePresence>
        {(replyTo || editingMsg) && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="border-t border-border bg-accent/30 px-4 py-2 flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-xs text-primary font-medium">{editingMsg ? "Editing message" : `Replying to ${replyTo?.sender?.displayName}`}</p>
              <p className="text-xs text-muted-foreground truncate">{editingMsg?.content || replyTo?.content}</p>
            </div>
            <button onClick={() => { setReplyTo(null); setEditingMsg(null); setInput(""); }} className="w-6 h-6 flex items-center justify-center rounded hover:bg-accent text-muted-foreground">
              <X size={14} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input */}
      <div className="px-4 py-3 border-t border-border bg-sidebar shrink-0">
        <div className="flex items-end gap-2 bg-accent rounded-2xl px-4 py-2">
          <div
            ref={inputRef}
            contentEditable
            suppressContentEditableWarning
            onInput={e => setInput(e.currentTarget.textContent || "")}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            data-placeholder="Write a message..."
            className="flex-1 outline-none text-sm max-h-36 overflow-y-auto py-1 whitespace-pre-wrap break-words min-h-[24px]"
            data-testid="input-message"
          />
          <button
            onClick={handleSend}
            disabled={sendMessage.isPending || editMessage.isPending}
            className="w-8 h-8 flex items-center justify-center bg-primary text-primary-foreground rounded-xl shrink-0 hover:bg-primary/90 transition-colors disabled:opacity-50"
            data-testid="button-send"
          >
            <Send size={15} />
          </button>
        </div>
      </div>

      {/* Group members panel */}
      <AnimatePresence>
        {showMembersPanel && chat?.type === "group" && (
          <motion.div initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} className="absolute right-0 top-0 h-full w-72 bg-sidebar border-l border-border shadow-xl z-30 overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h3 className="font-semibold">Members ({chat.members?.length})</h3>
              <button onClick={() => setShowMembersPanel(false)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-accent"><X size={16} /></button>
            </div>
            <div className="p-3 space-y-1">
              {chat.members?.map((m: any) => (
                <div key={m.id} className="flex items-center gap-3 p-2 rounded-xl hover:bg-accent">
                  <Avatar src={m.avatarUrl} name={m.displayName} size={36} online={m.isOnline} />
                  <div>
                    <p className="text-sm font-medium">{m.displayName}</p>
                    <p className="text-xs text-muted-foreground">@{m.username}</p>
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
