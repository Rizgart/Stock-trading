import React, { useMemo, useState } from 'react';
import { useAppData } from '../context/AppDataContext';
import { formatCurrency, formatPct } from '../utils/format';
import { signalClass } from '../utils/signals';

const WatchlistView: React.FC = () => {
  const { watchlist, toggleWatchlist, quotes, recommendations } = useAppData();
  const [search, setSearch] = useState('');

  const availableQuotes = useMemo(
    () => quotes.filter((quote) => quote.symbol.toLowerCase().includes(search.toLowerCase())),
    [quotes, search]
  );

  const watchlistDetails = watchlist
    .map((entry) => ({
      entry,
      quote: quotes.find((quote) => quote.symbol === entry.symbol),
      recommendation: recommendations.find((item) => item.symbol === entry.symbol)
    }))
    .filter((item) => item.quote);

  return (
    <div className="stack">
      <section className="panel">
        <header>
          <h1>Watchlist</h1>
          <span>Övervaka och hantera bevakade aktier</span>
        </header>
        <label className="search">
          <span>Lägg till symbol</span>
          <input
            type="search"
            placeholder="Sök efter bolag eller ticker"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        <div className="chips">
          {availableQuotes.slice(0, 10).map((quote) => (
            <button key={quote.symbol} type="button" onClick={() => toggleWatchlist(quote.symbol)}>
              {watchlist.some((item) => item.symbol === quote.symbol) ? '− ' : '+ '}
              {quote.symbol}
            </button>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="table">
          <table>
            <thead>
              <tr>
                <th>Symbol</th>
                <th>Pris</th>
                <th>1d</th>
                <th>Signal</th>
                <th>Notiser</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {watchlistDetails.length === 0 && (
                <tr>
                  <td colSpan={6}>Lägg till aktier för att följa utvecklingen.</td>
                </tr>
              )}
              {watchlistDetails.map(({ entry, quote, recommendation }) => (
                <tr key={entry.symbol}>
                  <td>{entry.symbol}</td>
                  <td>{formatCurrency(quote!.price)}</td>
                  <td className={quote!.changePct >= 0 ? 'positive' : 'negative'}>
                    {formatPct(quote!.changePct)}
                  </td>
                  <td className={`signal ${recommendation ? signalClass(recommendation.signal) : ''}`}>
                    {recommendation?.signal ?? '–'}
                  </td>
                  <td>
                    {entry.alertBelow ? `Alert under ${formatCurrency(entry.alertBelow)}` : '–'}
                  </td>
                  <td>
                    <button type="button" onClick={() => toggleWatchlist(entry.symbol)}>
                      Ta bort
                    </button>
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

export default WatchlistView;
