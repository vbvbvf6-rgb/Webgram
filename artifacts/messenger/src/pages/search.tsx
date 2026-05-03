import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Search, MessageSquare, UserPlus, Users } from "lucide-react";
import { useSearchUsers, useGetMe, useGetOnlineUsers, useCreateChat, getGetChatsQueryKey, getGetOnlineUsersQueryKey, getSearchUsersQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";

function Avatar({ src, name, size = 44, online }: { src?: string | null; name: string; size?: number; online?: boolean }) {
  const hue = (name.charCodeAt(0) * 37 + (name.charCodeAt(1) || 0) * 17) % 360;
  const initials = name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      {src ? (
        <img src={src} alt={name} className="rounded-full object-cover w-full h-full" />
      ) : (
        <div className="rounded-full flex items-center justify-center text-white font-semibold w-full h-full" style={{ background: `hsl(${hue}, 65%, 50%)`, fontSize: size * 0.36 }}>
          {initials || "?"}
        </div>
      )}
      {online !== undefined && (
        <span className={`absolute bottom-0 right-0 rounded-full border-2 border-background ${online ? "w-3 h-3 bg-green-500" : "w-2.5 h-2.5 bg-muted-foreground/40"}`} />
      )}
    </div>
  );
}

export default function SearchPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<"search" | "online">("search");
  const inputRef = useRef<HTMLInputElement>(null);
  const { data: me } = useGetMe();
  const myId = (me as any)?.id;

  const { data: results, isLoading: searching } = useSearchUsers(
    { q: query },
    { query: { queryKey: getSearchUsersQueryKey({ q: query }), enabled: query.length > 1 } }
  );

  const { data: onlineUsers } = useGetOnlineUsers({ query: { queryKey: getGetOnlineUsersQueryKey(), refetchInterval: 20000 } });

  const createChat = useCreateChat();

  useEffect(() => { inputRef.current?.focus(); }, []);

  async function startChat(userId: number) {
    try {
      const chat = await createChat.mutateAsync({ data: { type: "direct", memberIds: [userId] } });
      qc.invalidateQueries({ queryKey: getGetChatsQueryKey() });
      setLocation(`/chats/${(chat as any).id}`);
    } catch {
      toast({ title: "Failed to start chat", variant: "destructive" });
    }
  }

  const displayUsers = tab === "online"
    ? (onlineUsers || []).filter((u: any) => u.id !== myId)
    : (results || []).filter((u: any) => u.id !== myId);

  return (
    <div className="min-h-screen bg-background flex flex-col pb-16 md:pb-0">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-sidebar/90 backdrop-blur-xl border-b border-border">
        <div className="flex items-center gap-3 px-4 py-3">
          <button onClick={() => setLocation("/chats")} className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-accent transition-colors shrink-0">
            <ArrowLeft size={18} />
          </button>
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              ref={inputRef}
              value={query}
              onChange={e => { setQuery(e.target.value); setTab("search"); }}
              placeholder="Search people by name or @username..."
              className="w-full bg-accent rounded-xl pl-10 pr-4 py-2.5 text-sm outline-none placeholder:text-muted-foreground focus:ring-1 ring-primary/50 transition-all"
            />
            {query && (
              <button onClick={() => setQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <span className="text-xs">✕</span>
              </button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex px-4 pb-1 gap-2">
          {[
            { id: "search", label: "Search results", icon: Search },
            { id: "online", label: `Online now ${(onlineUsers || []).filter((u: any) => u.id !== myId).length > 0 ? `(${(onlineUsers || []).filter((u: any) => u.id !== myId).length})` : ""}`, icon: Users },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id as any)}
              className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-all ${tab === t.id ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground"}`}
            >
              <t.icon size={11} />
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 max-w-lg mx-auto w-full px-4 py-4">
        <AnimatePresence mode="wait">
          {tab === "search" && query.length <= 1 ? (
            <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center justify-center py-24 text-muted-foreground gap-4">
              <div className="w-16 h-16 bg-accent rounded-2xl flex items-center justify-center">
                <Search size={28} className="text-primary/60" />
              </div>
              <div className="text-center">
                <p className="font-medium text-foreground text-sm">Find someone to chat with</p>
                <p className="text-xs mt-1">Search by display name or @username</p>
              </div>
              <button onClick={() => setTab("online")} className="text-xs text-primary underline-offset-2 hover:underline flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                See who's online now
              </button>
            </motion.div>
          ) : tab === "search" && searching ? (
            <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="flex items-center gap-4 bg-card border border-border rounded-2xl p-4">
                  <div className="w-12 h-12 bg-accent animate-pulse rounded-full" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 bg-accent animate-pulse rounded w-1/3" />
                    <div className="h-2.5 bg-accent animate-pulse rounded w-1/4" />
                  </div>
                </div>
              ))}
            </motion.div>
          ) : displayUsers.length === 0 && tab === "search" ? (
            <motion.div key="no-results" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-16 text-muted-foreground">
              <UserPlus size={36} className="mx-auto mb-3 opacity-20" />
              <p className="text-sm font-medium text-foreground">No users found</p>
              <p className="text-xs mt-1">Try searching with a different name</p>
            </motion.div>
          ) : tab === "online" && displayUsers.length === 0 ? (
            <motion.div key="no-online" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center py-24 gap-4 text-muted-foreground">
              <div className="w-16 h-16 bg-accent rounded-2xl flex items-center justify-center">
                <Users size={28} className="text-primary/60" />
              </div>
              <div className="text-center">
                <p className="font-medium text-foreground text-sm">No one's online yet</p>
                <p className="text-xs mt-1">Invite friends to join Droidgram!</p>
              </div>
            </motion.div>
          ) : (
            <motion.div key="results" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2">
              {tab === "online" && (
                <p className="text-xs text-muted-foreground mb-3 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                  {displayUsers.length} people online right now
                </p>
              )}
              {displayUsers.map((user: any, i: number) => (
                <motion.div
                  key={user.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="flex items-center gap-4 bg-card border border-border rounded-2xl p-4 hover:border-primary/30 hover:shadow-md hover:shadow-primary/5 transition-all"
                >
                  <Avatar src={user.avatarUrl} name={user.displayName} size={50} online={user.isOnline} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-sm">{user.displayName}</p>
                      {user.isOnline && <span className="text-[10px] text-green-500 font-medium bg-green-500/10 rounded-full px-1.5 py-0.5">Online</span>}
                    </div>
                    <p className="text-xs text-muted-foreground">@{user.username}</p>
                    {user.bio && <p className="text-xs text-muted-foreground mt-0.5 truncate opacity-80">{user.bio}</p>}
                  </div>
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={() => startChat(user.id)}
                    disabled={createChat.isPending}
                    className="flex items-center gap-1.5 bg-primary text-primary-foreground rounded-xl px-3.5 py-2 text-xs font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 shadow-sm shadow-primary/20 shrink-0"
                  >
                    <MessageSquare size={12} />
                    Message
                  </motion.button>
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
