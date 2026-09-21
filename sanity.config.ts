import { currentSanityEnvironment, readSanitySettings } from './src/sanity/environment';
import { createStudioConfig } from './src/sanity/studioConfig';

const settings = readSanitySettings(currentSanityEnvironment());
// No invented project ID. The embedded Studio explains setup when unconfigured.
export default settings.status === 'configured'
  ? createStudioConfig(settings.projectId, settings.dataset)
  : [];
