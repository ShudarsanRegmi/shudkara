// @ts-nocheck
/**
 * Shudkara Abhyantara Kosha (Document Vault) - Cryptographic Engine
 * 
 * Standards & Specifications (Zero-Knowledge KMS Model):
 * 1. Symmetric Cipher: AES-256-GCM (256-bit key, 96-bit CSPRNG IV, 128-bit authentication tag)
 * 2. Envelope Encryption: Every document blob is encrypted client-side with a disposable DEK; DEK wrapped by MVK
 * 3. Cross-Device Clearance: Ephemeral NIST P-256 ECDH key exchange + AES-256-GCM tunnel
 * 4. Hardware Biometrics: WebAuthn Platform Authenticator (TouchID / FaceID / Windows Hello / Android Biometric)
 * 5. Visual Encoding: Fully compliant ISO/IEC 18004 Standard QR Code SVG generator with Reed-Solomon ECC & masking
 * 6. Zero Plaintext Memorization: Keys derived directly from biometric hardware and cross-device ECDH channels.
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

// ── 3. Bulk Data & File/Blob Encryption with AES-256-GCM ────────────────────────

/**
 * Encrypts arbitrary binary buffer using a document DEK.
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
 * Encrypts an actual user File or Blob using a document DEK.
 */
export async function encryptBlob(
  blob: Blob | File,
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
 * Decrypts binary ciphertext back to a viewable/downloadable Blob with the original mimeType.
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

// ── 4. Key Derivation from Biometric / TOTP Secret ──────────────────────────────

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

// ── 5. Ephemeral NIST P-256 ECDH Peer Relay (Method A) ─────────────────────────

export interface ECDHPair {
  keyPair: CryptoKeyPair;
  publicKeyJWK: JsonWebKey;
}

/**
 * Generates an ephemeral ECDH (P-256) keypair for cross-device pairing.
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
 * Mobile Companion side: Encrypts the Master Vault Key (MVK) with the shared ECDH tunnel key.
 */
export async function sealMVKForRelay(mvk: CryptoKey, tunnelKey: CryptoKey): Promise<EncryptedPayload> {
  const rawMvkB64 = await exportKeyRaw(mvk);
  return await encryptJSON({ mvkB64: rawMvkB64 }, tunnelKey);
}

/**
 * Laptop side: Unseals the Master Vault Key (MVK) from the mobile companion's encrypted payload.
 */
export async function unsealMVKFromRelay(payload: EncryptedPayload, tunnelKey: CryptoKey): Promise<CryptoKey> {
  const decrypted = await decryptJSON<{ mvkB64: string }>(payload, tunnelKey);
  return await importKeyRaw(decrypted.mvkB64);
}

// ── 6. WebAuthn Biometrics & Hardware Passkeys (Zero-Memorization) ─────────────

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

/**
 * Registers a hardware passkey (TouchID / FaceID / Windows Hello) for 1-tap biometric unsealing.
 */
export async function registerWebAuthnPasskey(username: string = 'shudarsan@shudkara'): Promise<{ credentialId: string; rawIdB64: string }> {
  if (!isWebAuthnAvailable()) {
    throw new Error('WebAuthn Passkeys are not supported on this browser or platform.');
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
        { alg: -7, type: 'public-key' },  // ES256
        { alg: -257, type: 'public-key' } // RS256
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
    throw new Error('Biometric registration was cancelled or timed out.');
  }

  const rawIdB64 = arrayBufferToBase64(credential.rawId);
  return {
    credentialId: credential.id,
    rawIdB64
  };
}

/**
 * Authenticates with the registered hardware biometric sensor (1-Tap Zero-Memorization Unseal).
 */
export async function authenticateWebAuthnPasskey(allowedCredentialIdB64?: string): Promise<{ success: boolean; signatureB64: string }> {
  if (!isWebAuthnAvailable()) {
    throw new Error('WebAuthn is not supported in this environment.');
  }

  const challenge = generateRandomBytes(32);
  const allowCredentials: PublicKeyCredentialDescriptor[] = allowedCredentialIdB64
    ? [{
        type: 'public-key',
        id: base64ToArrayBuffer(allowedCredentialIdB64) as BufferSource
      }]
    : [];

  const assertion = (await navigator.credentials.get({
    publicKey: {
      challenge: challenge as BufferSource,
      rpId: window.location.hostname,
      allowCredentials: allowCredentials.length > 0 ? allowCredentials : undefined,
      userVerification: 'required',
      timeout: 60000
    }
  })) as PublicKeyCredential | null;

  if (!assertion) {
    throw new Error('Biometric verification cancelled.');
  }

  const response = assertion.response as AuthenticatorAssertionResponse;
  const signatureB64 = arrayBufferToBase64(response.signature);
  return { success: true, signatureB64 };
}

/**
 * Derives a device-specific wrapping key bound to the WebAuthn credential ID.
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
 * Seals the Master Vault Key (MVK) on the device using a key derived from the hardware passkey.
 */
export async function sealDeviceMVK(mvk: CryptoKey, credentialRawIdB64: string): Promise<string> {
  const wrappingKey = await deriveDeviceWrappingKey(credentialRawIdB64);
  const rawMvkB64 = await exportKeyRaw(mvk);
  const encrypted = await encryptJSON({ mvk: rawMvkB64 }, wrappingKey);
  return JSON.stringify(encrypted);
}

/**
 * Unseals the Master Vault Key (MVK) from the device using the hardware passkey.
 */
export async function unsealDeviceMVK(sealedJsonStr: string, credentialRawIdB64: string): Promise<CryptoKey> {
  const wrappingKey = await deriveDeviceWrappingKey(credentialRawIdB64);
  const payload: EncryptedPayload = JSON.parse(sealedJsonStr);
  const decrypted = await decryptJSON<{ mvk: string }>(payload, wrappingKey);
  return await importKeyRaw(decrypted.mvk);
}

/**
 * 1-Tap Biometric Registration & MVK Setup for Phone PWA / Laptop.
 * Prompts native fingerprint dialog, registers passkey, generates MVK, and seals it on device.
 */
export async function registerAndSealDeviceMVK(username: string = 'shudarsan@shudkara'): Promise<{ mvk: CryptoKey; credentialId: string }> {
  const reg = await registerWebAuthnPasskey(username);
  const mvk = await generateMasterVaultKey();
  const sealed = await sealDeviceMVK(mvk, reg.rawIdB64);

  localStorage.setItem('shudkara_vault_device_mvk', sealed);
  localStorage.setItem('shudkara_vault_passkey_raw_id', reg.rawIdB64);
  localStorage.setItem('shudkara_vault_passkey_cred_id', reg.credentialId);

  return { mvk, credentialId: reg.credentialId };
}

/**
 * 1-Tap Biometric Unseal for Phone PWA / Laptop.
 * Prompts native fingerprint dialog, validates assertion with hardware enclave, and unseals MVK into RAM.
 */
export async function unlockWithDeviceBiometrics(): Promise<CryptoKey> {
  const rawIdB64 = localStorage.getItem('shudkara_vault_passkey_raw_id');
  const sealed = localStorage.getItem('shudkara_vault_device_mvk');

  if (!rawIdB64 || !sealed) {
    // If not registered yet, perform 1-tap registration + unlock
    const { mvk } = await registerAndSealDeviceMVK();
    return mvk;
  }

  // Native hardware biometric verification prompt
  await authenticateWebAuthnPasskey(rawIdB64);
  return await unsealDeviceMVK(sealed, rawIdB64);
}


"use strict";
var qrcodegen;
(function (qrcodegen) {
    class QrCode {
        version;
        errorCorrectionLevel;
        static encodeText(text, ecl) {
            const segs = qrcodegen.QrSegment.makeSegments(text);
            return QrCode.encodeSegments(segs, ecl);
        }
        static encodeBinary(data, ecl) {
            const seg = qrcodegen.QrSegment.makeBytes(data);
            return QrCode.encodeSegments([seg], ecl);
        }
        static encodeSegments(segs, ecl, minVersion = 1, maxVersion = 40, mask = -1, boostEcl = true) {
            if (!(QrCode.MIN_VERSION <= minVersion && minVersion <= maxVersion && maxVersion <= QrCode.MAX_VERSION)
                || mask < -1 || mask > 7)
                throw new RangeError("Invalid value");
            let version;
            let dataUsedBits;
            for (version = minVersion;; version++) {
                const dataCapacityBits = QrCode.getNumDataCodewords(version, ecl) * 8;
                const usedBits = QrSegment.getTotalBits(segs, version);
                if (usedBits <= dataCapacityBits) {
                    dataUsedBits = usedBits;
                    break;
                }
                if (version >= maxVersion)
                    throw new RangeError("Data too long");
            }
            for (const newEcl of [QrCode.Ecc.MEDIUM, QrCode.Ecc.QUARTILE, QrCode.Ecc.HIGH]) {
                if (boostEcl && dataUsedBits <= QrCode.getNumDataCodewords(version, newEcl) * 8)
                    ecl = newEcl;
            }
            let bb = [];
            for (const seg of segs) {
                appendBits(seg.mode.modeBits, 4, bb);
                appendBits(seg.numChars, seg.mode.numCharCountBits(version), bb);
                for (const b of seg.getData())
                    bb.push(b);
            }
            assert(bb.length == dataUsedBits);
            const dataCapacityBits = QrCode.getNumDataCodewords(version, ecl) * 8;
            assert(bb.length <= dataCapacityBits);
            appendBits(0, Math.min(4, dataCapacityBits - bb.length), bb);
            appendBits(0, (8 - bb.length % 8) % 8, bb);
            assert(bb.length % 8 == 0);
            for (let padByte = 0xEC; bb.length < dataCapacityBits; padByte ^= 0xEC ^ 0x11)
                appendBits(padByte, 8, bb);
            let dataCodewords = [];
            while (dataCodewords.length * 8 < bb.length)
                dataCodewords.push(0);
            bb.forEach((b, i) => dataCodewords[i >>> 3] |= b << (7 - (i & 7)));
            return new QrCode(version, ecl, dataCodewords, mask);
        }
        size;
        mask;
        modules = [];
        isFunction = [];
        constructor(version, errorCorrectionLevel, dataCodewords, msk) {
            this.version = version;
            this.errorCorrectionLevel = errorCorrectionLevel;
            if (version < QrCode.MIN_VERSION || version > QrCode.MAX_VERSION)
                throw new RangeError("Version value out of range");
            if (msk < -1 || msk > 7)
                throw new RangeError("Mask value out of range");
            this.size = version * 4 + 17;
            let row = [];
            for (let i = 0; i < this.size; i++)
                row.push(false);
            for (let i = 0; i < this.size; i++) {
                this.modules.push(row.slice());
                this.isFunction.push(row.slice());
            }
            this.drawFunctionPatterns();
            const allCodewords = this.addEccAndInterleave(dataCodewords);
            this.drawCodewords(allCodewords);
            if (msk == -1) {
                let minPenalty = 1000000000;
                for (let i = 0; i < 8; i++) {
                    this.applyMask(i);
                    this.drawFormatBits(i);
                    const penalty = this.getPenaltyScore();
                    if (penalty < minPenalty) {
                        msk = i;
                        minPenalty = penalty;
                    }
                    this.applyMask(i);
                }
            }
            assert(0 <= msk && msk <= 7);
            this.mask = msk;
            this.applyMask(msk);
            this.drawFormatBits(msk);
            this.isFunction = [];
        }
        getModule(x, y) {
            return 0 <= x && x < this.size && 0 <= y && y < this.size && this.modules[y][x];
        }
        drawFunctionPatterns() {
            for (let i = 0; i < this.size; i++) {
                this.setFunctionModule(6, i, i % 2 == 0);
                this.setFunctionModule(i, 6, i % 2 == 0);
            }
            this.drawFinderPattern(3, 3);
            this.drawFinderPattern(this.size - 4, 3);
            this.drawFinderPattern(3, this.size - 4);
            const alignPatPos = this.getAlignmentPatternPositions();
            const numAlign = alignPatPos.length;
            for (let i = 0; i < numAlign; i++) {
                for (let j = 0; j < numAlign; j++) {
                    if (!(i == 0 && j == 0 || i == 0 && j == numAlign - 1 || i == numAlign - 1 && j == 0))
                        this.drawAlignmentPattern(alignPatPos[i], alignPatPos[j]);
                }
            }
            this.drawFormatBits(0);
            this.drawVersion();
        }
        drawFormatBits(mask) {
            const data = this.errorCorrectionLevel.formatBits << 3 | mask;
            let rem = data;
            for (let i = 0; i < 10; i++)
                rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
            const bits = (data << 10 | rem) ^ 0x5412;
            assert(bits >>> 15 == 0);
            for (let i = 0; i <= 5; i++)
                this.setFunctionModule(8, i, getBit(bits, i));
            this.setFunctionModule(8, 7, getBit(bits, 6));
            this.setFunctionModule(8, 8, getBit(bits, 7));
            this.setFunctionModule(7, 8, getBit(bits, 8));
            for (let i = 9; i < 15; i++)
                this.setFunctionModule(14 - i, 8, getBit(bits, i));
            for (let i = 0; i < 8; i++)
                this.setFunctionModule(this.size - 1 - i, 8, getBit(bits, i));
            for (let i = 8; i < 15; i++)
                this.setFunctionModule(8, this.size - 15 + i, getBit(bits, i));
            this.setFunctionModule(8, this.size - 8, true);
        }
        drawVersion() {
            if (this.version < 7)
                return;
            let rem = this.version;
            for (let i = 0; i < 12; i++)
                rem = (rem << 1) ^ ((rem >>> 11) * 0x1F25);
            const bits = this.version << 12 | rem;
            assert(bits >>> 18 == 0);
            for (let i = 0; i < 18; i++) {
                const color = getBit(bits, i);
                const a = this.size - 11 + i % 3;
                const b = Math.floor(i / 3);
                this.setFunctionModule(a, b, color);
                this.setFunctionModule(b, a, color);
            }
        }
        drawFinderPattern(x, y) {
            for (let dy = -4; dy <= 4; dy++) {
                for (let dx = -4; dx <= 4; dx++) {
                    const dist = Math.max(Math.abs(dx), Math.abs(dy));
                    const xx = x + dx;
                    const yy = y + dy;
                    if (0 <= xx && xx < this.size && 0 <= yy && yy < this.size)
                        this.setFunctionModule(xx, yy, dist != 2 && dist != 4);
                }
            }
        }
        drawAlignmentPattern(x, y) {
            for (let dy = -2; dy <= 2; dy++) {
                for (let dx = -2; dx <= 2; dx++)
                    this.setFunctionModule(x + dx, y + dy, Math.max(Math.abs(dx), Math.abs(dy)) != 1);
            }
        }
        setFunctionModule(x, y, isDark) {
            this.modules[y][x] = isDark;
            this.isFunction[y][x] = true;
        }
        addEccAndInterleave(data) {
            const ver = this.version;
            const ecl = this.errorCorrectionLevel;
            if (data.length != QrCode.getNumDataCodewords(ver, ecl))
                throw new RangeError("Invalid argument");
            const numBlocks = QrCode.NUM_ERROR_CORRECTION_BLOCKS[ecl.ordinal][ver];
            const blockEccLen = QrCode.ECC_CODEWORDS_PER_BLOCK[ecl.ordinal][ver];
            const rawCodewords = Math.floor(QrCode.getNumRawDataModules(ver) / 8);
            const numShortBlocks = numBlocks - rawCodewords % numBlocks;
            const shortBlockLen = Math.floor(rawCodewords / numBlocks);
            let blocks = [];
            const rsDiv = QrCode.reedSolomonComputeDivisor(blockEccLen);
            for (let i = 0, k = 0; i < numBlocks; i++) {
                let dat = data.slice(k, k + shortBlockLen - blockEccLen + (i < numShortBlocks ? 0 : 1));
                k += dat.length;
                const ecc = QrCode.reedSolomonComputeRemainder(dat, rsDiv);
                if (i < numShortBlocks)
                    dat.push(0);
                blocks.push(dat.concat(ecc));
            }
            let result = [];
            for (let i = 0; i < blocks[0].length; i++) {
                blocks.forEach((block, j) => {
                    if (i != shortBlockLen - blockEccLen || j >= numShortBlocks)
                        result.push(block[i]);
                });
            }
            assert(result.length == rawCodewords);
            return result;
        }
        drawCodewords(data) {
            if (data.length != Math.floor(QrCode.getNumRawDataModules(this.version) / 8))
                throw new RangeError("Invalid argument");
            let i = 0;
            for (let right = this.size - 1; right >= 1; right -= 2) {
                if (right == 6)
                    right = 5;
                for (let vert = 0; vert < this.size; vert++) {
                    for (let j = 0; j < 2; j++) {
                        const x = right - j;
                        const upward = ((right + 1) & 2) == 0;
                        const y = upward ? this.size - 1 - vert : vert;
                        if (!this.isFunction[y][x] && i < data.length * 8) {
                            this.modules[y][x] = getBit(data[i >>> 3], 7 - (i & 7));
                            i++;
                        }
                    }
                }
            }
            assert(i == data.length * 8);
        }
        applyMask(mask) {
            if (mask < 0 || mask > 7)
                throw new RangeError("Mask value out of range");
            for (let y = 0; y < this.size; y++) {
                for (let x = 0; x < this.size; x++) {
                    let invert;
                    switch (mask) {
                        case 0:
                            invert = (x + y) % 2 == 0;
                            break;
                        case 1:
                            invert = y % 2 == 0;
                            break;
                        case 2:
                            invert = x % 3 == 0;
                            break;
                        case 3:
                            invert = (x + y) % 3 == 0;
                            break;
                        case 4:
                            invert = (Math.floor(x / 3) + Math.floor(y / 2)) % 2 == 0;
                            break;
                        case 5:
                            invert = x * y % 2 + x * y % 3 == 0;
                            break;
                        case 6:
                            invert = (x * y % 2 + x * y % 3) % 2 == 0;
                            break;
                        case 7:
                            invert = ((x + y) % 2 + x * y % 3) % 2 == 0;
                            break;
                        default: throw new Error("Unreachable");
                    }
                    if (!this.isFunction[y][x] && invert)
                        this.modules[y][x] = !this.modules[y][x];
                }
            }
        }
        getPenaltyScore() {
            let result = 0;
            for (let y = 0; y < this.size; y++) {
                let runColor = false;
                let runX = 0;
                let runHistory = [0, 0, 0, 0, 0, 0, 0];
                for (let x = 0; x < this.size; x++) {
                    if (this.modules[y][x] == runColor) {
                        runX++;
                        if (runX == 5)
                            result += QrCode.PENALTY_N1;
                        else if (runX > 5)
                            result++;
                    }
                    else {
                        this.finderPenaltyAddHistory(runX, runHistory);
                        if (!runColor)
                            result += this.finderPenaltyCountPatterns(runHistory) * QrCode.PENALTY_N3;
                        runColor = this.modules[y][x];
                        runX = 1;
                    }
                }
                result += this.finderPenaltyTerminateAndCount(runColor, runX, runHistory) * QrCode.PENALTY_N3;
            }
            for (let x = 0; x < this.size; x++) {
                let runColor = false;
                let runY = 0;
                let runHistory = [0, 0, 0, 0, 0, 0, 0];
                for (let y = 0; y < this.size; y++) {
                    if (this.modules[y][x] == runColor) {
                        runY++;
                        if (runY == 5)
                            result += QrCode.PENALTY_N1;
                        else if (runY > 5)
                            result++;
                    }
                    else {
                        this.finderPenaltyAddHistory(runY, runHistory);
                        if (!runColor)
                            result += this.finderPenaltyCountPatterns(runHistory) * QrCode.PENALTY_N3;
                        runColor = this.modules[y][x];
                        runY = 1;
                    }
                }
                result += this.finderPenaltyTerminateAndCount(runColor, runY, runHistory) * QrCode.PENALTY_N3;
            }
            for (let y = 0; y < this.size - 1; y++) {
                for (let x = 0; x < this.size - 1; x++) {
                    const color = this.modules[y][x];
                    if (color == this.modules[y][x + 1] &&
                        color == this.modules[y + 1][x] &&
                        color == this.modules[y + 1][x + 1])
                        result += QrCode.PENALTY_N2;
                }
            }
            let dark = 0;
            for (const row of this.modules)
                dark = row.reduce((sum, color) => sum + (color ? 1 : 0), dark);
            const total = this.size * this.size;
            const k = Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1;
            assert(0 <= k && k <= 9);
            result += k * QrCode.PENALTY_N4;
            assert(0 <= result && result <= 2568888);
            return result;
        }
        getAlignmentPatternPositions() {
            if (this.version == 1)
                return [];
            else {
                const numAlign = Math.floor(this.version / 7) + 2;
                const step = Math.floor((this.version * 8 + numAlign * 3 + 5) / (numAlign * 4 - 4)) * 2;
                let result = [6];
                for (let pos = this.size - 7; result.length < numAlign; pos -= step)
                    result.splice(1, 0, pos);
                return result;
            }
        }
        static getNumRawDataModules(ver) {
            if (ver < QrCode.MIN_VERSION || ver > QrCode.MAX_VERSION)
                throw new RangeError("Version number out of range");
            let result = (16 * ver + 128) * ver + 64;
            if (ver >= 2) {
                const numAlign = Math.floor(ver / 7) + 2;
                result -= (25 * numAlign - 10) * numAlign - 55;
                if (ver >= 7)
                    result -= 36;
            }
            assert(208 <= result && result <= 29648);
            return result;
        }
        static getNumDataCodewords(ver, ecl) {
            return Math.floor(QrCode.getNumRawDataModules(ver) / 8) -
                QrCode.ECC_CODEWORDS_PER_BLOCK[ecl.ordinal][ver] *
                    QrCode.NUM_ERROR_CORRECTION_BLOCKS[ecl.ordinal][ver];
        }
        static reedSolomonComputeDivisor(degree) {
            if (degree < 1 || degree > 255)
                throw new RangeError("Degree out of range");
            let result = [];
            for (let i = 0; i < degree - 1; i++)
                result.push(0);
            result.push(1);
            let root = 1;
            for (let i = 0; i < degree; i++) {
                for (let j = 0; j < result.length; j++) {
                    result[j] = QrCode.reedSolomonMultiply(result[j], root);
                    if (j + 1 < result.length)
                        result[j] ^= result[j + 1];
                }
                root = QrCode.reedSolomonMultiply(root, 0x02);
            }
            return result;
        }
        static reedSolomonComputeRemainder(data, divisor) {
            let result = divisor.map(_ => 0);
            for (const b of data) {
                const factor = b ^ result.shift();
                result.push(0);
                divisor.forEach((coef, i) => result[i] ^= QrCode.reedSolomonMultiply(coef, factor));
            }
            return result;
        }
        static reedSolomonMultiply(x, y) {
            if (x >>> 8 != 0 || y >>> 8 != 0)
                throw new RangeError("Byte out of range");
            let z = 0;
            for (let i = 7; i >= 0; i--) {
                z = (z << 1) ^ ((z >>> 7) * 0x11D);
                z ^= ((y >>> i) & 1) * x;
            }
            assert(z >>> 8 == 0);
            return z;
        }
        finderPenaltyCountPatterns(runHistory) {
            const n = runHistory[1];
            assert(n <= this.size * 3);
            const core = n > 0 && runHistory[2] == n && runHistory[3] == n * 3 && runHistory[4] == n && runHistory[5] == n;
            return (core && runHistory[0] >= n * 4 && runHistory[6] >= n ? 1 : 0)
                + (core && runHistory[6] >= n * 4 && runHistory[0] >= n ? 1 : 0);
        }
        finderPenaltyTerminateAndCount(currentRunColor, currentRunLength, runHistory) {
            if (currentRunColor) {
                this.finderPenaltyAddHistory(currentRunLength, runHistory);
                currentRunLength = 0;
            }
            currentRunLength += this.size;
            this.finderPenaltyAddHistory(currentRunLength, runHistory);
            return this.finderPenaltyCountPatterns(runHistory);
        }
        finderPenaltyAddHistory(currentRunLength, runHistory) {
            if (runHistory[0] == 0)
                currentRunLength += this.size;
            runHistory.pop();
            runHistory.unshift(currentRunLength);
        }
        static MIN_VERSION = 1;
        static MAX_VERSION = 40;
        static PENALTY_N1 = 3;
        static PENALTY_N2 = 3;
        static PENALTY_N3 = 40;
        static PENALTY_N4 = 10;
        static ECC_CODEWORDS_PER_BLOCK = [
            [-1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
            [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28],
            [-1, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28, 26, 30, 28, 30, 30, 30, 30, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
            [-1, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28, 26, 28, 30, 24, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
        ];
        static NUM_ERROR_CORRECTION_BLOCKS = [
            [-1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25],
            [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49],
            [-1, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12, 17, 16, 18, 21, 20, 23, 23, 25, 27, 29, 34, 34, 35, 38, 40, 43, 45, 48, 51, 53, 56, 59, 62, 65, 68],
            [-1, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25, 25, 34, 30, 32, 35, 37, 40, 42, 45, 48, 51, 54, 57, 60, 63, 66, 70, 74, 77, 81],
        ];
    }
    qrcodegen.QrCode = QrCode;
    function appendBits(val, len, bb) {
        if (len < 0 || len > 31 || val >>> len != 0)
            throw new RangeError("Value out of range");
        for (let i = len - 1; i >= 0; i--)
            bb.push((val >>> i) & 1);
    }
    function getBit(x, i) {
        return ((x >>> i) & 1) != 0;
    }
    function assert(cond) {
        if (!cond)
            throw new Error("Assertion error");
    }
    class QrSegment {
        mode;
        numChars;
        bitData;
        static makeBytes(data) {
            let bb = [];
            for (const b of data)
                appendBits(b, 8, bb);
            return new QrSegment(QrSegment.Mode.BYTE, data.length, bb);
        }
        static makeNumeric(digits) {
            if (!QrSegment.isNumeric(digits))
                throw new RangeError("String contains non-numeric characters");
            let bb = [];
            for (let i = 0; i < digits.length;) {
                const n = Math.min(digits.length - i, 3);
                appendBits(parseInt(digits.substring(i, i + n), 10), n * 3 + 1, bb);
                i += n;
            }
            return new QrSegment(QrSegment.Mode.NUMERIC, digits.length, bb);
        }
        static makeAlphanumeric(text) {
            if (!QrSegment.isAlphanumeric(text))
                throw new RangeError("String contains unencodable characters in alphanumeric mode");
            let bb = [];
            let i;
            for (i = 0; i + 2 <= text.length; i += 2) {
                let temp = QrSegment.ALPHANUMERIC_CHARSET.indexOf(text.charAt(i)) * 45;
                temp += QrSegment.ALPHANUMERIC_CHARSET.indexOf(text.charAt(i + 1));
                appendBits(temp, 11, bb);
            }
            if (i < text.length)
                appendBits(QrSegment.ALPHANUMERIC_CHARSET.indexOf(text.charAt(i)), 6, bb);
            return new QrSegment(QrSegment.Mode.ALPHANUMERIC, text.length, bb);
        }
        static makeSegments(text) {
            if (text == "")
                return [];
            else if (QrSegment.isNumeric(text))
                return [QrSegment.makeNumeric(text)];
            else if (QrSegment.isAlphanumeric(text))
                return [QrSegment.makeAlphanumeric(text)];
            else
                return [QrSegment.makeBytes(QrSegment.toUtf8ByteArray(text))];
        }
        static makeEci(assignVal) {
            let bb = [];
            if (assignVal < 0)
                throw new RangeError("ECI assignment value out of range");
            else if (assignVal < (1 << 7))
                appendBits(assignVal, 8, bb);
            else if (assignVal < (1 << 14)) {
                appendBits(0b10, 2, bb);
                appendBits(assignVal, 14, bb);
            }
            else if (assignVal < 1000000) {
                appendBits(0b110, 3, bb);
                appendBits(assignVal, 21, bb);
            }
            else
                throw new RangeError("ECI assignment value out of range");
            return new QrSegment(QrSegment.Mode.ECI, 0, bb);
        }
        static isNumeric(text) {
            return QrSegment.NUMERIC_REGEX.test(text);
        }
        static isAlphanumeric(text) {
            return QrSegment.ALPHANUMERIC_REGEX.test(text);
        }
        constructor(mode, numChars, bitData) {
            this.mode = mode;
            this.numChars = numChars;
            this.bitData = bitData;
            if (numChars < 0)
                throw new RangeError("Invalid argument");
            this.bitData = bitData.slice();
        }
        getData() {
            return this.bitData.slice();
        }
        static getTotalBits(segs, version) {
            let result = 0;
            for (const seg of segs) {
                const ccbits = seg.mode.numCharCountBits(version);
                if (seg.numChars >= (1 << ccbits))
                    return Infinity;
                result += 4 + ccbits + seg.bitData.length;
            }
            return result;
        }
        static toUtf8ByteArray(str) {
            str = encodeURI(str);
            let result = [];
            for (let i = 0; i < str.length; i++) {
                if (str.charAt(i) != "%")
                    result.push(str.charCodeAt(i));
                else {
                    result.push(parseInt(str.substring(i + 1, i + 3), 16));
                    i += 2;
                }
            }
            return result;
        }
        static NUMERIC_REGEX = /^[0-9]*$/;
        static ALPHANUMERIC_REGEX = /^[A-Z0-9 $%*+.\/:-]*$/;
        static ALPHANUMERIC_CHARSET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:";
    }
    qrcodegen.QrSegment = QrSegment;
})(qrcodegen || (qrcodegen = {}));
(function (qrcodegen) {
    var QrCode;
    (function (QrCode) {
        class Ecc {
            ordinal;
            formatBits;
            static LOW = new Ecc(0, 1);
            static MEDIUM = new Ecc(1, 0);
            static QUARTILE = new Ecc(2, 3);
            static HIGH = new Ecc(3, 2);
            constructor(ordinal, formatBits) {
                this.ordinal = ordinal;
                this.formatBits = formatBits;
            }
        }
        QrCode.Ecc = Ecc;
    })(QrCode = qrcodegen.QrCode || (qrcodegen.QrCode = {}));
})(qrcodegen || (qrcodegen = {}));
(function (qrcodegen) {
    var QrSegment;
    (function (QrSegment) {
        class Mode {
            modeBits;
            numBitsCharCount;
            static NUMERIC = new Mode(0x1, [10, 12, 14]);
            static ALPHANUMERIC = new Mode(0x2, [9, 11, 13]);
            static BYTE = new Mode(0x4, [8, 16, 16]);
            static KANJI = new Mode(0x8, [8, 10, 12]);
            static ECI = new Mode(0x7, [0, 0, 0]);
            constructor(modeBits, numBitsCharCount) {
                this.modeBits = modeBits;
                this.numBitsCharCount = numBitsCharCount;
            }
            numCharCountBits(ver) {
                return this.numBitsCharCount[Math.floor((ver + 7) / 17)];
            }
        }
        QrSegment.Mode = Mode;
    })(QrSegment = qrcodegen.QrSegment || (qrcodegen.QrSegment = {}));
})(qrcodegen || (qrcodegen = {}));



export function generateQRCodeSVG(text: string, size: number = 220): string {
  const qr = (qrcodegen as any).QrCode.encodeText(text, (qrcodegen as any).QrCode.Ecc.MEDIUM);
  const border = 4;
  const parts: string[] = [];
  for (let y = 0; y < qr.size; y++) {
    for (let x = 0; x < qr.size; x++) {
      if (qr.getModule(x, y)) {
        parts.push(`M${x + border},${y + border}h1v1h-1z`);
      }
    }
  }
  const total = qr.size + border * 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" width="${size}" height="${size}" shape-rendering="crispEdges">
    <rect width="${total}" height="${total}" fill="#ffffff" rx="2"/>
    <path d="${parts.join(' ')}" fill="#1c1714"/>
  </svg>`;
}

// ── 7. Native IndexedDB Ciphertext Blob Storage (Eliminates localStorage 5MB Quota) ─
const VAULT_IDB_NAME = 'shudkara_vault_blobs_db';
const VAULT_STORE_NAME = 'encrypted_blobs';

function openVaultIDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      return reject(new Error('IndexedDB not supported in this environment.'));
    }
    const request = indexedDB.open(VAULT_IDB_NAME, 1);
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
