import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api, getApiErrorMessage } from "../../lib/api";
import { getSocket } from "../../lib/socket";
import { Spinner } from "../../components/Spinner";
import { PriorityBadge, StatusBadge } from "../../components/Badge";
import {
  CATEGORY_LABELS,
  type TicketCategory,
  type TicketDetail,
  type TicketPriority,
  type TicketStatus,
} from "../../types";

const STATUS_OPTIONS: TicketStatus[] = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"];
const PRIORITY_OPTIONS: TicketPriority[] = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];
const CATEGORY_OPTIONS = Object.keys(CATEGORY_LABELS) as TicketCategory[];

function formatCurrency(value: string | number | null) {
  if (value === null) return "-";
  return `Rs. ${Number(value).toLocaleString("en-IN")}`;
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

export function AdminTicketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [replyBody, setReplyBody] = useState("");
  const [noteBody, setNoteBody] = useState("");
  const [sending, setSending] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [draftError, setDraftError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!id) return;
    api
      .get<{ ticket: TicketDetail }>(`/tickets/${id}`)
      .then((res) => setTicket(res.data.ticket))
      .catch((err) => setError(getApiErrorMessage(err)));
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    socket.on("ticket:reply", load);
    socket.on("ticket:updated", load);
    return () => {
      socket.off("ticket:reply", load);
      socket.off("ticket:updated", load);
    };
  }, [load]);

  async function patchTicket(payload: Record<string, unknown>) {
    if (!id) return;
    try {
      const res = await api.patch<{ ticket: TicketDetail }>(`/tickets/${id}`, payload);
      setTicket((prev) => (prev ? { ...prev, ...res.data.ticket } : prev));
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  }

  async function handleGetDraft() {
    if (!id) return;
    setDrafting(true);
    setDraftError(null);
    try {
      const res = await api.get<{ draft: string | null }>(`/tickets/${id}/ai-draft`);
      if (res.data.draft) {
        setReplyBody(res.data.draft);
      } else {
        setDraftError("AI draft is unavailable right now (provider not configured or request failed). Please write a response manually.");
      }
    } catch (err) {
      setDraftError(getApiErrorMessage(err));
    } finally {
      setDrafting(false);
    }
  }

  async function handleSendReply() {
    if (!id || !replyBody.trim()) return;
    setSending(true);
    try {
      await api.post(`/tickets/${id}/replies`, { body: replyBody, isInternalNote: false });
      setReplyBody("");
      load();
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setSending(false);
    }
  }

  async function handleAddNote() {
    if (!id || !noteBody.trim()) return;
    setSending(true);
    try {
      await api.post(`/tickets/${id}/replies`, { body: noteBody, isInternalNote: true });
      setNoteBody("");
      load();
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setSending(false);
    }
  }

  if (error && !ticket) return <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>;
  if (!ticket) return <Spinner label="Loading ticket..." />;

  const publicReplies = ticket.replies.filter((r) => !r.isInternalNote);
  const internalNotes = ticket.replies.filter((r) => r.isInternalNote);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
      <div className="space-y-4">
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h1 className="text-base font-semibold text-slate-900">{ticket.subject}</h1>
            <div className="flex gap-2">
              <StatusBadge status={ticket.status} />
              <PriorityBadge priority={ticket.priority} />
            </div>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            {ticket.authorProfile.user.name} ({ticket.authorProfile.user.email}) &middot;{" "}
            {ticket.book ? ticket.book.title : "General / Account Level"}
          </p>
          {ticket.aiSuggestedCategory && (
            <p className="mt-1 text-xs text-slate-400">
              AI suggested: {CATEGORY_LABELS[ticket.aiSuggestedCategory]} / {ticket.aiSuggestedPriority}
              {(ticket.categoryOverridden || ticket.priorityOverridden) && " (overridden by admin)"}
            </p>
          )}

          <div className="mt-4 rounded-md bg-slate-50 p-3">
            <p className="whitespace-pre-wrap text-sm text-slate-700">{ticket.description}</p>
            <p className="mt-2 text-xs text-slate-400">Submitted {formatDateTime(ticket.createdAt)}</p>
          </div>

          {ticket.book && (
            <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 rounded-md border border-slate-200 p-3 text-xs sm:grid-cols-4">
              <div>
                <p className="text-slate-400">ISBN</p>
                <p className="text-slate-700">{ticket.book.isbn}</p>
              </div>
              <div>
                <p className="text-slate-400">Status</p>
                <p className="text-slate-700">{ticket.book.status}</p>
              </div>
              <div>
                <p className="text-slate-400">Royalty pending</p>
                <p className="text-slate-700">{formatCurrency(ticket.book.royaltyPending)}</p>
              </div>
              <div>
                <p className="text-slate-400">Last payout</p>
                <p className="text-slate-700">{ticket.book.lastRoyaltyPayoutDate ? formatDateTime(ticket.book.lastRoyaltyPayoutDate) : "-"}</p>
              </div>
            </div>
          )}
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-slate-900">Conversation</h2>
          <div className="mt-3 space-y-3">
            {publicReplies.length === 0 && <p className="text-sm text-slate-400">No responses sent yet.</p>}
            {publicReplies.map((r) => (
              <div key={r.id} className="rounded-md border border-slate-200 p-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-slate-600">{r.author.name} (BookLeaf)</p>
                  <p className="text-xs text-slate-400">{formatDateTime(r.createdAt)}</p>
                </div>
                <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{r.body}</p>
              </div>
            ))}
          </div>

          <div className="mt-4 space-y-2 border-t border-slate-100 pt-4">
            <div className="flex items-center justify-between">
              <label htmlFor="reply" className="text-xs font-medium text-slate-600">
                Write a response
              </label>
              <button
                type="button"
                onClick={handleGetDraft}
                disabled={drafting}
                className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-60"
              >
                {drafting ? "Drafting..." : "Generate AI draft"}
              </button>
            </div>
            {draftError && <p className="rounded-md bg-amber-50 px-2 py-1.5 text-xs text-amber-800">{draftError}</p>}
            <textarea
              id="reply"
              rows={5}
              value={replyBody}
              onChange={(e) => setReplyBody(e.target.value)}
              placeholder="Write or generate a response for the author..."
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
            />
            <button
              onClick={handleSendReply}
              disabled={sending || !replyBody.trim()}
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
            >
              Send response
            </button>
          </div>
        </div>

        <div className="rounded-lg border border-amber-200 bg-amber-50 p-5">
          <h2 className="text-sm font-semibold text-amber-900">Internal notes (private - never shown to the author)</h2>
          <div className="mt-3 space-y-2">
            {internalNotes.length === 0 && <p className="text-sm text-amber-700">No internal notes yet.</p>}
            {internalNotes.map((n) => (
              <div key={n.id} className="rounded-md border border-amber-200 bg-white p-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-amber-800">{n.author.name}</p>
                  <p className="text-xs text-amber-500">{formatDateTime(n.createdAt)}</p>
                </div>
                <p className="mt-1 whitespace-pre-wrap text-sm text-amber-900">{n.body}</p>
              </div>
            ))}
          </div>
          <div className="mt-3 space-y-2">
            <textarea
              rows={3}
              value={noteBody}
              onChange={(e) => setNoteBody(e.target.value)}
              placeholder="Add a note for the team (not visible to the author)..."
              className="w-full rounded-md border border-amber-300 bg-white px-3 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
            <button
              onClick={handleAddNote}
              disabled={sending || !noteBody.trim()}
              className="rounded-md bg-amber-700 px-4 py-2 text-sm font-medium text-white hover:bg-amber-800 disabled:opacity-60"
            >
              Add internal note
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-slate-900">Manage ticket</h2>
          <div className="mt-3 space-y-3 text-sm">
            <div>
              <label className="block text-xs font-medium text-slate-500">Status</label>
              <select
                value={ticket.status}
                onChange={(e) => patchTicket({ status: e.target.value })}
                className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5"
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s.replace("_", " ")}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500">Category</label>
              <select
                value={ticket.category}
                onChange={(e) => patchTicket({ category: e.target.value })}
                className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5"
              >
                {CATEGORY_OPTIONS.map((c) => (
                  <option key={c} value={c}>
                    {CATEGORY_LABELS[c]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500">Priority</label>
              <select
                value={ticket.priority}
                onChange={(e) => patchTicket({ priority: e.target.value })}
                className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5"
              >
                {PRIORITY_OPTIONS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500">Assigned to</label>
              <p className="mt-1 text-sm text-slate-700">{ticket.assignedAdmin?.name ?? "Unassigned"}</p>
              <button
                onClick={() => patchTicket({ assignToSelf: true })}
                className="mt-2 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Assign to me
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
