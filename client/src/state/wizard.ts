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
      
      setSelectedKeywords: (keywords) => set({ selectedKeywords: keywords }),
      
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
        const { filters } = get();
        set({
          filters: { ...filters, ...newFilters }
        });
      },
      
      setVacancies: (vacancies) => set({ searchResults: vacancies }),
      
      setSearchResults: (results, totalFound) => set({
        searchResults: results,
        totalFound,
        currentVacancyIndex: 0
      }),
      
      setCurrentVacancyIndex: (index) => set({ currentVacancyIndex: index }),
      
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
      
      // Reset
      reset: () => set({
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
        totalFound: 0
      })
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
