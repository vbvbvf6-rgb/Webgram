import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { ClerkProvider, SignIn, SignUp, Show, useClerk, useAuth } from "@clerk/react";
import { publishableKeyFromHost } from "@clerk/react/internal";
import { shadcn } from "@clerk/themes";
import { Switch, Route, useLocation, Router as WouterRouter, Redirect, Link } from "wouter";
import { QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { queryClient } from "@/lib/queryClient";
import { setAuthTokenGetter } from "@workspace/api-client-react";
import ChatsPage from "@/pages/chats";
import SettingsPage from "@/pages/settings";
import SearchPage from "@/pages/search";
import CallsPage from "@/pages/calls";
import WalletPage from "@/pages/wallet";
import SavedPage from "@/pages/saved";
import AiChatPage from "@/pages/ai-chat";
import ProfilePage from "@/pages/profile";
import NotFound from "@/pages/not-found";
import { BottomNav } from "@/components/BottomNav";

function getTabSessionId() {
  const key = "pulse_tab_session_id";
  const existing = sessionStorage.getItem(key);
  if (existing) return existing;
  const value = crypto.randomUUID();
  sessionStorage.setItem(key, value);
  return value;
}

// Per-tab session management — each tab can have its own auth state
function isTabLoggedOut(): boolean {
  return sessionStorage.getItem("pulse_tab_logged_out") === "true";
}

export function setTabLoggedOut() {
  sessionStorage.setItem("pulse_tab_logged_out", "true");
  sessionStorage.removeItem("pulse_active_account");
}

const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);

const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

if (!clerkPubKey) {
  throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY");
}

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: "clerk",
  options: {
    logoPlacement: "none" as const,
    logoLinkUrl: basePath || "/",
  },
  variables: {
    colorPrimary: "#ec4899",
    colorForeground: "#e2e8f0",
    colorMutedForeground: "#94a3b8",
    colorDanger: "#ef4444",
    colorBackground: "#0b1020",
    colorInput: "#1e293b",
    colorInputForeground: "#e2e8f0",
    colorNeutral: "#334155",
    fontFamily: "Inter, sans-serif",
    borderRadius: "0.875rem",
  },
  elements: {
    rootBox: "w-full flex justify-center",
    cardBox: "bg-[#13182b] rounded-3xl w-[400px] max-w-full overflow-hidden shadow-xl shadow-black/60 border border-white/10",
    card: "!shadow-none !border-0 !bg-transparent !rounded-none px-2",
    footer: "!shadow-none !border-0 !bg-transparent !rounded-none",
    header: "hidden",
    headerTitle: "hidden",
    headerSubtitle: "hidden",
    socialButtonsBlockButtonText: "text-slate-100",
    formFieldLabel: "text-slate-300 text-sm font-medium",
    footerActionLink: "text-fuchsia-400 hover:text-fuchsia-300 font-semibold",
    footerActionText: "text-slate-400",
    dividerText: "text-slate-400",
    identityPreviewEditButton: "text-fuchsia-400",
    formFieldSuccessText: "text-emerald-400",
    alertText: "text-slate-100",
    logoBox: "hidden",
    logoImage: "hidden",
    socialButtonsBlockButton: "border border-white/10 bg-white/6 hover:bg-white/10 text-slate-100",
    formButtonPrimary: "!bg-fuchsia-500 hover:!bg-fuchsia-400 !text-white !font-semibold !rounded-xl !shadow-lg !shadow-fuchsia-500/20",
    formFieldInput: "!bg-white/6 !border-white/10 !text-slate-100 !rounded-xl placeholder:text-slate-500 focus:!border-fuchsia-400/40 focus:!ring-fuchsia-400/20",
    footerAction: "!bg-white/3",
    dividerLine: "bg-white/10",
    alert: "bg-red-500/10 border-red-500/20",
    otpCodeFieldInput: "bg-white/6 border-white/10 text-slate-100",
    formFieldRow: "",
    main: "",
  },
};

function ClerkApiSetup() {
  const { getToken, isSignedIn } = useAuth();

  useEffect(() => {
    if (isSignedIn) {
      setAuthTokenGetter(() => getToken());
    } else {
      setAuthTokenGetter(null);
    }
  }, [isSignedIn, getToken]);

  return null;
}

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const qc = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (prevUserIdRef.current !== undefined && prevUserIdRef.current !== userId) {
        qc.clear();
      }
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener, qc]);

  return null;
}

function AuthBackground({ children, showButton = false, onButtonClick }: { children?: React.ReactNode; showButton?: boolean; onButtonClick?: () => void }) {
  return (
    <div className="relative min-h-[100dvh] overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(168,85,247,0.22),_transparent_36%),radial-gradient(circle_at_top_right,_rgba(236,72,153,0.16),_transparent_34%),linear-gradient(135deg,_#0b1020_0%,_#11172a_45%,_#0b1020_100%)]">
      <div className="absolute inset-0">
        <div className="absolute -left-16 top-24 h-56 w-56 rounded-full bg-violet-500/12 blur-3xl animate-pulse" />
        <div className="absolute left-0 bottom-10 h-44 w-44 rounded-full bg-fuchsia-500/12 blur-3xl animate-pulse" />
        <div className="absolute right-10 bottom-0 h-52 w-52 rounded-full bg-sky-500/12 blur-3xl animate-pulse" />
      </div>
      <div className="relative z-10 flex min-h-[100dvh] items-center justify-center px-5 py-10">
        <div className="relative w-full max-w-[430px] rounded-[34px] bg-[#13182b]/95 p-8 shadow-[0_30px_80px_rgba(0,0,0,0.45)] backdrop-blur-sm border border-white/10">
          <div className="flex flex-col items-center text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 via-fuchsia-500 to-sky-500 text-white shadow-lg shadow-violet-200/60 animate-pulse">
              <svg width="30" height="30" viewBox="0 0 32 32" fill="none" aria-hidden="true">
                <path d="M6 8C6 6.9 6.9 6 8 6h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2h-4l-4 4-4-4H8c-1.1 0-2-.9-2-2V8z" fill="white" opacity="0.96" />
                <circle cx="11" cy="13" r="1.5" fill="#7C3AED" />
                <circle cx="16" cy="13" r="1.5" fill="#7C3AED" />
                <circle cx="21" cy="13" r="1.5" fill="#7C3AED" />
              </svg>
            </div>
            <h1 className="text-3xl font-black text-slate-100">Droidgram</h1>
            <p className="mt-1 text-sm text-slate-400">Мессенджер будущего</p>
          </div>
          {showButton && (
            <div className="mt-6 flex justify-center">
              <button onClick={onButtonClick} className="inline-flex items-center justify-center rounded-xl bg-fuchsia-500 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-fuchsia-400">
                Войти в мессенджер
              </button>
            </div>
          )}
          {children}
        </div>
      </div>
    </div>
  );
}

function LandingPage() {
  const [, setLocation] = useLocation();
  return (
    <AuthBackground
      showButton={true}
      onButtonClick={() => setLocation("/sign-in")}
    />
  );
}

function SignInPage() {
  return (
    <AuthBackground>
      <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} />
    </AuthBackground>
  );
}

function SignUpPage() {
  return (
    <AuthBackground>
      <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} />
    </AuthBackground>
  );
}

function HomeRedirect() {
  return (
    <>
      <Show when="signed-in">
        <Redirect to="/chats" />
      </Show>
      <Show when="signed-out">
        <LandingPage />
      </Show>
    </>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  // Check if this tab was logged out (per-tab session)
  const tabLoggedOut = isTabLoggedOut();
  
  if (tabLoggedOut) {
    return <Redirect to="/" />;
  }
  
  return (
    <>
      <Show when="signed-in">
        {children}
        <BottomNav />
      </Show>
      <Show when="signed-out"><Redirect to="/" /></Show>
    </>
  );
}

function AppRoutes() {
  const [, setLocation] = useLocation();

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      localization={{
        signIn: { start: { title: "Welcome back to Droidgram", subtitle: "Sign in to continue your conversations" } },
        signUp: { start: { title: "Join Droidgram", subtitle: "Create your account to get started" } },
      }}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <ClerkApiSetup />
        <ClerkQueryClientCacheInvalidator />
        <Switch>
          <Route path="/" component={HomeRedirect} />
          <Route path="/sign-in/*?" component={SignInPage} />
          <Route path="/sign-up/*?" component={SignUpPage} />
          <Route path="/chats/:chatId?">
            {(params) => (
              <ProtectedRoute>
                <ChatsPage activeChatId={params.chatId ? Number(params.chatId) : undefined} />
              </ProtectedRoute>
            )}
          </Route>
          <Route path="/settings">
            <ProtectedRoute><SettingsPage /></ProtectedRoute>
          </Route>
          <Route path="/search">
            <ProtectedRoute><SearchPage /></ProtectedRoute>
          </Route>
          <Route path="/calls">
            <ProtectedRoute><CallsPage /></ProtectedRoute>
          </Route>
          <Route path="/wallet">
            <ProtectedRoute><WalletPage /></ProtectedRoute>
          </Route>
          <Route path="/saved">
            <ProtectedRoute><SavedPage /></ProtectedRoute>
          </Route>
          <Route path="/ai">
            <ProtectedRoute><AiChatPage /></ProtectedRoute>
          </Route>
          <Route path="/profile">
            <ProtectedRoute><ProfilePage /></ProtectedRoute>
          </Route>
          <Route component={NotFound} />
        </Switch>
        <Toaster />
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function App() {
  return (
    <WouterRouter base={basePath}>
      <AppRoutes />
    </WouterRouter>
  );
}

export default App;
