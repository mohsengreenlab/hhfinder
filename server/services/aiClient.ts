import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export class AIClient {
  private model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
  private proModel = genAI.getGenerativeModel({ model: 'gemini-2.5-pro' });

  async generateJobTitles(userInput: string): Promise<string[]> {
    const prompt = `
You are a job search specialist. Based on the user query "${userInput}", 
generate 8-12 related job titles in English and Russian that are commonly used on HH.ru.

Requirements:
- Job titles should be real and used in the job market
- Include synonyms, related specialties and levels (junior/middle/senior)
- Mix English and Russian job titles as they appear on HH.ru
- Each title on a new line

Example for "data scientist":
Data Scientist
Аналитик данных
Специалист по данным
Machine Learning Engineer
ML Engineer
Senior Data Scientist
Junior Data Scientist
Аналитик машинного обучения
`;

    try {
      const result = await this.model.generateContent(prompt);
      const response = result.response.text();
      
      const titles = response
        .split('\n')
        .map(title => title.trim())
        .filter(title => {
          // Filter out descriptive text and keep only job titles
          return title.length > 0 && 
                 !title.toLowerCase().includes('here are') &&
                 !title.toLowerCase().includes('related job') &&
                 !title.toLowerCase().includes('commonly used') &&
                 !title.startsWith('Пример') &&
                 !title.includes(':') &&
                 !title.toLowerCase().includes('example');
        })
        .slice(0, 12);

      return titles;
    } catch (error) {
      console.error('AI title generation failed:', error);
      return [userInput]; // Fallback to user input
    }
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

Important: Only include filter parameters in the response if the corresponding enableXFilter flag is true. For example, only include "area" if enableLocationFilter is true.

Return a JSON object with correct IDs from dictionaries. For the "text" field, combine the selected keywords into a search string:
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
  "employer_id": "company_name_or_id"
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
      const fallback: any = {
        text: answers.selectedKeywords?.join(' OR ') || ''
      };
      
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

    const userPrompt = request.customPrompt || `
Write a cover letter for this job:
Position: ${request.name}
Company: ${request.employerName}
Location: ${request.areaName}
Key skills: ${request.skillsList.join(', ')}

Job description:
${request.plainDescription.substring(0, 1000)}

${request.userProfile ? `Applicant profile: ${request.userProfile}` : ''}
`;

    try {
      const result = await this.proModel.generateContent({
        contents: [
          { role: 'system', parts: [{ text: systemPrompt }] },
          { role: 'user', parts: [{ text: userPrompt }] }
        ],
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.8,
          maxOutputTokens: 300,
        },
      });

      return result.response.text().trim();
    } catch (error) {
      console.error('Cover letter generation failed:', error);
      throw new Error('Failed to generate cover letter');
    }
  }
}

export const aiClient = new AIClient();
