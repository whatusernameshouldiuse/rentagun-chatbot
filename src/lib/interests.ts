/**
 * Interest Extraction from Chat Conversations
 * Analyzes conversation history to identify user interests for Klaviyo segmentation
 */

import type { ChatMessage } from '@/types';

export interface UserInterests {
  use_case?: 'home_defense' | 'range_fun' | 'try_before_buy' | 'hunting' | 'first_gun';
  categories: string[];
  products_viewed: string[];
  urgency: 'immediate' | 'this_week' | 'browsing';
  price_sensitivity: 'budget' | 'moderate' | 'premium' | 'unknown';
}

// Keywords for use case detection
const USE_CASE_PATTERNS: Record<string, string[]> = {
  home_defense: [
    'home defense',
    'home-defense',
    'intruder',
    'protect',
    'protection',
    'night stand',
    'nightstand',
    'self defense',
    'self-defense',
    'break in',
    'break-in',
    'security',
    'safe at home',
  ],
  range_fun: [
    'range',
    'fun',
    'shoot for fun',
    'recreational',
    'weekend',
    'bachelor',
    'birthday',
    'party',
    'experience',
    'bucket list',
    'always wanted to',
    'cool',
    'awesome',
    'thompson',
    'desert eagle',
  ],
  try_before_buy: [
    'buying',
    'purchase',
    'try first',
    'try before',
    'considering',
    'thinking about buying',
    'want to buy',
    'looking to buy',
    'before I buy',
    'test before',
    'test it out',
    'see if I like',
  ],
  hunting: [
    'hunt',
    'hunting',
    'deer',
    'elk',
    'hog',
    'boar',
    'duck',
    'bird',
    'season',
    'game',
    'wilderness',
    'outdoors',
    'rifle for',
  ],
  first_gun: [
    'first gun',
    'first firearm',
    'never owned',
    'new to guns',
    'beginner',
    'new shooter',
    'getting started',
    'just starting',
    'learn',
    'first time',
    'newbie',
  ],
};

// Keywords for category detection
const CATEGORY_PATTERNS: Record<string, string[]> = {
  pistols: [
    'pistol',
    'handgun',
    'glock',
    '9mm',
    '.45',
    '380',
    'compact',
    'concealed',
    'carry',
    'revolver',
    'semi-auto pistol',
  ],
  rifles: [
    'rifle',
    'ar-15',
    'ar15',
    'carbine',
    'bolt action',
    'lever action',
    '.223',
    '5.56',
    '.308',
    '30-06',
    'long gun',
    'precision',
  ],
  shotguns: [
    'shotgun',
    '12 gauge',
    '20 gauge',
    'pump',
    'semi-auto shotgun',
    'over under',
    'double barrel',
    'bird gun',
    'clay',
    'trap',
    'skeet',
  ],
};

// Keywords for urgency detection
const URGENCY_PATTERNS = {
  immediate: [
    'today',
    'tonight',
    'asap',
    'right now',
    'immediately',
    'urgent',
    'this weekend',
    'tomorrow',
  ],
  this_week: ['this week', 'next few days', 'soon', 'shortly', 'upcoming'],
  browsing: ['just looking', 'curious', 'browsing', 'exploring', 'wondering', 'maybe', 'sometime'],
};

// Keywords for price sensitivity
const PRICE_PATTERNS = {
  budget: ['cheap', 'affordable', 'budget', 'inexpensive', 'low cost', 'basic tier', '$99'],
  premium: ['best', 'premium', 'high end', 'top of the line', 'pro tier', '$199', 'expensive is fine'],
};

/**
 * Extract interests from conversation history
 */
export function extractInterests(messages: ChatMessage[]): UserInterests {
  const interests: UserInterests = {
    categories: [],
    products_viewed: [],
    urgency: 'browsing',
    price_sensitivity: 'unknown',
  };

  // Combine all user messages for analysis
  const userText = messages
    .filter((m) => m.role === 'user')
    .map((m) => m.content.toLowerCase())
    .join(' ');

  // Detect use case
  for (const [useCase, patterns] of Object.entries(USE_CASE_PATTERNS)) {
    if (patterns.some((pattern) => userText.includes(pattern))) {
      interests.use_case = useCase as UserInterests['use_case'];
      break; // Take first match (priority order in object)
    }
  }

  // Detect categories
  for (const [category, patterns] of Object.entries(CATEGORY_PATTERNS)) {
    if (patterns.some((pattern) => userText.includes(pattern))) {
      if (!interests.categories.includes(category)) {
        interests.categories.push(category);
      }
    }
  }

  // Detect urgency
  for (const [urgency, patterns] of Object.entries(URGENCY_PATTERNS)) {
    if (patterns.some((pattern) => userText.includes(pattern))) {
      interests.urgency = urgency as UserInterests['urgency'];
      break;
    }
  }

  // Detect price sensitivity
  if (PRICE_PATTERNS.budget.some((p) => userText.includes(p))) {
    interests.price_sensitivity = 'budget';
  } else if (PRICE_PATTERNS.premium.some((p) => userText.includes(p))) {
    interests.price_sensitivity = 'premium';
  } else if (
    userText.includes('price') ||
    userText.includes('cost') ||
    userText.includes('how much')
  ) {
    interests.price_sensitivity = 'moderate';
  }

  // Extract product names from bot responses (products shown)
  const botResponses = messages.filter((m) => m.role === 'assistant').map((m) => m.content);
  const productNamePattern =
    /(?:Glock|S&W|Smith & Wesson|Sig|SIG Sauer|Colt|Ruger|Beretta|Springfield|HK|Heckler|Kimber|Desert Eagle|Thompson|MP5|AUG|Python|Model \d+|M&P)[^,\n]*/gi;

  for (const response of botResponses) {
    const matches = response.match(productNamePattern);
    if (matches) {
      for (const match of matches) {
        const cleanName = match.trim();
        if (cleanName.length > 3 && !interests.products_viewed.includes(cleanName)) {
          interests.products_viewed.push(cleanName);
        }
      }
    }
  }

  // Limit products viewed to last 5
  if (interests.products_viewed.length > 5) {
    interests.products_viewed = interests.products_viewed.slice(-5);
  }

  return interests;
}

/**
 * Generate a brief conversation summary for Klaviyo
 */
export function summarizeForKlaviyo(messages: ChatMessage[], interests: UserInterests): string {
  const parts: string[] = [];

  if (interests.use_case) {
    const useCaseNames: Record<string, string> = {
      home_defense: 'home defense',
      range_fun: 'recreational shooting',
      try_before_buy: 'try before buying',
      hunting: 'hunting',
      first_gun: 'first-time ownership',
    };
    parts.push(`Interest: ${useCaseNames[interests.use_case]}`);
  }

  if (interests.categories.length > 0) {
    parts.push(`Categories: ${interests.categories.join(', ')}`);
  }

  if (interests.products_viewed.length > 0) {
    parts.push(`Viewed: ${interests.products_viewed.slice(0, 3).join(', ')}`);
  }

  if (interests.urgency !== 'browsing') {
    parts.push(`Urgency: ${interests.urgency.replace('_', ' ')}`);
  }

  return parts.length > 0 ? parts.join(' | ') : 'General inquiry';
}

/**
 * Convert interests to Klaviyo tags
 */
export function interestsToTags(interests: UserInterests): string[] {
  const tags: string[] = [];

  if (interests.use_case) {
    tags.push(`interest:${interests.use_case}`);
  }

  for (const category of interests.categories) {
    tags.push(`category:${category}`);
  }

  if (interests.urgency !== 'browsing') {
    tags.push(`urgency:${interests.urgency}`);
  }

  if (interests.price_sensitivity !== 'unknown') {
    tags.push(`price:${interests.price_sensitivity}`);
  }

  return tags;
}
