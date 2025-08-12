import { AIClient } from './aiClient';

const aiClient = new AIClient();

export interface KeywordExpansion {
  original: string;
  strongSynonyms: string[];
  weakSynonyms: string[];
}

export interface ExpansionPreview {
  exactPhrases: { text: string; enabled: boolean }[];
  strongSynonyms: { text: string; enabled: boolean }[];
  weakSynonyms: { text: string; enabled: boolean }[];
}

const EXPANSION_PROMPT = `You are a job search expert. Given job-related keywords/phrases, generate relevant synonyms and morphological variants in Russian and English.

For the keyword: "{keyword}"

Generate expansions in the following categories:
1. STRONG SYNONYMS: Direct synonyms, common alternative terms, and obvious morphological variants that are very relevant
2. WEAK SYNONYMS: Broader related terms, less common alternatives, or potentially ambiguous terms

Rules:
- Include both Russian and English variants when relevant
- Keep case variations and morphological forms (singular/plural, different word endings)
- For technical terms, include both full forms and abbreviations
- Limit strong synonyms to 4-6 terms max
- Limit weak synonyms to 3-4 terms max
- Focus on actual job market terminology used on HH.ru

Return ONLY a JSON object in this exact format:
{
  "strongSynonyms": ["synonym1", "synonym2", ...],
  "weakSynonyms": ["weak1", "weak2", ...]
}`;

export async function generateKeywordExpansions(keywords: string[]): Promise<KeywordExpansion[]> {
  const expansions: KeywordExpansion[] = [];
  
  for (const keyword of keywords) {
    try {
      const prompt = EXPANSION_PROMPT.replace('{keyword}', keyword);
      const response = await aiClient.generateJobTitles(keyword); // Use existing method
      const parsed = {
        strongSynonyms: response.slice(0, 6),
        weakSynonyms: response.slice(6, 10)
      };
      
      // parsed is already set above
      
      if (parsed && parsed.strongSynonyms && parsed.weakSynonyms) {
        expansions.push({
          original: keyword,
          strongSynonyms: parsed.strongSynonyms.slice(0, 6), // Cap at 6
          weakSynonyms: parsed.weakSynonyms.slice(0, 4)      // Cap at 4
        });
      }
    } catch (error) {
      console.warn(`Error generating expansions for "${keyword}":`, error);
      // Add empty expansion to maintain array structure
      expansions.push({
        original: keyword,
        strongSynonyms: [],
        weakSynonyms: []
      });
    }
  }
  
  return expansions;
}

export function createExpansionPreview(keywords: string[], expansions: KeywordExpansion[]): ExpansionPreview {
  // Extract quoted phrases (exact phrases - always enabled)
  const quotedPhrases = keywords
    .filter(k => k.startsWith('"') && k.endsWith('"'))
    .map(k => ({ text: k, enabled: true }));
  
  // Extract non-quoted keywords for expansion
  const nonQuotedKeywords = keywords.filter(k => !(k.startsWith('"') && k.endsWith('"')));
  
  // Collect all strong and weak synonyms
  const strongSynonyms: { text: string; enabled: boolean }[] = [];
  const weakSynonyms: { text: string; enabled: boolean }[] = [];
  
  expansions.forEach(expansion => {
    expansion.strongSynonyms.forEach(syn => {
      if (!strongSynonyms.some(s => s.text === syn)) {
        strongSynonyms.push({ text: syn, enabled: true }); // Strong synonyms default to checked
      }
    });
    expansion.weakSynonyms.forEach(syn => {
      if (!weakSynonyms.some(s => s.text === syn)) {
        weakSynonyms.push({ text: syn, enabled: false }); // Weak synonyms default to unchecked
      }
    });
  });
  
  // Add original non-quoted keywords to exact phrases
  const exactPhrases = [
    ...quotedPhrases,
    ...nonQuotedKeywords.map(k => ({ text: k, enabled: true }))
  ];
  
  // Cap total expansions to avoid noise
  const maxTotal = 12;
  const currentTotal = strongSynonyms.length + weakSynonyms.length;
  
  if (currentTotal > maxTotal) {
    const keepStrong = Math.min(strongSynonyms.length, 8);
    const keepWeak = Math.min(weakSynonyms.length, maxTotal - keepStrong);
    
    strongSynonyms.splice(keepStrong);
    weakSynonyms.splice(keepWeak);
  }
  
  return {
    exactPhrases,
    strongSynonyms,
    weakSynonyms
  };
}