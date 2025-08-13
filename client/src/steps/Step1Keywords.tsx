import { useState } from 'react';
import { Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useWizardStore } from '@/state/wizard';
import { useQuery, useQueryClient } from '@tanstack/react-query';

interface Step1KeywordsProps {
  onBackToDashboard?: () => void;
}

export default function Step1Keywords({ onBackToDashboard }: Step1KeywordsProps) {
  const { userInput, setUserInput, goNext } = useWizardStore();
  const [localInput, setLocalInput] = useState(userInput);
  const queryClient = useQueryClient();
  
  // Check if Gemini API key is available
  const { data: hasGeminiKey } = useQuery({
    queryKey: ['/api/health/gemini'],
    queryFn: async () => {
      try {
        const response = await fetch('/api/health/gemini');
        return response.ok;
      } catch {
        return false;
      }
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    retry: false
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (localInput.trim()) {
      // Clear any existing search state if keywords changed
      const currentInput = userInput.trim().toLowerCase();
      const newInput = localInput.trim().toLowerCase();
      
      if (currentInput && currentInput !== newInput) {
        // Keywords changed - trigger a complete search reset
        console.log('Keywords changed - triggering search reset');
        
        // Clear React Query cache for all search-related queries
        queryClient.removeQueries({ queryKey: ['/api/vacancies'] });
        queryClient.removeQueries({ queryKey: ['/api/ai-keywords'] });
        queryClient.removeQueries({ queryKey: ['/api/vacancies/tiered'] });
        queryClient.invalidateQueries({ queryKey: ['/api/hh'] });
        
        // Reset wizard state
        useWizardStore.getState().resetSearch();
      }
      
      setUserInput(localInput.trim());
      goNext();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalInput(e.target.value);
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="bg-white rounded-2xl shadow-lg p-8 animate-fade-in">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-slate-800 mb-2" data-testid="step1-title">
            What job are you looking for?
          </h1>
          <p className="text-slate-600" data-testid="step1-description">
            Tell us about your dream position and we'll help you find it
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="relative">
            <label 
              htmlFor="jobKeywords" 
              className="block text-sm font-medium text-slate-700 mb-2"
              data-testid="keywords-label"
            >
              Job title or keywords
            </label>
            <div className="relative">
              <Input
                id="jobKeywords"
                type="text"
                value={localInput}
                onChange={handleInputChange}
                placeholder="e.g., Data Scientist, Frontend Developer, Product Manager"
                className="w-full px-4 py-3 pr-12 text-lg border border-slate-300 rounded-xl 
                           focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                data-testid="keywords-input"
                autoFocus
              />
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                <Search className="h-5 w-5 text-slate-400" data-testid="search-icon" />
              </div>
            </div>
          </div>

          <Button
            type="submit"
            disabled={!localInput.trim()}
            className="w-full bg-primary-600 text-white py-3 px-6 rounded-xl font-semibold 
                       hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed 
                       transition-colors"
            size="lg"
            data-testid="find-suggestions-button"
          >
            Find AI Suggestions
            <Search className="ml-2 h-5 w-5" />
          </Button>
        </form>

        {/* Missing Gemini Key Banner - only show if key is missing */}
        {hasGeminiKey === false && (
          <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-xl">
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-amber-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-amber-800">
                AI suggestions disabled — using basic keyword search
              </p>
              <p className="text-sm text-amber-700 mt-1">
                The system will still work by combining your keywords with OR logic and applying your chosen filters.
              </p>
            </div>
          </div>
          </div>
        )}
      </div>
    </div>
  );
}
