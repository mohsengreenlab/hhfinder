import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type WizardStep = 'keywords' | 'confirm' | 'filters' | 'results';

export interface SelectedKeyword {
  text: string;
  source: 'ai' | 'hh' | 'custom';
}

export interface WizardFilters {
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
}

export interface WizardState {
  // Current step
  currentStep: WizardStep;
  
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
  setUserInput: (input: string) => void;
  setAISuggestions: (suggestions: Array<{ text: string; source: 'hh' }>) => void;
  setSelectedKeywords: (keywords: SelectedKeyword[]) => void;
  addCustomKeyword: (text: string) => void;
  removeKeyword: (index: number) => void;
  setFilters: (filters: Partial<WizardFilters>) => void;
  setSearchResults: (results: any[], totalFound: number) => void;
  setCurrentVacancyIndex: (index: number) => void;
  
  // Navigation
  goBack: () => void;
  goNext: () => void;
  
  // Reset
  reset: () => void;
}

const defaultFilters: WizardFilters = {
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
  orderBy: 'relevance'
};

export const useWizardStore = create<WizardState>()(
  persist(
    (set, get) => ({
      // Initial state
      currentStep: 'keywords',
      userInput: '',
      aiSuggestions: [],
      selectedKeywords: [],
      filters: defaultFilters,
      searchResults: [],
      currentVacancyIndex: 0,
      totalFound: 0,

      // Actions
      setStep: (step) => set({ currentStep: step }),
      
      setUserInput: (input) => set({ userInput: input }),
      
      setAISuggestions: (suggestions) => set({ aiSuggestions: suggestions }),
      
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
      
      setSearchResults: (results, totalFound) => set({
        searchResults: results,
        totalFound,
        currentVacancyIndex: 0
      }),
      
      setCurrentVacancyIndex: (index) => set({ currentVacancyIndex: index }),
      
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
        const { currentStep } = get();
        switch (currentStep) {
          case 'keywords':
            set({ currentStep: 'confirm' });
            break;
          case 'confirm':
            set({ currentStep: 'filters' });
            break;
          case 'filters':
            set({ currentStep: 'results' });
            break;
        }
      },
      
      // Reset
      reset: () => set({
        currentStep: 'keywords',
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
