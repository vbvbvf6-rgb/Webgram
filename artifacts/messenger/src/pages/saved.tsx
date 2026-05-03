import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Star, Trash2, Search, Copy, BookmarkX } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface SavedMessage {
  id: number;
  content: string;
  senderId?: number;
  senderName?: string;
  chatName?: string;
  savedAt: string;
}

function renderContent(content: string) {
  if (content.startsWith("[voice:")) return <span className="text-muted-foreground italic text-xs">🎤 Voice message</span>;
  if (/\.(jpg|jpeg|png|gif|webp|svg)(\?|$)/i.test(content)) {
    return <img src={content} alt="img" className="rounded-xl max-h-40 max-w-full object-contain mt-1" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />;
  }
  return <span className="text-sm leading-relaxed">{content}</span>;
}

export default function SavedPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [saved, setSaved] = useState<SavedMessage[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    try {
      const raw = localStorage.getItem("pulse_saved_messages");
      setSaved(raw ? JSON.parse(raw) : []);
    } catch { setSaved([]); }
  }, []);

  const filtered = search.trim()
    ? saved.filter(m => m.content?.toLowerCase().includes(search.toLowerCase()))
    : saved;

  function remove(id: number) {
    const next = saved.filter(m => m.id !== id);
    setSaved(next);
    localStorage.setItem("pulse_saved_messages", JSON.stringify(next));
    toast({ title: "Removed from saved" });
  }

  function clearAll() {
    setSaved([]);
    localStorage.removeItem("pulse_saved_messages");
    toast({ title: "All saved messages cleared" });
  }

  return (
    <div className="flex flex-col h-[100dvh] bg-background overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-sidebar/80 backdrop-blur-md shrink-0">
        <button onClick={() => setLocation("/chats")} className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-accent">
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1">
          <h1 className="font-bold text-sm flex items-center gap-1.5">
            <Star size={14} className="text-yellow-400" /> Saved Messages
          </h1>
          <p className="text-[11px] text-muted-foreground">{saved.length} saved</p>
        </div>
        {saved.length > 0 && (
          <button onClick={clearAll} className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-red-500/10 text-muted-foreground hover:text-red-400 transition-colors">
            <BookmarkX size={16} />
          </button>
        )}
      </div>

      {/* Search */}
      {saved.length > 3 && (
        <div className="px-4 py-2 border-b border-border">
          <div className="flex items-center gap-2 bg-accent rounded-xl px-3 py-2">
            <Search size={13} className="text-muted-foreground" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search saved…" className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-4 py-4 pb-24 space-y-3">
        {filtered.length === 0 ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-full bg-yellow-500/10 flex items-center justify-center mb-4">
              <Star size={28} className="text-yellow-400" />
            </div>
            <p className="font-semibold mb-1">{search ? "No results" : "Nothing saved yet"}</p>
            <p className="text-sm text-muted-foreground max-w-xs">
              {search ? "Try a different search." : "Star messages in chats to save them here for quick access."}
            </p>
          </motion.div>
        ) : (
          filtered.map((msg, i) => (
            <motion.div key={msg.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
              className="group bg-card border border-border rounded-2xl p-3.5 hover:border-primary/20 transition-all">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  {msg.chatName && <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">{msg.chatName}</span>}
                  {msg.senderName && <span className="text-[10px] text-muted-foreground">{msg.senderName}</span>}
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => { navigator.clipboard.writeText(msg.content); toast({ title: "Copied!" }); }}
                    className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground">
                    <Copy size={11} />
                  </button>
                  <button onClick={() => remove(msg.id)}
                    className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-red-500/10 text-muted-foreground hover:text-red-400">
                    <Trash2 size={11} />
                  </button>
                </div>
              </div>
              <div className="text-sm break-words">{renderContent(msg.content)}</div>
              <p className="text-[10px] text-muted-foreground mt-2">{new Date(msg.savedAt).toLocaleString()}</p>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}
