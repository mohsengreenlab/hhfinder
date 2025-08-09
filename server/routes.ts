import type { Express } from "express";
import { createServer, type Server } from "http";
import compression from "compression";
import { hhClient } from "./services/hhClient";
import { aiClient } from "./services/aiClient";
import { sanitizeHTML, stripHTMLToText } from "./services/sanitize";
import { 
  suggestionsCache, 
  dictionariesCache, 
  areasCache, 
  vacancyDetailsCache,
  coalesceRequest 
} from "./services/cache";
import { 
  aiKeywordsResponseSchema,
  filterMatchRequestSchema,
  filterMatchResponseSchema,
  coverLetterRequestSchema,
  coverLetterResponseSchema
} from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  // Enable compression
  app.use(compression());

  // Add Server-Timing headers
  app.use((req, res, next) => {
    res.locals.timings = [];
    res.locals.addTiming = (name: string, duration: number) => {
      res.locals.timings.push(`${name};dur=${duration}`);
      res.set('Server-Timing', res.locals.timings.join(', '));
    };
    next();
  });

  // GET /api/ai-keywords?q=<text>
  app.get('/api/ai-keywords', async (req, res) => {
    const startTime = Date.now();
    
    try {
      const query = req.query.q as string;
      if (!query) {
        return res.status(400).json({ error: 'Query parameter "q" is required' });
      }

      const cacheKey = `ai-keywords:${query}`;
      const cached = suggestionsCache.get(cacheKey);
      if (cached) {
        res.locals.addTiming('cache', Date.now() - startTime);
        return res.json(cached);
      }

      const result = await coalesceRequest(cacheKey, async () => {
        const aiStartTime = Date.now();
        
        // Generate AI titles
        const aiTitles = await aiClient.generateJobTitles(query);
        const aiDuration = Date.now() - aiStartTime;

        // Verify each title char-by-char with HH.ru
        const hhStartTime = Date.now();
        const allSuggestions = new Map<string, number>();

        for (const title of aiTitles) {
          for (let i = 1; i <= title.length; i++) {
            const prefix = title.slice(0, i);
            try {
              const { data } = await hhClient.getSuggestions(prefix);
              if (data.items) {
                data.items.forEach((item: any) => {
                  const text = item.text;
                  const count = allSuggestions.get(text) || 0;
                  const prefixMatch = text.toLowerCase().startsWith(prefix.toLowerCase());
                  allSuggestions.set(text, count + (prefixMatch ? 2 : 1));
                });
              }
            } catch (error) {
              console.error(`Failed to get suggestions for prefix "${prefix}":`, error);
            }
            
            // Small delay to avoid overwhelming HH.ru
            await new Promise(resolve => setTimeout(resolve, 10));
          }
        }

        const hhDuration = Date.now() - hhStartTime;

        // Sort and get top 10
        const suggestionsTop10 = Array.from(allSuggestions.entries())
          .sort(([, a], [, b]) => b - a)
          .slice(0, 10)
          .map(([text]) => ({ text, source: 'hh' as const }));

        const result = {
          aiTitles,
          suggestionsTop10
        };

        res.locals.addTiming('ai', aiDuration);
        res.locals.addTiming('hh', hhDuration);
        
        return result;
      });

      suggestionsCache.set(cacheKey, result, 60 * 1000); // 60s cache
      
      res.locals.addTiming('total', Date.now() - startTime);
      res.json(result);

    } catch (error: any) {
      console.error('AI keywords error:', error);
      
      if (error.error === 'rate_limited') {
        return res.status(429).json({
          error: 'rate_limited',
          retryInMs: error.retryInMs,
          message: error.message
        });
      }
      
      res.status(500).json({ 
        error: 'Failed to generate AI keywords',
        message: error.message 
      });
    }
  });

  // GET /api/dictionaries
  app.get('/api/dictionaries', async (req, res) => {
    const startTime = Date.now();
    
    try {
      const cacheKey = 'dictionaries';
      const cached = dictionariesCache.get(cacheKey);
      if (cached) {
        res.locals.addTiming('cache', Date.now() - startTime);
        return res.json(cached);
      }

      const { data, timing } = await hhClient.getDictionaries();
      
      dictionariesCache.set(cacheKey, data, 24 * 60 * 60 * 1000); // 24h cache
      
      res.locals.addTiming('upstream', timing.upstream);
      res.locals.addTiming('total', Date.now() - startTime);
      res.json(data);

    } catch (error: any) {
      console.error('Dictionaries error:', error);
      
      if (error.error === 'rate_limited') {
        return res.status(429).json({
          error: 'rate_limited',
          retryInMs: error.retryInMs,
          message: error.message
        });
      }
      
      res.status(500).json({ 
        error: 'Failed to fetch dictionaries',
        message: error.message 
      });
    }
  });

  // GET /api/areas
  app.get('/api/areas', async (req, res) => {
    const startTime = Date.now();
    
    try {
      const cacheKey = 'areas';
      const cached = areasCache.get(cacheKey);
      if (cached) {
        res.locals.addTiming('cache', Date.now() - startTime);
        return res.json(cached);
      }

      const { data, timing } = await hhClient.getAreas();
      
      areasCache.set(cacheKey, data, 24 * 60 * 60 * 1000); // 24h cache
      
      res.locals.addTiming('upstream', timing.upstream);
      res.locals.addTiming('total', Date.now() - startTime);
      res.json(data);

    } catch (error: any) {
      console.error('Areas error:', error);
      
      if (error.error === 'rate_limited') {
        return res.status(429).json({
          error: 'rate_limited',
          retryInMs: error.retryInMs,
          message: error.message
        });
      }
      
      res.status(500).json({ 
        error: 'Failed to fetch areas',
        message: error.message 
      });
    }
  });

  // POST /api/filters/match
  app.post('/api/filters/match', async (req, res) => {
    const startTime = Date.now();
    
    try {
      const validatedBody = filterMatchRequestSchema.parse(req.body);
      
      // Get dictionaries for mapping
      const dictionaries = dictionariesCache.get('dictionaries') || 
                          (await hhClient.getDictionaries()).data;

      const aiStartTime = Date.now();
      const filters = await aiClient.mapFiltersToHH(validatedBody, dictionaries);
      const aiDuration = Date.now() - aiStartTime;

      res.locals.addTiming('ai', aiDuration);
      res.locals.addTiming('total', Date.now() - startTime);
      
      res.json(filters);

    } catch (error: any) {
      console.error('Filter match error:', error);
      res.status(500).json({ 
        error: 'Failed to match filters',
        message: error.message 
      });
    }
  });

  // GET /api/vacancies
  app.get('/api/vacancies', async (req, res) => {
    const startTime = Date.now();
    
    try {
      const params = {
        text: req.query.text as string,
        area: req.query.area as string,
        experience: req.query.experience as string,
        employment: req.query.employment as string[],
        schedule: req.query.schedule as string[],
        salary: req.query.salary ? parseInt(req.query.salary as string) : undefined,
        currency: req.query.currency as string,
        only_with_salary: req.query.only_with_salary === 'true',
        period: req.query.period ? parseInt(req.query.period as string) : undefined,
        order_by: req.query.order_by as string,
        per_page: Math.min(parseInt(req.query.per_page as string) || 20, 50),
        page: parseInt(req.query.page as string) || 0,
        specialization: req.query.specialization as string,
        metro: req.query.metro as string,
        employer_id: req.query.employer_id as string
      };

      const { data, timing } = await hhClient.searchVacancies(params);

      // Trim payload to essentials
      const trimmed = {
        items: data.items?.map((item: any) => ({
          id: item.id,
          name: item.name,
          employer: { name: item.employer?.name },
          area: { name: item.area?.name },
          snippet: item.snippet,
          salary: item.salary,
          alternate_url: item.alternate_url
        })) || [],
        found: data.found,
        pages: data.pages,
        page: data.page,
        per_page: data.per_page
      };

      res.locals.addTiming('upstream', timing.upstream);
      res.locals.addTiming('total', Date.now() - startTime);
      res.json(trimmed);

    } catch (error: any) {
      console.error('Vacancies search error:', error);
      
      if (error.error === 'rate_limited') {
        return res.status(429).json({
          error: 'rate_limited',
          retryInMs: error.retryInMs,
          message: error.message
        });
      }
      
      res.status(500).json({ 
        error: 'Failed to search vacancies',
        message: error.message 
      });
    }
  });

  // GET /api/vacancies/:id
  app.get('/api/vacancies/:id', async (req, res) => {
    const startTime = Date.now();
    
    try {
      const id = req.params.id;
      const cacheKey = `vacancy:${id}`;
      
      const cached = vacancyDetailsCache.get(cacheKey);
      if (cached) {
        res.locals.addTiming('cache', Date.now() - startTime);
        return res.json(cached);
      }

      const { data, timing } = await hhClient.getVacancy(id);

      const sanitizeStartTime = Date.now();
      const descriptionHtmlSanitized = sanitizeHTML(data.description || '');
      const sanitizeDuration = Date.now() - sanitizeStartTime;

      const result = {
        id: data.id,
        name: data.name,
        employer: { name: data.employer?.name },
        area: { name: data.area?.name },
        alternate_url: data.alternate_url,
        descriptionHtmlSanitized,
        key_skills: data.key_skills || [],
        salary: data.salary
      };

      // Cache by id + updated_at if available, or just id
      const finalCacheKey = data.updated_at ? 
        `vacancy:${id}:${data.updated_at}` : cacheKey;
      vacancyDetailsCache.set(finalCacheKey, result, 10 * 60 * 1000); // 10m cache

      res.locals.addTiming('upstream', timing.upstream);
      res.locals.addTiming('sanitize', sanitizeDuration);
      res.locals.addTiming('total', Date.now() - startTime);
      res.json(result);

    } catch (error: any) {
      console.error('Vacancy detail error:', error);
      
      if (error.error === 'rate_limited') {
        return res.status(429).json({
          error: 'rate_limited',
          retryInMs: error.retryInMs,
          message: error.message
        });
      }
      
      res.status(500).json({ 
        error: 'Failed to fetch vacancy details',
        message: error.message 
      });
    }
  });

  // POST /api/cover-letter
  app.post('/api/cover-letter', async (req, res) => {
    const startTime = Date.now();
    
    try {
      const validatedBody = coverLetterRequestSchema.parse(req.body);

      const aiStartTime = Date.now();
      const coverLetterText = await aiClient.generateCoverLetter(validatedBody);
      const aiDuration = Date.now() - aiStartTime;

      res.locals.addTiming('ai', aiDuration);
      res.locals.addTiming('total', Date.now() - startTime);
      
      res.json({ text: coverLetterText });

    } catch (error: any) {
      console.error('Cover letter error:', error);
      res.status(500).json({ 
        error: 'Failed to generate cover letter',
        message: error.message 
      });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
