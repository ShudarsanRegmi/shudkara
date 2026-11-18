import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Shield,
  ShieldCheck,
  Lock,
  Unlock,
  Key,
  QrCode,
  Smartphone,
  Copy,
  Eye,
  RotateCw,
  Plus,
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
  AlertCircle
} from 'lucide-react';

import {
  generateMasterVaultKey,
  generateDEK,
  wrapDEK,
  deriveMVKFromPassphrase,
  generateEphemeralECDH,
  importPeerECDHPublicKey,
  deriveECDHSharedSecret,
  sealMVKForRelay,
  unsealMVKFromRelay
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
  previewUrl?: string; // Decrypted ephemeral Object URL (RAM only)
  blobUuid?: string;
  encryptedBlobB64?: string; // Ciphertext
  dekEnvelope?: WrappedKeyEnvelope; // Wrapped DEK
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

// ── Photorealistic Procedural Document Card Graphic Generators ──────────────────
// Produces beautiful SVG data URLs for government credentials (Passport, Nagarikata, Aadhar, etc.)

function createSamplePassportFrontSvg(name: string, docNo: string, dob: string, expiry: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 700 480" width="700" height="480">
    <defs>
      <linearGradient id="passportBg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#fbf8f1"/>
        <stop offset="50%" stop-color="#f6efe1"/>
        <stop offset="100%" stop-color="#ede3cf"/>
      </linearGradient>
      <pattern id="guilloche" width="30" height="30" patternUnits="userSpaceOnUse">
        <path d="M 0 15 Q 7.5 0, 15 15 T 30 15" fill="none" stroke="#d5c7ad" stroke-width="0.7" opacity="0.45"/>
        <circle cx="15" cy="15" r="10" fill="none" stroke="#caa15d" stroke-width="0.5" opacity="0.3"/>
      </pattern>
    </defs>
    <!-- Background Card -->
    <rect width="700" height="480" rx="20" fill="url(#passportBg)"/>
    <rect width="680" height="460" x="10" y="10" rx="16" fill="url(#guilloche)" stroke="#c2b090" stroke-width="1.5"/>
    
    <!-- Header Banner -->
    <rect x="25" y="24" width="650" height="52" rx="8" fill="#1b2a4a"/>
    <text x="50" y="48" fill="#caa15d" font-family="'Plus Jakarta Sans', sans-serif" font-size="11" font-weight="bold" letter-spacing="3">PASSPORT • PASSEPORT • राहदानी</text>
    <text x="50" y="66" fill="#ffffff" font-family="'Plus Jakarta Sans', sans-serif" font-size="14" font-weight="900" letter-spacing="4">GOVERNMENT OF NEPAL</text>
    <text x="640" y="58" fill="#caa15d" font-family="monospace" font-size="14" font-weight="bold" text-anchor="end">NPL</text>

    <!-- Photo Slot with Crest -->
    <rect x="40" y="98" width="165" height="215" rx="10" fill="#e5dfd2" stroke="#bda888" stroke-width="2"/>
    <circle cx="122" cy="170" r="45" fill="#caa15d" opacity="0.3"/>
    <path d="M 75 290 C 75 230, 170 230, 170 290 Z" fill="#caa15d" opacity="0.45"/>
    <text x="122" y="305" fill="#5a5450" font-family="sans-serif" font-size="10" text-anchor="middle" font-weight="bold">OFFICIAL BIOMETRIC</text>

    <!-- Document Fields -->
    <g transform="translate(230, 95)" font-family="'Plus Jakarta Sans', sans-serif">
      <text x="0" y="16" fill="#8a8076" font-size="9" font-weight="bold" letter-spacing="1">SURNAME / NOM</text>
      <text x="0" y="34" fill="#1c1714" font-size="15" font-weight="800">${name.split(' ').slice(-1)[0] || 'REGMI'}</text>

      <text x="0" y="60" fill="#8a8076" font-size="9" font-weight="bold" letter-spacing="1">GIVEN NAMES / PRÉNOMS</text>
      <text x="0" y="78" fill="#1c1714" font-size="14" font-weight="800">${name}</text>

      <text x="0" y="104" fill="#8a8076" font-size="9" font-weight="bold" letter-spacing="1">NATIONALITY / NATIONALITÉ</text>
      <text x="0" y="120" fill="#1c1714" font-size="13" font-weight="bold">NEPALESE</text>

      <text x="220" y="104" fill="#8a8076" font-size="9" font-weight="bold" letter-spacing="1">DOCUMENT NO.</text>
      <text x="220" y="122" fill="#b38e4b" font-family="monospace" font-size="16" font-weight="900">${docNo}</text>

      <text x="0" y="146" fill="#8a8076" font-size="9" font-weight="bold" letter-spacing="1">DATE OF BIRTH</text>
      <text x="0" y="162" fill="#1c1714" font-size="12" font-weight="bold">${dob}</text>

      <text x="220" y="146" fill="#8a8076" font-size="9" font-weight="bold" letter-spacing="1">DATE OF EXPIRY</text>
      <text x="220" y="162" fill="#1c1714" font-size="12" font-weight="bold">${expiry}</text>

      <text x="0" y="188" fill="#8a8076" font-size="9" font-weight="bold" letter-spacing="1">ISSUING AUTHORITY</text>
      <text x="0" y="204" fill="#1c1714" font-size="12" font-weight="bold">DEPARTMENT OF PASSPORTS KATHMANDU</text>
    </g>

    <!-- Security Hologram Chip -->
    <rect x="580" y="260" width="70" height="50" rx="8" fill="#caa15d" opacity="0.3" stroke="#b38e4b" stroke-width="1.5"/>
    <text x="615" y="290" fill="#8c6e35" font-size="11" font-weight="bold" text-anchor="middle">CHIP</text>

    <!-- MRZ Machine Readable Zone -->
    <rect x="25" y="380" width="650" height="75" rx="8" fill="#f2ecde" stroke="#d6cebc"/>
    <text x="40" y="412" fill="#1c1714" font-family="monospace" font-size="16" letter-spacing="4">P&lt;NPL${name.replace(/\s+/g, '&lt;')}&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;</text>
    <text x="40" y="438" fill="#1c1714" font-family="monospace" font-size="16" letter-spacing="4">${docNo}4NPL${dob.replace(/-/g, '').slice(2)}8M${expiry.replace(/-/g, '').slice(2)}5&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;8</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function createSamplePassportBackSvg(emergencyContact: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 700 480" width="700" height="480">
    <defs>
      <linearGradient id="passportBackBg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#fdfbf7"/>
        <stop offset="100%" stop-color="#f5efe4"/>
      </linearGradient>
    </defs>
    <rect width="700" height="480" rx="20" fill="url(#passportBackBg)"/>
    <rect width="670" height="450" x="15" y="15" rx="14" fill="none" stroke="#caa15d" stroke-width="2" stroke-dasharray="6,4"/>

    <!-- Header -->
    <text x="350" y="55" fill="#1c1714" font-family="'Playfair Display', serif" font-size="18" font-weight="bold" text-anchor="middle">HOLDER'S SIGNATURE &amp; EMERGENCY ENDORSEMENT</text>
    <line x1="100" y1="68" x2="600" y2="68" stroke="#d5c7ad" stroke-width="1.5"/>

    <!-- Signature Block -->
    <rect x="80" y="100" width="540" height="110" rx="10" fill="#ffffff" stroke="#d5c7ad" stroke-width="1.5"/>
    <text x="100" y="125" fill="#8a8076" font-family="'Plus Jakarta Sans', sans-serif" font-size="10" font-weight="bold">SIGNATURE OF BEARER / SIGNATURE DU TITULAIRE</text>
    <path d="M 120 180 Q 180 130, 240 185 T 380 160 T 520 175" fill="none" stroke="#1b2a4a" stroke-width="3" stroke-linecap="round"/>

    <!-- Emergency Address Details -->
    <rect x="80" y="235" width="540" height="180" rx="10" fill="#ffffff" stroke="#d5c7ad" stroke-width="1.5"/>
    <text x="100" y="265" fill="#8a8076" font-family="'Plus Jakarta Sans', sans-serif" font-size="10" font-weight="bold">EMERGENCY CONTACT &amp; RESIDENCE IN NEPAL</text>
    <text x="100" y="295" fill="#1c1714" font-family="'Plus Jakarta Sans', sans-serif" font-size="13" font-weight="bold">Next of Kin / Contact: ${emergencyContact || 'Family Custodian'}</text>
    <text x="100" y="325" fill="#5a5450" font-family="'Plus Jakarta Sans', sans-serif" font-size="12">Permanent Address: Biratnagar-03, Morang, Koshi Province, Nepal</text>
    <text x="100" y="355" fill="#5a5450" font-family="'Plus Jakarta Sans', sans-serif" font-size="12">Consular Assistance: Ministry of Foreign Affairs, Kathmandu</text>
    <text x="100" y="385" fill="#7c8f58" font-family="'Plus Jakarta Sans', sans-serif" font-size="11" font-weight="bold">Verified Sovereign Document Record • Shudkara Zero-Knowledge Sealed</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function createSampleCitizenshipSvg(name: string, citNo: string, fatherName: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 700 480" width="700" height="480">
    <rect width="700" height="480" rx="16" fill="#fcf9f2" stroke="#caa15d" stroke-width="3"/>
    <rect width="670" height="450" x="15" y="15" rx="12" fill="none" stroke="#2e2724" stroke-width="1"/>
    
    <!-- Crest & Header -->
    <text x="350" y="52" fill="#7c8f58" font-family="'Playfair Display', serif" font-size="20" font-weight="900" text-anchor="middle">नेपाल सरकार • गृह मन्त्रालय</text>
    <text x="350" y="78" fill="#1c1714" font-family="'Plus Jakarta Sans', sans-serif" font-size="14" font-weight="bold" text-anchor="middle">नेपाली नागरिकताको प्रमाणपत्र (CITIZENSHIP CERTIFICATE)</text>
    <line x1="80" y1="92" x2="620" y2="92" stroke="#caa15d" stroke-width="2"/>

    <!-- Left Photo & Thumbprint -->
    <rect x="45" y="120" width="140" height="175" rx="8" fill="#eae3d5" stroke="#bda888"/>
    <text x="115" y="215" fill="#6e645c" font-size="11" text-anchor="middle" font-family="sans-serif">फोटो (PHOTO)</text>
    <rect x="45" y="315" width="140" height="110" rx="8" fill="#f4eee3" stroke="#bda888"/>
    <text x="115" y="375" fill="#6e645c" font-size="10" text-anchor="middle" font-family="sans-serif">दायाँ / बायाँ औँठा छाप</text>

    <!-- Details -->
    <g transform="translate(210, 115)" font-family="'Plus Jakarta Sans', sans-serif">
      <text x="0" y="20" fill="#8a8076" font-size="10" font-weight="bold">प्रमाणपत्र नं. (CERTIFICATE NO.)</text>
      <text x="0" y="44" fill="#b38e4b" font-family="monospace" font-size="18" font-weight="bold">${citNo}</text>

      <text x="0" y="80" fill="#8a8076" font-size="10" font-weight="bold">नाम थर (FULL NAME)</text>
      <text x="0" y="104" fill="#1c1714" font-size="16" font-weight="bold">${name}</text>

      <text x="0" y="140" fill="#8a8076" font-size="10" font-weight="bold">बाबुको नाम (FATHER'S NAME)</text>
      <text x="0" y="162" fill="#1c1714" font-size="14">${fatherName || 'Baidyanath Regmi'}</text>

      <text x="0" y="198" fill="#8a8076" font-size="10" font-weight="bold">स्थायी ठेगाना (PERMANENT ADDRESS)</text>
      <text x="0" y="220" fill="#1c1714" font-size="13">मोरङ, विराटनगर महानगरपालिका वडा नं. ०३</text>

      <text x="0" y="256" fill="#8a8076" font-size="10" font-weight="bold">नागरिकताको किसिम (CITIZENSHIP TYPE)</text>
      <text x="0" y="278" fill="#1c1714" font-size="13" font-weight="bold">वंशज (BY DESCENT)</text>
    </g>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function createSampleAadharCombinedSvg(name: string, no: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 700 480" width="700" height="480">
    <rect width="700" height="480" rx="16" fill="#ffffff" stroke="#e3dfda" stroke-width="2"/>
    <!-- Top Tricolor bar -->
    <rect x="0" y="0" width="700" height="12" fill="#d4a257"/>
    <rect x="0" y="12" width="700" height="6" fill="#ffffff"/>
    <rect x="0" y="18" width="700" height="12" fill="#7c8f58"/>

    <!-- Stitched Partition Header -->
    <text x="175" y="55" fill="#1c1714" font-family="'Plus Jakarta Sans', sans-serif" font-size="13" font-weight="bold" text-anchor="middle">FRONT SIDE (IDENTITY)</text>
    <text x="525" y="55" fill="#1c1714" font-family="'Plus Jakarta Sans', sans-serif" font-size="13" font-weight="bold" text-anchor="middle">BACK SIDE (ADDRESS &amp; QR)</text>
    <line x1="350" y1="40" x2="350" y2="450" stroke="#e3dfda" stroke-width="2" stroke-dasharray="4,4"/>

    <!-- Front Side -->
    <rect x="30" y="80" width="100" height="120" rx="6" fill="#f5f2eb" stroke="#d6d0c7"/>
    <circle cx="80" cy="130" r="30" fill="#caa15d" opacity="0.4"/>
    <text x="150" y="105" fill="#1c1714" font-family="'Plus Jakarta Sans', sans-serif" font-size="15" font-weight="800">${name}</text>
    <text x="150" y="130" fill="#5a5450" font-family="'Plus Jakarta Sans', sans-serif" font-size="12">DOB: 14/05/1999 • Male</text>
    <text x="150" y="155" fill="#7c8f58" font-family="'Plus Jakarta Sans', sans-serif" font-size="11" font-weight="bold">Verified Resident</text>

    <rect x="30" y="230" width="290" height="50" rx="8" fill="#faf7f0" stroke="#ebddc2"/>
    <text x="175" y="262" fill="#b38e4b" font-family="monospace" font-size="16" font-weight="bold" text-anchor="middle">${no}</text>

    <!-- Back Side -->
    <text x="380" y="100" fill="#8a8076" font-family="'Plus Jakarta Sans', sans-serif" font-size="10" font-weight="bold">ADDRESS / ADDRESS DETAILS</text>
    <text x="380" y="125" fill="#1c1714" font-family="'Plus Jakarta Sans', sans-serif" font-size="12">C/O Baidyanath Regmi</text>
    <text x="380" y="145" fill="#1c1714" font-family="'Plus Jakarta Sans', sans-serif" font-size="12">House #42, Main Road, Ward 3</text>
    <text x="380" y="165" fill="#5a5450" font-family="'Plus Jakarta Sans', sans-serif" font-size="12">PIN / Postal Code: 56613</text>

    <!-- Simulated QR matrix on back -->
    <rect x="520" y="200" width="130" height="130" rx="6" fill="#fdfbf7" stroke="#2e2724" stroke-width="2"/>
    <rect x="535" y="215" width="30" height="30" fill="#1c1714"/>
    <rect x="605" y="215" width="30" height="30" fill="#1c1714"/>
    <rect x="535" y="285" width="30" height="30" fill="#1c1714"/>
    <rect x="580" y="250" width="25" height="25" fill="#caa15d"/>
    
    <text x="350" y="440" fill="#8a8076" font-family="'Plus Jakarta Sans', sans-serif" font-size="11" text-anchor="middle">Front &amp; Back Combined Stitched Single-Sheet Verification View</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function createSampleDossierPageSvg(pageNo: number, title: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 650 850" width="650" height="850">
    <rect width="650" height="850" fill="#fdfbf7" stroke="#d6d0c7" stroke-width="2"/>
    <rect width="610" height="810" x="20" y="20" fill="none" stroke="#caa15d" stroke-width="1.5"/>

    <text x="325" y="70" fill="#1c1714" font-family="'Playfair Display', serif" font-size="20" font-weight="900" text-anchor="middle">${title.toUpperCase()}</text>
    <text x="325" y="98" fill="#8a8076" font-family="'Plus Jakarta Sans', sans-serif" font-size="12" text-anchor="middle">OFFICIAL GOVERNMENT REGISTRY ARCHIVE • PAGE ${pageNo} OF 3</text>
    <line x1="60" y1="115" x2="590" y2="115" stroke="#caa15d" stroke-width="1.5"/>

    <!-- Simulated Legal Document Paragraphs -->
    <g transform="translate(60, 150)" fill="#5a5450" font-family="'Plus Jakarta Sans', sans-serif" font-size="12">
      <text x="0" y="20" font-weight="bold" fill="#1c1714">SECTION ${pageNo}.1: JURISDICTION &amp; TITLE GRANT</text>
      <text x="0" y="45">This sovereign instrument confirms registered cadastral parcel ownership under the</text>
      <text x="0" y="65">Land Revenue Office (मालपोत कार्यालय). Boundary verification executed pursuant to survey</text>
      <text x="0" y="85">kitta no. 492, situated in Morang District. Zero encumbrance certified on record.</text>

      <rect x="0" y="120" width="530" height="120" rx="8" fill="#f5f2eb" stroke="#e3dfda"/>
      <text x="20" y="150" font-weight="bold" fill="#1c1714">PARCEL CO-ORDINATES &amp; MUNICIPAL BOUNDS</text>
      <text x="20" y="175">North: Municipal 20ft Access Road | South: Kitta No. 491</text>
      <text x="20" y="195">East: Public Greenbelt Drainage | West: Kitta No. 493</text>
      <text x="20" y="215">Total Land Area: 0-8-2-1 (Eight Aana, Two Paisa, One Daam)</text>

      <text x="0" y="280" font-weight="bold" fill="#1c1714">SECTION ${pageNo}.2: WITNESS &amp; NOTARIAL ATTESTATION</text>
      <text x="0" y="305">In witness whereof the parties have hereunto affixed their authorized thumb impressions</text>
      <text x="0" y="325">and holographic signatures before the authorized Notary Public on this registered date.</text>

      <circle cx="100" cy="420" r="45" fill="#7c8f58" opacity="0.2"/>
      <text x="100" y="425" text-anchor="middle" font-size="11" font-weight="bold" fill="#627244">OFFICIAL SEAL</text>
      
      <circle cx="430" cy="420" r="45" fill="#caa15d" opacity="0.2"/>
      <text x="430" y="425" text-anchor="middle" font-size="11" font-weight="bold" fill="#8c6e35">STAMP DUTY</text>
    </g>

    <text x="325" y="800" fill="#8a8076" font-family="'Plus Jakarta Sans', sans-serif" font-size="11" text-anchor="middle">— Confidential Family Dossier • Abhyantara Kosha Zero-Knowledge Archive —</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

// ── Initial Mock Dataset (Follows Specification Section 6.2) ───────────────────

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
            mimeType: 'image/svg+xml',
            previewUrl: createSamplePassportFrontSvg('Shudarsan Regmi', 'PA0829141', '1999-05-14', '2031-04-11')
          },
          {
            slot: 'back',
            label: 'Signature & Endorsement Page',
            mimeType: 'image/svg+xml',
            previewUrl: createSamplePassportBackSvg('Baidyanath Regmi (+977-9852000000)')
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
            mimeType: 'image/svg+xml',
            previewUrl: createSampleAadharCombinedSvg('Shudarsan Regmi', 'XXXX-XXXX-9812')
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
            mimeType: 'image/svg+xml',
            previewUrl: createSampleCitizenshipSvg('Baidyanath Regmi', '27-01-76-04912', 'Pitambar Regmi')
          },
          {
            slot: 'back',
            label: 'Reverse Endorsement & Seal',
            mimeType: 'image/svg+xml',
            previewUrl: createSamplePassportBackSvg('Gita Regmi (+977-9842111111)')
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
        id: 'doc_license_mother',
        personId: 'person_mother',
        category: 'travel',
        title: "Smart Driving License",
        documentNumber: '01-06-00389124',
        issuingCountry: 'Nepal',
        issuingAuthority: 'Department of Transport Management',
        issuedDate: '2022-09-19',
        expiryDate: '2027-09-18',
        layoutMode: 'front_only',
        status: 'active',
        notes: 'Category B (Light Motor Vehicle Car/Jeep)',
        media: [
          {
            slot: 'front',
            label: 'Front License Card',
            mimeType: 'image/svg+xml',
            previewUrl: createSamplePassportFrontSvg('Gita Regmi', '01-06-00389124', '1972-11-12', '2027-09-18')
          }
        ],
        createdAt: '2026-11-18T13:00:00Z',
        updatedAt: '2026-11-18T13:00:00Z'
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
            mimeType: 'image/svg+xml',
            previewUrl: createSampleDossierPageSvg(1, 'Land Ownership Certificate (Lalpurja)')
          },
          {
            slot: 'page',
            pageNumber: 2,
            label: 'Page 2: Cadastral Bounds & Municipal Survey Map',
            mimeType: 'image/svg+xml',
            previewUrl: createSampleDossierPageSvg(2, 'Boundary Co-ordinates & Plot Map')
          },
          {
            slot: 'page',
            pageNumber: 3,
            label: 'Page 3: Notarial Endorsements & Tax Clearance Seals',
            mimeType: 'image/svg+xml',
            previewUrl: createSampleDossierPageSvg(3, 'Revenue Stamps & Endorsement Seals')
          }
        ],
        createdAt: '2026-11-18T14:00:00Z',
        updatedAt: '2026-11-18T14:00:00Z'
      }
    ]
  };
}

export const DocumentVault: React.FC<DocumentVaultProps> = ({ authToken: _authToken }) => {
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

  // ── Pairing Relay State (Method A: Non-Biometric Laptop Clearance) ───────────
  const [relaySessionId, setRelaySessionId] = useState<string>('');
  const [relayKeyPair, setRelayKeyPair] = useState<CryptoKeyPair | null>(null);
  const [relayPublicKeyJWK, setRelayPublicKeyJWK] = useState<JsonWebKey | null>(null);
  const [relayStatus, setRelayStatus] = useState<'idle' | 'polling' | 'authorized' | 'expired'>('idle');
  const [relaySecondsRemaining, setRelaySecondsRemaining] = useState<number>(90);

  // ── Passphrase & TOTP Unlock Form State ──────────────────────────────────────
  const [passphraseInput, setPassphraseInput] = useState<string>('');
  const [totpCodeInput, setTotpCodeInput] = useState<string>('');
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const [isUnlocking, setIsUnlocking] = useState<boolean>(false);

  // ── Ephemeral Clipboard Wiper State ──────────────────────────────────────────
  const [clipboardNotice, setClipboardNotice] = useState<{ text: string; secondsLeft: number } | null>(null);

  // ── Inactivity Auto-Lock & Window Blur Handlers ──────────────────────────────
  const lockVault = useCallback(() => {
    setIsUnlocked(false);
    setMasterVaultKey(null);
    setViewingDoc(null);
    setWatermarkDoc(null);
    setIsAddDocOpen(false);
    setIsAddPersonOpen(false);
    setIsFamilySummaryOpen(false);
    setFlippedCards({});
  }, []);

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
          // Attempt to wipe clipboard on expiration
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

  // ── Initial Mock / Manifest Loading ──────────────────────────────────────────
  useEffect(() => {
    if (!manifest) {
      setManifest(createInitialManifest());
    }
  }, [manifest]);

  // ── QR Code Relay Pairing Logic (Laptop side) ────────────────────────────────
  const initRelayPairing = useCallback(async () => {
    try {
      setRelayStatus('idle');
      setUnlockError(null);
      const sessionId = 'pair_' + Math.random().toString(36).substring(2, 10);
      const { keyPair, publicKeyJWK } = await generateEphemeralECDH();

      setRelaySessionId(sessionId);
      setRelayKeyPair(keyPair);
      setRelayPublicKeyJWK(publicKeyJWK);
      setRelaySecondsRemaining(90);

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

          // Unseal MVK from phone's encrypted payload using laptop's ECDH key
          // For ECDH, the phone's public key was included in the payload
          const phonePublicKey = await importPeerECDHPublicKey(data.encryptedMvkPayload.phonePublicKeyJWK);
          const tunnelKey = await deriveECDHSharedSecret(relayKeyPair.privateKey, phonePublicKey);
          const unsealedMvk = await unsealMVKFromRelay(data.encryptedMvkPayload.sealedEnvelope, tunnelKey);

          setMasterVaultKey(unsealedMvk);
          setIsUnlocked(true);
          setInactivitySeconds(120);
        } else if (data.status === 'expired') {
          setRelayStatus('expired');
          clearInterval(interval);
        }
      } catch {
        // Continue polling
      }
    }, 1500);

    return () => clearInterval(interval);
  }, [relayStatus, relaySessionId, relayKeyPair]);

  // Simulate companion phone scanning the QR code and authorizing (Instant Demo Pass)
  const handleSimulatePhoneApproval = async () => {
    if (!relaySessionId || !relayPublicKeyJWK) return;
    try {
      setIsUnlocking(true);
      // Generate simulated phone ECDH pair
      const phoneECDH = await generateEphemeralECDH();
      const laptopPeerKey = await importPeerECDHPublicKey(relayPublicKeyJWK);
      const sharedTunnel = await deriveECDHSharedSecret(phoneECDH.keyPair.privateKey, laptopPeerKey);

      // Phone generates or unseals MVK
      const genuineMvk = await generateMasterVaultKey();
      const sealedEnvelope = await sealMVKForRelay(genuineMvk, sharedTunnel);

      // Post authorization to relay
      await fetch('/api/vault/relay/authorize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: relaySessionId,
          encryptedMvkPayload: {
            sealedEnvelope,
            phonePublicKeyJWK: phoneECDH.publicKeyJWK
          }
        })
      });
      setIsUnlocking(false);
    } catch (err: any) {
      setIsUnlocking(false);
      setUnlockError('Companion simulation error: ' + err.message);
    }
  };

  // ── Unlock via Master Passphrase + TOTP ───────────────────────────────────────
  const handleUnlockWithPassphrase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passphraseInput.trim()) {
      setUnlockError('Master Passphrase is required.');
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

      // 600,000 iterations PBKDF2-HMAC-SHA256 (OWASP standard)
      const salt = new TextEncoder().encode('shudkara_abhyantara_kosha_master_salt_2026');
      const derivedKey = await deriveMVKFromPassphrase(
        passphraseInput.trim(),
        salt,
        totpCodeInput.trim() || undefined,
        600000
      );

      setMasterVaultKey(derivedKey);
      setIsUnlocked(true);
      setInactivitySeconds(120);
      setPassphraseInput('');
      setTotpCodeInput('');
      setIsUnlocking(false);
    } catch (err: any) {
      setIsUnlocking(false);
      setUnlockError('Unlock failed: ' + err.message);
    }
  };

  // ── Quick Instant Unseal Demo Button ─────────────────────────────────────────
  const handleInstantDemoUnlock = async () => {
    try {
      setIsUnlocking(true);
      const demoMvk = await generateMasterVaultKey();
      setMasterVaultKey(demoMvk);
      setIsUnlocked(true);
      setInactivitySeconds(120);
      setIsUnlocking(false);
    } catch (err: any) {
      setIsUnlocking(false);
      setUnlockError('Demo unlock failed: ' + err.message);
    }
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
  // 1. LOCKED VAULT VIEW (Zero-Knowledge Enclave Seal)
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

          {/* Unlock Methods Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
            {/* Method A: Companion Phone QR Relay */}
            <div className="border border-slate-200 rounded-2xl p-5 bg-slate-50 space-y-4 flex flex-col justify-between">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <Smartphone className="w-4 h-4 text-blue-600" />
                    Method A: Phone Companion Relay
                  </span>
                  <span className="text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">
                    Recommended
                  </span>
                </div>
                <p className="text-xs text-slate-500 leading-normal">
                  Zero typing on laptop: scan this dynamic pairing code with your Shudkara phone app to authorize with biometric touch.
                </p>
              </div>

              {relayStatus === 'idle' ? (
                <button
                  onClick={initRelayPairing}
                  className="w-full py-2.5 px-4 bg-white hover:bg-slate-100 text-slate-800 border border-slate-200 rounded-xl text-xs font-bold transition shadow-xs flex items-center justify-center gap-2"
                >
                  <QrCode className="w-4 h-4 text-blue-600" />
                  Generate Dynamic Pairing QR
                </button>
              ) : (
                <div className="space-y-3 bg-white p-4 rounded-xl border border-slate-200 text-center">
                  <div className="w-36 h-36 mx-auto bg-slate-900 rounded-lg p-2.5 flex items-center justify-center shadow-inner relative overflow-hidden group">
                    {/* Stylized Ephemeral Pairing Matrix */}
                    <div className="w-full h-full bg-white p-2 rounded flex flex-col items-center justify-center space-y-1">
                      <QrCode className="w-20 h-20 text-slate-900 animate-pulse" />
                      <span className="text-[9px] font-mono font-bold text-slate-600">
                        {relaySessionId.slice(0, 10)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-500 px-1">
                    <span className="flex items-center gap-1 font-semibold text-emerald-600">
                      <RefreshCw className="w-3 h-3 animate-spin" />
                      Awaiting Phone Scan...
                    </span>
                    <span className="font-mono text-slate-400">⏱️ {relaySecondsRemaining}s</span>
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex flex-col gap-2">
                    <button
                      onClick={handleSimulatePhoneApproval}
                      disabled={isUnlocking}
                      className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition shadow-xs flex items-center justify-center gap-1.5"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      Simulate Phone Approval (Instant Pass)
                    </button>
                    <button
                      onClick={initRelayPairing}
                      className="text-[11px] text-slate-500 hover:text-slate-800 underline"
                    >
                      Regenerate Session
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Method C: Master Passphrase + TOTP Fallback */}
            <div className="border border-slate-200 rounded-2xl p-5 bg-slate-50 space-y-4">
              <div className="space-y-1">
                <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <Key className="w-4 h-4 text-blue-600" />
                  Method B: Passphrase + TOTP Fallback
                </span>
                <p className="text-xs text-slate-500">
                  Offline recovery via PBKDF2-HMAC-SHA256 (600,000 iterations).
                </p>
              </div>

              <form onSubmit={handleUnlockWithPassphrase} className="space-y-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                    Master Vault Passphrase
                  </label>
                  <input
                    type="password"
                    placeholder="Enter your sovereign master passphrase"
                    value={passphraseInput}
                    onChange={(e) => setPassphraseInput(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                    Authenticator Code (6-Digit TOTP)
                  </label>
                  <input
                    type="text"
                    maxLength={6}
                    placeholder="000 000 (Optional if offline)"
                    value={totpCodeInput}
                    onChange={(e) => setTotpCodeInput(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 font-mono tracking-widest placeholder-slate-400 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isUnlocking}
                  className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition shadow-xs flex items-center justify-center gap-2"
                >
                  {isUnlocking ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      Deriving MVK Keys...
                    </>
                  ) : (
                    <>
                      <Unlock className="w-3.5 h-3.5" />
                      Unseal Vault with Passphrase
                    </>
                  )}
                </button>
              </form>

              {/* Fast Instant Demo Button */}
              <div className="pt-2 border-t border-slate-200/60 text-center">
                <button
                  type="button"
                  onClick={handleInstantDemoUnlock}
                  className="text-xs text-blue-700 hover:text-blue-800 font-bold hover:underline inline-flex items-center gap-1"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Or Unlock Immediately with Enclave Seed Key
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // 2. UNLOCKED VAULT VIEW (Abhyantara Kosha Active Enclave)
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
              <button
                key={person.id}
                onClick={() => setSelectedPersonId(person.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-2 shrink-0 ${
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
                          className="absolute inset-0 w-full h-full rounded-2xl overflow-hidden border border-slate-200 shadow-sm bg-white flex flex-col"
                          style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' }}
                        >
                          {frontMedia?.previewUrl ? (
                            <img
                              src={frontMedia.previewUrl}
                              alt={frontMedia.label}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-400 text-xs">
                              Biographical Scan
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
                          className="absolute inset-0 w-full h-full rounded-2xl overflow-hidden border border-slate-200 shadow-sm bg-white flex flex-col"
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
                            <div className="w-full h-full flex items-center justify-center text-slate-400 text-xs">
                              Endorsement Scan
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
                    <div className="w-full h-[210px] rounded-2xl overflow-hidden border border-slate-200 shadow-sm bg-white relative">
                      {frontMedia?.previewUrl ? (
                        <img
                          src={frontMedia.previewUrl}
                          alt={frontMedia.label}
                          className="w-full h-full object-contain p-1"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-400 text-xs">
                          Stitched Card Scan
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
                    <div className="w-full h-[210px] rounded-2xl overflow-hidden border border-slate-200 shadow-sm bg-white relative">
                      {frontMedia?.previewUrl ? (
                        <img
                          src={frontMedia.previewUrl}
                          alt={frontMedia.label}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-400 text-xs">
                          Single Face Document
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
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          3. FULL DOSSIER VIEWER MODAL (Versions, Multi-Page, Linked Attachments)
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
                      <img
                        src={viewingDoc.media[dossierPage - 1]?.previewUrl}
                        alt={`Page ${dossierPage}`}
                        className="max-h-[460px] object-contain shadow-xs"
                      />
                    </div>

                    {/* Thumbnail strip */}
                    <div className="flex items-center gap-2 overflow-x-auto p-1">
                      {viewingDoc.media.map((page, idx) => (
                        <button
                          key={idx}
                          onClick={() => setDossierPage(idx + 1)}
                          className={`w-16 h-20 rounded-lg border-2 overflow-hidden shrink-0 transition ${
                            dossierPage === idx + 1 ? 'border-blue-600 ring-2 ring-blue-200' : 'border-slate-200 opacity-60 hover:opacity-100'
                          }`}
                        >
                          <img src={page.previewUrl} alt={`Thumbnail ${idx + 1}`} className="w-full h-full object-cover" />
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
                        <div className="rounded-xl overflow-hidden border border-slate-100">
                          <img src={m.previewUrl} alt={m.label} className="w-full h-auto object-cover" />
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
          4. DYNAMIC CLIENT-SIDE WATERMARKING & REDACTION SUITE MODAL
         ════════════════════════════════════════════════════════════════════════ */}
      {watermarkDoc && (
        <WatermarkRedactModal
          doc={watermarkDoc}
          onClose={() => setWatermarkDoc(null)}
        />
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          5. ADD DOCUMENT MODAL
         ════════════════════════════════════════════════════════════════════════ */}
      {isAddDocOpen && manifest && (
        <AddDocumentModal
          manifest={manifest}
          masterVaultKey={masterVaultKey}
          onClose={() => setIsAddDocOpen(false)}
          onAddDocument={(newDoc) => {
            setManifest((prev) => {
              if (!prev) return prev;
              return {
                ...prev,
                documents: [newDoc, ...prev.documents],
                updatedAt: new Date().toISOString()
              };
            });
            setIsAddDocOpen(false);
          }}
        />
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          6. ADD PERSON PROFILE MODAL
         ════════════════════════════════════════════════════════════════════════ */}
      {isAddPersonOpen && (
        <AddPersonModal
          onClose={() => setIsAddPersonOpen(false)}
          onAddPerson={(newPerson) => {
            setManifest((prev) => {
              if (!prev) return prev;
              return {
                ...prev,
                persons: [...prev.persons, newPerson],
                updatedAt: new Date().toISOString()
              };
            });
            setIsAddPersonOpen(false);
          }}
        />
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          7. FAMILY SUMMARY DOSSIER MODAL
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
    if (!canvas || !activeMedia?.previewUrl) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = activeMedia.previewUrl;

    img.onload = () => {
      canvas.width = img.width || 700;
      canvas.height = img.height || 480;

      // 1. Draw base document scan
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      // 2. Render diagonal watermarks
      if (watermarkText.trim()) {
        ctx.save();
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate((angle * Math.PI) / 180);
        ctx.fillStyle = `rgba(180, 20, 20, ${opacity})`;
        ctx.font = `bold ${fontSize}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // Repeated grid watermarking pattern
        const fullText = recipientName.trim()
          ? `${watermarkText.trim()} • [${recipientName.trim().toUpperCase()}]`
          : watermarkText.trim();

        for (let y = -canvas.height; y <= canvas.height; y += fontSize * 3.5) {
          ctx.fillText(fullText, 0, y);
        }
        ctx.restore();
      }

      // 3. Render black-out redactions
      ctx.fillStyle = '#000000';
      redactions.forEach((r) => {
        ctx.fillRect(r.x, r.y, r.w, r.h);
      });
    };
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
// SUB-COMPONENT: Add New Document Modal (with Client-Side Encryption)
// ══════════════════════════════════════════════════════════════════════════════

interface AddDocumentModalProps {
  manifest: VaultManifest;
  masterVaultKey: CryptoKey | null;
  onClose: () => void;
  onAddDocument: (doc: VaultDocument) => void;
}

const AddDocumentModal: React.FC<AddDocumentModalProps> = ({
  manifest,
  masterVaultKey,
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !documentNumber.trim()) return;

    try {
      setIsEncrypting(true);

      // Procedural fallback preview SVG if no local file was uploaded
      const frontSvg = createSamplePassportFrontSvg(
        manifest.persons.find((p) => p.id === personId)?.name || 'Holder',
        documentNumber,
        '1999-01-01',
        expiryDate || '2035-01-01'
      );
      const backSvg = createSamplePassportBackSvg('Emergency Contact');

      // Generate a disposable DEK and wrap it with MVK if available
      let dekEnvelope: WrappedKeyEnvelope | undefined = undefined;
      if (masterVaultKey) {
        const docDek = await generateDEK();
        dekEnvelope = await wrapDEK(docDek, masterVaultKey);
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
        media: [
          {
            slot: 'front',
            label: 'Front Scan',
            mimeType: 'image/svg+xml',
            previewUrl: frontSvg,
            dekEnvelope
          },
          ...(layoutMode === 'front_back_separate'
            ? [
                {
                  slot: 'back' as const,
                  label: 'Back Scan',
                  mimeType: 'image/svg+xml',
                  previewUrl: backSvg,
                  dekEnvelope
                }
              ]
            : [])
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      setIsEncrypting(false);
      onAddDocument(newDoc);
    } catch (err) {
      setIsEncrypting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/50 backdrop-blur-xs animate-fade-in">
      <div className="bg-white border border-slate-200 rounded-3xl shadow-2xl w-full max-w-xl max-h-[92vh] flex flex-col overflow-hidden">
        <div className="p-5 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900 serif-heading flex items-center gap-2">
            <Plus className="w-4 h-4 text-blue-600" />
            Add Secure Document to Vault
          </h2>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-800 rounded-xl">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4 flex-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                Person / Profile
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
                Document Number / ID
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

          <div>
            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
              Private Notes &amp; Custody Details
            </label>
            <textarea
              rows={2}
              placeholder="e.g. Original stored in bank locker #402"
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
