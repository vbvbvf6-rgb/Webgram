import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Save, LogOut } from "lucide-react";
import { useGetMe, useUpdateMe, getGetMeQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useClerk } from "@clerk/react";

function Avatar({ src, name, size = 64 }: { src?: string | null; name: string; size?: number }) {
  const initials = name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
  const colors = ["#8B5CF6", "#6366F1", "#EC4899", "#14B8A6", "#F59E0B"];
  const color = colors[name.charCodeAt(0) % colors.length];
  return src ? (
    <img src={src} alt={name} className="rounded-full object-cover" style={{ width: size, height: size }} />
  ) : (
    <div className="rounded-full flex items-center justify-center text-white font-bold" style={{ width: size, height: size, background: color, fontSize: size * 0.35 }}>
      {initials}
    </div>
  );
}

export default function SettingsPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { signOut } = useClerk();
  const qc = useQueryClient();
  const { data: me } = useGetMe();
  const updateMe = useUpdateMe();

  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");

  useEffect(() => {
    if (me) {
      const m = me as any;
      setDisplayName(m.displayName || "");
      setUsername(m.username || "");
      setBio(m.bio || "");
      setAvatarUrl(m.avatarUrl || "");
    }
  }, [me]);

  async function handleSave() {
    try {
      await updateMe.mutateAsync({ data: { displayName, username, bio: bio || null, avatarUrl: avatarUrl || null } });
      qc.invalidateQueries({ queryKey: getGetMeQueryKey() });
      toast({ title: "Profile updated" });
    } catch {
      toast({ title: "Failed to update profile", variant: "destructive" });
    }
  }

  const m = me as any;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 flex items-center gap-3 px-4 py-3 border-b border-border bg-sidebar/80 backdrop-blur-xl z-10">
        <button onClick={() => setLocation("/chats")} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-accent" data-testid="button-back">
          <ArrowLeft size={18} />
        </button>
        <h1 className="font-semibold">Settings</h1>
      </div>

      <div className="max-w-lg mx-auto px-4 py-8 space-y-8">
        {/* Profile avatar */}
        <div className="flex flex-col items-center gap-3">
          {me ? (
            <Avatar src={avatarUrl || m?.avatarUrl} name={m?.displayName || displayName || "Me"} size={80} />
          ) : (
            <div className="w-20 h-20 bg-accent rounded-full animate-pulse" />
          )}
          <p className="text-sm text-muted-foreground">Your public profile</p>
        </div>

        {/* Form */}
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">Display Name</label>
            <input
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              placeholder="Your display name"
              className="w-full bg-card border border-border rounded-xl px-4 py-3 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 ring-primary/50 transition-all"
              data-testid="input-display-name"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">Username</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">@</span>
              <input
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="username"
                className="w-full bg-card border border-border rounded-xl pl-8 pr-4 py-3 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 ring-primary/50 transition-all"
                data-testid="input-username"
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">Bio</label>
            <textarea
              value={bio}
              onChange={e => setBio(e.target.value)}
              placeholder="A short bio about yourself..."
              rows={3}
              className="w-full bg-card border border-border rounded-xl px-4 py-3 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 ring-primary/50 transition-all resize-none"
              data-testid="input-bio"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">Avatar URL</label>
            <input
              value={avatarUrl}
              onChange={e => setAvatarUrl(e.target.value)}
              placeholder="https://example.com/avatar.jpg"
              className="w-full bg-card border border-border rounded-xl px-4 py-3 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 ring-primary/50 transition-all"
              data-testid="input-avatar-url"
            />
          </div>

          <button
            onClick={handleSave}
            disabled={updateMe.isPending}
            className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground rounded-xl py-3 font-semibold text-sm hover:bg-primary/90 transition-colors disabled:opacity-50"
            data-testid="button-save-profile"
          >
            <Save size={16} />
            {updateMe.isPending ? "Saving..." : "Save changes"}
          </button>
        </div>

        {/* Danger zone */}
        <div className="border-t border-border pt-8">
          <button
            onClick={() => signOut()}
            className="w-full flex items-center justify-center gap-2 border border-destructive/30 text-destructive rounded-xl py-3 font-medium text-sm hover:bg-destructive/10 transition-colors"
            data-testid="button-signout"
          >
            <LogOut size={16} />
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
