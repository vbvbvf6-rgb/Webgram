import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Gift, MessageCircle, Mail, Cake } from "lucide-react";
import { useAuth } from "@clerk/react";
import { useToast } from "@/hooks/use-toast";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const GIFTS_CATALOG: Record<string, { name: string; emoji: string; color: string }> = {
  rose:    { name: "Rose",       emoji: "🌹", color: "text-rose-300" },
  star:    { name: "Star",       emoji: "⭐", color: "text-yellow-200" },
  fire:    { name: "Fire Heart", emoji: "❤️‍🔥", color: "text-orange-300" },
  rocket:  { name: "Rocket",     emoji: "🚀", color: "text-violet-300" },
  crown:   { name: "Crown",      emoji: "👑", color: "text-yellow-300" },
  rainbow: { name: "Rainbow",    emoji: "🌈", color: "text-pink-300" },
  diamond: { name: "Diamond",    emoji: "💎", color: "text-cyan-300" },
  trophy:  { name: "Trophy",     emoji: "🏆", color: "text-yellow-300" },
};

type Gift = {
  id: number;
  giftId: string;
  message: string | null;
  createdAt: string;
  fromUser: { id: number; displayName: string; avatarUrl: string | null; username: string };
};

export default function ProfilePage({ userId }: { userId?: number }) {
  const [, setLocation] = useLocation();
  const { getToken } = useAuth();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [gifts, setGifts] = useState<Gift[]>([]);
  const [stats, setStats] = useState<{ giftCount: number; giftsValue: number } | null>(null);

  useEffect(() => {
    if (!userId) return;
    loadGifts();
  }, [userId]);

  async function loadGifts() {
    setLoading(true);
    try {
      const token = await getToken();
      const res = await fetch(`${BASE}/api/wallet/gifts`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data: Gift[] = await res.json();
        setGifts(data);
        
        // Calculate stats
        let totalValue = 0;
        const giftPrices: Record<string, number> = {
          rose: 25, star: 30, fire: 50, rocket: 75, crown: 100,
          rainbow: 150, diamond: 200, trophy: 500,
        };
        data.forEach(g => { totalValue += giftPrices[g.giftId] || 0; });
        setStats({ giftCount: data.length, giftsValue: totalValue });
      }
    } catch (e) {
      toast({ title: "Failed to load gifts", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  function formatDate(dateStr: string) {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: date.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined });
  }

  const giftGroups = gifts.reduce((acc, gift) => {
    const key = gift.giftId;
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="min-h-screen bg-[#0b1020] text-slate-100 flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10 bg-[#13182b]/95 backdrop-blur-xl shrink-0">
        <button onClick={() => setLocation("/chats")} className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-white/10 transition-colors">
          <ArrowLeft size={18} />
        </button>
        <h1 className="font-bold text-lg text-slate-100">Gift Inventory</h1>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="animate-pulse text-slate-400">Loading gifts...</div>
          </div>
        ) : (
          <>
            {/* Stats */}
            {stats && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="grid grid-cols-2 gap-3"
              >
                <div className="bg-gradient-to-br from-fuchsia-500/20 to-purple-600/10 border border-fuchsia-500/30 rounded-2xl p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Gift size={16} className="text-fuchsia-300" />
                    <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Total Gifts</p>
                  </div>
                  <p className="text-3xl font-black text-white">{stats.giftCount}</p>
                </div>
                <div className="bg-gradient-to-br from-yellow-500/20 to-orange-600/10 border border-yellow-500/30 rounded-2xl p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Cake size={16} className="text-yellow-300" />
                    <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Value</p>
                  </div>
                  <p className="text-3xl font-black text-white">⚡{stats.giftsValue}</p>
                </div>
              </motion.div>
            )}

            {/* Gift Summary */}
            {Object.keys(giftGroups).length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-white/6 border border-white/10 rounded-2xl p-4"
              >
                <h3 className="text-sm font-bold text-slate-100 mb-3">Your Collection</h3>
                <div className="grid grid-cols-4 gap-3">
                  {Object.entries(giftGroups).map(([giftId, count]) => {
                    const gift = GIFTS_CATALOG[giftId];
                    return (
                      <motion.div
                        key={giftId}
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="flex flex-col items-center gap-1.5 bg-white/5 rounded-xl p-2.5 hover:bg-white/10 transition-colors"
                      >
                        <div className="text-3xl">{gift?.emoji}</div>
                        <div className="flex flex-col items-center gap-0.5">
                          <p className="text-[10px] text-slate-300 font-semibold text-center">{gift?.name}</p>
                          <p className="text-sm font-bold text-fuchsia-300">×{count}</p>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </motion.div>
            )}

            {/* Gifts List */}
            {gifts.length > 0 ? (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="space-y-2"
              >
                <h3 className="text-sm font-bold text-slate-100">Recent Gifts</h3>
                <div className="space-y-2">
                  {gifts.map((gift, i) => {
                    const giftInfo = GIFTS_CATALOG[gift.giftId];
                    return (
                      <motion.div
                        key={gift.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.05 }}
                        className="bg-white/6 border border-white/10 rounded-xl p-3 hover:bg-white/10 transition-colors"
                      >
                        <div className="flex items-start gap-3">
                          {/* Avatar */}
                          <img
                            src={gift.fromUser.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${gift.fromUser.username}`}
                            alt={gift.fromUser.displayName}
                            className="w-10 h-10 rounded-full object-cover ring-2 ring-white/10"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="text-lg">{giftInfo?.emoji}</span>
                              <p className="text-sm font-semibold text-slate-100">
                                {gift.fromUser.displayName} sent {giftInfo?.name}
                              </p>
                            </div>
                            {gift.message && (
                              <p className="text-xs text-slate-300 mb-1.5 line-clamp-2">"{gift.message}"</p>
                            )}
                            <p className="text-[10px] text-slate-500">{formatDate(gift.createdAt)}</p>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col items-center justify-center gap-4 py-16 text-slate-400 text-center"
              >
                <div className="w-16 h-16 bg-white/6 rounded-2xl flex items-center justify-center">
                  <Gift size={32} className="text-slate-500" />
                </div>
                <div>
                  <p className="font-semibold text-slate-100">No gifts yet</p>
                  <p className="text-sm mt-1">When people send you gifts, they'll appear here</p>
                </div>
              </motion.div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
