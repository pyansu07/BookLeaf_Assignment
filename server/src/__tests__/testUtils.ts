import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma";
import { signToken } from "../lib/jwt";

let counter = 0;

export async function createTestAdmin() {
  counter += 1;
  const user = await prisma.user.create({
    data: {
      email: `test-admin-${Date.now()}-${counter}@example.com`,
      name: "Test Admin",
      role: "ADMIN",
      passwordHash: await bcrypt.hash("password123", 4),
    },
  });
  const token = signToken({ userId: user.id, role: "ADMIN" });
  return { user, token };
}

export async function createTestAuthor(withBook = true) {
  counter += 1;
  const user = await prisma.user.create({
    data: {
      email: `test-author-${Date.now()}-${counter}@example.com`,
      name: "Test Author",
      role: "AUTHOR",
      passwordHash: await bcrypt.hash("password123", 4),
    },
  });
  const profile = await prisma.authorProfile.create({
    data: { authorCode: `TEST${Date.now()}${counter}`, userId: user.id, city: "Test City" },
  });

  let book = null;
  if (withBook) {
    book = await prisma.book.create({
      data: {
        bookCode: `TESTBK${Date.now()}${counter}`,
        authorProfileId: profile.id,
        title: "Test Book",
        isbn: "000-0-000-00000-0",
        genre: "Fiction",
        status: "Published & Live",
        mrp: 300,
        authorRoyaltyPerCopy: 25,
        totalCopiesSold: 10,
        totalRoyaltyEarned: 250,
        royaltyPaid: 100,
        royaltyPending: 150,
      },
    });
  }

  const token = signToken({ userId: user.id, role: "AUTHOR", authorProfileId: profile.id });
  return { user, profile, book, token };
}

export async function cleanupTestData(userIds: string[]) {
  await prisma.ticket.updateMany({
    where: { assignedAdminId: { in: userIds } },
    data: { assignedAdminId: null },
  });
  // TicketReply.authorUserId has no cascade from User, so admin-authored
  // replies must be removed before the admin user row can be deleted.
  await prisma.ticketReply.deleteMany({ where: { authorUserId: { in: userIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
}
