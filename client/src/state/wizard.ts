import { create } from 'zustand';
import { persist, subscribeWithSelector } from 'zustand/middleware';

// Feature flag to disable auto-save for debugging
const AUTO_SAVE_ENABLED = false; // Set to false to test if auto-save is causing the loop

// External refs to prevent auto-save state from triggering re-renders
let inFlightRef = false;
let lastSavedHashRef = '';
let debounceTimeoutRef: NodeJS.Timeout | null = null;

// Counters for debugging
let saveSignatureChanges = 0;
let autoSaveCalls = 0;
let patchCount = 0;

// Function to generate stable save signature
function generateSaveSignature(state: any): string {
  const saveData = {
    keywords: (state.selectedKeywordsCanonical || state.selectedKeywords)
      .map((k: any) => k.text.trim().toLowerCase())
      .sort(),
    filters: {
      // Only include filter values that affect search results
      enableLocationFilter: state.filters.enableLocationFilter,
      enableExperienceFilter: state.filters.enableExperienceFilter,
      enableEmploymentFilter: state.filters.enableEmploymentFilter,
      enableScheduleFilter: state.filters.enableScheduleFilter,
      enableSalaryFilter: state.filters.enableSalaryFilter,
      enableMetroFilter: state.filters.enableMetroFilter,
      enableLabelFilter: state.filters.enableLabelFilter,
      enableEducationFilter: state.filters.enableEducationFilter,
      enableWorkFormatFilter: state.filters.enableWorkFormatFilter,
      
      locationText: state.filters.locationText.trim().toLowerCase(),
      remoteOnly: state.filters.remoteOnly,
      hybridOk: state.filters.hybridOk,
      experience: state.filters.experience,
      employmentTypes: [...state.filters.employmentTypes].sort(),
      scheduleTypes: [...state.filters.scheduleTypes].sort(),
      salary: state.filters.salary,
      currency: state.filters.currency,
      onlyWithSalary: state.filters.onlyWithSalary,
      period: state.filters.period,
      orderBy: state.filters.orderBy,
      metroStation: state.filters.metroStation.trim().toLowerCase(),
      searchFields: [...state.filters.searchFields].sort(),
      vacancyLabels: [...state.filters.vacancyLabels].sort(),
      employerName: state.filters.employerName.trim().toLowerCase(),
      educationLevel: state.filters.educationLevel,
      workFormats: [...state.filters.workFormats].sort(),
      titleFirstSearch: state.filters.titleFirstSearch,
      useExactPhrases: state.filters.useExactPhrases,
      useAndAcrossPhrases: state.filters.useAndAcrossPhrases,
      useCompanyFallback: state.filters.useCompanyFallback,
      excludeWords: state.filters.excludeWords.trim().toLowerCase(),
      safeMode: state.filters.safeMode
    },
    currentStep: state.currentStep,
    currentVacancyIndex: state.currentVacancyIndex
  };
  
  return JSON.stringify(saveData);
}

export type WizardStep = 'keywords' | 'confirm' | 'filters' | 'results';

export interface SelectedKeyword {
  text: string;
  source: 'ai' | 'hh' | 'custom';
}

export interface WizardFilters {
  // Filter enablement flags
  enableLocationFilter: boolean;
  enableExperienceFilter: boolean;
  enableEmploymentFilter: boolean;
  enableScheduleFilter: boolean;
  enableSalaryFilter: boolean;
  enableMetroFilter: boolean;
  enableLabelFilter: boolean;
  enableEducationFilter: boolean;
  enableWorkFormatFilter: boolean;
  
  // Existing filters
  locationText: string;
  remoteOnly: boolean;
  hybridOk: boolean;
  experience: string;
  employmentTypes: string[];
  scheduleTypes: string[];
  salary: number | null;
  currency: string;
  onlyWithSalary: boolean;
  period: number;
  orderBy: string;
  
  // New filters
  metroStation: string;
  searchFields: string[];
  vacancyLabels: string[];
  employerName: string;
  
  // Education and work format filters
  educationLevel: string;
  workFormats: string[];
  
  // New search options - with persistence
  titleFirstSearch: boolean;
  useExactPhrases: boolean;
  useAndAcrossPhrases: boolean;
  useCompanyFallback: boolean;
  enableDebugMode: boolean;
  excludeWords: string;
  safeMode: boolean;
}

export interface WizardState {
  // Current step
  currentStep: WizardStep;
  
  // Step 4 tracking for auto-save policy
  hasReachedStep4: boolean;
  
  // Transition state
  isTransitioning: boolean;
  transitionFrom: WizardStep | null;
  transitionTo: WizardStep | null;
  
  // Step 1 data
  userInput: string;
  
  // Step 2 data
  aiSuggestions: Array<{ text: string; source: 'hh' }>;
  selectedKeywords: SelectedKeyword[];
  selectedKeywordsCanonical: SelectedKeyword[]; // Single source of truth for search
  
  // Step 3 data
  filters: WizardFilters;
  
  // Step 4 data
  searchResults: any[];
  currentVacancyIndex: number;
  totalFound: number;
  appliedVacancyIds: string[];
  
  // Auto-save state (external refs prevent re-render loops)
  currentApplicationId: number | null;
  isSaving: boolean;
  lastSavedAt: Date | null;
  
  // Change tracking for live sync
  lastSearchKeywords: SelectedKeyword[];
  lastSearchFilters: WizardFilters;
  searchNeedsRefresh: boolean;
  
  // Search signature for cache invalidation
  currentSearchSignature: string;
  lastLoadedSignature: string;
  
  // Save signature for auto-save (watched by subscribeWithSelector)
  saveSignature: string;
  
  // Actions
  setStep: (step: WizardStep) => void;
  setCurrentStep: (step: number) => void;
  setUserInput: (input: string) => void;
  setAISuggestions: (suggestions: Array<{ text: string; source: 'hh' }>) => void;
  setSuggestedKeywords: (keywords: string[]) => void;
  setSelectedKeywords: (keywords: SelectedKeyword[]) => void;
  commitKeywords: () => void; // Commit to canonical
  addCustomKeyword: (text: string) => void;
  removeKeyword: (index: number) => void;
  setFilters: (filters: Partial<WizardFilters> | Record<string, any>) => void;
  setSearchResults: (results: any[], totalFound: number) => void;
  setVacancies: (vacancies: any[]) => void;
  setCurrentVacancyIndex: (index: number) => void;
  markVacancyAsApplied: (vacancyId: string) => void;
  
  // Auto-save actions
  autoSave: () => Promise<void>;
  setCurrentApplicationId: (id: number | null) => void;
  markReachedStep4: () => void;
  
  // Search lifecycle
  markSearchCompleted: () => void;
  checkSearchNeedsRefresh: () => boolean;
  jumpToVacancy: (targetIndex: number) => boolean;
  
  // Search signature management
  generateSearchSignature: () => string;
  updateSearchSignature: () => void;
  isSearchSignatureChanged: () => boolean;
  
  // Transition actions
  startTransition: (from: WizardStep, to: WizardStep) => void;
  completeTransition: () => void;
  
  // Navigation
  goBack: () => void;
  goNext: () => void;
  
  // Reset
  reset: () => void;
  resetSearch: () => void;
  
  // Cache invalidation
  invalidateSearchCache: () => void;
}

const defaultFilters: WizardFilters = {
  // Filter enablement flags (disabled by default for "see all results")
  enableLocationFilter: false,
  enableExperienceFilter: false,
  enableEmploymentFilter: false,
  enableScheduleFilter: false,
  enableSalaryFilter: false,
  enableMetroFilter: false,
  enableLabelFilter: false,
  enableEducationFilter: false,
  enableWorkFormatFilter: false,
  
  // Existing filters
  locationText: '',
  remoteOnly: false,
  hybridOk: false,
  experience: '',
  employmentTypes: [],
  scheduleTypes: [],
  salary: null,
  currency: 'RUR',
  onlyWithSalary: false,
  period: 7,
  orderBy: 'relevance',
  
  // New filters
  metroStation: '',
  searchFields: [],
  vacancyLabels: [],
  employerName: '',
  
  // Education and work format filters
  educationLevel: '',
  workFormats: [],
  
  // New search options - with persistence
  titleFirstSearch: JSON.parse(localStorage.getItem('titleFirstSearch') ?? 'true'),
  useExactPhrases: JSON.parse(localStorage.getItem('useExactPhrases') ?? 'false'),
  useAndAcrossPhrases: JSON.parse(localStorage.getItem('useAndAcrossPhrases') ?? 'true'),
  useCompanyFallback: JSON.parse(localStorage.getItem('useCompanyFallback') ?? 'true'),
  enableDebugMode: JSON.parse(localStorage.getItem('enableDebugMode') ?? 'false'),
  excludeWords: localStorage.getItem('excludeWords') ?? '',
  safeMode: false
};

export const useWizardStore = create<WizardState>()(
  subscribeWithSelector(
    persist(
      (set, get) => ({
      // Initial state
      currentStep: 'keywords',
      hasReachedStep4: false,
      isTransitioning: false,
      transitionFrom: null,
      transitionTo: null,
      userInput: '',
      aiSuggestions: [],
      selectedKeywords: [],
      selectedKeywordsCanonical: [],
      filters: defaultFilters,
      searchResults: [],
      currentVacancyIndex: 0,
      totalFound: 0,
      appliedVacancyIds: [],
      
      // Auto-save state
      currentApplicationId: null,
      isSaving: false,
      lastSavedAt: null,
      
      // Change tracking for live sync
      lastSearchKeywords: [],
      lastSearchFilters: defaultFilters,
      searchNeedsRefresh: false,
      
      // Search signature tracking
      currentSearchSignature: '',
      lastLoadedSignature: '',
      
      // Save signature for auto-save (watched by subscribeWithSelector)
      saveSignature: '',

      // Actions
      setStep: (step) => set({ currentStep: step }),
      
      setCurrentStep: (step) => {
        const stepMap: Record<number, WizardStep> = {
          1: 'keywords',
          2: 'confirm', 
          3: 'filters',
          4: 'results'
        };
        set({ currentStep: stepMap[step] || 'keywords' });
      },
      
      setUserInput: (input) => set({ userInput: input }),
      
      setAISuggestions: (suggestions) => set({ aiSuggestions: suggestions }),
      
      setSuggestedKeywords: (keywords) => {
        set({ aiSuggestions: keywords.map(text => ({ text, source: 'hh' as const })) });
      },
      
      setSelectedKeywords: (keywords) => {
        if (process.env.NODE_ENV === 'development') {
          console.log(`Store: setSelectedKeywords(${keywords.length} keywords)`);
        }
        const { lastSearchKeywords, hasReachedStep4 } = get();
        set({ 
          selectedKeywords: keywords,
          searchNeedsRefresh: JSON.stringify(keywords) !== JSON.stringify(lastSearchKeywords)
        });
        // Only update save signature if we've reached Step 4
        if (hasReachedStep4) {
          const state = get();
          const newSignature = generateSaveSignature({ ...state, selectedKeywords: keywords });
          set({ saveSignature: newSignature });
        }
      },
      
      // Commit keywords to canonical source (called on navigation Step 2 -> Step 3)
      commitKeywords: () => {
        const { selectedKeywords } = get();
        
        // Normalize keywords: trim, dedupe, stable sort
        const normalizedKeywords = selectedKeywords
          .map(k => ({ ...k, text: k.text.trim() }))
          .filter(k => k.text.length > 0)
          .filter((k, index, arr) => arr.findIndex(x => x.text.toLowerCase() === k.text.toLowerCase()) === index)
          .sort((a, b) => a.text.toLowerCase().localeCompare(b.text.toLowerCase()));
        
        if (process.env.NODE_ENV === 'development') {
          console.log(`Store: commitKeywords BEFORE: pendingKeywords=${selectedKeywords.map(k => k.text).join(',')}`);
          console.log(`Store: commitKeywords AFTER: selectedKeywordsCanonical=${normalizedKeywords.map(k => k.text).join(',')}`);
        }
        
        // Atomic commit + signature update
        const state = get();
        const newSignature = state.generateSearchSignature();
        
        set({ 
          selectedKeywordsCanonical: normalizedKeywords,
          currentVacancyIndex: 0, // Reset index when keywords change
          currentSearchSignature: newSignature,
          lastLoadedSignature: '', // Force refresh
          searchNeedsRefresh: true
        });
        
        if (process.env.NODE_ENV === 'development') {
          console.log(`Store: commitKeywords searchSignature=${newSignature}`);
        }
        
        return normalizedKeywords;
      },
      
      addCustomKeyword: (text) => {
        const { selectedKeywords } = get();
        if (selectedKeywords.length < 3 && !selectedKeywords.find(k => k.text === text)) {
          set({
            selectedKeywords: [...selectedKeywords, { text, source: 'custom' }]
          });
        }
      },
      
      removeKeyword: (index) => {
        const { selectedKeywords } = get();
        set({
          selectedKeywords: selectedKeywords.filter((_, i) => i !== index)
        });
      },
      
      setFilters: (newFilters) => {
        if (process.env.NODE_ENV === 'development') {
          console.log(`Store: setFilters(${Object.keys(newFilters).join(', ')})`);
        }
        const { filters, lastSearchFilters, hasReachedStep4 } = get();
        const updatedFilters = { ...filters, ...newFilters };
        
        // Persist toggles to localStorage
        if ('titleFirstSearch' in newFilters) {
          localStorage.setItem('titleFirstSearch', JSON.stringify(newFilters.titleFirstSearch));
        }
        if ('useExactPhrases' in newFilters) {
          localStorage.setItem('useExactPhrases', JSON.stringify(newFilters.useExactPhrases));
        }
        if ('useAndAcrossPhrases' in newFilters) {
          localStorage.setItem('useAndAcrossPhrases', JSON.stringify(newFilters.useAndAcrossPhrases));
        }
        if ('enableDebugMode' in newFilters) {
          localStorage.setItem('enableDebugMode', JSON.stringify(newFilters.enableDebugMode));
        }
        if ('excludeWords' in newFilters) {
          localStorage.setItem('excludeWords', newFilters.excludeWords || '');
        }
        
        set({
          filters: updatedFilters,
          searchNeedsRefresh: JSON.stringify(updatedFilters) !== JSON.stringify(lastSearchFilters)
        });
        // Only update save signature if we've reached Step 4
        if (hasReachedStep4) {
          const newState = get();
          const newSignature = generateSaveSignature(newState);
          set({ saveSignature: newSignature });
        }
      },
      
      setVacancies: (vacancies) => set({ searchResults: vacancies }),
      
      setSearchResults: (results, totalFound) => {
        set({
          searchResults: results,
          totalFound,
          currentVacancyIndex: 0
        });
        // Update save signature to trigger centralized auto-save (should be in Step 4)
        const state = get();
        const newSignature = generateSaveSignature({ ...state, searchResults: results, totalFound, currentVacancyIndex: 0 });
        set({ saveSignature: newSignature });
      },
      
      setCurrentVacancyIndex: (index) => {
        if (process.env.NODE_ENV === 'development') {
          console.log(`Store: setCurrentVacancyIndex(${index})`);
        }
        set({ currentVacancyIndex: index });
        // Update save signature to trigger centralized auto-save (should be in Step 4)
        const state = get();
        const newSignature = generateSaveSignature({ ...state, currentVacancyIndex: index });
        set({ saveSignature: newSignature });
      },
      
      // Auto-save actions (now using external refs for safety)
      autoSave: async () => {
        if (!AUTO_SAVE_ENABLED) return;
        
        const state = get();
        
        // Don't auto-save unless we've reached Step 4
        if (!state.hasReachedStep4 || state.selectedKeywords.length === 0) {
          return;
        }
        
        // Check for concurrent saves using external ref
        if (inFlightRef) {
          // Schedule trailing run for coalescing
          if (debounceTimeoutRef) {
            clearTimeout(debounceTimeoutRef);
          }
          debounceTimeoutRef = setTimeout(() => get().autoSave(), 1000);
          return;
        }
        
        // Generate current hash and check if we need to save
        const currentHash = generateSaveSignature(state);
        if (currentHash === lastSavedHashRef) {
          return; // No changes to save
        }
        
        // Mark as in-flight
        inFlightRef = true;
        autoSaveCalls++;
        
        try {
          const keywords = state.selectedKeywords.map(k => k.text).filter(Boolean);
          const applicationTitle = keywords.length > 0 
            ? keywords.length <= 3 
              ? keywords.join(', ')
              : `${keywords.slice(0, 2).join(', ')} +${keywords.length - 2} more`
            : 'Job Search';
            
          const applicationData = {
            title: applicationTitle,
            currentStep: ({ 
              'keywords': 1, 
              'confirm': 2, 
              'filters': 3, 
              'results': 4 
            })[state.currentStep] || 1,
            selectedKeywords: keywords,
            suggestedKeywords: state.aiSuggestions.map(s => s.text),
            filters: state.filters,
            currentVacancyIndex: state.currentVacancyIndex,
            vacancies: state.searchResults,
            totalVacancies: state.totalFound,
            appliedVacancyIds: state.appliedVacancyIds,
            isCompleted: false
          };
          
          let response;
          if (state.currentApplicationId) {
            // Update existing application
            response = await fetch(`/api/applications/${state.currentApplicationId}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(applicationData)
            });
          } else {
            // Create new application
            response = await fetch('/api/applications', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(applicationData)
            });
          }
          
          if (response.ok) {
            const savedApp = await response.json();
            patchCount++;
            
            // Update external refs only (no store updates that trigger subscriptions)
            lastSavedHashRef = currentHash;
            
            // Only update currentApplicationId if it changed
            if (savedApp.id !== state.currentApplicationId) {
              set({ currentApplicationId: savedApp.id });
            }
            
            console.log(`Auto-save successful: saveSignatureChanges=${saveSignatureChanges}, autoSaveCalls=${autoSaveCalls}, PATCHes=${patchCount}`);
          }
        } catch (error) {
          console.error('Auto-save failed:', error);
        } finally {
          inFlightRef = false;
        }
      },
      
      setCurrentApplicationId: (id) => set({ currentApplicationId: id }),
      
      markReachedStep4: () => {
        const { hasReachedStep4 } = get();
        if (!hasReachedStep4) {
          set({ hasReachedStep4: true });
          // Trigger initial save when reaching Step 4
          setTimeout(() => {
            const state = get();
            const newSignature = generateSaveSignature(state);
            set({ saveSignature: newSignature });
          }, 100);
        }
      },
      
      markVacancyAsApplied: (vacancyId) => {
        const { appliedVacancyIds } = get();
        if (!appliedVacancyIds.includes(vacancyId)) {
          set({ 
            appliedVacancyIds: [...appliedVacancyIds, vacancyId] 
          });
          // Update save signature to trigger centralized auto-save
          const state = get();
          const newSignature = generateSaveSignature(state);
          set({ saveSignature: newSignature });
        }
      },
      
      // Transition actions
      startTransition: (from, to) => set({
        isTransitioning: true,
        transitionFrom: from,
        transitionTo: to
      }),
      
      completeTransition: () => {
        const { transitionTo } = get();
        if (transitionTo) {
          set({
            currentStep: transitionTo,
            isTransitioning: false,
            transitionFrom: null,
            transitionTo: null
          });
        }
      },
      
      // Navigation
      goBack: () => {
        const { currentStep } = get();
        switch (currentStep) {
          case 'confirm':
            set({ currentStep: 'keywords' });
            break;
          case 'filters':
            set({ currentStep: 'confirm' });
            break;
          case 'results':
            set({ currentStep: 'filters' });
            break;
        }
      },
      
      goNext: () => {
        const { currentStep, startTransition } = get();
        let nextStep: WizardStep | null = null;
        
        switch (currentStep) {
          case 'keywords':
            nextStep = 'confirm';
            break;
          case 'confirm':
            nextStep = 'filters';
            break;
          case 'filters':
            nextStep = 'results';
            break;
        }
        
        if (nextStep) {
          startTransition(currentStep, nextStep);
        }
      },
      
      // Mark search as completed/up-to-date
      markSearchCompleted: () => {
        const { selectedKeywords, filters } = get();
        set({
          lastSearchKeywords: [...selectedKeywords],
          lastSearchFilters: { ...filters },
          searchNeedsRefresh: false
        });
      },
      
      // Check if search needs refresh due to keyword/filter changes
      checkSearchNeedsRefresh: () => {
        const { selectedKeywords, filters, lastSearchKeywords, lastSearchFilters } = get();
        const keywordsChanged = JSON.stringify(selectedKeywords) !== JSON.stringify(lastSearchKeywords);
        const filtersChanged = JSON.stringify(filters) !== JSON.stringify(lastSearchFilters);
        
        if (keywordsChanged || filtersChanged) {
          set({ searchNeedsRefresh: true });
          return true;
        }
        return false;
      },
      
      // Jump to specific vacancy page
      jumpToVacancy: (targetIndex: number) => {
        const { searchResults } = get();
        if (targetIndex >= 0 && targetIndex < searchResults.length) {
          set({ currentVacancyIndex: targetIndex });
          return true;
        }
        return false;
      },
      
      // Generate search signature from current state
      generateSearchSignature: () => {
        const { selectedKeywordsCanonical, filters } = get();
        
        // Create a normalized object with all search-affecting parameters
        const searchParams = {
          keywords: selectedKeywordsCanonical
            .map(k => k.text.toLowerCase().trim())
            .sort(), // Sort for consistent ordering
          excludeWords: filters.excludeWords?.toLowerCase().trim().split(/\s+/).filter(Boolean).sort() || [],
          useExactPhrases: filters.useExactPhrases,
          useAndAcrossPhrases: filters.useAndAcrossPhrases,
          useCompanyFallback: filters.useCompanyFallback,
          titleFirstSearch: filters.titleFirstSearch,
          
          // All location filters
          locationText: filters.locationText?.toLowerCase().trim() || '',
          remoteOnly: filters.remoteOnly,
          hybridOk: filters.hybridOk,
          enableLocationFilter: filters.enableLocationFilter,
          
          // All other filters
          experience: filters.experience,
          enableExperienceFilter: filters.enableExperienceFilter,
          employmentTypes: filters.employmentTypes?.slice().sort() || [],
          enableEmploymentFilter: filters.enableEmploymentFilter,
          scheduleTypes: filters.scheduleTypes?.slice().sort() || [],
          enableScheduleFilter: filters.enableScheduleFilter,
          salary: filters.salary,
          currency: filters.currency,
          onlyWithSalary: filters.onlyWithSalary,
          enableSalaryFilter: filters.enableSalaryFilter,
          period: filters.period,
          orderBy: filters.orderBy,
          
          metroStation: filters.metroStation,
          enableMetroFilter: filters.enableMetroFilter,
          searchFields: filters.searchFields?.slice().sort() || [],
          vacancyLabels: filters.vacancyLabels?.slice().sort() || [],
          enableLabelFilter: filters.enableLabelFilter,
          employerName: filters.employerName?.toLowerCase().trim() || '',
          
          educationLevel: filters.educationLevel,
          enableEducationFilter: filters.enableEducationFilter,
          workFormats: filters.workFormats?.slice().sort() || [],
          enableWorkFormatFilter: filters.enableWorkFormatFilter
        };
        
        // Create a stable hash from the normalized parameters
        const jsonString = JSON.stringify(searchParams);
        
        // Simple hash function for client-side use
        let hash = 0;
        for (let i = 0; i < jsonString.length; i++) {
          const char = jsonString.charCodeAt(i);
          hash = ((hash << 5) - hash) + char;
          hash = hash & hash; // Convert to 32-bit integer
        }
        
        return `search_${Math.abs(hash).toString(36)}_${Date.now().toString(36)}`;
      },
      
      // Update the current search signature
      updateSearchSignature: () => {
        const newSignature = get().generateSearchSignature();
        set({ currentSearchSignature: newSignature });
        return newSignature;
      },
      
      // Check if search signature has changed since last load
      isSearchSignatureChanged: () => {
        const { currentSearchSignature, lastLoadedSignature } = get();
        return currentSearchSignature !== lastLoadedSignature;
      },
      
      // Reset - completely clear all state for a fresh start
      reset: () => {
        // Clear any existing search cache/context in localStorage
        try {
          localStorage.removeItem('hh-search-cache');
          localStorage.removeItem('vacancy-cache');
        } catch (e) {
          // Ignore localStorage errors
        }
        
        set({
          currentStep: 'keywords',
          hasReachedStep4: false,
          isTransitioning: false,
          transitionFrom: null,
          transitionTo: null,
          userInput: '',
          aiSuggestions: [],
          selectedKeywords: [],
          selectedKeywordsCanonical: [],
          filters: { ...defaultFilters }, // Create a fresh copy
          searchResults: [],
          currentVacancyIndex: 0,
          totalFound: 0,
          appliedVacancyIds: [],
          currentApplicationId: null,
          isSaving: false,
          lastSavedAt: null,
          lastSearchKeywords: [],
          lastSearchFilters: { ...defaultFilters },
          searchNeedsRefresh: false,
          currentSearchSignature: '',
          lastLoadedSignature: '',
          saveSignature: ''
        });
      },
      
      // Reset search - clear all search state but keep user settings (for New Search functionality)
      resetSearch: () => {
        // Clear search-specific localStorage
        try {
          localStorage.removeItem('hh-search-cache');
          localStorage.removeItem('vacancy-cache');
          // Keep global settings like titleFirstSearch, useExactPhrases etc.
        } catch (e) {
          // Ignore localStorage errors
        }
        
        // Reset external refs
        inFlightRef = false;
        lastSavedHashRef = '';
        if (debounceTimeoutRef) {
          clearTimeout(debounceTimeoutRef);
          debounceTimeoutRef = null;
        }
        
        set({
          currentStep: 'keywords',
          hasReachedStep4: false,
          isTransitioning: false,
          transitionFrom: null,
          transitionTo: null,
          userInput: '',
          aiSuggestions: [],
          selectedKeywords: [],
          selectedKeywordsCanonical: [],
          searchResults: [],
          currentVacancyIndex: 0,
          totalFound: 0,
          appliedVacancyIds: [],
          currentApplicationId: null,
          isSaving: false,
          lastSavedAt: null,
          lastSearchKeywords: [],
          lastSearchFilters: { ...defaultFilters },
          searchNeedsRefresh: false,
          currentSearchSignature: '',
          lastLoadedSignature: '',
          saveSignature: ''
        });
      },
      
      // Cache invalidation helper - called from Step1 when keywords change
      invalidateSearchCache: () => {
        // This will be called by React components that have access to queryClient
        // The actual cache invalidation is handled in components that import this function
        console.log('Cache invalidation requested - handled by component with queryClient access');
      }
    }),
    {
      name: 'job-wizard-storage',
      partialize: (state) => ({
        userInput: state.userInput,
        selectedKeywords: state.selectedKeywords,
        filters: state.filters,
        currentStep: state.currentStep,
        currentApplicationId: state.currentApplicationId,
        currentVacancyIndex: state.currentVacancyIndex,
        totalFound: state.totalFound,
        appliedVacancyIds: state.appliedVacancyIds,
        currentSearchSignature: state.currentSearchSignature,
        saveSignature: state.saveSignature
      })
    }
    )
  )
);

// Centralized auto-save subscription (single source of truth)
if (AUTO_SAVE_ENABLED) {
  useWizardStore.subscribe(
    (state) => state.saveSignature,
    (newSignature, prevSignature) => {
      if (newSignature && newSignature !== prevSignature) {
        saveSignatureChanges++;
        console.log(`Save signature changed #${saveSignatureChanges}: ${prevSignature} -> ${newSignature}`);
        
        // Debounced auto-save
        if (debounceTimeoutRef) {
          clearTimeout(debounceTimeoutRef);
        }
        debounceTimeoutRef = setTimeout(() => {
          const state = useWizardStore.getState();
          state.autoSave();
        }, 600); // 600ms debounce
      }
    }
  );
}

// Helper functions for debugging
export function getAutoSaveCounters() {
  return { saveSignatureChanges, autoSaveCalls, patchCount };
}

export function resetAutoSaveCounters() {
  saveSignatureChanges = 0;
  autoSaveCalls = 0;
  patchCount = 0;
}
