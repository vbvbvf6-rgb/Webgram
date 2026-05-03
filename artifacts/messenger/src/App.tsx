import { useEffect, useRef, useState } from "react";
import { ClerkProvider, SignIn, SignUp, Show, useClerk, useAuth } from "@clerk/react";
import { publishableKeyFromHost } from "@clerk/react/internal";
import { shadcn } from "@clerk/themes";
import { Switch, Route, useLocation, Router as WouterRouter, Redirect } from "wouter";
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
    colorPrimary: "#7C3AED",
    colorForeground: "#1e1b4b",
    colorMutedForeground: "#6b7280",
    colorDanger: "#ef4444",
    colorBackground: "#ffffff",
    colorInput: "#f3f4f6",
    colorInputForeground: "#1e1b4b",
    colorNeutral: "#e5e7eb",
    fontFamily: "Inter, sans-serif",
    borderRadius: "0.875rem",
  },
  elements: {
    rootBox: "w-full flex justify-center",
    cardBox: "bg-white rounded-3xl w-[400px] max-w-full overflow-hidden shadow-xl shadow-purple-100/60",
    card: "!shadow-none !border-0 !bg-transparent !rounded-none px-2",
    footer: "!shadow-none !border-0 !bg-transparent !rounded-none",
    header: "hidden",
    headerTitle: "hidden",
    headerSubtitle: "hidden",
    socialButtonsBlockButtonText: "text-gray-700",
    formFieldLabel: "text-gray-600 text-sm font-medium",
    footerActionLink: "text-purple-600 hover:text-pink-500 font-semibold",
    footerActionText: "text-gray-400",
    dividerText: "text-gray-400",
    identityPreviewEditButton: "text-purple-600",
    formFieldSuccessText: "text-green-500",
    alertText: "text-gray-700",
    logoBox: "hidden",
    logoImage: "hidden",
    socialButtonsBlockButton: "border border-gray-200 bg-gray-50 hover:bg-gray-100 text-gray-700",
    formButtonPrimary: "!bg-gradient-to-r !from-purple-500 !to-pink-500 hover:!from-purple-600 hover:!to-pink-600 !text-white !font-semibold !rounded-2xl !shadow-lg !shadow-purple-200",
    formFieldInput: "!bg-gray-50 !border-gray-200 !text-gray-800 !rounded-xl placeholder:text-gray-400 focus:!border-purple-400 focus:!ring-purple-200",
    footerAction: "!bg-gray-50/50",
    dividerLine: "bg-gray-200",
    alert: "bg-red-50 border-red-200",
    otpCodeFieldInput: "bg-gray-50 border-gray-200 text-gray-800",
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

function AuthBackground({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-[100dvh] overflow-hidden bg-background">
      <div className="absolute inset-0">
        <div className="absolute -left-16 top-24 h-56 w-56 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute left-0 bottom-10 h-44 w-44 rounded-full bg-violet-500/10 blur-3xl" />
        <div className="absolute right-10 bottom-0 h-52 w-52 rounded-full bg-pink-500/10 blur-3xl" />
      </div>
      <div className="relative z-10 flex min-h-[100dvh] items-center justify-center px-5 py-10">
        <div className="relative w-full max-w-[430px] rounded-[34px] bg-card/95 p-8 shadow-[0_30px_80px_rgba(124,58,237,0.14)] backdrop-blur-sm border border-border/60">
          <div className="flex flex-col items-center text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-pink-500 text-white shadow-lg shadow-violet-200/60">
              <svg width="30" height="30" viewBox="0 0 32 32" fill="none" aria-hidden="true">
                <path d="M6 8C6 6.9 6.9 6 8 6h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2h-4l-4 4-4-4H8c-1.1 0-2-.9-2-2V8z" fill="white" opacity="0.96" />
                <circle cx="11" cy="13" r="1.5" fill="#7C3AED" />
                <circle cx="16" cy="13" r="1.5" fill="#7C3AED" />
                <circle cx="21" cy="13" r="1.5" fill="#7C3AED" />
              </svg>
            </div>
            <h1 className="text-3xl font-black text-zinc-900">Droidgram</h1>
            <p className="mt-1 text-sm text-zinc-500">Мессенджер будущего</p>
          </div>
          {children}
        </div>
      </div>
    </div>
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
        <SignInPage />
      </Show>
    </>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
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
