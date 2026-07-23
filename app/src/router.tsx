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

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    errorElement: <RouteError />,
    children: [
      { index: true, element: <Navigate to="/home" replace /> },
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
    element: <PosPage />,
    errorElement: <RouteError />,
  },
  {
    path: '*',
    element: <Navigate to="/home" replace />,
  },
]);
