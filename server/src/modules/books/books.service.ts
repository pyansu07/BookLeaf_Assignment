import { prisma } from "../../lib/prisma";
import { Errors } from "../../lib/errors";

export async function listBooksForAuthor(authorProfileId: string) {
  return prisma.book.findMany({
    where: { authorProfileId },
    orderBy: { publicationDate: "desc" },
  });
}

export async function getBookById(bookId: string, authorProfileId?: string) {
  const book = await prisma.book.findUnique({ where: { id: bookId } });
  if (!book) throw Errors.notFound("Book not found");
  if (authorProfileId && book.authorProfileId !== authorProfileId) {
    throw Errors.forbidden("You do not have access to this book");
  }
  return book;
}
