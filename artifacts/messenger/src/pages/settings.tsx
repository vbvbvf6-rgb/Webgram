import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useClerk, useUser } from "@clerk/react";
import { ArrowLeft, Save, LogOut, Camera, User, AtSign, FileText, Link, Moon, Bell } from "lucide-react";
import { useGetMe, useUpdateMe, getGetMeQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";

function Avatar({ src, name, size = 80 }: { src?: string | null; name: string; size?: number }) {
  const hue = (name.charCodeAt(0) * 37 + (name.charCodeAt(1) || 0) * 17) % 360;
  const bg = `hsl(${hue}, 65%, 50%)`;
  const initials = name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
  return src ? (
    <img src={src} alt={name} className="rounded-full object-cover ring-4 ring-primary/20" style={{ width: size, height: size }} />
  ) : (
    <div className="rounded-full flex items-center justify-center text-white font-bold ring-4 ring-primary/20" style={{ width: size, height: size, background: bg, fontSize: size * 0.35 }}>
      {initials || "?"}
    </div>
  );
}

function Field({ icon: Icon, label, children }: { icon: any; label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        <Icon size={12} />
        {label}
      </label>
      {children}
    </div>
  );
}

export default function SettingsPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { signOut } = useClerk();
  const { user: clerkUser } = useUser();
  const qc = useQueryClient();
  const { data: me, isLoading } = useGetMe();
  const updateMe = useUpdateMe();

  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [dirty, setDirty] = useState(false);

  const m = me as any;

  useEffect(() => {
    if (me) {
      setDisplayName(m.displayName || "");
      setUsername(m.username || "");
      setBio(m.bio || "");
      setAvatarUrl(m.avatarUrl || "");
      setDirty(false);
    }
  }, [me]);

  const markDirty = (fn: (v: string) => void) => (v: string) => { fn(v); setDirty(true); };

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

  function syncFromClerk() {
    if (!clerkUser) return;
    const name = clerkUser.fullName || clerkUser.firstName || "";
    const img = clerkUser.imageUrl || "";
    if (name) { setDisplayName(name); setDirty(true); }
    if (img) { setAvatarUrl(img); setDirty(true); }
    toast({ title: "Synced from your account" });
  }

  const previewAvatar = avatarUrl || m?.avatarUrl;
  const previewName = displayName || m?.displayName || "Me";

  return (
    <div className="min-h-screen bg-background">
      {/* Sticky header */}
      <div className="sticky top-0 z-20 flex items-center gap-3 px-4 py-3 border-b border-border bg-sidebar/80 backdrop-blur-xl">
        <button onClick={() => setLocation("/chats")} className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-accent transition-colors">
          <ArrowLeft size={18} />
        </button>
        <h1 className="font-bold">Profile & Settings</h1>
        {dirty && (
          <span className="ml-auto text-xs text-primary font-medium animate-pulse">Unsaved changes</span>
        )}
      </div>

      <div className="max-w-lg mx-auto px-4 py-8 space-y-8">
        {/* Profile card */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center gap-4"
        >
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
          {clerkUser?.imageUrl && clerkUser.imageUrl !== m?.avatarUrl && (
            <button onClick={syncFromClerk} className="text-xs text-primary underline-offset-2 hover:underline">
              Sync avatar & name from your account
            </button>
          )}
        </motion.div>

        {/* Form */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="space-y-5">
          <Field icon={User} label="Display Name">
            <input
              value={displayName}
              onChange={e => markDirty(setDisplayName)(e.target.value)}
              placeholder="Your display name"
              className="w-full bg-card border border-border rounded-xl px-4 py-3 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 ring-primary/40 transition-all"
            />
          </Field>

          <Field icon={AtSign} label="Username">
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium">@</span>
              <input
                value={username}
                onChange={e => markDirty(setUsername)(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                placeholder="username"
                className="w-full bg-card border border-border rounded-xl pl-8 pr-4 py-3 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 ring-primary/40 transition-all"
              />
            </div>
            <p className="text-[10px] text-muted-foreground">Only lowercase letters, numbers, and underscores</p>
          </Field>

          <Field icon={FileText} label="Bio">
            <textarea
              value={bio}
              onChange={e => markDirty(setBio)(e.target.value)}
              placeholder="Write something about yourself..."
              rows={3}
              maxLength={200}
              className="w-full bg-card border border-border rounded-xl px-4 py-3 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 ring-primary/40 transition-all resize-none"
            />
            <p className="text-[10px] text-muted-foreground text-right">{bio.length}/200</p>
          </Field>

          <Field icon={Link} label="Avatar URL">
            <input
              value={avatarUrl}
              onChange={e => markDirty(setAvatarUrl)(e.target.value)}
              placeholder="https://example.com/photo.jpg"
              className="w-full bg-card border border-border rounded-xl px-4 py-3 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 ring-primary/40 transition-all"
            />
            {avatarUrl && (
              <div className="flex items-center gap-3 mt-2 bg-accent/40 rounded-xl p-2.5">
                <img src={avatarUrl} alt="Preview" className="w-10 h-10 rounded-full object-cover" onError={e => (e.currentTarget.style.display = "none")} />
                <p className="text-xs text-muted-foreground">Avatar preview</p>
              </div>
            )}
          </Field>

          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={handleSave}
            disabled={updateMe.isPending || !dirty}
            className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground rounded-xl py-3.5 font-bold text-sm hover:bg-primary/90 transition-colors disabled:opacity-40 shadow-lg shadow-primary/20"
          >
            <Save size={16} />
            {updateMe.isPending ? "Saving…" : "Save changes"}
          </motion.button>
        </motion.div>

        {/* Account section */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="border-t border-border pt-6 space-y-3">
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Account</p>
          {clerkUser && (
            <div className="flex items-center gap-3 bg-card border border-border rounded-xl p-4">
              <div className="w-9 h-9 bg-accent rounded-xl flex items-center justify-center">
                <User size={16} className="text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{clerkUser.primaryEmailAddress?.emailAddress}</p>
                <p className="text-xs text-muted-foreground">Signed in with Clerk</p>
              </div>
            </div>
          )}
          <button
            onClick={() => signOut()}
            className="w-full flex items-center justify-center gap-2 border border-destructive/30 text-destructive rounded-xl py-3 font-semibold text-sm hover:bg-destructive/8 transition-colors"
          >
            <LogOut size={15} />
            Sign out of Pulse
          </button>
        </motion.div>
      </div>
    </div>
  );
}
