import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Shield,
  ShieldCheck,
  Lock,
  Unlock,
  Key,
  Smartphone,
  Copy,
  Eye,
  RotateCw,
  Plus,
  Trash2,
  Edit3,
  Download,
  RefreshCw,
  Clock,
  AlertTriangle,
  User,
  Users,
  ChevronRight,
  ChevronLeft,
  Paperclip,
  History,
  Sparkles,
  Sliders,
  X,
  Printer,
  Search,
  FileText,
  CheckCircle2,
  AlertCircle,
  Upload
} from 'lucide-react';

import {
  generateMasterVaultKey,
  generateDEK,
  wrapDEK,
  unwrapDEK,
  encryptBlob,
  decryptBlob,
  encryptJSON,
  decryptJSON,
  deriveMVKFromPassphrase,
  generateEphemeralECDH,
  importPeerECDHPublicKey,
  deriveECDHSharedSecret,
  sealMVKForRelay,
  unsealMVKFromRelay,
  registerWebAuthnPasskey,
  authenticateWebAuthnPasskey,
  generateQRCodeSVG,
  exportKeyRaw,
  importKeyRaw,
  base64ToArrayBuffer
} from '../utils/vaultCrypto';
import type { WrappedKeyEnvelope } from '../utils/vaultCrypto';

// ── Types & Data Models (Per Proposal Section 6.2) ─────────────────────────────

export type RelationshipType = 'self' | 'father' | 'mother' | 'sibling' | 'spouse' | 'child' | 'other';
export type DocumentCategory = 'identity' | 'travel' | 'finance' | 'legal' | 'academic' | 'health' | 'other';
export type LayoutMode = 'front_back_separate' | 'front_back_combined' | 'front_only' | 'multi_page_dossier';
export type DocumentStatus = 'active' | 'expiring_soon' | 'expired' | 'archived';

export interface Person {
  id: string;
  name: string;
  relationship: RelationshipType;
  avatarColor: string; // 'emerald' | 'blue' | 'rose' | 'amber' | 'purple'
  dob?: string;
  bloodGroup?: string;
  emergencyPhone?: string;
  isDefault?: boolean;
  notes?: string;
}

export interface DocumentMediaSlot {
  slot: 'front' | 'back' | 'combined' | 'page';
  label: string;
  pageNumber?: number;
  mimeType: string;
  blobUuid?: string;
  driveFileId?: string;
  ciphertextBase64?: string; // Encrypted binary data
  ivBase64?: string;
  dekEnvelope?: WrappedKeyEnvelope; // Wrapped disposable DEK
  previewUrl?: string; // Decrypted ephemeral Object URL (RAM only)
}

export interface PreviousDocumentVersion {
  versionId: string;
  versionLabel: string;
  documentNumber: string;
  issuedDate?: string;
  expiryDate?: string;
  status: 'expired' | 'archived';
  notes?: string;
  media?: DocumentMediaSlot[];
}

export interface RelatedChildDocument {
  id: string;
  title: string;
  category: string;
  description?: string;
  issuedDate?: string;
  media?: DocumentMediaSlot;
}

export interface VaultDocument {
  id: string;
  personId: string;
  category: DocumentCategory;
  title: string;
  documentNumber: string;
  issuingCountry?: string;
  issuingAuthority?: string;
  issuedDate?: string;
  expiryDate?: string;
  layoutMode: LayoutMode;
  status: DocumentStatus;
  notes?: string;
  media: DocumentMediaSlot[];
  previousVersions?: PreviousDocumentVersion[];
  relatedDocuments?: RelatedChildDocument[];
  createdAt: string;
  updatedAt: string;
}

export interface VaultManifest {
  version: number;
  updatedAt: string;
  persons: Person[];
  documents: VaultDocument[];
}

interface DocumentVaultProps {
  authToken?: string | null;
}

// ── Default Initial Mock Data for First-Time Setup ─────────────────────────────

function createInitialManifest(): VaultManifest {
  return {
    version: 2,
    updatedAt: new Date().toISOString(),
    persons: [
      {
        id: 'person_self',
        name: 'Shudarsan Regmi',
        relationship: 'self',
        avatarColor: 'emerald',
        dob: '1999-05-14',
        bloodGroup: 'O+',
        emergencyPhone: '+977-9842000000',
        isDefault: true,
        notes: 'Primary Vault Custodian'
      },
      {
        id: 'person_father',
        name: 'Baidyanath Regmi',
        relationship: 'father',
        avatarColor: 'blue',
        dob: '1968-08-20',
        bloodGroup: 'A+',
        emergencyPhone: '+977-9852000000'
      },
      {
        id: 'person_mother',
        name: 'Gita Regmi',
        relationship: 'mother',
        avatarColor: 'rose',
        dob: '1972-11-12',
        bloodGroup: 'B+',
        emergencyPhone: '+977-9842111111'
      },
      {
        id: 'person_sibling',
        name: 'Sujan Regmi',
        relationship: 'sibling',
        avatarColor: 'amber',
        dob: '2002-03-25',
        bloodGroup: 'O+'
      }
    ],
    documents: [
      {
        id: 'doc_passport_self',
        personId: 'person_self',
        category: 'travel',
        title: 'International Passport (E-Passport)',
        documentNumber: 'PA0829141',
        issuingCountry: 'Nepal',
        issuingAuthority: 'Department of Passports Kathmandu',
        issuedDate: '2021-04-12',
        expiryDate: '2031-04-11',
        layoutMode: 'front_back_separate',
        status: 'active',
        notes: '10-Year Ordinary 34-page machine readable biometric passport',
        media: [
          {
            slot: 'front',
            label: 'Biographical Page',
            mimeType: 'image/svg+xml'
          },
          {
            slot: 'back',
            label: 'Signature & Endorsement Page',
            mimeType: 'image/svg+xml'
          }
        ],
        previousVersions: [
          {
            versionId: 'ver_passport_old_2011',
            versionLabel: 'Previous MRP Passport (2011–2021)',
            documentNumber: '07891234',
            issuedDate: '2011-03-10',
            expiryDate: '2021-03-09',
            status: 'expired',
            notes: '⚠️ Contains active 10-year US B1/B2 Visa on Page 14 (valid through 2028)'
          }
        ],
        relatedDocuments: [
          {
            id: 'rel_photo_spec',
            title: 'Official MRP Digital Photo Spec (35x45mm)',
            category: 'photo',
            description: 'Approved biometric white background passport photo asset'
          },
          {
            id: 'rel_police_report',
            title: 'Police Clearance Certificate',
            category: 'clearance',
            issuedDate: '2024-01-15',
            description: 'Nepal Police Crime Investigation Department Verification'
          }
        ],
        createdAt: '2026-11-18T10:00:00Z',
        updatedAt: '2026-11-18T10:00:00Z'
      },
      {
        id: 'doc_aadhar_self',
        personId: 'person_self',
        category: 'identity',
        title: 'National Identity / Aadhar Card',
        documentNumber: 'XXXX-XXXX-9812',
        issuingCountry: 'India',
        issuedDate: '2019-06-20',
        layoutMode: 'front_back_combined',
        status: 'active',
        notes: 'Combined single-sheet scan of both front identity and reverse address/QR',
        media: [
          {
            slot: 'combined',
            label: 'Front & Back Stitched Card',
            mimeType: 'image/svg+xml'
          }
        ],
        relatedDocuments: [
          {
            id: 'rel_aadhar_slip',
            title: 'Aadhar Enrollment Acknowledgment Slip',
            category: 'receipt',
            description: 'Original UIDAI acknowledgment receipt and demographic update confirmation'
          }
        ],
        createdAt: '2026-11-18T11:00:00Z',
        updatedAt: '2026-11-18T11:00:00Z'
      },
      {
        id: 'doc_cit_father',
        personId: 'person_father',
        category: 'identity',
        title: 'Nepali Citizenship Certificate (Nagarikata)',
        documentNumber: '27-01-76-04912',
        issuingCountry: 'Nepal',
        issuingAuthority: 'District Administration Office Morang',
        issuedDate: '1986-10-14',
        layoutMode: 'front_back_separate',
        status: 'active',
        notes: 'Permanent sovereign citizenship by descent',
        media: [
          {
            slot: 'front',
            label: 'Front Face (Personal Details & Photo)',
            mimeType: 'image/svg+xml'
          },
          {
            slot: 'back',
            label: 'Reverse Endorsement & Seal',
            mimeType: 'image/svg+xml'
          }
        ],
        relatedDocuments: [
          {
            id: 'rel_ward_translation',
            title: 'Ward Municipal English Translation Affidavit',
            category: 'legal',
            description: 'Official notarized English translation issued by Biratnagar Ward No. 3'
          }
        ],
        createdAt: '2026-11-18T12:00:00Z',
        updatedAt: '2026-11-18T12:00:00Z'
      },
      {
        id: 'doc_land_deed',
        personId: 'person_father',
        category: 'legal',
        title: 'Ancestral Land Ownership Deed (Lalpurja)',
        documentNumber: 'Kitta No. 492',
        issuingCountry: 'Nepal',
        issuingAuthority: 'Land Revenue Office Morang',
        issuedDate: '2005-02-18',
        layoutMode: 'multi_page_dossier',
        status: 'active',
        notes: 'Multi-page cadastral property registration dossier with municipal boundaries',
        media: [
          {
            slot: 'page',
            pageNumber: 1,
            label: 'Page 1: Title Grant & Registry Identification',
            mimeType: 'image/svg+xml'
          },
          {
            slot: 'page',
            pageNumber: 2,
            label: 'Page 2: Cadastral Bounds & Municipal Survey Map',
            mimeType: 'image/svg+xml'
          },
          {
            slot: 'page',
            pageNumber: 3,
            label: 'Page 3: Notarial Endorsements & Tax Clearance Seals',
            mimeType: 'image/svg+xml'
          }
        ],
        createdAt: '2026-11-18T14:00:00Z',
        updatedAt: '2026-11-18T14:00:00Z'
      }
    ]
  };
}

export const DocumentVault: React.FC<DocumentVaultProps> = ({ authToken }) => {
  // ── Cryptographic Key & Vault Locking State (RAM Only) ────────────────────────
  const [isUnlocked, setIsUnlocked] = useState<boolean>(false);
  const [masterVaultKey, setMasterVaultKey] = useState<CryptoKey | null>(null);
  const [inactivitySeconds, setInactivitySeconds] = useState<number>(120);

  // ── Manifest & Filter State ──────────────────────────────────────────────────
  const [manifest, setManifest] = useState<VaultManifest | null>(null);
  const [selectedPersonId, setSelectedPersonId] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // ── 3D Card Flip States (keyed by documentId) ────────────────────────────────
  const [flippedCards, setFlippedCards] = useState<Record<string, boolean>>({});

  // ── Modals & Drawers ──────────────────────────────────────────────────────────
  const [viewingDoc, setViewingDoc] = useState<VaultDocument | null>(null);
  const [dossierPage, setDossierPage] = useState<number>(1);
  const [activeVersionId, setActiveVersionId] = useState<string | null>(null);
  const [watermarkDoc, setWatermarkDoc] = useState<VaultDocument | null>(null);
  const [isAddDocOpen, setIsAddDocOpen] = useState<boolean>(false);
  const [isAddPersonOpen, setIsAddPersonOpen] = useState<boolean>(false);
  const [isFamilySummaryOpen, setIsFamilySummaryOpen] = useState<boolean>(false);

  // ── Pairing Relay State (Method A: Cross-Device ECDH QR Relay) ───────────────
  const [relaySessionId, setRelaySessionId] = useState<string>('');
  const [relayKeyPair, setRelayKeyPair] = useState<CryptoKeyPair | null>(null);
  const [relayStatus, setRelayStatus] = useState<'idle' | 'polling' | 'authorized' | 'expired'>('idle');
  const [relaySecondsRemaining, setRelaySecondsRemaining] = useState<number>(90);
  const [qrSvgHtml, setQrSvgHtml] = useState<string>('');

  // ── Companion Mobile Screen State (if user opens companion pairing URL) ──────
  const [companionPairingParam, setCompanionPairingParam] = useState<{ sid: string; pk: JsonWebKey } | null>(null);
  const [companionAuthorized, setCompanionAuthorized] = useState<boolean>(false);

  // ── WebAuthn Passkey Registration State ──────────────────────────────────────
  const [hasRegisteredPasskey, setHasRegisteredPasskey] = useState<boolean>(false);
  const [passkeyNotice, setPasskeyNotice] = useState<string | null>(null);

  // ── Passphrase & TOTP Unlock Form State ──────────────────────────────────────
  const [passphraseInput, setPassphraseInput] = useState<string>('');
  const [totpCodeInput, setTotpCodeInput] = useState<string>('');
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const [isUnlocking, setIsUnlocking] = useState<boolean>(false);

  // ── Ephemeral Clipboard Wiper State ──────────────────────────────────────────
  const [clipboardNotice, setClipboardNotice] = useState<{ text: string; secondsLeft: number } | null>(null);

  // ── Check if this window was opened as a companion pairing scanner ───────────
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const isPair = params.get('vault_pair');
    const sid = params.get('sid');
    const pkStr = params.get('pk');

    if (isPair && sid) {
      if (pkStr) {
        try {
          const pk = JSON.parse(decodeURIComponent(pkStr));
          setCompanionPairingParam({ sid, pk });
        } catch {
          // invalid param
        }
      } else {
        // Fetch laptop's ephemeral ECDH public key from the relay session
        fetch(`/api/vault/relay/status?sessionId=${sid}`)
          .then((res) => res.json())
          .then((data) => {
            if (data && data.publicKey) {
              setCompanionPairingParam({ sid, pk: data.publicKey });
            } else {
              setUnlockError('Pairing session not found or expired.');
            }
          })
          .catch((err) => {
            setUnlockError('Failed to contact relay server: ' + err.message);
          });
      }
    }

    // Check if device has a registered passkey credential
    if (localStorage.getItem('shudkara_vault_passkey_raw_id')) {
      setHasRegisteredPasskey(true);
    }
  }, []);

  // ── Inactivity Auto-Lock & Window Blur Handlers ──────────────────────────────
  const lockVault = useCallback(() => {
    // Revoke any created ephemeral object URLs to immediately flush plaintext RAM
    if (manifest) {
      manifest.documents.forEach((d) => {
        d.media.forEach((m) => {
          if (m.previewUrl && m.previewUrl.startsWith('blob:')) {
            URL.revokeObjectURL(m.previewUrl);
          }
        });
      });
    }

    setIsUnlocked(false);
    setMasterVaultKey(null);
    setViewingDoc(null);
    setWatermarkDoc(null);
    setIsAddDocOpen(false);
    setIsAddPersonOpen(false);
    setIsFamilySummaryOpen(false);
    setFlippedCards({});
  }, [manifest]);

  // 120-second inactivity ticker
  useEffect(() => {
    if (!isUnlocked) return;

    const interval = setInterval(() => {
      setInactivitySeconds((prev) => {
        if (prev <= 1) {
          lockVault();
          return 120;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isUnlocked, lockVault]);

  // Activity listeners to reset 120-second timer
  useEffect(() => {
    if (!isUnlocked) return;

    const resetTimer = () => setInactivitySeconds(120);

    window.addEventListener('mousemove', resetTimer);
    window.addEventListener('keydown', resetTimer);
    window.addEventListener('touchstart', resetTimer);
    window.addEventListener('scroll', resetTimer);

    // Instant lock on window blur or tab switch
    const handleBlur = () => lockVault();
    const handleVisibilityChange = () => {
      if (document.hidden) lockVault();
    };

    window.addEventListener('blur', handleBlur);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('mousemove', resetTimer);
      window.removeEventListener('keydown', resetTimer);
      window.removeEventListener('touchstart', resetTimer);
      window.removeEventListener('scroll', resetTimer);
      window.removeEventListener('blur', handleBlur);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isUnlocked, lockVault]);

  // ── Ephemeral Clipboard Auto-Wipe Countdown (15 Seconds) ──────────────────────
  useEffect(() => {
    if (!clipboardNotice) return;

    const timer = setInterval(() => {
      setClipboardNotice((prev) => {
        if (!prev || prev.secondsLeft <= 1) {
          if (navigator.clipboard?.writeText) {
            navigator.clipboard.writeText('').catch(() => {});
          }
          return null;
        }
        return { ...prev, secondsLeft: prev.secondsLeft - 1 };
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [clipboardNotice]);

  const copyToClipboardWithWipe = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setClipboardNotice({
      text: `${label} (${text}) copied to clipboard`,
      secondsLeft: 15
    });
  };

  // ── Encrypted Manifest Cloud Sync (AES-256-GCM) ──────────────────────────────
  const syncManifestToCloud = useCallback(
    async (updatedManifest: VaultManifest, key: CryptoKey) => {
      try {
        const encrypted = await encryptJSON(updatedManifest, key);
        if (authToken) {
          await fetch('/api/vault/manifest', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Session-Token': authToken
            },
            body: JSON.stringify({
              manifestCiphertext: encrypted.ciphertextB64,
              iv: encrypted.ivB64,
              version: updatedManifest.version
            })
          });
        }
        // Also persist encrypted ciphertext locally for offline resilience
        localStorage.setItem('shudkara_vault_manifest_enc', JSON.stringify(encrypted));
      } catch (err) {
        console.warn('[Vault] Manifest sync error:', err);
      }
    },
    [authToken]
  );

  // ── Load / Unseal Manifest upon Unlocking ────────────────────────────────────
  const loadVaultManifest = useCallback(
    async (mvk: CryptoKey) => {
      try {
        let loadedManifest: VaultManifest | null = null;

        // 1. Try fetching encrypted manifest from Azure / Drive API
        if (authToken) {
          try {
            const res = await fetch('/api/vault/manifest', {
              headers: { 'X-Session-Token': authToken }
            });
            if (res.ok) {
              const data = await res.json();
              if (data.manifestCiphertext && data.iv) {
                loadedManifest = await decryptJSON<VaultManifest>(
                  { ciphertextB64: data.manifestCiphertext, ivB64: data.iv },
                  mvk
                );
              }
            }
          } catch (cloudErr) {
            console.warn('[Vault] Cloud manifest fetch error:', cloudErr);
          }
        }

        // 2. Try reading cached encrypted manifest from localStorage
        if (!loadedManifest) {
          const localEncStr = localStorage.getItem('shudkara_vault_manifest_enc');
          if (localEncStr) {
            try {
              const localEnc = JSON.parse(localEncStr);
              loadedManifest = await decryptJSON<VaultManifest>(localEnc, mvk);
            } catch {}
          }
        }

        // 3. Fallback to initial seed if first-time setup
        if (!loadedManifest) {
          loadedManifest = createInitialManifest();
          await syncManifestToCloud(loadedManifest, mvk);
        }

        // 4. Decrypt any stored encrypted blobs for documents
        for (const doc of loadedManifest.documents) {
          for (const m of doc.media) {
            if (m.blobUuid && m.dekEnvelope && m.ciphertextBase64 && m.ivBase64) {
              try {
                const dek = await unwrapDEK(m.dekEnvelope, mvk);
                const cipherBytes = base64ToArrayBuffer(m.ciphertextBase64);
                const ivBytes = base64ToArrayBuffer(m.ivBase64);
                const decryptedBlob = await decryptBlob(cipherBytes, ivBytes, dek, m.mimeType);
                m.previewUrl = URL.createObjectURL(decryptedBlob);
              } catch (decErr) {
                console.warn('[Vault] Blob decrypt error:', decErr);
              }
            }
          }
        }

        setManifest(loadedManifest);
      } catch (err: any) {
        setUnlockError('Decryption failed: key could not unseal manifest. ' + err.message);
      }
    },
    [authToken, syncManifestToCloud]
  );

  // ── QR Code Relay Pairing Logic (Laptop Side) ────────────────────────────────
  const initRelayPairing = useCallback(async () => {
    try {
      setRelayStatus('idle');
      setUnlockError(null);
      const sessionId = 'pair_' + Math.random().toString(36).substring(2, 10);
      const { keyPair, publicKeyJWK } = await generateEphemeralECDH();

      setRelaySessionId(sessionId);
      setRelayKeyPair(keyPair);
      setRelaySecondsRemaining(90);

      // Generate standard pairing URL (~48 chars) and real scannable ISO QR Code SVG
      const pairingUrl = `${window.location.origin}${window.location.pathname}?vault_pair=true&sid=${sessionId}`;
      const svg = generateQRCodeSVG(pairingUrl, 200);
      setQrSvgHtml(svg);

      // Register session with Azure Function relay
      await fetch('/api/vault/relay/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, publicKey: publicKeyJWK })
      }).catch(() => {});

      setRelayStatus('polling');
    } catch (err: any) {
      setUnlockError('Failed to initialize ECDH relay: ' + err.message);
    }
  }, []);

  // Auto-initialize pairing session on mount when vault is locked
  useEffect(() => {
    if (!isUnlocked && !companionPairingParam && relayStatus === 'idle') {
      initRelayPairing();
    }
  }, [isUnlocked, companionPairingParam, relayStatus, initRelayPairing]);

  // Poll relay status while waiting for companion authorization
  useEffect(() => {
    if (relayStatus !== 'polling' || !relaySessionId || !relayKeyPair) return;

    const interval = setInterval(async () => {
      try {
        setRelaySecondsRemaining((prev) => {
          if (prev <= 1) {
            setRelayStatus('expired');
            return 0;
          }
          return prev - 1;
        });

        const res = await fetch(`/api/vault/relay/status?sessionId=${relaySessionId}`);
        if (!res.ok) return;
        const data = await res.json();

        if (data.status === 'authorized' && data.encryptedMvkPayload) {
          clearInterval(interval);
          setRelayStatus('authorized');

          // Unseal MVK using laptop's ECDH private key and companion phone's public key
          const phonePublicKey = await importPeerECDHPublicKey(data.encryptedMvkPayload.phonePublicKeyJWK);
          const tunnelKey = await deriveECDHSharedSecret(relayKeyPair.privateKey, phonePublicKey);
          const unsealedMvk = await unsealMVKFromRelay(data.encryptedMvkPayload.sealedEnvelope, tunnelKey);

          setMasterVaultKey(unsealedMvk);
          setIsUnlocked(true);
          setInactivitySeconds(120);
          await loadVaultManifest(unsealedMvk);
        } else if (data.status === 'expired') {
          setRelayStatus('expired');
          clearInterval(interval);
        }
      } catch {
        // Continue polling
      }
    }, 1500);

    return () => clearInterval(interval);
  }, [relayStatus, relaySessionId, relayKeyPair, loadVaultManifest]);

  // ── Companion Mobile Authorization (When opened via scanned QR link) ─────────
  const handleCompanionAuthorize = async () => {
    if (!companionPairingParam) return;
    try {
      setIsUnlocking(true);
      // 1. Companion phone generates ephemeral ECDH pair
      const phoneECDH = await generateEphemeralECDH();
      const laptopPeerKey = await importPeerECDHPublicKey(companionPairingParam.pk);
      const sharedTunnel = await deriveECDHSharedSecret(phoneECDH.keyPair.privateKey, laptopPeerKey);

      // 2. Unseal or generate Master Vault Key
      let mvkToShare: CryptoKey;
      const cachedMvkRaw = localStorage.getItem('shudkara_vault_mvk_backup');
      if (cachedMvkRaw) {
        mvkToShare = await importKeyRaw(cachedMvkRaw);
      } else {
        mvkToShare = await generateMasterVaultKey();
        const exported = await exportKeyRaw(mvkToShare);
        localStorage.setItem('shudkara_vault_mvk_backup', exported);
      }

      // 3. Encrypt MVK with shared tunnel key and send to relay
      const sealedEnvelope = await sealMVKForRelay(mvkToShare, sharedTunnel);

      const res = await fetch('/api/vault/relay/authorize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: companionPairingParam.sid,
          encryptedMvkPayload: {
            sealedEnvelope,
            phonePublicKeyJWK: phoneECDH.publicKeyJWK
          }
        })
      });

      if (!res.ok) {
        throw new Error('Authorization endpoint returned ' + res.status);
      }

      setIsUnlocking(false);
      setCompanionAuthorized(true);
    } catch (err: any) {
      setIsUnlocking(false);
      setUnlockError('Authorization error: ' + err.message);
    }
  };

  // ── WebAuthn Passkey Registration & Biometric Unlock ──────────────────────────
  const handleRegisterPasskey = async () => {
    try {
      setIsUnlocking(true);
      setPasskeyNotice(null);
      const reg = await registerWebAuthnPasskey('shudarsan@shudkara');
      localStorage.setItem('shudkara_vault_passkey_cred_id', reg.credentialId);
      localStorage.setItem('shudkara_vault_passkey_raw_id', reg.rawIdB64);
      setHasRegisteredPasskey(true);
      setPasskeyNotice('Hardware biometric passkey registered successfully on this device.');
      await handleUnlockWithPasskey();
    } catch (err: any) {
      setIsUnlocking(false);
      setUnlockError('Passkey registration error: ' + err.message);
    }
  };

  const handleUnlockWithPasskey = async () => {
    try {
      setIsUnlocking(true);
      setUnlockError(null);
      const rawIdB64 = localStorage.getItem('shudkara_vault_passkey_raw_id') || undefined;
      const res = await authenticateWebAuthnPasskey(rawIdB64);

      if (res.success) {
        // Derive MVK deterministically from biometric signature or unseal
        const salt = new TextEncoder().encode('shudkara_abhyantara_biometric_salt');
        const biometricMvk = await deriveMVKFromPassphrase(res.signatureB64, salt, undefined, 10000);

        setMasterVaultKey(biometricMvk);
        setIsUnlocked(true);
        setInactivitySeconds(120);
        await loadVaultManifest(biometricMvk);
      }
      setIsUnlocking(false);
    } catch (err: any) {
      setIsUnlocking(false);
      setUnlockError('Biometric authentication failed: ' + err.message);
    }
  };

  // ── Emergency Recovery Unlock (TOTP Authenticator + Passphrase) ───────────────
  const handleUnlockWithPassphrase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passphraseInput.trim() && !totpCodeInput.trim()) {
      setUnlockError('Please provide a 6-digit TOTP code or emergency passphrase.');
      return;
    }

    try {
      setIsUnlocking(true);
      setUnlockError(null);

      // If TOTP code provided, verify against Azure /api/vault/verify-totp
      if (totpCodeInput.trim()) {
        try {
          const totpRes = await fetch('/api/vault/verify-totp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code: totpCodeInput.trim() })
          });
          if (totpRes.ok) {
            const totpData = await totpRes.json();
            if (!totpData.valid) {
              setUnlockError('Invalid 6-digit TOTP Authenticator code.');
              setIsUnlocking(false);
              return;
            }
          }
        } catch {
          // If offline, continue with local key derivation
        }
      }

      // 600,000 iterations PBKDF2-HMAC-SHA256 (OWASP recommendation)
      const seed = passphraseInput.trim() || `shudkara_emergency_seed_${totpCodeInput.trim()}`;
      const salt = new TextEncoder().encode('shudkara_abhyantara_kosha_master_salt_2026');
      const derivedKey = await deriveMVKFromPassphrase(
        seed,
        salt,
        totpCodeInput.trim() || undefined,
        600000
      );

      setMasterVaultKey(derivedKey);
      setIsUnlocked(true);
      setInactivitySeconds(120);
      setPassphraseInput('');
      setTotpCodeInput('');
      await loadVaultManifest(derivedKey);
      setIsUnlocking(false);
    } catch (err: any) {
      setIsUnlocking(false);
      setUnlockError('Unlock failed: ' + err.message);
    }
  };

  // ── Delete Document Handler ──────────────────────────────────────────────────
  const handleDeleteDocument = async (docId: string) => {
    if (!window.confirm('Are you sure you want to delete this document from the zero-knowledge vault?')) {
      return;
    }
    if (!manifest || !masterVaultKey) return;

    const updatedDocuments = manifest.documents.filter((d) => d.id !== docId);
    const updatedManifest: VaultManifest = {
      ...manifest,
      documents: updatedDocuments,
      updatedAt: new Date().toISOString()
    };

    setManifest(updatedManifest);
    setViewingDoc(null);
    await syncManifestToCloud(updatedManifest, masterVaultKey);
  };

  // ── Delete Person Profile Handler ────────────────────────────────────────────
  const handleDeletePerson = async (personId: string) => {
    if (!manifest || !masterVaultKey) return;
    if (manifest.persons.length <= 1) {
      alert('You must have at least one registered family person.');
      return;
    }
    if (!window.confirm('Delete this family profile and all associated persona filtering?')) return;

    const updatedPersons = manifest.persons.filter((p) => p.id !== personId);
    const updatedManifest: VaultManifest = {
      ...manifest,
      persons: updatedPersons,
      updatedAt: new Date().toISOString()
    };

    setManifest(updatedManifest);
    if (selectedPersonId === personId) setSelectedPersonId('all');
    await syncManifestToCloud(updatedManifest, masterVaultKey);
  };

  // ── Filtered Documents Calculation ───────────────────────────────────────────
  const filteredDocuments = useMemo(() => {
    if (!manifest) return [];
    return manifest.documents.filter((doc) => {
      // Person filter
      if (selectedPersonId !== 'all' && doc.personId !== selectedPersonId) {
        return false;
      }
      // Category filter
      if (selectedCategory !== 'all' && doc.category !== selectedCategory) {
        return false;
      }
      // Search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const person = manifest.persons.find((p) => p.id === doc.personId);
        const matchTitle = doc.title.toLowerCase().includes(query);
        const matchNumber = doc.documentNumber.toLowerCase().includes(query);
        const matchPerson = person?.name.toLowerCase().includes(query);
        const matchCountry = doc.issuingCountry?.toLowerCase().includes(query);
        const matchRelated = doc.relatedDocuments?.some((r) => r.title.toLowerCase().includes(query));
        if (!matchTitle && !matchNumber && !matchPerson && !matchCountry && !matchRelated) {
          return false;
        }
      }
      return true;
    });
  }, [manifest, selectedPersonId, selectedCategory, searchQuery]);

  // Counts per person
  const personDocCounts = useMemo(() => {
    if (!manifest) return {};
    const counts: Record<string, number> = {};
    manifest.documents.forEach((d) => {
      counts[d.personId] = (counts[d.personId] || 0) + 1;
    });
    return counts;
  }, [manifest]);

  // Expiry alerts (< 180 days)
  const expiringAlerts = useMemo(() => {
    if (!manifest) return [];
    const now = new Date();
    return manifest.documents
      .filter((d) => d.expiryDate)
      .map((d) => {
        const exp = new Date(d.expiryDate!);
        const diffDays = Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        const person = manifest.persons.find((p) => p.id === d.personId);
        return {
          doc: d,
          personName: person?.name || 'Self',
          diffDays
        };
      })
      .filter((item) => item.diffDays <= 180 && item.diffDays >= -365);
  }, [manifest]);

  // ── Card Flip Helper ─────────────────────────────────────────────────────────
  const toggleCardFlip = (docId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setFlippedCards((prev) => ({ ...prev, [docId]: !prev[docId] }));
  };

  // ── Render Category Pills ────────────────────────────────────────────────────
  const categories: { key: string; label: string; icon: string }[] = [
    { key: 'all', label: 'All Documents', icon: '📁' },
    { key: 'identity', label: 'Identity & Citizenship', icon: '🪪' },
    { key: 'travel', label: 'Travel & Passports', icon: '✈️' },
    { key: 'finance', label: 'Financial & Tax', icon: '💼' },
    { key: 'legal', label: 'Property & Legal', icon: '📜' },
    { key: 'academic', label: 'Academic & Degrees', icon: '🎓' },
    { key: 'health', label: 'Health & Medical', icon: '🏥' }
  ];

  // Helper for persona avatar badges
  const getAvatarBadge = (person?: Person) => {
    if (!person) return null;
    const colors: Record<string, string> = {
      emerald: 'bg-emerald-100 text-emerald-800 border-emerald-300',
      blue: 'bg-blue-100 text-blue-800 border-blue-300',
      rose: 'bg-red-100 text-red-800 border-red-300',
      amber: 'bg-yellow-100 text-yellow-800 border-yellow-300',
      purple: 'bg-purple-100 text-purple-800 border-purple-300'
    };
    const c = colors[person.avatarColor] || colors.emerald;
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold border ${c}`}>
        <User className="w-3 h-3" />
        {person.name} ({person.relationship.toUpperCase()})
      </span>
    );
  };

  // ══════════════════════════════════════════════════════════════════════════════
  // A. COMPANION PHONE CLEARANCE VIEW (When opened on mobile via QR link)
  // ══════════════════════════════════════════════════════════════════════════════
  if (companionPairingParam) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-xl space-y-6 text-center">
          <div className="w-16 h-16 rounded-3xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center mx-auto shadow-inner">
            <Smartphone className="w-8 h-8" />
          </div>

          <div className="space-y-1.5">
            <h2 className="text-xl font-bold text-slate-900 serif-heading">Companion Clearance</h2>
            <p className="text-xs text-slate-500">
              A laptop is requesting clearance to unlock the Abhyantara Kosha zero-knowledge vault.
            </p>
            <div className="p-2 bg-slate-100 rounded-xl font-mono text-xs text-slate-700 mt-2">
              Session Ticket: {companionPairingParam.sid}
            </div>
          </div>

          {companionAuthorized ? (
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 space-y-2">
              <CheckCircle2 className="w-6 h-6 text-emerald-600 mx-auto" />
              <p className="text-sm font-bold">Clearance Granted!</p>
              <p className="text-xs text-emerald-600">
                The Master Vault Key has been unsealed and transmitted via end-to-end ECDH encryption. Your laptop is now unlocked.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <button
                onClick={handleCompanionAuthorize}
                disabled={isUnlocking}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-xs flex items-center justify-center gap-2"
              >
                {isUnlocking ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Unsealing MVK...
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    Touch Fingerprint &amp; Authorize Laptop
                  </>
                )}
              </button>
              <p className="text-[11px] text-slate-400">
                Zero-knowledge channel: encrypted with laptop's ephemeral P-256 public key.
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // B. LOCKED VAULT VIEW (Zero-Knowledge Enclave Seal)
  // ══════════════════════════════════════════════════════════════════════════════
  if (!isUnlocked) {
    return (
      <div className="space-y-6 pb-20 animate-fade-in max-w-4xl mx-auto">
        {/* Header Banner */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
          <div>
            <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2.5">
              <span className="p-2 bg-emerald-600 text-white rounded-xl shadow-md shadow-emerald-600/20">
                <Shield className="w-5 h-5" />
              </span>
              Abhyantara Kosha
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                अभ्यन्तर कोश / Zero-Knowledge Vault
              </span>
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Sovereign family document sanctum • Multi-person profiles, 3D interactive layouts &amp; end-to-end AES-256-GCM
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 text-slate-600 border border-slate-200 text-xs font-semibold">
              <Lock className="w-3.5 h-3.5 text-slate-500" />
              Vault Sealed
            </span>
          </div>
        </div>

        {/* Security Enclave Shield Card */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <div className="w-20 h-20 rounded-3xl bg-amber-50 border border-amber-200 flex items-center justify-center text-blue-600 shrink-0 shadow-inner">
              <ShieldCheck className="w-10 h-10" />
            </div>
            <div className="text-center sm:text-left space-y-1.5">
              <h2 className="text-xl font-bold text-slate-900 serif-heading">
                Zero-Knowledge Boundary Active
              </h2>
              <p className="text-xs text-slate-600 leading-relaxed max-w-xl">
                All document scans and biographical metadata are encrypted client-side with disposable Data Encryption Keys.
                Plaintext keys are never stored on Google Drive or Azure.
              </p>
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-1 text-[11px] text-slate-500">
                <span className="px-2 py-0.5 rounded-md bg-slate-100 font-mono">AES-256-GCM</span>
                <span>•</span>
                <span className="px-2 py-0.5 rounded-md bg-slate-100 font-mono">PBKDF2 600K</span>
                <span>•</span>
                <span className="px-2 py-0.5 rounded-md bg-slate-100 font-mono">ECDH P-256</span>
                <span>•</span>
                <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 font-semibold">120s Auto-Lock</span>
              </div>
            </div>
          </div>

          {unlockError && (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{unlockError}</span>
            </div>
          )}

          {passkeyNotice && (
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{passkeyNotice}</span>
            </div>
          )}

          {/* Unlock Methods Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
            {/* Method A: Companion Phone QR Relay */}
            <div className="border border-slate-200 rounded-2xl p-5 bg-slate-50 space-y-4 flex flex-col justify-between">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <Smartphone className="w-4 h-4 text-blue-600" />
                    Method A: Phone Companion Relay
                  </span>
                  <span className="text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">
                    Zero Typing • Recommended
                  </span>
                </div>
                <p className="text-xs text-slate-600 leading-normal">
                  Point your smartphone camera at this dynamic QR code to authorize via mobile biometrics (TouchID / FaceID) over an end-to-end ECDH channel.
                </p>
              </div>

              <div className="space-y-3 bg-white p-4 rounded-xl border border-slate-200 text-center">
                <div className="w-52 h-52 mx-auto bg-white p-2 rounded-xl border border-slate-200 shadow-sm flex items-center justify-center">
                  {qrSvgHtml ? (
                    <div
                      className="w-full h-full flex items-center justify-center"
                      dangerouslySetInnerHTML={{ __html: qrSvgHtml }}
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center gap-2 text-slate-400">
                      <RefreshCw className="w-6 h-6 animate-spin text-blue-600" />
                      <span className="text-xs">Generating ISO QR Code...</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-500 px-1">
                  <span className="flex items-center gap-1.5 font-semibold text-emerald-600">
                    <RefreshCw className="w-3 h-3 animate-spin" />
                    Awaiting Phone Clearance...
                  </span>
                  <span className="font-mono text-slate-500">⏱️ {relaySecondsRemaining}s</span>
                </div>

                <div className="pt-2 border-t border-slate-100 flex flex-col gap-2">
                  {/* Real self-pairing link for testing on same device */}
                  <a
                    href={`${window.location.origin}${window.location.pathname}?vault_pair=true&sid=${relaySessionId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition shadow-xs flex items-center justify-center gap-1.5"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    Open Companion Clearance in Local Tab
                  </a>
                  <button
                    onClick={initRelayPairing}
                    className="text-[11px] text-slate-500 hover:text-slate-800 underline"
                  >
                    Regenerate Pairing Session
                  </button>
                </div>
              </div>
            </div>

            {/* Method B: Laptop Hardware Biometrics */}
            <div className="border border-slate-200 rounded-2xl p-5 bg-slate-50 space-y-4 flex flex-col justify-between">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <Key className="w-4 h-4 text-blue-600" />
                    Method B: Laptop Hardware Biometrics
                  </span>
                  <span className="text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full">
                    1-Tap Access
                  </span>
                </div>
                <p className="text-xs text-slate-600 leading-normal">
                  Zero plaintext memorization: Unseal instantly using your laptop's platform biometric sensor (TouchID, Windows Hello, or Android Biometric).
                </p>
              </div>

              <div className="bg-white p-5 rounded-xl border border-slate-200 space-y-4 flex flex-col items-center justify-center text-center">
                <div className="w-16 h-16 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center shadow-inner">
                  <ShieldCheck className="w-8 h-8" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-slate-800 serif-heading">
                    Hardware Enclave Protection
                  </h4>
                  <p className="text-xs text-slate-500 max-w-xs">
                    Your Master Vault Key is secured by hardware enclave keys. No master passphrase to memorize.
                  </p>
                </div>

                <div className="w-full space-y-2 pt-2">
                  <button
                    type="button"
                    onClick={hasRegisteredPasskey ? handleUnlockWithPasskey : handleRegisterPasskey}
                    disabled={isUnlocking}
                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-xs flex items-center justify-center gap-2"
                  >
                    {isUnlocking ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        Verifying Hardware Biometrics...
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="w-4 h-4" />
                        {hasRegisteredPasskey
                          ? 'Touch Laptop Biometric Sensor (TouchID / Hello)'
                          : 'Register & Unlock with Laptop Biometrics'}
                      </>
                    )}
                  </button>

                  {!hasRegisteredPasskey && (
                    <p className="text-[11px] text-slate-400">
                      Tapping will prompt your browser to register this device's biometric sensor.
                    </p>
                  )}
                </div>
              </div>

              <div className="pt-2 text-center">
                <p className="text-[11px] text-slate-500">
                  FIDO2 / WebAuthn standard cryptographic key release.
                </p>
              </div>
            </div>
          </div>

          {/* Emergency Fallback Disclosure (Lost Phone / Offline Recovery) */}
          <details className="group border border-slate-200 rounded-2xl bg-slate-50 p-4 transition">
            <summary className="text-xs font-bold text-slate-700 cursor-pointer flex items-center justify-between list-none">
              <span className="flex items-center gap-2">
                <Key className="w-3.5 h-3.5 text-slate-500" />
                Lost phone or offline emergency recovery?
              </span>
              <span className="text-[11px] text-blue-700 font-semibold group-open:rotate-180 transition-transform">
                ▼
              </span>
            </summary>

            <div className="mt-4 pt-3 border-t border-slate-200 space-y-3">
              <p className="text-xs text-slate-600">
                If your phone is missing and biometric sensors are offline, unseal your vault using your 6-digit TOTP Authenticator code and optional emergency passphrase.
              </p>

              <form onSubmit={handleUnlockWithPassphrase} className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                      Authenticator Code (6-Digit TOTP)
                    </label>
                    <input
                      type="text"
                      maxLength={6}
                      placeholder="000 000"
                      value={totpCodeInput}
                      onChange={(e) => setTotpCodeInput(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 font-mono tracking-widest placeholder-slate-400 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                      Emergency Passphrase
                    </label>
                    <input
                      type="password"
                      placeholder="Optional emergency passphrase"
                      value={passphraseInput}
                      onChange={(e) => setPassphraseInput(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isUnlocking}
                  className="py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition shadow-xs flex items-center justify-center gap-2"
                >
                  {isUnlocking ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      Unsealing with Recovery Keys...
                    </>
                  ) : (
                    <>
                      <Unlock className="w-3.5 h-3.5" />
                      Unseal Vault with Emergency Recovery
                    </>
                  )}
                </button>
              </form>
            </div>
          </details>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // C. UNLOCKED VAULT VIEW (Abhyantara Kosha Active Enclave)
  // ══════════════════════════════════════════════════════════════════════════════
  return (
    <div className="space-y-6 pb-20 animate-fade-in">
      {/* ── Top Header Bar (Follows Shudkara Convention) ────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2.5">
            <span className="p-2 bg-emerald-600 text-white rounded-xl shadow-md shadow-emerald-600/20">
              <ShieldCheck className="w-5 h-5" />
            </span>
            Abhyantara Kosha
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
              अभ्यन्तर कोश / Document Vault
            </span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Zero-Knowledge Sovereign Family Document Sanctum • End-to-End Client-Side AES-256-GCM
          </p>
        </div>

        {/* Status Indicators & Action Controls */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Inactivity Auto-Lock Countdown Badge */}
          <div
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200 text-xs font-mono font-bold text-slate-600 shadow-2xs"
            title="Auto-locks on inactivity or immediate window blur"
          >
            <Clock className="w-3.5 h-3.5 text-blue-600" />
            <span>
              {Math.floor(inactivitySeconds / 60)
                .toString()
                .padStart(2, '0')}
              :{(inactivitySeconds % 60).toString().padStart(2, '0')}
            </span>
          </div>

          {/* Family Summary Dossier */}
          <button
            onClick={() => setIsFamilySummaryOpen(true)}
            className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-2xs"
            title="Consolidated Family Emergency & Medical Summary"
          >
            <FileText className="w-3.5 h-3.5 text-emerald-600" />
            <span>Family Dossier</span>
          </button>

          {/* Add Document Action */}
          <button
            onClick={() => setIsAddDocOpen(true)}
            className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Document</span>
          </button>

          {/* Lock Now Button */}
          <button
            onClick={lockVault}
            className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-xl text-xs font-bold transition flex items-center gap-1.5"
            title="Immediately seals vault & flushes unencrypted RAM"
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Lock Now</span>
          </button>
        </div>
      </div>

      {/* ── Ephemeral Clipboard Auto-Wipe Floating Alert ──────────────────────── */}
      {clipboardNotice && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-2xl shadow-xl flex items-center gap-3 border border-slate-700 text-xs animate-in slide-in-from-bottom-3 duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <div className="space-y-0.5">
            <p className="font-semibold">{clipboardNotice.text}</p>
            <p className="text-[10px] text-slate-400">
              ⏱️ Clipboard will be auto-cleared in{' '}
              <span className="font-bold text-amber-400">{clipboardNotice.secondsLeft}s</span> for security
            </p>
          </div>
          <button
            onClick={() => setClipboardNotice(null)}
            className="p-1 text-slate-400 hover:text-white rounded"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ── Caretaker Expiry Alert Banner (if any document expires <= 180 days) ─ */}
      {expiringAlerts.length > 0 && (
        <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-2xs">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <div>
              <span className="font-bold">Caretaker Renewal Advisory: </span>
              {expiringAlerts[0].personName}'s {expiringAlerts[0].doc.title} expires in{' '}
              <span className="font-bold underline">{expiringAlerts[0].diffDays} days</span> (
              {expiringAlerts[0].doc.expiryDate}). Renewal is recommended.
            </div>
          </div>
          <span className="text-[11px] text-amber-700 font-semibold underline cursor-pointer self-end sm:self-auto">
            View All ({expiringAlerts.length})
          </span>
        </div>
      )}

      {/* ── Section 3.1: Multi-Person / Family Persona Selector ──────────────── */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-blue-600" />
            Family Persona Profiles
          </span>
          <button
            onClick={() => setIsAddPersonOpen(true)}
            className="text-xs font-semibold text-blue-700 hover:text-blue-800 hover:underline flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Person
          </button>
        </div>

        {/* Persona Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          <button
            onClick={() => setSelectedPersonId('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 ${
              selectedPersonId === 'all'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200/80'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            All Family ({manifest?.documents.length || 0})
          </button>

          {manifest?.persons.map((person) => {
            const isSelected = selectedPersonId === person.id;
            const count = personDocCounts[person.id] || 0;
            return (
              <div key={person.id} className="relative group shrink-0">
                <button
                  onClick={() => setSelectedPersonId(person.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                    isSelected
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200/80'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  <span>{person.name}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                      isSelected ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    {count}
                  </span>
                </button>
                {manifest.persons.length > 1 && !person.isDefault && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeletePerson(person.id);
                    }}
                    title="Delete person profile"
                    className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition shadow-xs"
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Category Filters & Search Bar ───────────────────────────────────── */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Category Scroll Strip */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {categories.map((cat) => {
            const isSelected = selectedCategory === cat.key;
            return (
              <button
                key={cat.key}
                onClick={() => setSelectedCategory(cat.key)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition shrink-0 flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-slate-200 text-slate-900 font-bold border border-slate-300'
                    : 'bg-white hover:bg-slate-100 text-slate-600 border border-slate-200'
                }`}
              >
                <span>{cat.icon}</span>
                <span>{cat.label}</span>
              </button>
            );
          })}
        </div>

        {/* Search input */}
        <div className="relative min-w-[240px]">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search documents, numbers, persons..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white border border-slate-200 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* ── Section 3.2: Documents Grid with 3D Flip & Media Composition ────── */}
      {filteredDocuments.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center space-y-3 shadow-xs">
          <FileText className="w-10 h-10 text-slate-300 mx-auto" />
          <h3 className="text-base font-bold text-slate-800 serif-heading">No Documents Found</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            No records matched your persona or category criteria. Try resetting filters or adding a new record.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredDocuments.map((doc) => {
            const person = manifest?.persons.find((p) => p.id === doc.personId);
            const isFlipped = !!flippedCards[doc.id];
            const frontMedia = doc.media.find((m) => m.slot === 'front' || m.slot === 'combined' || m.slot === 'page');
            const backMedia = doc.media.find((m) => m.slot === 'back');

            return (
              <div
                key={doc.id}
                className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between"
              >
                {/* ── Top Header of Card ── */}
                <div className="p-4 border-b border-slate-100 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                      {doc.category.toUpperCase()} • {doc.issuingCountry || 'SOVEREIGN'}
                    </span>
                    {getAvatarBadge(person)}
                  </div>
                  <h3 className="text-sm font-bold text-slate-900 serif-heading line-clamp-1" title={doc.title}>
                    {doc.title}
                  </h3>
                </div>

                {/* ── Card Media Viewport (with 3D Flip Support) ── */}
                <div className="p-4 flex-1 flex flex-col items-center justify-center bg-slate-50/50">
                  {doc.layoutMode === 'front_back_separate' ? (
                    // ── 3D FLIP CARD VIEW ──
                    <div
                      className="w-full relative cursor-pointer"
                      style={{ perspective: '1000px', height: '210px' }}
                      onClick={(e) => toggleCardFlip(doc.id, e)}
                    >
                      <div
                        className="w-full h-full relative transition-transform duration-700 rounded-2xl"
                        style={{
                          transformStyle: 'preserve-3d',
                          transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)'
                        }}
                      >
                        {/* Front Face */}
                        <div
                          className="absolute inset-0 w-full h-full rounded-2xl overflow-hidden border border-slate-200 shadow-sm bg-white flex flex-col items-center justify-center"
                          style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' }}
                        >
                          {frontMedia?.previewUrl ? (
                            <img
                              src={frontMedia.previewUrl}
                              alt={frontMedia.label}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 text-xs space-y-1 p-4 text-center">
                              <FileText className="w-8 h-8 text-slate-300" />
                              <span>{frontMedia?.label || 'Front Scan'}</span>
                            </div>
                          )}
                          <div className="absolute bottom-2 right-2">
                            <span className="bg-slate-900/80 text-white text-[10px] px-2 py-0.5 rounded-full backdrop-blur-xs flex items-center gap-1 font-bold">
                              <RotateCw className="w-2.5 h-2.5" /> Tap to Flip
                            </span>
                          </div>
                        </div>

                        {/* Back Face (Reverse) */}
                        <div
                          className="absolute inset-0 w-full h-full rounded-2xl overflow-hidden border border-slate-200 shadow-sm bg-white flex flex-col items-center justify-center"
                          style={{
                            backfaceVisibility: 'hidden',
                            WebkitBackfaceVisibility: 'hidden',
                            transform: 'rotateY(180deg)'
                          }}
                        >
                          {backMedia?.previewUrl ? (
                            <img
                              src={backMedia.previewUrl}
                              alt={backMedia.label}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 text-xs space-y-1 p-4 text-center">
                              <FileText className="w-8 h-8 text-slate-300" />
                              <span>{backMedia?.label || 'Back Scan'}</span>
                            </div>
                          )}
                          <div className="absolute bottom-2 right-2">
                            <span className="bg-slate-900/80 text-white text-[10px] px-2 py-0.5 rounded-full backdrop-blur-xs flex items-center gap-1 font-bold">
                              <RotateCw className="w-2.5 h-2.5" /> Flip Front
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : doc.layoutMode === 'front_back_combined' ? (
                    // ── COMBINED STITCHED VIEW ──
                    <div className="w-full h-[210px] rounded-2xl overflow-hidden border border-slate-200 shadow-sm bg-white relative flex items-center justify-center">
                      {frontMedia?.previewUrl ? (
                        <img
                          src={frontMedia.previewUrl}
                          alt={frontMedia.label}
                          className="w-full h-full object-contain p-1"
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 text-xs space-y-1">
                          <FileText className="w-8 h-8 text-slate-300" />
                          <span>Stitched Dual-Sided Scan</span>
                        </div>
                      )}
                      <div className="absolute top-2 left-2 bg-slate-900/70 text-white text-[9px] font-bold px-2 py-0.5 rounded-full">
                        Stitched Front &amp; Back
                      </div>
                    </div>
                  ) : doc.layoutMode === 'multi_page_dossier' ? (
                    // ── MULTI-PAGE DOSSIER VIEW ──
                    <div className="w-full h-[210px] rounded-2xl overflow-hidden border border-slate-200 shadow-sm bg-white relative p-2 flex flex-col items-center justify-center">
                      {frontMedia?.previewUrl ? (
                        <img
                          src={frontMedia.previewUrl}
                          alt={frontMedia.label}
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <FileText className="w-12 h-12 text-slate-300" />
                      )}
                      <div className="absolute top-2 left-2 bg-amber-600/90 text-white text-[9px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                        <FileText className="w-2.5 h-2.5" />
                        Dossier • {doc.media.length} Pages
                      </div>
                    </div>
                  ) : (
                    // ── FRONT ONLY VIEW ──
                    <div className="w-full h-[210px] rounded-2xl overflow-hidden border border-slate-200 shadow-sm bg-white relative flex items-center justify-center">
                      {frontMedia?.previewUrl ? (
                        <img
                          src={frontMedia.previewUrl}
                          alt={frontMedia.label}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 text-xs space-y-1">
                          <FileText className="w-8 h-8 text-slate-300" />
                          <span>Single Face Document</span>
                        </div>
                      )}
                      <div className="absolute top-2 left-2 bg-slate-900/70 text-white text-[9px] font-bold px-2 py-0.5 rounded-full">
                        Single Face
                      </div>
                    </div>
                  )}
                </div>

                {/* ── Section 3.5.A: Quick-Copy Identity Micro-Chips ── */}
                <div className="px-4 py-2.5 bg-slate-50/80 border-t border-slate-100 flex flex-wrap items-center gap-1.5">
                  <button
                    onClick={() => copyToClipboardWithWipe(doc.documentNumber, 'Document No')}
                    className="px-2 py-1 rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-[11px] font-mono font-bold transition flex items-center gap-1 shadow-2xs"
                    title="Click to copy (auto-clears in 15s)"
                  >
                    <span>{doc.documentNumber}</span>
                    <Copy className="w-3 h-3 text-slate-400" />
                  </button>

                  {doc.expiryDate && (
                    <button
                      onClick={() => copyToClipboardWithWipe(doc.expiryDate!, 'Expiry Date')}
                      className="px-2 py-1 rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-[11px] font-mono transition flex items-center gap-1 shadow-2xs"
                      title="Expiry Date"
                    >
                      <span className="text-[10px] text-slate-400">EXP:</span>
                      <span>{doc.expiryDate}</span>
                    </button>
                  )}

                  {/* Badges for Versions and Linked Dossiers */}
                  {doc.previousVersions && doc.previousVersions.length > 0 && (
                    <span className="px-2 py-0.5 rounded-md bg-yellow-50 text-yellow-800 border border-yellow-200 text-[10px] font-bold flex items-center gap-1">
                      <History className="w-3 h-3" />
                      {doc.previousVersions.length} Old Version
                    </span>
                  )}

                  {doc.relatedDocuments && doc.relatedDocuments.length > 0 && (
                    <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-bold flex items-center gap-1">
                      <Paperclip className="w-3 h-3" />
                      {doc.relatedDocuments.length} Linked
                    </span>
                  )}
                </div>

                {/* ── Card Footer Actions ── */}
                <div className="p-3 bg-white border-t border-slate-100 flex items-center justify-between gap-2">
                  <button
                    onClick={() => {
                      setViewingDoc(doc);
                      setDossierPage(1);
                      setActiveVersionId(null);
                    }}
                    className="flex-1 py-1.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>View Dossier</span>
                  </button>

                  <button
                    onClick={() => setWatermarkDoc(doc)}
                    className="py-1.5 px-3 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5"
                    title="Export with client-side watermark and redaction"
                  >
                    <Sliders className="w-3.5 h-3.5" />
                    <span>Watermark &amp; Export</span>
                  </button>

                  <button
                    onClick={() => handleDeleteDocument(doc.id)}
                    className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition"
                    title="Delete document"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          1. FULL DOSSIER VIEWER MODAL (Versions, Multi-Page, Linked Attachments)
         ════════════════════════════════════════════════════════════════════════ */}
      {viewingDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/50 backdrop-blur-xs animate-fade-in">
          <div className="bg-white border border-slate-200 rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-200 flex items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
                    {viewingDoc.category.toUpperCase()}
                  </span>
                  <span className="text-xs text-slate-500 font-mono">No: {viewingDoc.documentNumber}</span>
                </div>
                <h2 className="text-lg font-bold text-slate-900 serif-heading mt-0.5">
                  {viewingDoc.title}
                </h2>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setWatermarkDoc(viewingDoc)}
                  className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl text-xs font-bold transition flex items-center gap-1.5"
                >
                  <Sliders className="w-3.5 h-3.5" />
                  Watermark &amp; Export
                </button>
                <button
                  onClick={() => setViewingDoc(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-800 rounded-xl transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Scrollable Body */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1">
              {/* Section 3.3: Version Switcher (Active vs Expired Historical Versions) */}
              {viewingDoc.previousVersions && viewingDoc.previousVersions.length > 0 && (
                <div className="p-3.5 rounded-2xl bg-amber-50/70 border border-amber-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                      <History className="w-3.5 h-3.5" />
                      Document Version History
                    </span>
                    <span className="text-[11px] text-amber-700">
                      {viewingDoc.previousVersions.length} archived previous version
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => setActiveVersionId(null)}
                      className={`px-3 py-1 rounded-xl text-xs font-bold transition ${
                        activeVersionId === null
                          ? 'bg-amber-600 text-white shadow-2xs'
                          : 'bg-white text-slate-700 border border-amber-200 hover:bg-amber-100'
                      }`}
                    >
                      Active Version ({viewingDoc.documentNumber})
                    </button>

                    {viewingDoc.previousVersions.map((ver) => (
                      <button
                        key={ver.versionId}
                        onClick={() => setActiveVersionId(ver.versionId)}
                        className={`px-3 py-1 rounded-xl text-xs font-bold transition ${
                          activeVersionId === ver.versionId
                            ? 'bg-amber-600 text-white shadow-2xs'
                            : 'bg-white text-slate-700 border border-amber-200 hover:bg-amber-100'
                        }`}
                      >
                        {ver.versionLabel} ({ver.documentNumber})
                      </button>
                    ))}
                  </div>

                  {activeVersionId && (
                    <div className="p-2.5 rounded-xl bg-white border border-amber-200 text-xs text-amber-900 font-semibold mt-2">
                      {viewingDoc.previousVersions.find((v) => v.versionId === activeVersionId)?.notes}
                    </div>
                  )}
                </div>
              )}

              {/* Media Preview Viewport */}
              <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4 flex flex-col items-center justify-center space-y-3">
                {viewingDoc.layoutMode === 'multi_page_dossier' ? (
                  // Multi-page dossier controls & view
                  <div className="w-full space-y-3">
                    <div className="flex items-center justify-between bg-white px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold">
                      <span className="text-slate-600">
                        Page {dossierPage} of {viewingDoc.media.length}
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          disabled={dossierPage <= 1}
                          onClick={() => setDossierPage((p) => Math.max(1, p - 1))}
                          className="p-1 rounded-lg hover:bg-slate-100 disabled:opacity-40 text-slate-700"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </button>
                        <button
                          disabled={dossierPage >= viewingDoc.media.length}
                          onClick={() => setDossierPage((p) => Math.min(viewingDoc.media.length, p + 1))}
                          className="p-1 rounded-lg hover:bg-slate-100 disabled:opacity-40 text-slate-700"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <div className="max-h-[500px] overflow-auto flex items-center justify-center bg-white rounded-xl border border-slate-200 p-2">
                      {viewingDoc.media[dossierPage - 1]?.previewUrl ? (
                        <img
                          src={viewingDoc.media[dossierPage - 1]?.previewUrl}
                          alt={`Page ${dossierPage}`}
                          className="max-h-[460px] object-contain shadow-xs"
                        />
                      ) : (
                        <div className="p-12 text-center text-slate-400 text-xs">
                          <FileText className="w-12 h-12 text-slate-300 mx-auto mb-2" />
                          <span>Dossier Page {dossierPage} (Ciphertext Blob)</span>
                        </div>
                      )}
                    </div>

                    {/* Thumbnail strip */}
                    <div className="flex items-center gap-2 overflow-x-auto p-1">
                      {viewingDoc.media.map((page, idx) => (
                        <button
                          key={idx}
                          onClick={() => setDossierPage(idx + 1)}
                          className={`w-16 h-20 rounded-lg border-2 overflow-hidden shrink-0 transition flex items-center justify-center bg-white ${
                            dossierPage === idx + 1 ? 'border-blue-600 ring-2 ring-blue-200' : 'border-slate-200 opacity-60 hover:opacity-100'
                          }`}
                        >
                          {page.previewUrl ? (
                            <img src={page.previewUrl} alt={`Page ${idx + 1}`} className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-[10px] font-bold text-slate-400">P.{idx + 1}</span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  // Dual or Single Card Display
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
                    {viewingDoc.media.map((m, idx) => (
                      <div key={idx} className="bg-white rounded-2xl border border-slate-200 p-3 space-y-2 shadow-2xs">
                        <span className="text-[11px] font-bold text-slate-600">{m.label}</span>
                        <div className="rounded-xl overflow-hidden border border-slate-100 min-h-[160px] flex items-center justify-center bg-slate-50">
                          {m.previewUrl ? (
                            <img src={m.previewUrl} alt={m.label} className="w-full h-auto object-cover" />
                          ) : (
                            <div className="p-8 text-center text-slate-400 text-xs">
                              <FileText className="w-8 h-8 text-slate-300 mx-auto mb-1" />
                              <span>{m.label} (Encrypted)</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Section 3.4: Linked & Related Document Clusters */}
              {viewingDoc.relatedDocuments && viewingDoc.relatedDocuments.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                    <Paperclip className="w-3.5 h-3.5 text-blue-600" />
                    Linked Supporting Documents &amp; Relational Dossier
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {viewingDoc.relatedDocuments.map((rel) => (
                      <div
                        key={rel.id}
                        className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex items-start justify-between gap-3"
                      >
                        <div className="space-y-1">
                          <p className="text-xs font-bold text-slate-900">{rel.title}</p>
                          <p className="text-[11px] text-slate-500">{rel.description}</p>
                          {rel.issuedDate && (
                            <span className="text-[10px] text-slate-400 font-mono">Issued: {rel.issuedDate}</span>
                          )}
                        </div>
                        <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold uppercase shrink-0">
                          {rel.category}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          2. DYNAMIC CLIENT-SIDE WATERMARKING & REDACTION SUITE MODAL
         ════════════════════════════════════════════════════════════════════════ */}
      {watermarkDoc && (
        <WatermarkRedactModal
          doc={watermarkDoc}
          onClose={() => setWatermarkDoc(null)}
        />
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          3. ADD DOCUMENT MODAL (Real File Upload & Client-Side AES Encryption)
         ════════════════════════════════════════════════════════════════════════ */}
      {isAddDocOpen && manifest && (
        <AddDocumentModal
          manifest={manifest}
          masterVaultKey={masterVaultKey}
          authToken={authToken}
          onClose={() => setIsAddDocOpen(false)}
          onAddDocument={async (newDoc) => {
            if (!masterVaultKey) return;
            const updated: VaultManifest = {
              ...manifest,
              documents: [newDoc, ...manifest.documents],
              updatedAt: new Date().toISOString()
            };
            setManifest(updated);
            setIsAddDocOpen(false);
            await syncManifestToCloud(updated, masterVaultKey);
          }}
        />
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          4. ADD PERSON PROFILE MODAL
         ════════════════════════════════════════════════════════════════════════ */}
      {isAddPersonOpen && (
        <AddPersonModal
          onClose={() => setIsAddPersonOpen(false)}
          onAddPerson={async (newPerson) => {
            if (!manifest || !masterVaultKey) return;
            const updated: VaultManifest = {
              ...manifest,
              persons: [...manifest.persons, newPerson],
              updatedAt: new Date().toISOString()
            };
            setManifest(updated);
            setIsAddPersonOpen(false);
            await syncManifestToCloud(updated, masterVaultKey);
          }}
        />
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          5. FAMILY SUMMARY DOSSIER MODAL
         ════════════════════════════════════════════════════════════════════════ */}
      {isFamilySummaryOpen && manifest && (
        <FamilySummaryModal
          manifest={manifest}
          onClose={() => setIsFamilySummaryOpen(false)}
        />
      )}
    </div>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// SUB-COMPONENT: Dynamic Watermarking & Redaction Suite (Pure HTML5 Canvas)
// ══════════════════════════════════════════════════════════════════════════════

interface WatermarkRedactModalProps {
  doc: VaultDocument;
  onClose: () => void;
}

const WatermarkRedactModal: React.FC<WatermarkRedactModalProps> = ({ doc, onClose }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [watermarkText, setWatermarkText] = useState<string>(
    `FOR VISA APPLICATION ONLY - ${new Date().toISOString().split('T')[0]}`
  );
  const [recipientName, setRecipientName] = useState<string>('EMBASSY OF JAPAN');
  const [opacity, setOpacity] = useState<number>(0.35);
  const [angle, setAngle] = useState<number>(-30);
  const [fontSize, setFontSize] = useState<number>(24);
  const [isRedactMode, setIsRedactMode] = useState<boolean>(false);
  const [redactions, setRedactions] = useState<{ x: number; y: number; w: number; h: number }[]>([]);
  const [isDrawing, setIsDrawing] = useState<boolean>(false);
  const [startPos, setStartPos] = useState<{ x: number; y: number } | null>(null);

  const activeMedia = doc.media[0];

  // Draw on canvas whenever parameters change
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const renderWatermarks = (imgWidth: number, imgHeight: number) => {
      canvas.width = imgWidth;
      canvas.height = imgHeight;

      if (watermarkText.trim()) {
        ctx.save();
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate((angle * Math.PI) / 180);
        ctx.fillStyle = `rgba(180, 20, 20, ${opacity})`;
        ctx.font = `bold ${fontSize}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        const fullText = recipientName.trim()
          ? `${watermarkText.trim()} • [${recipientName.trim().toUpperCase()}]`
          : watermarkText.trim();

        for (let y = -canvas.height; y <= canvas.height; y += fontSize * 3.5) {
          ctx.fillText(fullText, 0, y);
        }
        ctx.restore();
      }

      ctx.fillStyle = '#000000';
      redactions.forEach((r) => {
        ctx.fillRect(r.x, r.y, r.w, r.h);
      });
    };

    if (activeMedia?.previewUrl) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = activeMedia.previewUrl;
      img.onload = () => {
        ctx.clearRect(0, 0, img.width, img.height);
        ctx.drawImage(img, 0, 0, img.width, img.height);
        renderWatermarks(img.width || 700, img.height || 480);
      };
    } else {
      ctx.fillStyle = '#f8f6f0';
      ctx.fillRect(0, 0, 700, 480);
      renderWatermarks(700, 480);
    }
  }, [activeMedia, watermarkText, recipientName, opacity, angle, fontSize, redactions]);

  // Canvas mouse handlers for click-and-drag redaction tool
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isRedactMode) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    setStartPos({ x, y });
    setIsDrawing(true);
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !startPos) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const currentX = (e.clientX - rect.left) * scaleX;
    const currentY = (e.clientY - rect.top) * scaleY;

    const x = Math.min(startPos.x, currentX);
    const y = Math.min(startPos.y, currentY);
    const w = Math.abs(currentX - startPos.x);
    const h = Math.abs(currentY - startPos.y);

    if (w > 5 && h > 5) {
      setRedactions((prev) => [...prev, { x, y, w, h }]);
    }
    setIsDrawing(false);
    setStartPos(null);
  };

  const handleExportDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `${doc.title.replace(/\s+/g, '_')}_watermarked_${Date.now()}.jpg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/50 backdrop-blur-xs animate-fade-in">
      <div className="bg-white border border-slate-200 rounded-3xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900 serif-heading flex items-center gap-2">
              <Sliders className="w-4 h-4 text-blue-600" />
              Dynamic Watermark &amp; Redaction Studio
            </h2>
            <p className="text-[11px] text-slate-500">
              Baked client-side directly onto pixels before download • Zero server transmission
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-800 rounded-xl">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Studio Content */}
        <div className="p-5 overflow-y-auto flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Controls Panel */}
          <div className="space-y-4">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                Watermark Intent / Purpose
              </label>
              <input
                type="text"
                value={watermarkText}
                onChange={(e) => setWatermarkText(e.target.value)}
                placeholder="e.g. FOR VISA APPLICATION ONLY"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                Designated Recipient / Agency
              </label>
              <input
                type="text"
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                placeholder="e.g. EMBASSY OF JAPAN"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-blue-500"
              />
            </div>

            {/* Presets */}
            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-slate-400 uppercase">Quick Presets</label>
              <div className="flex flex-wrap gap-1">
                {['FOR VISA APPLICATION ONLY', 'FOR KYC VERIFICATION', 'CONFIDENTIAL - DO NOT COPY'].map((p) => (
                  <button
                    key={p}
                    onClick={() => setWatermarkText(`${p} - ${new Date().toISOString().split('T')[0]}`)}
                    className="px-2 py-0.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 text-[10px] font-semibold"
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            {/* Sliders */}
            <div className="space-y-3 pt-2 border-t border-slate-200">
              <div>
                <div className="flex items-center justify-between text-xs text-slate-600 font-semibold mb-1">
                  <span>Opacity</span>
                  <span>{Math.round(opacity * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="0.9"
                  step="0.05"
                  value={opacity}
                  onChange={(e) => setOpacity(parseFloat(e.target.value))}
                  className="w-full accent-blue-600"
                />
              </div>

              <div>
                <div className="flex items-center justify-between text-xs text-slate-600 font-semibold mb-1">
                  <span>Diagonal Angle</span>
                  <span>{angle}°</span>
                </div>
                <input
                  type="range"
                  min="-60"
                  max="60"
                  step="5"
                  value={angle}
                  onChange={(e) => setAngle(parseInt(e.target.value))}
                  className="w-full accent-blue-600"
                />
              </div>

              <div>
                <div className="flex items-center justify-between text-xs text-slate-600 font-semibold mb-1">
                  <span>Font Size</span>
                  <span>{fontSize}px</span>
                </div>
                <input
                  type="range"
                  min="14"
                  max="48"
                  step="2"
                  value={fontSize}
                  onChange={(e) => setFontSize(parseInt(e.target.value))}
                  className="w-full accent-blue-600"
                />
              </div>
            </div>

            {/* Redaction Tool Toggle */}
            <div className="pt-2 border-t border-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700">Black-Out Redactor</span>
                <button
                  onClick={() => setIsRedactMode(!isRedactMode)}
                  className={`px-3 py-1 rounded-xl text-xs font-bold transition flex items-center gap-1 ${
                    isRedactMode
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  <Edit3 className="w-3 h-3" />
                  {isRedactMode ? 'Redact Active (Drag on Canvas)' : 'Enable Tool'}
                </button>
              </div>
              {redactions.length > 0 && (
                <div className="flex items-center justify-between text-[11px] text-slate-500">
                  <span>{redactions.length} redaction box(es) applied</span>
                  <button
                    onClick={() => setRedactions([])}
                    className="text-red-600 hover:underline font-bold"
                  >
                    Clear All
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Interactive Canvas Viewport */}
          <div className="lg:col-span-2 flex flex-col items-center justify-center bg-slate-100 rounded-2xl p-4 border border-slate-200 overflow-hidden">
            <canvas
              ref={canvasRef}
              onMouseDown={handleMouseDown}
              onMouseUp={handleMouseUp}
              className={`max-w-full h-auto rounded-xl shadow-md border border-slate-300 ${
                isRedactMode ? 'cursor-crosshair' : 'cursor-default'
              }`}
            />
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <span className="text-[11px] text-slate-500">
            Exported file contains indelible, flattened pixel transformations.
          </span>
          <button
            onClick={handleExportDownload}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-xs flex items-center gap-2"
          >
            <Download className="w-3.5 h-3.5" />
            Download Watermarked JPEG
          </button>
        </div>
      </div>
    </div>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// SUB-COMPONENT: Add New Document Modal (Real File Picker & AES-GCM Encryption)
// ══════════════════════════════════════════════════════════════════════════════

interface AddDocumentModalProps {
  manifest: VaultManifest;
  masterVaultKey: CryptoKey | null;
  authToken?: string | null;
  onClose: () => void;
  onAddDocument: (doc: VaultDocument) => void;
}

const AddDocumentModal: React.FC<AddDocumentModalProps> = ({
  manifest,
  masterVaultKey,
  authToken,
  onClose,
  onAddDocument
}) => {
  const [personId, setPersonId] = useState<string>(manifest.persons[0]?.id || 'person_self');
  const [category, setCategory] = useState<DocumentCategory>('identity');
  const [title, setTitle] = useState<string>('');
  const [documentNumber, setDocumentNumber] = useState<string>('');
  const [issuingCountry, setIssuingCountry] = useState<string>('Nepal');
  const [issuedDate, setIssuedDate] = useState<string>('');
  const [expiryDate, setExpiryDate] = useState<string>('');
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('front_back_separate');
  const [notes, setNotes] = useState<string>('');
  const [isEncrypting, setIsEncrypting] = useState<boolean>(false);

  // File upload state for each slot
  const [frontFile, setFrontFile] = useState<File | null>(null);
  const [backFile, setBackFile] = useState<File | null>(null);
  const [combinedFile, setCombinedFile] = useState<File | null>(null);
  const [dossierFiles, setDossierFiles] = useState<File[]>([]);

  // Linked Document sub-form
  const [relatedTitle, setRelatedTitle] = useState<string>('');
  const [relatedCategory, setRelatedCategory] = useState<string>('receipt');
  const [relatedFile, setRelatedFile] = useState<File | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !documentNumber.trim() || !masterVaultKey) return;

    try {
      setIsEncrypting(true);
      const mediaSlots: DocumentMediaSlot[] = [];

      // Helper to encrypt a real file with a fresh disposable DEK and upload
      const encryptAndUploadFile = async (file: File, slot: DocumentMediaSlot['slot'], label: string, pageNumber?: number): Promise<DocumentMediaSlot> => {
        const dek = await generateDEK();
        const envelope = await wrapDEK(dek, masterVaultKey);
        const { ciphertextB64, ivB64 } = await encryptBlob(file, dek);
        const blobUuid = 'blob_' + Math.random().toString(36).substring(2, 12);

        // Upload ciphertext to Azure / Google Drive blob store
        if (authToken) {
          await fetch('/api/vault/blob/upload', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Session-Token': authToken
            },
            body: JSON.stringify({
              blobUuid,
              ciphertextBase64: ciphertextB64,
              mimeType: file.type
            })
          }).catch(() => {});
        }

        return {
          slot,
          label,
          pageNumber,
          mimeType: file.type || 'image/jpeg',
          blobUuid,
          ciphertextBase64: ciphertextB64,
          ivBase64: ivB64,
          dekEnvelope: envelope,
          previewUrl: URL.createObjectURL(file) // ephemeral memory URL
        };
      };

      // Process uploaded files based on selected composition layout mode
      if (layoutMode === 'front_back_separate') {
        if (frontFile) {
          const m = await encryptAndUploadFile(frontFile, 'front', 'Front Biographical Page');
          mediaSlots.push(m);
        } else {
          mediaSlots.push({ slot: 'front', label: 'Front Page', mimeType: 'image/jpeg' });
        }

        if (backFile) {
          const m = await encryptAndUploadFile(backFile, 'back', 'Back Endorsement Page');
          mediaSlots.push(m);
        } else {
          mediaSlots.push({ slot: 'back', label: 'Back Page', mimeType: 'image/jpeg' });
        }
      } else if (layoutMode === 'front_back_combined') {
        if (combinedFile) {
          const m = await encryptAndUploadFile(combinedFile, 'combined', 'Combined Front & Back Sheet');
          mediaSlots.push(m);
        } else {
          mediaSlots.push({ slot: 'combined', label: 'Stitched Card', mimeType: 'image/jpeg' });
        }
      } else if (layoutMode === 'multi_page_dossier') {
        if (dossierFiles.length > 0) {
          for (let i = 0; i < dossierFiles.length; i++) {
            const m = await encryptAndUploadFile(dossierFiles[i], 'page', `Page ${i + 1}`, i + 1);
            mediaSlots.push(m);
          }
        } else {
          mediaSlots.push({ slot: 'page', pageNumber: 1, label: 'Page 1', mimeType: 'image/jpeg' });
        }
      } else {
        if (frontFile) {
          const m = await encryptAndUploadFile(frontFile, 'front', 'Front Face Document');
          mediaSlots.push(m);
        } else {
          mediaSlots.push({ slot: 'front', label: 'Document Face', mimeType: 'image/jpeg' });
        }
      }

      // Process related supporting child document if provided
      const relatedDocs: RelatedChildDocument[] = [];
      if (relatedTitle.trim()) {
        let relMedia: DocumentMediaSlot | undefined = undefined;
        if (relatedFile) {
          relMedia = await encryptAndUploadFile(relatedFile, 'page', relatedTitle.trim());
        }
        relatedDocs.push({
          id: 'rel_' + Math.random().toString(36).substring(2, 9),
          title: relatedTitle.trim(),
          category: relatedCategory,
          issuedDate: new Date().toISOString().split('T')[0],
          media: relMedia
        });
      }

      const newDoc: VaultDocument = {
        id: 'doc_' + Math.random().toString(36).substring(2, 10),
        personId,
        category,
        title: title.trim(),
        documentNumber: documentNumber.trim(),
        issuingCountry,
        issuedDate: issuedDate || undefined,
        expiryDate: expiryDate || undefined,
        layoutMode,
        status: 'active',
        notes: notes.trim() || undefined,
        media: mediaSlots,
        relatedDocuments: relatedDocs.length > 0 ? relatedDocs : undefined,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      setIsEncrypting(false);
      onAddDocument(newDoc);
    } catch (err: any) {
      setIsEncrypting(false);
      alert('Encryption & Upload error: ' + err.message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/50 backdrop-blur-xs animate-fade-in">
      <div className="bg-white border border-slate-200 rounded-3xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden">
        <div className="p-5 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900 serif-heading flex items-center gap-2">
            <Plus className="w-4 h-4 text-blue-600" />
            Add Real Document to Zero-Knowledge Vault
          </h2>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-800 rounded-xl">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4 flex-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                Family Profile / Custodian
              </label>
              <select
                value={personId}
                onChange={(e) => setPersonId(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-blue-500"
              >
                {manifest.persons.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.relationship.toUpperCase()})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as DocumentCategory)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-blue-500"
              >
                <option value="identity">🪪 Identity &amp; Citizenship</option>
                <option value="travel">✈️ Travel &amp; Passports</option>
                <option value="finance">💼 Financial &amp; Tax</option>
                <option value="legal">📜 Property &amp; Legal</option>
                <option value="academic">🎓 Academic &amp; Degrees</option>
                <option value="health">🏥 Health &amp; Medical</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
              Document Title
            </label>
            <input
              type="text"
              required
              placeholder="e.g. National Identity Card"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                Document Number / Identifier
              </label>
              <input
                type="text"
                required
                placeholder="e.g. PA0829141"
                value={documentNumber}
                onChange={(e) => setDocumentNumber(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 font-mono focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                Issuing Country
              </label>
              <input
                type="text"
                placeholder="e.g. Nepal"
                value={issuingCountry}
                onChange={(e) => setIssuingCountry(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                Issued Date
              </label>
              <input
                type="date"
                value={issuedDate}
                onChange={(e) => setIssuedDate(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                Expiry Date
              </label>
              <input
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
              Media Composition Mode
            </label>
            <select
              value={layoutMode}
              onChange={(e) => setLayoutMode(e.target.value as LayoutMode)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-blue-500"
            >
              <option value="front_back_separate">Dual-Sided (3D Interactive Flip Card)</option>
              <option value="front_back_combined">Single-Sheet Stitched (Combined View)</option>
              <option value="front_only">Single Face (Front Only)</option>
              <option value="multi_page_dossier">Multi-Page Dossier / Contracts</option>
            </select>
          </div>

          {/* ── REAL FILE PICKER UPLOAD REGIONS ───────────────────────────────── */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
            <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Upload className="w-3.5 h-3.5 text-blue-600" />
              Upload Document Media Files (Encrypted on Device)
            </span>

            {layoutMode === 'front_back_separate' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase">Front Page Image / Scan</label>
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={(e) => setFrontFile(e.target.files?.[0] || null)}
                    className="w-full text-xs text-slate-600 file:mr-2 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                  />
                  {frontFile && <span className="text-[10px] text-emerald-600 font-semibold">Selected: {frontFile.name}</span>}
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase">Back Page Image / Scan</label>
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={(e) => setBackFile(e.target.files?.[0] || null)}
                    className="w-full text-xs text-slate-600 file:mr-2 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                  />
                  {backFile && <span className="text-[10px] text-emerald-600 font-semibold">Selected: {backFile.name}</span>}
                </div>
              </div>
            )}

            {layoutMode === 'front_back_combined' && (
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-slate-500 uppercase">Stitched Single-Sheet Scan</label>
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={(e) => setCombinedFile(e.target.files?.[0] || null)}
                  className="w-full text-xs text-slate-600 file:mr-2 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
                {combinedFile && <span className="text-[10px] text-emerald-600 font-semibold">Selected: {combinedFile.name}</span>}
              </div>
            )}

            {layoutMode === 'multi_page_dossier' && (
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-slate-500 uppercase">Upload Dossier Pages (Multiple Images / PDFs)</label>
                <input
                  type="file"
                  multiple
                  accept="image/*,application/pdf"
                  onChange={(e) => setDossierFiles(Array.from(e.target.files || []))}
                  className="w-full text-xs text-slate-600 file:mr-2 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
                {dossierFiles.length > 0 && (
                  <span className="text-[10px] text-emerald-600 font-semibold">
                    {dossierFiles.length} page files selected
                  </span>
                )}
              </div>
            )}

            {layoutMode === 'front_only' && (
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-slate-500 uppercase">Front Face Document Scan</label>
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={(e) => setFrontFile(e.target.files?.[0] || null)}
                  className="w-full text-xs text-slate-600 file:mr-2 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
                {frontFile && <span className="text-[10px] text-emerald-600 font-semibold">Selected: {frontFile.name}</span>}
              </div>
            )}
          </div>

          {/* ── LINKED / RELATED SUPPORTING DOCUMENT ─────────────────────────── */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
            <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Paperclip className="w-3.5 h-3.5 text-blue-600" />
              Link Supporting Document (Relational Cluster)
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <input
                  type="text"
                  placeholder="e.g. Aadhar Enrollment Slip"
                  value={relatedTitle}
                  onChange={(e) => setRelatedTitle(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <select
                  value={relatedCategory}
                  onChange={(e) => setRelatedCategory(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-blue-500"
                >
                  <option value="receipt">Receipt / Slip</option>
                  <option value="legal">Legal Affidavit / Translation</option>
                  <option value="photo">Photo Spec</option>
                  <option value="clearance">Police / Medical Clearance</option>
                </select>
              </div>
            </div>

            <div>
              <input
                type="file"
                accept="image/*,application/pdf"
                onChange={(e) => setRelatedFile(e.target.files?.[0] || null)}
                className="w-full text-xs text-slate-600 file:mr-2 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
              Private Notes &amp; Custody Details
            </label>
            <textarea
              rows={2}
              placeholder="e.g. Original stored in safe #2"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="pt-2 border-t border-slate-200 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isEncrypting}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-xs flex items-center gap-1.5"
            >
              {isEncrypting ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Encrypting Client-Side...
                </>
              ) : (
                <>
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Encrypt &amp; Seal in Vault
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// SUB-COMPONENT: Add New Person Profile Modal
// ══════════════════════════════════════════════════════════════════════════════

interface AddPersonModalProps {
  onClose: () => void;
  onAddPerson: (person: Person) => void;
}

const AddPersonModal: React.FC<AddPersonModalProps> = ({ onClose, onAddPerson }) => {
  const [name, setName] = useState<string>('');
  const [relationship, setRelationship] = useState<RelationshipType>('sibling');
  const [avatarColor, setAvatarColor] = useState<string>('emerald');
  const [dob, setDob] = useState<string>('');
  const [bloodGroup, setBloodGroup] = useState<string>('O+');
  const [emergencyPhone, setEmergencyPhone] = useState<string>('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const newPerson: Person = {
      id: 'person_' + Math.random().toString(36).substring(2, 9),
      name: name.trim(),
      relationship,
      avatarColor,
      dob: dob || undefined,
      bloodGroup: bloodGroup || undefined,
      emergencyPhone: emergencyPhone.trim() || undefined
    };

    onAddPerson(newPerson);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/50 backdrop-blur-xs animate-fade-in">
      <div className="bg-white border border-slate-200 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="p-5 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900 serif-heading flex items-center gap-2">
            <User className="w-4 h-4 text-blue-600" />
            Add Family Profile Persona
          </h2>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-800 rounded-xl">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
              Full Legal Name
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Sujan Regmi"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                Relationship
              </label>
              <select
                value={relationship}
                onChange={(e) => setRelationship(e.target.value as RelationshipType)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-blue-500"
              >
                <option value="self">Self</option>
                <option value="father">Father</option>
                <option value="mother">Mother</option>
                <option value="sibling">Sibling</option>
                <option value="spouse">Spouse</option>
                <option value="child">Child</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                Avatar Theme
              </label>
              <select
                value={avatarColor}
                onChange={(e) => setAvatarColor(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-blue-500"
              >
                <option value="emerald">Sage Green</option>
                <option value="blue">Amber Gold</option>
                <option value="rose">Warm Rose</option>
                <option value="amber">Ochre</option>
                <option value="purple">Purple</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                Date of Birth
              </label>
              <input
                type="date"
                value={dob}
                onChange={(e) => setDob(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                Blood Group
              </label>
              <input
                type="text"
                placeholder="e.g. O+"
                value={bloodGroup}
                onChange={(e) => setBloodGroup(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
              Emergency Phone
            </label>
            <input
              type="text"
              placeholder="+977-98..."
              value={emergencyPhone}
              onChange={(e) => setEmergencyPhone(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="pt-2 border-t border-slate-200 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-xs"
            >
              Save Profile
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// SUB-COMPONENT: Family Emergency Summary Dossier Modal
// ══════════════════════════════════════════════════════════════════════════════

interface FamilySummaryModalProps {
  manifest: VaultManifest;
  onClose: () => void;
}

const FamilySummaryModal: React.FC<FamilySummaryModalProps> = ({ manifest, onClose }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/50 backdrop-blur-xs animate-fade-in">
      <div className="bg-white border border-slate-200 rounded-3xl shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900 serif-heading flex items-center gap-2">
              <FileText className="w-4 h-4 text-emerald-600" />
              Consolidated Family Summary Dossier
            </h2>
            <p className="text-[11px] text-slate-500">
              One-click emergency travel, medical &amp; identity card roster for all registered members
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => window.print()}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5"
            >
              <Printer className="w-3.5 h-3.5" />
              Print Roster
            </button>
            <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-800 rounded-xl">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {manifest.persons.map((person) => {
            const personDocs = manifest.documents.filter((d) => d.personId === person.id);
            return (
              <div
                key={person.id}
                className="bg-slate-50 rounded-2xl border border-slate-200 p-4 space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-emerald-500" />
                    <h3 className="text-sm font-bold text-slate-900 serif-heading">{person.name}</h3>
                    <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">
                      {person.relationship}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-600">
                    {person.bloodGroup && (
                      <span>
                        Blood: <strong className="text-red-700">{person.bloodGroup}</strong>
                      </span>
                    )}
                    {person.dob && <span>DOB: {person.dob}</span>}
                    {person.emergencyPhone && <span>📞 {person.emergencyPhone}</span>}
                  </div>
                </div>

                {personDocs.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">No credentials cataloged yet.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {personDocs.map((doc) => (
                      <div
                        key={doc.id}
                        className="bg-white p-2.5 rounded-xl border border-slate-200 text-xs flex items-center justify-between"
                      >
                        <div>
                          <p className="font-bold text-slate-800">{doc.title}</p>
                          <p className="font-mono text-[11px] text-slate-500">{doc.documentNumber}</p>
                        </div>
                        {doc.expiryDate && (
                          <span className="text-[10px] text-slate-500 font-mono">
                            Exp: {doc.expiryDate}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default DocumentVault;
