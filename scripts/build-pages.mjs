#!/usr/bin/env node

import {copyFile, lstat, mkdir, mkdtemp, readFile, symlink, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const usage = 'Usage: NEXT_PUBLIC_SANITY_PROJECT_ID=<approved-id> NEXT_PUBLIC_SANITY_DATASET=<public-dataset> [SANITY_ROOM_KEY=studio] node scripts/build-pages.mjs [--base-path /fliproom]';

async function main() {
  if (args.length === 1 && args[0] === '--help') { console.log(usage); return; }
  if (args.length && (args.length !== 2 || args[0] !== '--base-path')) throw new Error(usage);
  const basePath = args[1] ?? '/fliproom';
  if (!/^\/[A-Za-z0-9_-]+$/.test(basePath)) throw new Error('The base path must be one repository path, such as /fliproom.');

  // Only explicit public settings enter the export. Do not copy or auto-load .env files.
  const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID?.trim();
  const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET?.trim();
  const roomKey = process.env.SANITY_ROOM_KEY?.trim() || 'studio';
  if (!projectId || !dataset) throw new Error(`An approved Sanity project ID and public dataset must be supplied explicitly. ${usage}`);
  if (!/^[a-z0-9]+$/.test(projectId) || !/^[a-z0-9][a-z0-9_-]*$/.test(dataset)) {
    throw new Error('The Sanity project ID or dataset has an invalid format.');
  }
  if (!/^[A-Za-z0-9_-]+$/.test(roomKey)) throw new Error('The room key must contain only letters, numbers, underscores or hyphens.');

  const sources = [
    'src/app/layout.tsx',
    'src/app/globals.css',
    'src/components/Fliproom.tsx',
    'src/export/StaticHome.tsx',
    'src/lib/types.ts',
    'src/lib/planner.ts',
    'src/lib/progress.ts',
    'src/lib/fixtures.ts',
    'src/sanity/catalog.ts',
    'src/sanity/environment.ts',
    'src/sanity/queries.ts',
    'src/sanity/validate.ts',
  ];
  for (const source of sources) {
    if (!(await lstat(join(projectRoot, source))).isFile()) throw new Error(`Expected a regular source file: ${source}`);
  }
  const installedNext = join(projectRoot, 'node_modules/next/dist/bin/next');
  await lstat(installedNext);

  const staging = await mkdtemp(join(tmpdir(), 'fliproom-pages-'));
  for (const source of sources) {
    const destination = join(staging, source);
    await mkdir(dirname(destination), {recursive: true});
    await copyFile(join(projectRoot, source), destination);
  }
  await symlink(join(projectRoot, 'node_modules'), join(staging, 'node_modules'), 'dir');

  const originalPackage = JSON.parse(await readFile(join(projectRoot, 'package.json'), 'utf8'));
  const dependencies = Object.fromEntries(['@sanity/client', 'next', 'react', 'react-dom'].map((name) => [name, originalPackage.dependencies[name]]));
  await writeFile(join(staging, 'package.json'), JSON.stringify({name: 'fliproom-pages-local-build', version: '0.1.0', private: true, dependencies}, null, 2));
  await writeFile(join(staging, 'tsconfig.json'), JSON.stringify({
    compilerOptions: {
      target: 'ES2022', lib: ['dom', 'dom.iterable', 'esnext'], strict: true,
      noEmit: true, skipLibCheck: true, esModuleInterop: true, module: 'esnext',
      moduleResolution: 'bundler', resolveJsonModule: true, isolatedModules: true,
      jsx: 'react-jsx', incremental: true, plugins: [{name: 'next'}], paths: {'@/*': ['./src/*']},
    },
    include: ['next-env.d.ts', 'src/**/*.ts', 'src/**/*.tsx', '.next/types/**/*.ts'], exclude: ['node_modules'],
  }, null, 2));
  await writeFile(join(staging, 'next.config.mjs'), `export default ${JSON.stringify({
    output: 'export', trailingSlash: true, basePath, poweredByHeader: false,
  }, null, 2)};\n`);
  await writeFile(join(staging, 'src/app/page.tsx'), [
    "import StaticHome from '../export/StaticHome';",
    `const publicSettings = ${JSON.stringify({projectId, dataset, roomKey, basePath})};`,
    'export default function Home() { return <StaticHome {...publicSettings} />; }',
    '',
  ].join('\n'));

  const childEnvironment = {};
  for (const key of ['PATH', 'HOME', 'TMPDIR', 'TMP', 'TEMP', 'SystemRoot', 'SYSTEMROOT', 'COMSPEC', 'LANG', 'LC_ALL']) {
    if (process.env[key]) childEnvironment[key] = process.env[key];
  }
  childEnvironment.CI = '1';
  childEnvironment.NEXT_TELEMETRY_DISABLED = '1';
  console.log(`Building an isolated static export at ${staging}`);
  const code = await new Promise((resolveExit, reject) => {
    const child = spawn(process.execPath, [installedNext, 'build', '--webpack'], {
      cwd: staging, env: childEnvironment, stdio: 'inherit',
    });
    child.once('error', reject);
    child.once('close', (exitCode) => resolveExit(exitCode ?? 1));
  });
  if (code !== 0) throw new Error(`Static export failed (exit ${code}). Its isolated staging files remain at ${staging}.`);
  await writeFile(join(staging, 'out/.nojekyll'), '');
  console.log(`Static export complete: ${join(staging, 'out')}`);
  console.log('No deployment was performed. Runtime Sanity reads still require published content and an approved CORS origin.');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'Static export failed.');
  process.exitCode = 1;
});
