import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

export function AdminLayout() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-slate-900">BookLeaf Publishing</p>
            <p className="text-xs text-slate-500">Operations Console</p>
          </div>
          <div className="flex items-center gap-4">
            <NavLink to="/admin" end className={({ isActive }) => `text-sm font-medium ${isActive ? "text-slate-900" : "text-slate-500 hover:text-slate-800"}`}>
              Ticket Queue
            </NavLink>
            <span className="text-sm text-slate-600">{user?.name}</span>
            <button onClick={logout} className="text-sm font-medium text-slate-500 hover:text-slate-900">
              Log out
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
