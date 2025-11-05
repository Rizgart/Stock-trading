import React, { useState } from 'react';
import { useAppData } from '../context/AppDataContext';

const SettingsView: React.FC = () => {
  const { riskProfile, updateRiskProfile } = useAppData();
  const [apiKey, setApiKey] = useState('');
  const [language, setLanguage] = useState<'sv' | 'en'>('sv');

  return (
    <div className="stack">
      <section className="panel">
        <header>
          <h1>Inställningar</h1>
          <span>Hantera API-nycklar, språk och riskparametrar</span>
        </header>
        <form className="form">
          <label>
            <span>API-nyckel (Nordnet/Yahoo)</span>
            <input
              type="password"
              placeholder="Klistra in din API-nyckel"
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
            />
            <small>
              Nyckeln lagras krypterat lokalt (Keychain/DPAPI) i den riktiga versionen av appen.
            </small>
          </label>
          <label>
            <span>Språk</span>
            <select value={language} onChange={(event) => setLanguage(event.target.value as 'sv' | 'en')}>
              <option value="sv">Svenska</option>
              <option value="en">English</option>
            </select>
          </label>
          <label>
            <span>Standard riskprofil</span>
            <select value={riskProfile} onChange={(event) => updateRiskProfile(event.target.value as any)}>
              <option value="konservativ">Konservativ</option>
              <option value="balanserad">Balanserad</option>
              <option value="aggressiv">Aggressiv</option>
            </select>
          </label>
        </form>
      </section>

      <section className="panel">
        <header>
          <h2>Dataintegration</h2>
        </header>
        <ul className="bullets">
          <li>OAuth2 & tokenhantering med automatiska förnyelser.</li>
          <li>Request caching (in-memory + SQLite) för att klara API-rate limits.</li>
          <li>Retrier med exponentiell backoff och avisering vid fel.</li>
        </ul>
      </section>
    </div>
  );
};

export default SettingsView;
