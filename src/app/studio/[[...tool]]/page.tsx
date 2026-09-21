import Link from 'next/link';
import { currentSanityEnvironment, readSanitySettings } from '../../../sanity/environment';
import StudioLoader from './StudioLoader';

export const dynamic = 'force-dynamic';

export default function StudioPage() {
  const settings = readSanitySettings(currentSanityEnvironment());
  if (settings.status === 'configured') {
    return <StudioLoader projectId={settings.projectId} dataset={settings.dataset} />;
  }
  return (
    <main style={{ maxWidth: 720, margin: '8vh auto', padding: '2rem', fontFamily: 'system-ui, sans-serif', lineHeight: 1.6 }}>
      <p style={{ letterSpacing: '.12em', textTransform: 'uppercase', fontSize: '.8rem' }}>Fliproom · Content studio</p>
      <h1>Sanity is not connected yet.</h1>
      <p>{settings.status === 'unconfigured'
        ? 'No Sanity connection is configured. The planner uses a clearly labeled local demo room.'
        : 'The Sanity configuration is incomplete or invalid. The planner shows an error until it is corrected.'}</p>
      {settings.status === 'invalid' && <p role="alert">{settings.error}</p>}
      <p>After project setup is approved, set the real project ID and public dataset in <code>.env.local</code>, then restart the app. Studio editors sign in through Sanity.</p>
      <p>The prepared schema includes rooms, equipment, referenced layouts, and optional changeover records. Checklist progress in the public planner stays in this browser.</p>
      <Link href="/">← Back to the room planner</Link>
    </main>
  );
}
