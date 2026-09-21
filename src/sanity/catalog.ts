import { createClient } from '@sanity/client';
import { demoCatalog } from '../lib/fixtures';
import { currentSanityEnvironment, readSanitySettings, type SanityEnvironment } from './environment';
import { CATALOG_QUERY } from './queries';
import { assertCatalog, type Catalog } from './validate';

export type CatalogResult =
  | { catalog: Catalog; source: 'demo' | 'sanity'; error?: never }
  | { catalog: null; source: 'sanity'; error: string };

type FetchCatalog = (query: string, params: { roomKey: string }) => Promise<unknown>;

/** Server-side, published-content reads only; no token or mutation API. */
export async function getCatalog(
  env: SanityEnvironment = currentSanityEnvironment(),
  fetchOverride?: FetchCatalog,
): Promise<CatalogResult> {
  const settings = readSanitySettings(env);
  if (settings.status === 'unconfigured') return { catalog: demoCatalog, source: 'demo' };
  if (settings.status === 'invalid') return { catalog: null, source: 'sanity', error: settings.error };
  try {
    const fetchCatalog: FetchCatalog = fetchOverride ?? ((query, params) =>
      createClient({
        projectId: settings.projectId,
        dataset: settings.dataset,
        apiVersion: '2026-09-20',
        useCdn: true,
        perspective: 'published',
        timeout: 10_000,
        maxRetries: 1,
      }).fetch(query, params, { next: { revalidate: 60 } }));
    const catalog = await fetchCatalog(CATALOG_QUERY, { roomKey: settings.roomKey ?? demoCatalog.room.id });
    assertCatalog(catalog);
    return { catalog, source: 'sanity' };
  } catch (error) {
    // Do not expose SDK response bodies, project content, or credentials in the UI.
    const detail = error instanceof Error && /^(The requested room|The room needs|Equipment contains|A layout)/.test(error.message)
      ? error.message
      : 'The configured Sanity dataset could not be read. Check that the project and public dataset exist and contain published seed documents.';
    return { catalog: null, source: 'sanity', error: detail };
  }
}
