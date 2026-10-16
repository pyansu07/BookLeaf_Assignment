import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/auth";
import { asyncHandler } from "../../middleware/errorHandler";
import { getBookById, listBooksForAuthor } from "./books.service";
import { Errors } from "../../lib/errors";

export const booksRouter = Router();

booksRouter.use(requireAuth, requireRole("AUTHOR"));

booksRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    if (!req.auth!.authorProfileId) throw Errors.forbidden();
    const books = await listBooksForAuthor(req.auth!.authorProfileId);
    res.json({ books });
  })
);

booksRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const book = await getBookById(req.params.id, req.auth!.authorProfileId);
    res.json({ book });
  })
);
