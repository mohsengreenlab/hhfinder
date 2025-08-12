import { create } from 'zustand';
import { persist } from 'zustand/middleware';

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
}

export interface WizardState {
  // Current step
  currentStep: WizardStep;
  
  // Transition state
  isTransitioning: boolean;
  transitionFrom: WizardStep | null;
  transitionTo: WizardStep | null;
  
  // Step 1 data
  userInput: string;
  
  // Step 2 data
  aiSuggestions: Array<{ text: string; source: 'hh' }>;
  selectedKeywords: SelectedKeyword[];
  
  // Step 3 data
  filters: WizardFilters;
  
  // Step 4 data
  searchResults: any[];
  currentVacancyIndex: number;
  totalFound: number;
  appliedVacancyIds: string[];
  
  // Auto-save state
  currentApplicationId: number | null;
  isSaving: boolean;
  lastSavedAt: Date | null;
  
  // Change tracking for live sync
  lastSearchKeywords: SelectedKeyword[];
  lastSearchFilters: WizardFilters;
  searchNeedsRefresh: boolean;
  
  // Actions
  setStep: (step: WizardStep) => void;
  setCurrentStep: (step: number) => void;
  setUserInput: (input: string) => void;
  setAISuggestions: (suggestions: Array<{ text: string; source: 'hh' }>) => void;
  setSuggestedKeywords: (keywords: string[]) => void;
  setSelectedKeywords: (keywords: SelectedKeyword[]) => void;
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
  
  // Search lifecycle
  markSearchCompleted: () => void;
  checkSearchNeedsRefresh: () => boolean;
  jumpToVacancy: (targetIndex: number) => boolean;
  
  // Transition actions
  startTransition: (from: WizardStep, to: WizardStep) => void;
  completeTransition: () => void;
  
  // Navigation
  goBack: () => void;
  goNext: () => void;
  
  // Reset
  reset: () => void;
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
  workFormats: []
};

export const useWizardStore = create<WizardState>()(
  persist(
    (set, get) => ({
      // Initial state
      currentStep: 'keywords',
      isTransitioning: false,
      transitionFrom: null,
      transitionTo: null,
      userInput: '',
      aiSuggestions: [],
      selectedKeywords: [],
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
        const { lastSearchKeywords } = get();
        set({ 
          selectedKeywords: keywords,
          searchNeedsRefresh: JSON.stringify(keywords) !== JSON.stringify(lastSearchKeywords)
        });
        // Auto-save when keywords are confirmed
        setTimeout(() => get().autoSave(), 1000);
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
        const { filters, lastSearchFilters } = get();
        const updatedFilters = { ...filters, ...newFilters };
        set({
          filters: updatedFilters,
          searchNeedsRefresh: JSON.stringify(updatedFilters) !== JSON.stringify(lastSearchFilters)
        });
        // Auto-save when filters are updated
        setTimeout(() => get().autoSave(), 1000);
      },
      
      setVacancies: (vacancies) => set({ searchResults: vacancies }),
      
      setSearchResults: (results, totalFound) => {
        set({
          searchResults: results,
          totalFound,
          currentVacancyIndex: 0
        });
        // Auto-save when search results are loaded
        setTimeout(() => get().autoSave(), 1000);
      },
      
      setCurrentVacancyIndex: (index) => {
        set({ currentVacancyIndex: index });
        // Auto-save when user navigates between vacancies
        setTimeout(() => get().autoSave(), 500);
      },
      
      // Auto-save actions
      autoSave: async () => {
        const state = get();
        
        // Don't auto-save if on keywords step or no meaningful data
        if (state.currentStep === 'keywords' || state.selectedKeywords.length === 0) {
          return;
        }
        
        set({ isSaving: true });
        
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
            set({ 
              currentApplicationId: savedApp.id,
              lastSavedAt: new Date()
            });
          }
        } catch (error) {
          console.error('Auto-save failed:', error);
        } finally {
          set({ isSaving: false });
        }
      },
      
      setCurrentApplicationId: (id) => set({ currentApplicationId: id }),
      
      markVacancyAsApplied: (vacancyId) => {
        const { appliedVacancyIds } = get();
        if (!appliedVacancyIds.includes(vacancyId)) {
          set({ 
            appliedVacancyIds: [...appliedVacancyIds, vacancyId] 
          });
          // Auto-save when marking vacancy as applied
          setTimeout(() => get().autoSave(), 500);
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
          isTransitioning: false,
          transitionFrom: null,
          transitionTo: null,
          userInput: '',
          aiSuggestions: [],
          selectedKeywords: [],
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
          searchNeedsRefresh: false
        });
      }
    }),
    {
      name: 'job-wizard-storage',
      partialize: (state) => ({
        userInput: state.userInput,
        selectedKeywords: state.selectedKeywords,
        filters: state.filters
      })
    }
  )
);
