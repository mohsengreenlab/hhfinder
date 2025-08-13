import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import compression from "compression";
import bcrypt from "bcryptjs";
import { storage } from "./storage";
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
  coverLetterResponseSchema,
  insertSavedPromptSchema,
  insertSavedPromptWithUserSchema,
  insertUserSettingsSchema,
  loginSchema,
  createUserSchema,
  updateUserSchema,
  insertJobApplicationSchema,
  updateJobApplicationSchema,
  type User
} from "@shared/schema";

// Extend Express session with user
declare module "express-session" {
  interface SessionData {
    userId?: number;
  }
}

// Authentication middleware
const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: "Authentication required" });
  }
  
  const user = await storage.getUser(req.session.userId);
  if (!user || !user.isActive) {
    req.session.destroy(() => {});
    return res.status(401).json({ error: "User not found or inactive" });
  }
  
  (req as any).user = user;
  next();
};

// Admin-only middleware
const requireAdmin = async (req: Request, res: Response, next: NextFunction) => {
  const user = (req as any).user as User;
  if (!user || !user.isAdmin) {
    return res.status(403).json({ error: "Admin access required" });
  }
  next();
};

export async function registerRoutes(app: Express): Promise<Server> {
  // Enable compression
  app.use(compression());

  // Health check endpoint for Gemini API key
  app.get('/api/health/gemini', (req, res) => {
    const hasKey = !!process.env.GEMINI_API_KEY;
    res.json({ available: hasKey });
  });

  // POST /api/gemini/connect - Save Gemini API key temporarily
  app.post('/api/gemini/connect', (req, res) => {
    const { apiKey } = req.body;
    
    if (!apiKey || typeof apiKey !== 'string') {
      return res.status(400).json({ error: 'API key is required' });
    }
    
    // For security, we'll set it as an environment variable for the current session
    process.env.GEMINI_API_KEY = apiKey;
    
    res.json({ success: true, message: 'Gemini API key saved successfully' });
  });

  // POST /api/keywords/expand - Generate keyword expansions with Gemini
  app.post('/api/keywords/expand', requireAuth, async (req, res) => {
    try {
      const { keywords } = req.body;
      
      if (!keywords || !Array.isArray(keywords)) {
        return res.status(400).json({ error: 'Keywords array is required' });
      }
      
      if (!process.env.GEMINI_API_KEY) {
        return res.status(400).json({ error: 'Gemini API key not configured' });
      }
      
      const { generateKeywordExpansions, createExpansionPreview } = await import('./services/keywordExpansion');
      
      const expansions = await generateKeywordExpansions(keywords);
      const preview = createExpansionPreview(keywords, expansions);
      
      res.json({ 
        expansions, 
        preview,
        success: true 
      });
      
    } catch (error) {
      console.error('Keyword expansion error:', error);
      res.status(500).json({ error: 'Failed to generate keyword expansions' });
    }
  });

  // Add Server-Timing headers
  app.use((req, res, next) => {
    res.locals.timings = [];
    res.locals.addTiming = (name: string, duration: number) => {
      res.locals.timings.push(`${name};dur=${duration}`);
      res.set('Server-Timing', res.locals.timings.join(', '));
    };
    next();
  });

  // Authentication routes
  app.post('/api/auth/login', async (req, res) => {
    try {
      const { username, password } = loginSchema.parse(req.body);
      
      const user = await storage.getUserByUsername(username);
      if (!user || !user.isActive) {
        return res.status(401).json({ error: "Invalid username or password" });
      }

      // For development, compare plain text passwords
      // In production, use: await bcrypt.compare(password, user.password)
      const isValidPassword = password === user.password;
      if (!isValidPassword) {
        return res.status(401).json({ error: "Invalid username or password" });
      }

      // Update last login
      await storage.updateUserLastLogin(user.id);
      
      // Set session
      req.session.userId = user.id;
      
      res.json({ 
        success: true, 
        user: { 
          id: user.id, 
          username: user.username, 
          isAdmin: user.isAdmin 
        } 
      });
    } catch (error) {
      res.status(400).json({ error: "Invalid request data" });
    }
  });

  app.post('/api/auth/logout', (req, res) => {
    req.session.destroy(() => {});
    res.json({ success: true });
  });

  app.get('/api/auth/me', requireAuth, async (req, res) => {
    const user = (req as any).user as User;
    res.json({ 
      id: user.id, 
      username: user.username, 
      isAdmin: user.isAdmin 
    });
  });

  // Admin user management routes
  app.get('/api/admin/users', requireAuth, requireAdmin, async (req, res) => {
    const users = await storage.getAllUsers();
    const safeUsers = users.map(u => ({
      id: u.id,
      username: u.username,
      isAdmin: u.isAdmin,
      isActive: u.isActive,
      lastLoginAt: u.lastLoginAt,
      createdAt: u.createdAt
    }));
    res.json(safeUsers);
  });

  app.post('/api/admin/users', requireAuth, requireAdmin, async (req, res) => {
    try {
      const userData = createUserSchema.parse(req.body);
      
      // Check if username already exists
      const existingUser = await storage.getUserByUsername(userData.username);
      if (existingUser) {
        return res.status(400).json({ error: "Username already exists" });
      }

      // Hash password in production
      // userData.password = await bcrypt.hash(userData.password, 10);
      
      const user = await storage.createUser(userData);
      res.json({ 
        id: user.id, 
        username: user.username, 
        isAdmin: user.isAdmin,
        isActive: user.isActive,
        createdAt: user.createdAt
      });
    } catch (error) {
      res.status(400).json({ error: "Invalid user data" });
    }
  });

  app.patch('/api/admin/users/:id', requireAuth, requireAdmin, async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      const updates = updateUserSchema.parse(req.body);
      
      // Hash password if provided
      // if (updates.password) {
      //   updates.password = await bcrypt.hash(updates.password, 10);
      // }
      
      const user = await storage.updateUser(userId, updates);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      res.json({ 
        id: user.id, 
        username: user.username, 
        isAdmin: user.isAdmin,
        isActive: user.isActive
      });
    } catch (error) {
      res.status(400).json({ error: "Invalid update data" });
    }
  });

  // Job application routes
  app.get('/api/applications', requireAuth, async (req, res) => {
    const user = (req as any).user as User;
    const applications = await storage.getJobApplicationsByUser(user.id);
    res.json(applications);
  });

  app.get('/api/applications/latest', requireAuth, async (req, res) => {
    const user = (req as any).user as User;
    const application = await storage.getLatestJobApplication(user.id);
    res.json(application || null);
  });

  app.post('/api/applications', requireAuth, async (req, res) => {
    try {
      const user = (req as any).user as User;
      
      console.log(`📝 POST /api/applications - User: ${user.username}, Body keys: [${Object.keys(req.body).join(', ')}]`);
      
      // Check if the user has reached Step 4 (based on currentStep being 4)
      const { searchResults, currentVacancyIndex, title, selectedKeywords, currentStep } = req.body;
      if (currentStep !== 4) {
        console.log(`❌ Cannot save - not on Step 4. Current step: ${currentStep}`);
        return res.status(400).json({ 
          error: "Cannot save before reaching Step 4",
          message: "Searches are only saved once you reach the results viewer in Step 4."
        });
      }
      
      console.log(`✅ Step 4 validation passed - currentStep: ${currentStep}, keywords: [${selectedKeywords?.join(', ') || 'none'}], results: ${searchResults?.length || 0}`);
      
      // Allow saving even if search results haven't loaded yet (they come async)
      
      // Prepare validated data with safe defaults
      const safeAppData = {
        ...req.body,
        userId: user.id,
        vacancies: req.body.vacancies || [], // Default to empty array if undefined
        totalVacancies: req.body.totalVacancies || 0,
        appliedVacancyIds: req.body.appliedVacancyIds || [],
        selectedKeywords: req.body.selectedKeywords || [],
        suggestedKeywords: req.body.suggestedKeywords || []
      };
      
      console.log(`🔍 Request body validation - vacancies: ${req.body.vacancies?.length || 'undefined'}, total: ${req.body.totalVacancies || 'undefined'}`);
      
      const appData = insertJobApplicationSchema.parse(safeAppData);
      
      console.log(`✅ Creating application - Title: "${title}", Keywords: [${selectedKeywords?.join(', ') || 'none'}], Results: ${appData.vacancies.length}`);
      
      const application = await storage.createJobApplication(appData);
      
      console.log(`💾 Application created successfully - ID: ${application.id}, Response status: 201`);
      
      res.status(201).json(application);
    } catch (error: any) {
      console.error(`❌ POST /api/applications failed:`, error?.message || error);
      res.status(400).json({ error: "Invalid application data", details: error?.message });
    }
  });

  app.patch('/api/applications/:id', requireAuth, async (req, res) => {
    try {
      const user = (req as any).user as User;
      const appId = parseInt(req.params.id);
      
      // Verify user owns this application
      const existingApp = await storage.getJobApplication(appId);
      if (!existingApp || existingApp.userId !== user.id) {
        return res.status(404).json({ error: "Application not found" });
      }
      
      // Check if the update has reached Step 4 (based on presence of search results)
      const { searchResults } = req.body;
      if (searchResults !== undefined && (!searchResults || searchResults.length === 0)) {
        return res.status(400).json({ 
          error: "Cannot save before reaching Step 4",
          message: "Searches are only saved once you reach the results viewer in Step 4."
        });
      }
      
      const updates = updateJobApplicationSchema.parse(req.body);
      const application = await storage.updateJobApplication(appId, updates);
      
      res.json(application);
    } catch (error) {
      res.status(400).json({ error: "Invalid update data" });
    }
  });

  app.delete('/api/applications/:id', requireAuth, async (req, res) => {
    const user = (req as any).user as User;
    const appId = parseInt(req.params.id);
    
    // Verify user owns this application
    const existingApp = await storage.getJobApplication(appId);
    if (!existingApp || existingApp.userId !== user.id) {
      return res.status(404).json({ error: "Application not found" });
    }
    
    await storage.deleteJobApplication(appId);
    res.json({ success: true });
  });

  // Protected AI and search routes - Russian-first suggestions
  app.get('/api/ai-keywords', requireAuth, async (req, res) => {
    const startTime = Date.now();
    
    try {
      const query = req.query.q as string;
      if (!query) {
        return res.status(400).json({ error: 'Query parameter "q" is required' });
      }

      const cacheKey = `ai-keywords-ru:${query}`;
      const cached = suggestionsCache.get(cacheKey);
      if (cached) {
        res.locals.addTiming('cache', Date.now() - startTime);
        return res.json(cached);
      }

      const result = await coalesceRequest(cacheKey, async () => {
        const aiStartTime = Date.now();
        let aiSeeds = null;
        let aiDuration = 0;
        
        try {
          // Generate Russian seed terms using Gemini
          aiSeeds = await aiClient.generateRussianSeedTerms(query);
          aiDuration = Date.now() - aiStartTime;
        } catch (error) {
          console.error('Gemini AI failed, using fallback:', error);
          aiDuration = Date.now() - aiStartTime;
          // Fallback: use user's query as direct seed
          aiSeeds = {
            exactPhrases: [query],
            strongSynonyms: [],
            weakAmbiguous: [],
            allowedEnglishAcronyms: []
          };
        }

        // Verify and expand with HH.ru suggestions API
        const hhStartTime = Date.now();
        const categorizedSuggestions = {
          exactPhrases: new Map<string, number>(),
          strongSynonyms: new Map<string, number>(),
          weakAmbiguous: new Map<string, number>()
        };

        // Process all seed terms through HH.ru
        const allSeedTerms = [
          ...aiSeeds.exactPhrases,
          ...aiSeeds.strongSynonyms,
          ...aiSeeds.weakAmbiguous,
          ...aiSeeds.allowedEnglishAcronyms
        ];

        for (const term of allSeedTerms.slice(0, 20)) { // Limit API calls
          try {
            const { data } = await hhClient.getSuggestions(term);
            if (data && data.items && Array.isArray(data.items)) {
              data.items.forEach((item: any) => {
                if (item && item.text) {
                  const text = item.text.trim();
                  
                  // Categorize based on original seed source and Russian priority
                  let category: keyof typeof categorizedSuggestions = 'strongSynonyms';
                  
                  if (aiSeeds.exactPhrases.includes(term)) {
                    category = 'exactPhrases';
                  } else if (aiSeeds.weakAmbiguous.includes(term)) {
                    category = 'weakAmbiguous';
                  }
                  
                  // Russian terms get priority (move up category if Russian)
                  const isRussian = /[а-яё]/i.test(text);
                  if (isRussian && category === 'weakAmbiguous') {
                    category = 'strongSynonyms';
                  } else if (isRussian && category === 'strongSynonyms' && 
                             aiSeeds.exactPhrases.some(exact => 
                               text.toLowerCase().includes(exact.toLowerCase()) || 
                               exact.toLowerCase().includes(text.toLowerCase()))) {
                    category = 'exactPhrases';
                  }
                  
                  const count = categorizedSuggestions[category].get(text) || 0;
                  categorizedSuggestions[category].set(text, count + 1);
                }
              });
            }
          } catch (error) {
            console.error(`Failed to get suggestions for "${term}":`, error);
          }
          
          // Small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 150));
        }

        const hhDuration = Date.now() - hhStartTime;

        // Sort and deduplicate within categories
        const dedupeAndSort = (suggestions: Map<string, number>, limit: number) => {
          const entries = Array.from(suggestions.entries());
          
          // Deduplicate similar terms (case-insensitive, handle hyphens/spaces)
          const deduped = new Map<string, { text: string; count: number; isRussian: boolean }>();
          
          entries.forEach(([text, count]) => {
            const normalizedKey = text.toLowerCase()
              .replace(/[-\s]/g, '')
              .replace(/[^\wа-яё]/gi, '');
            const isRussian = /[а-яё]/i.test(text);
            
            const existing = deduped.get(normalizedKey);
            if (!existing || count > existing.count || (isRussian && !existing.isRussian)) {
              deduped.set(normalizedKey, { text, count, isRussian });
            }
          });
          
          return Array.from(deduped.values())
            .sort((a, b) => {
              // Sort by: Russian first, then by count, then by length
              if (a.isRussian !== b.isRussian) return a.isRussian ? -1 : 1;
              if (a.count !== b.count) return b.count - a.count;
              return a.text.length - b.text.length;
            })
            .slice(0, limit)
            .map(item => ({ 
              text: item.text, 
              source: 'hh' as const,
              isEnglish: !item.isRussian
            }));
        };

        const result = {
          exactPhrases: dedupeAndSort(categorizedSuggestions.exactPhrases, 8),
          strongSynonyms: dedupeAndSort(categorizedSuggestions.strongSynonyms, 12),
          weakAmbiguous: dedupeAndSort(categorizedSuggestions.weakAmbiguous, 8),
          aiSeeds: aiSeeds || null, // For debug mode
          languageStats: {
            totalSuggestions: 0,
            russianCount: 0,
            englishCount: 0
          }
        };

        // Calculate language stats
        const allSuggestions = [...result.exactPhrases, ...result.strongSynonyms, ...result.weakAmbiguous];
        result.languageStats = {
          totalSuggestions: allSuggestions.length,
          russianCount: allSuggestions.filter(s => !s.isEnglish).length,
          englishCount: allSuggestions.filter(s => s.isEnglish).length
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
  app.get('/api/dictionaries', requireAuth, async (req, res) => {
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
  app.get('/api/areas', requireAuth, async (req, res) => {
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
  app.post('/api/filters/match', requireAuth, async (req, res) => {
    const startTime = Date.now();
    
    try {
      const validatedBody = filterMatchRequestSchema.parse(req.body);
      
      console.log('🎯 Filter match request received:');
      console.log('   Selected keywords:', validatedBody.selectedKeywords);
      console.log('   Use exact phrases:', validatedBody.useExactPhrases);
      console.log('   Title first search:', validatedBody.titleFirstSearch);
      
      // Get dictionaries for mapping
      const dictionaries = dictionariesCache.get('dictionaries') || 
                          (await hhClient.getDictionaries()).data;

      const aiStartTime = Date.now();
      const filters = await aiClient.mapFiltersToHH(validatedBody, dictionaries);
      const aiDuration = Date.now() - aiStartTime;
      
      console.log('🎯 Filter match response generated:');
      console.log('   Text parameter:', filters.text);
      console.log('   Search fields:', filters.search_field);

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
  app.get('/api/vacancies', requireAuth, async (req, res) => {
    const startTime = Date.now();
    
    // Echo debugging - correlation ID from client
    const searchRunId = req.headers['x-search-run-id'] as string || 'unknown';
    const clientSignature = req.headers['x-client-signature'] as string || 'none';
    
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
        per_page: Math.min(parseInt(req.query.per_page as string) || 100, 2000),
        page: parseInt(req.query.page as string) || 0,
        specialization: req.query.specialization as string,
        metro: req.query.metro as string,
        employer_id: req.query.employer_id as string,
        search_field: Array.isArray(req.query.search_field) ? req.query.search_field : [req.query.search_field].filter(Boolean),
        label: req.query.label as string[]
      };
      
      // Generate server signature from actual params used (after ensuring search_field is array)
      const searchFieldArray = Array.isArray(params.search_field) ? params.search_field : [params.search_field].filter(Boolean);
      const serverSignature = `server_${params.text || 'notext'}_${searchFieldArray.join('-') || 'nosf'}_${Date.now().toString(36)}`;
      
      // Extensive debugging
      console.log(`🔍 [${searchRunId}] Server Search Debug:`);
      console.log(`   Client Signature: ${clientSignature}`);
      console.log(`   Server Signature: ${serverSignature}`);
      console.log(`   Resolved Keywords: [${params.text || 'none'}]`);
      console.log(`   Search Field: ${searchFieldArray.join(',') || 'default'}`);
      console.log(`   Full Params:`, JSON.stringify(params, null, 2));
      
      const { data, timing } = await hhClient.searchVacancies(params);
      
      console.log(`🔍 [${searchRunId}] HH.ru Response: status=200, found=${data.found}, items=${data.items?.length || 0}`);

      // Trim payload to essentials + add echo data
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
        per_page: data.per_page,
        // Echo debugging data
        debugEcho: {
          clientSignature,
          serverSignature,
          resolvedKeywords: [params.text].filter(Boolean),
          resolvedFilters: {
            area: params.area,
            experience: params.experience,
            searchField: searchFieldArray
          },
          httpStatus: 200,
          hhCount: data.found || 0,
          parsedCount: data.items?.length || 0,
          searchRunId,
          tier: searchFieldArray.includes('name') ? 'title' : 
                searchFieldArray.includes('description') ? 'description' : 
                searchFieldArray.includes('company_name') ? 'skills' : 'unknown'
        }
      };
      
      console.log(`🔍 [${searchRunId}] Server Response: ${trimmed.found} found, first: "${trimmed.items[0]?.name || 'none'}"`);

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
  app.get('/api/vacancies/:id', requireAuth, async (req, res) => {
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
        apply_alternate_url: data.apply_alternate_url,
        descriptionHtmlSanitized,
        key_skills: data.key_skills || [],
        salary: data.salary,
        // Work format and schedule information from HH.ru API
        working_time_modes: data.working_time_modes || [],
        schedule: data.schedule || null,
        employment: data.employment || null
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
  app.post('/api/cover-letter', requireAuth, async (req, res) => {
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

  // GET /api/saved-prompts
  app.get('/api/saved-prompts', requireAuth, async (req, res) => {
    const startTime = Date.now();
    
    try {
      const user = (req as any).user as User;
      const prompts = await storage.getSavedPromptsByUser(user.id);
      
      res.locals.addTiming('db', Date.now() - startTime);
      res.json(prompts);

    } catch (error: any) {
      console.error('Get saved prompts error:', error);
      res.status(500).json({ 
        error: 'Failed to fetch saved prompts',
        message: error.message 
      });
    }
  });

  // POST /api/saved-prompts
  app.post('/api/saved-prompts', requireAuth, async (req, res) => {
    const startTime = Date.now();
    
    try {
      const user = (req as any).user as User;
      const validatedBody = insertSavedPromptSchema.parse(req.body);
      const promptData = insertSavedPromptWithUserSchema.parse({ ...validatedBody, userId: user.id });
      
      // Check for duplicate names
      const existingPrompt = await storage.getSavedPromptByUserAndName(user.id, validatedBody.name);
      if (existingPrompt) {
        return res.status(409).json({
          error: 'A prompt with this name already exists',
          existingPromptId: existingPrompt.id
        });
      }
      
      const prompt = await storage.createSavedPrompt(promptData);
      
      res.locals.addTiming('db', Date.now() - startTime);
      res.json(prompt);

    } catch (error: any) {
      console.error('Save prompt error:', error);
      res.status(400).json({ 
        error: 'Failed to save prompt',
        message: error.message 
      });
    }
  });

  // DELETE /api/saved-prompts/:id
  app.delete('/api/saved-prompts/:id', requireAuth, async (req, res) => {
    const startTime = Date.now();
    
    try {
      const user = (req as any).user as User;
      const promptId = parseInt(req.params.id);
      
      // Verify user owns this prompt
      const prompt = await storage.getSavedPrompt(promptId);
      if (!prompt || prompt.userId !== user.id) {
        return res.status(404).json({ error: "Prompt not found" });
      }
      
      await storage.deleteSavedPrompt(promptId);
      
      res.locals.addTiming('db', Date.now() - startTime);
      res.json({ success: true });

    } catch (error: any) {
      console.error('Delete prompt error:', error);
      res.status(500).json({ 
        error: 'Failed to delete prompt',
        message: error.message 
      });
    }
  });

  // GET /api/user-settings
  app.get('/api/user-settings', requireAuth, async (req, res) => {
    const startTime = Date.now();
    
    try {
      const user = (req as any).user as User;
      const settings = await storage.getUserSettings(user.id);
      
      res.locals.addTiming('db', Date.now() - startTime);
      res.json(settings || null);

    } catch (error: any) {
      console.error('Get user settings error:', error);
      res.status(500).json({ 
        error: 'Failed to fetch user settings',
        message: error.message 
      });
    }
  });

  // POST /api/user-settings
  app.post('/api/user-settings', requireAuth, async (req, res) => {
    const startTime = Date.now();
    
    try {
      const user = (req as any).user as User;
      const validatedBody = insertUserSettingsSchema.parse(req.body);
      
      const settings = await storage.updateUserSettings(user.id, validatedBody);
      
      res.locals.addTiming('db', Date.now() - startTime);
      res.json(settings);

    } catch (error: any) {
      console.error('Save user settings error:', error);
      res.status(400).json({ 
        error: 'Failed to save user settings',
        message: error.message 
      });
    }
  });

  // DELETE /api/saved-prompts/:id
  app.delete('/api/saved-prompts/:id', requireAuth, async (req, res) => {
    const startTime = Date.now();
    
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid prompt ID' });
      }
      
      // For now, just return success since we don't have database setup
      res.locals.addTiming('db', Date.now() - startTime);
      res.json({ success: true });

    } catch (error: any) {
      console.error('Delete prompt error:', error);
      res.status(500).json({ 
        error: 'Failed to delete prompt',
        message: error.message 
      });
    }
  });

  // GET /api/applied-vacancies - Check if user has applied to specific vacancies
  app.get('/api/applied-vacancies', requireAuth, async (req, res) => {
    const startTime = Date.now();
    
    try {
      const userId = (req as any).user.id;
      const vacancyIds = req.query.vacancyIds as string | undefined;
      
      if (!vacancyIds) {
        return res.status(400).json({ error: 'vacancyIds parameter required' });
      }
      
      const idsArray = vacancyIds.split(',').filter(Boolean);
      
      // For now, return empty array since we don't have database setup
      // In real implementation, query database for applied vacancies
      const appliedVacancies: string[] = [];
      
      res.locals.addTiming('db', Date.now() - startTime);
      res.json({ appliedVacancies });

    } catch (error: any) {
      console.error('Check applied vacancies error:', error);
      res.status(500).json({ 
        error: 'Failed to check applied vacancies',
        message: error.message 
      });
    }
  });

  // POST /api/apply-vacancy - Apply to a vacancy
  app.post('/api/apply-vacancy', requireAuth, async (req, res) => {
    const startTime = Date.now();
    
    try {
      const userId = (req as any).user.id;
      const { vacancyId, vacancyTitle, companyName } = req.body;
      
      if (!vacancyId || !vacancyTitle || !companyName) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      // First, verify the vacancy still exists on HH.ru
      const vacancyResponse = await hhClient.getVacancy(vacancyId);
      const vacancyDetail = vacancyResponse?.data;
      if (!vacancyDetail) {
        return res.status(404).json({ 
          error: 'vacancy_not_found',
          message: 'This vacancy is no longer available' 
        });
      }

      // Check if user has already applied (mock for now)
      // In real implementation: query applied_vacancies table
      const hasAlreadyApplied = false;
      
      if (hasAlreadyApplied) {
        return res.status(409).json({ 
          error: 'already_applied',
          message: 'You have already applied to this vacancy' 
        });
      }

      // TODO: Implement actual HH.ru application via API
      // For now, just record the application attempt
      
      // Mock application response
      const applicationResult = {
        vacancyId,
        appliedAt: new Date(),
        status: 'applied' as const
      };
      
      res.locals.addTiming('db', Date.now() - startTime);
      res.json(applicationResult);

    } catch (error: any) {
      console.error('Apply to vacancy error:', error);
      res.status(500).json({ 
        error: 'Failed to apply to vacancy',
        message: error.message 
      });
    }
  });

  // GET /api/vacancy-status/:id - Check vacancy status and application eligibility
  app.get('/api/vacancy-status/:id', requireAuth, async (req, res) => {
    const startTime = Date.now();
    
    try {
      const vacancyId = req.params.id;
      const userId = (req as any).user.id;
      
      // Check if vacancy exists on HH.ru
      let vacancyExists = true;
      try {
        const vacancyResponse = await hhClient.getVacancy(vacancyId);
        vacancyExists = !!vacancyResponse?.data;
      } catch (error) {
        console.log(`Vacancy ${vacancyId} check failed:`, error);
        vacancyExists = false;
      }
      
      // Check if user has already applied (mock for now)
      const hasApplied = false;
      
      // Check if vacancy requires test or is direct type (mock for now)
      const requiresTest = false;
      const isDirect = false;
      
      const status = {
        vacancyId,
        exists: vacancyExists,
        canApply: vacancyExists && !hasApplied && !requiresTest && !isDirect,
        hasApplied,
        requiresTest,
        isDirect,
        message: !vacancyExists ? 'This job is no longer available.' :
                hasApplied ? 'You already applied to this job.' :
                requiresTest ? 'This job requires a test. Applying via the API isn\'t supported.' :
                isDirect ? 'This vacancy can\'t be applied to through the API.' :
                'Ready to apply'
      };
      
      res.locals.addTiming('db', Date.now() - startTime);
      res.json(status);

    } catch (error: any) {
      console.error('Check vacancy status error:', error);
      res.status(500).json({ 
        error: 'Failed to check vacancy status',
        message: error.message 
      });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
