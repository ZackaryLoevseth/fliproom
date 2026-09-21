import {copyFile, lstat, readdir, readFile, realpath, writeFile} from 'node:fs/promises';
import {dirname, join, relative, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const runtimeRoots = ['@sanity/client', 'next', 'react', 'react-dom'];
const noticeName = /^(licen[sc]e|notice|copying|copyright|unlicense)([._-].*)?$/i;

async function resolveDependency(from, name) {
  for (let directory = from; ; directory = dirname(directory)) {
    const candidate = join(directory, 'node_modules', name);
    try {
      if ((await lstat(join(candidate, 'package.json'))).isFile()) return candidate;
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    if (directory === dirname(directory)) throw new Error(`Missing installed dependency: ${name}`);
  }
}

async function findNotices(directory) {
  const files = [];
  async function visit(current) {
    for (const entry of await readdir(current, {withFileTypes: true})) {
      if (entry.name === 'node_modules' || entry.isSymbolicLink()) continue;
      const path = join(current, entry.name);
      if (entry.isDirectory()) await visit(path);
      else if (entry.isFile() && noticeName.test(entry.name)) files.push(path);
    }
  }
  await visit(directory);
  return files.sort();
}

export async function writeReleaseNotices(projectRoot, outputDirectory) {
  const queue = runtimeRoots.map((name) => join(projectRoot, 'node_modules', name));
  const seen = new Set();
  const packages = [];
  while (queue.length) {
    const directory = queue.pop();
    const identity = await realpath(directory);
    if (seen.has(identity)) continue;
    seen.add(identity);
    const metadata = JSON.parse(await readFile(join(directory, 'package.json'), 'utf8'));
    packages.push({directory, metadata, files: await findNotices(directory)});
    for (const name of Object.keys(metadata.dependencies ?? {})) queue.push(await resolveDependency(directory, name));
  }
  packages.sort((a, b) => `${a.metadata.name}@${a.metadata.version}`.localeCompare(`${b.metadata.name}@${b.metadata.version}`));
  const sections = [
    'Fliproom — third-party notices',
    '',
    'This file preserves the installed license and notice texts for the public export runtime roots',
    '(@sanity/client, next, react and react-dom) and their declared required dependencies.',
    'All notice files shipped inside those packages are included, including Next.js vendored notices.',
    'This is a conservative superset: inclusion does not mean every listed component is in a browser bundle.',
    'Optional native compiler/image binaries and the separate local Studio are not distributed in this static site.',
    'The Fliproom application license is provided separately in LICENSE. Third-party notices remain unchanged.',
    '',
  ];
  let noticeFiles = 0;
  for (const {directory, metadata, files} of packages) {
    sections.push('='.repeat(78), `${metadata.name}@${metadata.version}`, `Declared license: ${metadata.license ?? 'see notice text'}`, '');
    if (!files.length) {
      // These marker/environment packages omit license files from their published archives.
      if (metadata.name === '@next/env' && metadata.license === 'MIT') {
        sections.push('The package identifies vercel/next.js as its repository and omits a separate license file.', 'The Next.js license is reproduced in the next package section below.', '');
      } else if (metadata.name === 'client-only' && metadata.license === 'MIT') {
        sections.push('The package metadata points to the React project and declares MIT; its archive omits a license file.', 'The React license is reproduced in the react package section below.', '');
      } else {
        throw new Error(`No installed license/notice text found for ${metadata.name}@${metadata.version}`);
      }
    }
    for (const path of files) {
      const contents = await readFile(path, 'utf8');
      if (!contents.trim() || contents.includes('\0')) throw new Error(`Invalid notice text in ${metadata.name}`);
      sections.push(`--- ${metadata.name}/${relative(directory, path)} ---`, contents, '');
      noticeFiles += 1;
    }
  }
  const text = `${sections.join('\n')}\n`;
  await writeFile(join(projectRoot, 'THIRD_PARTY_NOTICES.txt'), text);
  await writeFile(join(outputDirectory, 'THIRD_PARTY_NOTICES.txt'), text);
  await copyFile(join(projectRoot, 'LICENSE'), join(outputDirectory, 'LICENSE'));
  return {packages: packages.length, noticeFiles, bytes: Buffer.byteLength(text)};
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const outputDirectory = resolve(projectRoot, process.argv[2] ?? 'dist/pages');
  const result = await writeReleaseNotices(projectRoot, outputDirectory);
  console.log(`Release notices written: ${result.packages} packages, ${result.noticeFiles} notice files, ${result.bytes} bytes.`);
}
