export interface AIKeywordsResponse {
  aiTitles: string[];
  suggestionsTop10: Array<{
    text: string;
    source: 'hh';
  }>;
}

export interface HHArea {
  id: string;
  name: string;
  areas?: HHArea[];
}

export interface HHDictionaries {
  experience: Array<{ id: string; name: string }>;
  employment: Array<{ id: string; name: string }>;
  schedule: Array<{ id: string; name: string }>;
  vacancy_search_order: Array<{ id: string; name: string }>;
  currency: Array<{ id: string; name: string }>;
  vacancy_label?: Array<{ id: string; name: string }>;
  vacancy_search_fields?: Array<{ id: string; name: string }>;
  education_level?: Array<{ id: string; name: string }>;
  working_time_modes?: Array<{ id: string; name: string }>;
}

export interface FilterMatchRequest {
  selectedKeywords: string[];
  
  // Filter enablement flags
  enableLocationFilter?: boolean;
  enableExperienceFilter?: boolean;
  enableEmploymentFilter?: boolean;
  enableScheduleFilter?: boolean;
  enableSalaryFilter?: boolean;
  enableMetroFilter?: boolean;
  enableLabelFilter?: boolean;
  enableEducationFilter?: boolean;
  enableWorkFormatFilter?: boolean;
  
  // Existing filters
  locationText?: string;
  remoteHybrid?: {
    remoteOnly: boolean;
    hybridOk: boolean;
  };
  experienceText?: string;
  incomeNumber?: number;
  currency?: string;
  employmentTypes?: string[];
  scheduleTypes?: string[];
  onlyWithSalary?: boolean;
  period?: number;
  orderBy?: string;
  
  // New filters
  metroStation?: string;
  searchFields?: string[];
  vacancyLabels?: string[];
  employerName?: string;
  
  // Education and work format filters
  educationLevel?: string;
  workFormats?: string[];
}

export interface FilterMatchResponse {
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
  metro?: string;
  search_field?: string[];
  label?: string[];
  employer_id?: string;
}

export interface HHVacancyListItem {
  id: string;
  name: string;
  employer: { name: string };
  area: { name: string };
  snippet?: {
    requirement: string | null;
    responsibility: string | null;
  };
  salary: {
    from: number | null;
    to: number | null;
    currency: string;
  } | null;
  alternate_url: string;
}

export interface HHVacanciesResponse {
  items: HHVacancyListItem[];
  found: number;
  pages: number;
  page: number;
  per_page: number;
}

export interface HHVacancyDetail {
  id: string;
  name: string;
  employer: { name: string };
  area: { name: string };
  alternate_url: string;
  apply_alternate_url?: string;
  descriptionHtmlSanitized: string;
  key_skills: Array<{ name: string }>;
  salary: {
    from: number | null;
    to: number | null;
    currency: string;
  } | null;
}

export interface CoverLetterRequest {
  name: string;
  employerName: string;
  areaName: string;
  skillsList: string[];
  plainDescription: string;
  userProfile?: string;
  customPrompt?: string;
}

export interface CoverLetterResponse {
  text: string;
}

export interface ApiError {
  error: string;
  message?: string;
  retryInMs?: number;
}
