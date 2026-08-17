export const THEME_IDS = [
  "himalayan",
  "sage",
  "cosmic",
  "galaxy",
  "ocean",
] as const;

export type ThemeId = (typeof THEME_IDS)[number];

export const THEME_STORAGE_KEY = "swr-theme";
export const DEFAULT_THEME: ThemeId = "himalayan";

export interface ThemeDefinition {
  id: ThemeId;
  /** Section number used in the overview grid, e.g. "1." */
  number: string;
  /** ALL CAPS name as shown in the switcher + nav, e.g. "THE WILD" */
  name: string;
  shortName: string;
  /** Short subtitle, e.g. "Himalayan / Earth" */
  subtitle: string;
  description: string;
  mood: string;
  /** Three-swatch palette for the overview page. */
  swatches: [string, string, string];
  heroImage: string;
  roomImages: string[];
  /**
   * Hero copy. `title` is the first line; `accent` is rendered in the
   * Italianno-style script font and floats on the second line of the
   * title block. `body` sits below the title.
   */
  hero: {
    eyebrow: string;
    title: string;
    accent: string;
    body: string;
  };
}

export const THEMES: Record<ThemeId, ThemeDefinition> = {
  /* 1. THE WILD — Himalayan / Earth. */
  himalayan: {
    id: "himalayan",
    number: "1",
    name: "The Wild",
    shortName: "Wild",
    subtitle: "Himalayan / Earth",
    description: "Misty forest lodge, infinity pool, lantern light.",
    mood: "Luxury nature",
    swatches: ["#1B2A22", "#3A4F3D", "#E7D5A6"],
    heroImage: "/themes/himalayan/hero.jpg?v=10",
    roomImages: [
      "/themes/himalayan/room-1.jpg?v=4",
      "/themes/himalayan/room-2.jpg?v=4",
      "/themes/himalayan/room-3.jpg?v=10",
    ],
    hero: {
      eyebrow: "HIMALAYAS. SERENITY. YOU.",
      title: "Where Nature",
      accent: "Meets Luxury",
      body: "A serene escape in the heart of Pithoragarh, where mountains, rivers and memories create the perfect stay.",
    },
  },

  /* 2. THE OCEAN — Ocean Sanctuary. */
  ocean: {
    id: "ocean",
    number: "2",
    name: "The Ocean",
    shortName: "Ocean",
    subtitle: "Ocean Sanctuary",
    description: "Circular overwater villa on dark teal water.",
    mood: "Nocturnal ocean",
    swatches: ["#0A2540", "#1E6FA8", "#A7E0F2"],
    heroImage: "/themes/ocean/hero.jpg?v=10",
    roomImages: [
      "/themes/ocean/room-1.jpg?v=4",
      "/themes/ocean/room-2.jpg?v=4",
      "/themes/ocean/hero.jpg?v=10",
    ],
    hero: {
      eyebrow: "NOWHERE NEAR. EVERYTHING WITHIN.",
      title: "Lost in Water.",
      accent: "Found in Luxury.",
      body: "In the middle of endless blue, we've created a world of our own.",
    },
  },

  /* 3. THE INFINITE — Interstellar Space. */
  galaxy: {
    id: "galaxy",
    number: "3",
    name: "The Infinite",
    shortName: "Infinite",
    subtitle: "Interstellar Space",
    description: "A terrace at the edge of a violet spiral galaxy.",
    mood: "Royal cosmic",
    swatches: ["#0A0814", "#7A4FE0", "#D9C8FF"],
    heroImage: "/themes/galaxy/hero.jpg?v=10",
    roomImages: [
      "/themes/galaxy/room-1.jpg?v=4",
      "/themes/galaxy/room-2.jpg?v=10",
      "/themes/galaxy/hero.jpg?v=10",
    ],
    hero: {
      eyebrow: "BEYOND PLANETS. BEYOND TIME.",
      title: "A Sanctuary in the",
      accent: "Infinite Universe",
      body: "An experience so rare, it exists beyond imagination. Discover luxury at the edge of infinity.",
    },
  },

  /* 4. THE ANCIENT — Prehistoric Earth. */
  sage: {
    id: "sage",
    number: "4",
    name: "The Ancient",
    shortName: "Ancient",
    subtitle: "Prehistoric Earth",
    description: "Volcanic jungles, stone lodges, the age of giants.",
    mood: "Prehistoric, warm",
    swatches: ["#1A1207", "#7A5326", "#F2C679"],
    heroImage: "/themes/sage/hero.jpg?v=10",
    roomImages: [
      "/themes/sage/room-1.jpg?v=4",
      "/themes/sage/room-2.jpg?v=4",
      "/themes/sage/hero.jpg?v=10",
    ],
    hero: {
      eyebrow: "BEFORE TIME. BEYOND IMAGINATION.",
      title: "Before Time.",
      accent: "Beyond Imagination.",
      body: "Step into a land untouched for millions of years.",
    },
  },

  /* 5. AFTER DARK — Midnight Sanctuary. */
  cosmic: {
    id: "cosmic",
    number: "5",
    name: "After Dark",
    shortName: "After Dark",
    subtitle: "Midnight Sanctuary",
    description: "Cabin in the pines, a bonfire, and the silence after midnight.",
    mood: "Nocturnal, hushed",
    swatches: ["#050912", "#1F3050", "#9FB6D6"],
    heroImage: "/themes/cosmic/hero.jpg?v=10",
    roomImages: [
      "/themes/cosmic/room-1.jpg?v=4",
      "/themes/cosmic/room-2.jpg?v=4",
      "/themes/cosmic/hero.jpg?v=10",
    ],
    hero: {
      eyebrow: "SILENCE. STARS. SERENITY.",
      title: "After Midnight.",
      accent: "Another World.",
      body: "Silence. Stars. Serenity. Just for you.",
    },
  },
};

export const THEME_LIST = THEME_IDS.map((id) => THEMES[id]);

export function isThemeId(value: unknown): value is ThemeId {
  return typeof value === "string" && (THEME_IDS as readonly string[]).includes(value);
}
