import { useCallback, useEffect, useState } from "react";
import { api, getApiErrorMessage } from "../../lib/api";
import { getSocket } from "../../lib/socket";
import { Spinner, EmptyState } from "../../components/Spinner";
import { PriorityBadge, StatusBadge } from "../../components/Badge";
import { CATEGORY_LABELS, type TicketDetail, type TicketSummary } from "../../types";

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

export function MyTicketsPage() {
  const [tickets, setTickets] = useState<TicketSummary[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<TicketDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadTickets = useCallback(() => {
    api
      .get<{ tickets: TicketSummary[] }>("/tickets")
      .then((res) => {
        setTickets(res.data.tickets);
        setSelectedId((current) => current ?? res.data.tickets[0]?.id ?? null);
      })
      .catch((err) => setError(getApiErrorMessage(err)));
  }, []);

  const loadDetail = useCallback((id: string) => {
    api.get<{ ticket: TicketDetail }>(`/tickets/${id}`).then((res) => setDetail(res.data.ticket));
  }, []);

  useEffect(() => {
    loadTickets();
  }, [loadTickets]);

  useEffect(() => {
    if (selectedId) loadDetail(selectedId);
  }, [selectedId, loadDetail]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const onUpdate = () => {
      loadTickets();
      if (selectedId) loadDetail(selectedId);
    };
    socket.on("ticket:reply", onUpdate);
    socket.on("ticket:updated", onUpdate);
    return () => {
      socket.off("ticket:reply", onUpdate);
      socket.off("ticket:updated", onUpdate);
    };
  }, [selectedId, loadTickets, loadDetail]);

  if (error) return <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>;
  if (!tickets) return <Spinner label="Loading your tickets..." />;
  if (tickets.length === 0) {
    return <EmptyState title="No tickets yet" description="Submit a support query and it will show up here." />;
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[320px_1fr]">
      <div className="space-y-2">
        <h1 className="text-lg font-semibold text-slate-900">My Tickets</h1>
        <div className="divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200 bg-white">
          {tickets.map((t) => (
            <button
              key={t.id}
              onClick={() => setSelectedId(t.id)}
              className={`block w-full px-4 py-3 text-left hover:bg-slate-50 ${selectedId === t.id ? "bg-slate-50" : ""}`}
            >
              <p className="text-sm font-medium text-slate-900">{t.subject}</p>
              <div className="mt-1 flex items-center gap-2">
                <StatusBadge status={t.status} />
                <span className="text-xs text-slate-400">{formatDateTime(t.createdAt)}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div>
        {!detail ? (
          <Spinner label="Loading ticket..." />
        ) : (
          <div className="rounded-lg border border-slate-200 bg-white p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-base font-semibold text-slate-900">{detail.subject}</h2>
              <div className="flex gap-2">
                <StatusBadge status={detail.status} />
                <PriorityBadge priority={detail.priority} />
              </div>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              {CATEGORY_LABELS[detail.category]} &middot; {detail.book ? detail.book.title : "General / Account Level"}
            </p>

            <div className="mt-4 rounded-md bg-slate-50 p-3">
              <p className="text-xs font-medium text-slate-500">Your original query</p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{detail.description}</p>
              <p className="mt-2 text-xs text-slate-400">{formatDateTime(detail.createdAt)}</p>
            </div>

            <div className="mt-4 space-y-3">
              <p className="text-xs font-medium text-slate-500">Responses</p>
              {detail.replies.length === 0 ? (
                <p className="text-sm text-slate-400">No responses yet. We'll notify you here when the team replies.</p>
              ) : (
                detail.replies.map((r) => (
                  <div key={r.id} className="rounded-md border border-slate-200 p-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-medium text-slate-600">BookLeaf Support</p>
                      <p className="text-xs text-slate-400">{formatDateTime(r.createdAt)}</p>
                    </div>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{r.body}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
