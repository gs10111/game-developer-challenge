import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';

interface Manifest {
  packageManager: string;
  engines: { node: string };
  devDependencies: Record<string, string>;
}

function readRepositoryFile(path: string): string {
  return readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
}

function firstCapture(text: string, pattern: RegExp): string | undefined {
  return pattern.exec(text)?.[1];
}

const manifest = JSON.parse(readRepositoryFile('package.json')) as Manifest;
const dockerfile = readRepositoryFile('Dockerfile');

describe('toolchain versions (ADR-0017)', () => {
  test('DL-07 the image tag matches the installed @playwright/test', () => {
    const imageVersion = firstCapture(dockerfile, /^FROM mcr\.microsoft\.com\/playwright:v(\S+)-noble$/m);

    expect(imageVersion).toBe(manifest.devDependencies['@playwright/test']);
  });

  test('DL-07 the image installs the pnpm pinned in packageManager', () => {
    const imagePnpm = firstCapture(dockerfile, /npm install -g (pnpm@\S+)/);

    expect(imagePnpm).toBe(manifest.packageManager);
  });

  test('DL-07 .nvmrc stays inside the supported Node major', () => {
    const pinnedMajor = firstCapture(readRepositoryFile('.nvmrc'), /^v?(\d+)/);
    const supportedMajor = firstCapture(manifest.engines.node, /^>=(\d+) </);

    expect(pinnedMajor).toBeDefined();
    expect(pinnedMajor).toBe(supportedMajor);
  });
});
