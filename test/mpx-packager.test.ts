// @vitest-environment node

import { File as NodeFile } from 'node:buffer';
import { webcrypto } from 'node:crypto';

import JSZip from 'jszip';
import { beforeAll, describe, expect, it } from 'vitest';

import { MpxFormatError, packageMpx, unpackMpx } from '@/lib/mpx-packager';

beforeAll(() => {
  Object.defineProperty(globalThis, 'File', {
    configurable: true,
    value: NodeFile,
  });
  Object.defineProperty(globalThis, 'crypto', {
    configurable: true,
    value: webcrypto,
  });
});

function pdf(name = 'lesson.pdf', body = 'test'): File {
  return new NodeFile([`%PDF-1.7\n${body}`], name, {
    type: 'application/pdf',
  }) as File;
}

async function archiveFile(blob: Blob, name = 'lesson.mpx'): Promise<File> {
  return new NodeFile([new Uint8Array(await blob.arrayBuffer())], name, {
    type: 'application/vnd.project-m.mpx+zip',
  }) as File;
}

describe('MPX v1', () => {
  it('round-trips page JSON and checksummed PDF attachments', async () => {
    const blob = await packageMpx(
      {
        schemaVersion: 1,
        blocks: [{ id: 'p1', type: 'paragraph', html: '<p>Lesson</p>' }],
      },
      [pdf('worksheet.pdf'), pdf('worksheet.pdf', 'second')],
    );
    const result = await unpackMpx(await archiveFile(blob));

    expect(result.page).toMatchObject({ schemaVersion: 1 });
    expect(result.attachments.map(({ name }) => name)).toEqual([
      'worksheet.pdf',
      'worksheet (2).pdf',
    ]);
    expect(result.manifest).toMatchObject({
      format: 'project-m.mpx',
      version: 1,
    });
    expect(result.manifest.attachments[0]?.id).toMatch(/^sha256:[0-9a-f]{64}$/);
  });

  it('rejects a renamed non-PDF during packaging', async () => {
    await expect(
      packageMpx({ schemaVersion: 1, blocks: [] }, [
        new NodeFile(['not a pdf'], 'fake.pdf', {
          type: 'application/pdf',
        }) as File,
      ]),
    ).rejects.toThrow(/PDF signature/);
  });

  it('rejects page content changed after the manifest checksum was created', async () => {
    const original = await packageMpx({ schemaVersion: 1, blocks: [] }, [
      pdf(),
    ]);
    const zip = await JSZip.loadAsync(await original.arrayBuffer());
    zip.file('page.json', '{"schemaVersion":2,"blocks":[]}');
    const tampered = await zip.generateAsync({ type: 'uint8array' });

    await expect(
      unpackMpx(new NodeFile([tampered], 'tampered.mpx') as File),
    ).rejects.toThrow(/SHA-256 verification failed/);
  });

  it('rejects archive entries absent from the manifest', async () => {
    const original = await packageMpx({ schemaVersion: 1, blocks: [] }, []);
    const zip = await JSZip.loadAsync(await original.arrayBuffer());
    zip.file('unexpected.txt', 'secret');
    const changed = await zip.generateAsync({ type: 'uint8array' });

    await expect(
      unpackMpx(new NodeFile([changed], 'extra.mpx') as File),
    ).rejects.toThrow(/do not exactly match/);
  });

  it('rejects incompatible manifest versions', async () => {
    const zip = new JSZip();
    zip.file(
      'manifest.json',
      JSON.stringify({
        format: 'project-m.mpx',
        version: 99,
        page: {},
        attachments: [],
      }),
    );
    zip.file('page.json', '{}');
    const bytes = await zip.generateAsync({ type: 'uint8array' });

    await expect(
      unpackMpx(new NodeFile([bytes], 'future.mpx') as File),
    ).rejects.toBeInstanceOf(MpxFormatError);
  });
});
