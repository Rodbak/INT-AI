import { createBrowserRouter, Navigate } from 'react-router-dom';
import CurrentTaskPage from './pages/CurrentTaskPage';
import HistoryPage from './pages/HistoryPage';
import ConversationPage from './pages/ConversationPage';
import CooHomePage from './pages/CooHomePage';
import SalesPage from './pages/SalesPage';
import CustomersPage from './pages/CustomersPage';
import StockPage from './pages/StockPage';
import MoneyPage from './pages/MoneyPage';
import ReportsPage from './pages/ReportsPage';
import PosPage from './pages/pos/PosPage';
import TillSetupPage from './pages/TillSetupPage';
import KnowledgePage from './pages/KnowledgePage';
import SettingsPage from './pages/SettingsPage';
import Layout from './components/Layout';
import RouteError from './components/RouteError';
import LoginPage from './pages/LoginPage';
import PublicHome from './pages/PublicHome';
import AuthGate from './components/AuthGate';

export const router = createBrowserRouter([
  // Public root: marketing landing page for logged-out visitors, or a redirect
  // into the app for signed-in owners (and always the app in demo mode).
  {
    path: '/',
    element: <PublicHome />,
  },
  {
    path: '/login',
    element: <LoginPage />,
  },
  // The app itself, gated behind login when auth is on.
  {
    element: <AuthGate><Layout /></AuthGate>,
    errorElement: <RouteError />,
    children: [
      { path: 'home', element: <CooHomePage /> },
      { path: 'sales', element: <SalesPage /> },
      { path: 'customers', element: <CustomersPage /> },
      { path: 'stock', element: <StockPage /> },
      { path: 'money', element: <MoneyPage /> },
      { path: 'reports', element: <ReportsPage /> },
      { path: 'till-setup', element: <TillSetupPage /> },
      { path: 'current-task', element: <CurrentTaskPage /> },
      { path: 'history', element: <HistoryPage /> },
      { path: 'conversations/:id', element: <ConversationPage /> },
      { path: 'company-knowledge', element: <KnowledgePage /> },
      { path: 'settings', element: <SettingsPage /> },
    ],
  },
  {
    path: '/pos',
    element: <AuthGate><PosPage /></AuthGate>,
    errorElement: <RouteError />,
  },
  {
    path: '*',
    element: <Navigate to="/" replace />,
  },
]);
