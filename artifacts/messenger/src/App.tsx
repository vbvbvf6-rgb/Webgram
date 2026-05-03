import { useEffect, useRef } from "react";
import { ClerkProvider, SignIn, SignUp, Show, useClerk, useAuth } from "@clerk/react";
import { publishableKeyFromHost } from "@clerk/react/internal";
import { shadcn } from "@clerk/themes";
import { Switch, Route, useLocation, Router as WouterRouter, Redirect } from "wouter";
import { QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { queryClient } from "@/lib/queryClient";
import { setAuthTokenGetter } from "@workspace/api-client-react";
import LandingPage from "@/pages/landing";
import ChatsPage from "@/pages/chats";
import SettingsPage from "@/pages/settings";
import SearchPage from "@/pages/search";
import CallsPage from "@/pages/calls";
import NotFound from "@/pages/not-found";
import { BottomNav } from "@/components/BottomNav";

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
    logoPlacement: "inside" as const,
    logoLinkUrl: basePath || "/",
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: "#8B5CF6",
    colorForeground: "#d4dae8",
    colorMutedForeground: "#6b7a99",
    colorDanger: "#ef4444",
    colorBackground: "#0f1521",
    colorInput: "#1a2133",
    colorInputForeground: "#d4dae8",
    colorNeutral: "#1e2d47",
    fontFamily: "Inter, sans-serif",
    borderRadius: "0.75rem",
  },
  elements: {
    rootBox: "w-full flex justify-center",
    cardBox: "bg-[#0f1521] border border-[#1e2d47] rounded-2xl w-[440px] max-w-full overflow-hidden shadow-2xl",
    card: "!shadow-none !border-0 !bg-transparent !rounded-none",
    footer: "!shadow-none !border-0 !bg-transparent !rounded-none",
    headerTitle: "text-[#d4dae8] font-semibold",
    headerSubtitle: "text-[#6b7a99]",
    socialButtonsBlockButtonText: "text-[#d4dae8]",
    formFieldLabel: "text-[#d4dae8]",
    footerActionLink: "text-[#8B5CF6] hover:text-[#a78bfa]",
    footerActionText: "text-[#6b7a99]",
    dividerText: "text-[#6b7a99]",
    identityPreviewEditButton: "text-[#8B5CF6]",
    formFieldSuccessText: "text-green-400",
    alertText: "text-[#d4dae8]",
    logoBox: "flex justify-center py-2",
    logoImage: "w-12 h-12",
    socialButtonsBlockButton: "border border-[#1e2d47] bg-[#1a2133] hover:bg-[#1e2d47] text-[#d4dae8]",
    formButtonPrimary: "bg-[#8B5CF6] hover:bg-[#7c3aed] text-white",
    formFieldInput: "bg-[#1a2133] border-[#1e2d47] text-[#d4dae8] placeholder:text-[#6b7a99]",
    footerAction: "bg-[#0d1420]",
    dividerLine: "bg-[#1e2d47]",
    alert: "bg-[#1a2133] border-[#1e2d47]",
    otpCodeFieldInput: "bg-[#1a2133] border-[#1e2d47] text-[#d4dae8]",
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

function SignInPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4">
      <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} />
    </div>
  );
}

function SignUpPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4">
      <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} />
    </div>
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
        signIn: { start: { title: "Welcome back to Pulse", subtitle: "Sign in to continue your conversations" } },
        signUp: { start: { title: "Join Pulse", subtitle: "Create your account to get started" } },
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
