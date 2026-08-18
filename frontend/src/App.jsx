import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { SiteProvider } from './context/SiteContext';
import ProtectedRoute from './components/layout/ProtectedRoute';
import Layout from './components/layout/Layout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/dashboard/DashboardPage';

// Analytics
import VisitorsPage from './pages/analytics/VisitorsPage';
import ApplicantsPage from './pages/analytics/ApplicantsPage';
import ViewersPage from './pages/analytics/ViewersPage';
import CommentsPage from './pages/analytics/CommentsPage';

// Functions
import FunctionsPage from './pages/functions/FunctionsPage';

// Data
import DataPage from './pages/data/DataPage';

// Connections
import ConnectionsPage from './pages/connections/ConnectionsPage';

// AI
import AiPage from './pages/ai/AiPage';

// Alerts
import AlertsPage from './pages/alerts/AlertsPage';

// Sites
import SitesPage from './pages/sites/SitesPage';

// Settings
import {
  SettingsLayout, GeneralSettings, SecuritySettings,
  ApiKeysSettings, SecretsSettings, AuditLogsSettings
} from './pages/settings/SettingsPages';

export default function App() {
  return (
    <AuthProvider>
      <SiteProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
              <Route index element={<DashboardPage />} />

              {/* Analytics */}
              <Route path="analytics/visitors" element={<VisitorsPage />} />
              <Route path="analytics/applicants" element={<ApplicantsPage />} />
              <Route path="analytics/viewers" element={<ViewersPage />} />
              <Route path="analytics/comments" element={<CommentsPage />} />

              {/* Functions */}
              <Route path="functions/:name" element={<FunctionsPage />} />
              <Route path="functions/new" element={<FunctionsPage />} />
              <Route path="functions" element={<FunctionsPage />} />

              {/* Data */}
              <Route path="data/events" element={<DataPage />} />
              <Route path="data/users" element={<DataPage />} />
              <Route path="data/sessions" element={<DataPage />} />
              <Route path="data/export" element={<DataPage />} />

              {/* Connections */}
              <Route path="connections/firebase" element={<ConnectionsPage />} />
              <Route path="connections/supabase" element={<ConnectionsPage />} />
              <Route path="connections/rest" element={<ConnectionsPage />} />
              <Route path="connections/webhook" element={<ConnectionsPage />} />

              {/* AI */}
              <Route path="ai/comments" element={<AiPage />} />
              <Route path="ai/patterns" element={<AiPage />} />
              <Route path="ai/reports" element={<AiPage />} />

              {/* Alerts */}
              <Route path="alerts/visitor-spike" element={<AlertsPage />} />
              <Route path="alerts/error" element={<AlertsPage />} />
              <Route path="alerts/custom" element={<AlertsPage />} />

              {/* Sites */}
              <Route path="sites/:id" element={<SitesPage />} />
              <Route path="sites/new" element={<SitesPage />} />

              {/* Settings */}
              <Route path="settings" element={<SettingsLayout />}>
                <Route index element={<Navigate to="general" replace />} />
                <Route path="general" element={<GeneralSettings />} />
                <Route path="security" element={<SecuritySettings />} />
                <Route path="api-keys" element={<ApiKeysSettings />} />
                <Route path="secrets" element={<SecretsSettings />} />
                <Route path="audit-logs" element={<AuditLogsSettings />} />
                {/* legacy aliases */}
                <Route path="privacy" element={<GeneralSettings />} />
                <Route path="team" element={<GeneralSettings />} />
              </Route>

              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </SiteProvider>
    </AuthProvider>
  );
}
