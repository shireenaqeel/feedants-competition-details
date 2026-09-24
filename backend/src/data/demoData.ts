import mongoose from 'mongoose';
import { CompetitionModel } from '../models/competition.model.js';
import { CompetitionResultModel } from '../models/competitionResult.model.js';
import { JudgeModel } from '../models/judge.model.js';
import { PeerRatingModel } from '../models/peerRating.model.js';
import { RatingModel } from '../models/rating.model.js';
import { RegistrationModel } from '../models/registration.model.js';
import { SubmissionModel } from '../models/submission.model.js';
import { TestimonialModel } from '../models/testimonial.model.js';
import { UserModel } from '../models/user.model.js';

// Demo dataset: default competitions in every state (ongoing / upcoming / past / cancelled),
// their organizer, demo users, winners, ratings and testimonials. All dates are relative to the
// moment it runs, so the mix is always realistic and the main competition is always open.

export const DEMO_PHONE = '9999999999';
export const ORGANIZER_PHONE = '8888888888';

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

const avatar = (gender: 'women' | 'men', n: number) => `https://randomuser.me/api/portraits/${gender}/${n}.jpg`;
// Served by this API from backend/assets (see CREDITS.md there), so demo videos never go missing.
const SAMPLE_VIDEO = '/static/demo-videos/big-buck-bunny.mp4';
const SAMPLE_VIDEO_2 = '/static/demo-videos/sintel.mp4';

const classicalContent = {
  about: {
    en: [
      'This is an online classical dance competition open for all age groups.',
      'Participate from anywhere and showcase your talent.',
      'Express your passion through traditional dance.',
      'Any Indian classical form is welcome: Kathak, Bharatanatyam, Odissi, Kuchipudi, Manipuri, Mohiniyattam, Sattriya or Kathakali.',
      'Record a solo performance of up to 3 minutes and upload it before the submission deadline. Results are announced on the result date, and every winner receives a certificate.',
    ].join('\n'),
    hi: [
      'यह सभी आयु वर्गों के लिए एक ऑनलाइन शास्त्रीय नृत्य प्रतियोगिता है।',
      'कहीं से भी भाग लें और अपनी प्रतिभा दिखाएँ।',
      'पारंपरिक नृत्य के माध्यम से अपने जुनून को व्यक्त करें।',
      'कोई भी भारतीय शास्त्रीय नृत्य शैली मान्य है: कथक, भरतनाट्यम, ओडिसी, कुचिपुड़ी, मणिपुरी, मोहिनीअट्टम, सत्रिया या कथकली।',
      'अधिकतम 3 मिनट की एकल प्रस्तुति रिकॉर्ड करें और समय सीमा से पहले अपलोड करें। परिणाम घोषित तिथि पर आएँगे और हर विजेता को प्रमाणपत्र मिलेगा।',
    ].join('\n'),
  },
  judgingParameters: [
    { title: { en: 'Technique & footwork', hi: 'तकनीक और पदचालन' }, weight: 30 },
    { title: { en: 'Expression (Abhinaya)', hi: 'भाव (अभिनय)' }, weight: 25 },
    { title: { en: 'Rhythm & timing (Taal)', hi: 'लय और ताल' }, weight: 20 },
    { title: { en: 'Costume & presentation', hi: 'वेशभूषा और प्रस्तुति' }, weight: 15 },
    { title: { en: 'Overall impact', hi: 'समग्र प्रभाव' }, weight: 10 },
  ],
  rulesEligibility: [
    { en: 'Open to participants of all ages. Participants under 18 need consent from a parent or guardian.', hi: 'सभी आयु के प्रतिभागियों के लिए खुला। 18 वर्ष से कम आयु के प्रतिभागियों को माता-पिता/अभिभावक की सहमति आवश्यक है।' },
    { en: 'Solo performances only, up to 3 minutes.', hi: 'केवल एकल प्रस्तुति, अधिकतम 3 मिनट।' },
    { en: 'Upload one video (MP4/MOV). You can replace it until submissions close.', hi: 'एक वीडियो (MP4/MOV) अपलोड करें। सबमिशन बंद होने तक आप इसे बदल सकते हैं।' },
    { en: 'Only contributions from paid participants are judged.', hi: 'केवल भुगतान करने वाले प्रतिभागियों की प्रविष्टियों का मूल्यांकन होगा।' },
    { en: "The judge's decision is final.", hi: 'निर्णायक का निर्णय अंतिम होगा।' },
  ],
};

const rewards = [55000, 30000, 24000, 20000, 13000, 8000].map((amount, i) => ({ position: i + 1, amount }));

const baseCompetition = {
  category: 'dance' as const,
  tags: [
    { en: 'Dance', hi: 'नृत्य' },
    { en: 'Multi-Win', hi: 'मल्टी-विन' },
  ],
  isMultiWin: true,
  certificateForWinners: true,
  currency: 'INR',
  entryFee: 9900,
  prizePool: 150000,
  rewards,
  content: classicalContent,
  disclaimer: {
    en: 'Only contributions from paid participants will be considered for judging.',
    hi: 'केवल भुगतान करने वाले प्रतिभागियों की प्रविष्टियों पर ही निर्णय हेतु विचार किया जाएगा।',
  },
  refundPolicyUrl: 'https://feedants.com/refund-policy',
  media: { prizeInfoVideoUrl: SAMPLE_VIDEO_2 },
  referralRewardPerSignup: 1000,
};

/** A competition with a simpler, category-specific description (the classical one mirrors the design). */
function simpleCompetition(opts: {
  category: 'photography' | 'writing' | 'singing' | 'comedy';
  en: string;
  hi: string;
  tag: { en: string; hi: string };
  about: { en: string; hi: string };
  entryFee: number;
  rewards: number[];
}) {
  const rewards = opts.rewards.map((amount, i) => ({ position: i + 1, amount }));
  return {
    ...baseCompetition,
    category: opts.category,
    title: { en: opts.en, hi: opts.hi },
    tags: [opts.tag, { en: 'Multi-Win', hi: 'मल्टी-विन' }],
    entryFee: opts.entryFee,
    rewards,
    prizePool: rewards.reduce((sum, r) => sum + r.amount, 0),
    content: {
      about: opts.about,
      judgingParameters: [
        { title: { en: 'Creativity', hi: 'रचनात्मकता' }, weight: 50 },
        { title: { en: 'Execution', hi: 'प्रस्तुति' }, weight: 30 },
        { title: { en: 'Overall impact', hi: 'समग्र प्रभाव' }, weight: 20 },
      ],
      rulesEligibility: [
        { en: 'Open to everyone.', hi: 'सभी के लिए खुला।' },
        { en: 'One entry per participant.', hi: 'प्रति प्रतिभागी एक प्रविष्टि।' },
      ],
    },
  };
}

/**
 * Loads the demo dataset. Every date is computed from `now` (the moment the script runs), so
 * whenever it runs there is a realistic mix: past (stale), ongoing, upcoming and cancelled.
 */
export async function loadDemoData(now = new Date()) {
  const at = (ms: number) => new Date(now.getTime() + ms);
  const window = (openIn: number, closeIn: number, subStartIn: number, subEndIn: number, resultIn: number) => ({
    registrationOpensAt: at(openIn),
    registrationClosesAt: at(closeIn),
    submissionStartsAt: at(subStartIn),
    submissionEndsAt: at(subEndIn),
    resultAt: at(resultIn),
  });

  // --- Users ---------------------------------------------------------------
  const [organizer, demo] = await UserModel.create([
    { name: 'Feedants Team', phone: ORGANIZER_PHONE, avatarUrl: avatar('women', 90), city: 'Bengaluru', bio: 'Official Feedants competitions.' },
    { name: 'Demo User', phone: DEMO_PHONE, avatarUrl: avatar('men', 32), city: 'Pune', bio: 'Kathak learner. Loves Sunday rehearsals.' },
  ]);
  const participants = await UserModel.insertMany(
    Array.from({ length: 20 }, (_, i) => ({
      name: `Participant ${i + 1}`,
      phone: `90000000${String(i).padStart(2, '0')}`,
      avatarUrl: avatar(i % 2 ? 'men' : 'women', 10 + i),
    })),
  );

  // --- Judges --------------------------------------------------------------
  const [manju, ravi, meera] = await JudgeModel.insertMany([
    { name: 'Manju Dubey', title: { en: 'Professional Kathak Dancer', hi: 'पेशेवर कथक नृत्यांगना' }, experienceYears: 12, avatarUrl: avatar('women', 44), introVideoUrl: SAMPLE_VIDEO, createdBy: organizer._id },
    { name: 'Ravi Menon', title: { en: 'Folk Dance Choreographer', hi: 'लोक नृत्य कोरियोग्राफर' }, experienceYears: 15, avatarUrl: avatar('men', 52), introVideoUrl: SAMPLE_VIDEO, createdBy: organizer._id },
    { name: 'Meera Iyer', title: { en: 'Photographer & Writer', hi: 'फ़ोटोग्राफ़र और लेखिका' }, experienceYears: 9, avatarUrl: avatar('women', 47), introVideoUrl: SAMPLE_VIDEO, createdBy: organizer._id },
  ]);

  const owned = { organizerId: organizer._id, status: 'published' as const };

  // --- ONGOING -------------------------------------------------------------
  // The design screen: registration open, closes in ~1d 6h 28m, submissions already open, 1/20 booked.
  const closesAt = 1 * DAY + 6 * HOUR + 28 * MIN + 32_000;
  const classical = await CompetitionModel.create({
    ...baseCompetition,
    ...owned,
    slug: 'feedants-classical-dance-2026',
    seriesId: 'classical-dance',
    title: { en: 'Feedants Classical Dance', hi: 'फीडएंट्स शास्त्रीय नृत्य' },
    seats: { total: 20, confirmed: 1, held: 0 },
    timeline: window(-5 * DAY, closesAt, -3 * DAY, closesAt + 20 * DAY, closesAt + 22 * DAY),
    judgeIds: [manju._id],
  });

  // Registration open but every spot taken.
  const folk = await CompetitionModel.create({
    ...baseCompetition,
    ...owned,
    slug: 'feedants-folk-dance-2026',
    seriesId: 'folk-dance',
    title: { en: 'Feedants Folk Dance', hi: 'फीडएंट्स लोक नृत्य' },
    seats: { total: 20, confirmed: 20, held: 0 },
    timeline: window(-4 * DAY, 3 * DAY, 1 * DAY, 12 * DAY, 14 * DAY),
    judgeIds: [ravi._id],
  });

  // Registration closed, submissions still open (free entry).
  const photo = await CompetitionModel.create({
    ...simpleCompetition({
      category: 'photography',
      en: 'Street Photography Walk',
      hi: 'स्ट्रीट फ़ोटोग्राफ़ी वॉक',
      tag: { en: 'Photography', hi: 'फ़ोटोग्राफ़ी' },
      about: { en: 'Capture the everyday life of your city in one photograph.', hi: 'एक तस्वीर में अपने शहर की रोज़मर्रा की ज़िंदगी कैद करें।' },
      entryFee: 0,
      rewards: [30000, 20000, 10000],
    }),
    ...owned,
    slug: 'street-photography-walk',
    seriesId: 'street-photography',
    seats: { total: 25, confirmed: 8, held: 0 },
    timeline: window(-10 * DAY, -1 * DAY, -8 * DAY, 4 * DAY, 6 * DAY),
    judgeIds: [meera._id],
  });

  // --- UPCOMING ------------------------------------------------------------
  const semi = await CompetitionModel.create({
    ...baseCompetition,
    ...owned,
    slug: 'feedants-semi-classical-2026',
    seriesId: 'semi-classical',
    title: { en: 'Feedants Semi-Classical Dance', hi: 'फीडएंट्स अर्ध-शास्त्रीय नृत्य' },
    seats: { total: 30, confirmed: 0, held: 0 },
    timeline: window(3 * DAY, 10 * DAY, 5 * DAY, 17 * DAY, 19 * DAY),
    judgeIds: [manju._id],
  });

  const poetry = await CompetitionModel.create({
    ...simpleCompetition({
      category: 'writing',
      en: 'Hindi Poetry Slam',
      hi: 'हिंदी कविता स्लैम',
      tag: { en: 'Poetry', hi: 'कविता' },
      about: { en: 'Write and perform an original Hindi poem of up to 2 minutes.', hi: 'अधिकतम 2 मिनट की मौलिक हिंदी कविता लिखें और प्रस्तुत करें।' },
      entryFee: 4900,
      rewards: [40000, 25000, 15000],
    }),
    ...owned,
    slug: 'hindi-poetry-slam',
    seriesId: 'poetry-slam',
    seats: { total: 40, confirmed: 0, held: 0 },
    timeline: window(10 * DAY, 20 * DAY, 12 * DAY, 27 * DAY, 30 * DAY),
    judgeIds: [meera._id],
  });

  // --- PAST (stale) --------------------------------------------------------
  // The previous edition of the design competition: finished a month ago. The demo user took
  // part, so they can rate it; its winners show up as "Previous Winners".
  const classicalPast = await CompetitionModel.create({
    ...baseCompetition,
    ...owned,
    slug: 'feedants-classical-dance-spring',
    seriesId: 'classical-dance',
    title: { en: 'Feedants Classical Dance: Spring Edition', hi: 'फीडएंट्स शास्त्रीय नृत्य: वसंत संस्करण' },
    seats: { total: 20, confirmed: 12, held: 0 },
    timeline: window(-60 * DAY, -45 * DAY, -50 * DAY, -35 * DAY, -30 * DAY),
    judgeIds: [manju._id],
  });

  const singing = await CompetitionModel.create({
    ...simpleCompetition({
      category: 'singing',
      en: 'Monsoon Singing Showdown',
      hi: 'मानसून गायन मुकाबला',
      tag: { en: 'Singing', hi: 'गायन' },
      about: { en: 'Sing a monsoon classic in your own style.', hi: 'अपने अंदाज़ में एक मानसून क्लासिक गाएँ।' },
      entryFee: 4900,
      rewards: [50000, 30000, 20000],
    }),
    ...owned,
    slug: 'monsoon-singing-showdown',
    seriesId: 'singing-showdown',
    seats: { total: 20, confirmed: 15, held: 0 },
    timeline: window(-100 * DAY, -85 * DAY, -90 * DAY, -80 * DAY, -75 * DAY),
    judgeIds: [ravi._id],
  });

  // Cancelled before it started.
  await CompetitionModel.create({
    ...simpleCompetition({
      category: 'comedy',
      en: 'Stand-up Comedy Open Mic',
      hi: 'स्टैंड-अप कॉमेडी ओपन माइक',
      tag: { en: 'Comedy', hi: 'कॉमेडी' },
      about: { en: 'Five minutes of your best original material.', hi: 'आपकी सबसे अच्छी मौलिक सामग्री के पाँच मिनट।' },
      entryFee: 9900,
      rewards: [30000, 20000],
    }),
    organizerId: organizer._id,
    status: 'cancelled',
    slug: 'standup-comedy-open-mic',
    seriesId: 'comedy-open-mic',
    seats: { total: 15, confirmed: 0, held: 0 },
    timeline: window(2 * DAY, 9 * DAY, 4 * DAY, 15 * DAY, 18 * DAY),
    judgeIds: [ravi._id],
  });

  // --- Winners ("Previous Winners" of the classical series) -------------------
  const pastResult = { competitionId: classicalPast._id, seriesId: 'classical-dance', awardedAt: classicalPast.timeline.resultAt, videoUrl: SAMPLE_VIDEO_2 };
  await CompetitionResultModel.insertMany([
    { ...pastResult, userId: participants[1]._id, displayName: 'Riya Shah', avatarUrl: avatar('women', 65), position: 1 },
    { ...pastResult, userId: participants[2]._id, displayName: 'Neha Verma', avatarUrl: avatar('women', 68), position: 2 },
    { ...pastResult, userId: participants[3]._id, displayName: 'Ishita Chopra', avatarUrl: avatar('women', 72), position: 3 },
    // An edition from before the platform existed: only the result is known.
    { seriesId: 'classical-dance', edition: String(now.getFullYear() - 2), displayName: 'Aarav Mehta', avatarUrl: avatar('men', 75), position: 1, awardedAt: at(-400 * DAY), videoUrl: SAMPLE_VIDEO },
  ]);

  // --- Registrations matching the seat counters -----------------------------
  const confirmed = (competition: { _id: unknown; entryFee: number }, userId: unknown) => ({
    competitionId: competition._id,
    userId,
    status: 'confirmed',
    amount: competition.entryFee,
    currency: 'INR',
    confirmedAt: now,
    ...(competition.entryFee > 0 && {
      payment: { provider: 'mock', orderId: `order_seed_${String(competition._id)}_${String(userId)}`, paymentId: `pay_seed_${String(userId)}`, verifiedAt: now },
    }),
  });
  const registrations = await RegistrationModel.insertMany([
    confirmed(classical, participants[0]._id),
    ...participants.slice(0, 20).map((u) => confirmed(folk, u._id)),
    ...participants.slice(0, 8).map((u) => confirmed(photo, u._id)),
    confirmed(classicalPast, demo._id),
    ...participants.slice(0, 11).map((u) => confirmed(classicalPast, u._id)),
    ...participants.slice(5, 20).map((u) => confirmed(singing, u._id)),
  ]);

  // --- Submissions: whoever registered for a finished competition but never submitted is a no-show.
  const submitted: [typeof classicalPast, unknown[]][] = [
    [classicalPast, [demo._id, ...participants.slice(0, 9).map((u) => u._id)]], // participants 10, 11 are no-shows
    [singing, participants.slice(5, 18).map((u) => u._id)], // participants 19, 20 are no-shows
    [photo, participants.slice(0, 5).map((u) => u._id)], // still open
  ];
  await SubmissionModel.insertMany(
    submitted.flatMap(([c, userIds]) =>
      userIds.map((userId) => ({
        competitionId: c._id,
        userId,
        registrationId: registrations.find((r) => String(r.competitionId) === String(c._id) && String(r.userId) === String(userId))!._id,
        media: { storageKey: SAMPLE_VIDEO, mimeType: 'video/mp4', sizeBytes: 2_500_000 },
        submittedAt: c.timeline.submissionStartsAt,
      })),
    ),
  );

  // --- Sportsmanship: participants of the spring edition rating each other ---
  const peers: [unknown, unknown, number][] = [
    [participants[0]._id, demo._id, 5],
    [participants[1]._id, demo._id, 4],
    [participants[2]._id, demo._id, 5],
    [participants[3]._id, demo._id, 5],
    [participants[0]._id, participants[1]._id, 5],
    [participants[2]._id, participants[1]._id, 4],
    [participants[1]._id, participants[9]._id, 2],
    [participants[4]._id, participants[10]._id, 3],
  ];
  await PeerRatingModel.insertMany(peers.map(([raterId, rateeId, stars]) => ({ competitionId: classicalPast._id, raterId, rateeId, stars })));
  const totals = new Map<string, { count: number; sum: number }>();
  for (const [, rateeId, stars] of peers) {
    const cur = totals.get(String(rateeId)) ?? { count: 0, sum: 0 };
    totals.set(String(rateeId), { count: cur.count + 1, sum: cur.sum + stars });
  }
  await Promise.all([...totals].map(([id, sportsmanship]) => UserModel.updateOne({ _id: id }, { $set: { sportsmanship } })));

  // --- Ratings of past competitions, with totals kept in sync ----------------
  const reviews: [typeof classicalPast, number, number, number, string][] = [
    [classicalPast, 0, 5, 5, 'Loved the feedback from the judge.'],
    [classicalPast, 1, 5, 4, 'Smooth from registration to results.'],
    [classicalPast, 2, 4, 5, ''],
    [classicalPast, 4, 4, 4, 'Great competition, results were on time.'],
    [classicalPast, 5, 5, 5, ''],
    [singing, 5, 4, 4, 'Fun theme!'],
    [singing, 6, 3, 4, 'Judging criteria could be clearer.'],
    [singing, 7, 5, 5, ''],
    [singing, 8, 4, 3, ''],
  ];
  await RatingModel.insertMany(
    reviews.map(([c, p, competitionStars, organizerStars, comment]) => ({
      competitionId: c._id,
      organizerId: organizer._id,
      userId: participants[p]._id,
      competitionStars,
      organizerStars,
      ...(comment && { comment }),
    })),
  );
  for (const c of [classicalPast, singing]) {
    const mine = reviews.filter(([rc]) => rc === c);
    await CompetitionModel.updateOne({ _id: c._id }, { $set: { rating: { count: mine.length, sum: mine.reduce((s, r) => s + r[2], 0) } } });
  }
  await UserModel.updateOne({ _id: organizer._id }, { $set: { organizerRating: { count: reviews.length, sum: reviews.reduce((s, r) => s + r[3], 0) } } });

  // --- Testimonials ----------------------------------------------------------
  await TestimonialModel.insertMany([
    { userName: 'Ananya R.', avatarUrl: avatar('women', 21), rating: 5, text: { en: 'Loved performing from home. The judge feedback was really helpful!', hi: 'घर से प्रस्तुति देना बहुत अच्छा लगा। निर्णायक की प्रतिक्रिया बहुत उपयोगी थी!' } },
    { userName: 'Karthik S.', avatarUrl: avatar('men', 22), rating: 5, text: { en: 'Prize money reached my account within a week of results.', hi: 'परिणाम के एक सप्ताह के भीतर पुरस्कार राशि मेरे खाते में आ गई।' } },
    { userName: 'Pooja M.', avatarUrl: avatar('women', 23), rating: 4, text: { en: 'Smooth registration and a fair competition.', hi: 'आसान पंजीकरण और निष्पक्ष प्रतियोगिता।' } },
  ]);

  return {
    competitions: {
      ongoing: [classical.slug, folk.slug, photo.slug],
      upcoming: [semi.slug, poetry.slug],
      past: [classicalPast.slug, singing.slug],
      cancelled: ['standup-comedy-open-mic'],
    },
  };
}

/**
 * First start on an empty database: load the demo data exactly once, even if several API
 * instances boot at the same time (a unique marker document decides who does it).
 */
export async function loadDemoDataIfEmpty(): Promise<boolean> {
  if ((await CompetitionModel.estimatedDocumentCount()) > 0) return false;
  const meta = mongoose.connection.collection<{ _id: string; at: Date }>('meta');
  try {
    await meta.insertOne({ _id: 'demo-data', at: new Date() });
  } catch (err) {
    if ((err as { code?: number }).code === 11000) return false; // another instance is loading it
    throw err;
  }
  await loadDemoData();
  return true;
}
