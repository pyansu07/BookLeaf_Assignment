export type Role = "AUTHOR" | "ADMIN";

export type TicketCategory =
  | "ROYALTY_PAYMENTS"
  | "ISBN_METADATA"
  | "PRINTING_QUALITY"
  | "DISTRIBUTION_AVAILABILITY"
  | "PRODUCTION_UPDATES"
  | "GENERAL_INQUIRY";

export type TicketPriority = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
export type TicketStatus = "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  authorProfileId: string | null;
}

export interface Book {
  id: string;
  bookCode: string;
  title: string;
  isbn: string;
  genre: string;
  publicationDate: string | null;
  status: string;
  mrp: string | null;
  authorRoyaltyPerCopy: string | null;
  totalCopiesSold: number;
  totalRoyaltyEarned: string;
  royaltyPaid: string;
  royaltyPending: string;
  lastRoyaltyPayoutDate: string | null;
  printPartner: string | null;
  availableOn: string[];
}

export interface TicketSummary {
  id: string;
  ticketNumber: number;
  subject: string;
  description: string;
  category: TicketCategory;
  aiSuggestedCategory: TicketCategory | null;
  categoryOverridden: boolean;
  priority: TicketPriority;
  aiSuggestedPriority: TicketPriority | null;
  priorityOverridden: boolean;
  status: TicketStatus;
  createdAt: string;
  updatedAt: string;
  book: { id: string; title: string; isbn: string } | null;
  authorProfile: { id: string; authorCode: string; user: { name: string; email: string } };
  assignedAdmin: { id: string; name: string } | null;
  _count: { replies: number };
}

export interface TicketReply {
  id: string;
  ticketId: string;
  body: string;
  isInternalNote: boolean;
  aiGenerated: boolean;
  createdAt: string;
  author: { id: string; name: string; role: Role };
}

export interface TicketDetail extends TicketSummary {
  book: Book | null;
  replies: TicketReply[];
}

export const CATEGORY_LABELS: Record<TicketCategory, string> = {
  ROYALTY_PAYMENTS: "Royalty & Payments",
  ISBN_METADATA: "ISBN & Metadata Issues",
  PRINTING_QUALITY: "Printing & Quality",
  DISTRIBUTION_AVAILABILITY: "Distribution & Availability",
  PRODUCTION_UPDATES: "Book Status & Production Updates",
  GENERAL_INQUIRY: "General Inquiry",
};

export const STATUS_LABELS: Record<TicketStatus, string> = {
  OPEN: "Open",
  IN_PROGRESS: "In Progress",
  RESOLVED: "Resolved",
  CLOSED: "Closed",
};
