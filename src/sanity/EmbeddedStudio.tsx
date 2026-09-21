'use client';

import { useMemo } from 'react';
import { Studio } from 'sanity';
import { createStudioConfig } from './studioConfig';

export default function EmbeddedStudio({ projectId, dataset }: { projectId: string; dataset: string }) {
  const config = useMemo(() => createStudioConfig(projectId, dataset), [projectId, dataset]);
  return (
    <div style={{ height: '100vh', maxHeight: '100dvh', width: '100%', overflow: 'auto', overscrollBehavior: 'none' }}>
      <Studio config={config} />
    </div>
  );
}
