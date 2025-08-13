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

  async generateRussianSeedTerms(userInput: string): Promise<{
    exactPhrases: string[];
    strongSynonyms: string[];
    weakAmbiguous: string[];
    allowedEnglishAcronyms: string[];
  }> {
    const prompt = `
Ты специалист по поиску работы на HH.ru. На основе запроса пользователя "${userInput}", 
создай компактный список русских терминов для поиска вакансий, плюс несколько разрешённых английских технических аббревиатур.

Требования:
- В основном русские термины (≥90%)
- Английские только для стандартных технических аббревиатур: SQL, JS, TS, React, Node.js, Docker, AWS, GCP, ML, NLP, etc.
- НЕ используй общие английские названия должностей, используй русские эквиваленты
- Краткие термины/фразы, без длинных предложений
- Всего под 20 пунктов

Категории (выдавай в формате JSON):
{
  "exactPhrases": ["точная профессия 1", "точная профессия 2"],
  "strongSynonyms": ["сильный синоним 1", "сильный синоним 2"], 
  "weakAmbiguous": ["слабый/неоднозначный 1"],
  "allowedEnglishAcronyms": ["SQL", "React"]
}

Примеры разрешённых английских терминов: SQL, JavaScript, TypeScript, React, Node.js, Docker, Kubernetes, AWS, GCP, ML, NLP, ETL
Примеры НЕ разрешённых (используй русские): "software engineer" → "инженер-программист", "frontend developer" → "фронтенд-разработчик"

Только JSON, без объяснений.`;

    try {
      const result = await this.model.generateContent(prompt);
      const response = result.response.text().trim();
      
      // Extract JSON from response
      let jsonText = response;
      if (response.includes('```json')) {
        jsonText = response.split('```json')[1].split('```')[0].trim();
      } else if (response.includes('```')) {
        jsonText = response.split('```')[1].split('```')[0].trim();
      }
      
      const parsed = JSON.parse(jsonText);
      
      // Validate structure and clean data
      const result_data = {
        exactPhrases: (parsed.exactPhrases || []).slice(0, 8),
        strongSynonyms: (parsed.strongSynonyms || []).slice(0, 8),
        weakAmbiguous: (parsed.weakAmbiguous || []).slice(0, 5),
        allowedEnglishAcronyms: (parsed.allowedEnglishAcronyms || []).slice(0, 5)
      };
      
      return result_data;
    } catch (error) {
      console.error('AI Russian seed generation failed:', error);
      // Fallback to basic structure with user input
      return {
        exactPhrases: [userInput],
        strongSynonyms: [],
        weakAmbiguous: [],
        allowedEnglishAcronyms: []
      };
    }
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
      const result = await this.model.generateContent(prompt);
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
      // Fallback: return all keywords with neutral relevance
      return keywords.map(text => ({ text, relevanceScore: 5 }));
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
      
      const result = await this.proModel.generateContent(fullPrompt);
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
