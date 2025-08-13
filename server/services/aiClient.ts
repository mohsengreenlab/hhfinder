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

  async generateRussianSeedTerms(userInput: string): Promise<{
    exactPhrases: string[];
    strongSynonyms: string[];
    weakAmbiguous: string[];
    allowedEnglishAcronyms: string[];
  }> {
    // Stage 1: Generate job-relevant keywords
    const stage1Keywords = await this.generateJobKeywords(userInput);
    
    // Stage 2: Validate they are actual job titles
    const validatedKeywords = await this.validateJobTitles(stage1Keywords);
    
    return validatedKeywords;
  }

  private async generateJobKeywords(userInput: string): Promise<string[]> {
    const prompt = `
Ты эксперт по трудовому рынку России и сайту HH.ru. Пользователь хочет найти работу: "${userInput}"

Создай список ключевых слов для поиска вакансий на русском языке:

ПРАВИЛА:
1. ТОЛЬКО русские названия профессий и должностей
2. Исключение: технические термины (Python, JavaScript, SQL, React, Node.js, Docker, AWS, etc.)
3. НЕ используй английские названия должностей - переводи на русский
4. Фокусируйся на реальных названиях вакансий как на HH.ru
5. Включай синонимы и смежные профессии

Примеры правильных терминов:
- "программист Python" вместо "Python developer"  
- "инженер-программист" вместо "software engineer"
- "фронтенд-разработчик" вместо "frontend developer"
- "менеджер по продажам" вместо "sales manager"

Верни ТОЛЬКО массив строк в JSON формате:
["термин 1", "термин 2", "термин 3"]

Максимум 15 терминов.`;

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
      return Array.isArray(parsed) ? parsed.slice(0, 15) : [];
      
    } catch (error) {
      console.error('Stage 1 keyword generation failed:', error);
      // Fallback to predefined keywords
      const input = userInput.toLowerCase().trim();
      return this.getFallbackJobKeywords(input);
    }
  }

  private async validateJobTitles(keywords: string[]): Promise<{
    exactPhrases: string[];
    strongSynonyms: string[];
    weakAmbiguous: string[];
    allowedEnglishAcronyms: string[];
  }> {
    if (keywords.length === 0) {
      return { exactPhrases: [], strongSynonyms: [], weakAmbiguous: [], allowedEnglishAcronyms: [] };
    }

    const prompt = `
Ты эксперт по вакансиям на HH.ru. Проанализируй список терминов и определи, какие из них являются реальными названиями профессий/должностей.

Термины: ${JSON.stringify(keywords)}

Классифицируй каждый термин:
- exactPhrases: точные названия должностей (например: "программист", "менеджер", "бухгалтер")
- strongSynonyms: сильные синонимы профессий (например: "разработчик", "девелопер", "кодер")  
- weakAmbiguous: слабые/неоднозначные (например: "специалист", "консультант")
- allowedEnglishAcronyms: технические термины (Python, SQL, React, etc.)

ПРАВИЛА:
1. Отбрасывай общие слова ("работа", "должность", "вакансия")
2. Отбрасывай описательные фразы ("я хочу", "найти работу")
3. Оставляй только конкретные профессии и технические навыки

Верни JSON:
{
  "exactPhrases": ["точная профессия 1"],
  "strongSynonyms": ["синоним 1"], 
  "weakAmbiguous": ["неоднозначный 1"],
  "allowedEnglishAcronyms": ["Python", "SQL"]
}`;

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
      
      return {
        exactPhrases: (parsed.exactPhrases || []).slice(0, 8),
        strongSynonyms: (parsed.strongSynonyms || []).slice(0, 8),
        weakAmbiguous: (parsed.weakAmbiguous || []).slice(0, 5),
        allowedEnglishAcronyms: (parsed.allowedEnglishAcronyms || []).slice(0, 5)
      };
      
    } catch (error) {
      console.error('Stage 2 job title validation failed:', error);
      // Fallback: manually categorize keywords
      return this.categorizeKeywordsFallback(keywords);
    }
  }

  private getFallbackJobKeywords(input: string): string[] {
    const jobMappings: Record<string, string[]> = {
      'официант': [
        'официант', 'официантка', 'бармен', 'барменша', 'персонал ресторана', 
        'обслуживающий персонал', 'работник зала', 'сервер', 'хостес', 'администратор зала'
      ],
      'программист': [
        'программист', 'разработчик', 'инженер-программист', 'разработчик ПО', 
        'backend разработчик', 'frontend разработчик', 'fullstack разработчик', 
        'веб-разработчик', 'Python разработчик', 'Java разработчик'
      ],
      'тестировщик': [
        'тестировщик', 'QA инженер', 'тестер', 'специалист по тестированию', 
        'тест-аналитик', 'automation QA', 'manual QA', 'QA engineer', 
        'инженер по качеству', 'тестировщик ПО'
      ],
      'менеджер': [
        'менеджер', 'руководитель', 'управляющий', 'координатор', 'администратор',
        'проект-менеджер', 'продакт-менеджер', 'менеджер проектов', 
        'старший менеджер', 'менеджер отдела'
      ],
      'продавец': [
        'продавец', 'менеджер по продажам', 'торговый представитель', 'консультант',
        'продавец-консультант', 'специалист по продажам', 'менеджер продаж',
        'торговый агент', 'коммерческий представитель', 'сейлз'
      ],
      'дизайнер': [
        'дизайнер', 'графический дизайнер', 'веб-дизайнер', 'UI/UX дизайнер',
        'дизайнер интерфейсов', 'креативный дизайнер', 'моушн дизайнер',
        'продуктовый дизайнер', 'визуальный дизайнер', 'арт-директор'
      ],
      'аналитик': [
        'аналитик', 'бизнес-аналитик', 'системный аналитик', 'data analyst',
        'финансовый аналитик', 'продуктовый аналитик', 'веб-аналитик',
        'аналитик данных', 'исследователь', 'BI аналитик'
      ],
      'маркетолог': [
        'маркетолог', 'интернет-маркетолог', 'digital маркетолог', 'SMM менеджер',
        'контент-менеджер', 'специалист по маркетингу', 'маркетинг-менеджер',
        'performance маркетолог', 'бренд-менеджер', 'продакт-маркетолог'
      ],
      'бухгалтер': [
        'бухгалтер', 'главный бухгалтер', 'помощник бухгалтера', 'экономист',
        'финансист', 'специалист по учету', 'бухгалтер-кассир',
        'налоговый консультант', 'финансовый консультант', 'казначей'
      ],
      'водитель': [
        'водитель', 'шофер', 'курьер', 'экспедитор', 'водитель-экспедитор',
        'водитель грузового автомобиля', 'водитель легкового автомобиля',
        'водитель автобуса', 'таксист', 'личный водитель'
      ]
    };

    // Find the best matching job category
    for (const [key, terms] of Object.entries(jobMappings)) {
      if (input.toLowerCase().includes(key)) {
        return terms.slice(0, 15); // Return up to 15 terms
      }
    }

    // If no specific mapping found, try partial matches
    const partialMatches: string[] = [];
    if (input.includes('разработ')) partialMatches.push(...jobMappings['программист']);
    if (input.includes('тест')) partialMatches.push(...jobMappings['тестировщик']);
    if (input.includes('управ') || input.includes('руков')) partialMatches.push(...jobMappings['менеджер']);
    if (input.includes('прода') || input.includes('торг')) partialMatches.push(...jobMappings['продавец']);
    if (input.includes('дизайн') || input.includes('художн')) partialMatches.push(...jobMappings['дизайнер']);

    if (partialMatches.length > 0) {
      return Array.from(new Set(partialMatches)).slice(0, 15);
    }

    // Generic fallback - create variations of the input
    const cleanInput = input.replace(/я хочу быть|я хочу|хочу быть|работать/gi, '').trim();
    return [cleanInput, `специалист по ${cleanInput}`, `${cleanInput} консультант`].filter(Boolean);
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
    const systemPrompt = `
You write concise, polite cover letters in English for real job applicants.

Requirements:
- 150-220 words
- 3 short paragraphs
- Mention 2-4 relevant skills
- Include 1 specific fact from the job posting
- No fluff or clichés
- Professional tone
`;

    let userPrompt = request.customPrompt || `
Write a professional cover letter for this job:
Position: ${request.name}
Company: ${request.employerName}
Location: ${request.areaName}
Key skills: ${request.skillsList.join(', ')}

Job description:
${request.plainDescription.substring(0, 1000)}

${request.userProfile ? `Applicant profile: ${request.userProfile}` : ''}
`;

    // Replace placeholders in custom prompts
    if (request.customPrompt) {
      userPrompt = request.customPrompt
        .replace(/\{\{POSITION\}\}/g, request.name)
        .replace(/\{\{COMPANY\}\}/g, request.employerName)
        .replace(/\{\{LOCATION\}\}/g, request.areaName)
        .replace(/\{\{SKILLS\}\}/g, request.skillsList.join(', '))
        .replace(/\{\{DESCRIPTION\}\}/g, request.plainDescription.substring(0, 1500));
    }

    try {
      // Use a simpler prompt format that works better with Gemini
      const fullPrompt = `${systemPrompt}\n\n${userPrompt}`;
      
      const result = await this.makeAIRequest(async () => {
        return await this.model.generateContent(fullPrompt);
      });
      return result.response.text().trim();
    } catch (error) {
      console.error('Cover letter generation failed:', error);
      console.error('Error details:', {
        status: (error as any)?.status,
        statusText: (error as any)?.statusText,
        message: error instanceof Error ? error.message : String(error)
      });
      
      // If rate limited, provide a template-based fallback
      if ((error as any)?.status === 429) {
        return this.generateFallbackCoverLetter(request);
      }
      
      throw new Error('Failed to generate cover letter');
    }
  }

  private generateFallbackCoverLetter(request: {
    name: string;
    employerName: string;
    areaName: string;
    skillsList: string[];
    plainDescription: string;
    userProfile?: string;
    customPrompt?: string;
  }): string {
    // Generate a professional template-based cover letter when AI is rate-limited
    const skills = request.skillsList.slice(0, 4).join(', ');
    const hasProfile = request.userProfile && request.userProfile.trim().length > 0;
    
    return `Dear Hiring Manager,

I am writing to express my strong interest in the ${request.name} position at ${request.employerName}${request.areaName ? ` in ${request.areaName}` : ''}. Based on the job requirements, I believe my skills and experience make me an excellent candidate for this role.

My technical expertise includes ${skills}, which align well with the position requirements. ${hasProfile ? `${request.userProfile!.trim()}` : 'I am passionate about delivering high-quality solutions and contributing to team success.'} I am particularly excited about the opportunity to work with your team and contribute to ${request.employerName}'s continued growth.

I would welcome the opportunity to discuss how my skills and enthusiasm can contribute to your team's success. Thank you for considering my application, and I look forward to hearing from you soon.

Best regards,
[Your Name]`;
  }


}

export const aiClient = new AIClient();
