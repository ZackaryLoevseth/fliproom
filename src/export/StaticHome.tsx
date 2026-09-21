'use client';

import {useEffect, useState} from 'react';
import {createClient} from '@sanity/client';
import {Fliproom} from '../components/Fliproom';
import {getCatalog} from '../sanity/catalog';
import type {Catalog} from '../lib/types';

type StaticHomeProps = {
  projectId: string;
  dataset: string;
  roomKey: string;
  basePath: string;
};

type LoadState = {status: 'loading'} | {status: 'error'} | {status: 'ready'; catalog: Catalog};

/** Public, published-content reads only. Studio authentication stays in the local app. */
export default function StaticHome({projectId, dataset, roomKey, basePath}: StaticHomeProps) {
  const [state, setState] = useState<LoadState>({status: 'loading'});
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setState({status: 'loading'});

    async function load() {
      try {
        const client = createClient({
          projectId,
          dataset,
          apiVersion: '2026-09-20',
          perspective: 'published',
          useCdn: true,
          withCredentials: false,
          timeout: 10_000,
          maxRetries: 1,
        });
        const result = await getCatalog({
          NEXT_PUBLIC_SANITY_PROJECT_ID: projectId,
          NEXT_PUBLIC_SANITY_DATASET: dataset,
          SANITY_ROOM_KEY: roomKey,
        }, (query, params) => client.fetch(query, params, {signal: controller.signal}));
        if (!active) return;
        setState(result.source === 'sanity' && result.catalog && !result.error
          ? {status: 'ready', catalog: result.catalog}
          : {status: 'error'});
      } catch {
        if (active) setState({status: 'error'});
      }
    }

    void load();
    return () => { active = false; controller.abort(); };
  }, [projectId, dataset, roomKey, attempt]);

  if (state.status === 'ready') {
    return <Fliproom key={JSON.stringify(state.catalog)} catalog={state.catalog} source="sanity" publicMode basePath={basePath} />;
  }

  return <main className="setup-message">
    <a href={`${basePath}/`}>↗ Fliproom</a>
    {state.status === 'loading' ? <>
      <h1>Loading the room…</h1>
      <p role="status">Reading the published layouts from Sanity.</p>
    </> : <>
      <h1>The room data needs attention.</h1>
      <p role="alert">The published room could not be loaded. No demonstration data has been substituted.</p>
      <p>Check the connection, allowed website origin, dataset access and published room documents, then try again.</p>
      <button className="primary" type="button" onClick={() => setAttempt((value) => value + 1)}>Try again</button>
    </>}
  </main>;
}
