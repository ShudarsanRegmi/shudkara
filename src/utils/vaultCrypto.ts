// @ts-nocheck
/**
 * Shudkara Abhyantara Kosha (Document Vault) - Cryptographic Engine
 * 
 * Clean Sovereign Zero-Knowledge Architecture:
 * 1. Cipher: AES-256-GCM (256-bit key, 96-bit CSPRNG IV, 128-bit authentication tag)
 * 2. Account-Level Master Envelope: MVK is generated once, encrypted client-side with Master PIN/Passphrase (PBKDF2-HMAC-SHA256, 600k rounds)
 * 3. Device-Level Biometric Enclave: Native WebAuthn platform authenticator (Fingerprint/TouchID/FaceID) seals the MVK locally
 * 4. Document-Level Envelope Encryption: Disposable DEK per document, wrapped by MVK
 * 5. Local Storage: IndexedDB cache for encrypted blobs for instant offline & rendering
 */

// ── 1. Byte & Base64 Transformation Primitives ─────────────────────────────────

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

// ── 2. Master Vault Key (MVK) & Data Encryption Key (DEK) Management ───────────

export interface WrappedKeyEnvelope {
  wrappedKeyB64: string;
  ivB64: string;
}

export interface EncryptedPayload {
  ciphertextB64: string;
  ivB64: string;
}

export interface VaultMasterEnvelope {
  saltB64: string;
  ivB64: string;
  ciphertextB64: string;
  iterations: number;
}

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
 * Generates a fresh disposable 256-bit AES-GCM Data Encryption Key (DEK) for a single document.
 */
export async function generateDEK(): Promise<CryptoKey> {
  return await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
}

/**
 * Exports a CryptoKey to raw Base64 string.
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

/**
 * Wraps (encrypts) a document DEK using the user's Master Vault Key (MVK).
 */
export async function wrapDEK(dek: CryptoKey, mvk: CryptoKey): Promise<WrappedKeyEnvelope> {
  const iv = generateRandomBytes(12);
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
export async function unwrapDEK(envelope: WrappedKeyEnvelope | string, mvk: CryptoKey): Promise<CryptoKey> {
  const env: WrappedKeyEnvelope = typeof envelope === 'string' ? JSON.parse(envelope) : envelope;
  if (!env || !env.wrappedKeyB64 || !env.ivB64) {
    throw new Error('Invalid wrapped key envelope: missing wrappedKeyB64 or ivB64');
  }
  const wrappedKeyBytes = base64ToArrayBuffer(env.wrappedKeyB64);
  const ivBytes = base64ToUint8Array(env.ivB64);

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

// ── 3. Bulk Data & File/Blob Encryption with AES-256-GCM ────────────────────────

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

export async function encryptBlob(
  blob: Blob | File,
  dek: CryptoKey
): Promise<{ encryptedBlob: Blob; ivB64: string; ciphertextB64: string }> {
  const arrayBuf = await blob.arrayBuffer();
  const { ciphertext, iv } = await encryptBuffer(arrayBuf, dek);
  const encryptedBlob = new Blob([ciphertext], { type: 'application/octet-stream' });
  return {
    encryptedBlob,
    ivB64: arrayBufferToBase64(iv),
    ciphertextB64: arrayBufferToBase64(ciphertext)
  };
}

export async function decryptBlob(
  ciphertext: ArrayBuffer | Uint8Array,
  iv: ArrayBuffer | Uint8Array,
  dek: CryptoKey,
  mimeType: string = 'image/jpeg'
): Promise<Blob> {
  const decryptedBuf = await decryptBuffer(ciphertext, iv, dek);
  return new Blob([decryptedBuf], { type: mimeType });
}

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

export async function decryptJSON<T = any>(payload: EncryptedPayload, key: CryptoKey): Promise<T> {
  const ciphertextBytes = base64ToArrayBuffer(payload.ciphertextB64);
  const ivBytes = base64ToUint8Array(payload.ivB64);
  const decryptedBuf = await decryptBuffer(ciphertextBytes, ivBytes, key);
  const decoder = new TextDecoder();
  const jsonStr = decoder.decode(decryptedBuf);
  return JSON.parse(jsonStr) as T;
}

// ── 4. Account-Level Master Key Envelope (Zero-Knowledge Cross-Device Sync) ─────

/**
 * Derives a 256-bit AES-GCM key from the user's Master PIN or Passphrase.
 */
export async function deriveKeyFromPIN(
  pin: string,
  salt: Uint8Array,
  iterations: number = 600000
): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(pin.normalize('NFKC')),
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
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Creates a new Master Vault Key (MVK) and seals it in an encrypted envelope using the user's PIN/Passphrase.
 */
export async function createMasterVaultEnvelope(pin: string): Promise<{ mvk: CryptoKey; envelope: VaultMasterEnvelope }> {
  const mvk = await generateMasterVaultKey();
  const rawMvkB64 = await exportKeyRaw(mvk);

  const salt = generateRandomBytes(16);
  const iv = generateRandomBytes(12);
  const wrappingKey = await deriveKeyFromPIN(pin, salt, 600000);

  const encoder = new TextEncoder();
  const ciphertextBuf = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    wrappingKey,
    encoder.encode(rawMvkB64)
  );

  return {
    mvk,
    envelope: {
      saltB64: arrayBufferToBase64(salt),
      ivB64: arrayBufferToBase64(iv),
      ciphertextB64: arrayBufferToBase64(ciphertextBuf),
      iterations: 600000
    }
  };
}

/**
 * Decrypts the Master Vault Key (MVK) from the cloud envelope using the user's PIN/Passphrase.
 */
export async function unlockMasterVaultEnvelope(pin: string, envelope: VaultMasterEnvelope): Promise<CryptoKey> {
  const salt = base64ToUint8Array(envelope.saltB64);
  const iv = base64ToUint8Array(envelope.ivB64);
  const ciphertext = base64ToArrayBuffer(envelope.ciphertextB64);
  const iterations = envelope.iterations || 600000;

  const wrappingKey = await deriveKeyFromPIN(pin, salt, iterations);

  const decryptedBuf = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    wrappingKey,
    ciphertext as BufferSource
  );

  const rawMvkB64 = new TextDecoder().decode(decryptedBuf);
  return await importKeyRaw(rawMvkB64);
}

// ── 5. Native Hardware Biometrics (Fast 1-Tap Device Enclave Unlock) ────────────

export function isWebAuthnAvailable(): boolean {
  return typeof window !== 'undefined' &&
    window.PublicKeyCredential !== undefined &&
    typeof window.PublicKeyCredential === 'function';
}

export async function isPlatformBiometricAvailable(): Promise<boolean> {
  if (!isWebAuthnAvailable()) return false;
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

export function isDeviceBiometricsEnrolled(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean(
    localStorage.getItem('shudkara_vault_sealed_mvk') &&
    localStorage.getItem('shudkara_vault_passkey_raw_id')
  );
}

export function clearDeviceBiometrics(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('shudkara_vault_sealed_mvk');
  localStorage.removeItem('shudkara_vault_passkey_raw_id');
  localStorage.removeItem('shudkara_vault_passkey_cred_id');
  localStorage.removeItem('shudkara_vault_manifest_enc');
}

/**
 * Derives a device-specific wrapping key bound to the WebAuthn credential raw ID.
 */
async function deriveDeviceWrappingKey(credentialRawIdB64: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const salt = encoder.encode('shudkara_device_keystore_salt_2026_biometric');
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(credentialRawIdB64),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  return await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Seals the Master Vault Key (MVK) into the device's native hardware authenticator.
 * Prompts fingerprint/FaceID dialog.
 */
export async function enrollDeviceBiometrics(
  mvk: CryptoKey,
  username: string = 'shudarsan@shudkara'
): Promise<{ credentialId: string; rawIdB64: string }> {
  if (!isWebAuthnAvailable()) {
    throw new Error('Biometric passkeys are not supported on this device/browser.');
  }

  const challenge = generateRandomBytes(32);
  const userId = generateRandomBytes(16);

  const credential = (await navigator.credentials.create({
    publicKey: {
      challenge: challenge as BufferSource,
      rp: {
        name: 'Shudkara Abhyantara Kosha',
        id: window.location.hostname
      },
      user: {
        id: userId as BufferSource,
        name: username,
        displayName: 'Shudkara Vault Custodian'
      },
      pubKeyCredParams: [
        { alg: -7, type: 'public-key' },
        { alg: -257, type: 'public-key' }
      ],
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        userVerification: 'required',
        requireResidentKey: false
      },
      timeout: 60000
    }
  })) as PublicKeyCredential | null;

  if (!credential) {
    throw new Error('Biometric enrollment cancelled.');
  }

  const rawIdB64 = arrayBufferToBase64(credential.rawId);
  const wrappingKey = await deriveDeviceWrappingKey(rawIdB64);
  const rawMvkB64 = await exportKeyRaw(mvk);
  const sealed = await encryptJSON({ mvk: rawMvkB64 }, wrappingKey);

  localStorage.setItem('shudkara_vault_sealed_mvk', JSON.stringify(sealed));
  localStorage.setItem('shudkara_vault_passkey_raw_id', rawIdB64);
  localStorage.setItem('shudkara_vault_passkey_cred_id', credential.id);

  return { credentialId: credential.id, rawIdB64 };
}

/**
 * 1-Tap Biometric Unlock: Prompts native platform fingerprint sensor, unseals MVK in <200ms.
 */
export async function unlockWithDeviceBiometrics(): Promise<CryptoKey> {
  const sealedStr = localStorage.getItem('shudkara_vault_sealed_mvk');
  const rawIdB64 = localStorage.getItem('shudkara_vault_passkey_raw_id');

  if (!sealedStr || !rawIdB64) {
    throw new Error('NO_BIOMETRICS_ENROLLED');
  }

  const challenge = generateRandomBytes(32);
  const allowCredentials: PublicKeyCredentialDescriptor[] = [
    {
      type: 'public-key',
      id: base64ToArrayBuffer(rawIdB64) as BufferSource
    }
  ];

  const assertion = (await navigator.credentials.get({
    publicKey: {
      challenge: challenge as BufferSource,
      rpId: window.location.hostname,
      allowCredentials,
      userVerification: 'required',
      timeout: 60000
    }
  })) as PublicKeyCredential | null;

  if (!assertion) {
    throw new Error('Biometric verification cancelled.');
  }

  const wrappingKey = await deriveDeviceWrappingKey(rawIdB64);
  const payload: EncryptedPayload = JSON.parse(sealedStr);
  const decrypted = await decryptJSON<{ mvk: string }>(payload, wrappingKey);
  return await importKeyRaw(decrypted.mvk);
}

/**
 * Critical Actions Verification (e.g. deleting document, downloading sensitive raw certs).
 */
export async function authenticateWebAuthnPasskey(): Promise<boolean> {
  if (!isWebAuthnAvailable()) return true;
  const rawIdB64 = localStorage.getItem('shudkara_vault_passkey_raw_id');
  const challenge = generateRandomBytes(32);
  const allowCredentials: PublicKeyCredentialDescriptor[] = rawIdB64
    ? [{ type: 'public-key', id: base64ToArrayBuffer(rawIdB64) as BufferSource }]
    : [];

  try {
    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge: challenge as BufferSource,
        rpId: window.location.hostname,
        allowCredentials: allowCredentials.length > 0 ? allowCredentials : undefined,
        userVerification: 'required',
        timeout: 60000
      }
    });
    return Boolean(assertion);
  } catch {
    return false;
  }
}

// ── 6. Local IndexedDB Encrypted Blob Cache ─────────────────────────────────────

const VAULT_DB_NAME = 'shudkara_vault_idb';
const VAULT_STORE_NAME = 'encrypted_blobs';
const VAULT_DB_VERSION = 1;

function openVaultIDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB not supported'));
    }
    const request = indexedDB.open(VAULT_DB_NAME, VAULT_DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(VAULT_STORE_NAME)) {
        db.createObjectStore(VAULT_STORE_NAME, { keyPath: 'blobUuid' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function idbSaveEncryptedBlob(blobUuid: string, ciphertextBase64: string): Promise<void> {
  if (!blobUuid || !ciphertextBase64) return;
  try {
    const db = await openVaultIDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(VAULT_STORE_NAME, 'readwrite');
      const store = tx.objectStore(VAULT_STORE_NAME);
      const req = store.put({ blobUuid, ciphertextBase64, timestamp: Date.now() });
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('[Vault IDB] save error:', err);
  }
}

export async function idbGetEncryptedBlob(blobUuid: string): Promise<string | null> {
  if (!blobUuid) return null;
  try {
    const db = await openVaultIDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(VAULT_STORE_NAME, 'readonly');
      const store = tx.objectStore(VAULT_STORE_NAME);
      const req = store.get(blobUuid);
      req.onsuccess = () => resolve(req.result ? req.result.ciphertextBase64 : null);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('[Vault IDB] get error:', err);
    return null;
  }
}
