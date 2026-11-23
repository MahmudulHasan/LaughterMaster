// Pure demo data for the dev seed script (PLAN.md M4 "Seed script").
// Kept free of database code so it can be unit-tested on its own.

import { DEV_USERS } from "../src/server/auth/dev-users";
import type { DevUser } from "../src/server/auth/types";
import type { NewJoke } from "../src/server/db/schema";
import { normalizeJokeText } from "../src/server/jokes/queries";

const HOUR_MS = 60 * 60 * 1000;

export const SEED_USERS: readonly DevUser[] = DEV_USERS;

const [MINA, PRIYA, ADMIN] = ["dev-mina", "dev-priya", "dev-admin"] as const;

export type SeedJoke = {
  /** Deterministic id, so re-running the seed skips existing rows. */
  id: string;
  authorId: string;
  text: string;
  /** How long before the seed run the joke was "posted". */
  hoursAgo: number;
};

// All jokes are original, clean and family-friendly. Category stays null
// until Claude categorizes jokes (M5).
const JOKES: ReadonlyArray<Omit<SeedJoke, "id">> = [
  // Last 24 hours (feeds the M4 top 10). At most 4 per member, so the
  // 10-posts-per-day limit still leaves room to post by hand.
  {
    authorId: MINA,
    hoursAgo: 0.5,
    text: "My houseplant and I have an agreement: I forget to water it, and it forgets to grow.",
  },
  {
    authorId: PRIYA,
    hoursAgo: 1.25,
    text: "I told my calendar a joke about Mondays. It didn't laugh, it just booked a meeting.",
  },
  {
    authorId: ADMIN,
    hoursAgo: 2,
    text: "Knock, knock.\nWho's there?\nLettuce.\nLettuce who?\nLettuce in, the soup is getting cold!",
  },
  {
    authorId: MINA,
    hoursAgo: 3.5,
    text: "¿Por qué el libro de matemáticas estaba triste? Porque tenía demasiados problemas.",
  },
  {
    authorId: PRIYA,
    hoursAgo: 5,
    text: "My phone's battery and my motivation have the same schedule: 100% at 7 a.m., 2% by lunch.",
  },
  {
    authorId: ADMIN,
    hoursAgo: 7,
    text: "I bought a ceiling fan for my office. Now my paperwork finally has followers. 🌀📄",
  },
  {
    authorId: MINA,
    hoursAgo: 9,
    text: "The cloud called. It wants its storage back, but it won't say where it put it.",
  },
  {
    authorId: PRIYA,
    hoursAgo: 11.5,
    text: "टीचर: तुम्हारा होमवर्क कहाँ है?\nछात्र: वो वाई-फ़ाई से कनेक्ट होने का इंतज़ार कर रहा है।",
  },
  {
    authorId: ADMIN,
    hoursAgo: 14,
    text: "Why did the scarecrow get a promotion? He was outstanding in his field, and he never left early.",
  },
  {
    authorId: MINA,
    hoursAgo: 18,
    text: "왜 컴퓨터는 바다에 가지 않을까요? 웹 서핑만으로도 충분하니까요!",
  },
  {
    authorId: PRIYA,
    hoursAgo: 22,
    text: "I tried to organize a hide-and-seek tournament. Good players are really hard to find.",
  },
  // Days 2–7 (feeds "From this week" and the lists).
  {
    authorId: ADMIN,
    hoursAgo: 27,
    text: 'My GPS has started saying "recalculating" in the same tone my mom uses for my life choices.',
  },
  {
    authorId: MINA,
    hoursAgo: 31,
    text: "Knock, knock.\nWho's there?\nWi.\nWi who?\nWi-Fi password, please. I'm not leaving until I get it.",
  },
  {
    authorId: PRIYA,
    hoursAgo: 35,
    text: "Why did the tomato blush? It saw the salad dressing.",
  },
  {
    authorId: ADMIN,
    hoursAgo: 40,
    text: "My umbrella and I have trust issues. It only shows up when the sun is out.",
  },
  {
    authorId: MINA,
    hoursAgo: 45,
    text: "My cat knocked my coffee off the table, then looked at me like I'd forgotten to say thank you.",
  },
  {
    authorId: PRIYA,
    hoursAgo: 50,
    text: "—Mamá, ¿puedo ir a jugar?\n—¿Con esos calcetines rotos?\n—No, con mis amigos.",
  },
  {
    authorId: ADMIN,
    hoursAgo: 56,
    text: "The bicycle couldn't stand up on its own. It was two-tired.",
  },
  {
    authorId: MINA,
    hoursAgo: 62,
    text: 'I asked the librarian for books about paranoia. She whispered, "They\'re right behind you."',
  },
  {
    authorId: PRIYA,
    hoursAgo: 68,
    text: "Knock, knock.\nWho's there?\nOwls say.\nOwls say who?\nYes, they do. Every single night. 🦉",
  },
  {
    authorId: ADMIN,
    hoursAgo: 74,
    text: 'My smart fridge sent me a notification: "We need to talk about the leftovers."',
  },
  {
    authorId: MINA,
    hoursAgo: 80,
    text: "Why don't skeletons fight each other? They don't have the guts, or the free time.",
  },
  {
    authorId: PRIYA,
    hoursAgo: 86,
    text: "I started a band called Duvet. We're a cover band.",
  },
  {
    authorId: ADMIN,
    hoursAgo: 92,
    text: "엄마: 방 청소했니?\n아들: 네, 마음속으로요.",
  },
  {
    authorId: MINA,
    hoursAgo: 98,
    text: "My alarm clock and I broke up. It kept waking me up for things I didn't care about.",
  },
  {
    authorId: PRIYA,
    hoursAgo: 104,
    text: "Why was the math teacher late? She took the long division.",
  },
  {
    authorId: ADMIN,
    hoursAgo: 110,
    text: "Knock, knock.\nWho's there?\nInterrupting cow.\nInterrupting c—\nMOO!",
  },
  {
    authorId: MINA,
    hoursAgo: 116,
    text: "मेरा अलार्म रोज़ सुबह बजता है, और मैं रोज़ उसे माफ़ कर देता हूँ। सच्ची दोस्ती यही है।",
  },
  {
    authorId: PRIYA,
    hoursAgo: 122,
    text: "I tried juggling for a week. I kept dropping everything, so now I call it gravity research.",
  },
  {
    authorId: ADMIN,
    hoursAgo: 128,
    text: "Parallel lines have so much in common. It's a shame they'll never meet.",
  },
  {
    authorId: MINA,
    hoursAgo: 134,
    text: "Why did the cookie go to the doctor? It was feeling a little crumby.",
  },
  {
    authorId: PRIYA,
    hoursAgo: 140,
    text: 'My running app says I\'ve burned 300 calories. My snack drawer says, "Welcome back." 🍪',
  },
  // Bangla (বাংলা) jokes, added on request.
  {
    authorId: ADMIN,
    hoursAgo: 6,
    text: "আমার অ্যালার্ম ঘড়ি আর আমি একটা চুক্তি করেছি: ও রোজ সকালে বাজবে, আর আমি রোজ সকালে শুনব না।",
  },
  {
    authorId: MINA,
    hoursAgo: 28,
    text: "ডাক্তার: আপনি কি রোজ হাঁটেন?\nরোগী: জি, ফ্রিজ পর্যন্ত। দিনে দশবার।",
  },
  {
    authorId: PRIYA,
    hoursAgo: 60,
    text: "শিক্ষক: বলো তো, পৃথিবী গোল কেন?\nছাত্র: স্যার, চারকোনা হলে কোণায় দাঁড়ানো মানুষগুলো তো পড়ে যেত!",
  },
  {
    authorId: ADMIN,
    hoursAgo: 113,
    text: "বাবা: পরীক্ষায় এত কম নম্বর কেন?\nছেলে: প্রশ্নগুলো সব সিলেবাসের বাইরে ছিল।\nবাবা: কোন সিলেবাস?\nছেলে: আমি যেটুকু পড়েছিলাম!",
  },
];

export const SEED_JOKES: readonly SeedJoke[] = JOKES.map((joke, index) => ({
  ...joke,
  id: `seed-${String(index + 1).padStart(2, "0")}`,
}));

/** Database rows for the seed jokes, dated relative to `now`. */
export function buildJokeRows(now: Date): NewJoke[] {
  return SEED_JOKES.map((joke) => {
    const createdAt = new Date(now.getTime() - joke.hoursAgo * HOUR_MS);
    const text = joke.text.trim();
    return {
      id: joke.id,
      authorId: joke.authorId,
      text,
      normalizedText: normalizeJokeText(text),
      status: "approved",
      category: null,
      isBot: false,
      createdAt,
      updatedAt: createdAt,
    };
  });
}
