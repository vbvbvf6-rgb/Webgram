import { useLocation } from "wouter";
import { MessageSquare, Search, Phone, Settings } from "lucide-react";
import { motion } from "framer-motion";

const TABS = [
  { path: "/chats", icon: MessageSquare, label: "Chats" },
  { path: "/search", icon: Search, label: "Search" },
  { path: "/calls", icon: Phone, label: "Calls" },
  { path: "/settings", icon: Settings, label: "Settings" },
];

export function BottomNav() {
  const [location, setLocation] = useLocation();

  const isActive = (path: string) => {
    if (path === "/chats") return location === "/chats" || location.startsWith("/chats/");
    return location === path || location.startsWith(path + "/");
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 flex md:hidden border-t border-border bg-sidebar/95 backdrop-blur-xl">
      {TABS.map(tab => {
        const active = isActive(tab.path);
        return (
          <button
            key={tab.path}
            onClick={() => setLocation(tab.path)}
            className="flex-1 flex flex-col items-center justify-center py-2 gap-0.5 relative"
          >
            {active && (
              <motion.div
                layoutId="bottom-nav-indicator"
                className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-primary rounded-full"
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
              />
            )}
            <tab.icon
              size={20}
              className={`transition-colors ${active ? "text-primary" : "text-muted-foreground"}`}
            />
            <span className={`text-[10px] font-medium transition-colors ${active ? "text-primary" : "text-muted-foreground"}`}>
              {tab.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
