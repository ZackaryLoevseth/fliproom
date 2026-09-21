import { defineCliConfig } from 'sanity/cli';
import { currentSanityEnvironment, readSanitySettings } from './src/sanity/environment';

const settings = readSanitySettings(currentSanityEnvironment());
export default defineCliConfig({
  ...(settings.status === 'configured'
    ? { api: { projectId: settings.projectId, dataset: settings.dataset } }
    : {}),
});
