import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { SiteProvider } from './context/SiteContext';
import ProtectedRoute from './components/layout/ProtectedRoute';
import Layout from './components/layout/Layout';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import OnboardingPage from './pages/OnboardingPage';
import DashboardPage from './pages/dashboard/DashboardPage';

import VisitorsPage from './pages/analytics/VisitorsPage';
import ApplicantsPage from './pages/analytics/ApplicantsPage';
import ViewersPage from './pages/analytics/ViewersPage';
import CommentsPage from './pages/analytics/CommentsPage';
import FunctionsPage from './pages/functions/FunctionsPage';
import DataPage from './pages/data/DataPage';
import ConnectionsPage from './pages/connections/ConnectionsPage';
import AiPage from './pages/ai/AiPage';
import AlertsPage from './pages/alerts/AlertsPage';
import SitesPage from './pages/sites/SitesPage';
import {
  SettingsLayout, GeneralSettings, SecuritySettings,
  ApiKeysSettings, SecretsSettings, AuditLogsSettings
} from './pages/settings/SettingsPages';

// 온보딩 보호 라우트 — 로그인은 됐지만 그룹 없을 때
function OnboardingRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

import { useAuth } from './context/AuthContext';

export default function App() {
  return (
    <AuthProvider>
      <SiteProvider>
        <BrowserRouter>
          <Routes>
            {/* 공개 라우트 */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/onboarding" element={
              <OnboardingRoute><OnboardingPage /></OnboardingRoute>
            } />

            {/* 보호 라우트 */}
            <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
              <Route index element={<DashboardPage />} />

              <Route path="analytics/visitors" element={<VisitorsPage />} />
              <Route path="analytics/applicants" element={<ApplicantsPage />} />
              <Route path="analytics/viewers" element={<ViewersPage />} />
              <Route path="analytics/comments" element={<CommentsPage />} />

              <Route path="functions/:name" element={<FunctionsPage />} />
              <Route path="functions/new" element={<FunctionsPage />} />
              <Route path="functions" element={<FunctionsPage />} />

              <Route path="data/events" element={<DataPage />} />
              <Route path="data/users" element={<DataPage />} />
              <Route path="data/sessions" element={<DataPage />} />
              <Route path="data/export" element={<DataPage />} />

              <Route path="connections/firebase" element={<ConnectionsPage />} />
              <Route path="connections/supabase" element={<ConnectionsPage />} />
              <Route path="connections/rest" element={<ConnectionsPage />} />
              <Route path="connections/webhook" element={<ConnectionsPage />} />

              <Route path="ai/comments" element={<AiPage />} />
              <Route path="ai/patterns" element={<AiPage />} />
              <Route path="ai/reports" element={<AiPage />} />

              <Route path="alerts/visitor-spike" element={<AlertsPage />} />
              <Route path="alerts/error" element={<AlertsPage />} />
              <Route path="alerts/custom" element={<AlertsPage />} />

              <Route path="sites/:id" element={<SitesPage />} />
              <Route path="sites/new" element={<SitesPage />} />

              <Route path="settings" element={<SettingsLayout />}>
                <Route index element={<Navigate to="general" replace />} />
                <Route path="general" element={<GeneralSettings />} />
                <Route path="security" element={<SecuritySettings />} />
                <Route path="api-keys" element={<ApiKeysSettings />} />
                <Route path="secrets" element={<SecretsSettings />} />
                <Route path="audit-logs" element={<AuditLogsSettings />} />
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
