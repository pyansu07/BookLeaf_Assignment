import "dotenv/config";
import fs from "fs";
import path from "path";
import { PrismaClient, TicketCategory, TicketPriority, TicketStatus } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const DEMO_AUTHOR_PASSWORD = "Author@123";
const DEMO_ADMIN_PASSWORD = "Admin@123";

interface SeedBook {
  book_id: string;
  title: string;
  isbn: string;
  genre: string;
  publication_date: string | null;
  status: string;
  mrp: number | null;
  author_royalty_per_copy: number | null;
  total_copies_sold: number;
  total_royalty_earned: number;
  royalty_paid: number;
  royalty_pending: number;
  last_royalty_payout_date: string | null;
  print_partner: string | null;
  available_on: string[];
}

interface SeedAuthor {
  author_id: string;
  name: string;
  email: string;
  phone: string;
  city: string;
  joined_date: string;
  books: SeedBook[];
}

async function main() {
  const dataPath = path.join(__dirname, "data", "bookleaf_sample_data.json");
  const raw = fs.readFileSync(dataPath, "utf-8");
  const { authors } = JSON.parse(raw) as { authors: SeedAuthor[] };

  console.log(`Seeding ${authors.length} authors...`);

  const authorPasswordHash = await bcrypt.hash(DEMO_AUTHOR_PASSWORD, 10);
  const adminPasswordHash = await bcrypt.hash(DEMO_ADMIN_PASSWORD, 10);

  await prisma.ticketReply.deleteMany();
  await prisma.ticket.deleteMany();
  await prisma.book.deleteMany();
  await prisma.authorProfile.deleteMany();
  await prisma.user.deleteMany();

  const admin = await prisma.user.create({
    data: {
      email: "admin@bookleaf.com",
      name: "BookLeaf Operations",
      role: "ADMIN",
      passwordHash: adminPasswordHash,
    },
  });

  for (const author of authors) {
    const user = await prisma.user.create({
      data: {
        email: author.email.toLowerCase(),
        name: author.name,
        role: "AUTHOR",
        passwordHash: authorPasswordHash,
      },
    });

    const profile = await prisma.authorProfile.create({
      data: {
        authorCode: author.author_id,
        userId: user.id,
        phone: author.phone,
        city: author.city,
        joinedDate: new Date(author.joined_date),
      },
    });

    for (const book of author.books) {
      await prisma.book.create({
        data: {
          bookCode: book.book_id,
          authorProfileId: profile.id,
          title: book.title,
          isbn: book.isbn,
          genre: book.genre,
          publicationDate: book.publication_date ? new Date(book.publication_date) : null,
          status: book.status,
          mrp: book.mrp,
          authorRoyaltyPerCopy: book.author_royalty_per_copy,
          totalCopiesSold: book.total_copies_sold,
          totalRoyaltyEarned: book.total_royalty_earned,
          royaltyPaid: book.royalty_paid,
          royaltyPending: book.royalty_pending,
          lastRoyaltyPayoutDate: book.last_royalty_payout_date ? new Date(book.last_royalty_payout_date) : null,
          printPartner: book.print_partner,
          availableOn: book.available_on,
        },
      });
    }
  }

  // A couple of sample tickets so the admin queue and author "My Tickets" page aren't empty on first login.
  const priya = await prisma.authorProfile.findFirstOrThrow({ where: { authorCode: "AUTH001" } });
  const priyaBook = await prisma.book.findFirstOrThrow({ where: { bookCode: "BK001" } });
  const ticket1 = await prisma.ticket.create({
    data: {
      authorProfileId: priya.id,
      bookId: priyaBook.id,
      subject: "Royalty pending for 6+ months",
      description:
        "I published Whispers of the Ganges and I still see Rs. 3,570 pending. It's been a while since my last payout. Can you check what's going on?",
      category: TicketCategory.ROYALTY_PAYMENTS,
      priority: TicketPriority.HIGH,
      status: TicketStatus.OPEN,
    },
  });

  const rohit = await prisma.authorProfile.findFirstOrThrow({ where: { authorCode: "AUTH002" } });
  await prisma.ticket.create({
    data: {
      authorProfileId: rohit.id,
      bookId: null,
      subject: "Can I update my author bio?",
      description: "I'd like to update my author bio on my BookLeaf profile. How do I do that?",
      category: TicketCategory.GENERAL_INQUIRY,
      priority: TicketPriority.LOW,
      status: TicketStatus.OPEN,
    },
  });

  await prisma.ticketReply.create({
    data: {
      ticketId: ticket1.id,
      authorUserId: admin.id,
      body: "Internal: checked payout log, next quarterly run is in 10 days. Will confirm with finance.",
      isInternalNote: true,
    },
  });

  console.log("Seed complete.");
  console.log(`Admin login: admin@bookleaf.com / ${DEMO_ADMIN_PASSWORD}`);
  console.log(`Author login (any author email) / ${DEMO_AUTHOR_PASSWORD}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
