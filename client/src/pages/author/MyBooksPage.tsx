import { useEffect, useState } from "react";
import { api, getApiErrorMessage } from "../../lib/api";
import { Spinner, EmptyState } from "../../components/Spinner";
import type { Book } from "../../types";

function formatCurrency(value: string | number | null) {
  if (value === null) return "-";
  return `Rs. ${Number(value).toLocaleString("en-IN")}`;
}

function formatDate(value: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("en-IN", { year: "numeric", month: "short", day: "numeric" });
}

export function MyBooksPage() {
  const [books, setBooks] = useState<Book[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<{ books: Book[] }>("/books")
      .then((res) => setBooks(res.data.books))
      .catch((err) => setError(getApiErrorMessage(err)));
  }, []);

  if (error) return <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>;
  if (!books) return <Spinner label="Loading your books..." />;
  if (books.length === 0) {
    return <EmptyState title="No books yet" description="Books you publish with BookLeaf will show up here." />;
  }

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold text-slate-900">My Books</h1>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {books.map((book) => {
          const inProduction = book.status !== "Published & Live";
          return (
            <div key={book.id} className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">{book.title}</h2>
                  <p className="text-xs text-slate-500">{book.genre}</p>
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    inProduction ? "bg-amber-100 text-amber-800" : "bg-green-100 text-green-800"
                  }`}
                >
                  {book.status}
                </span>
              </div>

              <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <div>
                  <dt className="text-xs text-slate-400">ISBN</dt>
                  <dd className="text-slate-700">{book.isbn}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-400">Publication date</dt>
                  <dd className="text-slate-700">{formatDate(book.publicationDate)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-400">MRP</dt>
                  <dd className="text-slate-700">{formatCurrency(book.mrp)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-400">Copies sold</dt>
                  <dd className="text-slate-700">{book.totalCopiesSold.toLocaleString("en-IN")}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-400">Royalty earned</dt>
                  <dd className="text-slate-700">{formatCurrency(book.totalRoyaltyEarned)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-400">Royalty paid</dt>
                  <dd className="text-slate-700">{formatCurrency(book.royaltyPaid)}</dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-xs text-slate-400">Royalty pending</dt>
                  <dd className={`font-medium ${Number(book.royaltyPending) > 0 ? "text-amber-700" : "text-slate-700"}`}>
                    {formatCurrency(book.royaltyPending)}
                  </dd>
                </div>
              </dl>

              {book.availableOn.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1">
                  {book.availableOn.map((platform) => (
                    <span key={platform} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                      {platform}
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
