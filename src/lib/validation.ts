import { z } from 'zod';

export const emailSchema = z
  .string()
  .trim()
  .min(1, 'Email is required.')
  .email('Enter a valid email address.')
  .max(200)
  .transform((v) => v.toLowerCase());

export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters.')
  .max(100, 'Password must be under 100 characters.')
  .refine((v) => /[a-zA-Z]/.test(v) && /[0-9]/.test(v), {
    message: 'Password must contain at least one letter and one number.',
  });

export const otpSchema = z
  .string()
  .trim()
  .regex(/^\d{6}$/, 'Enter the 6-digit code from your email.');

export const signupSchema = z.object({
  name: z.string().trim().min(2, 'Please enter your full name.').max(80),
  email: emailSchema,
  password: passwordSchema,
  phone: z.string().trim().max(30).optional().or(z.literal('')),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required.'),
});

export const verifyOtpSchema = z.object({
  email: emailSchema,
  code: otpSchema,
});

export const resendOtpSchema = z.object({
  email: emailSchema,
  purpose: z.enum(['EMAIL_VERIFICATION', 'PASSWORD_RESET']).default('EMAIL_VERIFICATION'),
});

export const forgotPasswordSchema = z.object({ email: emailSchema });

export const resetPasswordSchema = z.object({
  email: emailSchema,
  code: otpSchema,
  password: passwordSchema,
});

// --- tickets ---------------------------------------------------------------

export const ticketCategoryEnum = z.enum([
  'MEMBERSHIP', 'EQUIPMENT', 'CLASSES', 'PERSONAL_TRAINING',
  'NUTRITION', 'INJURY', 'ACCOUNT', 'COMPLAINT', 'GENERAL',
]);
export const ticketPriorityEnum = z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']);
export const ticketStatusEnum = z.enum([
  'OPEN', 'IN_PROGRESS', 'PENDING_MEMBER', 'RESOLVED', 'CLOSED',
]);

export const createTicketSchema = z.object({
  subject: z.string().trim().min(5, 'Give your ticket a short subject (5+ characters).').max(160),
  body: z.string().trim().min(20, 'Please describe the issue in at least 20 characters.').max(8000),
  category: ticketCategoryEnum.optional(),
  priority: ticketPriorityEnum.optional(),
});

export const updateTicketSchema = z
  .object({
    status: ticketStatusEnum.optional(),
    priority: ticketPriorityEnum.optional(),
    category: ticketCategoryEnum.optional(),
    assigneeId: z.string().min(1).nullable().optional(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), {
    message: 'Provide at least one field to update.',
  });

export const createMessageSchema = z.object({
  body: z.string().trim().min(1, 'Message cannot be empty.').max(8000),
  isInternal: z.boolean().optional().default(false),
  fromAiDraftId: z.string().optional(),
});

export const csatSchema = z.object({
  rating: z.number().int().min(1).max(5),
});

// --- AI --------------------------------------------------------------------

export const suggestionReviewSchema = z.object({
  action: z.enum(['approve', 'edit', 'reject']),
  finalText: z.string().trim().max(8000).optional(),
});

// --- knowledge base --------------------------------------------------------

export const kbArticleSchema = z.object({
  title: z.string().trim().min(4, 'Title must be at least 4 characters.').max(160),
  summary: z.string().trim().min(10, 'Add a one-line summary.').max(400),
  content: z.string().trim().min(40, 'Article content must be at least 40 characters.').max(40_000),
  category: ticketCategoryEnum.default('GENERAL'),
  tags: z.array(z.string().trim().min(1).max(30)).max(10).default([]),
  isPublished: z.boolean().default(true),
});

export const kbSearchSchema = z.object({
  query: z.string().trim().min(2, 'Enter at least 2 characters.').max(500),
  limit: z.coerce.number().int().min(1).max(10).optional().default(5),
});

// --- admin -----------------------------------------------------------------

export const updateUserSchema = z.object({
  role: z.enum(['MEMBER', 'STAFF', 'ADMIN']).optional(),
  isActive: z.boolean().optional(),
  name: z.string().trim().min(2).max(80).optional(),
});

export const staffProfileSchema = z.object({
  title: z.string().trim().min(2).max(60).optional(),
  specialties: z.array(ticketCategoryEnum).max(7).optional(),
  maxOpenTickets: z.number().int().min(1).max(200).optional(),
  isAvailable: z.boolean().optional(),
});

export const slaPolicySchema = z.object({
  name: z.string().trim().min(2).max(60),
  firstResponseMins: z.number().int().min(1).max(20_160),
  resolutionMins: z.number().int().min(5).max(43_200),
  escalateAfterMins: z.number().int().min(1).max(20_160).default(30),
  notifySlack: z.boolean().default(true),
  isActive: z.boolean().default(true),
});

export const escalationActionSchema = z.object({
  action: z.enum(['acknowledge', 'resolve']),
});

export const manualEscalationSchema = z.object({
  ticketId: z.string().min(1),
  detail: z.string().trim().min(5, 'Explain why this is being escalated.').max(500),
});

// --- demo payments ---------------------------------------------------------

export const demoPaymentSchema = z.object({
  plan: z.enum(['BASIC', 'PRO', 'ELITE']),
  cardNumber: z
    .string()
    .trim()
    .transform((v) => v.replace(/\s+/g, ''))
    .refine((v) => /^\d{13,19}$/.test(v), 'Card number must be 13-19 digits.'),
  expiry: z
    .string()
    .trim()
    .regex(/^(0[1-9]|1[0-2])\/\d{2}$/, 'Expiry must be in MM/YY format.'),
  cvc: z.string().trim().regex(/^\d{3,4}$/, 'CVC must be 3 or 4 digits.'),
  name: z.string().trim().min(2, 'Cardholder name is required.').max(80),
});
