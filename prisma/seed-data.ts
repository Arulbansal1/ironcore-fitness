import type { TicketCategory } from '@prisma/client';

// ---------------------------------------------------------------------------
// IronCore Fitness — demo dataset
// ---------------------------------------------------------------------------

export const KB_ARTICLES: Array<{
  title: string;
  slug: string;
  summary: string;
  category: TicketCategory;
  tags: string[];
  content: string;
}> = [
  {
    title: 'Freezing your membership',
    slug: 'freeze-membership',
    summary: 'How long you can freeze for, what it costs, and how billing works while frozen.',
    category: 'MEMBERSHIP',
    tags: ['freeze', 'hold', 'pause', 'membership'],
    content: `You can freeze any rolling membership for between two weeks and three months in a twelve-month period. Freezes start on the next billing date, not immediately.

While frozen you pay a holding fee of $5 per month instead of your normal rate. Your membership length, joining benefits and any personal training credits are preserved exactly as they were.

Freezes for medical reasons are completely free and do not count towards your three-month allowance. Send us a doctor's note or a physio letter and we will apply it the same day, backdated to the date on the letter.

Your key fob stops working for the duration of the freeze. It reactivates automatically on the morning your freeze ends — you do not need to visit the front desk.

To freeze, open a membership ticket telling us the start date and how long you need. We confirm within one business day. If you are frozen and still being charged the full rate, that is our error and we refund it immediately.`,
  },
  {
    title: 'Cancelling your membership',
    slug: 'cancel-membership',
    summary: 'Notice periods, minimum terms, what happens to PT credits, and how to get written confirmation.',
    category: 'MEMBERSHIP',
    tags: ['cancel', 'notice', 'contract', 'leaving'],
    content: `Rolling memberships require 30 days' notice. Your final payment is the one that falls inside the notice period, and access continues until the end of that paid month.

Twelve-month contracts can be cancelled early only for a documented reason: relocation more than 15 miles away, long-term medical incapacity, or redundancy. We ask for evidence and waive the remaining balance entirely — there is no exit fee in those cases.

Unused personal training sessions stay valid for 90 days after you cancel, so you can finish a block you have already paid for.

We always send written confirmation with a cancellation reference within one business day. Keep it. If a payment is taken after your confirmed cancellation date, forward that reference and we refund it in full, usually same-day.

If your bank shows a payment after cancellation, cancel the direct debit at your end too — we cannot stop a mandate you control.`,
  },
  {
    title: 'Reporting broken or unsafe equipment',
    slug: 'broken-equipment',
    summary: 'How to report a fault, what we do about it, and how safety issues are prioritised.',
    category: 'EQUIPMENT',
    tags: ['equipment', 'broken', 'faulty', 'safety', 'machine'],
    content: `Report any fault to the front desk or open an equipment ticket. Tell us the machine and its number if it has one — "leg press 2" is far more useful than "the leg press".

Anything that could injure someone is treated as urgent and taken out of service immediately: frayed cables, cracked welds, loose plates, damaged safety catches, or a machine that moves when it should not. Do not use a machine you think is unsafe, even if it has no sign on it.

Routine faults are logged and assessed within 24 hours. Most are repaired within three working days. Parts for specialist machines occasionally take longer, and we put a note on the machine with the expected return date.

Cardio equipment displays that freeze or lose connection usually reset overnight. If the same unit fails twice in a week, tell us — that is a fault, not a glitch.

If a fault has caused an injury, say so explicitly. That routes straight to the duty manager rather than into the normal queue.`,
  },
  {
    title: 'Lockers, showers and changing rooms',
    slug: 'lockers-and-changing-rooms',
    summary: 'Locker rules, what happens to items left overnight, and how to report cleanliness issues.',
    category: 'EQUIPMENT',
    tags: ['locker', 'shower', 'changing room', 'lost property'],
    content: `Lockers are for use during your session only. Bring your own padlock, or borrow one from the front desk against a refundable deposit.

Any locker still locked at closing time is opened by a duty manager with a second staff member present, and the contents are logged and moved to lost property. We keep lost property for 28 days; unclaimed items then go to a local charity.

Valuables are your responsibility. We are not able to compensate for items left in a locker, which is why we ask you not to bring anything you would mind losing.

Changing rooms are deep-cleaned nightly and checked hourly through the day. If you find a cleanliness problem, tell the front desk immediately rather than opening a ticket — we can fix it within minutes while you are still here.

Report a broken locker, shower or hairdryer as an equipment fault and we will have it looked at within 24 hours.`,
  },
  {
    title: 'Booking, cancelling and waitlisting classes',
    slug: 'class-booking',
    summary: 'Booking windows, the late-cancellation policy, how waitlists work, and no-show penalties.',
    category: 'CLASSES',
    tags: ['class', 'booking', 'waitlist', 'cancel', 'timetable'],
    content: `Classes open for booking seven days in advance for Pro and Elite members, and 48 hours in advance for Basic members. Elite members also get priority access to the first five places in every class.

Cancel at least four hours before the class starts and there is no penalty. Cancel later than that, or simply not turn up, and it counts as a late cancellation. Three late cancellations in a rolling month pauses your class booking for seven days.

If a class is full you can join the waitlist. Places are released automatically in waitlist order the moment someone cancels, and you are notified in the app. If a place comes free in the last hour before the class you have fifteen minutes to confirm before it passes to the next person.

We cancel a class only when an instructor is unavailable and no cover can be found. You are notified as early as possible and never charged. If a class was cancelled with less than two hours' notice, tell us and we will credit a guest pass as an apology.

Arrive five minutes early. For safety reasons instructors cannot admit anyone more than five minutes after a class has started.`,
  },
  {
    title: 'Personal training sessions and packages',
    slug: 'personal-training',
    summary: 'How PT packages work, rescheduling rules, expiry, and how to change trainer.',
    category: 'PERSONAL_TRAINING',
    tags: ['personal training', 'pt', 'trainer', 'sessions', 'package'],
    content: `Personal training is sold in blocks of 5, 10 or 20 sessions. Larger blocks carry a better per-session rate. Elite membership includes two sessions each month, which stack with any block you buy.

Sessions expire six months from purchase. We extend that automatically if you freeze your membership for a medical reason — you never lose sessions to an injury.

Reschedule at least 24 hours in advance and the session returns to your balance. Inside 24 hours, or if you do not attend, the session is used. Your trainer's time was reserved and they are paid for it regardless.

You can change trainer at any time and you do not have to give a reason. Open a personal training ticket and we will move your remaining balance across and introduce you to someone new. Preferences about training style, or about the trainer's gender, are completely normal to state and we will match you accordingly.

Your first session is always a consultation covering goals, injury history and a movement screen. It is a full session and it is the most important one — please do not skip it.`,
  },
  {
    title: 'Body composition scans and nutrition plans',
    slug: 'nutrition-and-body-composition',
    summary: 'What the scan measures, how often to do it, and what a nutrition plan does and does not include.',
    category: 'NUTRITION',
    tags: ['nutrition', 'body composition', 'inbody', 'diet', 'macros'],
    content: `Our body composition scanner measures body fat percentage, lean muscle mass, and hydration. Pro and Elite members get one scan a month included; Basic members can buy a scan at the front desk.

Scan on an empty stomach, before training, and at a similar time of day each time. Hydration and a heavy meal both move the numbers more than a month of training does, so an inconsistent routine makes the trend meaningless.

Do not scan more than once a month. Real change in lean mass is slow, and weekly scans mostly measure noise, which is discouraging for no good reason.

Nutrition plans are written by our qualified coaches and cover calorie and macronutrient targets, meal timing around training, and practical food swaps. Elite membership includes a plan and a quarterly review.

Our coaches are not registered dietitians and cannot treat medical conditions, prescribe supplements for a diagnosed illness, or manage eating disorders. If you tell us about a medical condition we will refer you to a registered dietitian rather than guess — this is a boundary we hold firmly.`,
  },
  {
    title: 'Injuries, medical clearance and returning to training',
    slug: 'injury-and-medical-clearance',
    summary: 'What to do if you are hurt at the gym, when we need medical clearance, and how to train around an injury.',
    category: 'INJURY',
    tags: ['injury', 'medical', 'clearance', 'physio', 'first aid'],
    content: `If you are injured in the gym, tell a member of staff straight away. There is a first aider on shift at all times and we log every incident, however minor it seems. Do not wait until you get home to report it.

For anything involving chest pain, breathing difficulty, a head injury, loss of consciousness or a suspected fracture, staff will call emergency services. That decision is not yours to talk us out of.

We ask for medical clearance from a doctor before you return to full training after surgery, a cardiac event, pregnancy, or any injury that kept you out for more than six weeks. It is a short letter confirming exercise is safe — your GP will know exactly what is needed.

You can freeze your membership free of charge for the whole recovery period with a doctor's or physio's note, and any personal training sessions are protected for the duration.

Our trainers can usually build a programme around an injury rather than stopping you training altogether. Tell your trainer exactly what the injury is and what your physio has said. We would far rather adapt your training than have you train through pain.`,
  },
  {
    title: 'Key fobs, app access and account details',
    slug: 'access-and-account',
    summary: 'Lost fobs, turnstile problems, app sign-in issues and updating your personal details.',
    category: 'ACCOUNT',
    tags: ['key fob', 'access', 'app', 'login', 'turnstile'],
    content: `Your key fob opens the turnstile and is linked only to you. Lending it to someone else suspends both accounts, so please do not, even once.

Lost fobs are replaced at the front desk for $10 and activated instantly. The old fob is deactivated the moment you report it, so a lost fob cannot be used by whoever finds it.

If the turnstile rejects a working fob, the usual cause is a payment that has failed or a membership that has expired. Check the app first; the front desk can also see it immediately and let you in while it is sorted out.

For app sign-in problems, use "Forgot password" to get a 6-digit code by email. Codes expire after ten minutes and each new one cancels the last, so always use the most recent email. If nothing arrives, check spam and confirm we hold the right address for you.

You can update your name, phone number and emergency contact yourself in the app. Changing the email address on the account needs front-desk verification, because that address controls password resets.`,
  },
  {
    title: 'Making a complaint',
    slug: 'making-a-complaint',
    summary: 'How complaints about staff, other members or the facilities are handled, and what to expect.',
    category: 'COMPLAINT',
    tags: ['complaint', 'behaviour', 'harassment', 'feedback'],
    content: `Complaints go to the duty manager the same day and to the general manager within one working day. You will always get a named person handling it, not a generic reply.

For anything involving harassment, intimidation, filming without consent, or behaviour that made you feel unsafe, tell any member of staff immediately. We treat these as urgent, we act on them the same day, and we do not require you to put it in writing first.

We investigate by speaking to everyone involved and reviewing CCTV where it covers the area. We will tell you the outcome and what action we have taken, within the limits of what we can share about another person.

Sanctions range from a formal warning to immediate termination of membership without refund. We have removed members before and we will do it again where it is warranted.

You can ask to speak to the general manager directly at any point, and you can ask for a female member of staff to handle your complaint. Neither request needs a justification.`,
  },
  {
    title: 'Opening hours, guest passes and gym rules',
    slug: 'hours-guests-and-rules',
    summary: 'When we are open, how guest passes work, and the floor rules everyone is expected to follow.',
    category: 'GENERAL',
    tags: ['hours', 'guest pass', 'rules', 'etiquette'],
    content: `Staffed hours are 6am to 10pm Monday to Friday, and 8am to 6pm at weekends. Pro and Elite members have 24/7 access via key fob; Basic members can train 6am to 4pm on weekdays.

Bank holidays run a reduced 8am to 4pm timetable, and we post the Christmas hours in December.

Pro members get one guest pass a month and Elite members get four. Unused passes do not roll over. Your guest must be 16 or over, sign a waiver at the front desk, and stay with you for the whole visit. Under-16s are not permitted on the gym floor at any time.

The floor rules are short: wipe equipment down after use, re-rack your weights, do not drop dumbbells, share machines during busy periods, and keep bags in lockers rather than on the floor. Chalk is allowed in the lifting area only.

Filming is allowed for your own training as long as nobody else is in the shot. If someone asks not to be filmed, that is not up for discussion — stop and delete it.`,
  },
  {
    title: 'Payment failures and billing dates',
    slug: 'payment-failures',
    summary: 'When we retry a failed payment, what happens to access, and how to fix a declined card.',
    category: 'MEMBERSHIP',
    tags: ['payment', 'failed', 'direct debit', 'billing', 'declined'],
    content: `Memberships are billed on the same date each month, matching the date you joined. If that date does not exist in a shorter month, we bill on the last day instead.

A failed payment is retried after three days and again after seven. We email you at each attempt. Access continues normally through the first retry, so a single failed payment does not lock you out that day.

After the second failed retry your key fob is suspended until the balance clears. Nothing is cancelled and nothing is lost — the moment payment succeeds, access is restored automatically within a couple of minutes.

The usual causes are an expired card, a new card number after a bank replacement, or insufficient funds on the billing date. You can update your card in the app under Billing, which triggers an immediate retry.

If you believe a payment failed in error, or you were charged while frozen or after cancelling, open a membership ticket with the date and amount. We investigate and refund genuine errors the same business day.`,
  },
  {
    title: 'Your first month at IronCore',
    slug: 'first-month-guide',
    summary: 'What to expect as a new member: induction, programme, classes and getting settled.',
    category: 'GENERAL',
    tags: ['new member', 'induction', 'getting started'],
    content: `Every new member gets a free induction covering how the equipment works, where everything is, and the emergency procedures. Book it in the app or at the front desk. It takes about 45 minutes.

At the induction we ask about your goals, your training history and any injuries. Be honest about injuries even if they feel old or minor — it changes what we recommend, and it is on file if anything happens on the floor.

We will write you a starting programme free of charge. It is deliberately conservative for the first few weeks; the fastest way to lose a year of progress is to injure yourself in week two.

Classes are the easiest way to settle in, and the beginner-friendly ones are marked on the timetable. Tell the instructor beforehand that it is your first time and they will keep an eye on you.

If anything is unclear, ask. Every member of floor staff is there to be asked, and nobody minds. That is the job.`,
  },
  {
    title: 'Support response times and escalation',
    slug: 'support-response-times',
    summary: 'Our published response targets by priority, and how a missed target escalates.',
    category: 'GENERAL',
    tags: ['sla', 'response time', 'escalation', 'support'],
    content: `Our first-response targets are 15 minutes for urgent, 1 hour for high, 4 hours for medium and 8 hours for low priority. Resolution targets are 4 hours, 8 hours, 24 hours and 72 hours respectively.

Priority is set automatically when your ticket arrives, based on what you have written, and a staff member can adjust it. Urgent is reserved for injuries and safety hazards, being locked out of the building, harassment, and billing errors that have taken money incorrectly.

Anything mentioning an injury, pain, a fall or a hazard is escalated to the duty manager the moment it arrives, without waiting for a response timer. Member safety is the one thing we never queue.

When a response target is missed the ticket escalates automatically: the assigned staff member and the management team are alerted, and the escalation level rises every two hours until the ticket is answered.

You can also ask for escalation directly in any ticket. Tell us what the impact is and we will route it accordingly.`,
  },
];

export const DEMO_MEMBERS: Array<{
  name: string;
  email: string;
  phone: string;
  memberNumber: string;
  tier: 'DAY_PASS' | 'BASIC' | 'PRO' | 'ELITE';
  status: 'ACTIVE' | 'FROZEN' | 'EXPIRED' | 'CANCELLED' | 'PENDING';
  joinedMonthsAgo: number;
  expiresInDays: number | null;
  frozenUntilDays?: number;
  freezeReason?: string;
  goals?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  medicalNotes?: string;
  visitsThisMonth: number;
}> = [
  {
    name: 'Priya Raman',
    email: 'priya.raman@example.com',
    phone: '+1 555 0141',
    memberNumber: 'IC-00412',
    tier: 'ELITE',
    status: 'ACTIVE',
    joinedMonthsAgo: 19,
    expiresInDays: 210,
    goals: 'Deadlift 140kg, compete in a powerlifting meet next spring.',
    emergencyContactName: 'Arjun Raman',
    emergencyContactPhone: '+1 555 0142',
    medicalNotes: 'Previous L4/L5 disc bulge (2023). Cleared for lifting; avoid loaded spinal flexion.',
    visitsThisMonth: 18,
  },
  {
    name: 'Daniel Okafor',
    email: 'daniel.okafor@example.com',
    phone: '+1 555 0163',
    memberNumber: 'IC-00517',
    tier: 'PRO',
    status: 'ACTIVE',
    joinedMonthsAgo: 8,
    expiresInDays: 120,
    goals: 'General fitness, 3 sessions a week, drop 8kg.',
    emergencyContactName: 'Chidi Okafor',
    emergencyContactPhone: '+1 555 0164',
    visitsThisMonth: 11,
  },
  {
    name: 'Sofia Marino',
    email: 'sofia.marino@example.com',
    phone: '+1 555 0188',
    memberNumber: 'IC-00298',
    tier: 'PRO',
    status: 'FROZEN',
    joinedMonthsAgo: 26,
    expiresInDays: 300,
    frozenUntilDays: 42,
    freezeReason: 'Medical — post-operative knee rehabilitation',
    goals: 'Return to running after ACL reconstruction.',
    emergencyContactName: 'Luca Marino',
    emergencyContactPhone: '+1 555 0189',
    medicalNotes: 'ACL reconstruction Jan 2026. Physio-led rehab only. No plyometrics or pivoting until cleared.',
    visitsThisMonth: 0,
  },
  {
    name: 'James Whitfield',
    email: 'james.whitfield@example.com',
    phone: '+1 555 0107',
    memberNumber: 'IC-00631',
    tier: 'BASIC',
    status: 'ACTIVE',
    joinedMonthsAgo: 3,
    expiresInDays: 60,
    goals: 'Build a consistent habit — mornings before work.',
    emergencyContactName: 'Ellen Whitfield',
    emergencyContactPhone: '+1 555 0108',
    visitsThisMonth: 7,
  },
  {
    name: 'Aisha Khan',
    email: 'aisha.khan@example.com',
    phone: '+1 555 0122',
    memberNumber: 'IC-00455',
    tier: 'ELITE',
    status: 'ACTIVE',
    joinedMonthsAgo: 14,
    expiresInDays: 175,
    goals: 'Strength and conditioning for half marathon training.',
    emergencyContactName: 'Bilal Khan',
    emergencyContactPhone: '+1 555 0123',
    medicalNotes: 'Exercise-induced asthma. Keeps an inhaler in her gym bag.',
    visitsThisMonth: 15,
  },
  {
    name: 'Lucas Pereira',
    email: 'lucas.pereira@example.com',
    phone: '+1 555 0199',
    memberNumber: 'IC-00702',
    tier: 'BASIC',
    status: 'EXPIRED',
    joinedMonthsAgo: 13,
    expiresInDays: -9,
    goals: 'Was training for general fitness; lapsed after a house move.',
    emergencyContactName: 'Marta Pereira',
    emergencyContactPhone: '+1 555 0200',
    visitsThisMonth: 1,
  },
];

export const DEMO_STAFF: Array<{
  name: string;
  email: string;
  title: string;
  specialties: TicketCategory[];
  isTrainer: boolean;
  certifications: string[];
  maxOpenTickets: number;
}> = [
  {
    name: 'Maya Chen',
    email: 'maya.chen@ironcorefitness.example',
    title: 'Membership Services Lead',
    specialties: ['MEMBERSHIP', 'ACCOUNT', 'COMPLAINT', 'GENERAL'],
    isTrainer: false,
    certifications: ['Level 3 Gym Instructor', 'First Aid at Work'],
    maxOpenTickets: 18,
  },
  {
    name: 'Omar Haddad',
    email: 'omar.haddad@ironcorefitness.example',
    title: 'Head of Strength & Conditioning',
    specialties: ['PERSONAL_TRAINING', 'INJURY', 'NUTRITION'],
    isTrainer: true,
    certifications: ['CSCS', 'Level 4 Lower Back Pain Specialist', 'First Aid at Work'],
    maxOpenTickets: 12,
  },
  {
    name: 'Elena Novak',
    email: 'elena.novak@ironcorefitness.example',
    title: 'Group Fitness Manager',
    specialties: ['CLASSES', 'PERSONAL_TRAINING', 'GENERAL'],
    isTrainer: true,
    certifications: ['Level 3 Group Exercise', 'Spin & HIIT Certified'],
    maxOpenTickets: 15,
  },
  {
    name: 'Tomas Berg',
    email: 'tomas.berg@ironcorefitness.example',
    title: 'Facilities & Equipment Technician',
    specialties: ['EQUIPMENT', 'GENERAL'],
    isTrainer: false,
    certifications: ['Gym Equipment Maintenance Level 2', 'IOSH Working Safely'],
    maxOpenTickets: 15,
  },
];

export const GYM_CLASSES: Array<{
  name: string;
  description: string;
  trainerEmail: string | null;
  dayOfWeek: number;
  startTime: string;
  durationMins: number;
  capacity: number;
  room: string;
  intensity: string;
}> = [
  { name: 'Sunrise Spin', description: 'Interval cycling to wake the legs up before work.', trainerEmail: 'elena.novak@ironcorefitness.example', dayOfWeek: 1, startTime: '06:30', durationMins: 45, capacity: 22, room: 'Studio 2', intensity: 'High' },
  { name: 'Strength Foundations', description: 'Coached barbell technique for squat, bench and deadlift. Beginner friendly.', trainerEmail: 'omar.haddad@ironcorefitness.example', dayOfWeek: 1, startTime: '18:00', durationMins: 60, capacity: 12, room: 'Lifting Platform', intensity: 'Moderate' },
  { name: 'HIIT 45', description: 'Full-body circuits with short rest. Bring a towel.', trainerEmail: 'elena.novak@ironcorefitness.example', dayOfWeek: 2, startTime: '19:00', durationMins: 45, capacity: 24, room: 'Studio 1', intensity: 'High' },
  { name: 'Mobility & Recovery', description: 'Guided mobility work and stretching. Ideal on a rest day.', trainerEmail: 'omar.haddad@ironcorefitness.example', dayOfWeek: 3, startTime: '07:00', durationMins: 40, capacity: 18, room: 'Studio 2', intensity: 'Low' },
  { name: 'Power Hour', description: 'Olympic lifting accessories and explosive work.', trainerEmail: 'omar.haddad@ironcorefitness.example', dayOfWeek: 3, startTime: '18:30', durationMins: 60, capacity: 10, room: 'Lifting Platform', intensity: 'High' },
  { name: 'Vinyasa Yoga', description: 'Flowing yoga suitable for all levels.', trainerEmail: 'elena.novak@ironcorefitness.example', dayOfWeek: 4, startTime: '19:30', durationMins: 60, capacity: 20, room: 'Studio 2', intensity: 'Low' },
  { name: 'Saturday Bootcamp', description: 'Outdoor-style conditioning in the functional zone.', trainerEmail: 'elena.novak@ironcorefitness.example', dayOfWeek: 6, startTime: '09:00', durationMins: 55, capacity: 26, room: 'Functional Zone', intensity: 'High' },
  { name: 'Sunday Long Row', description: 'Steady-state rowing with coached technique blocks.', trainerEmail: 'omar.haddad@ironcorefitness.example', dayOfWeek: 0, startTime: '10:00', durationMins: 50, capacity: 14, room: 'Cardio Deck', intensity: 'Moderate' },
];

export const DEMO_TICKETS: Array<{
  memberEmail: string;
  subject: string;
  body: string;
  category: TicketCategory;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  sentiment: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE' | 'FRUSTRATED';
  status: 'OPEN' | 'IN_PROGRESS' | 'PENDING_MEMBER' | 'RESOLVED' | 'CLOSED';
  staffEmail?: string;
  ageHours: number;
  firstReplyAfterMins: number | null;
  summary: string;
  tags: string[];
  confidence: number;
  safetyFlag?: boolean;
  satisfaction?: number;
  replies?: Array<{ from: 'member' | 'staff'; body: string; afterMins: number }>;
}> = [
  {
    memberEmail: 'aisha.khan@example.com',
    subject: 'Hurt my shoulder on the cable machine this morning',
    body: `I was doing cable rows at about 7am and the handle came away from the cable mid-rep. My shoulder took the whole load as it gave way and it's painful to lift my arm above shoulder height now. I told the person at the front desk but nobody took any details. The cable on that machine has looked frayed for a couple of weeks.`,
    category: 'INJURY',
    priority: 'URGENT',
    sentiment: 'NEGATIVE',
    status: 'IN_PROGRESS',
    staffEmail: 'omar.haddad@ironcorefitness.example',
    ageHours: 4,
    firstReplyAfterMins: 8,
    summary: 'Member injured her shoulder when a cable handle detached mid-rep; reports the cable was visibly frayed beforehand. Incident not logged at the desk.',
    tags: ['injury', 'shoulder', 'cable', 'equipment', 'incident'],
    confidence: 0.96,
    safetyFlag: true,
    replies: [
      {
        from: 'staff',
        afterMins: 8,
        body: `Aisha, I'm really sorry — that should never have happened, and it should have been logged the moment you reported it. I've done that now and the duty manager has the incident reference IR-2291.\n\nThe cable machine is out of service as of ten minutes ago and Tomas is inspecting every cable on the floor today, not just that one.\n\nPlease get that shoulder looked at today — if you'd like, we'll cover the cost of an assessment with our physio partner. I'd also like to freeze your membership at no charge while you recover, and I've protected your PT sessions so you don't lose any.\n\nCan you tell me whether you'd prefer a call or to keep this in writing? Either is fine.\n\nOmar\nHead of Strength & Conditioning`,
      },
      {
        from: 'member',
        afterMins: 55,
        body: `Thank you, that's a much better response than I got at the desk. A call would be good, I'm free after 2pm. I've booked in with my GP this afternoon. I would like the membership frozen please.`,
      },
    ],
  },
  {
    memberEmail: 'lucas.pereira@example.com',
    subject: 'Still being charged after I cancelled in June',
    body: `I cancelled my membership in June and got a confirmation email. You've taken $29 in July and again in August. That's two payments after cancellation. I've called twice and been told someone would ring me back, and nobody has. This is the third time I'm chasing it and I want both payments refunded.`,
    category: 'MEMBERSHIP',
    priority: 'URGENT',
    sentiment: 'FRUSTRATED',
    status: 'IN_PROGRESS',
    staffEmail: 'maya.chen@ironcorefitness.example',
    ageHours: 6,
    firstReplyAfterMins: 14,
    summary: 'Two membership payments taken after a confirmed June cancellation; member has chased three times with no callback. Wants both refunded.',
    tags: ['cancellation', 'refund', 'billing', 'overcharge'],
    confidence: 0.94,
    replies: [
      {
        from: 'staff',
        afterMins: 14,
        body: `Lucas, you're right on every point and I'm sorry — two payments taken after a confirmed cancellation, and three unreturned calls, is not acceptable.\n\nI can see your cancellation confirmation dated 14 June (ref CX-4471). The July and August payments should never have been taken. I've submitted refunds for both, $58 in total, reference RF-30188. Card refunds take 5-10 business days to appear.\n\nThe cause was the mandate staying active on our side after the cancellation was processed — that's our error, not your bank's. I've closed it properly now so nothing further can be taken.\n\nI'm also logging a complaint about the unreturned calls so it goes to the general manager rather than disappearing.\n\nMaya\nMembership Services Lead`,
      },
    ],
  },
  {
    memberEmail: 'priya.raman@example.com',
    subject: 'Squat rack 2 safety pins are bent',
    body: `The safety pins on squat rack 2 don't sit flush any more — they're visibly bent and they rattle under load. I noticed it when I was working up to a heavy single and didn't trust them, so I moved to rack 1. Somebody is going to fail a rep on that rack and find out the hard way.`,
    category: 'EQUIPMENT',
    priority: 'URGENT',
    sentiment: 'NEUTRAL',
    status: 'RESOLVED',
    staffEmail: 'tomas.berg@ironcorefitness.example',
    ageHours: 30,
    firstReplyAfterMins: 12,
    summary: 'Bent safety pins on squat rack 2 that rattle under load — a failed rep could drop a loaded bar. Reported by an experienced lifter.',
    tags: ['squat rack', 'safety', 'equipment', 'pins'],
    confidence: 0.93,
    safetyFlag: true,
    satisfaction: 5,
    replies: [
      {
        from: 'staff',
        afterMins: 12,
        body: `Priya, thank you — that's exactly the kind of thing we want reported and you were right not to trust them.\n\nRack 2 is taped off as of now. I've inspected the pins: both are deformed, almost certainly from a bar being dropped onto them rather than gradual wear. Replacements are ordered on next-day delivery.\n\nI've also checked racks 1, 3 and 4 this morning. Rack 3 has early signs of the same thing so I'm replacing that set too rather than waiting for it to get worse.\n\nRack 2 will be back in service tomorrow afternoon.\n\nTomas\nFacilities & Equipment`,
      },
      {
        from: 'member',
        afterMins: 180,
        body: `Appreciate the quick turnaround, and good call checking the others.`,
      },
    ],
  },
  {
    memberEmail: 'sofia.marino@example.com',
    subject: 'Membership is frozen for my knee but I was charged full price',
    body: `My membership has been frozen since February for post-op knee rehab — I sent the surgeon's letter and it was approved. I've just been charged the full $59 instead of the $5 holding fee. I can't even use the gym at the moment.`,
    category: 'MEMBERSHIP',
    priority: 'HIGH',
    sentiment: 'NEGATIVE',
    status: 'PENDING_MEMBER',
    staffEmail: 'maya.chen@ironcorefitness.example',
    ageHours: 20,
    firstReplyAfterMins: 26,
    summary: 'Medically frozen member charged the full $59 rate instead of the $5 holding fee while unable to train.',
    tags: ['freeze', 'billing', 'medical', 'overcharge'],
    confidence: 0.91,
    replies: [
      {
        from: 'staff',
        afterMins: 26,
        body: `Sofia, that's our mistake and I'm sorry — a medical freeze should be $5 a month and nothing else.\n\nI've refunded the difference of $54 today (ref RF-30204) and corrected the billing record so next month bills at the holding rate automatically.\n\nOne thing worth flagging: your freeze is currently set to end in about six weeks. If your physio expects rehab to run longer, send me an updated note and I'll extend it — medical freezes don't count towards your annual allowance, so there's no reason to let it lapse early.\n\nHow's the knee coming along?\n\nMaya`,
      },
    ],
  },
  {
    memberEmail: 'daniel.okafor@example.com',
    subject: 'Spin class keeps filling before I can book',
    body: `I'm on Pro so I should get the seven day booking window, but Sunrise Spin is always full the moment it opens. Is there something wrong with my account, or is it genuinely that popular? I've been on the waitlist three weeks running and never got a place.`,
    category: 'CLASSES',
    priority: 'MEDIUM',
    sentiment: 'NEGATIVE',
    status: 'RESOLVED',
    staffEmail: 'elena.novak@ironcorefitness.example',
    ageHours: 52,
    firstReplyAfterMins: 38,
    summary: 'Pro member cannot get into Sunrise Spin despite the 7-day window; waitlisted three weeks running with no place.',
    tags: ['spin', 'booking', 'waitlist', 'classes'],
    confidence: 0.87,
    satisfaction: 4,
    replies: [
      {
        from: 'staff',
        afterMins: 38,
        body: `Hi Daniel — nothing wrong with your account, I've checked and your seven-day window is applying correctly.\n\nSunrise Spin genuinely is our most oversubscribed class; it fills in under two minutes most weeks. Elite members get the first five places, which is why it can feel like it's gone before it opened.\n\nTwo things that should actually help. We're adding a second Sunrise Spin on Thursdays from next month specifically because of demand like yours. And if you set a booking reminder in the app you'll be notified the moment your window opens rather than finding out later.\n\nI've also added you to the priority waitlist for the Thursday class so you get first refusal when it goes live.\n\nElena\nGroup Fitness Manager`,
      },
      {
        from: 'member',
        afterMins: 220,
        body: `That's great, thanks. Thursday actually suits me better anyway.`,
      },
    ],
  },
  {
    memberEmail: 'james.whitfield@example.com',
    subject: 'Key fob not working at the turnstile',
    body: `My fob stopped working yesterday evening. The light goes red and the turnstile won't move. Front desk let me in but said to raise it here. My payments are all up to date as far as I know.`,
    category: 'ACCOUNT',
    priority: 'HIGH',
    sentiment: 'NEUTRAL',
    status: 'RESOLVED',
    staffEmail: 'maya.chen@ironcorefitness.example',
    ageHours: 26,
    firstReplyAfterMins: 22,
    summary: 'Key fob rejected at the turnstile since yesterday evening; member believes payments are up to date.',
    tags: ['key fob', 'access', 'turnstile'],
    confidence: 0.89,
    satisfaction: 5,
    replies: [
      {
        from: 'staff',
        afterMins: 22,
        body: `Hi James — found it. Your card expired on the 31st so the payment on the 1st didn't go through, and the fob suspends automatically after the second failed retry.\n\nNothing is cancelled and you haven't lost anything. Update your card in the app under Billing and it retries immediately; the fob reactivates within a couple of minutes of the payment clearing.\n\nI've manually enabled your fob for the next 48 hours so you're not locked out while you sort the card.\n\nMaya`,
      },
      {
        from: 'member',
        afterMins: 90,
        body: `That was it, new card added and it's working. Thanks for enabling it in the meantime.`,
      },
    ],
  },
  {
    memberEmail: 'priya.raman@example.com',
    subject: 'Can I change PT to someone who does powerlifting?',
    body: `My current trainer is great but mostly does general fitness, and I want to compete in a powerlifting meet in spring. Is there someone who specialises in that? I've got 6 sessions left on my block. I don't want this to be awkward for anyone.`,
    category: 'PERSONAL_TRAINING',
    priority: 'LOW',
    sentiment: 'POSITIVE',
    status: 'CLOSED',
    staffEmail: 'omar.haddad@ironcorefitness.example',
    ageHours: 120,
    firstReplyAfterMins: 64,
    summary: 'Member wants to switch to a powerlifting-focused trainer ahead of a spring meet; 6 sessions remaining on her block.',
    tags: ['personal training', 'trainer change', 'powerlifting'],
    confidence: 0.92,
    satisfaction: 5,
    replies: [
      {
        from: 'staff',
        afterMins: 64,
        body: `Priya, it's not awkward at all — changing trainer as your goals change is exactly how it should work, and you don't need to justify it.\n\nPowerlifting is my own background, so I'd be glad to take it on. Your 6 remaining sessions transfer across at no cost.\n\nGiven your L4/L5 history I'd want the first session to be a movement screen before we load anything heavy. A spring meet is a realistic target from where you are, but only if we build the base properly first.\n\nI've got Tuesday 6pm or Thursday 7pm free from next week. Which suits?\n\nOmar`,
      },
      {
        from: 'member',
        afterMins: 200,
        body: `Tuesday 6pm is perfect. Really pleased about this, thank you.`,
      },
    ],
  },
  {
    memberEmail: 'aisha.khan@example.com',
    subject: 'Body composition scan results look wrong',
    body: `My scan this morning says I've lost 2kg of muscle in a month, which can't be right given I've been training hard and eating well. Last month's scan was in the evening after work, this one was first thing before breakfast. Is that the reason?`,
    category: 'NUTRITION',
    priority: 'LOW',
    sentiment: 'NEUTRAL',
    status: 'OPEN',
    ageHours: 2,
    firstReplyAfterMins: null,
    summary: 'Scan shows an implausible 2kg lean mass loss in a month; the two scans were taken at different times of day and hydration states.',
    tags: ['body composition', 'scan', 'nutrition', 'inbody'],
    confidence: 0.85,
  },
  {
    memberEmail: 'daniel.okafor@example.com',
    subject: 'Changing room showers are cold again',
    body: `Third time this month the showers in the men's changing room have run cold in the evening. Not lukewarm, properly cold. It's not the end of the world but it's becoming a pattern.`,
    category: 'EQUIPMENT',
    priority: 'MEDIUM',
    sentiment: 'NEGATIVE',
    status: 'OPEN',
    ageHours: 9,
    firstReplyAfterMins: null,
    summary: "Men's changing room showers running cold in the evenings for the third time this month — a recurring fault rather than a one-off.",
    tags: ['showers', 'changing room', 'hot water', 'recurring'],
    confidence: 0.88,
  },
  {
    memberEmail: 'lucas.pereira@example.com',
    subject: 'What are the bank holiday opening hours?',
    body: `Planning my week — are you open on the bank holiday Monday, and what times?`,
    category: 'GENERAL',
    priority: 'LOW',
    sentiment: 'NEUTRAL',
    status: 'CLOSED',
    staffEmail: 'maya.chen@ironcorefitness.example',
    ageHours: 96,
    firstReplyAfterMins: 48,
    summary: 'Asking about bank holiday Monday opening hours.',
    tags: ['opening hours', 'bank holiday'],
    confidence: 0.95,
    satisfaction: 5,
    replies: [
      {
        from: 'staff',
        afterMins: 48,
        body: `Hi Lucas — we're open 8am to 4pm on bank holiday Mondays. Classes run a reduced timetable, and it's posted in the app a week ahead.\n\n24/7 fob access is unaffected for Pro and Elite members.\n\nMaya`,
      },
    ],
  },
  {
    memberEmail: 'sofia.marino@example.com',
    subject: 'A member was filming in the free weights area',
    body: `Someone was filming their set on a phone propped against the mirror and I was clearly in the background. I asked him to stop and he said it was a public gym and carried on. It made me really uncomfortable and I left early.`,
    category: 'COMPLAINT',
    priority: 'HIGH',
    sentiment: 'NEGATIVE',
    status: 'IN_PROGRESS',
    staffEmail: 'maya.chen@ironcorefitness.example',
    ageHours: 12,
    firstReplyAfterMins: 19,
    summary: 'Member filmed without consent in the free weights area; asked the person to stop and was refused. She left the session early.',
    tags: ['filming', 'complaint', 'consent', 'behaviour'],
    confidence: 0.9,
    safetyFlag: true,
    replies: [
      {
        from: 'staff',
        afterMins: 19,
        body: `Sofia, I'm sorry this happened and sorrier that you felt you had to leave. You asked him to stop and that should have been the end of it — "it's a public gym" is not how our filming rule works, and he'll be told so directly.\n\nOur policy is that filming is fine only if nobody else is in the shot, and stopping when asked isn't optional.\n\nI've passed this to the duty manager with the time and location so we can identify him from the floor rota and CCTV. He'll get a formal warning, and it goes on record — a second incident means membership termination.\n\nI'll come back to you with the outcome. If you'd rather speak to a female member of the management team about it, just say and I'll arrange that instead.\n\nMaya`,
      },
    ],
  },
  {
    memberEmail: 'james.whitfield@example.com',
    subject: 'Thanks for the induction',
    body: `Just wanted to say the induction was genuinely useful — I'd been avoiding the free weights area because I didn't know what I was doing. Much more confident now.`,
    category: 'GENERAL',
    priority: 'LOW',
    sentiment: 'POSITIVE',
    status: 'CLOSED',
    staffEmail: 'elena.novak@ironcorefitness.example',
    ageHours: 140,
    firstReplyAfterMins: 110,
    summary: 'Positive feedback about the new-member induction; feels more confident using the free weights area.',
    tags: ['induction', 'feedback', 'new member'],
    confidence: 0.96,
    satisfaction: 5,
    replies: [
      {
        from: 'staff',
        afterMins: 110,
        body: `James, that's brilliant to hear — the free weights area is exactly the bit people avoid, so that's the induction doing its job. I'll pass this to the team who ran it.\n\nIf you want a follow-up in a few weeks to progress the programme, just ask at the desk. No charge.\n\nElena`,
      },
    ],
  },
];

export const SLA_POLICIES = [
  { name: 'Urgent — injury, safety & billing errors', priority: 'URGENT' as const, firstResponseMins: 15, resolutionMins: 240, escalateAfterMins: 15 },
  { name: 'High — access, disputes & complaints', priority: 'HIGH' as const, firstResponseMins: 60, resolutionMins: 480, escalateAfterMins: 30 },
  { name: 'Medium — equipment & bookings', priority: 'MEDIUM' as const, firstResponseMins: 240, resolutionMins: 1440, escalateAfterMins: 60 },
  { name: 'Low — questions & feedback', priority: 'LOW' as const, firstResponseMins: 480, resolutionMins: 4320, escalateAfterMins: 120 },
];
