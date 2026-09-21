import { defineConfig } from 'sanity';
import { structureTool } from 'sanity/structure';
import { schemaTypes } from './schemaTypes';
import { seedTool } from './SeedTool';

export function createStudioConfig(projectId: string, dataset: string) {
  return defineConfig({
    name: 'fliproom', title: 'Fliproom room library', projectId, dataset, basePath: '/studio',
    plugins: [structureTool()],
    tools: projectId === 'i5bjg9lg' && dataset === 'production' ? [seedTool] : [],
    schema: { types: schemaTypes },
  });
}
