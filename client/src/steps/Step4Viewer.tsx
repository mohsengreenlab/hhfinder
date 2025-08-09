import { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  ChevronLeft, 
  ChevronRight, 
  ExternalLink, 
  FileText, 
  Filter,
  Copy,
  Download,
  X,
  Save
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import LoadingLines from '@/components/LoadingLines';
import { useWizardStore } from '@/state/wizard';
import { 
  HHVacanciesResponse, 
  HHVacancyDetail, 
  FilterMatchRequest,
  FilterMatchResponse,
  CoverLetterRequest,
  CoverLetterResponse
} from '@/types/api';
import { useToast } from '@/hooks/use-toast';

const searchLoadingMessages = [
  "Calibrating scanners…",
  "Scanning job databases…",
  "Analyzing market trends…",
  "Finding perfect matches…"
];

const letterLoadingMessages = [
  "Crafting your cover letter…",
  "Polishing tone…",
  "Adding personal touch…",
  "Almost there…"
];

export default function Step4Viewer() {
  const { 
    selectedKeywords, 
    filters, 
    searchResults, 
    currentVacancyIndex, 
    totalFound,
    setSearchResults,
    setCurrentVacancyIndex,
    goBack 
  } = useWizardStore();
  
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [showCoverLetter, setShowCoverLetter] = useState(false);
  const [customPrompt, setCustomPrompt] = useState('');
  const [selectedPromptTemplate, setSelectedPromptTemplate] = useState('default');
  const [generatedLetter, setGeneratedLetter] = useState('');
  const [currentPage, setCurrentPage] = useState(0);
  
  // Convert filters to HH format
  const { data: hhFilters, isLoading: isMatchingFilters } = useQuery<FilterMatchResponse>({
    queryKey: ['/api/filters/match'],
    queryFn: async () => {
      const filterRequest: FilterMatchRequest = {
        selectedKeywords: selectedKeywords.map(k => k.text),
        
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
        workFormats: filters.workFormats
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

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(0);
    setCurrentVacancyIndex(0);
  }, [hhFilters, setCurrentVacancyIndex]);

  // Search vacancies
  const { data: vacanciesData, isLoading: isSearching, error: searchError } = useQuery<HHVacanciesResponse>({
    queryKey: ['/api/vacancies', hhFilters, currentPage],
    queryFn: async () => {
      if (!hhFilters) return { items: [], found: 0, pages: 0, page: 0, per_page: 0 };

      const params = new URLSearchParams();
      Object.entries(hhFilters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          if (Array.isArray(value)) {
            value.forEach(v => params.append(key, v.toString()));
          } else {
            params.set(key, value.toString());
          }
        }
      });
      params.set('page', currentPage.toString());
      params.set('per_page', '100');

      const response = await fetch(`/api/vacancies?${params.toString()}`);
      
      if (!response.ok) {
        throw new Error('Failed to search vacancies');
      }
      
      return response.json();
    },
    enabled: !!hhFilters,
    staleTime: 5 * 60 * 1000 // Cache for 5 minutes
  });

  // Update store when search results change (append for pagination)
  useEffect(() => {
    if (vacanciesData?.items) {
      if (currentPage === 0) {
        // First page - replace results
        setSearchResults(vacanciesData.items, vacanciesData.found);
      } else {
        // Subsequent pages - append results (avoid duplicates)
        const currentResults = searchResults || [];
        const existingIds = new Set(currentResults.map(item => item.id));
        const newItems = vacanciesData.items.filter(item => !existingIds.has(item.id));
        const newResults = [...currentResults, ...newItems];
        setSearchResults(newResults, vacanciesData.found);
      }
    }
  }, [vacanciesData, setSearchResults, currentPage]);

  // Get current vacancy details
  const currentVacancy = searchResults[currentVacancyIndex];
  
  const { data: vacancyDetail, isLoading: isLoadingDetail } = useQuery<HHVacancyDetail>({
    queryKey: ['/api/vacancies', currentVacancy?.id],
    enabled: !!currentVacancy?.id,
    staleTime: 10 * 60 * 1000 // Cache for 10 minutes
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
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    }
  });

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
            <Button onClick={goBack} variant="outline" data-testid="go-back-button">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Go Back
            </Button>
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
              Try adjusting your filters to find more opportunities
            </p>
            <Button onClick={goBack} variant="outline" data-testid="refine-filters-button">
              <Filter className="mr-2 h-4 w-4" />
              Refine Filters
            </Button>
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
          <div>
            <h2 className="text-2xl font-bold text-slate-800" data-testid="results-count">
              {totalFound} jobs found
            </h2>
            <p className="text-slate-600" data-testid="current-position">
              Showing position {currentVacancyIndex + 1} of {totalFound}
            </p>
          </div>
          <Button
            type="button"
            onClick={goBack}
            variant="outline"
            className="bg-slate-200 text-slate-700 hover:bg-slate-300"
            data-testid="refine-filters-header-button"
          >
            <Filter className="mr-2 h-4 w-4" />
            Refine Filters
          </Button>
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
                        <ArrowLeft className="mr-2 h-4 w-4" />
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
                    onClick={() => setShowCoverLetter(true)}
                    className="bg-emerald-600 text-white hover:bg-emerald-700"
                    data-testid="generate-cover-letter-button"
                  >
                    <FileText className="mr-2 h-4 w-4" />
                    Generate Cover Letter
                  </Button>
                  <Button
                    onClick={() => {
                      const applyUrl = vacancyDetail?.apply_alternate_url || 
                        `https://hh.ru/applicant/vacancy_response?vacancyId=${vacancyDetail?.id}`;
                      window.open(applyUrl, '_blank');
                    }}
                    className="bg-blue-600 text-white hover:bg-blue-700"
                    data-testid="apply-now-button"
                  >
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Apply Now
                  </Button>
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
      {showCoverLetter && (
        <div className="bg-white rounded-2xl shadow-lg p-8 animate-fade-in" data-testid="cover-letter-section">
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold text-slate-800">AI Cover Letter Generator</h3>
              <Button
                onClick={() => setShowCoverLetter(false)}
                variant="ghost"
                size="sm"
                data-testid="close-cover-letter-button"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-slate-600">Generate a personalized cover letter for this position using AI or custom prompts</p>
          </div>

          {/* Prompt Templates */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Choose or customize your prompt
            </label>
            <div className="flex gap-2 mb-3">
              <Select
                value={selectedPromptTemplate}
                onValueChange={setSelectedPromptTemplate}
              >
                <SelectTrigger className="flex-1" data-testid="prompt-template-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">Default Template</SelectItem>
                  <SelectItem value="technical">Technical Focus</SelectItem>
                  <SelectItem value="creative">Creative Approach</SelectItem>
                  <SelectItem value="custom">Custom Prompt</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="icon" data-testid="save-prompt-button">
                <Save className="h-4 w-4" />
              </Button>
            </div>
            
            {selectedPromptTemplate === 'custom' && (
              <div>
                <Textarea
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  placeholder="Write your custom instructions for the cover letter. You can use these placeholders: {{POSITION}}, {{COMPANY}}, {{LOCATION}}, {{SKILLS}}, {{DESCRIPTION}}. Example: 'Write a professional cover letter for {{POSITION}} at {{COMPANY}}. Focus on my experience with {{SKILLS}} and mention points from {{DESCRIPTION}}.'"
                  className="h-32 text-sm"
                  data-testid="custom-prompt-textarea"
                />
                <p className="text-xs text-slate-500 mt-2">
                  Tip: Use placeholders like {String("{{POSITION}}, {{COMPANY}}, {{SKILLS}}, {{DESCRIPTION}}")} to reference job details
                </p>
              </div>
            )}
          </div>

          {/* Generate Button */}
          <div className="mb-6">
            <Button
              onClick={generateCoverLetter}
              disabled={coverLetterMutation.isPending}
              className="bg-emerald-600 text-white hover:bg-emerald-700 font-semibold"
              data-testid="generate-letter-button"
            >
              <FileText className="mr-2 h-4 w-4" />
              Generate Cover Letter
            </Button>
          </div>

          {/* Generated Letter */}
          {(coverLetterMutation.isPending || generatedLetter) && (
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
              {coverLetterMutation.isPending ? (
                <LoadingLines messages={letterLoadingMessages} className="py-4" />
              ) : (
                <div>
                  <Textarea
                    value={generatedLetter}
                    onChange={(e) => setGeneratedLetter(e.target.value)}
                    className="w-full h-64 resize-none border-0 bg-transparent focus:ring-0"
                    data-testid="generated-letter-textarea"
                  />
                  
                  <div className="flex gap-2 mt-4">
                    <Button
                      onClick={copyToClipboard}
                      variant="outline"
                      data-testid="copy-letter-button"
                    >
                      <Copy className="mr-2 h-4 w-4" />
                      Copy
                    </Button>
                    <Button
                      onClick={downloadAsText}
                      variant="outline"
                      data-testid="download-letter-button"
                    >
                      <Download className="mr-2 h-4 w-4" />
                      Download .txt
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
