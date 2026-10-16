import { z } from "zod";
import { TicketCategory, TicketPriority, TicketStatus } from "@prisma/client";

export const createTicketSchema = z.object({
  bookId: z.string().cuid().nullable().optional(),
  subject: z.string().trim().min(3).max(200),
  description: z.string().trim().min(10).max(5000),
});

export const listTicketsQuerySchema = z.object({
  status: z.nativeEnum(TicketStatus).optional(),
  category: z.nativeEnum(TicketCategory).optional(),
  priority: z.nativeEnum(TicketPriority).optional(),
  assignedToMe: z.coerce.boolean().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export const updateTicketSchema = z
  .object({
    status: z.nativeEnum(TicketStatus).optional(),
    category: z.nativeEnum(TicketCategory).optional(),
    priority: z.nativeEnum(TicketPriority).optional(),
    assignToSelf: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "Provide at least one field to update" });

export const addReplySchema = z.object({
  body: z.string().trim().min(1).max(5000),
  isInternalNote: z.boolean().default(false),
});

export type CreateTicketInput = z.infer<typeof createTicketSchema>;
export type ListTicketsQuery = z.infer<typeof listTicketsQuerySchema>;
export type UpdateTicketInput = z.infer<typeof updateTicketSchema>;
export type AddReplyInput = z.infer<typeof addReplySchema>;
