import { useEffect, useMemo, useRef, useState } from 'react';
import { useClient, type Tool } from 'sanity';
import type { SanityClient } from '@sanity/client';
import { demoCatalog } from '../lib/fixtures';
import { catalogToDocuments, catalogToNdjson, type SeedDocument } from './seed';

// Exactly the fictional seed.ndjson reviewed and approved for this project.
export const APPROVED_SEED_SHA256 = '2ae6026eec88dc813efbe6967fed5aca7961d63c7378ffa2e46611f37c0caf07';
const APPROVED_PROJECT = 'i5bjg9lg';
const APPROVED_DATASET = 'production';
const DOCUMENTS = catalogToDocuments(demoCatalog);
const NDJSON = catalogToNdjson(demoCatalog);

type SeedClient = Pick<SanityClient, 'config' | 'getDocuments' | 'transaction'>;
export type SeedRow = { id: string; name: string; state: 'missing' | 'matching' | 'different' };
type Inspection = { rows: SeedRow[]; missing: number; matching: number; different: number };
type ImportResult = { inspection: Inspection; submitted: number; transactionId?: string };

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${stable(item)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export function sameSeedContent(expected: SeedDocument, actual: Record<string, unknown>): boolean {
  const { _createdAt, _updatedAt, _rev, ...content } = actual;
  return stable(expected) === stable(content);
}

export async function verifyApprovedSeed(): Promise<void> {
  const hash = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(NDJSON));
  const hex = Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, '0')).join('');
  if (hex !== APPROVED_SEED_SHA256 || DOCUMENTS.length !== 12) {
    throw new Error('The local seed differs from the approved 12-document payload. Import is disabled.');
  }
}

function verifyTarget(client: SeedClient): void {
  const config = client.config();
  if (config.projectId !== APPROVED_PROJECT || config.dataset !== APPROVED_DATASET) {
    throw new Error('This importer is approved only for project i5bjg9lg, dataset production.');
  }
}

export async function inspectSeedDocuments(client: SeedClient): Promise<Inspection> {
  verifyTarget(client);
  await verifyApprovedSeed();
  const current = await client.getDocuments(DOCUMENTS.map((doc) => doc._id));
  const byId = new Map(current.filter((doc) => doc !== null).map((doc) => [doc._id, doc]));
  const rows: SeedRow[] = DOCUMENTS.map((doc) => {
    const existing = byId.get(doc._id);
    return {
      id: doc._id,
      name: String(doc.name ?? doc.label ?? doc._id),
      state: !existing ? 'missing' : sameSeedContent(doc, existing) ? 'matching' : 'different',
    };
  });
  return {
    rows,
    missing: rows.filter((row) => row.state === 'missing').length,
    matching: rows.filter((row) => row.state === 'matching').length,
    different: rows.filter((row) => row.state === 'different').length,
  };
}

/** Called only by the Studio button, using its signed-in editor's client. */
export async function importSeedDocuments(client: SeedClient): Promise<ImportResult> {
  const before = await inspectSeedDocuments(client);
  if (before.different) {
    throw new Error(`${before.different} existing document(s) differ from the approved seed. Nothing was submitted; existing content is preserved.`);
  }
  const missingIds = new Set(before.rows.filter((row) => row.state === 'missing').map((row) => row.id));
  if (!missingIds.size) return { inspection: before, submitted: 0 };
  let transaction = client.transaction();
  for (const doc of DOCUMENTS) {
    if (missingIds.has(doc._id)) transaction = transaction.createIfNotExists(doc);
  }
  // Atomic and idempotent: if another editor creates an ID meanwhile, never replace it.
  const receipt = await transaction.commit({ visibility: 'sync', returnDocuments: false });
  const inspection = await inspectSeedDocuments(client);
  return { inspection, submitted: missingIds.size, transactionId: receipt.transactionId };
}

export default function SeedTool() {
  const studioClient = useClient({ apiVersion: '2026-09-20' });
  const client = useMemo(() => studioClient.withConfig({ useCdn: false, perspective: 'raw' }), [studioClient]);
  const busyRef = useRef(false);
  const [busy, setBusy] = useState(false);
  const [verified, setVerified] = useState(false);
  const [inspection, setInspection] = useState<Inspection | null>(null);
  const [message, setMessage] = useState('Checking the approved local payload…');
  const [receipt, setReceipt] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    verifyApprovedSeed().then(() => {
      verifyTarget(client);
      if (active) {
        setVerified(true);
        setMessage('Approved content with corrected public document IDs verified. No import has been attempted in this view.');
      }
    }).catch((error: unknown) => {
      if (active) setMessage(error instanceof Error ? error.message : 'The approved payload could not be verified.');
    });
    return () => { active = false; };
  }, [client]);

  async function run(importNow: boolean) {
    if (busyRef.current || !verified) return;
    busyRef.current = true;
    setBusy(true);
    setMessage(importNow ? 'Checking existing documents, then importing only missing IDs…' : 'Reading the current dataset…');
    try {
      const result = importNow
        ? await importSeedDocuments(client)
        : { inspection: await inspectSeedDocuments(client), submitted: 0 };
      setInspection(result.inspection);
      if ('transactionId' in result && result.transactionId) setReceipt(result.transactionId);
      const { matching, different, missing } = result.inspection;
      setMessage(`${matching} of 12 public-ID documents match the approved seed; ${missing} missing; ${different} present with different content. ${result.submitted ? `Submitted create-if-missing for ${result.submitted} IDs and re-read those documents.` : 'No new mutations submitted.'} Legacy dotted-ID copies are preserved and excluded from these counts; an unauthenticated read must verify public availability.`);
    } catch (error) {
      setInspection(null);
      setMessage(`${error instanceof Error ? error.message : 'The request failed.'} Import completion is not confirmed. Check the current dataset before retrying.`);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  return (
    <section style={{ maxWidth: 920, margin: '0 auto', padding: '2rem', overflow: 'auto', height: '100%', boxSizing: 'border-box', lineHeight: 1.5 }}>
      <h1>Import the fictional room with public IDs</h1>
      <p>Approved destination: <strong>i5bjg9lg / production (public)</strong>. This tool uses the signed-in Studio editor to reimport the same 12 fictional documents with corrected IDs and references. Their room content is unchanged.</p>
      <p>The original 12 dotted-ID copies remain private and are preserved. This import creates up to 12 additional public-ID copies, so Studio may contain 24 documents while unauthenticated readers see 12. Existing content is never overwritten; no changeover records are created.</p>
      <p style={{ overflowWrap: 'anywhere', fontSize: '.8rem' }}>Approved seed SHA-256: <code>{APPROVED_SEED_SHA256}</code></p>
      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', margin: '1rem 0' }}>
        <button type="button" disabled={busy || !verified} onClick={() => void run(false)} style={{ padding: '.75rem 1rem' }}>Check current dataset</button>
        <button type="button" disabled={busy || !verified || inspection?.matching === 12 || !!inspection?.different} onClick={() => void run(true)} style={{ padding: '.75rem 1rem' }}>Import fictional room with public IDs</button>
      </div>
      <p role="status" aria-live="polite">{message}</p>
      {receipt && <p style={{ overflowWrap: 'anywhere' }}>Last acknowledged transaction: <code>{receipt}</code></p>}
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.9rem' }}>
        <thead><tr><th style={{ textAlign: 'left' }}>Document</th><th style={{ textAlign: 'left' }}>Type / ID</th><th style={{ textAlign: 'left' }}>Last check</th></tr></thead>
        <tbody>{DOCUMENTS.map((doc) => (
          <tr key={doc._id}>
            <td style={{ padding: '.65rem 0', borderTop: '1px solid #8885' }}>{String(doc.name ?? doc.label ?? doc._id)}</td>
            <td style={{ padding: '.65rem 0', borderTop: '1px solid #8885' }}>{doc._type}<br /><code style={{ fontSize: '.75rem' }}>{doc._id}</code></td>
            <td style={{ padding: '.65rem 0', borderTop: '1px solid #8885' }}>{inspection?.rows.find((row) => row.id === doc._id)?.state ?? 'not checked'}</td>
          </tr>
        ))}</tbody>
      </table>
    </section>
  );
}

export const seedTool: Tool = { name: 'seed', title: 'Import fictional room', component: SeedTool };
