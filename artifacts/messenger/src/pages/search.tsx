import { useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Search, MessageSquare } from "lucide-react";
import { useSearchUsers, useGetMe, useCreateChat, getGetChatsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

function Avatar({ src, name, size = 44, online }: { src?: string | null; name: string; size?: number; online?: boolean }) {
  const initials = name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
  const colors = ["#8B5CF6", "#6366F1", "#EC4899", "#14B8A6", "#F59E0B", "#10B981"];
  const color = colors[name.charCodeAt(0) % colors.length];
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      {src ? (
        <img src={src} alt={name} className="rounded-full object-cover w-full h-full" />
      ) : (
        <div className="rounded-full flex items-center justify-center text-white font-semibold w-full h-full" style={{ background: color, fontSize: size * 0.35 }}>
          {initials}
        </div>
      )}
      {online && <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-background" />}
    </div>
  );
}

export default function SearchPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [query, setQuery] = useState("");
  const { data: me } = useGetMe();
  const myId = (me as any)?.id;

  const { data: results } = useSearchUsers(
    { q: query },
    { query: { enabled: query.length > 1 } }
  );

  const createChat = useCreateChat();

  async function startChat(userId: number) {
    try {
      const chat = await createChat.mutateAsync({ data: { type: "direct", memberIds: [userId] } });
      qc.invalidateQueries({ queryKey: getGetChatsQueryKey() });
      setLocation(`/chats/${(chat as any).id}`);
    } catch {
      toast({ title: "Failed to start chat", variant: "destructive" });
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 flex items-center gap-3 px-4 py-3 border-b border-border bg-sidebar/80 backdrop-blur-xl z-10">
        <button onClick={() => setLocation("/chats")} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-accent" data-testid="button-back">
          <ArrowLeft size={18} />
        </button>
        <h1 className="font-semibold">Find People</h1>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6">
        <div className="relative mb-6">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search by name or username..."
            className="w-full bg-card border border-border rounded-xl pl-11 pr-4 py-3 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 ring-primary/50 transition-all"
            autoFocus
            data-testid="input-search"
          />
        </div>

        {query.length <= 1 && (
          <div className="text-center py-16 text-muted-foreground">
            <Search size={40} className="opacity-20 mx-auto mb-3" />
            <p className="text-sm">Type at least 2 characters to search</p>
          </div>
        )}

        {query.length > 1 && results?.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            <p className="text-sm">No users found for "{query}"</p>
          </div>
        )}

        <div className="space-y-2">
          {(results || []).map((user: any) => (
            <div key={user.id} className="flex items-center gap-4 bg-card border border-border rounded-2xl p-4 hover:border-primary/30 transition-colors" data-testid={`user-card-${user.id}`}>
              <Avatar src={user.avatarUrl} name={user.displayName} size={48} online={user.isOnline} />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm">{user.displayName}</p>
                <p className="text-xs text-muted-foreground">@{user.username}</p>
                {user.bio && <p className="text-xs text-muted-foreground mt-0.5 truncate">{user.bio}</p>}
              </div>
              <div className="flex flex-col items-end gap-1.5">
                {user.isOnline && (
                  <span className="text-xs text-green-500 font-medium">Online</span>
                )}
                {user.id !== myId && (
                  <button
                    onClick={() => startChat(user.id)}
                    disabled={createChat.isPending}
                    className="flex items-center gap-1.5 bg-primary text-primary-foreground rounded-lg px-3 py-1.5 text-xs font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
                    data-testid={`button-message-${user.id}`}
                  >
                    <MessageSquare size={12} />
                    Message
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
