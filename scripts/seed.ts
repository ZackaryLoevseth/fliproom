import { demoCatalog } from '../src/lib/fixtures';
import { catalogToNdjson } from '../src/sanity/seed';

if (process.argv.length > 2) {
  process.stderr.write('This command only prints seed NDJSON. It does not accept import or upload arguments.\n');
  process.exitCode = 1;
} else {
  process.stdout.write(catalogToNdjson(demoCatalog));
}
