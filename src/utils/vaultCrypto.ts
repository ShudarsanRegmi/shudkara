/**
 * Shudkara Abhyantara Kosha (Document Vault) - Cryptographic Engine
 * 
 * Cryptographic Specifications (Zero-Knowledge KMS Model):
 * - Bulk Encryption Cipher: AES-256-GCM (256-bit key, 96-bit CSPRNG IV, 128-bit auth tag)
 * - Key Derivation Function (KDF): PBKDF2-HMAC-SHA256, 600,000 iterations (OWASP 2024+ standard)
 * - Per-Document Envelope Encryption: Each document blob encrypted with disposable DEK; DEK wrapped by MVK
 * - Peer-to-Peer Cross-Device Pairing: Ephemeral ECDH (NIST P-256) with derived AES-256-GCM channel
 * 
 * Zero Plaintext Guarantee: No plaintext keys or unencrypted document data are ever persisted.
 */

// ── Base64 & Buffer Conversion Helpers ──────────────────────────────────────────

export function arrayBufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

export function base64ToUint8Array(base64: string): Uint8Array {
  return new Uint8Array(base64ToArrayBuffer(base64));
}

export function generateRandomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

// ── Master Vault Key (MVK) & Data Encryption Key (DEK) Primitives ───────────────

/**
 * Generates a fresh 256-bit AES-GCM Master Vault Key.
 */
export async function generateMasterVaultKey(): Promise<CryptoKey> {
  return await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt', 'wrapKey', 'unwrapKey']
  );
}

/**
 * Generates a fresh disposable 256-bit AES-GCM Data Encryption Key for a single document.
 */
export async function generateDEK(): Promise<CryptoKey> {
  return await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
}

/**
 * Exports a CryptoKey to raw Base64 string (used during ephemeral key wraps).
 */
export async function exportKeyRaw(key: CryptoKey): Promise<string> {
  const exported = await crypto.subtle.exportKey('raw', key);
  return arrayBufferToBase64(exported);
}

/**
 * Imports a raw Base64 key as an AES-GCM CryptoKey.
 */
export async function importKeyRaw(
  rawB64: string,
  keyUsages: KeyUsage[] = ['encrypt', 'decrypt', 'wrapKey', 'unwrapKey']
): Promise<CryptoKey> {
  const keyBytes = base64ToArrayBuffer(rawB64);
  return await crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'AES-GCM', length: 256 },
    true,
    keyUsages
  );
}

// ── Envelope Encryption: DEK Wrapping & Unwrapping ─────────────────────────────

export interface WrappedKeyEnvelope {
  wrappedKeyB64: string;
  ivB64: string;
}

/**
 * Wraps (encrypts) a document DEK using the user's Master Vault Key (MVK).
 */
export async function wrapDEK(dek: CryptoKey, mvk: CryptoKey): Promise<WrappedKeyEnvelope> {
  const iv = generateRandomBytes(12); // 96-bit IV for AES-GCM
  const wrappedKeyBuffer = await crypto.subtle.wrapKey(
    'raw',
    dek,
    mvk,
    { name: 'AES-GCM', iv: iv as BufferSource }
  );
  return {
    wrappedKeyB64: arrayBufferToBase64(wrappedKeyBuffer),
    ivB64: arrayBufferToBase64(iv)
  };
}

/**
 * Unwraps (decrypts) a document DEK using the user's Master Vault Key (MVK).
 */
export async function unwrapDEK(envelope: WrappedKeyEnvelope, mvk: CryptoKey): Promise<CryptoKey> {
  const wrappedKeyBytes = base64ToArrayBuffer(envelope.wrappedKeyB64);
  const ivBytes = base64ToUint8Array(envelope.ivB64);

  return await crypto.subtle.unwrapKey(
    'raw',
    wrappedKeyBytes,
    mvk,
    { name: 'AES-GCM', iv: ivBytes as BufferSource },
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
}

// ── Bulk Data & Blob Encryption with AES-256-GCM ────────────────────────────────

export interface EncryptedPayload {
  ciphertextB64: string;
  ivB64: string;
}

/**
 * Encrypts arbitrary binary buffer or File/Blob using a document DEK.
 */
export async function encryptBuffer(
  data: ArrayBuffer | Uint8Array,
  key: CryptoKey
): Promise<{ ciphertext: ArrayBuffer; iv: Uint8Array }> {
  const iv = generateRandomBytes(12);
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    key,
    data as BufferSource
  );
  return { ciphertext, iv };
}

/**
 * Decrypts an encrypted binary buffer back to plaintext ArrayBuffer.
 */
export async function decryptBuffer(
  ciphertext: ArrayBuffer | Uint8Array,
  iv: ArrayBuffer | Uint8Array,
  key: CryptoKey
): Promise<ArrayBuffer> {
  return await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    key,
    ciphertext as BufferSource
  );
}

/**
 * Encrypts a File or Blob into an encrypted Blob package with IV prepended.
 */
export async function encryptBlob(
  blob: Blob,
  dek: CryptoKey
): Promise<{ encryptedBlob: Blob; ivB64: string; ciphertextB64: string }> {
  const arrayBuf = await blob.arrayBuffer();
  const { ciphertext, iv } = await encryptBuffer(arrayBuf, dek);
  return {
    encryptedBlob: new Blob([ciphertext], { type: 'application/octet-stream' }),
    ivB64: arrayBufferToBase64(iv),
    ciphertextB64: arrayBufferToBase64(ciphertext)
  };
}

/**
 * Decrypts binary ciphertext into a viewable/downloadable Blob with the specified mimeType.
 */
export async function decryptBlob(
  ciphertext: ArrayBuffer | Uint8Array,
  iv: ArrayBuffer | Uint8Array,
  dek: CryptoKey,
  mimeType: string = 'image/jpeg'
): Promise<Blob> {
  const decrypted = await decryptBuffer(ciphertext, iv, dek);
  return new Blob([decrypted], { type: mimeType });
}

/**
 * Encrypts JSON objects or strings to Base64 ciphertext + IV using AES-256-GCM.
 */
export async function encryptJSON<T = any>(data: T, key: CryptoKey): Promise<EncryptedPayload> {
  const jsonStr = JSON.stringify(data);
  const encoder = new TextEncoder();
  const encoded = encoder.encode(jsonStr);
  const { ciphertext, iv } = await encryptBuffer(encoded, key);
  return {
    ciphertextB64: arrayBufferToBase64(ciphertext),
    ivB64: arrayBufferToBase64(iv)
  };
}

/**
 * Decrypts Base64 ciphertext + IV back into parsed JSON.
 */
export async function decryptJSON<T = any>(payload: EncryptedPayload, key: CryptoKey): Promise<T> {
  const ciphertextBytes = base64ToArrayBuffer(payload.ciphertextB64);
  const ivBytes = base64ToUint8Array(payload.ivB64);
  const decryptedBuf = await decryptBuffer(ciphertextBytes, ivBytes, key);
  const decoder = new TextDecoder();
  const jsonStr = decoder.decode(decryptedBuf);
  return JSON.parse(jsonStr) as T;
}

// ── PBKDF2 Master Key Derivation (Laptop Fallback / Passphrase + TOTP) ─────────

/**
 * Derives a 256-bit AES-GCM key from a Master Passphrase + Salt (and optional TOTP code).
 * Uses PBKDF2-HMAC-SHA256 with 600,000 iterations according to OWASP 2024 recommendations.
 */
export async function deriveMVKFromPassphrase(
  passphrase: string,
  salt: Uint8Array,
  totpCode?: string,
  iterations: number = 600000
): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const secretMaterial = totpCode?.trim()
    ? `${passphrase.normalize('NFKC')}:${totpCode.trim()}`
    : passphrase.normalize('NFKC');

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secretMaterial),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  return await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as BufferSource,
      iterations,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt', 'wrapKey', 'unwrapKey']
  );
}

// ── Ephemeral ECDH NIST P-256 Key Exchange (Method A: Companion QR Relay) ──────

export interface ECDHPair {
  keyPair: CryptoKeyPair;
  publicKeyJWK: JsonWebKey;
}

/**
 * Generates an ephemeral ECDH (P-256) keypair for one-time cross-device pairing.
 */
export async function generateEphemeralECDH(): Promise<ECDHPair> {
  const keyPair = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveKey', 'deriveBits']
  );
  const publicKeyJWK = await crypto.subtle.exportKey('jwk', keyPair.publicKey);
  return { keyPair, publicKeyJWK };
}

/**
 * Imports a peer's public key from JWK.
 */
export async function importPeerECDHPublicKey(jwk: JsonWebKey): Promise<CryptoKey> {
  return await crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    []
  );
}

/**
 * Derives a symmetric AES-256-GCM tunnel key from an ECDH private key and peer public key.
 */
export async function deriveECDHSharedSecret(
  privateKey: CryptoKey,
  peerPublicKey: CryptoKey
): Promise<CryptoKey> {
  return await crypto.subtle.deriveKey(
    {
      name: 'ECDH',
      public: peerPublicKey
    },
    privateKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Phone side helper: Encrypts the Master Vault Key (MVK) with the ECDH shared tunnel key.
 */
export async function sealMVKForRelay(mvk: CryptoKey, tunnelKey: CryptoKey): Promise<EncryptedPayload> {
  const rawMvkB64 = await exportKeyRaw(mvk);
  return await encryptJSON({ mvkB64: rawMvkB64 }, tunnelKey);
}

/**
 * Laptop side helper: Unseals the Master Vault Key (MVK) from the relay payload.
 */
export async function unsealMVKFromRelay(payload: EncryptedPayload, tunnelKey: CryptoKey): Promise<CryptoKey> {
  const decrypted = await decryptJSON<{ mvkB64: string }>(payload, tunnelKey);
  return await importKeyRaw(decrypted.mvkB64);
}

// ── WebAuthn / Passkey Biometrics Helpers ─────────────────────────────────────

export function isWebAuthnAvailable(): boolean {
  return typeof window !== 'undefined' &&
    window.PublicKeyCredential !== undefined &&
    typeof window.PublicKeyCredential === 'function';
}

/**
 * Tests if platform biometric authenticator (TouchID, FaceID, Windows Hello, Android Biometric) is supported.
 */
export async function isPlatformBiometricAvailable(): Promise<boolean> {
  if (!isWebAuthnAvailable()) return false;
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}
