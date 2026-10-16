import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import { Spinner } from "./components/Spinner";
import { LoginPage } from "./pages/LoginPage";
import { AuthorLayout } from "./pages/author/AuthorLayout";
import { DashboardPage } from "./pages/author/DashboardPage";
import { MyBooksPage } from "./pages/author/MyBooksPage";
import { SubmitTicketPage } from "./pages/author/SubmitTicketPage";
import { MyTicketsPage } from "./pages/author/MyTicketsPage";
import { AdminLayout } from "./pages/admin/AdminLayout";
import { TicketQueuePage } from "./pages/admin/TicketQueuePage";
import { AdminTicketDetailPage } from "./pages/admin/AdminTicketDetailPage";

function Protected({ role, children }: { role?: "AUTHOR" | "ADMIN"; children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <Spinner label="Loading session..." />;
  if (!user) return <Navigate to="/login" replace />;
  if (role && user.role !== role) {
    return <Navigate to={user.role === "ADMIN" ? "/admin" : "/"} replace />;
  }
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route
        path="/"
        element={
          <Protected role="AUTHOR">
            <AuthorLayout />
          </Protected>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="books" element={<MyBooksPage />} />
        <Route path="tickets/new" element={<SubmitTicketPage />} />
        <Route path="tickets" element={<MyTicketsPage />} />
      </Route>

      <Route
        path="/admin"
        element={
          <Protected role="ADMIN">
            <AdminLayout />
          </Protected>
        }
      >
        <Route index element={<TicketQueuePage />} />
        <Route path="tickets/:id" element={<AdminTicketDetailPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
