import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, getApiErrorMessage } from "../../lib/api";
import { getSocket } from "../../lib/socket";
import { Spinner, EmptyState } from "../../components/Spinner";
import { PriorityBadge, StatusBadge } from "../../components/Badge";
import { CATEGORY_LABELS, type TicketCategory, type TicketPriority, type TicketStatus, type TicketSummary } from "../../types";

const STATUS_OPTIONS: TicketStatus[] = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"];
const PRIORITY_OPTIONS: TicketPriority[] = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];
const CATEGORY_OPTIONS = Object.keys(CATEGORY_LABELS) as TicketCategory[];

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

// Matches the KB's "get back to you within 48 hours" escalation promise.
const OVERDUE_HOURS = 48;

function isUnresolved(status: TicketStatus) {
  return status === "OPEN" || status === "IN_PROGRESS";
}

function ageInHours(createdAt: string) {
  return (Date.now() - new Date(createdAt).getTime()) / 36e5;
}

function formatAge(hours: number) {
  if (hours < 1) return "<1h";
  if (hours < 24) return `${Math.floor(hours)}h`;
  return `${Math.floor(hours / 24)}d`;
}

export function TicketQueuePage() {
  const [tickets, setTickets] = useState<TicketSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [category, setCategory] = useState("");
  const [priority, setPriority] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const loadTickets = useCallback(() => {
    const params: Record<string, string> = {};
    if (status) params.status = status;
    if (category) params.category = category;
    if (priority) params.priority = priority;
    if (from) params.from = new Date(from).toISOString();
    if (to) params.to = new Date(`${to}T23:59:59.999`).toISOString();
    api
      .get<{ tickets: TicketSummary[] }>("/tickets", { params })
      .then((res) => setTickets(res.data.tickets))
      .catch((err) => setError(getApiErrorMessage(err)));
  }, [status, category, priority, from, to]);

  useEffect(() => {
    loadTickets();
  }, [loadTickets]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    socket.on("ticket:created", loadTickets);
    socket.on("ticket:updated", loadTickets);
    socket.on("ticket:reply", loadTickets);
    return () => {
      socket.off("ticket:created", loadTickets);
      socket.off("ticket:updated", loadTickets);
      socket.off("ticket:reply", loadTickets);
    };
  }, [loadTickets]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-lg font-semibold text-slate-900">Ticket Queue</h1>
        {tickets && (
          <p className="text-sm text-slate-500">
            {tickets.filter((t) => isUnresolved(t.status)).length} unresolved &middot;{" "}
            {tickets.filter((t) => isUnresolved(t.status) && (t.priority === "CRITICAL" || t.priority === "HIGH")).length}{" "}
            critical/high &middot;{" "}
            {tickets.filter((t) => isUnresolved(t.status) && ageInHours(t.createdAt) > OVERDUE_HOURS).length} over{" "}
            {OVERDUE_HOURS}h
          </p>
        )}
      </div>
      <p className="text-xs text-slate-400">Sorted unresolved first, then by priority, then oldest first.</p>

      <div className="flex flex-wrap gap-3 rounded-lg border border-slate-200 bg-white p-3">
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-md border border-slate-300 px-2 py-1.5 text-sm">
          <option value="">All statuses</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s.replace("_", " ")}
            </option>
          ))}
        </select>
        <select value={category} onChange={(e) => setCategory(e.target.value)} className="rounded-md border border-slate-300 px-2 py-1.5 text-sm">
          <option value="">All categories</option>
          {CATEGORY_OPTIONS.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABELS[c]}
            </option>
          ))}
        </select>
        <select value={priority} onChange={(e) => setPriority(e.target.value)} className="rounded-md border border-slate-300 px-2 py-1.5 text-sm">
          <option value="">All priorities</option>
          {PRIORITY_OPTIONS.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <div className="flex items-center gap-1 text-sm text-slate-500">
          <label htmlFor="from">From</label>
          <input
            id="from"
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          />
        </div>
        <div className="flex items-center gap-1 text-sm text-slate-500">
          <label htmlFor="to">To</label>
          <input
            id="to"
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          />
        </div>
        {(status || category || priority || from || to) && (
          <button
            onClick={() => {
              setStatus("");
              setCategory("");
              setPriority("");
              setFrom("");
              setTo("");
            }}
            className="text-sm text-slate-500 hover:text-slate-900"
          >
            Clear filters
          </button>
        )}
      </div>

      {error && <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      {!tickets ? (
        <Spinner label="Loading tickets..." />
      ) : tickets.length === 0 ? (
        <EmptyState title="No tickets match these filters" />
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">Subject</th>
                <th className="px-4 py-2 font-medium">Author</th>
                <th className="px-4 py-2 font-medium">Category</th>
                <th className="px-4 py-2 font-medium">Priority</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium">Assigned</th>
                <th className="px-4 py-2 font-medium">Age</th>
                <th className="px-4 py-2 font-medium">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tickets.map((t) => {
                const unresolved = isUnresolved(t.status);
                const hours = ageInHours(t.createdAt);
                const overdue = unresolved && hours > OVERDUE_HOURS;
                return (
                <tr key={t.id} className={`hover:bg-slate-50 ${unresolved ? "" : "text-slate-400 opacity-70"}`}>
                  <td className="px-4 py-2">
                    <Link to={`/admin/tickets/${t.id}`} className="font-medium text-slate-900 hover:underline">
                      {t.subject}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-slate-600">{t.authorProfile.user.name}</td>
                  <td className="px-4 py-2 text-slate-600">{CATEGORY_LABELS[t.category]}</td>
                  <td className="px-4 py-2">
                    <PriorityBadge priority={t.priority} />
                  </td>
                  <td className="px-4 py-2">
                    <StatusBadge status={t.status} />
                  </td>
                  <td className="px-4 py-2 text-slate-600">{t.assignedAdmin?.name ?? "-"}</td>
                  <td className="px-4 py-2">
                    <span
                      className={overdue ? "font-semibold text-red-700" : "text-slate-500"}
                      title={overdue ? `Unresolved for more than ${OVERDUE_HOURS} hours` : undefined}
                    >
                      {formatAge(hours)}
                      {overdue && " overdue"}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-slate-500">{formatDateTime(t.createdAt)}</td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
