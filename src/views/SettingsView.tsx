import React, { useEffect, useRef, useState } from 'react';
import { useAppData } from '../context/AppDataContext';

const SettingsView: React.FC = () => {
  const {
    riskProfile,
    updateRiskProfile,
    apiKey,
    updateApiKey,
    apiBaseUrl,
    updateApiBaseUrl,
    symbolLimit,
    updateSymbolLimit
  } = useAppData();
  const [language, setLanguage] = useState<'sv' | 'en'>('sv');
  const [formValue, setFormValue] = useState('');
  const [status, setStatus] = useState<'idle' | 'saved'>('idle');
  const resetTimerRef = useRef<number | null>(null);
  const [limitValue, setLimitValue] = useState<string>('');
  const [urlValue, setUrlValue] = useState('');

  useEffect(() => {
    setFormValue(apiKey ?? '');
  }, [apiKey]);

  useEffect(() => {
    setLimitValue(String(symbolLimit));
  }, [symbolLimit]);

  useEffect(() => {
    setUrlValue(apiBaseUrl ?? '');
  }, [apiBaseUrl]);

  useEffect(() => {
    return () => {
      if (resetTimerRef.current) {
        window.clearTimeout(resetTimerRef.current);
      }
    };
  }, []);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    updateApiKey(formValue);
    updateApiBaseUrl(urlValue);
    setStatus('saved');
    if (resetTimerRef.current) {
      window.clearTimeout(resetTimerRef.current);
    }
    resetTimerRef.current = window.setTimeout(() => setStatus('idle'), 2500);
  };

  return (
    <div className="stack">
      <section className="panel">
        <header>
          <h1>Inställningar</h1>
          <span>Hantera API-nycklar, språk och riskparametrar</span>
        </header>
        <form className="form" onSubmit={handleSubmit}>
          <label>
            <span>API-bas-URL</span>
            <input
              type="url"
              placeholder="http://localhost:8000"
              value={urlValue}
              onChange={(event) => {
                setUrlValue(event.target.value);
                setStatus('idle');
              }}
              onBlur={(event) => updateApiBaseUrl(event.currentTarget.value)}
            />
            <small>Ange backend-API:ets basadress (t.ex. FastAPI-server på http://localhost:8000).</small>
          </label>
          <label>
            <span>API-nyckel</span>
            <input
              type="password"
              placeholder="Klistra in din API-nyckel"
              value={formValue}
              onChange={(event) => {
                setFormValue(event.target.value);
                setStatus('idle');
              }}
            />
            <small>
              Nyckeln lagras krypterat lokalt (Keychain/DPAPI) i den riktiga versionen av appen.
            </small>
          </label>
          <button type="submit" className="primary">
            Spara nyckel
          </button>
          {status === 'saved' ? (
            <span className="success-text">Nyckeln sparades! Data laddas om automatiskt.</span>
          ) : null}
          <label>
            <span>Max antal symboler per uppdatering</span>
            <input
              type="number"
              min={25}
              max={2000}
              step={25}
              value={limitValue}
              onChange={(event) => {
                setLimitValue(event.target.value);
                setStatus('idle');
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  const parsed = Number.parseInt(event.currentTarget.value, 10);
                  if (!Number.isNaN(parsed)) {
                    updateSymbolLimit(parsed);
                  }
                }
              }}
              onBlur={(event) => {
                const parsed = Number.parseInt(event.currentTarget.value, 10);
                if (!Number.isNaN(parsed)) {
                  updateSymbolLimit(parsed);
                } else {
                  setLimitValue(String(symbolLimit));
                }
              }}
            />
            <small>
              Appen laddar symboler i omgångar för att respektera API:ets rate limits. Öka värdet om du har en högre
              plan och vill läsa in fler samtidigt.
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
