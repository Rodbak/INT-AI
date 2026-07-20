import { createBrowserRouter, Navigate } from 'react-router-dom';
import CurrentTaskPage from './pages/CurrentTaskPage';
import HistoryPage from './pages/HistoryPage';
import ConversationPage from './pages/ConversationPage';
import SpecialistsPage from './pages/SpecialistsPage';
import AITeamsPage from './pages/AITeamsPage';
import AutomationsPage from './pages/AutomationsPage';
import KnowledgePage from './pages/KnowledgePage';
import PromptsPage from './pages/PromptsPage';
import ConnectionsPage from './pages/ConnectionsPage';
import AdminDashboardPage from './pages/AdminDashboardPage';
import BillingPage from './pages/BillingPage';
import SettingsPage from './pages/SettingsPage';
import Layout from './components/Layout';
import RouteError from './components/RouteError';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    errorElement: <RouteError />,
    children: [
      { index: true, element: <Navigate to="/current-task" replace /> },
      { path: 'current-task', element: <CurrentTaskPage /> },
      { path: 'history', element: <HistoryPage /> },
      { path: 'conversations/:id', element: <ConversationPage /> },
      { path: 'specialists', element: <SpecialistsPage /> },
      { path: 'ai-teams', element: <AITeamsPage /> },
      { path: 'automations', element: <AutomationsPage /> },
      { path: 'company-knowledge', element: <KnowledgePage /> },
      { path: 'prompt-library', element: <PromptsPage /> },
      { path: 'connections', element: <ConnectionsPage /> },
      { path: 'admin-dashboard', element: <AdminDashboardPage /> },
      { path: 'billing-api-keys', element: <BillingPage /> },
      { path: 'settings', element: <SettingsPage /> },
    ],
  },
  {
    path: '*',
    element: <Navigate to="/current-task" replace />,
  },
]);
