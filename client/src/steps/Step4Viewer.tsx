import { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  ChevronLeft, 
  ChevronRight, 
  ExternalLink, 
  FileText, 
  Filter,
  Home,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import LoadingLines from '@/components/LoadingLines';
import { useWizardStore } from '@/state/wizard';
import { 
  HHVacanciesResponse, 
  HHVacancyDetail, 
  FilterMatchRequest,
  FilterMatchResponse
} from '@/types/api';
import { useToast } from '@/hooks/use-toast';
import { ImprovedCoverLetterGenerator } from '@/components/ImprovedCoverLetterGenerator';

const searchLoadingMessages = [
  "Calibrating scanners…",
  "Scanning job databases…",
  "Analyzing market trends…",
  "Finding perfect matches…"
];



interface Step4ViewerProps {
  onBackToDashboard?: () => void;
}

export default function Step4Viewer({ onBackToDashboard }: Step4ViewerProps) {
  const { 
    selectedKeywords, 
    filters, 
    searchResults, 
    currentVacancyIndex, 
    totalFound,
    appliedVacancyIds,
    setSearchResults,
    setCurrentVacancyIndex,
    markVacancyAsApplied,
    goBack 
  } = useWizardStore();
  
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [showCoverLetter, setShowCoverLetter] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const [vacancyStatuses, setVacancyStatuses] = useState<Record<string, any>>({});



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
            plainDescription: vacancyDetail.plainDescription
          }}
          onClose={() => setShowCoverLetter(false)}
        />
      )}
    </div>
  );
}
