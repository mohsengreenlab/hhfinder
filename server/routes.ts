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
      const appData = insertJobApplicationSchema.parse({ ...req.body, userId: user.id });
      
      const application = await storage.createJobApplication(appData);
      res.json(application);
    } catch (error) {
      res.status(400).json({ error: "Invalid application data" });
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

  // Protected AI and search routes
  app.get('/api/ai-keywords', requireAuth, async (req, res) => {
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

        // Verify titles with HH.ru suggestions API
        const hhStartTime = Date.now();
        const allSuggestions = new Map<string, number>();

        // Check AI titles and extract key words for verification
        const searchTerms = new Set<string>();
        
        for (const title of aiTitles) {
          // Add the full title if it's reasonable length
          if (title.length >= 3 && title.length <= 50) {
            searchTerms.add(title);
          }
          
          // Extract meaningful words (3+ characters)
          const words = title.toLowerCase().split(/[^a-zа-я0-9]+/).filter(word => word.length >= 3);
          words.forEach(word => searchTerms.add(word));
        }

        // Limit to prevent too many API calls
        const termsToCheck = Array.from(searchTerms).slice(0, 20);

        for (const term of termsToCheck) {
          try {
            const { data } = await hhClient.getSuggestions(term);
            if (data && data.items && Array.isArray(data.items)) {
              data.items.forEach((item: any) => {
                if (item && item.text) {
                  const text = item.text;
                  const count = allSuggestions.get(text) || 0;
                  allSuggestions.set(text, count + 1);
                }
              });
            }
          } catch (error) {
            console.error(`Failed to get suggestions for "${term}":`, error);
          }
          
          // Small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 200));
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
  app.get('/api/vacancies', requireAuth, async (req, res) => {
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
        per_page: Math.min(parseInt(req.query.per_page as string) || 100, 2000),
        page: parseInt(req.query.page as string) || 0,
        specialization: req.query.specialization as string,
        metro: req.query.metro as string,
        employer_id: req.query.employer_id as string,
        search_field: req.query.search_field as string[],
        label: req.query.label as string[]
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
      // For now, return empty array since we don't have database setup
      res.locals.addTiming('db', Date.now() - startTime);
      res.json([]);

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
      const validatedBody = insertSavedPromptSchema.parse(req.body);
      
      // For now, just return a mock response since we don't have database setup
      const mockResponse = {
        id: Date.now(),
        name: validatedBody.name,
        prompt: validatedBody.prompt,
        created_at: new Date()
      };
      
      res.locals.addTiming('db', Date.now() - startTime);
      res.json(mockResponse);

    } catch (error: any) {
      console.error('Save prompt error:', error);
      res.status(500).json({ 
        error: 'Failed to save prompt',
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

  const httpServer = createServer(app);
  return httpServer;
}
