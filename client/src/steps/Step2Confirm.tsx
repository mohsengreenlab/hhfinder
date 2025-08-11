import { useState, useEffect } from 'react';
import { ArrowLeft, ArrowRight, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { useQuery } from '@tanstack/react-query';
import LoadingLines from '@/components/LoadingLines';
import { useWizardStore } from '@/state/wizard';
import { AIKeywordsResponse } from '@/types/api';

const loadingMessages = [
  "On your command…",
  "Consulting AI experts…",
  "Gathering HH.ru insights…",
  "Preparing smart suggestions…",
  "Processing AI recommendations…"
];

interface Step2ConfirmProps {
  onBackToDashboard?: () => void;
}

export default function Step2Confirm({ onBackToDashboard }: Step2ConfirmProps) {
  const { 
    userInput, 
    aiSuggestions,
    selectedKeywords, 
    setAISuggestions, 
    setSelectedKeywords,
    addCustomKeyword,
    removeKeyword,
    goBack, 
    goNext 
  } = useWizardStore();

  const [customKeyword, setCustomKeyword] = useState('');

  // Fetch AI keywords and HH suggestions
  const { data, isLoading, error } = useQuery<AIKeywordsResponse>({
    queryKey: ['/api/ai-keywords', userInput],
    enabled: !!userInput,
    staleTime: 60000, // Cache for 1 minute
  });

  useEffect(() => {
    if (data?.suggestionsTop10) {
      setAISuggestions(data.suggestionsTop10);
    }
  }, [data, setAISuggestions]);

  const handleKeywordToggle = (suggestion: { text: string; source: 'hh' }, checked: boolean) => {
    if (checked && selectedKeywords.length < 3) {
      const newKeywords = [...selectedKeywords, { text: suggestion.text, source: suggestion.source }];
      setSelectedKeywords(newKeywords);
    } else if (!checked) {
      const newKeywords = selectedKeywords.filter(k => k.text !== suggestion.text);
      setSelectedKeywords(newKeywords);
    }
  };

  const handleAddCustom = () => {
    if (customKeyword.trim() && selectedKeywords.length < 3) {
      addCustomKeyword(customKeyword.trim());
      setCustomKeyword('');
    }
  };

  const handleCustomKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddCustom();
    }
  };

  const isKeywordSelected = (text: string) => {
    return selectedKeywords.some(k => k.text === text);
  };

  const canContinue = selectedKeywords.length > 0;

  if (isLoading) {
    return (
      <div className="w-full max-w-2xl mx-auto">
        <div className="bg-white rounded-2xl shadow-lg p-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-slate-800 mb-2" data-testid="step2-title">
              Choose your keywords
            </h1>
            <p className="text-slate-600" data-testid="step2-description">
              Select up to 3 verified keywords from our AI suggestions
            </p>
          </div>
          <LoadingLines messages={loadingMessages} data-testid="step2-loading" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full max-w-2xl mx-auto">
        <div className="bg-white rounded-2xl shadow-lg p-8">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-slate-800 mb-2">
              Something went wrong
            </h1>
            <p className="text-slate-600 mb-6" data-testid="error-message">
              {error instanceof Error ? error.message : 'Failed to load suggestions'}
            </p>
            <Button onClick={goBack} variant="outline" data-testid="retry-button">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Go Back
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="bg-white rounded-2xl shadow-lg p-8 animate-fade-in">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-slate-800 mb-2" data-testid="step2-title">
            Choose your keywords
          </h1>
          <p className="text-slate-600" data-testid="step2-description">
            Select up to 3 verified keywords from our AI suggestions
          </p>
        </div>

        <div className="space-y-6">
          {/* Selected Keywords */}
          {selectedKeywords.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-slate-800 mb-3" data-testid="selected-keywords-title">
                Selected Keywords ({selectedKeywords.length}/3)
              </h3>
              <div className="flex flex-wrap gap-2" data-testid="selected-keywords-container">
                {selectedKeywords.map((keyword, index) => (
                  <div
                    key={`${keyword.text}-${index}`}
                    className="flex items-center bg-primary-50 text-primary-700 px-3 py-1 
                               rounded-full text-sm font-medium border border-primary-200"
                    data-testid={`selected-keyword-${index}`}
                  >
                    <span>{keyword.text}</span>
                    <button
                      onClick={() => removeKeyword(index)}
                      className="ml-2 hover:text-primary-800 transition-colors"
                      data-testid={`remove-keyword-${index}`}
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* AI Suggestions */}
          {aiSuggestions.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-slate-800 mb-4" data-testid="ai-suggestions-title">
                AI-Generated Suggestions
              </h3>
              <div className="grid gap-3" data-testid="suggestions-list">
                {aiSuggestions.map((suggestion, index) => (
                  <label 
                    key={`${suggestion.text}-${index}`}
                    className={`flex items-center p-3 border rounded-lg cursor-pointer transition-colors
                      ${isKeywordSelected(suggestion.text) 
                        ? 'border-primary-300 bg-primary-50' 
                        : 'border-slate-200 hover:bg-slate-50'
                      }
                      ${selectedKeywords.length >= 3 && !isKeywordSelected(suggestion.text) 
                        ? 'opacity-50 cursor-not-allowed' 
                        : ''
                      }
                    `}
                    data-testid={`suggestion-${index}`}
                  >
                    <Checkbox
                      checked={isKeywordSelected(suggestion.text)}
                      onCheckedChange={(checked) => handleKeywordToggle(suggestion, !!checked)}
                      disabled={selectedKeywords.length >= 3 && !isKeywordSelected(suggestion.text)}
                      className="mr-3"
                      data-testid={`suggestion-checkbox-${index}`}
                    />
                    <span className="flex-1 text-slate-800" data-testid={`suggestion-text-${index}`}>
                      {suggestion.text}
                    </span>
                    <span 
                      className="ml-auto text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded"
                      data-testid={`suggestion-badge-${index}`}
                    >
                      AI + HH Verified
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Custom Keywords */}
          {selectedKeywords.length < 3 && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-slate-800 mb-4" data-testid="custom-keywords-title">
                Add Custom Keywords
              </h3>
              <div className="flex gap-2">
                <Input
                  type="text"
                  value={customKeyword}
                  onChange={(e) => setCustomKeyword(e.target.value)}
                  onKeyDown={handleCustomKeyDown}
                  placeholder="Add your own keyword"
                  className="flex-1 px-4 py-2 border border-slate-300 rounded-lg 
                             focus:ring-2 focus:ring-primary focus:border-transparent"
                  data-testid="custom-keyword-input"
                />
                <Button
                  type="button"
                  onClick={handleAddCustom}
                  disabled={!customKeyword.trim()}
                  variant="outline"
                  size="icon"
                  className="bg-slate-200 text-slate-700 hover:bg-slate-300"
                  data-testid="add-custom-button"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="flex gap-4">
            <Button
              type="button"
              onClick={goBack}
              variant="outline"
              className="flex-1 py-3 px-6 rounded-xl font-semibold"
              data-testid="back-button"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
            <Button
              type="button"
              onClick={goNext}
              disabled={!canContinue}
              className="flex-1 bg-primary-600 text-white py-3 px-6 rounded-xl font-semibold 
                         hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed 
                         transition-colors"
              data-testid="continue-button"
            >
              Continue
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
