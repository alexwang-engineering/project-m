import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { PageBlocks } from '@/components/page-renderer';

describe('page file rendering', () => {
  it('offers authorised PDF preview and download separately', () => {
    render(
      <PageBlocks
        content={{
          schemaVersion: 1,
          blocks: [
            {
              id: 'pdf',
              type: 'file',
              fileId: '00000000-0000-4000-8000-000000000001',
              label: 'Worksheet',
            },
          ],
        }}
        files={{
          '00000000-0000-4000-8000-000000000001': {
            url: 'https://storage.example/preview',
            downloadUrl: 'https://storage.example/download',
            filename: 'worksheet.pdf',
            mediaType: 'application/pdf',
            sizeBytes: 1024,
          },
        }}
      />,
    );

    expect(screen.getByText('Review PDF: Worksheet')).toBeInTheDocument();
    expect(screen.getByTitle('PDF preview: Worksheet')).toHaveAttribute(
      'src',
      'https://storage.example/preview',
    );
    expect(screen.getByRole('link', { name: /Worksheet/ })).toHaveAttribute(
      'href',
      'https://storage.example/download',
    );
  });
});
