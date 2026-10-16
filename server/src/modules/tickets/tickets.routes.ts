import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/auth";
import { asyncHandler } from "../../middleware/errorHandler";
import { Errors } from "../../lib/errors";
import {
  addReplySchema,
  createTicketSchema,
  listTicketsQuerySchema,
  updateTicketSchema,
} from "./tickets.schema";
import {
  addReply,
  createTicket,
  getAiDraft,
  getTicketById,
  listTicketsForAdmin,
  listTicketsForAuthor,
  updateTicket,
} from "./tickets.service";

export const ticketsRouter = Router();

ticketsRouter.use(requireAuth);

ticketsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    if (req.auth!.role === "ADMIN") {
      const query = listTicketsQuerySchema.parse(req.query);
      const tickets = await listTicketsForAdmin(query, req.auth!.userId);
      res.json({ tickets });
      return;
    }
    if (!req.auth!.authorProfileId) throw Errors.forbidden();
    const tickets = await listTicketsForAuthor(req.auth!.authorProfileId);
    res.json({ tickets });
  })
);

ticketsRouter.post(
  "/",
  requireRole("AUTHOR"),
  asyncHandler(async (req, res) => {
    if (!req.auth!.authorProfileId) throw Errors.forbidden();
    const input = createTicketSchema.parse(req.body);
    const ticket = await createTicket(req.auth!.authorProfileId, input);
    res.status(201).json({ ticket });
  })
);

ticketsRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const ticket = await getTicketById(req.params.id, {
      isAdmin: req.auth!.role === "ADMIN",
      authorProfileId: req.auth!.authorProfileId,
    });
    res.json({ ticket });
  })
);

ticketsRouter.patch(
  "/:id",
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const input = updateTicketSchema.parse(req.body);
    const ticket = await updateTicket(req.params.id, req.auth!.userId, input);
    res.json({ ticket });
  })
);

ticketsRouter.post(
  "/:id/replies",
  asyncHandler(async (req, res) => {
    const input = addReplySchema.parse(req.body);
    const reply = await addReply(req.params.id, req.auth!.userId, req.auth!.role, req.auth!.authorProfileId, input);
    res.status(201).json({ reply });
  })
);

ticketsRouter.get(
  "/:id/ai-draft",
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const result = await getAiDraft(req.params.id);
    res.json(result);
  })
);
