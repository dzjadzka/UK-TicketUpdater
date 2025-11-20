import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import ValidationForm from '../src/components/ValidationForm';
import { I18nextProvider } from 'react-i18next';
import i18n from '../src/i18n';

describe('ValidationForm', () => {
  const renderForm = () =>
    render(
      <I18nextProvider i18n={i18n}>
        <ValidationForm />
      </I18nextProvider>
    );

  it('shows validation errors and focuses the input', () => {
    renderForm();

    fireEvent.submit(screen.getByRole('form'));

    const input = screen.getByLabelText(/full name/i);
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(input).toHaveFocus();
  });

  it('submits successfully when input is filled', () => {
    renderForm();

    const input = screen.getByLabelText(/full name/i);
    fireEvent.change(input, { target: { value: 'Jane Doe' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(/successfully/i);
  });
});
