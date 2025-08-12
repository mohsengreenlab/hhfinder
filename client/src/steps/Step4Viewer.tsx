import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  ExternalLink, 
  FileText,
  Home,
  CheckCircle,
  AlertCircle,
  MapPin
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import LoadingLines from '@/components/LoadingLines';
import { useWizardStore } from '@/state/wizard';
import { 
  HHVacanciesResponse, 
  HHVacancyDetail, 
  CoverLetterRequest,
  CoverLetterResponse
} from '@/types/api';
import { 
  FilterMatchRequest,
  FilterMatchResponse
} from '@shared/schema';
import { useToast } from '@/hooks/use-toast';
import { ImprovedCoverLetterGenerator } from '@/components/ImprovedCoverLetterGenerator';

const searchLoadingMessages = [
  "Calibrating scanners…",
  "Scanning job databases…",
  "Analyzing market trends…",
  "Finding perfect matches…"
];

// Environment toggles for binary search debugging
const ENABLE_STEP4_MINIMAL = false; // Set to true to test minimal render
const ENABLE_STEP4_DEBUG_PANEL = true; // Debug panel only
const ENABLE_STEP4_QUERY = true; // React Query hook  
const ENABLE_STEP4_SIGNATURE_EFFECT = true; // Signature change effect
const ENABLE_STEP4_SMOOTH_SCROLL = false; // Smooth scrolling effects
const ENABLE_STEP4_PAGE_JUMP = false; // Page jump control
const ENABLE_STEP4_COVER_LETTER = false; // Cover letter generator

// Instrumentation counters
let renderCount = 0;
const effectRuns = {
  signature: 0,
  querySuccess: 0
};
let setIndexCalls = 0;

interface Step4ViewerProps {
  onBackToDashboard?: () => void;
}

export default function Step4Viewer({ onBackToDashboard }: Step4ViewerProps) {
  renderCount++;
  console.log(`Step4Viewer render #${renderCount}`);
  
  // Early return for minimal testing
  if (ENABLE_STEP4_MINIMAL) {
    return <div>Step 4 minimal</div>;
  }
  const { 
    selectedKeywords,
    selectedKeywordsCanonical, 
    filters, 
    searchResults, 
    currentVacancyIndex, 
    totalFound,
    appliedVacancyIds,
    searchNeedsRefresh,
    setSearchResults,
    setCurrentVacancyIndex,
    markVacancyAsApplied,
    markSearchCompleted,
    checkSearchNeedsRefresh,
    jumpToVacancy,

    generateSearchSignature,
    updateSearchSignature,
    isSearchSignatureChanged,
    currentSearchSignature,
    lastLoadedSignature,
    currentApplicationId,
    markReachedStep4
  } = useWizardStore();
  
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [showCoverLetter, setShowCoverLetter] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const [vacancyStatuses, setVacancyStatuses] = useState<Record<string, any>>({});
  const [generatedLetter, setGeneratedLetter] = useState('');
  const [selectedPromptTemplate, setSelectedPromptTemplate] = useState('default');
  const [customPrompt, setCustomPrompt] = useState('');
  const [savedPrompts, setSavedPrompts] = useState<any[]>([]);
  const [pageJumpValue, setPageJumpValue] = useState('');
  const [jumpError, setJumpError] = useState('');



  // Apply to vacancy - opens HH.ru and marks as applied
  const handleApplyToVacancy = () => {
    if (!vacancyDetail) return;
    
    try {
      // Build HH.ru apply URL 
      const applyUrl = vacancyDetail.apply_alternate_url || 
        vacancyDetail.alternate_url || 
        `https://hh.ru/vacancy/${vacancyDetail.id}`;
      
      // Open in new tab
      const newWindow = window.open(applyUrl, '_blank', 'noopener,noreferrer');
      
      // Check if popup was blocked
      if (!newWindow || newWindow.closed || typeof newWindow.closed === 'undefined') {
        // Popup blocked - show notice with direct link
        toast({
          title: "Pop-up blocked",
          description: (
            <div className="space-y-2">
              <p>Please allow pop-ups for this site, or</p>
              <a 
                href={applyUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-500 underline hover:text-blue-700"
              >
                Click here to apply on HH.ru
              </a>
            </div>
          ),
          duration: 10000
        });
      } else {
        // Successfully opened - show success message
        toast({
          title: "Opened HH.ru",
          description: "Complete your application on the HH.ru tab that just opened",
          duration: 5000
        });
      }
      
      // Mark vacancy as applied immediately
      markVacancyAsApplied(vacancyDetail.id);
      
    } catch (error) {
      console.error('Error applying to vacancy:', error);
      toast({
        title: "Error",
        description: "Could not open application page. Please try again.",
        variant: "destructive"
      });
    }
  };

  // Build the actual prompt that will be sent to Gemini
  const buildActualPrompt = () => {
    if (!vacancyDetail) return '';
    
    const systemPrompt = `You write concise, polite cover letters in English for real job applicants.

Requirements:
- 150-220 words
- 3 short paragraphs
- Mention 2-4 relevant skills
- Include 1 specific fact from the job posting
- No fluff or clichés
- Professional tone`;

    // Build user prompt based on template selection
    let userPrompt = '';
    
    const jobInfo = {
      position: vacancyDetail.name,
      company: vacancyDetail.employer.name,
      location: vacancyDetail.area.name,
      skills: vacancyDetail.key_skills.map(s => s.name).join(', '),
      description: vacancyDetail.descriptionHtmlSanitized.replace(/<[^>]*>/g, '').substring(0, 1000)
    };

    switch (selectedPromptTemplate) {
      case 'technical':
        userPrompt = `Write a technical cover letter for this software engineering position:
Position: ${jobInfo.position}
Company: ${jobInfo.company}
Location: ${jobInfo.location}
Required technologies: ${jobInfo.skills}

Focus on technical experience, problem-solving skills, and specific technologies mentioned in the job description. Be professional but show technical expertise.

Job description:
${jobInfo.description}`;
        break;
        
      case 'creative':
        userPrompt = `Write a creative, engaging cover letter that shows personality while remaining professional:
Position: ${jobInfo.position}
Company: ${jobInfo.company}
Location: ${jobInfo.location}
Key skills: ${jobInfo.skills}

Show enthusiasm, creativity, and how you'd add value to their team. Make it memorable but professional.

Job description:
${jobInfo.description}`;
        break;
        
      case 'custom':
        // For custom prompts, replace placeholders and return without system prompt
        userPrompt = customPrompt
          .replace(/\{\{POSITION\}\}/g, vacancyDetail.name)
          .replace(/\{\{COMPANY\}\}/g, vacancyDetail.employer.name)
          .replace(/\{\{LOCATION\}\}/g, vacancyDetail.area.name)
          .replace(/\{\{SKILLS\}\}/g, vacancyDetail.key_skills.map(s => s.name).join(', '))
          .replace(/\{\{DESCRIPTION\}\}/g, vacancyDetail.descriptionHtmlSanitized.replace(/<[^>]*>/g, '').substring(0, 1500));
        
        // Return only user prompt for custom templates
        return userPrompt;
        
      default:
        // Check if it's a saved prompt
        const savedPrompt = savedPrompts.find(p => p.name === selectedPromptTemplate);
        if (savedPrompt) {
          userPrompt = savedPrompt.prompt
            .replace(/\{\{POSITION\}\}/g, vacancyDetail.name)
            .replace(/\{\{COMPANY\}\}/g, vacancyDetail.employer.name)
            .replace(/\{\{LOCATION\}\}/g, vacancyDetail.area.name)
            .replace(/\{\{SKILLS\}\}/g, vacancyDetail.key_skills.map(s => s.name).join(', '))
            .replace(/\{\{DESCRIPTION\}\}/g, vacancyDetail.descriptionHtmlSanitized.replace(/<[^>]*>/g, '').substring(0, 1500));
          
          // Return only user prompt for saved templates (no system prompt)
          return userPrompt;
        }
        
        // Default template - fallback if no saved prompt found
        userPrompt = `Write a professional cover letter for this job:
Position: ${jobInfo.position}
Company: ${jobInfo.company}
Location: ${jobInfo.location}
Key skills: ${jobInfo.skills}

Job description:
${jobInfo.description}`;
        break;
    }

    // Return system prompt + user prompt for default templates
    return `${systemPrompt}\n\n${userPrompt}`;
  };
  
  // Convert filters to HH format
  const { data: hhFilters, isLoading: isMatchingFilters } = useQuery<FilterMatchResponse>({
    queryKey: ['/api/filters/match'],
    queryFn: async () => {
      const filterRequest: FilterMatchRequest = {
        selectedKeywords: selectedKeywordsCanonical.map(k => k.text),
        
        // Filter enablement flags
        enableLocationFilter: filters.enableLocationFilter,
        enableExperienceFilter: filters.enableExperienceFilter,
        enableEmploymentFilter: filters.enableEmploymentFilter,
        enableScheduleFilter: filters.enableScheduleFilter,
        enableSalaryFilter: filters.enableSalaryFilter,
        enableMetroFilter: filters.enableMetroFilter,
        enableLabelFilter: filters.enableLabelFilter,
        enableEducationFilter: filters.enableEducationFilter,
        enableWorkFormatFilter: filters.enableWorkFormatFilter,
        
        // Existing filters
        locationText: filters.locationText,
        remoteHybrid: {
          remoteOnly: filters.remoteOnly,
          hybridOk: filters.hybridOk
        },
        experienceText: filters.experience,
        incomeNumber: filters.salary || undefined,
        currency: filters.currency,
        employmentTypes: filters.employmentTypes,
        scheduleTypes: filters.scheduleTypes,
        onlyWithSalary: filters.onlyWithSalary,
        period: filters.period,
        orderBy: filters.orderBy,
        
        // New filters
        metroStation: filters.metroStation,
        searchFields: filters.searchFields,
        vacancyLabels: filters.vacancyLabels,
        employerName: filters.employerName,
        
        // Education and work format filters
        educationLevel: filters.educationLevel,
        workFormats: filters.workFormats,
        
        // New search options
        titleFirstSearch: filters.titleFirstSearch,
        useExactPhrases: filters.useExactPhrases,
        useAndAcrossPhrases: filters.useAndAcrossPhrases,
        enableDebugMode: filters.enableDebugMode,
        excludeWords: filters.excludeWords
      };

      const response = await fetch('/api/filters/match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(filterRequest)
      });
      
      if (!response.ok) {
        throw new Error('Failed to match filters');
      }
      
      return response.json();
    },
    enabled: selectedKeywords.length > 0
  });

  // Signature ref to prevent infinite loops
  const sigRef = useRef(currentSearchSignature);
  
  // Generate and update search signature on mount and when dependencies change
  useEffect(() => {
    if (!ENABLE_STEP4_SIGNATURE_EFFECT) return;
    
    effectRuns.signature++;
    console.log(`Signature effect run #${effectRuns.signature}`);
    
    const newSignature = generateSearchSignature();
    
    // Guard: if signature hasn't actually changed, return early
    if (sigRef.current === newSignature) {
      return;
    }
    
    // Update signature and trigger cleanup/reset
    sigRef.current = newSignature;
    
    // Clear old cache entries for this application
    queryClient.removeQueries({
      predicate: (query) => {
        return query.queryKey[0] === '/api/vacancies/tiered' && 
               (query.queryKey[2] !== newSignature || query.queryKey[1] !== currentApplicationId);
      }
    });
    
    // Reset pagination and results when signature changes
    setCurrentPage(0);
    if (currentVacancyIndex !== 0) {
      setIndexCalls++;
      setCurrentVacancyIndex(0);
    }
    setSearchResults([], 0);
    
    // Update the loaded signature in store (only if it changed)
    if (lastLoadedSignature !== newSignature) {
      useWizardStore.setState({ lastLoadedSignature: newSignature });
    }
    
    if (filters.enableDebugMode) {
      console.log('🔄 Search signature changed:', {
        oldSignature: lastLoadedSignature,
        newSignature: newSignature,
        clearedCache: true,
        effectRuns: effectRuns.signature
      });
    }
  }, [selectedKeywords, filters, currentApplicationId]); // Removed dependencies that change as a result of this effect

  // Mark reaching Step 4 on mount and check for changes
  useEffect(() => {
    // Mark that we've reached Step 4 (enables auto-save)
    markReachedStep4();
    
    if (!ENABLE_STEP4_SIGNATURE_EFFECT) return;
    
    const needsRefresh = checkSearchNeedsRefresh();
    if (needsRefresh || searchNeedsRefresh) {
      // Clear existing results and reset to fresh search
      setSearchResults([], 0);
      if (currentVacancyIndex !== 0) {
        setIndexCalls++;
        setCurrentVacancyIndex(0);
      }
      setCurrentPage(0);
      queryClient.invalidateQueries({ queryKey: ['/api/vacancies/tiered'] });
    }
  }, [searchNeedsRefresh, markReachedStep4]);

  // Reset pagination when filters change (guarded)
  useEffect(() => {
    if (!ENABLE_STEP4_SIGNATURE_EFFECT) return;
    
    if (currentPage !== 0) {
      setCurrentPage(0);
    }
    if (currentVacancyIndex !== 0) {
      setIndexCalls++;
      setCurrentVacancyIndex(0);
    }
  }, [hhFilters]);

  // Clear old cache on signature change to prevent stale data
  useEffect(() => {
    if (currentSearchSignature && currentSearchSignature !== lastLoadedSignature) {
      if (process.env.NODE_ENV === 'development') {
        console.log(`Step4: Signature changed, clearing cache. Old=${lastLoadedSignature}, New=${currentSearchSignature}`);
      }
      queryClient.removeQueries({ 
        queryKey: ['/api/vacancies', currentApplicationId], 
        exact: false 
      });
    }
  }, [currentSearchSignature, lastLoadedSignature, queryClient, currentApplicationId]);

  // Tiered search: Title → Description → Skills with merged results
  const { data: vacanciesData, isLoading: isSearching, error: searchError } = useQuery({
    queryKey: ['/api/vacancies/tiered', currentApplicationId, currentSearchSignature, currentPage],
    queryFn: async () => {
      effectRuns.querySuccess++;
      console.log(`Query execution #${effectRuns.querySuccess}`);
      
      if (process.env.NODE_ENV === 'development') {
        console.log(`Step4: Query starting with signature=${currentSearchSignature}`);
        console.log(`Step4: Using canonical keywords=${selectedKeywordsCanonical.map(k => k.text).join(',')}`);
      }
      
      if (!ENABLE_STEP4_QUERY) {
        return { items: [], found: 0, pages: 0, page: 0, per_page: 0 };
      }
      if (!hhFilters) return { items: [], found: 0, pages: 0, page: 0, per_page: 0 };

      // Prepare base parameters
      const baseParams = { ...hhFilters };
      delete baseParams.search_field; // Remove any existing search_field

      const per_page = 50; // Fetch 50 per tier
      const startIndex = currentPage * 50; // Calculate where to start in merged results
      
      const tierResults: { tier: string; items: any[]; count: number; url: string }[] = [];

      // Apply AND vs OR logic for multiple keywords (with Safe Mode override)
      const keywordTexts = selectedKeywordsCanonical.map(k => k.text);
      const isSafeMode = filters.safeMode;
      const useAnd = isSafeMode ? false : (filters.useAndAcrossPhrases && keywordTexts.length > 1);
      
      // Prepare exclude words for hard filtering (disabled in Safe Mode)
      const excludeWords = isSafeMode ? [] : (filters.excludeWords || '')
        .split(',')
        .map(word => {
          const trimmed = word.trim();
          // Handle quoted phrases by removing quotes for matching but keeping phrase structure
          return trimmed.startsWith('"') && trimmed.endsWith('"') 
            ? trimmed.slice(1, -1) 
            : trimmed;
        })
        .filter(word => word.length > 0);
        
      // Safe Mode debugging logs
      if (process.env.NODE_ENV === 'development' && isSafeMode) {
        console.log('🔧 Safe Mode ACTIVE: titleFirst=false, exactPhrases=false, AND=false, excludes=[], using OR search across all tiers');
      }

      // Function to check if vacancy should be excluded (hard filter)
      const isVacancyExcluded = (vacancy: any, excludeKeywords: string[]) => {
        if (excludeKeywords.length === 0) return false;
        
        const title = vacancy.name?.toLowerCase() || '';
        const description = vacancy.snippet?.requirement?.toLowerCase() || '';
        const responsibility = vacancy.snippet?.responsibility?.toLowerCase() || '';
        const skills = vacancy.key_skills?.map((skill: any) => skill.name?.toLowerCase()).join(' ') || '';
        const fullText = `${title} ${description} ${responsibility} ${skills}`;
        
        return excludeKeywords.some(excludeWord => 
          fullText.includes(excludeWord.toLowerCase())
        );
      };

      // Function to apply enhanced relevance scoring within a tier
      const scoreVacancy = (vacancy: any, tier: string, keywords: string[], excludeKeywords: string[]) => {
        let score = 0;
        const title = vacancy.name?.toLowerCase() || '';
        const description = vacancy.snippet?.requirement?.toLowerCase() || '';
        const responsibility = vacancy.snippet?.responsibility?.toLowerCase() || '';
        const fullText = `${title} ${description} ${responsibility}`;
        
        // No longer apply score penalties for excluded words - they're hard filtered out
        
        // Positive scoring based on keyword matches
        for (const keyword of keywords) {
          const keywordLower = keyword.toLowerCase();
          
          // Title matches (highest value)
          if (title.startsWith(keywordLower)) {
            score += 30; // Exact start match
          } else if (title.includes(keywordLower)) {
            score += 15; // Contains in title
          }
          
          // Description/responsibility matches
          if (description.includes(keywordLower) || responsibility.includes(keywordLower)) {
            score += 6; // Each additional phrase match
          }
        }
        
        // Secondary tie-breakers
        if (vacancy.salary) {
          score += 4; // Has salary
          if (vacancy.salary.from && vacancy.salary.from > 100000) {
            score += 6; // Higher salary bucket
          }
        }
        
        // Recency bonus (if published_at is available)
        if (vacancy.published_at) {
          const publishedDate = new Date(vacancy.published_at);
          const now = new Date();
          const daysDiff = (now.getTime() - publishedDate.getTime()) / (1000 * 60 * 60 * 24);
          
          if (daysDiff <= 3) {
            score += 3; // Last 72 hours
          } else if (daysDiff <= 7) {
            score += 2; // Last 7 days
          }
        }
        
        return score;
      };

      // Tier A: Title search (search_field=name)
      const titleParams = new URLSearchParams();
      Object.entries(baseParams).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          if (Array.isArray(value)) {
            value.forEach(v => titleParams.append(key, v.toString()));
          } else {
            titleParams.set(key, value.toString());
          }
        }
      });
      titleParams.set('search_field', 'name');
      titleParams.set('page', '0');
      titleParams.set('per_page', per_page.toString());

      const titleUrl = `/api/vacancies?${titleParams.toString()}`;
      if (filters.enableDebugMode) {
        console.log('🔍 Tier A (Title) URL:', titleUrl);
      }
      
      const titleResponse = await fetch(titleUrl, {
        headers: {
          'X-Search-Run-Id': currentSearchSignature,
          'X-Client-Signature': currentSearchSignature
        }
      });
      if (titleResponse.ok) {
        const titleData = await titleResponse.json();
        
        if (process.env.NODE_ENV === 'development') {
          console.log(`Step4: Title tier echo - client: ${titleData.debugEcho?.clientSignature}, server: ${titleData.debugEcho?.serverSignature}`);
          console.log(`Step4: Title tier keywords: ${titleData.debugEcho?.resolvedKeywords?.join(',') || 'none'}`);
        }
        
        tierResults.push({
          tier: 'Title',
          items: titleData.items || [],
          count: titleData.found || 0,
          url: titleUrl
        });
      }

      // Tier B: Description search (search_field=description)  
      const descParams = new URLSearchParams();
      Object.entries(baseParams).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          if (Array.isArray(value)) {
            value.forEach(v => descParams.append(key, v.toString()));
          } else {
            descParams.set(key, value.toString());
          }
        }
      });
      descParams.set('search_field', 'description');
      descParams.set('page', '0');
      descParams.set('per_page', per_page.toString());

      const descUrl = `/api/vacancies?${descParams.toString()}`;
      if (filters.enableDebugMode) {
        console.log('🔍 Tier B (Description) URL:', descUrl);
      }

      const descResponse = await fetch(descUrl, {
        headers: {
          'X-Search-Run-Id': currentSearchSignature,
          'X-Client-Signature': currentSearchSignature
        }
      });
      if (descResponse.ok) {
        const descData = await descResponse.json();
        
        if (process.env.NODE_ENV === 'development') {
          console.log(`Step4: Description tier echo - client: ${descData.debugEcho?.clientSignature}, server: ${descData.debugEcho?.serverSignature}`);
          console.log(`Step4: Description tier keywords: ${descData.debugEcho?.resolvedKeywords?.join(',') || 'none'}`);
        }
        
        tierResults.push({
          tier: 'Description',
          items: descData.items || [],
          count: descData.found || 0,
          url: descUrl
        });
      }

      // Tier C: Skills search (with optional company_name fallback)
      const skillsParams = new URLSearchParams();
      Object.entries(baseParams).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          if (Array.isArray(value)) {
            value.forEach(v => skillsParams.append(key, v.toString()));
          } else {
            skillsParams.set(key, value.toString());
          }
        }
      });
      
      // Use company_name fallback only if enabled (Safe Mode forces company_name for broader results)
      if (isSafeMode || filters.useCompanyFallback) {
        skillsParams.set('search_field', 'company_name'); // Fallback since HH.ru doesn't support skills directly
      } else {
        // Pure skills search without company bias - will rely entirely on client-side key_skills matching
        skillsParams.set('search_field', 'name'); // Use name but rely on client-side skills detection
      }
      skillsParams.set('page', '0');
      skillsParams.set('per_page', per_page.toString());

      const skillsUrl = `/api/vacancies?${skillsParams.toString()}`;
      if (filters.enableDebugMode) {
        console.log('🔍 Tier C (Skills/Company) URL:', skillsUrl);
      }

      const skillsResponse = await fetch(skillsUrl, {
        headers: {
          'X-Search-Run-Id': currentSearchSignature,
          'X-Client-Signature': currentSearchSignature
        }
      });
      if (skillsResponse.ok) {
        const skillsData = await skillsResponse.json();
        
        if (process.env.NODE_ENV === 'development') {
          console.log(`Step4: Skills tier echo - client: ${skillsData.debugEcho?.clientSignature}, server: ${skillsData.debugEcho?.serverSignature}`);
          console.log(`Step4: Skills tier keywords: ${skillsData.debugEcho?.resolvedKeywords?.join(',') || 'none'}`);
        }
        
        tierResults.push({
          tier: 'Skills',
          items: skillsData.items || [],
          count: skillsData.found || 0,
          url: skillsUrl
        });
      }

      // Apply hard filtering and enhanced scoring to all results  
      let excludedCount = 0;
      tierResults.forEach(tierResult => {
        const originalCount = tierResult.items.length;
        
        tierResult.items = tierResult.items
          // First apply hard exclusion filter
          .filter(vacancy => {
            const excluded = isVacancyExcluded(vacancy, excludeWords);
            if (excluded) excludedCount++;
            return !excluded;
          })
          // Then apply scoring and metadata
          .map(vacancy => ({
            ...vacancy,
            searchTier: tierResult.tier,
            relevanceScore: scoreVacancy(vacancy, tierResult.tier, keywordTexts, excludeWords),
            matchedKeywords: keywordTexts.filter(keyword => {
              const title = vacancy.name?.toLowerCase() || '';
              const desc = vacancy.snippet?.requirement?.toLowerCase() || '';
              const resp = vacancy.snippet?.responsibility?.toLowerCase() || '';
              const skills = vacancy.key_skills?.map((skill: any) => skill.name?.toLowerCase()).join(' ') || '';
              const fullText = `${title} ${desc} ${resp} ${skills}`;
              return fullText.includes(keyword.toLowerCase());
            }),
            matchLocation: {
              title: keywordTexts.some(keyword => (vacancy.name?.toLowerCase() || '').includes(keyword.toLowerCase())),
              description: keywordTexts.some(keyword => {
                const desc = vacancy.snippet?.requirement?.toLowerCase() || '';
                const resp = vacancy.snippet?.responsibility?.toLowerCase() || '';
                return desc.includes(keyword.toLowerCase()) || resp.includes(keyword.toLowerCase());
              }),
              skills: tierResult.tier === 'Skills' || vacancy.key_skills?.some((skill: any) => 
                keywordTexts.some(keyword => skill.name?.toLowerCase().includes(keyword.toLowerCase()))
              )
            }
          }))
          .sort((a, b) => b.relevanceScore - a.relevanceScore); // Sort by score within tier
      });

      // Check if AND logic produces sufficient results
      let usedFallback = false;
      const totalResults = tierResults.reduce((sum, tier) => sum + tier.items.length, 0);
      
      // Configurable threshold for AND->OR fallback
      const AND_OR_THRESHOLD = 30; // Make this configurable in the future
      
      if (useAnd && totalResults < AND_OR_THRESHOLD) {
        usedFallback = true;
        // Keep current OR results since we already have them
      }

      // Merge and deduplicate: A → B → C order with enhanced scoring
      const seenIds = new Set<string>();
      const mergedItems: any[] = [];

      tierResults.forEach(tierResult => {
        tierResult.items.forEach(item => {
          if (!seenIds.has(item.id)) {
            seenIds.add(item.id);
            mergedItems.push({
              ...item,
              _tierSource: tierResult.tier,
              _fallbackUsed: usedFallback
            });
          }
        });
      });
      
      // Apply deterministic stable sorting after scoring
      // Tiebreaker order: score desc → posted_at desc → salary desc → employer id asc → vacancy id asc
      mergedItems.sort((a, b) => {
        // Primary: relevance score (desc)
        if (a.relevanceScore !== b.relevanceScore) {
          return b.relevanceScore - a.relevanceScore;
        }
        
        // Tiebreak 1: posted_at desc (newer first)
        if (a.published_at && b.published_at) {
          const dateA = new Date(a.published_at).getTime();
          const dateB = new Date(b.published_at).getTime();
          if (dateA !== dateB) {
            return dateB - dateA;
          }
        }
        
        // Tiebreak 2: salary desc (higher first)
        const salaryA = a.salary?.from || a.salary?.to || 0;
        const salaryB = b.salary?.from || b.salary?.to || 0;
        if (salaryA !== salaryB) {
          return salaryB - salaryA;
        }
        
        // Tiebreak 3: employer id asc (alphabetical)
        const employerA = a.employer?.id || a.employer?.name || '';
        const employerB = b.employer?.id || b.employer?.name || '';
        if (employerA !== employerB) {
          return employerA.localeCompare(employerB);
        }
        
        // Tiebreak 4: vacancy id asc (stable)
        return a.id.localeCompare(b.id);
      });

      // Debug logging
      if (filters.enableDebugMode) {
        console.log('🔍 Tiered Search Results:');
        tierResults.forEach(tier => {
          console.log(`  ${tier.tier}: ${tier.count} found, ${tier.items.length} fetched`);
        });
        console.log(`  Total after dedup: ${mergedItems.length}`);
        console.log(`  Excluded: ${excludedCount} vacancies`);
        console.log('  Final keyword list:', keywordTexts);
        console.log('  Tier URLs:', tierResults.map(t => ({ tier: t.tier, url: t.url })));
      }

      // Apply pagination to merged results
      const paginatedItems = mergedItems.slice(startIndex, startIndex + 50);
      const totalFound = mergedItems.length;
      
      if (process.env.NODE_ENV === 'development') {
        console.log(`Step4: Query complete - found ${totalFound} total, returning ${paginatedItems.length} items`);
        if (paginatedItems.length > 0) {
          console.log(`Step4: First vacancy: "${paginatedItems[0].name}"`);
        }
      }

      return {
        items: paginatedItems,
        found: totalFound,
        pages: Math.ceil(totalFound / 50),
        page: currentPage,
        per_page: 50,
        tierInfo: {
          titleCount: tierResults.find(t => t.tier === 'Title')?.count || 0,
          descriptionCount: tierResults.find(t => t.tier === 'Description')?.count || 0,
          skillsCount: tierResults.find(t => t.tier === 'Skills')?.count || 0,
          totalAfterDedup: totalFound,
          excludedCount,
          usedFallback
        }
      };
    },
    enabled: !!hhFilters && !!currentSearchSignature,
    staleTime: isSearchSignatureChanged() ? 0 : 5 * 60 * 1000, // Force refresh if signature changed
    placeholderData: isSearchSignatureChanged() ? undefined : (previousData) => previousData, // Don't keep old data when signature changes
    refetchOnMount: isSearchSignatureChanged() ? 'always' : true
  });

  // Update store when search results change (append for pagination)
  useEffect(() => {
    if (vacanciesData?.items) {
      if (currentPage === 0) {
        // First page - replace results and mark search as completed
        setSearchResults(vacanciesData.items, vacanciesData.found);
        markSearchCompleted();
      } else {
        // Subsequent pages - append results (avoid duplicates)
        const currentResults = searchResults || [];
        const existingIds = new Set(currentResults.map(item => item.id));
        const newItems = vacanciesData.items.filter(item => !existingIds.has(item.id));
        const newResults = [...currentResults, ...newItems];
        setSearchResults(newResults, vacanciesData.found);
      }
    }
  }, [vacanciesData, currentPage]);

  // Get current vacancy details
  const currentVacancy = searchResults[currentVacancyIndex];
  
  const { data: vacancyDetail, isLoading: isLoadingDetail } = useQuery<HHVacancyDetail>({
    queryKey: ['/api/vacancies', currentVacancy?.id],
    enabled: !!currentVacancy?.id,
    staleTime: 10 * 60 * 1000 // Cache for 10 minutes
  });

  // Query for vacancy application status
  const { data: vacancyStatus, refetch: refetchStatus } = useQuery({
    queryKey: ['/api/vacancy-status', currentVacancy?.id],
    enabled: !!currentVacancy?.id,
    staleTime: 0, // Always check status fresh
    retry: false // Don't retry on auth errors
  });

  // Prefetch next few vacancy details
  useEffect(() => {
    if (searchResults.length > 0) {
      const nextIndexes = [currentVacancyIndex + 1, currentVacancyIndex + 2, currentVacancyIndex + 3]
        .filter(i => i < searchResults.length);
      
      nextIndexes.forEach(index => {
        const vacancy = searchResults[index];
        if (vacancy) {
          queryClient.prefetchQuery({
            queryKey: ['/api/vacancies', vacancy.id],
            staleTime: 10 * 60 * 1000
          });
        }
      });
    }
  }, [currentVacancyIndex, searchResults, queryClient]);

  // Cover letter generation
  const coverLetterMutation = useMutation<CoverLetterResponse, Error, CoverLetterRequest>({
    mutationFn: async (request) => {
      const response = await fetch('/api/cover-letter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request)
      });
      
      if (!response.ok) {
        throw new Error('Failed to generate cover letter');
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      setGeneratedLetter(data.text);
      // Auto-scroll to generated content
      setTimeout(() => {
        const generatedSection = document.querySelector('[data-testid="generated-content"]');
        if (generatedSection) {
          generatedSection.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'start',
            inline: 'nearest'
          });
        }
      }, 100);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const handlePageJump = () => {
    setJumpError('');
    const pageNumber = parseInt(pageJumpValue, 10);
    
    if (!pageJumpValue.trim()) {
      setJumpError('Please enter a page number');
      return;
    }
    
    if (isNaN(pageNumber) || pageNumber < 1 || pageNumber > totalFound) {
      setJumpError(`Please enter a number between 1 and ${totalFound}`);
      return;
    }
    
    const targetIndex = pageNumber - 1; // Convert to 0-based index
    const success = jumpToVacancy(targetIndex);
    
    if (success) {
      setPageJumpValue('');
      // Clear previous cover letter when jumping
      setGeneratedLetter('');
      setShowCoverLetter(false);
      
      // Smooth scroll to top
      setTimeout(() => {
        window.scrollTo({
          top: 0,
          behavior: 'smooth'
        });
      }, 100);
      
      // Auto-save after jumping to new position
      setTimeout(() => {
        const { autoSave } = useWizardStore.getState();
        autoSave();
      }, 500);
    } else {
      setJumpError('Unable to jump to that vacancy');
    }
  };

  const handlePageJumpKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handlePageJump();
    }
  };

  const handleNavigation = (direction: 'prev' | 'next') => {
    if (direction === 'prev' && currentVacancyIndex > 0) {
      setCurrentVacancyIndex(currentVacancyIndex - 1);
    } else if (direction === 'next') {
      if (currentVacancyIndex < searchResults.length - 1) {
        setCurrentVacancyIndex(currentVacancyIndex + 1);
        
        // Auto-load next page when approaching end of current results
        const remainingResults = searchResults.length - currentVacancyIndex - 1;
        if (remainingResults <= 5 && vacanciesData && vacanciesData.page < vacanciesData.pages - 1) {
          setCurrentPage(currentPage + 1);
        }
      }
    }
    // Clear previous cover letter when navigating
    setGeneratedLetter('');
    setShowCoverLetter(false);
    
    // Smooth scroll to top of the page to show new vacancy header and home button
    setTimeout(() => {
      window.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    }, 100);
  };

  const generateCoverLetter = () => {
    if (!vacancyDetail) return;

    const skillsList = vacancyDetail.key_skills.map(skill => skill.name);
    const plainDescription = vacancyDetail.descriptionHtmlSanitized
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    coverLetterMutation.mutate({
      name: vacancyDetail.name,
      employerName: vacancyDetail.employer.name,
      areaName: vacancyDetail.area.name,
      skillsList,
      plainDescription,
      customPrompt: selectedPromptTemplate === 'custom' ? customPrompt : undefined
    });
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(generatedLetter);
      toast({
        title: "Copied!",
        description: "Cover letter copied to clipboard"
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to copy to clipboard",
        variant: "destructive"
      });
    }
  };

  const downloadAsText = () => {
    const blob = new Blob([generatedLetter], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cover-letter-${vacancyDetail?.name || 'vacancy'}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const formatSalary = (salary: any) => {
    if (!salary) return null;
    
    const { from, to, currency } = salary;
    const currencySymbol = currency === 'RUR' ? '₽' : 
                          currency === 'USD' ? '$' : 
                          currency === 'EUR' ? '€' : currency;
    
    if (from && to) {
      return `${from.toLocaleString()} - ${to.toLocaleString()} ${currencySymbol}`;
    } else if (from) {
      return `from ${from.toLocaleString()} ${currencySymbol}`;
    } else if (to) {
      return `up to ${to.toLocaleString()} ${currencySymbol}`;
    }
    return null;
  };

  const renderApplyButton = () => {
    const currentVacancy = searchResults[currentVacancyIndex];
    const isAlreadyApplied = currentVacancy && appliedVacancyIds.includes(currentVacancy.id);

    // Check if vacancy is missing ID or URL
    if (!currentVacancy?.id) {
      return (
        <Button disabled className="bg-gray-400 text-white">
          <AlertCircle className="mr-2 h-4 w-4" />
          Unavailable
        </Button>
      );
    }

    // Show "Already Applied" if user has applied to this vacancy
    if (isAlreadyApplied) {
      return (
        <Button disabled className="bg-green-500 text-white">
          <CheckCircle className="mr-2 h-4 w-4" />
          Already Applied
        </Button>
      );
    }

    // Show loading while checking status
    if (!vacancyStatus) {
      return (
        <Button disabled className="bg-gray-400">
          <div className="w-4 h-4 border-2 border-gray-300 border-t-transparent rounded-full animate-spin mr-2" />
          Checking...
        </Button>
      );
    }

    const { exists } = vacancyStatus as any;

    // Vacancy no longer exists on HH.ru
    if (!exists) {
      return (
        <Button disabled className="bg-red-500 text-white">
          <AlertCircle className="mr-2 h-4 w-4" />
          Not Available
        </Button>
      );
    }

    // Default apply button - opens HH.ru
    return (
      <Button
        onClick={handleApplyToVacancy}
        className="bg-blue-600 text-white hover:bg-blue-700"
        data-testid="apply-now-button"
      >
        <ExternalLink className="mr-2 h-4 w-4" />
        Apply on HH.ru
      </Button>
    );
  };

  // Show no keywords validation
  if (!selectedKeywords.length) {
    return (
      <div className="w-full max-w-4xl mx-auto">
        <div className="bg-white rounded-2xl shadow-lg p-8">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-slate-800 mb-4">
              No keywords selected
            </h1>
            <p className="text-slate-600 mb-6">
              Please choose at least one keyword to search for job opportunities
            </p>
            <Button onClick={goBack} variant="default" data-testid="select-keywords-button">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Choose Keywords
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Show loading state
  if (isMatchingFilters || isSearching) {
    return (
      <div className="w-full max-w-4xl mx-auto">
        <div className="bg-white rounded-2xl shadow-lg p-8 mb-8">
          <LoadingLines messages={searchLoadingMessages} data-testid="step4-loading" />
        </div>
      </div>
    );
  }

  // Show error state
  if (searchError) {
    return (
      <div className="w-full max-w-4xl mx-auto">
        <div className="bg-white rounded-2xl shadow-lg p-8">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-slate-800 mb-4">
              Something went wrong
            </h1>
            <p className="text-slate-600 mb-6" data-testid="error-message">
              {searchError instanceof Error ? searchError.message : 'Failed to search vacancies'}
            </p>
            <div className="text-sm text-slate-500 bg-slate-50 px-3 py-2 rounded-lg inline-block">
              Use the "New Search" button in the header to try again.
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show empty state
  if (!searchResults.length) {
    return (
      <div className="w-full max-w-4xl mx-auto">
        <div className="bg-white rounded-2xl shadow-lg p-8">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-slate-800 mb-4">
              No jobs found
            </h1>
            <p className="text-slate-600 mb-6">
              No results for these settings. Start a New Search to try different keywords or filters.
            </p>
            <div className="text-sm text-slate-500 bg-slate-50 px-3 py-2 rounded-lg inline-block">
              Use the "New Search" button in the header to change your settings.
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      {/* Results Header */}
      <div className="bg-white rounded-2xl shadow-lg p-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-slate-800" data-testid="results-count">
              {totalFound} jobs found
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              Sorted: Title → Description → Skills
              {vacanciesData?.tierInfo?.usedFallback && (
                <span className="ml-2 px-2 py-1 bg-yellow-100 text-yellow-700 rounded text-xs font-medium">
                  Broadened to any phrase to show more results
                </span>
              )}
            </p>
            <div className="flex items-center gap-4 mt-2">
              <p className="text-slate-600" data-testid="current-position">
                Showing position {currentVacancyIndex + 1} of {totalFound}
              </p>
              
              {/* Page Jump Controls */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-500">Jump to:</span>
                <input
                  type="text"
                  value={pageJumpValue}
                  onChange={(e) => setPageJumpValue(e.target.value)}
                  onKeyDown={handlePageJumpKeyDown}
                  placeholder="1"
                  className="w-16 px-2 py-1 text-sm border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  data-testid="page-jump-input"
                />
                <Button
                  onClick={handlePageJump}
                  size="sm"
                  variant="outline"
                  className="px-3 py-1 text-sm"
                  data-testid="page-jump-button"
                >
                  Go
                </Button>
              </div>
            </div>
            {jumpError && (
              <p className="text-red-500 text-sm mt-1" data-testid="jump-error">
                {jumpError}
              </p>
            )}
          </div>
          <div className="text-sm text-slate-500 bg-slate-50 px-3 py-2 rounded-lg">
            Want different results? Start a New Search to change keywords or filters.
          </div>
        </div>
      </div>

      {/* Vacancy Display */}
      {currentVacancy && (
        <div className="bg-white rounded-2xl shadow-lg p-8 animate-fade-in">
          {isLoadingDetail ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4"></div>
              <p className="text-slate-600">Loading vacancy details...</p>
            </div>
          ) : vacancyDetail ? (
            <>
              {/* Vacancy Header */}
              <div className="mb-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h1 className="text-2xl font-bold text-slate-800 mb-2" data-testid="vacancy-title">
                      {vacancyDetail.name}
                    </h1>
                    <div className="flex items-center text-slate-600 space-x-4">
                      <span className="flex items-center" data-testid="vacancy-company">
                        <ExternalLink className="mr-2 h-4 w-4" />
                        {vacancyDetail.employer.name}
                      </span>
                      <span className="flex items-center" data-testid="vacancy-location">
                        <MapPin className="mr-2 h-4 w-4" />
                        {vacancyDetail.area.name}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    {vacancyDetail.salary && (
                      <div className="text-2xl font-bold text-emerald-600 mb-2" data-testid="vacancy-salary">
                        {formatSalary(vacancyDetail.salary)}
                      </div>
                    )}
                    <Button
                      onClick={() => window.open(vacancyDetail.alternate_url, '_blank')}
                      className="bg-primary-600 text-white hover:bg-primary-700"
                      data-testid="view-on-hh-button"
                    >
                      <ExternalLink className="mr-2 h-4 w-4" />
                      View on HH.ru
                    </Button>
                  </div>
                </div>
              </div>

              {/* Enhanced Debug Info Panel (when debug mode is enabled) */}
              {filters.enableDebugMode && vacanciesData && (vacanciesData as any).tierInfo && (
                <div className="mb-6 p-4 bg-gray-50 rounded-lg text-sm border-2 border-dashed border-gray-300">
                  <div className="font-bold text-gray-800 mb-3">🔍 Tiered Search Debug Panel</div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <div className="font-medium text-gray-700 mb-2">Search Configuration:</div>
                      <div className="space-y-1 text-gray-600 text-xs">
                        <div>Keywords: {selectedKeywords.map(k => k.text).join(', ')}</div>
                        <div>Exact phrases: {filters.useExactPhrases ? 'ENABLED' : 'DISABLED'}</div>
                        <div>Title-first: {filters.titleFirstSearch ? 'LEGACY MODE' : 'TIERED MODE'}</div>
                      </div>
                    </div>
                    <div>
                      <div className="font-medium text-gray-700 mb-2">Tier Results:</div>
                      <div className="space-y-1 text-gray-600 text-xs">
                        <div>🎯 Title: {(vacanciesData as any).tierInfo.titleCount} found</div>
                        <div>📄 Description: {(vacanciesData as any).tierInfo.descriptionCount} found</div>
                        <div>🛠️ Skills: {(vacanciesData as any).tierInfo.skillsCount} found</div>
                        <div className="font-medium pt-1">📊 Total after dedup: {(vacanciesData as any).tierInfo.totalAfterDedup}</div>
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 pt-2 border-t border-gray-200">
                    <div className="text-xs text-gray-600">
                      Current vacancy: #{currentVacancyIndex + 1} of {totalFound}
                      {currentVacancy?._tierSource && (
                        <span className="ml-2 px-2 py-1 bg-blue-100 text-blue-700 rounded font-medium">
                          {currentVacancy._tierSource} match
                          {currentVacancy.matchedKeywords && currentVacancy.matchedKeywords.length > 0 && (
                            <span className="text-xs text-blue-600 ml-1">
                              ({currentVacancy.matchedKeywords.slice(0, 2).join(', ')}
                              {currentVacancy.matchedKeywords.length > 2 && '...'})
                            </span>
                          )}
                        </span>
                      )}
                    </div>
                    
                    {/* Search signature debug info */}
                    <div className="mt-2 pt-2 border-t border-gray-200">
                      <div className="text-xs text-gray-600">
                        <div>Search signature: <span className="text-blue-600 font-mono">{currentSearchSignature || 'not generated'}</span></div>
                        <div>Last loaded: <span className="text-green-600 font-mono">{lastLoadedSignature || 'none'}</span></div>
                        <div>Signature changed: <span className={isSearchSignatureChanged() ? "text-red-600 font-bold" : "text-green-600"}>{isSearchSignatureChanged() ? 'YES' : 'NO'}</span></div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Vacancy Description */}
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-slate-800 mb-4">Job Description</h3>
                <div 
                  className="prose-job custom-scrollbar"
                  dangerouslySetInnerHTML={{ __html: vacancyDetail.descriptionHtmlSanitized }}
                  data-testid="vacancy-description"
                />
              </div>

              {/* Skills */}
              {vacancyDetail.key_skills.length > 0 && (
                <div className="mb-8">
                  <h3 className="text-lg font-semibold text-slate-800 mb-4">Required Skills</h3>
                  <div className="flex flex-wrap gap-2" data-testid="vacancy-skills">
                    {vacancyDetail.key_skills.map((skill, index) => (
                      <span
                        key={index}
                        className="px-3 py-1 bg-primary-50 text-primary-700 rounded-full text-sm"
                        data-testid={`skill-${index}`}
                      >
                        {skill.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Navigation */}
              <div className="flex items-center justify-between py-4 border-t border-slate-200">
                <Button
                  onClick={() => handleNavigation('prev')}
                  disabled={currentVacancyIndex === 0}
                  variant="ghost"
                  className="text-slate-600 hover:text-slate-800"
                  data-testid="previous-vacancy-button"
                >
                  <ChevronLeft className="mr-2 h-4 w-4" />
                  Previous
                </Button>
                
                <div className="flex items-center space-x-4">
                  <Button
                    onClick={() => {
                      setShowCoverLetter(true);
                      // Smooth scroll down to show the cover letter generator panel
                      setTimeout(() => {
                        const coverLetterSection = document.querySelector('[data-testid="cover-letter-section"]');
                        if (coverLetterSection) {
                          coverLetterSection.scrollIntoView({
                            behavior: 'smooth',
                            block: 'start',
                            inline: 'nearest'
                          });
                        }
                      }, 100);
                    }}
                    className="bg-emerald-600 text-white hover:bg-emerald-700"
                    data-testid="generate-cover-letter-button"
                  >
                    <FileText className="mr-2 h-4 w-4" />
                    Generate Cover Letter
                  </Button>
                  {renderApplyButton()}
                </div>
                
                <Button
                  onClick={() => handleNavigation('next')}
                  disabled={currentVacancyIndex === searchResults.length - 1}
                  variant="ghost"
                  className="text-slate-600 hover:text-slate-800"
                  data-testid="next-vacancy-button"
                >
                  Next
                  <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </>
          ) : (
            <div className="text-center py-12">
              <p className="text-slate-600">Failed to load vacancy details</p>
            </div>
          )}
        </div>
      )}

      {/* Cover Letter Section */}
      {showCoverLetter && vacancyDetail && (
        <ImprovedCoverLetterGenerator
          vacancy={{
            id: vacancyDetail.id,
            name: vacancyDetail.name,
            employerName: vacancyDetail.employer?.name,
            areaName: vacancyDetail.area?.name,
            skillsList: vacancyDetail.key_skills?.map(skill => skill.name) || [],
            plainDescription: vacancyDetail.descriptionHtmlSanitized
              .replace(/<[^>]*>/g, ' ')
              .replace(/\s+/g, ' ')
              .trim()
          }}
          onClose={() => setShowCoverLetter(false)}
        />
      )}
    </div>
  );
}
