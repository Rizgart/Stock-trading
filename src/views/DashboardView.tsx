import React from 'react';
import { useAppData } from '../context/AppDataContext';
import { formatCurrency, formatPct } from '../utils/format';
import RecommendationsTable from './RecommendationsTable';

const DashboardView: React.FC = () => {
  const { loading, recommendations, watchlist, quotes } = useAppData();
  const topRecommendations = recommendations.slice(0, 3);
  const watchlistQuotes = watchlist
    .map((entry) => quotes.find((quote) => quote.symbol === entry.symbol))
    .filter(Boolean);

  return (
    <div className="stack">
      <section className="panel">
        <header>
          <h1>Marknadssammanfattning</h1>
          <span>{loading ? 'Uppdaterar...' : 'Senaste signalerna'}</span>
        </header>
        <div className="metrics">
          <div>
            <strong>{recommendations.length}</strong>
            <span>Aktier analyserade</span>
          </div>
          <div>
            <strong>{recommendations.filter((item) => item.signal === 'Köp').length}</strong>
            <span>Köp-signal</span>
          </div>
          <div>
            <strong>{recommendations.filter((item) => item.signal === 'Sälj').length}</strong>
            <span>Sälj-signal</span>
          </div>
        </div>
      </section>

      <section className="panel">
        <header>
          <h2>Toppval idag</h2>
          <span>Genererade med teknisk & fundamental modell</span>
        </header>
        <RecommendationsTable items={topRecommendations} compact />
      </section>

      <section className="panel">
        <header>
          <h2>Bevakningslista</h2>
          <span>Snabb överblick av dina valda innehav</span>
        </header>
        <div className="table">
          <table>
            <thead>
              <tr>
                <th>Symbol</th>
                <th>Pris</th>
                <th>Förändring</th>
              </tr>
            </thead>
            <tbody>
              {watchlistQuotes.length === 0 && (
                <tr>
                  <td colSpan={3}>Inga aktier i bevakningslistan ännu.</td>
                </tr>
              )}
              {watchlistQuotes.map((quote) => (
                <tr key={quote!.symbol}>
                  <td>{quote!.symbol}</td>
                  <td>{formatCurrency(quote!.price)}</td>
                  <td className={quote!.changePct >= 0 ? 'positive' : 'negative'}>
                    {formatPct(quote!.changePct)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};

export default DashboardView;
