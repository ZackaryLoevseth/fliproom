import {getCatalog} from '@/sanity/catalog';
import {Fliproom} from '@/components/Fliproom';

export const dynamic = 'force-dynamic';

export default async function Home() {
  try {
    const result = await getCatalog();
    if (!result.catalog || result.error) {
      return <main className="setup-message"><a href="/">↗ Fliproom</a><h1>The room data needs attention.</h1><p>Sanity is configured, but its published catalog could not be loaded. No demonstration data has been substituted.</p><p>Check the project settings, dataset access and published documents, then reload.</p><a className="primary" href="/">Try again</a></main>;
    }
    return <Fliproom key={JSON.stringify(result.catalog)} catalog={result.catalog} source={result.source} />;
  } catch {
    return <main className="setup-message"><a href="/">↗ Fliproom</a><h1>The room data needs attention.</h1><p>The configured catalog could not be loaded. Check Sanity settings and published content.</p><a className="primary" href="/">Try again</a></main>;
  }
}
