import { createBrowserRouter, Navigate } from "react-router";
import { GuestOnly, RequireAdmin, RequireAuth } from "./components/SessionGate";
import { AuthLayout } from "./layouts/AuthLayout";
import { AppLayout } from "./layouts/AppLayout";
import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";
import { DashboardPage } from "./pages/DashboardPage";
import { SuppliersPage } from "./pages/suppliers/SuppliersPage";
import { TaxesPage } from "./pages/taxes/TaxesPage";
import { BoletosPage } from "./pages/boletos/BoletosPage";
import { UsersPage } from "./pages/users/UsersPage";

export const router = createBrowserRouter([
  {
    element: <GuestOnly />,
    children: [
      {
        element: <AuthLayout />,
        children: [
          { path: "/login", element: <LoginPage /> },
          { path: "/cadastro", element: <RegisterPage /> },
        ],
      },
    ],
  },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { index: true, element: <DashboardPage /> },
          { path: "/impostos", element: <TaxesPage /> },
          { path: "/boletos", element: <BoletosPage /> },
          { path: "/fornecedores", element: <SuppliersPage /> },
          { element: <RequireAdmin />, children: [{ path: "/usuarios", element: <UsersPage /> }] },
        ],
      },
    ],
  },
  { path: "*", element: <Navigate to="/" replace /> },
]);
