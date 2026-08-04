import { describe, expect, it } from 'vitest';

import {
  InvalidEditorDocumentError,
  parseEditorDocument,
} from '@/lib/content/schema';

describe('parseEditorDocument', () => {
  it('sanitizes only rich HTML while preserving code and controlled references', () => {
    const result = parseEditorDocument({
      schemaVersion: 1,
      blocks: [
        {
          id: 'p1',
          type: 'paragraph',
          html: '<p>Hello<script>alert(1)</script><strong>class</strong></p>',
        },
        {
          id: 'c1',
          type: 'code',
          language: 'typescript',
          code: '<script>const x = 1</script>',
        },
        {
          id: 'f1',
          type: 'file',
          fileId: '10000000-0000-4000-8000-000000000001',
          label: 'Worksheet.pdf',
        },
      ],
    });

    expect(result.blocks[0]).toEqual({
      id: 'p1',
      type: 'paragraph',
      html: '<p>Hello<strong>class</strong></p>',
    });
    expect(result.blocks[1]).toMatchObject({
      code: '<script>const x = 1</script>',
    });
    expect(result.blocks[2]).toMatchObject({
      fileId: '10000000-0000-4000-8000-000000000001',
    });
  });

  it.each([
    ['unknown schema version', { schemaVersion: 2, blocks: [] }],
    [
      'unknown block type',
      {
        schemaVersion: 1,
        blocks: [{ id: 'x', type: 'embed', url: 'https://evil.invalid' }],
      },
    ],
    [
      'unknown field',
      {
        schemaVersion: 1,
        blocks: [{ id: 'x', type: 'paragraph', html: '<p>x</p>', onload: 'x' }],
      },
    ],
    [
      'duplicate block IDs',
      {
        schemaVersion: 1,
        blocks: [
          { id: 'x', type: 'paragraph', html: 'a' },
          { id: 'x', type: 'paragraph', html: 'b' },
        ],
      },
    ],
    [
      'invalid file reference',
      {
        schemaVersion: 1,
        blocks: [{ id: 'x', type: 'file', fileId: '../../secret', label: 'x' }],
      },
    ],
  ])('rejects %s', (_name, input) => {
    expect(() => parseEditorDocument(input)).toThrow(
      InvalidEditorDocumentError,
    );
  });
});
