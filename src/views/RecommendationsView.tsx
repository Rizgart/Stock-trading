import React, { useMemo, useState } from 'react';
import RecommendationsTable from './RecommendationsTable';
import { useAppData } from '../context/AppDataContext';

const RecommendationsView: React.FC = () => {
  const { recommendations, updateRiskProfile, riskProfile, setSectors, quotes } = useAppData();
  const [search, setSearch] = useState('');
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
    </div>
  );
};

export default RecommendationsView;
