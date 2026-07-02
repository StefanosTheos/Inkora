// WebCrypto shim for Hermes (React Native). Supabase auth generates the PKCE
// S256 code challenge with `crypto.subtle.digest` + `TextEncoder`; Hermes ships
// neither, so auth-js warns and downgrades to the "plain" method. Backing them
// with expo-crypto silences the warning AND enables real SHA-256 PKCE.
//
// Must be imported before the Supabase client is created (see supabase.ts).
import * as ExpoCrypto from "expo-crypto";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const g = globalThis as any;

// --- TextEncoder (minimal UTF-8) -------------------------------------------
if (typeof g.TextEncoder === "undefined") {
  g.TextEncoder = class {
    readonly encoding = "utf-8";
    encode(input = ""): Uint8Array {
      const utf8 = unescape(encodeURIComponent(input));
      const bytes = new Uint8Array(utf8.length);
      for (let i = 0; i < utf8.length; i++) bytes[i] = utf8.charCodeAt(i);
      return bytes;
    }
  };
}

// --- crypto.getRandomValues + crypto.subtle.digest -------------------------
if (typeof g.crypto === "undefined") g.crypto = {};

if (typeof g.crypto.getRandomValues !== "function") {
  g.crypto.getRandomValues = <T extends ArrayBufferView | null>(array: T): T =>
    (array ? (ExpoCrypto.getRandomValues(array as unknown as Uint8Array) as unknown as T) : array);
}

if (typeof g.crypto.subtle === "undefined") {
  const ALGOS: Record<string, ExpoCrypto.CryptoDigestAlgorithm> = {
    "SHA-1": ExpoCrypto.CryptoDigestAlgorithm.SHA1,
    "SHA-256": ExpoCrypto.CryptoDigestAlgorithm.SHA256,
    "SHA-384": ExpoCrypto.CryptoDigestAlgorithm.SHA384,
    "SHA-512": ExpoCrypto.CryptoDigestAlgorithm.SHA512,
  };
  g.crypto.subtle = {
    async digest(algorithm: string | { name: string }, data: ArrayBuffer | ArrayBufferView): Promise<ArrayBuffer> {
      const name = (typeof algorithm === "string" ? algorithm : algorithm.name).toUpperCase();
      const algo = ALGOS[name];
      if (!algo) throw new Error(`Unsupported digest algorithm: ${name}`);
      const src =
        data instanceof ArrayBuffer
          ? new Uint8Array(data)
          : new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
      const bytes = new Uint8Array(src.length); // fresh ArrayBuffer-backed copy
      bytes.set(src);
      return ExpoCrypto.digest(algo, bytes);
    },
  };
}
