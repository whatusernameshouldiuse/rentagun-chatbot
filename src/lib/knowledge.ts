import { readFileSync } from 'fs';
import { join } from 'path';

// Knowledge base content
const KNOWLEDGE_DIR = join(process.cwd(), 'src', 'knowledge');

interface KnowledgeBase {
  faq: string;
  pricing: string;
  fflProcess: string;
  shipping: string;
  stateRestrictions: string;
  brandVoice: string;
}

let knowledgeCache: KnowledgeBase | null = null;

/**
 * Load all knowledge base files
 * Caches the content for performance
 */
export function loadKnowledge(): KnowledgeBase {
  if (knowledgeCache) {
    return knowledgeCache;
  }

  try {
    knowledgeCache = {
      faq: readFileSync(join(KNOWLEDGE_DIR, 'faq.md'), 'utf-8'),
      pricing: readFileSync(join(KNOWLEDGE_DIR, 'pricing.md'), 'utf-8'),
      fflProcess: readFileSync(join(KNOWLEDGE_DIR, 'ffl-process.md'), 'utf-8'),
      shipping: readFileSync(join(KNOWLEDGE_DIR, 'shipping.md'), 'utf-8'),
      stateRestrictions: readFileSync(
        join(KNOWLEDGE_DIR, 'state-restrictions.md'),
        'utf-8'
      ),
      brandVoice: readFileSync(join(KNOWLEDGE_DIR, 'brand-voice.md'), 'utf-8'),
    };
    return knowledgeCache;
  } catch (error) {
    console.error('Failed to load knowledge base:', error);
    // Return empty strings if files not found (for testing)
    return {
      faq: '',
      pricing: '',
      fflProcess: '',
      shipping: '',
      stateRestrictions: '',
      brandVoice: '',
    };
  }
}

/**
 * Get knowledge relevant to a specific topic
 */
export function getTopicKnowledge(topic: KnowledgeTopic): string {
  const knowledge = loadKnowledge();

  switch (topic) {
    case 'faq':
    case 'general':
    case 'how-it-works':
    case 'legal':
      return knowledge.faq;

    case 'pricing':
    case 'cost':
    case 'subscription':
      return knowledge.pricing;

    case 'ffl':
    case 'pickup':
    case 'background-check':
    case '4473':
      return knowledge.fflProcess;

    case 'shipping':
    case 'return':
    case 'fedex':
    case 'tracking':
      return knowledge.shipping;

    case 'states':
    case 'restrictions':
    case 'california':
      return knowledge.stateRestrictions;

    case 'brand':
    case 'voice':
      return knowledge.brandVoice;

    default:
      return '';
  }
}

export type KnowledgeTopic =
  | 'faq'
  | 'general'
  | 'how-it-works'
  | 'legal'
  | 'pricing'
  | 'cost'
  | 'subscription'
  | 'ffl'
  | 'pickup'
  | 'background-check'
  | '4473'
  | 'shipping'
  | 'return'
  | 'fedex'
  | 'tracking'
  | 'states'
  | 'restrictions'
  | 'california'
  | 'brand'
  | 'voice';

/**
 * Get all knowledge as a combined string
 */
export function getAllKnowledge(): string {
  const knowledge = loadKnowledge();

  return `
${knowledge.brandVoice}

---

${knowledge.faq}

---

${knowledge.pricing}

---

${knowledge.fflProcess}

---

${knowledge.shipping}

---

${knowledge.stateRestrictions}
`.trim();
}

/**
 * Clear the knowledge cache (for testing or hot reload)
 */
export function clearKnowledgeCache(): void {
  knowledgeCache = null;
}
