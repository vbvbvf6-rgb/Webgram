import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useClerk, useUser } from "@clerk/react";
import {
  ArrowLeft, Save, LogOut, Camera, User, AtSign, FileText, Link,
  Bell, BellOff, Shield, Palette, Volume2, VolumeX, Eye, EyeOff,
  Trash2, HardDrive, Info, ChevronRight, Check, Moon, Sun,
  Smartphone, Globe, Lock, Download, Star, MessageSquare, Bug, LifeBuoy,
} from "lucide-react";
import { useGetMe, useUpdateMe, getGetMeQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";

function Avatar({ src, name, size = 80 }: { src?: string | null; name: string; size?: number }) {
  const hue = (name.charCodeAt(0) * 37 + (name.charCodeAt(1) || 0) * 17) % 360;
  const initials = name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
  return src ? (
    <img src={src} alt={name} className="rounded-full object-cover ring-4 ring-primary/20" style={{ width: size, height: size }} />
  ) : (
    <div className="rounded-full flex items-center justify-center text-white font-bold ring-4 ring-primary/20" style={{ width: size, height: size, background: `hsl(${hue},65%,50%)`, fontSize: size * 0.35 }}>
      {initials || "?"}
    </div>
  );
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <motion.button
      onClick={() => onChange(!value)}
      className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${value ? "bg-primary" : "bg-accent"}`}
    >
      <motion.span
        animate={{ x: value ? 20 : 2 }}
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
        className="absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm block"
      />
    </motion.button>
  );
}

function SettingRow({ icon: Icon, label, description, children, onClick, danger }: {
  icon: any; label: string; description?: string; children?: React.ReactNode; onClick?: () => void; danger?: boolean;
}) {
  const Wrapper = onClick ? "button" : "div";
  return (
    <Wrapper
      {...(onClick ? { onClick } : {})}
      className={`w-full flex items-center gap-3 px-4 py-3.5 hover:bg-accent/50 transition-colors ${onClick ? "cursor-pointer" : ""}`}
    >
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${danger ? "bg-red-500/10" : "bg-accent"}`}>
        <Icon size={16} className={danger ? "text-red-400" : "text-primary"} />
      </div>
      <div className="flex-1 min-w-0 text-left">
        <p className={`text-sm font-medium ${danger ? "text-red-400" : ""}`}>{label}</p>
        {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
      </div>
      {children || (onClick && <ChevronRight size={14} className="text-muted-foreground" />)}
    </Wrapper>
  );
}

function getAccountId() {
  return localStorage.getItem("pulse_active_account") || "default";
}

function getAccounts() {
  try {
    return JSON.parse(localStorage.getItem("pulse_accounts") || "[]") as string[];
  } catch {
    return [];
  }
}

function saveCurrentAccount() {
  const id = getAccountId();
  const accounts = getAccounts();
  if (!accounts.includes(id) && accounts.length < 3) {
    accounts.push(id);
    localStorage.setItem("pulse_accounts", JSON.stringify(accounts));
  }
  localStorage.setItem("pulse_session_" + id, JSON.stringify({ lastSeen: Date.now() }));
}

function getAccountLabel(id: string) {
  if (id === "default") return "Account";
  return `Account ${id.slice(-4)}`;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-0">
      <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest px-4 pb-2">{title}</p>
      <div className="bg-card border border-border rounded-2xl overflow-hidden divide-y divide-border/50">
        {children}
      </div>
    </motion.div>
  );
}

const ACCENT_COLORS = [
  { name: "Violet", value: "#8B5CF6" },
  { name: "Indigo", value: "#6366F1" },
  { name: "Blue", value: "#3B82F6" },
  { name: "Teal", value: "#14B8A6" },
  { name: "Green", value: "#22C55E" },
  { name: "Pink", value: "#EC4899" },
  { name: "Orange", value: "#F59E0B" },
  { name: "Red", value: "#EF4444" },
];

type SettingsTab = "profile" | "notifications" | "appearance" | "privacy" | "calls" | "storage" | "about";

const TABS: { id: SettingsTab; label: string; icon: any }[] = [
  { id: "profile", label: "Profile", icon: User },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "privacy", label: "Privacy", icon: Shield },
  { id: "calls", label: "Calls", icon: MessageSquare },
  { id: "storage", label: "Storage", icon: HardDrive },
  { id: "about", label: "About", icon: Info },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function hexToHSL(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

function applyAccentColor(hex: string) {
  const hsl = hexToHSL(hex);
  const root = document.documentElement;
  root.style.setProperty("--primary", hsl);
  root.style.setProperty("--ring", hsl);
  root.style.setProperty("--sidebar-primary", hsl);
  root.style.setProperty("--sidebar-ring", hsl);
}

export default function SettingsPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { signOut } = useClerk();
  const { user: clerkUser } = useUser();
  const qc = useQueryClient();
  const { data: me, isLoading } = useGetMe();
  const updateMe = useUpdateMe();
  const m = me as any;

  const [activeTab, setActiveTab] = useState<SettingsTab>("profile");
  const [appliedTabs, setAppliedTabs] = useState<Record<SettingsTab, boolean>>({
    profile: true,
    notifications: false,
    appearance: false,
    privacy: false,
    calls: false,
    storage: false,
    about: false,
  });

  // Profile fields
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [dirty, setDirty] = useState(false);

  // Notifications
  const [notifMessages, setNotifMessages] = useState(true);
  const [notifSounds, setNotifSounds] = useState(true);
  const [notifReactions, setNotifReactions] = useState(true);
  const [notifGroupMentions, setNotifGroupMentions] = useState(true);
  const [notifNewChats, setNotifNewChats] = useState(false);
  const [notifCalls, setNotifCalls] = useState(true);
  const [doNotDisturb, setDoNotDisturb] = useState(false);

  // Appearance
  const [accentColor, setAccentColor] = useState("#8B5CF6");
  const [fontSize, setFontSize] = useState<"small" | "medium" | "large">("medium");
  const [bubbleStyle, setBubbleStyle] = useState<"rounded" | "sharp" | "bubble">("rounded");
  const [showAvatars, setShowAvatars] = useState(true);
  const [compactMode, setCompactMode] = useState(false);
  const [animationsEnabled, setAnimationsEnabled] = useState(true);

  // Privacy
  const [readReceipts, setReadReceipts] = useState(true);
  const [lastSeen, setLastSeen] = useState<"everyone" | "contacts" | "nobody">("everyone");
  const [onlineStatus, setOnlineStatus] = useState(true);
  const [screenshotAlerts, setScreenshotAlerts] = useState(false);

  // Calls
  const [noiseCancellation, setNoiseCancellation] = useState(true);
  const [autoAnswerAfterSecs, setAutoAnswerAfterSecs] = useState<number | null>(null);
  const [ringtone, setRingtone] = useState("default");
  const [bugTitle, setBugTitle] = useState("");
  const [bugDetails, setBugDetails] = useState("");
  const [supportTitle, setSupportTitle] = useState("");
  const [supportDetails, setSupportDetails] = useState("");

  // Load saved accent on mount
  useEffect(() => {
    const saved = localStorage.getItem("pulse_accent");
    if (saved) applyAccentColor(saved);
  }, []);

  useEffect(() => {
    saveCurrentAccount();
  }, []);

  useEffect(() => {
    const savedAccent = localStorage.getItem("pulse_accent");
    if (savedAccent) setAccentColor(savedAccent);
    const savedFontSize = localStorage.getItem("pulse_font_size");
    if (savedFontSize === "small" || savedFontSize === "medium" || savedFontSize === "large") setFontSize(savedFontSize);
    const savedBubble = localStorage.getItem("pulse_bubble");
    if (savedBubble === "rounded" || savedBubble === "sharp" || savedBubble === "bubble") setBubbleStyle(savedBubble);
    setShowAvatars(localStorage.getItem("pulse_show_avatars") !== "false");
    setCompactMode(localStorage.getItem("pulse_compact") === "true");
    setAnimationsEnabled(localStorage.getItem("pulse_animations") !== "false");
    // Notifications
    setNotifMessages(localStorage.getItem("pulse_notif_messages") !== "false");
    setNotifSounds(localStorage.getItem("pulse_notif_sounds") !== "false");
    setDoNotDisturb(localStorage.getItem("pulse_dnd") === "true");
    setNotifReactions(localStorage.getItem("pulse_notif_reactions") !== "false");
    setNotifGroupMentions(localStorage.getItem("pulse_notif_mentions") !== "false");
    setNotifNewChats(localStorage.getItem("pulse_notif_new_chats") === "true");
    setNotifCalls(localStorage.getItem("pulse_notif_calls") !== "false");
    // Privacy
    setReadReceipts(localStorage.getItem("pulse_read_receipts") !== "false");
    const savedSeen = localStorage.getItem("pulse_last_seen");
    if (savedSeen === "everyone" || savedSeen === "contacts" || savedSeen === "nobody") setLastSeen(savedSeen);
    setOnlineStatus(localStorage.getItem("pulse_online_status") !== "false");
    setScreenshotAlerts(localStorage.getItem("pulse_screenshot_alerts") === "true");
    // Calls
    setNoiseCancellation(localStorage.getItem("pulse_noise_cancel") !== "false");
    const savedAuto = localStorage.getItem("pulse_auto_answer");
    setAutoAnswerAfterSecs(savedAuto ? Number(savedAuto) : null);
    setRingtone(localStorage.getItem("pulse_ringtone") || "default");
  }, []);

  useEffect(() => {
    if (me) {
      setDisplayName(m.displayName || "");
      setUsername(m.username || "");
      setBio(m.bio || "");
      setAvatarUrl(m.avatarUrl || "");
      setDirty(false);
    }
  }, [me]);

  const mark = (fn: (v: string) => void) => (v: string) => { fn(v); setDirty(true); };

  async function handleSave() {
    try {
      await updateMe.mutateAsync({ data: { displayName, username, bio: bio || null, avatarUrl: avatarUrl || null } });
      qc.invalidateQueries({ queryKey: getGetMeQueryKey() });
      toast({ title: "Profile saved ✓" });
      setDirty(false);
    } catch {
      toast({ title: "Failed to save", variant: "destructive" });
    }
  }

  function applyTab(tab: SettingsTab) {
    if (tab === "appearance") {
      applyAccentColor(accentColor);
      localStorage.setItem("pulse_accent", accentColor);
      localStorage.setItem("pulse_font_size", fontSize);
      localStorage.setItem("pulse_bubble", bubbleStyle);
      localStorage.setItem("pulse_show_avatars", String(showAvatars));
      localStorage.setItem("pulse_compact", String(compactMode));
      localStorage.setItem("pulse_animations", String(animationsEnabled));
      const fontSizeMap = { small: "13px", medium: "15px", large: "17px" } as const;
      document.documentElement.style.fontSize = fontSizeMap[fontSize];
    } else if (tab === "notifications") {
      localStorage.setItem("pulse_notif_messages", String(notifMessages));
      localStorage.setItem("pulse_notif_sounds", String(notifSounds));
      localStorage.setItem("pulse_dnd", String(doNotDisturb));
    } else if (tab === "privacy") {
      localStorage.setItem("pulse_read_receipts", String(readReceipts));
      localStorage.setItem("pulse_last_seen", lastSeen);
      localStorage.setItem("pulse_online_status", String(onlineStatus));
      localStorage.setItem("pulse_screenshot_alerts", String(screenshotAlerts));
    } else if (tab === "calls") {
      localStorage.setItem("pulse_noise_cancel", String(noiseCancellation));
      localStorage.setItem("pulse_ringtone", ringtone);
      if (autoAnswerAfterSecs !== null) localStorage.setItem("pulse_auto_answer", String(autoAnswerAfterSecs));
      else localStorage.removeItem("pulse_auto_answer");
    }
    setAppliedTabs(prev => ({ ...prev, [tab]: true }));
    toast({ title: `${TABS.find(t => t.id === tab)?.label || "Settings"} applied ✓` });
  }

  function sendIssue(kind: "bug" | "support") {
    const title = kind === "bug" ? bugTitle.trim() : supportTitle.trim();
    const details = kind === "bug" ? bugDetails.trim() : supportDetails.trim();
    if (!title || !details) {
      toast({ title: kind === "bug" ? "Add bug title and details" : "Add a question and details", variant: "destructive" });
      return;
    }
    toast({ title: kind === "bug" ? "Bug report sent" : "Support request sent" });
    if (kind === "bug") { setBugTitle(""); setBugDetails(""); } else { setSupportTitle(""); setSupportDetails(""); }
  }

  const previewAvatar = avatarUrl || m?.avatarUrl;
  const previewName = displayName || m?.displayName || "Me";
  const accounts = getAccounts();

  return (
    <div className="min-h-screen bg-background flex flex-col pb-16 md:pb-0">
      {/* Header */}
      <div className="sticky top-0 z-20 flex items-center gap-3 px-4 py-3 border-b border-border bg-sidebar/80 backdrop-blur-xl">
        <button onClick={() => setLocation("/chats")} className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-accent transition-colors">
          <ArrowLeft size={18} />
        </button>
        <h1 className="font-bold text-lg">Settings</h1>
        {dirty && <span className="ml-auto text-xs text-primary font-medium animate-pulse">Unsaved</span>}
      </div>

      <div className="flex flex-col md:flex-row max-w-4xl mx-auto w-full flex-1">
        {/* Sidebar tabs - horizontal on mobile, vertical on desktop */}
        <div className="md:w-56 shrink-0 border-b md:border-b-0 md:border-r border-border">
          <div className="flex md:flex-col gap-1 px-2 py-2 md:py-4 overflow-x-auto">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all shrink-0 ${activeTab === tab.id ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-accent/50"}`}
              >
                <tab.icon size={16} />
                <span className="hidden md:inline">{tab.label}</span>
                {appliedTabs[tab.id] && <Check size={12} className="ml-1 text-primary" />}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 px-4 py-6 space-y-6 overflow-y-auto">
          <AnimatePresence mode="wait">

            {activeTab === "profile" && (
              <motion.div key="profile" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="space-y-6">
                {/* Avatar */}
                <div className="flex flex-col items-center gap-4 pb-4">
                  {isLoading ? (
                    <div className="w-24 h-24 bg-accent rounded-full animate-pulse" />
                  ) : (
                    <div className="relative">
                      <Avatar src={previewAvatar} name={previewName} size={96} />
                      <div className="absolute bottom-0 right-0 w-8 h-8 bg-primary rounded-full flex items-center justify-center ring-2 ring-background cursor-pointer hover:bg-primary/90 transition-colors">
                        <Camera size={14} className="text-white" />
                      </div>
                    </div>
                  )}
                  <div className="text-center">
                    <p className="font-bold text-lg">{previewName}</p>
                    <p className="text-sm text-muted-foreground">@{username || m?.username || "username"}</p>
                    {bio && <p className="text-xs text-muted-foreground mt-1 max-w-xs">{bio}</p>}
                  </div>
                  {clerkUser?.imageUrl && (
                    <button onClick={() => { setDisplayName(clerkUser.fullName || clerkUser.firstName || ""); setAvatarUrl(clerkUser.imageUrl || ""); setDirty(true); }} className="text-xs text-primary underline-offset-2 hover:underline">
                      Sync from account
                    </button>
                  )}
                </div>

                <div className="space-y-4">
                  {[
                    { icon: User, label: "Display Name", value: displayName, setter: mark(setDisplayName), placeholder: "Your name" },
                  ].map(f => (
                    <div key={f.label}>
                      <label className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5"><f.icon size={11} />{f.label}</label>
                      <input value={f.value} onChange={e => f.setter(e.target.value)} placeholder={f.placeholder} className="w-full bg-card border border-border rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 ring-primary/40 transition-all placeholder:text-muted-foreground" />
                    </div>
                  ))}
                  <div>
                    <label className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5"><AtSign size={11} />Username</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium">@</span>
                      <input value={username} onChange={e => mark(setUsername)(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))} placeholder="username" className="w-full bg-card border border-border rounded-xl pl-8 pr-4 py-3 text-sm outline-none focus:ring-2 ring-primary/40 transition-all placeholder:text-muted-foreground" />
                    </div>
                  </div>
                  <div>
                    <label className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5"><FileText size={11} />Bio</label>
                    <textarea value={bio} onChange={e => mark(setBio)(e.target.value)} placeholder="Tell people about yourself..." rows={3} maxLength={200} className="w-full bg-card border border-border rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 ring-primary/40 transition-all resize-none placeholder:text-muted-foreground" />
                    <p className="text-[10px] text-muted-foreground text-right mt-1">{bio.length}/200</p>
                  </div>
                  <div>
                    <label className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5"><Link size={11} />Avatar URL</label>
                    <input value={avatarUrl} onChange={e => mark(setAvatarUrl)(e.target.value)} placeholder="https://..." className="w-full bg-card border border-border rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 ring-primary/40 transition-all placeholder:text-muted-foreground" />
                    {avatarUrl && (
                      <div className="flex items-center gap-3 mt-2 bg-accent/40 rounded-xl p-2.5">
                        <img src={avatarUrl} alt="" className="w-10 h-10 rounded-full object-cover" onError={e => (e.currentTarget.style.display = "none")} />
                        <p className="text-xs text-muted-foreground">Preview</p>
                      </div>
                    )}
                  </div>
                  <button onClick={handleSave} disabled={!dirty || updateMe.isPending} className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground rounded-xl py-3.5 font-bold text-sm hover:bg-primary/90 transition-colors disabled:opacity-40 shadow-lg shadow-primary/20">
                    <Save size={16} />
                    {updateMe.isPending ? "Saving…" : "Save profile"}
                  </button>
                </div>

                <div className="border-t border-border pt-4 space-y-3">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Account</p>
                  <div className="bg-card border border-border rounded-xl p-3 space-y-2">
                    <p className="text-xs text-muted-foreground">Saved on this device: {accounts.length}/3</p>
                    <div className="flex flex-wrap gap-2">
                      {accounts.map(id => (
                        <button
                          key={id}
                          onClick={() => {
                            localStorage.setItem("pulse_active_account", id);
                            window.location.reload();
                          }}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${getAccountId() === id ? "bg-primary text-primary-foreground" : "bg-accent text-foreground"}`}
                        >
                          {getAccountLabel(id)}
                        </button>
                      ))}
                    </div>
                  </div>
                  {clerkUser && (
                    <div className="flex items-center gap-3 bg-card border border-border rounded-xl p-4">
                      <div className="w-9 h-9 bg-accent rounded-xl flex items-center justify-center"><Globe size={16} className="text-primary" /></div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{clerkUser.primaryEmailAddress?.emailAddress}</p>
                        <p className="text-xs text-muted-foreground">Signed in with Clerk</p>
                      </div>
                    </div>
                  )}
                  <button onClick={() => {
                    signOut();
                  }} className="w-full flex items-center justify-center gap-2 border border-red-500/30 text-red-400 rounded-xl py-3 font-semibold text-sm hover:bg-red-500/8 transition-colors">
                    <LogOut size={15} />Sign out
                  </button>
                </div>
              </motion.div>
            )}

            {activeTab === "notifications" && (
              <motion.div key="notifs" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="space-y-6">
                <div>
                  <p className="font-bold text-base mb-1">Notifications</p>
                  <p className="text-sm text-muted-foreground">Control what you're notified about</p>
                </div>
                <div className="bg-card border border-border/80 rounded-2xl overflow-hidden divide-y divide-border/50 p-0">
                  <SettingRow icon={BellOff} label="Do Not Disturb" description="Silence all notifications">
                    <Toggle value={doNotDisturb} onChange={v => { setDoNotDisturb(v); localStorage.setItem("pulse_dnd", String(v)); }} />
                  </SettingRow>
                  <SettingRow icon={MessageSquare} label="Message notifications" description="New messages from chats">
                    <Toggle value={notifMessages} onChange={v => { setNotifMessages(v); localStorage.setItem("pulse_notif_messages", String(v)); }} />
                  </SettingRow>
                  <SettingRow icon={Volume2} label="Notification sounds" description="Play sounds for notifications">
                    <Toggle value={notifSounds} onChange={v => { setNotifSounds(v); localStorage.setItem("pulse_notif_sounds", String(v)); }} />
                  </SettingRow>
                  <SettingRow icon={Star} label="Reactions" description="When someone reacts to your message">
                    <Toggle value={notifReactions} onChange={v => { setNotifReactions(v); localStorage.setItem("pulse_notif_reactions", String(v)); }} />
                  </SettingRow>
                  <SettingRow icon={Bell} label="Group mentions" description="When someone @mentions you">
                    <Toggle value={notifGroupMentions} onChange={v => { setNotifGroupMentions(v); localStorage.setItem("pulse_notif_mentions", String(v)); }} />
                  </SettingRow>
                  <SettingRow icon={MessageSquare} label="New conversations" description="When someone starts a new chat">
                    <Toggle value={notifNewChats} onChange={v => { setNotifNewChats(v); localStorage.setItem("pulse_notif_new_chats", String(v)); }} />
                  </SettingRow>
                  <SettingRow icon={Bell} label="Calls" description="Incoming call notifications">
                    <Toggle value={notifCalls} onChange={v => { setNotifCalls(v); localStorage.setItem("pulse_notif_calls", String(v)); }} />
                  </SettingRow>
                </div>
                <div className="flex items-center gap-2 text-xs text-green-400 bg-green-500/10 border border-green-500/20 rounded-xl px-4 py-2.5">
                  <Check size={13} />Changes save automatically
                </div>

                <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4 text-sm text-muted-foreground">
                  <p className="font-medium text-foreground mb-1">📱 Push notifications</p>
                  <p className="text-xs">Enable browser notifications to receive alerts even when Droidgram is in the background.</p>
                  <button onClick={() => Notification.requestPermission().then(p => toast({ title: p === "granted" ? "Notifications enabled ✓" : "Permission denied" }))} className="mt-3 text-xs bg-primary text-primary-foreground rounded-lg px-4 py-2 font-semibold hover:bg-primary/90 transition-colors">
                    Enable push notifications
                  </button>
                </div>
              </motion.div>
            )}

            {activeTab === "appearance" && (
              <motion.div key="appearance" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="space-y-6">
                <div>
                  <p className="font-bold text-base mb-1">Appearance</p>
                  <p className="text-sm text-muted-foreground">Customize how Droidgram looks</p>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Accent color</p>
                  <div className="flex flex-wrap gap-3">
                    {ACCENT_COLORS.map(c => (
                      <button
                        key={c.value}
                        onClick={() => setAccentColor(c.value)}
                        className="relative w-10 h-10 rounded-xl transition-transform hover:scale-110"
                        style={{ background: c.value }}
                        title={c.name}
                      >
                        {accentColor === c.value && (
                          <Check size={14} className="absolute inset-0 m-auto text-white" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Font size</p>
                  <div className="flex gap-2">
                    {(["small", "medium", "large"] as const).map(s => (
                      <button key={s} onClick={() => setFontSize(s)} className={`flex-1 py-2.5 rounded-xl text-sm font-medium border transition-all ${fontSize === s ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/40"}`}>
                        {s === "small" ? "A" : s === "medium" ? "A" : "A"}
                        <span className="block text-[10px] capitalize mt-0.5">{s}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Message bubbles</p>
                  <div className="flex gap-2">
                    {(["rounded", "sharp", "bubble"] as const).map(s => (
                      <button key={s} onClick={() => setBubbleStyle(s)} className={`flex-1 py-2.5 rounded-xl text-xs font-medium border transition-all capitalize ${bubbleStyle === s ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/40"}`}>
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="bg-card border border-border/80 rounded-2xl overflow-hidden divide-y divide-border/50">
                  <SettingRow icon={User} label="Show avatars" description="Display profile pictures in chat">
                    <Toggle value={showAvatars} onChange={v => { setShowAvatars(v); localStorage.setItem("pulse_show_avatars", String(v)); }} />
                  </SettingRow>
                  <SettingRow icon={Smartphone} label="Compact mode" description="Reduce spacing between messages">
                    <Toggle value={compactMode} onChange={v => { setCompactMode(v); localStorage.setItem("pulse_compact", String(v)); }} />
                  </SettingRow>
                  <SettingRow icon={Star} label="Animations" description="Enable message enter animations">
                    <Toggle value={animationsEnabled} onChange={v => { setAnimationsEnabled(v); localStorage.setItem("pulse_animations", String(v)); }} />
                  </SettingRow>
                </div>
                <button onClick={() => applyTab("appearance")} className="w-full bg-primary text-primary-foreground rounded-xl py-3 font-semibold text-sm hover:bg-primary/90 transition-colors">Apply appearance</button>
              </motion.div>
            )}

            {activeTab === "privacy" && (
              <motion.div key="privacy" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="space-y-6">
                <div>
                  <p className="font-bold text-base mb-1">Privacy</p>
                  <p className="text-sm text-muted-foreground">Control your visibility and data</p>
                </div>

                <div className="bg-card border border-border/80 rounded-2xl overflow-hidden divide-y divide-border/50">
                  <SettingRow icon={Check} label="Read receipts" description="Show when you've read messages">
                    <Toggle value={readReceipts} onChange={v => { setReadReceipts(v); localStorage.setItem("pulse_read_receipts", String(v)); }} />
                  </SettingRow>
                  <SettingRow icon={Eye} label="Online status" description="Show when you're active">
                    <Toggle value={onlineStatus} onChange={v => { setOnlineStatus(v); localStorage.setItem("pulse_online_status", String(v)); }} />
                  </SettingRow>
                  <SettingRow icon={EyeOff} label="Screenshot alerts" description="Notify when someone screenshots">
                    <Toggle value={screenshotAlerts} onChange={v => { setScreenshotAlerts(v); localStorage.setItem("pulse_screenshot_alerts", String(v)); }} />
                  </SettingRow>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Last seen</p>
                  <div className="bg-card border border-border/80 rounded-2xl overflow-hidden divide-y divide-border/50">
                    {(["everyone", "contacts", "nobody"] as const).map(opt => (
                      <button key={opt} onClick={() => { setLastSeen(opt); localStorage.setItem("pulse_last_seen", opt); }} className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-accent/50 transition-colors">
                        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${lastSeen === opt ? "border-primary" : "border-muted-foreground/40"}`}>
                          {lastSeen === opt && <div className="w-2 h-2 rounded-full bg-primary" />}
                        </div>
                        <span className="text-sm capitalize">{opt}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="bg-card border border-border/80 rounded-2xl overflow-hidden divide-y divide-border/50">
                  <SettingRow icon={Lock} label="Two-factor auth" description="Add extra security to your account" onClick={() => toast({ title: "Managed by your Clerk account" })} />
                  <SettingRow icon={Download} label="Export my data" description="Download a copy of your data" onClick={() => toast({ title: "Data export requested" })} />
                  <SettingRow icon={Trash2} label="Delete account" description="Permanently delete your account" onClick={() => toast({ title: "Contact support to delete your account", variant: "destructive" })} danger />
                </div>
                <button onClick={() => applyTab("privacy")} className="w-full bg-primary text-primary-foreground rounded-xl py-3 font-semibold text-sm hover:bg-primary/90 transition-colors">Apply privacy</button>
              </motion.div>
            )}

            {activeTab === "calls" && (
              <motion.div key="calls" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="space-y-6">
                <div>
                  <p className="font-bold text-base mb-1">Calls</p>
                  <p className="text-sm text-muted-foreground">Configure voice and video call settings</p>
                </div>
                <div className="bg-card border border-border/80 rounded-2xl overflow-hidden divide-y divide-border/50">
                  <SettingRow icon={Volume2} label="Noise cancellation" description="Reduce background noise during calls">
                    <Toggle value={noiseCancellation} onChange={v => { setNoiseCancellation(v); localStorage.setItem("pulse_noise_cancel", String(v)); }} />
                  </SettingRow>
                  <SettingRow icon={MessageSquare} label="Call ringtone" description={`Current: ${ringtone}`} onClick={() => {
                    const opts = ["default", "subtle", "classic", "pulse"];
                    const next = opts[(opts.indexOf(ringtone) + 1) % opts.length];
                    setRingtone(next);
                    localStorage.setItem("pulse_ringtone", next);
                    toast({ title: `Ringtone: ${next}` });
                  }} />
                  <SettingRow icon={Bell} label="Auto-answer" description="Auto-answer calls after 10 seconds">
                    <Toggle value={autoAnswerAfterSecs !== null} onChange={v => {
                      const val = v ? 10 : null;
                      setAutoAnswerAfterSecs(val);
                      if (val !== null) localStorage.setItem("pulse_auto_answer", String(val));
                      else localStorage.removeItem("pulse_auto_answer");
                    }} />
                  </SettingRow>
                </div>
                <div className="flex items-center gap-2 text-xs text-green-400 bg-green-500/10 border border-green-500/20 rounded-xl px-4 py-2.5">
                  <Check size={13} />Changes save automatically
                </div>
                <div className="bg-accent/30 border border-border rounded-2xl p-4 text-sm">
                  <p className="font-semibold mb-2 flex items-center gap-2"><Info size={14} className="text-primary" />Permissions</p>
                  <p className="text-xs text-muted-foreground mb-3">Droidgram needs camera and microphone access for calls.</p>
                  <button onClick={() => navigator.mediaDevices?.getUserMedia({ audio: true, video: true }).then(s => { s.getTracks().forEach(t => t.stop()); toast({ title: "Camera & mic access granted ✓" }); }).catch(() => toast({ title: "Please allow access in browser settings", variant: "destructive" }))} className="text-xs bg-primary text-primary-foreground rounded-lg px-4 py-2 font-semibold hover:bg-primary/90 transition-colors">
                    Test camera & microphone
                  </button>
                </div>
              </motion.div>
            )}

            {activeTab === "storage" && (
              <motion.div key="storage" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="space-y-6">
                <div>
                  <p className="font-bold text-base mb-1">Storage & Data</p>
                  <p className="text-sm text-muted-foreground">Manage cached data and storage</p>
                </div>
                <div className="bg-card border border-border/80 rounded-2xl p-4 space-y-3">
                  {[
                    { label: "Photos & videos", size: "12.4 MB", color: "bg-blue-500" },
                    { label: "Voice messages", size: "3.1 MB", color: "bg-green-500" },
                    { label: "Documents", size: "8.7 MB", color: "bg-orange-500" },
                    { label: "App cache", size: "2.3 MB", color: "bg-purple-500" },
                  ].map(item => (
                    <div key={item.label} className="flex items-center gap-3">
                      <div className={`w-2.5 h-2.5 rounded-full ${item.color}`} />
                      <span className="text-sm flex-1">{item.label}</span>
                      <span className="text-sm text-muted-foreground font-medium">{item.size}</span>
                    </div>
                  ))}
                  <div className="h-px bg-border" />
                  <div className="flex justify-between text-sm font-semibold">
                    <span>Total</span>
                    <span>26.5 MB</span>
                  </div>
                </div>
                <div className="bg-card border border-border/80 rounded-2xl overflow-hidden divide-y divide-border/50">
                  <SettingRow icon={Trash2} label="Clear app cache" description="Free up 2.3 MB" onClick={() => toast({ title: "Cache cleared ✓" })} />
                  <SettingRow icon={Download} label="Auto-download media" description="Wi-Fi only" onClick={() => toast({ title: "Changed to Wi-Fi only" })} />
                  <SettingRow icon={HardDrive} label="Media storage location" description="Internal storage" onClick={() => {}} />
                </div>
                <button onClick={() => applyTab("storage")} className="w-full bg-primary text-primary-foreground rounded-xl py-3 font-semibold text-sm hover:bg-primary/90 transition-colors">Apply storage</button>
              </motion.div>
            )}

            {activeTab === "about" && (
              <motion.div key="about" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="space-y-6">
                <div className="flex flex-col items-center gap-4 py-6">
                  <div className="w-20 h-20 bg-gradient-to-br from-primary to-indigo-500 rounded-3xl flex items-center justify-center shadow-xl shadow-primary/20">
                    <MessageSquare size={36} className="text-white" />
                  </div>
                  <div className="text-center">
                    <h2 className="font-black text-2xl">Droidgram</h2>
                    <p className="text-sm text-muted-foreground">Version 1.0.0</p>
                    <p className="text-xs text-muted-foreground mt-1">Real-time messaging, reimagined</p>
                  </div>
                </div>
                <div className="bg-card border border-border/80 rounded-2xl overflow-hidden divide-y divide-border/50">
                  <SettingRow icon={Star} label="Rate Droidgram" description="Leave a review" onClick={() => toast({ title: "Thanks for rating! ⭐" })} />
                  <SettingRow icon={Globe} label="Website" description="pulse.app" onClick={() => {}} />
                  <SettingRow icon={Shield} label="Privacy Policy" onClick={() => {}} />
                  <SettingRow icon={FileText} label="Terms of Service" onClick={() => {}} />
                  <SettingRow icon={Info} label="Open source licenses" onClick={() => {}} />
                </div>
                <button onClick={() => applyTab("about")} className="w-full bg-primary text-primary-foreground rounded-xl py-3 font-semibold text-sm hover:bg-primary/90 transition-colors">Apply about</button>
                <div className="grid gap-4">
                  <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <Bug size={16} className="text-primary" />
                      <h3 className="font-semibold">Report bugs</h3>
                    </div>
                    <input value={bugTitle} onChange={e => setBugTitle(e.target.value)} placeholder="Bug title" className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm outline-none" />
                    <textarea value={bugDetails} onChange={e => setBugDetails(e.target.value)} placeholder="What happened? Steps to reproduce..." rows={3} className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm outline-none resize-none" />
                    <button onClick={() => sendIssue("bug")} className="w-full bg-primary text-primary-foreground rounded-xl py-3 font-semibold text-sm hover:bg-primary/90 transition-colors">Send bug report</button>
                  </div>
                  <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <LifeBuoy size={16} className="text-primary" />
                      <h3 className="font-semibold">Support</h3>
                    </div>
                    <input value={supportTitle} onChange={e => setSupportTitle(e.target.value)} placeholder="Question topic" className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm outline-none" />
                    <textarea value={supportDetails} onChange={e => setSupportDetails(e.target.value)} placeholder="Write your question for support..." rows={3} className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm outline-none resize-none" />
                    <button onClick={() => sendIssue("support")} className="w-full bg-primary text-primary-foreground rounded-xl py-3 font-semibold text-sm hover:bg-primary/90 transition-colors">Send to support</button>
                  </div>
                </div>
                <div className="text-center text-xs text-muted-foreground pb-4">
                  <p>Built with ❤️ using React, Express, and PostgreSQL</p>
                  <p className="mt-1">© {new Date().getFullYear()} Droidgram — All rights reserved</p>
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
