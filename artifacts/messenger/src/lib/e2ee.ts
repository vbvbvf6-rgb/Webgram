// Use sessionStorage for per-tab E2EE keys (survives refresh but not across tabs)
function getKeyStorageKey(): string {
  let tabId = sessionStorage.getItem("pulse_tab_id");
  if (!tabId) {
    tabId = `tab_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
    sessionStorage.setItem("pulse_tab_id", tabId);
  }
  return `pulse_ecdh_keypair_v1_${tabId}`;
}

// ── Buffer helpers ────────────────────────────────────────────────────────────

function bufToB64(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

function b64ToBuf(b64: string): ArrayBuffer {
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr.buffer;
}

// ── Key pair management ───────────────────────────────────────────────────────

export async function getOrCreateKeyPair(): Promise<{
  keyPair: CryptoKeyPair;
  publicKeyB64: string;
}> {
  const KEY_STORAGE_KEY = getKeyStorageKey();
  const stored = sessionStorage.getItem(KEY_STORAGE_KEY);
  if (stored) {
    try {
      const { priv, pub } = JSON.parse(stored);
      const privateKey = await crypto.subtle.importKey(
        "pkcs8",
        b64ToBuf(priv),
        { name: "ECDH", namedCurve: "P-256" },
        false,
        ["deriveKey"]
      );
      const publicKey = await crypto.subtle.importKey(
        "spki",
        b64ToBuf(pub),
        { name: "ECDH", namedCurve: "P-256" },
        true,
        []
      );
      return { keyPair: { privateKey, publicKey }, publicKeyB64: pub };
    } catch {
      sessionStorage.removeItem(KEY_STORAGE_KEY);
    }
  }

  const keyPair = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveKey"]
  );

  const privRaw = await crypto.subtle.exportKey("pkcs8", keyPair.privateKey);
  const pubRaw = await crypto.subtle.exportKey("spki", keyPair.publicKey);
  const pub = bufToB64(pubRaw);

  sessionStorage.setItem(
    KEY_STORAGE_KEY,
    JSON.stringify({ priv: bufToB64(privRaw), pub })
  );

  return { keyPair, publicKeyB64: pub };
}

// ── Public key import ─────────────────────────────────────────────────────────

export async function importPublicKey(b64: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "spki",
    b64ToBuf(b64),
    { name: "ECDH", namedCurve: "P-256" },
    true,
    []
  );
}

// ── ECDH shared key (direct chats) ────────────────────────────────────────────

export async function deriveSharedKey(
  myPrivateKey: CryptoKey,
  theirPublicKey: CryptoKey
): Promise<CryptoKey> {
  return crypto.subtle.deriveKey(
    { name: "ECDH", public: theirPublicKey },
    myPrivateKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

// ── PBKDF2-derived key (group chats) ─────────────────────────────────────────

export async function deriveGroupKey(
  memberIds: number[],
  chatId: number
): Promise<CryptoKey> {
  const salt = new TextEncoder().encode(`droidgram-group-${chatId}`);
  const password = new TextEncoder().encode(
    [...memberIds].sort((a, b) => a - b).join(",")
  );
  const base = await crypto.subtle.importKey("raw", password, "PBKDF2", false, [
    "deriveKey",
  ]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 100_000, hash: "SHA-256" },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

// ── Encrypt / Decrypt (AES-256-GCM) ──────────────────────────────────────────

export const ENC_PREFIX = "enc:";

export async function encryptMsg(key: CryptoKey, plaintext: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = new TextEncoder().encode(plaintext);
  const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, data);

  const combined = new Uint8Array(12 + cipher.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(cipher), 12);

  return ENC_PREFIX + bufToB64(combined.buffer);
}

export async function decryptMsg(key: CryptoKey, ciphertext: string): Promise<string> {
  if (!ciphertext.startsWith(ENC_PREFIX)) return ciphertext;
  try {
    const combined = new Uint8Array(b64ToBuf(ciphertext.slice(ENC_PREFIX.length)));
    const iv = combined.slice(0, 12);
    const data = combined.slice(12);
    const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, data);
    return new TextDecoder().decode(plain);
  } catch {
    return "🔒 Encrypted message";
  }
}

export function isEncrypted(content: string | null | undefined): boolean {
  return !!content?.startsWith(ENC_PREFIX);
}

export function shouldEncrypt(content: string): boolean {
  if (content.startsWith("[voice:")) return false;
  if (/^\[poll:\d+\]$/.test(content)) return false;
  return true;
}
