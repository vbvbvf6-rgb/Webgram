import { useState, useEffect } from "react";
import { useLocation, useRoute } from "wouter";
import { useAuth } from "@clerk/react";
import { motion } from "framer-motion";
import { ArrowLeft, Gift, Mail, Loader } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const GIFTS_CATALOG: Record<string, { name: string; emoji: string }> = {
  rose: { name: "Rose", emoji: "🌹" },
  star: { name: "Star", emoji: "⭐" },
  fire: { name: "Fire Heart", emoji: "❤️‍🔥" },
  rocket: { name: "Rocket", emoji: "🚀" },
  crown: { name: "Crown", emoji: "👑" },
  rainbow: { name: "Rainbow", emoji: "🌈" },
  diamond: { name: "Diamond", emoji: "💎" },
  trophy: { name: "Trophy", emoji: "🏆" },
};

type UserProfile = {
  id: number;
  randomId: string;
  username: string;
  displayName: string;
  avatarUrl?: string;
  bio?: string;
  isOnline: boolean;
  createdAt: string;
};

export default function UserPage() {
  const [, setLocation] = useLocation();
  const [match, params] = useRoute("/user/:id");
  const { getToken } = useAuth();
  const { toast } = useToast();

  const [user, setUser] = useState<UserProfile | null>(null);
  const [gifts, setGifts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!params?.id) return;
    loadUserProfile();
  }, [params?.id]);

  async function loadUserProfile() {
    setLoading(true);
    try {
      const token = await getToken();
      const res = await fetch(`${BASE}/api/users/${params?.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data);

        // Load gifts for this user
        const giftsRes = await fetch(`${BASE}/api/wallet/gifts?userId=${data.id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (giftsRes.ok) {
          const giftsData = await giftsRes.json();
          setGifts(giftsData);
        }
      } else {
        toast({ title: "User not found", variant: "destructive" });
        setLocation("/chats");
      }
    } catch (err) {
      toast({ title: "Failed to load user", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0b1020] text-slate-100 flex items-center justify-center">
        <Loader size={32} className="animate-spin text-fuchsia-500" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#0b1020] text-slate-100 flex items-center justify-center">
        <p className="text-slate-400">User not found</p>
      </div>
    );
  }

  const hue = (user.displayName.charCodeAt(0) * 37 + (user.displayName.charCodeAt(1) || 0) * 17) % 360;
  const avatarBg = `hsl(${hue},65%,50%)`;
  const giftGroups = gifts.reduce((acc: Record<string, number>, gift: any) => {
    acc[gift.giftId] = (acc[gift.giftId] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-[#0b1020] text-slate-100 flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10 bg-[#13182b]/95 backdrop-blur-xl">
        <button onClick={() => setLocation("/chats")} className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-white/10">
          <ArrowLeft size={18} />
        </button>
        <h1 className="font-bold text-lg">{user.displayName}</h1>
        {user.isOnline && <span className="ml-auto w-2 h-2 bg-green-400 rounded-full"></span>}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center gap-4">
          {user.avatarUrl ? (
            <img src={user.avatarUrl} alt={user.displayName} className="w-24 h-24 rounded-full object-cover ring-4 ring-fuchsia-500/20" />
          ) : (
            <div className="w-24 h-24 rounded-full flex items-center justify-center text-white font-bold text-3xl ring-4 ring-fuchsia-500/20" style={{ background: avatarBg }}>
              {user.displayName.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
            </div>
          )}
          <div className="text-center">
            <p className="font-bold text-lg">{user.displayName}</p>
            <p className="text-sm text-slate-400">@{user.username}</p>
          </div>
        </motion.div>

        {user.bio && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-white/6 border border-white/10 rounded-2xl p-4">
            <p className="text-sm text-slate-100">{user.bio}</p>
          </motion.div>
        )}

        {/* Gifts */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          <div className="flex items-center gap-2">
            <Gift size={16} className="text-fuchsia-300" />
            <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Gifts ({gifts.length})</p>
          </div>
          {gifts.length === 0 ? (
            <p className="text-xs text-slate-500">No gifts yet</p>
          ) : (
            <div className="grid grid-cols-4 gap-2">
              {Object.entries(giftGroups).map(([giftId, count]) => (
                <div
                  key={giftId}
                  className="flex flex-col items-center justify-center p-3 bg-white/6 border border-white/10 rounded-xl"
                  title={`${GIFTS_CATALOG[giftId]?.name || giftId} x${count}`}
                >
                  <span className="text-2xl mb-1">{String(GIFTS_CATALOG[giftId]?.emoji || "🎁")}</span>
                  <span className="text-xs font-bold text-fuchsia-300">×{count}</span>
                </div>
              ))}
            </div>
          )}
        </motion.div>

        {/* Message Button */}
        <motion.button
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          onClick={() => setLocation(`/chats?user=${user.id}`)}
          className="w-full flex items-center justify-center gap-2 bg-fuchsia-500 text-white rounded-xl py-3 font-bold hover:bg-fuchsia-400 transition-colors"
        >
          <Mail size={18} />
          Send Message
        </motion.button>
      </div>
    </div>
  );
}
