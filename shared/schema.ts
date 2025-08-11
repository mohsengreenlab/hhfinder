import { z } from "zod";

// HH.ru API response types
export const hhSuggestionSchema = z.object({
  text: z.string(),
  source: z.literal("hh")
});

export const aiKeywordsResponseSchema = z.object({
  aiTitles: z.array(z.string()),
  suggestionsTop10: z.array(hhSuggestionSchema)
});

export const hhAreaSchema: z.ZodType<{
  id: string;
  name: string;
  areas?: Array<{
    id: string;
    name: string;
    areas?: any;
  }>;
}> = z.object({
  id: z.string(),
  name: z.string(),
  areas: z.array(z.lazy(() => hhAreaSchema)).optional()
});

export const hhDictionaryItemSchema = z.object({
  id: z.string(),
  name: z.string()
});

export const hhDictionariesSchema = z.object({
  experience: z.array(hhDictionaryItemSchema),
  employment: z.array(hhDictionaryItemSchema),
  schedule: z.array(hhDictionaryItemSchema),
  vacancy_search_order: z.array(hhDictionaryItemSchema),
  currency: z.array(hhDictionaryItemSchema),
  vacancy_label: z.array(hhDictionaryItemSchema).optional(),
  vacancy_search_fields: z.array(hhDictionaryItemSchema).optional(),
  education_level: z.array(hhDictionaryItemSchema).optional(),
  working_time_modes: z.array(hhDictionaryItemSchema).optional()
});

export const filterMatchRequestSchema = z.object({
  selectedKeywords: z.array(z.string()),
  
  // Filter enablement flags
  enableLocationFilter: z.boolean().optional(),
  enableExperienceFilter: z.boolean().optional(),
  enableEmploymentFilter: z.boolean().optional(),
  enableScheduleFilter: z.boolean().optional(),
  enableSalaryFilter: z.boolean().optional(),
  enableMetroFilter: z.boolean().optional(),
  enableLabelFilter: z.boolean().optional(),
  enableEducationFilter: z.boolean().optional(),
  enableWorkFormatFilter: z.boolean().optional(),
  
  // Existing filters
  locationText: z.string().optional(),
  remoteHybrid: z.object({
    remoteOnly: z.boolean(),
    hybridOk: z.boolean()
  }).optional(),
  experienceText: z.string().optional(),
  incomeNumber: z.number().optional(),
  currency: z.string().optional(),
  employmentTypes: z.array(z.string()).optional(),
  scheduleTypes: z.array(z.string()).optional(),
  onlyWithSalary: z.boolean().optional(),
  period: z.number().optional(),
  orderBy: z.string().optional(),
  
  // New filters
  metroStation: z.string().optional(),
  searchFields: z.array(z.string()).optional(),
  vacancyLabels: z.array(z.string()).optional(),
  employerName: z.string().optional(),
  
  // Education and work format filters
  educationLevel: z.string().optional(),
  workFormats: z.array(z.string()).optional()
});

export const filterMatchResponseSchema = z.object({
  text: z.string(),
  area: z.string().optional(),
  experience: z.string().optional(),
  employment: z.array(z.string()).optional(),
  schedule: z.array(z.string()).optional(),
  salary: z.number().optional(),
  currency: z.string().optional(),
  only_with_salary: z.boolean().optional(),
  period: z.number().optional(),
  order_by: z.string().optional(),
  metro: z.string().optional(),
  search_field: z.array(z.string()).optional(),
  label: z.array(z.string()).optional(),
  employer_id: z.string().optional()
});

export const hhVacancyListItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  employer: z.object({
    name: z.string()
  }),
  area: z.object({
    name: z.string()
  }),
  snippet: z.object({
    requirement: z.string().nullable(),
    responsibility: z.string().nullable()
  }).optional(),
  salary: z.object({
    from: z.number().nullable(),
    to: z.number().nullable(),
    currency: z.string()
  }).nullable(),
  alternate_url: z.string()
});

export const hhVacancyDetailSchema = z.object({
  id: z.string(),
  name: z.string(),
  employer: z.object({
    name: z.string()
  }),
  area: z.object({
    name: z.string()
  }),
  alternate_url: z.string(),
  descriptionHtmlSanitized: z.string(),
  key_skills: z.array(z.object({
    name: z.string()
  })),
  salary: z.object({
    from: z.number().nullable(),
    to: z.number().nullable(),
    currency: z.string()
  }).nullable()
});

export const coverLetterRequestSchema = z.object({
  name: z.string(),
  employerName: z.string(),
  areaName: z.string(),
  skillsList: z.array(z.string()),
  plainDescription: z.string(),
  userProfile: z.string().optional(),
  customPrompt: z.string().optional()
});

export const coverLetterResponseSchema = z.object({
  text: z.string()
});

export type HHSuggestion = z.infer<typeof hhSuggestionSchema>;
export type AIKeywordsResponse = z.infer<typeof aiKeywordsResponseSchema>;
export type HHArea = z.infer<typeof hhAreaSchema>;
export type HHDictionaries = z.infer<typeof hhDictionariesSchema>;
export type FilterMatchRequest = z.infer<typeof filterMatchRequestSchema>;
export type FilterMatchResponse = z.infer<typeof filterMatchResponseSchema>;
export type HHVacancyListItem = z.infer<typeof hhVacancyListItemSchema>;
export type HHVacancyDetail = z.infer<typeof hhVacancyDetailSchema>;
export type CoverLetterRequest = z.infer<typeof coverLetterRequestSchema>;
export type CoverLetterResponse = z.infer<typeof coverLetterResponseSchema>;



// Saved prompts schema
export const insertSavedPromptSchema = z.object({
  name: z.string().min(1),
  prompt: z.string().min(1)
});

export type InsertSavedPrompt = z.infer<typeof insertSavedPromptSchema>;

// User schema with authentication
export const userSchema = z.object({
  id: z.number(),
  username: z.string(),
  password: z.string(),
  isAdmin: z.boolean(),
  isActive: z.boolean(),
  lastLoginAt: z.date().nullable(),
  createdAt: z.date()
});

export const insertUserSchema = z.object({
  username: z.string().min(1).max(50),
  password: z.string().min(6),
  isAdmin: z.boolean().default(false)
});

export const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1)
});

// Job application schema for session continuity
export const jobApplicationSchema = z.object({
  id: z.number(),
  userId: z.number(),
  title: z.string(),
  currentStep: z.number(),
  selectedKeywords: z.array(z.string()),
  suggestedKeywords: z.array(z.string()),
  filters: z.record(z.any()),
  currentVacancyIndex: z.number(),
  vacancies: z.array(z.any()),
  lastEditedAt: z.date(),
  createdAt: z.date(),
  isCompleted: z.boolean()
});

export const insertJobApplicationSchema = z.object({
  userId: z.number(),
  title: z.string().min(1),
  currentStep: z.number().min(1).max(4),
  selectedKeywords: z.array(z.string()).default([]),
  suggestedKeywords: z.array(z.string()).default([]),
  filters: z.record(z.any()).default({}),
  currentVacancyIndex: z.number().default(0),
  vacancies: z.array(z.any()).default([]),
  isCompleted: z.boolean().default(false)
});

export const updateJobApplicationSchema = insertJobApplicationSchema.partial().omit({ userId: true });

// Admin user management schemas
export const createUserSchema = z.object({
  username: z.string().min(1).max(50),
  password: z.string().min(6),
  isAdmin: z.boolean().default(false)
});

export const updateUserSchema = z.object({
  username: z.string().min(1).max(50).optional(),
  password: z.string().min(6).optional(),
  isActive: z.boolean().optional()
});

export type User = z.infer<typeof userSchema>;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type LoginRequest = z.infer<typeof loginSchema>;
export type JobApplication = z.infer<typeof jobApplicationSchema>;
export type InsertJobApplication = z.infer<typeof insertJobApplicationSchema>;
export type UpdateJobApplication = z.infer<typeof updateJobApplicationSchema>;
export type CreateUserRequest = z.infer<typeof createUserSchema>;
export type UpdateUserRequest = z.infer<typeof updateUserSchema>;
