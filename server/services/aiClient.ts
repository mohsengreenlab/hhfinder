import { GoogleGenerativeAI } from '@google/generative-ai';

const apiKey = process.env.GEMINI_API_KEY || '';
if (!apiKey) {
  console.error('GEMINI_API_KEY not found in environment variables');
} else {
  console.log('Gemini API key loaded, length:', apiKey.length);
}

const genAI = new GoogleGenerativeAI(apiKey);

export class AIClient {
  private model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
  private proModel = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });
  private lastRequestTime = 0;
  private readonly MIN_REQUEST_INTERVAL = 2000; // 2 seconds between requests

  private async waitForRateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    if (timeSinceLastRequest < this.MIN_REQUEST_INTERVAL) {
      const waitTime = this.MIN_REQUEST_INTERVAL - timeSinceLastRequest;
      console.log(`🕒 Rate limiting: waiting ${waitTime}ms before next AI request`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    this.lastRequestTime = Date.now();
  }

  private async makeAIRequest<T>(
    requestFn: () => Promise<T>,
    maxRetries: number = 3,
    baseDelay: number = 1000
  ): Promise<T> {
    await this.waitForRateLimit();
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await requestFn();
      } catch (error: any) {
        const isRetryable = error?.status === 503 || error?.status === 429 || error?.status === 500;
        
        if (!isRetryable || attempt === maxRetries) {
          throw error;
        }
        
        const delay = baseDelay * Math.pow(2, attempt - 1); // Exponential backoff
        console.log(`⚠️  AI request failed (attempt ${attempt}/${maxRetries}), retrying in ${delay}ms...`);
        console.log(`Error: ${error?.status} - ${error?.message}`);
        
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw new Error('Max retries exceeded');
  }

  // New 3-step structured approach
  async generateRussianSeedTerms(userInput: string): Promise<{
    exactPhrases: string[];
    strongSynonyms: string[];
    weakAmbiguous: string[];
    allowedEnglishAcronyms: string[];
  }> {
    try {
      // Step 1: Candidate Generation
      const { candidates, domain } = await this.generateJobCandidates(userInput);
      
      if (candidates.length === 0) {
        console.log('🔄 No candidates from AI - returning empty results (no fallback)');
        return {
          exactPhrases: [],
          strongSynonyms: [],
          weakAmbiguous: [],
          allowedEnglishAcronyms: []
        };
      }
      
      // Step 3: Ranking (skip vocabulary alignment for now)
      const rankedResults = await this.rankJobTitles(userInput, candidates);
      
      if (rankedResults.length === 0) {
        console.log('🔄 No ranked results - returning empty');
        return {
          exactPhrases: [],
          strongSynonyms: [],
          weakAmbiguous: [],
          allowedEnglishAcronyms: []
        };
      }
      
      // Convert ranked results to categorized format
      return this.convertRankedToCategorized(rankedResults);
      
    } catch (error) {
      console.error('Full AI pipeline failed:', error);
      // Return empty results instead of fallback as per new requirements
      return {
        exactPhrases: [],
        strongSynonyms: [],
        weakAmbiguous: [],
        allowedEnglishAcronyms: []
      };
    }
  }

  private async generateJobCandidates(userInput: string): Promise<{ candidates: string[]; domain: string }> {
    const systemMessage = `You help users search jobs on hh.ru (HeadHunter).
Return only JSON exactly matching the requested schema. No prose, no Markdown.
Rules:
1) Output Russian job titles (должности), nominative, market-common; include English only if it is common on hh.ru (e.g., QA, DevOps, Product Manager, Buyer).
2) No fallbacks: if uncertain, return an empty array and a short machine-readable note in "meta".
3) Ban generic shells without a domain: "менеджер", "специалист", "ассистент", "координатор", "руководитель" unless they include a domain lexeme (e.g., по закупкам/маркетингу/продажам/разработке).
4) No skills, duties, industries — only job titles.
5) ≤ 5 words per title when possible. No duplicates or near-duplicates.
6) Respect user intent (domain, seniority, language hints). Keep Russian-first unless the market uses English.`;

    const userMessage = `Пользовательский запрос (как есть):
"${userInput}"

Задача:
1) Определи предполагаемую профессиональную область (например: закупки, маркетинг, продажи, финансы, ИТ-разработка, аналитика данных, логистика, HR, дизайн, юриспруденция и т.п.).
2) Сгенерируй до 20 релевантных НАЗВАНИЙ ДОЛЖНОСТЕЙ для поиска на hh.ru по этой области. Исключи общие названия без доменной части.
3) Верни строго JSON по схеме:

{
  "query": "${userInput}",
  "domain": "detected-domain-or-empty",
  "candidates": [
    {"title": "…" }
  ],
  "meta": {
    "total": <number>,
    "note": ""
  }
}

Если нет уверенных вариантов:
{
  "query": "${userInput}",
  "domain": "",
  "candidates": [],
  "meta": {"total": 0, "note": "no_confident_titles"}
}`;

    console.log(`🎯 Step 1: Generating candidates for: "${userInput}"`);

    try {
      const result = await this.makeAIRequest(async () => {
        return await this.model.generateContent(`${systemMessage}\n\n${userMessage}`);
      });
      
      let response = result.response.text().trim();
      console.log(`✅ Step 1 AI response: ${response}`);
      
      // Strip markdown code fences if present
      if (response.startsWith('```json') && response.endsWith('```')) {
        response = response.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (response.startsWith('```') && response.endsWith('```')) {
        response = response.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }
      
      // Parse JSON response
      const parsed = JSON.parse(response);
      
      if (!parsed.candidates || !Array.isArray(parsed.candidates)) {
        console.log('❌ Invalid response format');
        return { candidates: [], domain: '' };
      }
      
      const candidates = parsed.candidates.map((c: any) => c.title).filter((title: string) => title && title.trim());
      const domain = parsed.domain || '';
      
      console.log(`🎯 Step 1 extracted ${candidates.length} candidates in domain "${domain}": ${candidates.join(', ')}`);
      
      return { candidates, domain };
      
    } catch (error) {
      console.error('Step 1 candidate generation failed:', error);
      return { candidates: [], domain: '' };
    }
  }

  private async rankJobTitles(userInput: string, titles: string[]): Promise<Array<{rank: number, title: string, reason: string}>> {
    const systemMessage = `You help users search jobs on hh.ru (HeadHunter).
Return only JSON exactly matching the requested schema. No prose, no Markdown.
Rules:
1) Output Russian job titles (должности), nominative, market-common; include English only if it is common on hh.ru (e.g., QA, DevOps, Product Manager, Buyer).
2) No fallbacks: if uncertain, return an empty array and a short machine-readable note in "meta".
3) Ban generic shells without a domain: "менеджер", "специалист", "ассистент", "координатор", "руководитель" unless they include a domain lexeme (e.g., по закупкам/маркетингу/продажам/разработке).
4) No skills, duties, industries — only job titles.
5) ≤ 5 words per title when possible. No duplicates or near-duplicates.
6) Respect user intent (domain, seniority, language hints). Keep Russian-first unless the market uses English.`;

    const userMessage = `Оригинальный запрос пользователя: "${userInput}"

Список должностей для ранжирования:
${JSON.stringify(titles)}

Критерии релевантности:
- Чёткая принадлежность к обнаруженной области.
- Понятность для соискателей на hh.ru и распространённость названия.
- Если в запросе указаны seniority/отрасль/язык — учти это.

Формат (строго JSON):
{
  "query": "${userInput}",
  "ranked": [
    {"rank": 1, "title": "…", "reason": "1–2 кратких фразы"},
    {"rank": 2, "title": "…", "reason": "…"}
  ],
  "meta": {"count": <number_returned>}
}

Если входной список пуст:
{
  "query": "${userInput}",
  "ranked": [],
  "meta": {"count": 0, "note": "no_titles_to_rank"}
}`;

    console.log(`🎯 Step 3: Ranking ${titles.length} titles for: "${userInput}"`);

    try {
      const result = await this.makeAIRequest(async () => {
        return await this.model.generateContent(`${systemMessage}\n\n${userMessage}`);
      });
      
      let response = result.response.text().trim();
      console.log(`✅ Step 3 AI response: ${response}`);
      
      // Strip markdown code fences if present
      if (response.startsWith('```json') && response.endsWith('```')) {
        response = response.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (response.startsWith('```') && response.endsWith('```')) {
        response = response.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }
      
      // Parse JSON response
      const parsed = JSON.parse(response);
      
      if (!parsed.ranked || !Array.isArray(parsed.ranked)) {
        console.log('❌ Invalid ranking response format');
        return [];
      }
      
      console.log(`🎯 Step 3 ranked ${parsed.ranked.length} titles`);
      return parsed.ranked;
      
    } catch (error) {
      console.error('Step 3 ranking failed:', error);
      return [];
    }
  }

  private convertRankedToCategorized(rankedResults: Array<{rank: number, title: string, reason: string}>): {
    exactPhrases: string[];
    strongSynonyms: string[];
    weakAmbiguous: string[];
    allowedEnglishAcronyms: string[];
  } {
    const result = {
      exactPhrases: [] as string[],
      strongSynonyms: [] as string[],
      weakAmbiguous: [] as string[],
      allowedEnglishAcronyms: [] as string[]
    };

    // Categorize based on rank and content
    rankedResults.forEach(({ rank, title }) => {
      const isEnglish = /^[a-zA-Z\s]+$/.test(title);
      const isTechnical = ['QA', 'DevOps', 'ML', 'AI', 'IT', 'SEO', 'SMM', 'CRM', 'ERP', 'Product Manager', 'Buyer'].some(tech => title.includes(tech));
      
      if (isTechnical && isEnglish) {
        result.allowedEnglishAcronyms.push(title);
      } else if (rank <= 3) {
        result.exactPhrases.push(title);
      } else if (rank <= 7) {
        result.strongSynonyms.push(title);
      } else {
        result.weakAmbiguous.push(title);
      }
    });

    return result;
  }

  // Add method to get ranked results directly (for new UI)
  async generateRankedJobTitles(userInput: string): Promise<Array<{rank: number, title: string, reason: string}> | null> {
    try {
      const { candidates } = await this.generateJobCandidates(userInput);
      
      if (candidates.length === 0) {
        return null; // Return null to indicate no confident results
      }
      
      return await this.rankJobTitles(userInput, candidates);
      
    } catch (error) {
      console.error('Ranked job titles generation failed:', error);
      return null;
    }
  }



  private getFallbackJobKeywords(input: string): string[] {
    console.log(`🔍 Fallback mapping for input: "${input}"`);
    
    // Smart English-to-Russian job translation mappings
    const jobTranslations: Record<string, string[]> = {
      // Manager variations - English inputs
      'manager': [
        'менеджер', 'руководитель', 'управляющий', 'координатор', 'администратор',
        'проект-менеджер', 'продакт-менеджер', 'менеджер проектов', 
        'старший менеджер', 'менеджер отдела'
      ],
      'i want to be a manager': [
        'менеджер', 'руководитель', 'управляющий', 'координатор', 'администратор',
        'проект-менеджер', 'продакт-менеджер', 'менеджер проектов', 
        'старший менеджер', 'менеджер отдела'
      ],
      'want to be manager': [
        'менеджер', 'руководитель', 'управляющий', 'координатор', 'администратор',
        'проект-менеджер', 'продакт-менеджер', 'менеджер проектов', 
        'старший менеджер', 'менеджер отдела'
      ],
      
      // Tester variations
      'software tester': [
        'тестировщик программного обеспечения', 'QA', 'тестер', 'тестировщик', 
        'QA инженер', 'специалист по тестированию', 'инженер по качеству',
        'automation QA', 'manual QA', 'тестировщик ПО'
      ],
      'tester': [
        'тестировщик', 'QA', 'тестер', 'QA инженер', 'специалист по тестированию',
        'тестировщик программного обеспечения', 'инженер по качеству', 'тестировщик ПО',
        'automation QA', 'manual QA'
      ],
      'qa': [
        'QA', 'QA инженер', 'тестировщик', 'тестер', 'специалист по тестированию',
        'инженер по качеству', 'тестировщик ПО', 'automation QA', 'manual QA',
        'тестировщик программного обеспечения'
      ],
      
      // Developer variations
      'developer': [
        'разработчик', 'программист', 'инженер-программист', 'разработчик ПО', 
        'backend разработчик', 'frontend разработчик', 'fullstack разработчик', 
        'веб-разработчик', 'software engineer'
      ],
      'programmer': [
        'программист', 'разработчик', 'инженер-программист', 'разработчик ПО', 
        'backend разработчик', 'frontend разработчик', 'fullstack разработчик', 
        'веб-разработчик', 'Python разработчик', 'Java разработчик'
      ],
      
      // Russian inputs
      'официант': [
        'официант', 'официантка', 'бармен', 'барменша', 'персонал ресторана', 
        'обслуживающий персонал', 'работник зала', 'сервер', 'хостес', 'администратор зала'
      ],
      'менеджер': [
        'менеджер', 'руководитель', 'управляющий', 'координатор', 'администратор',
        'проект-менеджер', 'продакт-менеджер', 'менеджер проектов', 
        'старший менеджер', 'менеджер отдела'
      ],
      'тестировщик': [
        'тестировщик', 'QA инженер', 'тестер', 'специалист по тестированию', 
        'тестировщик программного обеспечения', 'QA', 'automation QA', 'manual QA', 
        'инженер по качеству', 'тестировщик ПО'
      ],
      'программист': [
        'программист', 'разработчик', 'инженер-программист', 'разработчик ПО', 
        'backend разработчик', 'frontend разработчик', 'fullstack разработчик', 
        'веб-разработчик', 'Python разработчик', 'Java разработчик'
      ],
    };

    const lowerInput = input.toLowerCase().trim();
    
    // Direct exact match first
    if (jobTranslations[lowerInput]) {
      console.log(`✅ Direct match found for: "${lowerInput}"`);
      return jobTranslations[lowerInput].slice(0, 10);
    }
    
    // Partial match for complex phrases  
    for (const [key, translations] of Object.entries(jobTranslations)) {
      if (lowerInput.includes(key) || key.includes(lowerInput)) {
        console.log(`✅ Partial match: "${lowerInput}" matches key "${key}"`);
        return translations.slice(0, 10);
      }
    }
    
    // Keyword-based matching
    const keywordMappings = {
      'manage': jobTranslations['manager'],
      'test': jobTranslations['tester'], 
      'develop': jobTranslations['developer'],
      'program': jobTranslations['programmer'],
      'код': jobTranslations['программист'],
      'разработ': jobTranslations['программист'],
      'тест': jobTranslations['тестировщик'],
      'управ': jobTranslations['менеджер'],
      'руков': jobTranslations['менеджер']
    };
    
    for (const [keyword, translations] of Object.entries(keywordMappings)) {
      if (lowerInput.includes(keyword)) {
        console.log(`✅ Keyword match: "${lowerInput}" contains "${keyword}"`);
        return translations.slice(0, 10);
      }
    }
    
    console.log(`❌ No mapping found for: "${lowerInput}", using generic fallback`);
    // Last resort: generic professional terms
    return [
      'специалист', 'консультант', 'менеджер', 'эксперт', 'сотрудник',
      'администратор', 'координатор', 'помощник', 'ассистент', 'стажер'
    ];
  }

  private categorizeKeywordsFallback(keywords: string[]): {
    exactPhrases: string[];
    strongSynonyms: string[];
    weakAmbiguous: string[];
    allowedEnglishAcronyms: string[];
  } {
    const result = {
      exactPhrases: [] as string[],
      strongSynonyms: [] as string[],
      weakAmbiguous: [] as string[],
      allowedEnglishAcronyms: [] as string[]
    };

    const technicalTerms = ['Python', 'JavaScript', 'SQL', 'React', 'Node.js', 'Docker', 'AWS', 'GCP', 'ML', 'NLP', 'Java', 'C++', 'TypeScript', 'Angular', 'Vue'];
    const exactJobs = [
      'программист', 'официант', 'официантка', 'менеджер', 'дизайнер', 'аналитик', 'тестировщик', 'продавец',
      'бухгалтер', 'водитель', 'курьер', 'бармен', 'барменша', 'повар', 'кассир', 'администратор',
      'секретарь', 'юрист', 'врач', 'учитель', 'воспитатель', 'инженер', 'архитектор', 'переводчик'
    ];
    const strongSynonyms = [
      'разработчик', 'девелопер', 'консультант', 'руководитель', 'координатор', 'управляющий',
      'торговый представитель', 'менеджер по продажам', 'проект-менеджер', 'продакт-менеджер',
      'веб-разработчик', 'frontend разработчик', 'backend разработчик', 'fullstack разработчик',
      'QA инженер', 'тестер', 'инженер-программист', 'системный администратор'
    ];
    const weakTerms = ['специалист', 'сотрудник', 'эксперт', 'работник', 'помощник', 'стажер', 'junior'];

    // Ensure we have at least 10 keywords total by prioritizing the most relevant
    const totalNeeded = 10;
    let totalAssigned = 0;

    for (const keyword of keywords.slice(0, 15)) { // Process up to 15 keywords
      if (totalAssigned >= totalNeeded) break;
      
      const lower = keyword.toLowerCase();
      let assigned = false;
      
      // Check for technical terms first
      if (technicalTerms.some(tech => keyword.includes(tech))) {
        result.allowedEnglishAcronyms.push(keyword);
        assigned = true;
      }
      // Check for exact job titles
      else if (exactJobs.some(job => lower.includes(job))) {
        result.exactPhrases.push(keyword);
        assigned = true;
      }
      // Check for strong synonyms
      else if (strongSynonyms.some(syn => lower.includes(syn))) {
        result.strongSynonyms.push(keyword);
        assigned = true;
      }
      // Check for weak terms
      else if (weakTerms.some(weak => lower.includes(weak))) {
        result.weakAmbiguous.push(keyword);
        assigned = true;
      }
      // Default categorization for remaining terms
      else {
        // If it looks like a job title, put in exact phrases
        if (keyword.length <= 25 && !keyword.includes('я хочу') && !keyword.includes('работать')) {
          result.strongSynonyms.push(keyword);
          assigned = true;
        }
      }
      
      if (assigned) totalAssigned++;
    }

    // Ensure we have at least 10 total keywords distributed properly
    const currentTotal = result.exactPhrases.length + result.strongSynonyms.length + 
                        result.weakAmbiguous.length + result.allowedEnglishAcronyms.length;
    
    if (currentTotal < 10 && keywords.length > currentTotal) {
      // Add remaining keywords as strong synonyms up to 10 total
      const remaining = keywords.slice(currentTotal, 10);
      for (const keyword of remaining) {
        if (!keyword.includes('я хочу') && keyword.trim().length > 2) {
          result.strongSynonyms.push(keyword);
        }
      }
    }

    // Cap each category to reasonable limits
    result.exactPhrases = result.exactPhrases.slice(0, 5);
    result.strongSynonyms = result.strongSynonyms.slice(0, 5);
    result.weakAmbiguous = result.weakAmbiguous.slice(0, 3);
    result.allowedEnglishAcronyms = result.allowedEnglishAcronyms.slice(0, 3);

    return result;
  }

  // AI relevance filtering for keywords
  async filterKeywordsByRelevance(userInput: string, keywords: string[]): Promise<{text: string; relevanceScore: number}[]> {
    const prompt = `
Ты эксперт по поиску работы. Пользователь ввёл запрос: "${userInput}"

Оцени каждое предложенное ключевое слово по релевантности к исходному запросу по шкале 0-10:
- 10: Прямое совпадение или точный синоним
- 8-9: Очень связанные термины (та же профессия, но разные формулировки)  
- 6-7: Похожие профессии или смежные области
- 4-5: Отдалённо связанные термины
- 0-3: Совершенно несвязанные термины

Ключевые слова для оценки: ${JSON.stringify(keywords)}

Верни JSON массив объектов с полями "text" и "relevanceScore":
[
  {"text": "ключевое слово", "relevanceScore": 9},
  {"text": "другое слово", "relevanceScore": 6}
]

Только JSON, без объяснений.`;

    try {
      const result = await this.makeAIRequest(async () => {
        return await this.model.generateContent(prompt);
      });
      const response = result.response.text().trim();
      
      // Extract JSON from response
      let jsonText = response;
      if (response.includes('```json')) {
        jsonText = response.split('```json')[1].split('```')[0].trim();
      } else if (response.includes('```')) {
        jsonText = response.split('```')[1].split('```')[0].trim();
      }
      
      const parsed = JSON.parse(jsonText);
      
      // Validate and sort by relevance score
      const validatedResults = parsed
        .filter((item: any) => item.text && typeof item.relevanceScore === 'number')
        .sort((a: any, b: any) => b.relevanceScore - a.relevanceScore);
      
      return validatedResults;
    } catch (error) {
      console.error('AI relevance filtering failed:', error);
      // Enhanced fallback: assign relevance based on keyword position and content
      return keywords.map((text, index) => {
        // Give higher scores to earlier keywords and exact matches
        let score = Math.max(8 - index, 3); // Start high, decrease by position
        
        // Boost score for exact or partial matches with user input
        const lowerInput = userInput.toLowerCase();
        const lowerText = text.toLowerCase();
        
        if (lowerText === lowerInput) {
          score = 10; // Exact match
        } else if (lowerText.includes(lowerInput) || lowerInput.includes(lowerText)) {
          score = Math.min(score + 2, 9); // Partial match boost
        }
        
        return { text, relevanceScore: score };
      }).sort((a, b) => b.relevanceScore - a.relevanceScore);
    }
  }

  // Keep the legacy method for backward compatibility (deprecated)
  async generateJobTitles(userInput: string): Promise<string[]> {
    const seeds = await this.generateRussianSeedTerms(userInput);
    return [
      ...seeds.exactPhrases,
      ...seeds.strongSynonyms,
      ...seeds.weakAmbiguous,
      ...seeds.allowedEnglishAcronyms
    ];
  }

  async mapFiltersToHH(
    answers: any, 
    dictionaries: any
  ): Promise<{
    text: string;
    area?: string;
    experience?: string;
    employment?: string[];
    schedule?: string[];
    salary?: number;
    currency?: string;
    only_with_salary?: boolean;
    period?: number;
    order_by?: string;
  }> {
    const prompt = `
You are an HH.ru API specialist. Convert user answers to HH.ru search parameters.

User answers: ${JSON.stringify(answers)}

Available values from HH.ru dictionaries:
Experience: ${JSON.stringify(dictionaries.experience)}
Employment type: ${JSON.stringify(dictionaries.employment)}
Schedule: ${JSON.stringify(dictionaries.schedule)}
Currencies: ${JSON.stringify(dictionaries.currency)}
Sort order: ${JSON.stringify(dictionaries.vacancy_search_order)}

The user has selected these job keywords: ${answers.selectedKeywords?.join(', ') || 'none'}

Search options:
- Title-first search: ${answers.titleFirstSearch ? 'enabled (use search_field: ["name"])' : 'disabled (search all fields)'}
- Exact phrases: ${answers.useExactPhrases ? 'enabled (wrap keywords in quotes)' : 'disabled (plain text)'}

Important: Only include filter parameters in the response if the corresponding enableXFilter flag is true. For example, only include "area" if enableLocationFilter is true.

Return a JSON object with correct IDs from dictionaries. For the "text" field, combine the selected keywords considering the search options:
{
  "text": "combine selected keywords into search string",
  "area": "1", // Area ID (1 = Moscow, 2 = SPb, etc.)
  "experience": "ID_from_dictionary",
  "employment": ["ID1", "ID2"],
  "schedule": ["ID1", "ID2"], 
  "salary": number,
  "currency": "RUR",
  "only_with_salary": true/false,
  "period": number_of_days,
  "order_by": "sort_ID",
  "metro": "metro_station_id",
  "search_field": ["field_ID1", "field_ID2"],
  "label": ["label_ID1", "label_ID2"],
  "employer_id": "company_name_or_id",
  "education_level": "education_ID",
  "working_time_modes": ["mode_ID1", "mode_ID2"]
}
`;

    try {
      const result = await this.proModel.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.1,
          topK: 1,
          topP: 0.8,
        },
      });

      const response = result.response.text();
      const cleanJson = response.replace(/```json\n?|```\n?/g, '').trim();
      
      try {
        return JSON.parse(cleanJson);
      } catch (parseError) {
        console.error('Failed to parse AI response as JSON:', cleanJson);
        throw new Error('AI returned invalid JSON format');
      }
    } catch (error) {
      console.error('Filter mapping failed:', error);
      // Return basic fallback with proper keyword combination, but only include enabled filters
      const keywords = answers.selectedKeywords || [];
      
      // Apply exact phrases if enabled
      let keywordText: string;
      if (answers.useExactPhrases) {
        keywordText = keywords.map((k: string) => `"${k}"`).join(' OR ');
      } else {
        keywordText = keywords.join(' OR ');
      }
      
      const fallback: any = {
        text: keywordText
      };
      
      // Add search_field=name if title-first search is enabled
      if (answers.titleFirstSearch) {
        fallback.search_field = ['name'];
      }
      
      // Only include filters that are explicitly enabled
      if (answers.enableLocationFilter && answers.locationText) {
        fallback.area = answers.locationText?.includes('Москва') ? '1' : undefined;
      }
      if (answers.enableExperienceFilter && answers.experienceText) {
        fallback.experience = 'doesNotMatter';
      }
      if (answers.enableEmploymentFilter && answers.employmentTypes?.length) {
        fallback.employment = ['full'];
      }
      if (answers.enableScheduleFilter && answers.scheduleTypes?.length) {
        fallback.schedule = ['fullDay'];
      }
      if (answers.enableSalaryFilter && answers.incomeNumber) {
        fallback.salary = answers.incomeNumber;
        fallback.currency = answers.currency || 'RUR';
        fallback.only_with_salary = answers.onlyWithSalary || false;
      }
      if (answers.enableMetroFilter && answers.metroStation) {
        fallback.metro = answers.metroStation;
      }
      if (answers.enableLabelFilter && answers.vacancyLabels?.length) {
        fallback.label = answers.vacancyLabels;
      }
      if (answers.enableEducationFilter && answers.educationLevel) {
        fallback.education_level = answers.educationLevel;
      }
      if (answers.enableWorkFormatFilter && answers.workFormats?.length) {
        fallback.working_time_modes = answers.workFormats;
      }
      
      // Always include basic search params
      fallback.period = answers.period || 7;
      fallback.order_by = answers.orderBy || 'relevance';
      
      return fallback;
    }
  }

  async generateCoverLetter(request: {
    name: string;
    employerName: string;
    areaName: string;
    skillsList: string[];
    plainDescription: string;
    userProfile?: string;
    customPrompt?: string;
  }): Promise<string> {
    // Use fallback immediately if we know we're over quota or service is unavailable
    // This prevents wasting API calls when we know they'll fail
    try {
      // Simplified, concise prompt to reduce token usage
      const prompt = `Write a brief professional cover letter in English:

Job: ${request.name} at ${request.employerName}
Skills needed: ${request.skillsList.slice(0, 3).join(', ')}
Description: ${request.plainDescription.substring(0, 400)}

Format: 3 short paragraphs, 150-200 words total, professional tone.`;

      const result = await this.makeAIRequest(async () => {
        return await this.model.generateContent(prompt);
      });
      
      const generatedText = result.response.text().trim();
      
      // Validate the response is reasonable
      if (generatedText.length < 50 || generatedText.includes('[')) {
        throw new Error('Generated text appears incomplete');
      }
      
      return generatedText;
      
    } catch (error) {
      console.error('Cover letter generation failed:', error);
      
      // Return error message instead of template
      return "Sorry, AI is not working now";
    }
  }



}

export const aiClient = new AIClient();
