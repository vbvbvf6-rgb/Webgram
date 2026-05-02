import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { MessageSquare, Shield, Zap, Users, ArrowRight, CheckCircle } from "lucide-react";

export default function LandingPage() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4 border-b border-border/50 backdrop-blur-xl bg-background/80">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <svg width="18" height="18" viewBox="0 0 48 48" fill="none">
              <path d="M12 16C12 16 16 8 24 8C32 8 36 16 36 16L30 24C30 24 32 32 28 36L24 40L20 36C16 32 18 24 18 24L12 16Z" fill="white" opacity="0.9"/>
              <circle cx="24" cy="22" r="4" fill="#8B5CF6"/>
            </svg>
          </div>
          <span className="font-bold text-lg tracking-tight">Pulse</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setLocation("/sign-in")}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors px-4 py-2"
            data-testid="button-signin-nav"
          >
            Sign in
          </button>
          <button
            onClick={() => setLocation("/sign-up")}
            className="text-sm bg-primary text-primary-foreground rounded-lg px-4 py-2 hover:bg-primary/90 transition-colors font-medium"
            data-testid="button-signup-nav"
          >
            Get started
          </button>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative min-h-screen flex items-center justify-center px-6 pt-20">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-primary/10 rounded-full blur-[120px]" />
          <div className="absolute bottom-1/4 left-1/4 w-[300px] h-[300px] bg-indigo-500/8 rounded-full blur-[80px]" />
        </div>
        <div className="relative text-center max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <span className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 text-primary text-xs font-medium rounded-full px-4 py-1.5 mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              Real-time messaging, reimagined
            </span>
            <h1 className="text-5xl md:text-7xl font-bold tracking-tight leading-tight mb-6">
              Conversations that
              <span className="block bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text text-transparent">
                feel alive
              </span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
              Pulse is a modern messenger built for people who care how they communicate. Fast, expressive, and beautifully designed.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={() => setLocation("/sign-up")}
                className="flex items-center justify-center gap-2 bg-primary text-primary-foreground rounded-xl px-8 py-4 font-semibold text-base hover:bg-primary/90 transition-all hover:shadow-lg hover:shadow-primary/25"
                data-testid="button-getstarted-hero"
              >
                Start messaging free
                <ArrowRight size={18} />
              </button>
              <button
                onClick={() => setLocation("/sign-in")}
                className="flex items-center justify-center gap-2 border border-border text-foreground rounded-xl px-8 py-4 font-semibold text-base hover:bg-accent transition-colors"
                data-testid="button-signin-hero"
              >
                Sign in
              </button>
            </div>
          </motion.div>

          {/* Floating chat preview */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="mt-20 relative"
          >
            <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-2xl max-w-2xl mx-auto">
              <div className="bg-sidebar border-b border-border px-4 py-3 flex items-center gap-3">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-500/60" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
                  <div className="w-3 h-3 rounded-full bg-green-500/60" />
                </div>
                <span className="text-xs text-muted-foreground font-medium">Pulse Messenger</span>
              </div>
              <div className="p-6 space-y-4">
                {[
                  { name: "Alex", msg: "Have you seen the new design?", time: "2:41 PM", own: false },
                  { name: "You", msg: "Just checked it out — looks incredible", time: "2:42 PM", own: true },
                  { name: "Alex", msg: "Right? The animations are so smooth", time: "2:42 PM", own: false },
                  { name: "You", msg: "Exactly what I was thinking", time: "2:43 PM", own: true },
                ].map((m, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: m.own ? 20 : -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.5 + i * 0.15 }}
                    className={`flex ${m.own ? "justify-end" : "justify-start"}`}
                  >
                    <div className={`max-w-[70%] rounded-2xl px-4 py-2.5 ${m.own ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-secondary text-secondary-foreground rounded-bl-sm"}`}>
                      <p className="text-sm">{m.msg}</p>
                      <p className={`text-xs mt-1 ${m.own ? "text-primary-foreground/70" : "text-muted-foreground"}`}>{m.time}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section className="py-32 px-6">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-5xl font-bold mb-4">Everything you need</h2>
            <p className="text-muted-foreground text-lg">Built for real conversations</p>
          </motion.div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { icon: MessageSquare, title: "Threads & Replies", desc: "Nested replies keep conversations organized and easy to follow" },
              { icon: Zap, title: "Instant reactions", desc: "Express yourself with emoji reactions on any message" },
              { icon: Users, title: "Group chats", desc: "Bring your team together in powerful group conversations" },
              { icon: Shield, title: "Secure by default", desc: "Your conversations are protected with industry-standard security" },
            ].map((f, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="bg-card border border-border rounded-2xl p-6 hover:border-primary/30 transition-colors"
              >
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                  <f.icon size={20} className="text-primary" />
                </div>
                <h3 className="font-semibold mb-2">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* What makes it different */}
      <section className="py-20 px-6 border-t border-border">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl md:text-4xl font-bold mb-4">What sets Pulse apart</h2>
          </motion.div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              "Real-time message delivery",
              "Edit and delete messages",
              "Reply threads for context",
              "Emoji reaction system",
              "Online presence indicators",
              "Unread message tracking",
              "User search and discovery",
              "Group chat management",
            ].map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
                className="flex items-center gap-3 bg-card border border-border rounded-xl p-4"
              >
                <CheckCircle size={18} className="text-primary shrink-0" />
                <span className="text-sm font-medium">{item}</span>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-32 px-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-indigo-500/5 pointer-events-none" />
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-2xl mx-auto text-center relative"
        >
          <h2 className="text-4xl md:text-5xl font-bold mb-6">Ready to start?</h2>
          <p className="text-muted-foreground text-lg mb-10">Join Pulse and experience messaging the way it should feel.</p>
          <button
            onClick={() => setLocation("/sign-up")}
            className="inline-flex items-center gap-2 bg-primary text-primary-foreground rounded-xl px-10 py-4 font-semibold text-lg hover:bg-primary/90 transition-all hover:shadow-xl hover:shadow-primary/20"
            data-testid="button-cta-bottom"
          >
            Get started for free
            <ArrowRight size={20} />
          </button>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border px-6 py-8">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-primary flex items-center justify-center">
              <svg width="12" height="12" viewBox="0 0 48 48" fill="none">
                <path d="M12 16C12 16 16 8 24 8C32 8 36 16 36 16L30 24C30 24 32 32 28 36L24 40L20 36C16 32 18 24 18 24L12 16Z" fill="white"/>
              </svg>
            </div>
            <span className="text-sm font-semibold">Pulse</span>
          </div>
          <p className="text-xs text-muted-foreground">Built with care. Designed to last.</p>
        </div>
      </footer>
    </div>
  );
}
