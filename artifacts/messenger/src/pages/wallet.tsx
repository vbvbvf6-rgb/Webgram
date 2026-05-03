import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@clerk/react";
import { motion, AnimatePresence } from "framer-motion";
import { useGetMe } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, Zap, Send, Gift, Trophy, TrendingUp,
  History, ChevronRight, User, Check, X, RefreshCw,
  Coins, Star, Crown, Award, Sparkles, Clock,
  Flame, Rocket, Wand2, Gem, Flower2,
} from "lucide-react";

interface WalletData {
  id: number; userId: number; balance: number; lastDailyBonus: string | null;
  displayName: string; username: string;
}
interface Transaction {
  id: number; fromUserId: number | null; toUserId: number; amount: number;
  type: "send" | "receive" | "bonus" | "gift" | "system"; description: string | null;
  chatId: number | null; createdAt: string;
}
interface LeaderboardEntry {
  balance: number; userId: number; displayName: string; username: string; avatarUrl: string | null;
}

function Avatar({ src, name, size = 40 }: { src?: string | null; name: string; size?: number }) {
  const hue = (name.charCodeAt(0) * 37 + (name.charCodeAt(1) || 0) * 17) % 360;
  const initials = name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
  return src ? (
    <img src={src} alt={name} className="rounded-full object-cover" style={{ width: size, height: size }} />
  ) : (
    <div className="rounded-full flex items-center justify-center text-white font-bold shrink-0" style={{ width: size, height: size, background: `hsl(${hue},65%,50%)`, fontSize: size * 0.35 }}>
      {initials || "?"}
    </div>
  );
}

const GIFTS_CATALOG = [
  { id: "rose", name: "Rose", icon: Flower2, price: 25 },
  { id: "star", name: "Star", icon: Star, price: 30 },
  { id: "fire", name: "Fire Heart", icon: Flame, price: 50 },
  { id: "rocket", name: "Rocket", icon: Rocket, price: 75 },
  { id: "crown", name: "Crown", icon: Crown, price: 100 },
  { id: "magic", name: "Magic", icon: Wand2, price: 150 },
  { id: "diamond", name: "Diamond", icon: Gem, price: 200 },
  { id: "trophy", name: "Trophy", icon: Trophy, price: 500 },
  { id: "crown-jewel", name: "Crown Jewel", icon: Crown, price: 10000 },
];

const TABS = [
  { id: "wallet", label: "Wallet", icon: Zap },
  { id: "history", label: "History", icon: History },
  { id: "shop", label: "Shop", icon: Gift },
  { id: "inventory", label: "Gifts", icon: Gift },
  { id: "leaderboard", label: "Top", icon: Trophy },
];

export default function WalletPage() {
  const [, setLocation] = useLocation();
  const { getToken } = useAuth();
  const { data: me } = useGetMe();
  const { toast } = useToast();

  const [tab, setTab] = useState<"wallet" | "history" | "shop" | "inventory" | "leaderboard">("wallet");
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [gifts, setGifts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [claimLoading, setClaimLoading] = useState(false);
  const [canClaim, setCanClaim] = useState(false);
  const [nextClaimIn, setNextClaimIn] = useState("");
  const [showSend, setShowSend] = useState(false);
  const [sendTo, setSendTo] = useState("");
  const [sendAmount, setSendAmount] = useState("");
  const [sendNote, setSendNote] = useState("");
  const [sendLoading, setSendLoading] = useState(false);
  const [userSearch, setUserSearch] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [giftAction, setGiftAction] = useState<{ type: "sell" | "transfer" | "buy"; giftId?: string } | null>(null);
  const [transferSearch, setTransferSearch] = useState("");
  const [transferUser, setTransferUser] = useState<any>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchWallet = useCallback(async () => {
    try {
      const token = await getToken();
      const r = await fetch("/api/wallet", { headers: { Authorization: `Bearer ${token}` } });
      if (r.ok) {
        const data = await r.json();
        setWallet(data);
        if (!data.lastDailyBonus) {
          setCanClaim(true);
        } else {
          const diff = Date.now() - new Date(data.lastDailyBonus).getTime();
          setCanClaim(diff >= 24 * 60 * 60 * 1000);
          if (diff < 24 * 60 * 60 * 1000) {
            const remaining = 24 * 60 * 60 * 1000 - diff;
            const h = Math.floor(remaining / 3600000);
            const m = Math.floor((remaining % 3600000) / 60000);
            setNextClaimIn(`${h}h ${m}m`);
          }
        }
      }
    } finally { setLoading(false); }
  }, [getToken]);

  const fetchTransactions = useCallback(async () => {
    const token = await getToken();
    const r = await fetch("/api/wallet/transactions", { headers: { Authorization: `Bearer ${token}` } });
    if (r.ok) setTransactions(await r.json());
  }, [getToken]);

  const fetchLeaderboard = useCallback(async () => {
    const token = await getToken();
    const r = await fetch("/api/wallet/leaderboard", { headers: { Authorization: `Bearer ${token}` } });
    if (r.ok) setLeaderboard(await r.json());
  }, [getToken]);

  const fetchGifts = useCallback(async () => {
    try {
      const token = await getToken();
      const r = await fetch("/api/wallet/gifts", { headers: { Authorization: `Bearer ${token}` } });
      if (r.ok) setGifts(await r.json());
      else setGifts([]);
    } catch (e) {
      setGifts([]);
    }
  }, [getToken]);

  useEffect(() => { fetchWallet(); fetchTransactions(); fetchLeaderboard(); fetchGifts(); }, []);

  async function claimDaily() {
    setClaimLoading(true);
    try {
      const token = await getToken();
      const r = await fetch("/api/wallet/daily", { method: "POST", headers: { Authorization: `Bearer ${token}` } });
      const data = await r.json();
      if (r.ok) {
        toast({ title: `⚡ +${data.bonus} Droidgram coins claimed!`, description: "Come back tomorrow for more" });
        setWallet(data.wallet);
        setCanClaim(false);
        setNextClaimIn("24h 0m");
        fetchTransactions();
      } else {
        toast({ title: data.error, variant: "destructive" });
      }
    } finally { setClaimLoading(false); }
  }

  async function searchUsers(q: string) {
    setSearchQuery(q);
    if (!q.trim()) { setUserSearch([]); return; }
    const token = await getToken();
    const r = await fetch(`/api/users/search?q=${encodeURIComponent(q)}`, { headers: { Authorization: `Bearer ${token}` } });
    if (r.ok) setUserSearch(await r.json());
  }

  async function doSend() {
    if (!selectedUser || !sendAmount) return;
    const amount = parseInt(sendAmount);
    if (isNaN(amount) || amount < 1) { toast({ title: "Enter a valid amount", variant: "destructive" }); return; }
    setSendLoading(true);
    try {
      const token = await getToken();
      const r = await fetch("/api/wallet/send", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ toUserId: selectedUser.id, amount, description: sendNote || undefined }),
      });
      const data = await r.json();
      if (r.ok) {
        toast({ title: `⚡ ${amount} Droidgram coins sent to ${selectedUser.displayName}!` });
        setShowSend(false); setSendAmount(""); setSendNote(""); setSelectedUser(null); setSearchQuery("");
        fetchWallet(); fetchTransactions();
      } else toast({ title: data.error, variant: "destructive" });
    } finally { setSendLoading(false); }
  }

  const txColor = (t: Transaction) => {
    if (t.type === "send" || t.amount < 0) return "text-red-400";
    if (t.type === "receive") return "text-green-400";
    return "text-yellow-400";
  };

  const txSign = (t: Transaction) => t.amount < 0 || t.type === "send" ? "-" : "+";
  const txIcon = (t: Transaction) => {
    if (t.type === "bonus") return <Sparkles size={14} className="text-yellow-400" />;
    if (t.type === "gift") return <Gift size={14} className="text-pink-400" />;
    if (t.type === "send") return <Send size={14} className="text-red-400" />;
    if (t.type === "receive") return <Zap size={14} className="text-green-400" />;
    return <Coins size={14} className="text-primary" />;
  };

  const myRank = leaderboard.findIndex(e => e.userId === (me as any)?.id) + 1;

  return (
    <div className="flex flex-col h-[100dvh] bg-background overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-sidebar/80 backdrop-blur-md shrink-0">
        <button onClick={() => setLocation("/chats")} className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-accent">
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1">
          <h1 className="font-bold text-sm">⚡ Droidgram coins</h1>
          <p className="text-[11px] text-muted-foreground">In-app currency</p>
        </div>
        <button onClick={() => { fetchWallet(); fetchTransactions(); fetchLeaderboard(); }}
          className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-accent text-muted-foreground">
          <RefreshCw size={15} />
        </button>
      </div>

      {/* Tab bar */}
      <div className="flex border-b border-border bg-sidebar/50 shrink-0">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id as any)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors relative ${tab === t.id ? "text-primary" : "text-muted-foreground"}`}>
            {tab === t.id && <motion.div layoutId="wallet-tab" className="absolute bottom-0 left-2 right-2 h-0.5 bg-primary rounded-full" />}
            <t.icon size={14} />
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto pb-20">
        {/* WALLET TAB */}
        {tab === "wallet" && (
          <div className="px-4 pt-4 space-y-4">
            {/* Balance card */}
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-primary via-purple-600 to-indigo-700 p-6 shadow-2xl shadow-primary/30">
              <div className="absolute top-0 right-0 w-40 h-40 bg-white/5 rounded-full -translate-y-8 translate-x-8" />
              <div className="absolute bottom-0 left-0 w-28 h-28 bg-white/5 rounded-full translate-y-8 -translate-x-8" />
              <p className="text-white/70 text-xs font-medium mb-2">Your balance</p>
              <div className="flex items-end gap-2 mb-4">
                {loading ? (
                  <div className="w-32 h-10 bg-white/20 rounded-xl animate-pulse" />
                ) : (
                  <motion.span key={wallet?.balance} initial={{ scale: 1.15 }} animate={{ scale: 1 }}
                    className="text-4xl font-black text-white tabular-nums">
                    {wallet?.balance?.toLocaleString() ?? "—"}
                  </motion.span>
                )}
                <span className="text-white/70 text-sm mb-1 font-medium">PC</span>
              </div>
              <p className="text-white/60 text-xs">⚡ Droidgram coins</p>
              {myRank > 0 && (
                <div className="absolute top-4 right-4 flex items-center gap-1 bg-white/15 rounded-full px-2.5 py-1">
                  <Crown size={11} className="text-yellow-300" />
                  <span className="text-white text-[11px] font-semibold">#{myRank}</span>
                </div>
              )}
            </motion.div>

            {/* Quick actions */}
            <div className="grid grid-cols-2 gap-3">
              <motion.button whileTap={{ scale: 0.97 }} onClick={() => setShowSend(true)}
                className="flex items-center gap-3 p-4 rounded-2xl bg-card border border-border hover:border-primary/30 hover:bg-primary/5 transition-all">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Send size={18} className="text-primary" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-semibold">Send</p>
                  <p className="text-[11px] text-muted-foreground">To any user</p>
                </div>
              </motion.button>

              <motion.button whileTap={{ scale: 0.97 }} onClick={canClaim ? claimDaily : undefined}
                disabled={claimLoading || !canClaim}
                className={`flex items-center gap-3 p-4 rounded-2xl border transition-all ${canClaim ? "bg-yellow-500/10 border-yellow-500/30 hover:bg-yellow-500/15 cursor-pointer" : "bg-card border-border opacity-60 cursor-default"}`}>
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${canClaim ? "bg-yellow-500/20" : "bg-accent"}`}>
                  {claimLoading ? <RefreshCw size={18} className="text-yellow-400 animate-spin" /> : <Gift size={18} className={canClaim ? "text-yellow-400" : "text-muted-foreground"} />}
                </div>
                <div className="text-left">
                  <p className="text-sm font-semibold">{canClaim ? "Claim Bonus" : "Daily Bonus"}</p>
                  <p className="text-[11px] text-muted-foreground">{canClaim ? "+50 PC free!" : `Next: ${nextClaimIn}`}</p>
                </div>
              </motion.button>
            </div>

            {/* Recent activity */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold">Recent</h3>
                <button onClick={() => setTab("history")} className="text-xs text-primary flex items-center gap-0.5">
                  See all <ChevronRight size={12} />
                </button>
              </div>
              {transactions.slice(0, 5).map((tx, i) => (
                <motion.div key={tx.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}
                  className="flex items-center gap-3 py-2.5 border-b border-border/40 last:border-0">
                  <div className="w-8 h-8 rounded-xl bg-accent flex items-center justify-center shrink-0">
                    {txIcon(tx)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{tx.description || tx.type}</p>
                    <p className="text-[10px] text-muted-foreground">{new Date(tx.createdAt).toLocaleDateString()}</p>
                  </div>
                  <span className={`text-sm font-bold tabular-nums ${txColor(tx)}`}>
                    {txSign(tx)}{Math.abs(tx.amount)}⚡
                  </span>
                </motion.div>
              ))}
              {transactions.length === 0 && !loading && (
                <p className="text-xs text-muted-foreground text-center py-4">No transactions yet</p>
              )}
            </div>
          </div>
        )}

        {/* HISTORY TAB */}
        {tab === "history" && (
          <div className="px-4 pt-4 space-y-1">
            {transactions.length === 0 ? (
              <div className="text-center py-12">
                <History size={36} className="mx-auto text-muted-foreground/30 mb-3" />
                <p className="text-sm text-muted-foreground">No transactions yet</p>
              </div>
            ) : transactions.map((tx, i) => (
              <motion.div key={tx.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }}
                className="flex items-center gap-3 p-3 rounded-xl hover:bg-accent/50 transition-colors">
                <div className="w-9 h-9 rounded-xl bg-accent flex items-center justify-center shrink-0">
                  {txIcon(tx)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{tx.description || tx.type}</p>
                  <div className="flex items-center gap-1 mt-0.5">
                    <Clock size={9} className="text-muted-foreground" />
                    <p className="text-[10px] text-muted-foreground">{new Date(tx.createdAt).toLocaleString()}</p>
                  </div>
                </div>
                <span className={`text-sm font-bold tabular-nums ${txColor(tx)}`}>
                  {txSign(tx)}{Math.abs(tx.amount)} ⚡
                </span>
              </motion.div>
            ))}
          </div>
        )}

        {/* SHOP TAB */}
        {tab === "shop" && (
          <div className="px-4 pt-4 space-y-4">
            <div className="space-y-3">
              <p className="text-sm font-semibold">Gift Shop</p>
              <p className="text-xs text-muted-foreground">Balance: {wallet?.balance ?? "—"} ⚡</p>
              <div className="grid grid-cols-3 gap-2">
                {GIFTS_CATALOG.map(gift => {
                  const canAfford = wallet ? wallet.balance >= gift.price : false;
                  const isUltra = gift.price === 10000;
                  const Icon = gift.icon;
                  return (
                    <motion.button key={gift.id}
                      whileHover={canAfford ? { scale: 1.05 } : {}}
                      onClick={() => canAfford && setGiftAction({ type: "buy", giftId: gift.id })}
                      disabled={!canAfford}
                      className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all ${
                        isUltra ? "border-yellow-500/50 bg-gradient-to-br from-yellow-500/10 to-pink-500/10" :
                        canAfford ? "border-primary/30 bg-primary/5 hover:border-primary/50 cursor-pointer" : "border-border/50 opacity-40 cursor-not-allowed"
                      }`}>
                      <Icon size={24} className={isUltra ? "gift-supreme" : ""} />
                      <p className="text-[10px] font-semibold leading-none text-center text-muted-foreground">{gift.name}</p>
                      <p className={`text-[10px] font-bold ${isUltra ? "text-yellow-400" : "text-primary"}`}>⚡{gift.price}</p>
                      {isUltra && <span className="text-[7px] text-yellow-400 font-bold">ULTRA RARE</span>}
                    </motion.button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* INVENTORY TAB */}
        {tab === "inventory" && (
          <div className="px-4 pt-4 space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">My Gifts</p>
                <p className="text-xs text-muted-foreground">{gifts.length} gift{gifts.length !== 1 ? "s" : ""}</p>
              </div>
              {gifts.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-12">No gifts yet. Visit the Shop to buy!</p>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {gifts.map(gift => {
                    const giftInfo = GIFTS_CATALOG.find(g => g.id === gift.giftId);
                    const sellPrice = Math.floor((giftInfo?.price || 0) * 0.5);
                    const Icon = giftInfo?.icon;
                    return (
                      <motion.div key={gift.id} initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                        className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border/60 hover:border-primary/30 transition-colors">
                        {Icon && <Icon size={24} className="text-primary shrink-0" />}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold">{giftInfo?.name || "Unknown"}</p>
                          <p className="text-[10px] text-muted-foreground">from {gift.fromUser.displayName}</p>
                        </div>
                        <div className="flex gap-1.5 shrink-0">
                          <motion.button whileTap={{ scale: 0.95 }}
                            onClick={() => setGiftAction({ type: "transfer", giftId: gift.id })}
                            className="px-2 py-1 rounded-lg bg-primary/10 text-primary text-[10px] font-semibold hover:bg-primary/20 transition-colors">
                            Transfer
                          </motion.button>
                          <motion.button whileTap={{ scale: 0.95 }}
                            onClick={() => setGiftAction({ type: "sell", giftId: gift.id })}
                            className="px-2 py-1 rounded-lg bg-orange-500/10 text-orange-400 text-[10px] font-semibold hover:bg-orange-500/20 transition-colors">
                            Sell ⚡{sellPrice}
                          </motion.button>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Gift Action Modal */}
        {giftAction && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setGiftAction(null)}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="bg-card border border-border rounded-2xl w-full max-w-sm overflow-hidden"
              onClick={e => e.stopPropagation()}>
              <div className="p-4 border-b border-border/50">
                <h3 className="font-semibold text-sm">
                  {giftAction.type === "buy" ? `Buy ${GIFTS_CATALOG.find(g => g.id === giftAction.giftId)?.name || "Gift"}` :
                   giftAction.type === "sell" ? "Sell Gift" : "Transfer Gift"}
                </h3>
              </div>

              {giftAction.type === "buy" ? (
                <div className="p-4 space-y-4">
                  <p className="text-xs text-muted-foreground">Buy this beautiful gift for your friends!</p>
                  <motion.button whileTap={{ scale: 0.97 }} 
                    onClick={async () => {
                      const gift = GIFTS_CATALOG.find(g => g.id === giftAction.giftId);
                      if (!gift) return;
                      setActionLoading(true);
                      try {
                        const token = await getToken();
                        // Refresh wallet balance before purchase
                        const walletRes = await fetch("/api/wallet", { headers: { Authorization: `Bearer ${token}` } });
                        if (walletRes.ok) {
                          const freshWallet = await walletRes.json();
                          if (freshWallet.balance < gift.price) {
                            toast({ title: "Insufficient balance", variant: "destructive" });
                            setActionLoading(false);
                            return;
                          }
                        }
                        
                        const res = await fetch("/api/wallet/gift", {
                          method: "POST",
                          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                          body: JSON.stringify({ toUserId: (me as any)?.id, giftId: gift.id, message: null }),
                        });
                        if (res.ok) {
                          const data = await res.json();
                          setWallet(w => w ? { ...w, balance: data.newBalance } : null);
                          setGiftAction(null);
                          fetchWallet();
                          fetchGifts();
                          toast({ title: `Bought ${gift.name}! 🎁` });
                        } else {
                          const err = await res.json().catch(() => ({}));
                          toast({ title: err.error || "Failed to buy gift", variant: "destructive" });
                        }
                      } finally {
                        setActionLoading(false);
                      }
                    }}
                    disabled={actionLoading}
                    className="w-full py-2 bg-primary/20 text-primary rounded-xl font-semibold text-sm hover:bg-primary/30 transition-colors disabled:opacity-50">
                    {actionLoading ? "Buying…" : `Buy for ⚡${GIFTS_CATALOG.find(g => g.id === giftAction.giftId)?.price || 0}`}
                  </motion.button>
                </div>
              ) : giftAction.type === "sell" ? (
                <div className="p-4 space-y-4">
                  <p className="text-xs text-muted-foreground">You'll receive 50% of the gift's original price.</p>
                  <motion.button whileTap={{ scale: 0.97 }} 
                    onClick={async () => {
                      setActionLoading(true);
                      try {
                        const token = await getToken();
                        const res = await fetch(`/api/wallet/gift/${giftAction.giftId}/sell`, {
                          method: "POST",
                          headers: { Authorization: `Bearer ${token}` },
                        });
                        if (res.ok) {
                          const data = await res.json();
                          setWallet(w => w ? { ...w, balance: data.newBalance } : null);
                          setGiftAction(null);
                          fetchGifts();
                          toast({ title: `Sold gift for ⚡${data.sellPrice} coins!` });
                        } else {
                          toast({ title: "Failed to sell gift", variant: "destructive" });
                        }
                      } finally {
                        setActionLoading(false);
                      }
                    }}
                    disabled={actionLoading}
                    className="w-full py-2 bg-orange-500/20 text-orange-400 rounded-xl font-semibold text-sm hover:bg-orange-500/30 transition-colors disabled:opacity-50">
                    {actionLoading ? "Selling…" : "Confirm Sale"}
                  </motion.button>
                </div>
              ) : (
                <div className="p-4 space-y-4">
                  <input type="text" placeholder="Search user…" value={transferSearch}
                    onChange={e => setTransferSearch(e.target.value)}
                    className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary/60" />
                  {transferSearch && (
                    <div className="max-h-32 overflow-y-auto space-y-1 border border-border rounded-xl p-2">
                      {/* Search would happen here - for now simplified */}
                      <p className="text-[10px] text-muted-foreground text-center py-2">Search coming soon</p>
                    </div>
                  )}
                  <motion.button whileTap={{ scale: 0.97 }}
                    disabled={actionLoading || !transferUser}
                    className="w-full py-2 bg-primary/20 text-primary rounded-xl font-semibold text-sm hover:bg-primary/30 transition-colors disabled:opacity-50">
                    {actionLoading ? "Transferring…" : "Transfer Gift"}
                  </motion.button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}

        {/* LEADERBOARD TAB */}
        {tab === "leaderboard" && (
          <div className="px-4 pt-4 space-y-2">
            {leaderboard.slice(0, 3).length > 0 && (
              <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
                className="grid grid-cols-3 gap-2 mb-4">
                {[leaderboard[1], leaderboard[0], leaderboard[2]].map((e, i) => e && (
                  <motion.div key={e.userId} initial={{ opacity: 0, y: i === 1 ? -12 : 0 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
                    className={`flex flex-col items-center p-3 rounded-2xl border ${e.userId === (me as any)?.id ? "bg-primary/10 border-primary/40" : "bg-card border-border"} ${i === 1 ? "-mt-2" : ""}`}>
                    <div className="relative mb-1.5">
                      <Avatar src={e.avatarUrl} name={e.displayName} size={i === 1 ? 44 : 36} />
                      <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black
                        ${i === 1 ? "bg-yellow-400 text-yellow-900" : i === 0 ? "bg-gray-400 text-gray-900" : "bg-orange-400 text-orange-900"}`}>
                        {i === 1 ? "🥇" : i === 0 ? "🥈" : "🥉"}
                      </div>
                    </div>
                    <p className="text-[10px] font-semibold truncate w-full text-center">{e.displayName.split(" ")[0]}</p>
                    <p className="text-xs font-black text-primary">{e.balance.toLocaleString()}⚡</p>
                  </motion.div>
                ))}
              </motion.div>
            )}
            {leaderboard.slice(3).map((e, i) => (
              <motion.div key={e.userId} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}
                className={`flex items-center gap-3 p-3 rounded-xl border ${e.userId === (me as any)?.id ? "bg-primary/10 border-primary/40" : "bg-card border-border"}`}>
                <span className="text-sm font-black text-muted-foreground w-6 text-center">{i + 4}</span>
                <Avatar src={e.avatarUrl} name={e.displayName} size={36} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{e.displayName}</p>
                  <p className="text-[10px] text-muted-foreground">@{e.username}</p>
                </div>
                <span className="text-sm font-bold text-primary">{e.balance.toLocaleString()}⚡</span>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Send Modal */}
      <AnimatePresence>
        {showSend && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
            <motion.div initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }}
              className="bg-card border border-border rounded-3xl w-full max-w-sm p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold">⚡ Send Droidgram coins</h3>
                <button onClick={() => { setShowSend(false); setSelectedUser(null); setSearchQuery(""); }}
                  className="w-7 h-7 flex items-center justify-center rounded-xl hover:bg-accent text-muted-foreground">
                  <X size={14} />
                </button>
              </div>

              {!selectedUser ? (
                <div className="space-y-3">
                  <input
                    autoFocus value={searchQuery}
                    onChange={e => searchUsers(e.target.value)}
                    placeholder="Search username or name..."
                    className="w-full px-4 py-2.5 rounded-xl bg-accent border border-border/50 text-sm outline-none focus:border-primary/50 placeholder:text-muted-foreground"
                  />
                  {userSearch.map(u => (
                    <motion.button key={u.id} whileTap={{ scale: 0.98 }} onClick={() => setSelectedUser(u)}
                      className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-accent transition-colors">
                      <Avatar src={u.avatarUrl} name={u.displayName} size={36} />
                      <div className="text-left">
                        <p className="text-sm font-semibold">{u.displayName}</p>
                        <p className="text-xs text-muted-foreground">@{u.username}</p>
                      </div>
                    </motion.button>
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-primary/5 border border-primary/20">
                    <Avatar src={selectedUser.avatarUrl} name={selectedUser.displayName} size={36} />
                    <div className="flex-1">
                      <p className="text-sm font-semibold">{selectedUser.displayName}</p>
                      <p className="text-xs text-muted-foreground">@{selectedUser.username}</p>
                    </div>
                    <button onClick={() => setSelectedUser(null)} className="text-muted-foreground hover:text-foreground"><X size={13} /></button>
                  </div>
                  <div className="relative">
                    <Zap size={14} className="absolute left-3 top-3 text-primary" />
                    <input value={sendAmount} onChange={e => setSendAmount(e.target.value.replace(/\D/g, ""))}
                      placeholder="Amount" type="number" min="1"
                      className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-accent border border-border/50 text-sm outline-none focus:border-primary/50 placeholder:text-muted-foreground" />
                  </div>
                  <input value={sendNote} onChange={e => setSendNote(e.target.value)}
                    placeholder="Note (optional)" maxLength={80}
                    className="w-full px-4 py-2.5 rounded-xl bg-accent border border-border/50 text-sm outline-none focus:border-primary/50 placeholder:text-muted-foreground" />
                  <p className="text-xs text-muted-foreground text-center">Balance: {wallet?.balance ?? "—"} ⚡</p>
                  <motion.button whileTap={{ scale: 0.97 }} onClick={doSend}
                    disabled={sendLoading || !sendAmount || parseInt(sendAmount) < 1}
                    className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm disabled:opacity-50 transition-all">
                    {sendLoading ? "Sending…" : `Send ${sendAmount || 0} ⚡ Droidgram coins`}
                  </motion.button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
