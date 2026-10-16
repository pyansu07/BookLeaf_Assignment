import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

const navItems = [
  { to: "/", label: "Dashboard", end: true },
  { to: "/books", label: "My Books" },
  { to: "/tickets", label: "My Tickets" },
  { to: "/tickets/new", label: "Submit a Query" },
];

export function AuthorLayout() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-slate-900">BookLeaf Publishing</p>
            <p className="text-xs text-slate-500">Author Portal</p>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-600">{user?.name}</span>
            <button onClick={logout} className="text-sm font-medium text-slate-500 hover:text-slate-900">
              Log out
            </button>
          </div>
        </div>
        <nav className="mx-auto flex max-w-5xl gap-1 px-4">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `border-b-2 px-3 py-2 text-sm font-medium ${
                  isActive ? "border-slate-900 text-slate-900" : "border-transparent text-slate-500 hover:text-slate-800"
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
