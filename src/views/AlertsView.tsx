import React, { useEffect, useMemo, useState } from 'react';
import { useAppData } from '../context/AppDataContext';

const AlertsView: React.FC = () => {
  const { alerts, quotes, addAlert, removeAlert } = useAppData();
  const [symbol, setSymbol] = useState<string>('');
  const [operator, setOperator] = useState<'>=' | '<='>('>=');
  const [target, setTarget] = useState<number>(0);
  const [channels, setChannels] = useState<string[]>(['in_app']);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const availableSymbols = useMemo(() => {
    if (quotes.length === 0) {
      return ['AAA', 'BBB', 'CCC'];
    }
    return quotes.map((quote) => quote.symbol);
  }, [quotes]);

  useEffect(() => {
    if (!symbol && availableSymbols.length > 0) {
      setSymbol(availableSymbols[0]);
    }
  }, [symbol, availableSymbols]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!symbol) {
      return;
    }

    try {
      await addAlert({
        symbol,
        channels,
        rule: {
          price: {
            operator,
            target
          }
        }
      });
      setStatusMessage('Larm skapat!');
      setTarget(0);
    } catch (error) {
      setStatusMessage('Kunde inte skapa larm.');
      console.error(error);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await removeAlert(id);
    } catch (error) {
      console.error('Kunde inte ta bort larm', error);
    }
  };

  return (
    <div className="panel stack">
      <header>
        <h1>Larm</h1>
        <span>Hantera prisbevakningar och notifieringar</span>
      </header>

      <section className="panel">
        <h2>Skapa nytt larm</h2>
        <form className="form" onSubmit={handleSubmit}>
          <label>
            <span>Symbol</span>
            <select value={symbol} onChange={(event) => setSymbol(event.target.value)}>
              <option value="">Välj symbol</option>
              {availableSymbols.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Villkor</span>
            <div className="field-row">
              <select value={operator} onChange={(event) => setOperator(event.target.value as any)}>
                <option value=">=">≥</option>
                <option value="<=">≤</option>
              </select>
              <input
                type="number"
                value={target}
                onChange={(event) => setTarget(Number(event.target.value))}
                step="0.01"
              />
            </div>
          </label>
          <label>
            <span>Notifieringar</span>
            <select
              multiple
              value={channels}
              onChange={(event) =>
                setChannels(Array.from(event.target.selectedOptions).map((option) => option.value))
              }
            >
              <option value="in_app">In-app</option>
              <option value="desktop_push">Desktop push</option>
              <option value="email">E-post</option>
            </select>
          </label>
          <button type="submit" className="primary">
            Lägg till larm
          </button>
          {statusMessage ? <span className="success-text">{statusMessage}</span> : null}
        </form>
      </section>

      <section className="panel">
        <h2>Befintliga larm</h2>
        {alerts.length === 0 ? (
          <p>Inga larm skapade ännu.</p>
        ) : (
          <table className="alerts-table">
            <thead>
              <tr>
                <th>Symbol</th>
                <th>Villkor</th>
                <th>Kanaler</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {alerts.map((alert) => (
                <tr key={alert.id}>
                  <td>{alert.symbol}</td>
                  <td>
                    {alert.rule.price
                      ? `${alert.rule.price.operator} ${alert.rule.price.target}`
                      : 'N/A'}
                  </td>
                  <td>{alert.channels.join(', ')}</td>
                  <td>{alert.active ? 'Aktiv' : 'Avstängd'}</td>
                  <td>
                    <button type="button" onClick={() => handleDelete(alert.id)}>
                      Ta bort
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
};

export default AlertsView;
