import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import HistoryTable from '../src/components/HistoryTable';
import { I18nextProvider } from 'react-i18next';
import i18n from '../src/i18n';

describe('HistoryTable', () => {
  const renderTable = () =>
    render(
      <I18nextProvider i18n={i18n}>
        <HistoryTable />
      </I18nextProvider>
    );

  it('renders table with translated headers', () => {
    renderTable();

    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getAllByText(/date/i)[0]).toBeInTheDocument();
    expect(screen.getByText(/action/i)).toBeInTheDocument();
    expect(screen.getByText(/status/i)).toBeInTheDocument();
  });

  it('allows keyboard activation of rows', () => {
    renderTable();

    const firstRow = screen.getAllByRole('button')[0];
    fireEvent.keyDown(firstRow, { key: 'Enter' });

    expect(firstRow).toHaveAttribute('aria-pressed', 'true');
  });
});
