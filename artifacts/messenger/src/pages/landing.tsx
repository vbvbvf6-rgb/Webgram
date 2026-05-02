import { useLocation } from "wouter";
import { motion, useScroll, useTransform } from "framer-motion";
import { MessageSquare, Shield, Zap, Users, ArrowRight, CheckCircle, Heart, Lock, Smile } from "lucide-react";
import { useRef } from "react";

const FEATURES = [
  { icon: Zap, title: "Instant delivery", desc: "Messages arrive in milliseconds. No delays, no loading spinners." },
  { icon: Shield, title: "End-to-end privacy", desc: "Your conversations stay between you. We never read your messages." },
  { icon: Users, title: "Group chats", desc: "Create groups for teams, friends, or communities up to thousands of members." },
  { icon: Smile, title: "Expressive reactions", desc: "React to any message with emojis. Show how you feel without saying a word." },
  { icon: MessageSquare, title: "Threaded replies", desc: "Reply directly to a message to keep conversations organized and clear." },
  { icon: Lock, title: "Encrypted by default", desc: "Security is not an option — it's built into every message you send." },
];

const TESTIMONIALS = [
  { name: "Alex K.", text: "Pulse is what every messenger should be. Clean, fast, and beautiful.", avatar: "AK" },
  { name: "Sarah M.", text: "I switched from Telegram and never looked back. The design is stunning.", avatar: "SM" },
  { name: "David L.", text: "Group chats work flawlessly. My team loves it.", avatar: "DL" },
];

const MOCK_MESSAGES = [
  { from: "Alex", content: "Hey! Did you see the new Pulse update? 🔥", own: false },
  { from: "Me", content: "Just got it! The reactions are so smooth", own: true },
  { from: "Alex", content: "Right?! Also the dark theme is 🤌", own: false },
  { from: "Me", content: "Love it. Way better than anything else out there", own: true },
  { from: "Alex", content: "100% agree 👏", own: false },
];

export default function LandingPage() {
  const [, setLocation] = useLocation();
  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], [0, 80]);
  const y2 = useTransform(scrollYProgress, [0, 1], [0, 40]);
  const opacity = useTransform(scrollYProgress, [0, 0.6], [1, 0]);

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4 border-b border-border/40 backdrop-blur-xl bg-background/70">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary to-indigo-500 flex items-center justify-center shadow-lg shadow-primary/30">
            <svg width="16" height="16" viewBox="0 0 48 48" fill="none">
              <path d="M12 16C12 16 16 8 24 8C32 8 36 16 36 16L30 24C30 24 32 32 28 36L24 40L20 36C16 32 18 24 18 24L12 16Z" fill="white" opacity="0.9"/>
              <circle cx="24" cy="22" r="4" fill="white" opacity="0.6"/>
            </svg>
          </div>
          <span className="font-bold text-lg tracking-tight">Pulse</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setLocation("/sign-in")} className="text-sm text-muted-foreground hover:text-foreground transition-colors px-4 py-2 rounded-xl hover:bg-accent">
            Sign in
          </button>
          <button onClick={() => setLocation("/sign-up")} className="text-sm bg-primary text-primary-foreground rounded-xl px-5 py-2.5 hover:bg-primary/90 transition-all font-semibold shadow-lg shadow-primary/20">
            Get started
          </button>
        </div>
      </nav>

      {/* Hero */}
      <section ref={heroRef} className="relative min-h-screen flex items-center justify-center px-6 pt-16 overflow-hidden">
        {/* Animated background */}
        <div className="absolute inset-0 pointer-events-none">
          <motion.div style={{ y }} className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[700px] h-[700px] bg-primary/8 rounded-full blur-[140px]" />
          <motion.div style={{ y: y2 }} className="absolute top-1/3 left-1/4 w-[350px] h-[350px] bg-indigo-500/6 rounded-full blur-[100px]" />
          <div className="absolute bottom-0 right-1/4 w-[300px] h-[300px] bg-violet-500/5 rounded-full blur-[100px]" />
          {/* Grid pattern */}
          <div className="absolute inset-0 opacity-[0.02]" style={{ backgroundImage: "radial-gradient(circle, #fff 1px, transparent 1px)", backgroundSize: "40px 40px" }} />
        </div>

        <motion.div style={{ opacity }} className="relative text-center max-w-4xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <motion.span
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.1, type: "spring" }}
              className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 text-primary text-xs font-semibold rounded-full px-4 py-1.5 mb-8"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              Real-time messaging, reimagined
              <span className="bg-primary/20 text-[10px] rounded-full px-2 py-0.5 font-bold">NEW</span>
            </motion.span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.6 }}
            className="text-5xl sm:text-6xl md:text-7xl font-extrabold tracking-tight leading-[1.05] mb-6"
          >
            Conversations that
            <span className="block bg-gradient-to-r from-violet-400 via-purple-400 to-indigo-400 bg-clip-text text-transparent mt-1">
              feel alive
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25, duration: 0.5 }}
            className="text-lg text-muted-foreground max-w-xl mx-auto mb-10 leading-relaxed"
          >
            Pulse is a modern messenger built for people who care how they communicate.
            Fast, expressive, and beautifully designed.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            className="flex flex-wrap items-center justify-center gap-3"
          >
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => setLocation("/sign-up")}
              className="inline-flex items-center gap-2 bg-primary text-primary-foreground rounded-2xl px-8 py-4 font-bold text-base hover:bg-primary/90 transition-all shadow-xl shadow-primary/25"
            >
              Start messaging free
              <ArrowRight size={18} />
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => setLocation("/sign-in")}
              className="inline-flex items-center gap-2 border border-border text-foreground rounded-2xl px-8 py-4 font-semibold text-base hover:bg-accent transition-all"
            >
              Sign in
            </motion.button>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="flex items-center justify-center gap-6 mt-8 text-xs text-muted-foreground"
          >
            {["Free forever", "No ads", "Private by default"].map((t, i) => (
              <span key={i} className="flex items-center gap-1.5">
                <CheckCircle size={12} className="text-green-500" />
                {t}
              </span>
            ))}
          </motion.div>

          {/* Mock chat window */}
          <motion.div
            initial={{ opacity: 0, y: 60 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, type: "spring", stiffness: 80, damping: 20 }}
            className="mt-16 mx-auto max-w-sm"
          >
            <div className="bg-card border border-border/60 rounded-3xl overflow-hidden shadow-2xl shadow-black/40">
              {/* Window chrome */}
              <div className="flex items-center gap-2 px-4 py-3 bg-sidebar border-b border-border">
                <div className="flex gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
                  <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/70" />
                  <div className="w-2.5 h-2.5 rounded-full bg-green-500/70" />
                </div>
                <span className="text-xs text-muted-foreground mx-auto font-medium">Pulse Messenger</span>
              </div>
              {/* Chat header */}
              <div className="flex items-center gap-3 px-4 py-2.5 bg-sidebar/60 border-b border-border/50">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-indigo-500 flex items-center justify-center text-xs font-bold text-white">AK</div>
                <div>
                  <p className="text-xs font-semibold">Alex K.</p>
                  <p className="text-[10px] text-green-500">Online</p>
                </div>
              </div>
              {/* Messages */}
              <div className="px-3 py-4 space-y-2.5 bg-background/60 min-h-[200px]">
                {MOCK_MESSAGES.map((m, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: m.own ? 10 : -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.8 + i * 0.15 }}
                    className={`flex ${m.own ? "justify-end" : "justify-start"}`}
                  >
                    <div className={`text-xs rounded-2xl px-3 py-1.5 max-w-[75%] ${m.own ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-card border border-border rounded-bl-sm"}`}>
                      {m.content}
                    </div>
                  </motion.div>
                ))}
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.8 }} className="flex justify-start">
                  <div className="bg-card border border-border rounded-2xl rounded-bl-sm px-3 py-2 flex gap-1 items-center">
                    {[0, 0.15, 0.3].map((d, i) => (
                      <motion.span key={i} animate={{ y: [0, -3, 0] }} transition={{ repeat: Infinity, duration: 0.8, delay: d }} className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60" />
                    ))}
                  </div>
                </motion.div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </section>

      {/* Features */}
      <section className="relative py-24 px-6">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-px h-24 bg-gradient-to-b from-transparent to-primary/20" />
        </div>
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <span className="text-xs text-primary font-bold uppercase tracking-widest">Features</span>
            <h2 className="text-3xl sm:text-4xl font-extrabold mt-3 tracking-tight">Everything you need, nothing you don't</h2>
            <p className="text-muted-foreground mt-3 max-w-md mx-auto text-sm">Built from the ground up to be the messaging app you actually want to use every day.</p>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES.map((f, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.07 }}
                className="bg-card border border-border/60 rounded-2xl p-6 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 transition-all group"
              >
                <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                  <f.icon size={18} className="text-primary" />
                </div>
                <h3 className="font-bold text-sm mb-1.5">{f.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 px-6 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-1/2 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        </div>
        <div className="max-w-4xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-12">
            <span className="text-xs text-primary font-bold uppercase tracking-widest">People love it</span>
            <h2 className="text-3xl font-extrabold mt-3 tracking-tight">Don't take our word for it</h2>
          </motion.div>
          <div className="grid sm:grid-cols-3 gap-4">
            {TESTIMONIALS.map((t, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="bg-card border border-border/60 rounded-2xl p-6 relative"
              >
                <div className="flex items-center gap-1 mb-3">
                  {[...Array(5)].map((_, j) => <Heart key={j} size={11} fill="currentColor" className="text-primary/70" />)}
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed mb-4">"{t.text}"</p>
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-indigo-500 flex items-center justify-center text-[11px] font-bold text-white">{t.avatar}</div>
                  <p className="text-sm font-semibold">{t.name}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-6 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-primary/8 rounded-full blur-[100px]" />
        </div>
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="relative max-w-2xl mx-auto text-center"
        >
          <div className="w-16 h-16 bg-gradient-to-br from-primary to-indigo-500 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-primary/30">
            <MessageSquare size={28} className="text-white" />
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-4">Ready to start chatting?</h2>
          <p className="text-muted-foreground text-sm mb-8 max-w-sm mx-auto">Join thousands of people already using Pulse. It's free, fast, and beautiful.</p>
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => setLocation("/sign-up")}
            className="inline-flex items-center gap-2.5 bg-primary text-primary-foreground rounded-2xl px-10 py-4 font-bold text-base hover:bg-primary/90 transition-all shadow-xl shadow-primary/30"
          >
            Create your free account
            <ArrowRight size={18} />
          </motion.button>
          <p className="text-xs text-muted-foreground mt-4">No credit card required · Free forever</p>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/40 px-6 py-8">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-primary/20 flex items-center justify-center">
              <MessageSquare size={12} className="text-primary" />
            </div>
            <span className="font-bold text-sm">Pulse</span>
            <span className="text-muted-foreground text-xs">· Real-time messaging, reimagined</span>
          </div>
          <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} Pulse. Built with love.</p>
        </div>
      </footer>
    </div>
  );
}
