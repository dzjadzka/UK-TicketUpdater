import React from 'react';
import { useTranslation } from 'react-i18next';

const historyRows = [
  { id: 1, date: '2025-11-01', action: 'Monthly download', status: 'Complete' },
  { id: 2, date: '2025-10-01', action: 'Credentials check', status: 'Complete' },
  { id: 3, date: '2025-09-01', action: 'Automated upload', status: 'Complete' }
];

const HistoryTable = () => {
  const { t } = useTranslation(['tables']);
  const [activeRow, setActiveRow] = React.useState(null);

  const onKeyDown = (event, rowId) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      setActiveRow(rowId);
    }
  };

  return (
    <div className="card" role="region" aria-labelledby="history-heading">
      <h2 id="history-heading">{t('tables:heading')}</h2>
      <table>
        <caption>{t('tables:caption')}</caption>
        <thead>
          <tr>
            <th scope="col">{t('tables:date')}</th>
            <th scope="col">{t('tables:action')}</th>
            <th scope="col">{t('tables:status')}</th>
          </tr>
        </thead>
        <tbody>
          {historyRows.map((row) => (
            <tr
              key={row.id}
              tabIndex={0}
              role="button"
              aria-pressed={activeRow === row.id}
              onKeyDown={(event) => onKeyDown(event, row.id)}
              onClick={() => setActiveRow(row.id)}
            >
              <td>{row.date}</td>
              <td>{row.action}</td>
              <td>{row.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default HistoryTable;
