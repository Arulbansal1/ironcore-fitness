/**
 * Values shared between server and client code.
 * Kept free of `server-only` imports so client components can use them.
 */

export const GYM_NAME = 'IronCore Fitness';
export const GYM_SHORT_NAME = 'IronCore';
export const GYM_TAGLINE = 'Member support that never misses a rep.';

export const ALLOWED_EXTENSIONS_CLIENT = [
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.pdf', '.txt', '.csv',
  '.json', '.zip', '.doc', '.docx', '.xls', '.xlsx',
];

export const TICKET_STATUSES = [
  { value: 'OPEN', label: 'Open' },
  { value: 'IN_PROGRESS', label: 'In progress' },
  { value: 'PENDING_MEMBER', label: 'Waiting on member' },
  { value: 'RESOLVED', label: 'Resolved' },
  { value: 'CLOSED', label: 'Closed' },
] as const;

export const TICKET_PRIORITIES = [
  { value: 'LOW', label: 'Low' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'HIGH', label: 'High' },
  { value: 'URGENT', label: 'Urgent' },
] as const;

/** The topics members actually contact an IronCore front desk about. */
export const TICKET_CATEGORIES = [
  { value: 'MEMBERSHIP', label: 'Membership & billing', hint: 'Joining, freezing, cancelling, invoices' },
  { value: 'EQUIPMENT', label: 'Equipment & facilities', hint: 'Broken machines, showers, lockers, cleanliness' },
  { value: 'CLASSES', label: 'Classes & bookings', hint: 'Booking, waitlists, timetable changes' },
  { value: 'PERSONAL_TRAINING', label: 'Personal training', hint: 'PT sessions, trainers, packages' },
  { value: 'NUTRITION', label: 'Nutrition & wellness', hint: 'Diet plans, body composition, supplements' },
  { value: 'INJURY', label: 'Injury & medical', hint: 'Injuries, medical clearance, physio' },
  { value: 'ACCOUNT', label: 'Account & access', hint: 'Login, app, key fob, personal details' },
  { value: 'COMPLAINT', label: 'Complaint or feedback', hint: 'Staff, other members, general feedback' },
  { value: 'GENERAL', label: 'General question', hint: 'Opening hours, guest passes, anything else' },
] as const;

export const SENTIMENTS = ['POSITIVE', 'NEUTRAL', 'NEGATIVE', 'FRUSTRATED'] as const;

// --- membership -------------------------------------------------------------

export const MEMBERSHIP_TIERS = [
  { value: 'DAY_PASS', label: 'Day pass' },
  { value: 'BASIC', label: 'Basic' },
  { value: 'PRO', label: 'Pro' },
  { value: 'ELITE', label: 'Elite' },
] as const;

export const MEMBERSHIP_STATUSES = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'FROZEN', label: 'Frozen' },
  { value: 'EXPIRED', label: 'Expired' },
  { value: 'CANCELLED', label: 'Cancelled' },
  { value: 'PENDING', label: 'Pending' },
] as const;

export const BOOKING_STATUSES = [
  { value: 'BOOKED', label: 'Booked' },
  { value: 'WAITLISTED', label: 'Waitlisted' },
  { value: 'ATTENDED', label: 'Attended' },
  { value: 'NO_SHOW', label: 'No show' },
  { value: 'CANCELLED', label: 'Cancelled' },
] as const;

export const DAY_NAMES = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday',
];

/** DEMO PAYMENT — membership plans shown by the simulated gateway. No real money. */
export const DEMO_PLANS = [
  {
    id: 'BASIC' as const,
    name: 'Basic',
    amountCents: 2900,
    blurb: 'Gym floor access, off-peak.',
    features: [
      'Gym floor 6am–4pm weekdays',
      'Locker room & showers',
      'Free induction session',
      'IronCore app access',
    ],
  },
  {
    id: 'PRO' as const,
    name: 'Pro',
    amountCents: 5900,
    blurb: 'Full access plus unlimited classes.',
    features: [
      '24/7 gym floor access',
      'Unlimited group classes',
      'Monthly body composition scan',
      '1 guest pass per month',
    ],
    popular: true,
  },
  {
    id: 'ELITE' as const,
    name: 'Elite',
    amountCents: 12900,
    blurb: 'Everything, plus coaching.',
    features: [
      'Everything in Pro',
      '2 personal training sessions monthly',
      'Nutrition plan and quarterly reviews',
      'Priority booking and 4 guest passes',
    ],
  },
];

/** Test cards accepted by the demo gateway, mirroring common sandbox numbers. */
export const DEMO_TEST_CARDS = [
  { number: '4242 4242 4242 4242', brand: 'Visa', outcome: 'Always succeeds' },
  { number: '5555 5555 5555 4444', brand: 'Mastercard', outcome: 'Always succeeds' },
  { number: '4000 0000 0000 0002', brand: 'Visa', outcome: 'Always declined (card_declined)' },
  { number: '4000 0000 0000 9995', brand: 'Visa', outcome: 'Always declined (insufficient_funds)' },
];
