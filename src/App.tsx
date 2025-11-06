import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import { AppDataProvider } from './context/AppDataContext';
import DashboardView from './views/DashboardView';
import RecommendationsView from './views/RecommendationsView';
import WatchlistView from './views/WatchlistView';
import AlertsView from './views/AlertsView';
import SettingsView from './views/SettingsView';
import './views/views.css';

const App: React.FC = () => {
  return (
    <AppDataProvider>
      <Layout>
        <Routes>
          <Route path="/" element={<DashboardView />} />
          <Route path="/rekommendationer" element={<RecommendationsView />} />
          <Route path="/watchlist" element={<WatchlistView />} />
          <Route path="/alerts" element={<AlertsView />} />
          <Route path="/inställningar" element={<SettingsView />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </AppDataProvider>
  );
};

export default App;
