import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Send, Trash2, Bot, Sparkles, Copy, Check,
  RefreshCw, AlertTriangle, ShieldCheck, Info, ChevronDown,
} from "lucide-react";
import { useAuth } from "@clerk/react";
import { useToast } from "@/hooks/use-toast";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

type AiMsg = { id: number; role: "user" | "assistant"; content: string; createdAt: string };

function formatMarkdown(text: string): React.ReactNode {
  const lines = text.split("\n");
  const nodes: React.ReactNode[] = [];
  let codeBlock = false;
  let codeLines: string[] = [];
  let codeLang = "";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith("```")) {
      if (!codeBlock) {
        codeBlock = true;
        codeLang = line.slice(3).trim();
        codeLines = [];
      } else {
        nodes.push(
          <div key={i} className="my-2 rounded-xl overflow-hidden border border-white/10">
            {codeLang && <div className="px-3 py-1 bg-white/8 text-[10px] text-slate-400 font-mono">{codeLang}</div>}
            <pre className="p-3 text-xs text-slate-200 font-mono overflow-x-auto bg-black/30 leading-relaxed">
              {codeLines.join("\n")}
            </pre>
          </div>
        );
        codeBlock = false;
      }
      continue;
    }
    if (codeBlock) { codeLines.push(line); continue; }

    if (line.startsWith("### ")) {
      nodes.push(<p key={i} className="font-semibold text-sm text-slate-100 mt-3 mb-1">{line.slice(4)}</p>);
    } else if (line.startsWith("## ")) {
      nodes.push(<p key={i} className="font-bold text-base text-white mt-3 mb-1">{line.slice(3)}</p>);
    } else if (line.startsWith("# ")) {
      nodes.push(<p key={i} className="font-black text-lg text-white mt-3 mb-1">{line.slice(2)}</p>);
    } else if (line.startsWith("- ") || line.startsWith("* ")) {
      nodes.push(<li key={i} className="text-sm text-slate-200 ml-4 list-disc leading-relaxed">{inlineFormat(line.slice(2))}</li>);
    } else if (/^\d+\. /.test(line)) {
      const match = line.match(/^\d+\. (.*)/);
      nodes.push(<li key={i} className="text-sm text-slate-200 ml-4 list-decimal leading-relaxed">{match ? inlineFormat(match[1]) : line}</li>);
    } else if (line.trim() === "") {
      nodes.push(<div key={i} className="h-2" />);
    } else {
      nodes.push(<p key={i} className="text-sm text-slate-200 leading-relaxed">{inlineFormat(line)}</p>);
    }
  }
  return <>{nodes}</>;
}

function inlineFormat(text: string): React.ReactNode {
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("`") && part.endsWith("`")) {
      return <code key={i} className="bg-white/10 text-fuchsia-300 text-xs px-1.5 py-0.5 rounded font-mono">{part.slice(1, -1)}</code>;
    }
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i} className="font-bold text-white">{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("*") && part.endsWith("*")) {
      return <em key={i} className="italic text-slate-300">{part.slice(1, -1)}</em>;
    }
    return <span key={i}>{part}</span>;
  });
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
      className="p-1 rounded hover:bg-white/10 transition-colors"
      title="Copy"
    >
      {copied ? <Check size={11} className="text-green-400" /> : <Copy size={11} className="text-slate-400" />}
    </button>
  );
}

function SafetyBanner({ reason, onDismiss }: { reason: string; onDismiss: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="mx-4 mb-2 flex items-start gap-2 bg-red-500/15 border border-red-500/30 rounded-xl p-3"
    >
      <AlertTriangle size={14} className="text-red-400 shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-red-300">Content warning</p>
        <p className="text-xs text-red-400/80 mt-0.5">{reason || "This message may contain harmful content."}</p>
      </div>
      <button onClick={onDismiss} className="text-red-400/60 hover:text-red-300 text-xs shrink-0">Dismiss</button>
    </motion.div>
  );
}

export default function AiChatPage() {
  const [, setLocation] = useLocation();
  const { getToken } = useAuth();
  const { toast } = useToast();

  const [messages, setMessages] = useState<AiMsg[]>([]);
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamContent, setStreamContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);
  const [safetyWarning, setSafetyWarning] = useState<string | null>(null);
  const [showScrollDown, setShowScrollDown] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const scrollToBottom = useCallback((smooth = true) => {
    bottomRef.current?.scrollIntoView({ behavior: smooth ? "smooth" : "instant" });
  }, []);

  const handleScroll = () => {
    const el = messagesContainerRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    setShowScrollDown(!atBottom);
  };

  async function loadConversation() {
    setLoading(true);
    try {
      const token = await getToken();
      const res = await fetch(`${BASE}/api/ai/conversation`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setConversationId(data.conversationId);
        setMessages(data.messages || []);
        setTimeout(() => scrollToBottom(false), 100);
      }
    } catch (e) {
      toast({ title: "Failed to load conversation", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadConversation(); }, []);
  useEffect(() => { if (!streaming) scrollToBottom(); }, [messages, streaming]);

  async function checkModeration(message: string): Promise<{ safe: boolean; reason: string }> {
    try {
      const token = await getToken();
      const res = await fetch(`${BASE}/api/ai/moderate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ message }),
      });
      if (res.ok) return await res.json();
    } catch {}
    return { safe: true, reason: "" };
  }

  async function sendMessage() {
    const text = input.trim();
    if (!text || streaming) return;
    setInput("");
    setSafetyWarning(null);

    // Optimistic UI
    const tmpId = Date.now();
    const tmpMsg: AiMsg = { id: tmpId, role: "user", content: text, createdAt: new Date().toISOString() };
    setMessages(prev => [...prev, tmpMsg]);
    setTimeout(() => scrollToBottom(), 50);

    // Content safety check (non-blocking: show warning but still send)
    const { safe, reason } = await checkModeration(text);
    if (!safe) {
      setSafetyWarning(reason || "This content may be inappropriate.");
      // Remove the optimistic message and abort
      setMessages(prev => prev.filter(m => m.id !== tmpId));
      return;
    }

    setStreaming(true);
    setStreamContent("");

    try {
      const token = await getToken();
      abortRef.current = new AbortController();
      const res = await fetch(`${BASE}/api/ai/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ message: text }),
        signal: abortRef.current.signal,
      });

      if (!res.body) throw new Error("No stream");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6).trim();
          if (!data) continue;
          try {
            const parsed = JSON.parse(data);
            if (parsed.content) {
              accumulated += parsed.content;
              setStreamContent(accumulated);
              scrollToBottom(false);
            }
            if (parsed.done || parsed.error) break;
          } catch {}
        }
      }

      // Finalize: reload conversation to get saved messages
      const convRes = await fetch(`${BASE}/api/ai/conversation`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (convRes.ok) {
        const data = await convRes.json();
        setMessages(data.messages || []);
      }
    } catch (e: any) {
      if (e?.name !== "AbortError") {
        toast({ title: "AI error", description: "Could not get a response", variant: "destructive" });
        setMessages(prev => prev.filter(m => m.id !== tmpId));
      }
    } finally {
      setStreaming(false);
      setStreamContent("");
      setTimeout(() => scrollToBottom(), 100);
    }
  }

  async function clearHistory() {
    if (!conversationId) return;
    setClearing(true);
    try {
      const token = await getToken();
      await fetch(`${BASE}/api/ai/conversation`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      setMessages([]);
      toast({ title: "Conversation cleared" });
    } catch {
      toast({ title: "Failed to clear", variant: "destructive" });
    } finally {
      setClearing(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  const allMessages = streaming
    ? [...messages, { id: -1, role: "assistant" as const, content: streamContent, createdAt: new Date().toISOString() }]
    : messages;

  return (
    <div className="h-screen flex flex-col bg-[#0b1020] text-slate-100">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10 bg-[#13182b]/95 backdrop-blur-xl shrink-0">
        <button onClick={() => setLocation("/chats")} className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-white/10 transition-colors">
          <ArrowLeft size={18} />
        </button>
        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-violet-500 via-fuchsia-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-fuchsia-500/30">
          <Bot size={20} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm text-white">Droidgram AI</p>
          <p className="text-[10px] text-fuchsia-300 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-fuchsia-400 animate-pulse" />
            DeepSeek · Always available
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={clearHistory}
            disabled={clearing || messages.length === 0}
            className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-white/10 transition-colors disabled:opacity-30"
            title="Clear history"
          >
            {clearing ? <RefreshCw size={15} className="animate-spin" /> : <Trash2 size={15} className="text-slate-400" />}
          </button>
        </div>
      </div>

      {/* Messages */}
      <div
        ref={messagesContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 py-4 space-y-4"
      >
        {loading ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-400">
            <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-violet-500/30 to-fuchsia-500/30 flex items-center justify-center animate-pulse">
              <Bot size={32} className="text-fuchsia-300" />
            </div>
            <p className="text-sm">Loading…</p>
          </div>
        ) : allMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-5 text-slate-400 px-6 text-center">
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-violet-500 via-fuchsia-500 to-cyan-500 flex items-center justify-center shadow-xl shadow-fuchsia-500/30">
              <Bot size={36} className="text-white" />
            </div>
            <div>
              <p className="font-bold text-lg text-white">Droidgram AI</p>
              <p className="text-sm mt-1 text-slate-400">Powered by DeepSeek via OpenRouter</p>
            </div>
            <div className="grid grid-cols-2 gap-2 w-full max-w-xs mt-2">
              {[
                { emoji: "💡", text: "Explain a concept" },
                { emoji: "✍️", text: "Write something" },
                { emoji: "🐛", text: "Debug my code" },
                { emoji: "🌐", text: "Translate text" },
              ].map(s => (
                <button
                  key={s.text}
                  onClick={() => { setInput(s.text); inputRef.current?.focus(); }}
                  className="flex items-center gap-2 bg-white/6 hover:bg-white/10 border border-white/10 rounded-xl px-3 py-2.5 text-left transition-colors"
                >
                  <span className="text-base">{s.emoji}</span>
                  <span className="text-xs text-slate-300">{s.text}</span>
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-2">
              <ShieldCheck size={11} />
              <span>Content moderation enabled</span>
            </div>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {allMessages.map((msg, idx) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.15 }}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} gap-2`}
              >
                {msg.role === "assistant" && (
                  <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center shrink-0 mt-1 shadow-md shadow-fuchsia-500/20">
                    <Bot size={13} className="text-white" />
                  </div>
                )}
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-3 group relative ${
                    msg.role === "user"
                      ? "bg-fuchsia-500 text-white rounded-br-sm"
                      : "bg-white/8 border border-white/10 rounded-bl-sm"
                  }`}
                >
                  {msg.role === "user" ? (
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                  ) : (
                    <div className="prose-sm">
                      {formatMarkdown(msg.content)}
                      {msg.id === -1 && (
                        <span className="inline-block w-1.5 h-4 bg-fuchsia-400 rounded-sm ml-0.5 animate-pulse" />
                      )}
                    </div>
                  )}
                  {msg.role === "assistant" && msg.id !== -1 && (
                    <div className="absolute -bottom-5 right-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
                      <CopyButton text={msg.content} />
                    </div>
                  )}
                </div>
                {msg.role === "user" && (
                  <div className="w-7 h-7 rounded-xl bg-fuchsia-600/40 flex items-center justify-center shrink-0 mt-1">
                    <Sparkles size={12} className="text-fuchsia-200" />
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Scroll down button */}
      <AnimatePresence>
        {showScrollDown && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            onClick={() => scrollToBottom()}
            className="absolute bottom-24 right-4 w-9 h-9 bg-[#13182b] border border-white/15 rounded-full flex items-center justify-center shadow-xl hover:bg-white/10 transition-colors z-10"
          >
            <ChevronDown size={16} className="text-slate-300" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Safety warning */}
      <AnimatePresence>
        {safetyWarning && (
          <SafetyBanner reason={safetyWarning} onDismiss={() => setSafetyWarning(null)} />
        )}
      </AnimatePresence>

      {/* Input */}
      <div className="border-t border-white/10 bg-[#13182b]/95 backdrop-blur-xl px-4 py-3 shrink-0 pb-safe">
        <div className="flex items-end gap-2">
          <div className="flex-1 bg-white/6 border border-white/10 rounded-2xl px-4 py-3 focus-within:border-fuchsia-400/40 transition-all">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask Droidgram AI anything…"
              rows={1}
              style={{ resize: "none", minHeight: 20, maxHeight: 120, height: "auto" }}
              className="w-full bg-transparent text-slate-100 text-sm outline-none placeholder:text-slate-500 leading-relaxed"
              onInput={e => {
                const t = e.currentTarget;
                t.style.height = "auto";
                t.style.height = Math.min(t.scrollHeight, 120) + "px";
              }}
              disabled={streaming}
            />
          </div>
          <button
            onClick={sendMessage}
            disabled={!input.trim() || streaming}
            className="w-11 h-11 bg-fuchsia-500 hover:bg-fuchsia-400 disabled:opacity-40 rounded-2xl flex items-center justify-center transition-colors shadow-lg shadow-fuchsia-500/25 shrink-0"
          >
            {streaming ? (
              <div className="w-4 h-4 border-2 border-white/50 border-t-white rounded-full animate-spin" />
            ) : (
              <Send size={16} className="text-white translate-x-0.5" />
            )}
          </button>
        </div>
        <p className="text-[10px] text-slate-600 mt-1.5 text-center flex items-center justify-center gap-1">
          <Info size={9} />
          <span>AI may make mistakes · Content moderation active</span>
        </p>
      </div>
    </div>
  );
}
