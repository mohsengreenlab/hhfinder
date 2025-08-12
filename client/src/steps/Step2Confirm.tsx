import { useState, useEffect } from 'react';
import { ArrowLeft, ArrowRight, Plus, X, Minus, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
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
    filters,
    setAISuggestions, 
    setSelectedKeywords,
    setFilters,
    addCustomKeyword,
    removeKeyword,
    updateSearchSignature,
    goBack, 
    goNext 
  } = useWizardStore();

  const [customKeyword, setCustomKeyword] = useState('');
  const [showGeminiModal, setShowGeminiModal] = useState(false);
  const [geminiKey, setGeminiKey] = useState('');
  const { toast } = useToast();
  const queryClient = useQueryClient();

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
      setTimeout(() => updateSearchSignature(), 0);
    } else if (!checked) {
      const newKeywords = selectedKeywords.filter(k => k.text !== suggestion.text);
      setSelectedKeywords(newKeywords);
      setTimeout(() => updateSearchSignature(), 0);
    }
  };

  const handleAddCustom = () => {
    if (customKeyword.trim() && selectedKeywords.length < 3) {
      addCustomKeyword(customKeyword.trim());
      setCustomKeyword('');
      setTimeout(() => updateSearchSignature(), 0);
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

  // Check if Gemini API key is available
  const { data: hasGeminiKey } = useQuery({
    queryKey: ['/api/health/gemini'],
    queryFn: async () => {
      try {
        const response = await fetch('/api/health/gemini');
        const data = await response.json();
        return data.available;
      } catch {
        return false;
      }
    },
    staleTime: 5 * 60 * 1000,
    retry: false
  });

  // Mutation to save Gemini API key
  const saveGeminiKeyMutation = useMutation({
    mutationFn: async (apiKey: string) => {
      const response = await fetch('/api/gemini/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey })
      });
      
      if (!response.ok) {
        throw new Error('Failed to save API key');
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Gemini Connected!",
        description: "AI keyword suggestions are now enabled"
      });
      setShowGeminiModal(false);
      setGeminiKey('');
      queryClient.invalidateQueries({ queryKey: ['/api/health/gemini'] });
      queryClient.invalidateQueries({ queryKey: ['/api/ai-keywords'] });
    },
    onError: () => {
      toast({
        title: "Connection Failed",
        description: "Please check your API key and try again",
        variant: "destructive"
      });
    }
  });

  const handleConnectGemini = () => {
    if (geminiKey.trim()) {
      saveGeminiKeyMutation.mutate(geminiKey.trim());
    }
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

          {/* Negative Keywords Section */}
          <div className="mb-8 bg-red-50 p-4 rounded-xl border border-red-100">
            <h3 className="text-lg font-semibold text-red-800 mb-3 flex items-center">
              <Minus className="mr-2 h-5 w-5 text-red-500" />
              Exclude Words (Optional)
            </h3>
            <p className="text-sm text-red-700 mb-3">
              Filter out unwanted results by excluding words like "intern", "trainee", "junior"
            </p>
            <Input
              placeholder="e.g., intern, trainee, junior"
              value={filters.excludeWords || ''}
              onChange={(e) => setFilters({ excludeWords: e.target.value })}
              className="w-full border-red-200 focus:border-red-400"
            />
          </div>

          {/* Gemini Connection Section */}
          {hasGeminiKey === false && (
            <div className="mb-8 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="font-semibold text-blue-900 mb-2 flex items-center">
                    <Settings className="mr-2 h-5 w-5" />
                    Enhanced AI Keywords Available
                  </h3>
                  <p className="text-blue-800 text-sm mb-3">
                    Connect Gemini AI for smarter keyword expansion, synonyms, and morphology analysis
                  </p>
                  <ul className="text-xs text-blue-700 space-y-1">
                    <li>• Expands keywords with professional synonyms</li>
                    <li>• Suggests industry-specific variations</li>
                    <li>• Better matches with Russian morphology</li>
                  </ul>
                </div>
                <Button
                  onClick={() => setShowGeminiModal(true)}
                  className="bg-blue-600 text-white hover:bg-blue-700 ml-4 shrink-0"
                  size="sm"
                >
                  Connect Gemini
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

      {/* Gemini Connection Modal */}
      <Dialog open={showGeminiModal} onOpenChange={setShowGeminiModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center">
              <Settings className="mr-2 h-5 w-5 text-blue-600" />
              Connect Gemini AI
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="text-sm text-slate-600">
              <p className="mb-3">
                Connecting Gemini AI will enhance your keyword suggestions with:
              </p>
              <ul className="space-y-2 mb-4">
                <li className="flex items-center">
                  <span className="w-2 h-2 bg-green-500 rounded-full mr-3"></span>
                  Smart keyword expansion with professional synonyms
                </li>
                <li className="flex items-center">
                  <span className="w-2 h-2 bg-green-500 rounded-full mr-3"></span>
                  Industry-specific job title variations
                </li>
                <li className="flex items-center">
                  <span className="w-2 h-2 bg-green-500 rounded-full mr-3"></span>
                  Better Russian language morphology matching
                </li>
              </ul>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">
                Enter your Gemini API Key:
              </label>
              <Input
                type="password"
                placeholder="AIzaSy..."
                value={geminiKey}
                onChange={(e) => setGeminiKey(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleConnectGemini()}
                className="w-full"
              />
              <p className="text-xs text-slate-500 mt-2">
                Get your API key from{' '}
                <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                  Google AI Studio
                </a>
              </p>
            </div>
            <div className="flex justify-end space-x-2">
              <Button
                onClick={() => setShowGeminiModal(false)}
                variant="outline"
              >
                Cancel
              </Button>
              <Button
                onClick={handleConnectGemini}
                disabled={!geminiKey.trim() || saveGeminiKeyMutation.isPending}
                className="bg-blue-600 text-white hover:bg-blue-700"
              >
                {saveGeminiKeyMutation.isPending ? 'Connecting...' : 'Connect'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
