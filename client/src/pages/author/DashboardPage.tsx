import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, getApiErrorMessage } from "../../lib/api";
import { Spinner } from "../../components/Spinner";
import type { Book, TicketSummary } from "../../types";

function formatCurrency(value: string | number) {
  return `Rs. ${Number(value).toLocaleString("en-IN")}`;
}

export function DashboardPage() {
  const [books, setBooks] = useState<Book[] | null>(null);
  const [tickets, setTickets] = useState<TicketSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([api.get<{ books: Book[] }>("/books"), api.get<{ tickets: TicketSummary[] }>("/tickets")])
      .then(([booksRes, ticketsRes]) => {
        setBooks(booksRes.data.books);
        setTickets(ticketsRes.data.tickets);
      })
      .catch((err) => setError(getApiErrorMessage(err)));
  }, []);

  if (error) return <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>;
  if (!books || !tickets) return <Spinner label="Loading dashboard..." />;

  const liveBooks = books.filter((b) => b.status === "Published & Live");
  const totalCopiesSold = books.reduce((sum, b) => sum + b.totalCopiesSold, 0);
  const totalRoyaltyEarned = books.reduce((sum, b) => sum + Number(b.totalRoyaltyEarned), 0);
  const totalPending = books.reduce((sum, b) => sum + Number(b.royaltyPending), 0);
  const openTickets = tickets.filter((t) => t.status === "OPEN" || t.status === "IN_PROGRESS");

  const stats = [
    { label: "Published books", value: liveBooks.length },
    { label: "Total copies sold", value: totalCopiesSold.toLocaleString("en-IN") },
    { label: "Royalty earned to date", value: formatCurrency(totalRoyaltyEarned) },
    { label: "Royalty pending", value: formatCurrency(totalPending) },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">Welcome back</h1>
        <p className="text-sm text-slate-500">Here's a snapshot of your BookLeaf account.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-lg border border-slate-200 bg-white p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{s.label}</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">Open support tickets</h2>
          <Link to="/tickets" className="text-xs font-medium text-slate-600 hover:text-slate-900">
            View all
          </Link>
        </div>
        {openTickets.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">No open tickets right now.</p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-100">
            {openTickets.slice(0, 5).map((t) => (
              <li key={t.id} className="flex items-center justify-between py-2 text-sm">
                <span className="text-slate-700">{t.subject}</span>
                <span className="text-xs text-slate-400">{t.status.replace("_", " ")}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
