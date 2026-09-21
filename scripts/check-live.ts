import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {createClient} from '@sanity/client';
import {demoCatalog} from '../src/lib/fixtures';
import {CATALOG_QUERY} from '../src/sanity/queries';
import {assertCatalog} from '../src/sanity/validate';
import {buildPlan} from '../src/lib/planner';

async function main() {
  const projectId = process.argv[2];
  const dataset = process.argv[3];
  if (!projectId || !dataset) throw new Error('Usage: tsx scripts/check-live.ts PROJECT_ID DATASET');
  const client = createClient({projectId,dataset,apiVersion:'2026-09-20',useCdn:false,perspective:'published',timeout:10000,maxRetries:1});
  const catalog: unknown = await client.fetch(CATALOG_QUERY,{roomKey:demoCatalog.room.id});
  assertCatalog(catalog);
  assert.deepEqual(catalog,demoCatalog,'Live published catalog must equal the reviewed fictional seed');
  let transitions = 0;
  for (const from of catalog.scenes) for (const to of catalog.scenes) {
    assert.equal(buildPlan(catalog,from.id,to.id).blockers.length,0);
    transitions++;
  }
  const count = await client.fetch<number>('count(*[!(_id in path("drafts.**")) && !(_id in path("_.**"))])');
  const seed = await readFile(new URL('../seed.ndjson',import.meta.url));
  const expected = seed.toString('utf8').trim().split('\n').map(line => JSON.parse(line));
  const documents = await client.fetch<Record<string, unknown>[]>('*');
  const normalized = documents.map(({_createdAt,_updatedAt,_rev,...content}) => content);
  const byId = (a: Record<string, unknown>, b: Record<string, unknown>) => String(a._id).localeCompare(String(b._id));
  assert.equal(count, 12, 'Expected exactly twelve publicly readable documents');
  assert.deepEqual(normalized.sort(byId),expected.sort(byId),'Every publicly readable document must match the reviewed seed');
  console.log(JSON.stringify({checkedAt:new Date().toISOString(),projectId,dataset,publishedDocuments:count,publicDocumentsMatchReviewedSeed:true,catalogMatchesReviewedSeed:true,validTransitions:transitions,seedSha256:createHash('sha256').update(seed).digest('hex'),authentication:'unauthenticated public read'},null,2));
}

main().catch(error => {console.error(error instanceof Error ? error.message : 'Live verification failed');process.exitCode = 1;});
