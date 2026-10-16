import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { api, getApiErrorMessage } from "../../lib/api";
import type { Book } from "../../types";

export function SubmitTicketPage() {
  const navigate = useNavigate();
  const [books, setBooks] = useState<Book[]>([]);
  const [bookId, setBookId] = useState<string>("");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.get<{ books: Book[] }>("/books").then((res) => setBooks(res.data.books));
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await api.post("/tickets", {
        bookId: bookId || null,
        subject,
        description,
      });
      navigate("/tickets");
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="text-lg font-semibold text-slate-900">Submit a Support Query</h1>
      <p className="mt-1 text-sm text-slate-500">
        Tell us what's going on and our team (with AI assistance) will get back to you.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4 rounded-lg border border-slate-200 bg-white p-5">
        <div>
          <label htmlFor="book" className="block text-sm font-medium text-slate-700">
            Which book is this about?
          </label>
          <select
            id="book"
            value={bookId}
            onChange={(e) => setBookId(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
          >
            <option value="">General / Account Level</option>
            {books.map((b) => (
              <option key={b.id} value={b.id}>
                {b.title}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="subject" className="block text-sm font-medium text-slate-700">
            Subject
          </label>
          <input
            id="subject"
            required
            minLength={3}
            maxLength={200}
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
            placeholder="e.g. Royalty pending for several months"
          />
        </div>

        <div>
          <label htmlFor="description" className="block text-sm font-medium text-slate-700">
            Describe your query
          </label>
          <textarea
            id="description"
            required
            minLength={10}
            maxLength={5000}
            rows={6}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
            placeholder="Please include any relevant details (dates, amounts, screenshots you plan to share, etc.)"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700">Attachment (optional)</label>
          <input
            type="file"
            disabled
            className="mt-1 w-full cursor-not-allowed rounded-md border border-dashed border-slate-300 px-3 py-2 text-sm text-slate-400"
          />
          <p className="mt-1 text-xs text-slate-400">File upload UI only - not wired up in this build.</p>
        </div>

        {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
        >
          {submitting ? "Submitting..." : "Submit query"}
        </button>
      </form>
    </div>
  );
}
