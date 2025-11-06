import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAppData } from '../context/AppDataContext';
import './Layout.css';

const navItems = [
  { to: '/', label: 'Dashboard' },
  { to: '/rekommendationer', label: 'Rekommendationer' },
  { to: '/watchlist', label: 'Watchlist' },
  { to: '/alerts', label: 'Larm' },
  { to: '/inställningar', label: 'Inställningar' }
];

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { summary } = useAppData();
  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="brand">AktieTipset</div>
        <nav>
          {navItems.map((item) => (
            <NavLink key={item.to} to={item.to} className={({ isActive }) => (isActive ? 'active' : '')}>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <p className="disclaimer">
          Appen ger information för utbildningssyfte. Historisk avkastning är ingen garanti för
          framtida resultat.
        </p>
      </aside>
      <main className="main">
        {summary && (
          <header className="summary">
            <div>
              <h2>{summary.headline}</h2>
              <span>Senast uppdaterad: {new Date(summary.updatedAt).toLocaleTimeString()}</span>
            </div>
            <div className="movers">
              {summary.movers.map((mover) => (
                <span key={mover.symbol}>
                  {mover.symbol}: {mover.changePct.toFixed(2)}%
                </span>
              ))}
            </div>
          </header>
        )}
        <div className="content">{children}</div>
      </main>
    </div>
  );
};

export default Layout;
