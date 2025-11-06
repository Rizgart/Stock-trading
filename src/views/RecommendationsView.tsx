import React, { useMemo, useState } from 'react';
import RecommendationsTable from './RecommendationsTable';
import { useAppData } from '../context/AppDataContext';
import { runBacktest, type BacktestResponse } from '../services/backend';

const RecommendationsView: React.FC = () => {
  const {
    recommendations,
    updateRiskProfile,
    riskProfile,
    setSectors,
    quotes,
    apiBaseUrl,
    apiKey
  } = useAppData();
  const [search, setSearch] = useState('');
  const [backtestLoading, setBacktestLoading] = useState(false);
  const [backtestResult, setBacktestResult] = useState<BacktestResponse | null>(null);
  const [backtestError, setBacktestError] = useState<string | null>(null);
  const sectors = useMemo(() => [...new Set(quotes.map((quote) => quote.sector))], [quotes]);

  const filtered = useMemo(
    () =>
      recommendations.filter(
        (item) =>
          item.symbol.toLowerCase().includes(search.toLowerCase()) ||
          item.name.toLowerCase().includes(search.toLowerCase())
      ),
    [recommendations, search]
  );

  const handleSectorToggle = (sector: string) => {
    setSectors((current) => {
      if (current.includes(sector)) {
        return current.filter((item) => item !== sector);
      }
      return [...current, sector];
    });
  };

  const handleRunBacktest = async () => {
    const symbols = filtered.slice(0, 5).map((item) => item.symbol);
    if (symbols.length === 0) {
      return;
    }

    setBacktestLoading(true);
    setBacktestError(null);
    try {
      const result = await runBacktest({
        baseUrl: apiBaseUrl,
        apiKey,
        symbols,
        period: '1y',
        profile: riskProfile
      });
      setBacktestResult(result);
    } catch (error) {
      console.error(error);
      setBacktestError('Kunde inte köra backtest just nu.');
    } finally {
      setBacktestLoading(false);
    }
  };

  return (
    <div className="stack">
      <section className="panel">
        <header>
          <h1>Rekommendationer</h1>
          <span>Filtrera efter riskprofil och sektor</span>
        </header>
        <div className="filters">
          <label>
            <span>Riskprofil</span>
            <select value={riskProfile} onChange={(event) => updateRiskProfile(event.target.value as any)}>
              <option value="konservativ">Konservativ</option>
              <option value="balanserad">Balanserad</option>
              <option value="aggressiv">Aggressiv</option>
            </select>
          </label>
          <label>
            <span>Sök</span>
            <input
              type="search"
              placeholder="Sök bolag eller ticker"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
        </div>
        <div className="sector-filter">
          {sectors.map((sector) => (
            <button key={sector} type="button" onClick={() => handleSectorToggle(sector)}>
              {sector}
            </button>
          ))}
        </div>
      </section>

      <section className="panel">
        <RecommendationsTable items={filtered} />
      </section>

      <section className="panel">
        <header>
          <h2>Backtest</h2>
          <span>Kör en snabb walk-forward backtest på toppvalen (1 år)</span>
        </header>
        <button className="primary" type="button" onClick={handleRunBacktest} disabled={backtestLoading}>
          {backtestLoading ? 'Kör...' : 'Starta backtest'}
        </button>
        {backtestError ? <p className="negative">{backtestError}</p> : null}
        {backtestResult ? (
          <div className="table">
            <table>
              <thead>
                <tr>
                  <th>Symbol</th>
                  <th>CAGR</th>
                  <th>Sharpe</th>
                  <th>Max Drawdown</th>
                </tr>
              </thead>
              <tbody>
                {backtestResult.symbols.map((item) => (
                  <tr key={item.symbol}>
                    <td>{item.symbol}</td>
                    <td>{(item.cagr * 100).toFixed(2)}%</td>
                    <td>{item.sharpe.toFixed(2)}</td>
                    <td>{(item.max_drawdown * 100).toFixed(2)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>
    </div>
  );
};

export default RecommendationsView;
