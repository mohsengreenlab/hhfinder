import { useState } from 'react';
import { Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useWizardStore } from '@/state/wizard';

interface Step1KeywordsProps {
  onBackToDashboard?: () => void;
}

export default function Step1Keywords({ onBackToDashboard }: Step1KeywordsProps) {
  const { userInput, setUserInput, goNext } = useWizardStore();
  const [localInput, setLocalInput] = useState(userInput);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (localInput.trim()) {
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
      </div>
    </div>
  );
}
