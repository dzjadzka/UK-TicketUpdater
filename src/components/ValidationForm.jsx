import React from 'react';
import { useTranslation } from 'react-i18next';

const ValidationForm = () => {
  const { t } = useTranslation(['forms']);
  const [name, setName] = React.useState('');
  const [error, setError] = React.useState('');
  const [success, setSuccess] = React.useState('');
  const inputRef = React.useRef(null);

  const handleSubmit = (event) => {
    event.preventDefault();
    setSuccess('');
    if (!name.trim()) {
      setError(t('forms:validationError'));
      inputRef.current?.focus();
      return;
    }
    setError('');
    setSuccess(t('forms:success'));
  };

  const onKeyDown = (event) => {
    if (event.key === 'Enter') {
      handleSubmit(event);
    }
  };

  return (
    <form onSubmit={handleSubmit} aria-labelledby="accessible-form-heading" className="card">
      <h2 id="accessible-form-heading">{t('forms:heading')}</h2>
      <label htmlFor="name-input">{t('forms:nameLabel')}</label>
      <input
        id="name-input"
        name="name"
        ref={inputRef}
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={onKeyDown}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? 'name-error' : undefined}
      />
      {error ? (
        <div id="name-error" role="alert" aria-live="assertive" className="error">
          {error}
        </div>
      ) : null}
      {success ? (
        <div role="status" aria-live="polite" className="success">
          {success}
        </div>
      ) : null}
      <button type="submit">{t('forms:submit')}</button>
    </form>
  );
};

export default ValidationForm;
