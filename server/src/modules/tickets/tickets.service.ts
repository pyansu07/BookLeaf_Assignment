import { TicketCategory, TicketPriority } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { Errors } from "../../lib/errors";
import { emitTicketEvent } from "../../realtime";
import { classifyAndPrioritize, draftResponse } from "../ai/ai.service";
import type { AddReplyInput, CreateTicketInput, ListTicketsQuery, UpdateTicketInput } from "./tickets.schema";

const ticketListInclude = {
  book: { select: { id: true, title: true, isbn: true } },
  authorProfile: { select: { id: true, authorCode: true, user: { select: { name: true, email: true } } } },
  assignedAdmin: { select: { id: true, name: true } },
  _count: { select: { replies: true } },
} as const;

const ticketDetailInclude = {
  book: true,
  authorProfile: { include: { user: { select: { name: true, email: true } } } },
  assignedAdmin: { select: { id: true, name: true } },
  replies: { orderBy: { createdAt: "asc" as const }, include: { author: { select: { id: true, name: true, role: true } } } },
};

export async function createTicket(authorProfileId: string, input: CreateTicketInput) {
  let book = null;
  if (input.bookId) {
    book = await prisma.book.findUnique({ where: { id: input.bookId } });
    if (!book || book.authorProfileId !== authorProfileId) {
      throw Errors.badRequest("Selected book does not belong to this author");
    }
  }

  const ai = await classifyAndPrioritize({
    subject: input.subject,
    description: input.description,
    bookTitle: book?.title,
    bookStatus: book?.status,
  });

  const category = ai?.category ?? TicketCategory.GENERAL_INQUIRY;
  const priority = ai?.priority ?? TicketPriority.MEDIUM;

  const ticket = await prisma.ticket.create({
    data: {
      authorProfileId,
      bookId: input.bookId ?? null,
      subject: input.subject,
      description: input.description,
      category,
      aiSuggestedCategory: ai?.category,
      priority,
      aiSuggestedPriority: ai?.priority,
    },
    include: ticketListInclude,
  });

  emitTicketEvent(authorProfileId, "ticket:created", { ticketId: ticket.id });
  return ticket;
}

export async function listTicketsForAuthor(authorProfileId: string) {
  return prisma.ticket.findMany({
    where: { authorProfileId },
    include: ticketListInclude,
    orderBy: { createdAt: "desc" },
  });
}

export async function listTicketsForAdmin(query: ListTicketsQuery, adminUserId: string) {
  return prisma.ticket.findMany({
    where: {
      status: query.status,
      category: query.category,
      priority: query.priority,
      assignedAdminId: query.assignedToMe ? adminUserId : undefined,
      createdAt:
        query.from || query.to
          ? { gte: query.from, lte: query.to }
          : undefined,
    },
    include: ticketListInclude,
    orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
  });
}

interface AccessContext {
  isAdmin: boolean;
  authorProfileId?: string;
}

export async function getTicketById(ticketId: string, access: AccessContext) {
  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId }, include: ticketDetailInclude });
  if (!ticket) throw Errors.notFound("Ticket not found");
  if (!access.isAdmin && ticket.authorProfileId !== access.authorProfileId) {
    throw Errors.forbidden("You do not have access to this ticket");
  }

  if (!access.isAdmin) {
    return { ...ticket, replies: ticket.replies.filter((r) => !r.isInternalNote) };
  }
  return ticket;
}

export async function updateTicket(ticketId: string, adminUserId: string, input: UpdateTicketInput) {
  const existing = await prisma.ticket.findUnique({ where: { id: ticketId } });
  if (!existing) throw Errors.notFound("Ticket not found");

  const ticket = await prisma.ticket.update({
    where: { id: ticketId },
    data: {
      status: input.status,
      category: input.category,
      categoryOverridden: input.category && input.category !== existing.category ? true : undefined,
      priority: input.priority,
      priorityOverridden: input.priority && input.priority !== existing.priority ? true : undefined,
      assignedAdminId: input.assignToSelf ? adminUserId : undefined,
    },
    include: ticketListInclude,
  });

  emitTicketEvent(ticket.authorProfileId, "ticket:updated", { ticketId: ticket.id });
  return ticket;
}

export async function addReply(
  ticketId: string,
  userId: string,
  role: "AUTHOR" | "ADMIN",
  authorProfileId: string | undefined,
  input: AddReplyInput
) {
  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
  if (!ticket) throw Errors.notFound("Ticket not found");

  if (role === "AUTHOR" && ticket.authorProfileId !== authorProfileId) {
    throw Errors.forbidden("You do not have access to this ticket");
  }

  const isInternalNote = role === "ADMIN" && input.isInternalNote;
  if (role === "AUTHOR" && input.isInternalNote) {
    throw Errors.forbidden("Authors cannot add internal notes");
  }

  const [reply] = await prisma.$transaction([
    prisma.ticketReply.create({
      data: { ticketId, authorUserId: userId, body: input.body, isInternalNote },
      include: { author: { select: { id: true, name: true, role: true } } },
    }),
    prisma.ticket.update({
      where: { id: ticketId },
      data: role === "ADMIN" && !isInternalNote ? { status: "IN_PROGRESS" } : {},
    }),
  ]);

  if (!isInternalNote) {
    emitTicketEvent(ticket.authorProfileId, "ticket:reply", { ticketId, reply });
  }

  return reply;
}

export async function getAiDraft(ticketId: string) {
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    include: { book: true, authorProfile: { include: { user: true } } },
  });
  if (!ticket) throw Errors.notFound("Ticket not found");

  const draft = await draftResponse({
    subject: ticket.subject,
    description: ticket.description,
    bookTitle: ticket.book?.title,
    bookStatus: ticket.book?.status,
    category: ticket.category,
    authorName: ticket.authorProfile.user.name,
    royaltyPending: ticket.book ? Number(ticket.book.royaltyPending) : null,
  });

  return { draft };
}
