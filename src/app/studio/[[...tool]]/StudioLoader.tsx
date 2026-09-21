'use client';

import dynamic from 'next/dynamic';

const EmbeddedStudio = dynamic(() => import('../../../sanity/EmbeddedStudio'), {
  ssr: false,
  loading: () => <p style={{ padding: '2rem' }}>Loading Sanity Studio…</p>,
});

export default function StudioLoader(props: { projectId: string; dataset: string }) {
  return <EmbeddedStudio {...props} />;
}
