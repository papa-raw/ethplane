import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Panel } from '@/components/dashboard/Panel';

/** PRD 3.15: every panel owes the reader loading, empty and error. These are those three. */
describe('Panel', () => {
  it('shows a skeleton while the first fetch is in flight', () => {
    render(<Panel poll={{ data: null, error: null, loading: true }} empty="nothing">{() => <p>rows</p>}</Panel>);
    expect(screen.getByTestId('panel-loading')).toBeInTheDocument();
  });

  it('names the failure when the API cannot be read', () => {
    render(<Panel poll={{ data: null, error: '/api/nodes responded 500', loading: false }} empty="nothing">{() => <p>rows</p>}</Panel>);
    expect(screen.getByTestId('panel-error')).toHaveTextContent('/api/nodes responded 500');
  });

  it('says what empty means rather than showing a blank box', () => {
    render(<Panel poll={{ data: [], error: null, loading: false }} empty="No leases on this node yet.">{() => <p>rows</p>}</Panel>);
    expect(screen.getByTestId('panel-empty')).toHaveTextContent('No leases on this node yet.');
  });

  it('keeps showing data when a later poll fails, rather than blanking the page', () => {
    render(
      <Panel poll={{ data: [1], error: 'network', loading: false }} empty="nothing">
        {(rows: number[]) => <p>{rows.length} row</p>}
      </Panel>
    );
    expect(screen.getByTestId('panel-data')).toHaveTextContent('1 row');
  });
});
