import { useState, useEffect } from 'react';
import { Search, MapPin, Building, Train, Tag, Filter, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useQuery } from '@tanstack/react-query';
import Combobox from '@/components/Combobox';
import KeywordExpansionModal from '@/components/KeywordExpansionModal';
import { useWizardStore } from '@/state/wizard';
import { HHDictionaries, HHArea } from '@/types/api';

interface Step3FiltersProps {
  onBackToDashboard?: () => void;
}

export default function Step3Filters({ onBackToDashboard }: Step3FiltersProps) {
  const { filters, setFilters, updateSearchSignature, goNext, selectedKeywords, setSelectedKeywords } = useWizardStore();
  const [showKeywordExpansion, setShowKeywordExpansion] = useState(false);
  
  // Ensure all new fields exist (migration from old localStorage)
  const migratedFilters = {
    ...filters,
    enableLocationFilter: filters.enableLocationFilter ?? false,
    enableExperienceFilter: filters.enableExperienceFilter ?? false,
    enableEmploymentFilter: filters.enableEmploymentFilter ?? false,
    enableScheduleFilter: filters.enableScheduleFilter ?? false,
    enableSalaryFilter: filters.enableSalaryFilter ?? false,
    enableMetroFilter: filters.enableMetroFilter ?? false,
    enableLabelFilter: filters.enableLabelFilter ?? false,
    enableEducationFilter: filters.enableEducationFilter ?? false,
    enableWorkFormatFilter: filters.enableWorkFormatFilter ?? false,
    metroStation: filters.metroStation ?? '',
    searchFields: filters.searchFields ?? [],
    vacancyLabels: filters.vacancyLabels ?? [],
    employerName: filters.employerName ?? '',
    educationLevel: filters.educationLevel ?? '',
    workFormats: filters.workFormats ?? [],
    // New search options with defaults
    titleFirstSearch: filters.titleFirstSearch ?? true,
    useExactPhrases: filters.useExactPhrases ?? true,
    enableDebugMode: filters.enableDebugMode ?? false,
    // Safe Mode toggle - temporary for diagnostics
    safeMode: filters.safeMode ?? false
  };
  
  // Local form state
  const [localFilters, setLocalFilters] = useState(migratedFilters);

  // Fetch dictionaries
  const { data: dictionaries } = useQuery<HHDictionaries>({
    queryKey: ['/api/dictionaries'],
    staleTime: 24 * 60 * 60 * 1000, // Cache for 24 hours
  });

  // Fetch areas
  const { data: areas } = useQuery<HHArea[]>({
    queryKey: ['/api/areas'],
    staleTime: 24 * 60 * 60 * 1000, // Cache for 24 hours
  });

  // Flatten areas for search
  const flattenAreas = (areas: HHArea[]): Array<{value: string, label: string}> => {
    const result: Array<{value: string, label: string}> = [];
    
    const flatten = (areaList: HHArea[]) => {
      areaList.forEach(area => {
        result.push({ value: area.id, label: area.name });
        if (area.areas && area.areas.length > 0) {
          flatten(area.areas);
        }
      });
    };
    
    flatten(areas);
    return result;
  };

  const areaOptions = areas ? flattenAreas(areas) : [];

  const handleLocalChange = (key: keyof typeof filters, value: any) => {
    const newFilters = { ...localFilters, [key]: value };
    setLocalFilters(newFilters);
    setFilters(newFilters);
    // Update search signature when filters change (debounced)
    setTimeout(() => updateSearchSignature(), 100);
  };

  const handleSubmit = () => {
    // Commit filters and update search signature before navigation
    setFilters(localFilters);
    updateSearchSignature();
    goNext();
  };

  // Experience options
  const experienceOptions = dictionaries?.experience?.map(exp => ({
    value: exp.id,
    label: exp.name
  })) || [];

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="bg-white rounded-2xl shadow-lg p-8 animate-fade-in">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-slate-800 mb-2" data-testid="step3-title">
            Refine your search
          </h1>
          <p className="text-slate-600" data-testid="step3-description">
            Choose which filters to apply. Disabled filters will show all results.
          </p>
        </div>

        <div className="grid gap-8">
          {/* Location Filter */}
          <div className="border border-slate-200 rounded-lg p-6 bg-slate-50/50">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <MapPin className="h-5 w-5 text-slate-600" />
                <Label className="text-lg font-semibold text-slate-800">Location Filter</Label>
              </div>
              <Switch
                checked={localFilters.enableLocationFilter}
                onCheckedChange={(checked) => handleLocalChange('enableLocationFilter', checked)}
                data-testid="location-filter-switch"
              />
            </div>
            
            {localFilters.enableLocationFilter && (
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label className="block text-sm font-medium text-slate-700 mb-2" data-testid="location-label">
                    City or Region
                  </Label>
                  <div className="relative">
                    <Combobox
                      options={areaOptions}
                      value={localFilters.locationText}
                      onChange={(value) => handleLocalChange('locationText', value)}
                      placeholder="Moscow, Saint Petersburg..."
                      allowCustom
                      data-testid="location-combobox"
                    />
                  </div>
                </div>
                <div className="flex flex-col justify-end">
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="remote-only"
                        checked={localFilters.remoteOnly}
                        onCheckedChange={(checked) => handleLocalChange('remoteOnly', !!checked)}
                        data-testid="remote-only-checkbox"
                      />
                      <Label htmlFor="remote-only" className="text-slate-700" data-testid="remote-only-label">
                        Remote only
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="hybrid-ok"
                        checked={localFilters.hybridOk}
                        onCheckedChange={(checked) => handleLocalChange('hybridOk', !!checked)}
                        data-testid="hybrid-ok-checkbox"
                      />
                      <Label htmlFor="hybrid-ok" className="text-slate-700" data-testid="hybrid-ok-label">
                        Hybrid OK
                      </Label>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Experience Filter */}
          <div className="border border-slate-200 rounded-lg p-6 bg-slate-50/50">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <Filter className="h-5 w-5 text-slate-600" />
                <Label className="text-lg font-semibold text-slate-800">Experience Level</Label>
              </div>
              <Switch
                checked={localFilters.enableExperienceFilter}
                onCheckedChange={(checked) => handleLocalChange('enableExperienceFilter', checked)}
                data-testid="experience-filter-switch"
              />
            </div>
            
            {localFilters.enableExperienceFilter && (
              <RadioGroup
                value={localFilters.experience}
                onValueChange={(value) => handleLocalChange('experience', value)}
                className="grid grid-cols-2 md:grid-cols-4 gap-3"
                data-testid="experience-radio-group"
              >
                {experienceOptions.map(exp => (
                  <div key={exp.value} className="flex items-center space-x-2 p-3 border border-slate-200 rounded-lg hover:bg-slate-50">
                    <RadioGroupItem value={exp.value} id={exp.value} data-testid={`experience-${exp.value}`} />
                    <Label htmlFor={exp.value} className="text-slate-700 cursor-pointer flex-1">
                      {exp.label}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            )}
          </div>

          {/* Employment & Schedule Filters */}
          <div className="grid md:grid-cols-2 gap-6">
            {/* Employment Filter */}
            <div className="border border-slate-200 rounded-lg p-6 bg-slate-50/50">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <Building className="h-5 w-5 text-slate-600" />
                  <Label className="text-lg font-semibold text-slate-800">Employment Type</Label>
                </div>
                <Switch
                  checked={localFilters.enableEmploymentFilter}
                  onCheckedChange={(checked) => handleLocalChange('enableEmploymentFilter', checked)}
                  data-testid="employment-filter-switch"
                />
              </div>
              
              {localFilters.enableEmploymentFilter && (
                <div className="space-y-2">
                  {dictionaries?.employment?.map(emp => (
                    <div key={emp.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`employment-${emp.id}`}
                        checked={localFilters.employmentTypes.includes(emp.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            handleLocalChange('employmentTypes', [...localFilters.employmentTypes, emp.id]);
                          } else {
                            handleLocalChange('employmentTypes', localFilters.employmentTypes.filter(id => id !== emp.id));
                          }
                        }}
                        data-testid={`employment-${emp.id}-checkbox`}
                      />
                      <Label htmlFor={`employment-${emp.id}`} className="text-slate-700">
                        {emp.name}
                      </Label>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Schedule Filter */}
            <div className="border border-slate-200 rounded-lg p-6 bg-slate-50/50">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <Filter className="h-5 w-5 text-slate-600" />
                  <Label className="text-lg font-semibold text-slate-800">Schedule</Label>
                </div>
                <Switch
                  checked={localFilters.enableScheduleFilter}
                  onCheckedChange={(checked) => handleLocalChange('enableScheduleFilter', checked)}
                  data-testid="schedule-filter-switch"
                />
              </div>
              
              {localFilters.enableScheduleFilter && (
                <div className="space-y-2">
                  {dictionaries?.schedule?.map(sched => (
                    <div key={sched.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`schedule-${sched.id}`}
                        checked={localFilters.scheduleTypes.includes(sched.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            handleLocalChange('scheduleTypes', [...localFilters.scheduleTypes, sched.id]);
                          } else {
                            handleLocalChange('scheduleTypes', localFilters.scheduleTypes.filter(id => id !== sched.id));
                          }
                        }}
                        data-testid={`schedule-${sched.id}-checkbox`}
                      />
                      <Label htmlFor={`schedule-${sched.id}`} className="text-slate-700">
                        {sched.name}
                      </Label>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Salary Filter */}
          <div className="border border-slate-200 rounded-lg p-6 bg-slate-50/50">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <Building className="h-5 w-5 text-slate-600" />
                <Label className="text-lg font-semibold text-slate-800">Salary Filter</Label>
              </div>
              <Switch
                checked={localFilters.enableSalaryFilter}
                onCheckedChange={(checked) => handleLocalChange('enableSalaryFilter', checked)}
                data-testid="salary-filter-switch"
              />
            </div>
            
            {localFilters.enableSalaryFilter && (
              <div className="grid md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                  <Label className="block text-sm font-medium text-slate-700 mb-2" data-testid="salary-label">
                    Minimum Salary
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      value={localFilters.salary || ''}
                      onChange={(e) => handleLocalChange('salary', e.target.value ? parseInt(e.target.value) : null)}
                      placeholder="180000"
                      className="flex-1 px-4 py-3 border border-slate-300 rounded-lg 
                                 focus:ring-2 focus:ring-primary focus:border-transparent"
                      data-testid="salary-input"
                    />
                    <Select
                      value={localFilters.currency}
                      onValueChange={(value) => handleLocalChange('currency', value)}
                    >
                      <SelectTrigger className="w-24" data-testid="currency-select">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {dictionaries?.currency?.map(curr => (
                          <SelectItem key={curr.id} value={curr.id} data-testid={`currency-${curr.id}`}>
                            {curr.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex flex-col justify-end">
                  <div className="flex items-center space-x-2 p-3 border border-slate-200 rounded-lg hover:bg-slate-50">
                    <Checkbox
                      id="only-with-salary"
                      checked={localFilters.onlyWithSalary}
                      onCheckedChange={(checked) => handleLocalChange('onlyWithSalary', !!checked)}
                      data-testid="only-with-salary-checkbox"
                    />
                    <Label htmlFor="only-with-salary" className="text-slate-700 flex-1" data-testid="only-with-salary-label">
                      Only with salary
                    </Label>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Advanced Filters */}
          <div className="grid md:grid-cols-2 gap-6">
            {/* Metro Filter */}
            <div className="border border-slate-200 rounded-lg p-6 bg-slate-50/50">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <Train className="h-5 w-5 text-slate-600" />
                  <Label className="text-lg font-semibold text-slate-800">Metro Station</Label>
                </div>
                <Switch
                  checked={localFilters.enableMetroFilter}
                  onCheckedChange={(checked) => handleLocalChange('enableMetroFilter', checked)}
                  data-testid="metro-filter-switch"
                />
              </div>
              
              {localFilters.enableMetroFilter && (
                <div>
                  <Label className="block text-sm font-medium text-slate-700 mb-2" data-testid="metro-label">
                    Metro Station ID
                  </Label>
                  <Input
                    type="text"
                    value={localFilters.metroStation}
                    onChange={(e) => handleLocalChange('metroStation', e.target.value)}
                    placeholder="e.g. 6.8 for Pushkinskaya"
                    className="px-4 py-3 border border-slate-300 rounded-lg 
                               focus:ring-2 focus:ring-primary focus:border-transparent"
                    data-testid="metro-input"
                  />
                </div>
              )}
            </div>

            {/* Vacancy Labels Filter */}
            <div className="border border-slate-200 rounded-lg p-6 bg-slate-50/50">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <Tag className="h-5 w-5 text-slate-600" />
                  <Label className="text-lg font-semibold text-slate-800">Vacancy Labels</Label>
                </div>
                <Switch
                  checked={localFilters.enableLabelFilter}
                  onCheckedChange={(checked) => handleLocalChange('enableLabelFilter', checked)}
                  data-testid="label-filter-switch"
                />
              </div>
              
              {localFilters.enableLabelFilter && (
                <div className="space-y-2">
                  {dictionaries?.vacancy_label?.map(label => (
                    <div key={label.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`label-${label.id}`}
                        checked={localFilters.vacancyLabels.includes(label.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            handleLocalChange('vacancyLabels', [...localFilters.vacancyLabels, label.id]);
                          } else {
                            handleLocalChange('vacancyLabels', localFilters.vacancyLabels.filter(id => id !== label.id));
                          }
                        }}
                        data-testid={`label-${label.id}-checkbox`}
                      />
                      <Label htmlFor={`label-${label.id}`} className="text-slate-700">
                        {label.name}
                      </Label>
                    </div>
                  ))}
                  {!dictionaries?.vacancy_label?.length && (
                    <p className="text-slate-500 text-sm">No vacancy labels available</p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Search Fields & Employer Filter */}
          <div className="grid md:grid-cols-2 gap-6">
            <div className="border border-slate-200 rounded-lg p-6 bg-slate-50/50">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <Search className="h-5 w-5 text-slate-600" />
                  <Label className="text-lg font-semibold text-slate-800">Search Fields</Label>
                </div>
                <Switch
                  checked={localFilters.searchFields.length > 0}
                  onCheckedChange={(checked) => {
                    if (!checked) {
                      handleLocalChange('searchFields', []);
                    } else {
                      handleLocalChange('searchFields', ['name']);
                    }
                  }}
                  data-testid="search-fields-switch"
                />
              </div>
              
              {localFilters.searchFields.length > 0 && (
                <div className="space-y-2">
                  {dictionaries?.vacancy_search_fields?.map(field => (
                    <div key={field.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`search-field-${field.id}`}
                        checked={localFilters.searchFields.includes(field.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            handleLocalChange('searchFields', [...localFilters.searchFields, field.id]);
                          } else {
                            handleLocalChange('searchFields', localFilters.searchFields.filter(id => id !== field.id));
                          }
                        }}
                        data-testid={`search-field-${field.id}-checkbox`}
                      />
                      <Label htmlFor={`search-field-${field.id}`} className="text-slate-700">
                        {field.name}
                      </Label>
                    </div>
                  ))}
                  {!dictionaries?.vacancy_search_fields?.length && (
                    <p className="text-slate-500 text-sm">No search fields available</p>
                  )}
                </div>
              )}
            </div>

            <div className="border border-slate-200 rounded-lg p-6 bg-slate-50/50">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <Building className="h-5 w-5 text-slate-600" />
                  <Label className="text-lg font-semibold text-slate-800">Employer Filter</Label>
                </div>
                <Switch
                  checked={!!localFilters.employerName}
                  onCheckedChange={(checked) => {
                    if (!checked) {
                      handleLocalChange('employerName', '');
                    }
                  }}
                  data-testid="employer-filter-switch"
                />
              </div>
              
              {(!!localFilters.employerName || localFilters.employerName === '') && (
                <div>
                  <Label className="block text-sm font-medium text-slate-700 mb-2" data-testid="employer-label">
                    Company Name
                  </Label>
                  <Input
                    type="text"
                    value={localFilters.employerName}
                    onChange={(e) => handleLocalChange('employerName', e.target.value)}
                    placeholder="e.g. Yandex, Google, Sber"
                    className="px-4 py-3 border border-slate-300 rounded-lg 
                               focus:ring-2 focus:ring-primary focus:border-transparent"
                    data-testid="employer-input"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Education Level Filter */}
          <div className="border border-slate-200 rounded-lg p-6 bg-slate-50/50">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <Filter className="h-5 w-5 text-slate-600" />
                <Label className="text-lg font-semibold text-slate-800">Education Level</Label>
              </div>
              <Switch
                checked={localFilters.enableEducationFilter}
                onCheckedChange={(checked) => 
                  setLocalFilters({...localFilters, enableEducationFilter: checked})
                }
                data-testid="education-filter-switch"
              />
            </div>
            
            {localFilters.enableEducationFilter && (
              <div>
                <Label className="block text-sm font-medium text-slate-700 mb-2">
                  Required Education Level
                </Label>
                <Select
                  value={localFilters.educationLevel}
                  onValueChange={(value) => setLocalFilters({
                    ...localFilters,
                    educationLevel: value
                  })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select education level" />
                  </SelectTrigger>
                  <SelectContent>
                    {dictionaries?.education_level?.map((level) => (
                      <SelectItem key={level.id} value={level.id}>
                        {level.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* Work Format Filter */}
          <div className="border border-slate-200 rounded-lg p-6 bg-slate-50/50">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <Filter className="h-5 w-5 text-slate-600" />
                <Label className="text-lg font-semibold text-slate-800">Work Format</Label>
              </div>
              <Switch
                checked={localFilters.enableWorkFormatFilter}
                onCheckedChange={(checked) => 
                  setLocalFilters({...localFilters, enableWorkFormatFilter: checked})
                }
                data-testid="work-format-filter-switch"
              />
            </div>
            
            {localFilters.enableWorkFormatFilter && (
              <div>
                <Label className="block text-sm font-medium text-slate-700 mb-3">
                  Work Schedule Options
                </Label>
                <div className="grid grid-cols-1 gap-2">
                  {dictionaries?.working_time_modes?.map((mode) => (
                    <div key={mode.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`work-format-${mode.id}`}
                        checked={localFilters.workFormats.includes(mode.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setLocalFilters({
                              ...localFilters,
                              workFormats: [...localFilters.workFormats, mode.id]
                            });
                          } else {
                            setLocalFilters({
                              ...localFilters,
                              workFormats: localFilters.workFormats.filter(id => id !== mode.id)
                            });
                          }
                        }}
                      />
                      <Label htmlFor={`work-format-${mode.id}`} className="text-sm">
                        {mode.name}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* General Search Settings */}
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label className="block text-sm font-medium text-slate-700 mb-2" data-testid="period-label">
                Posted in last
              </Label>
              <Select
                value={localFilters.period.toString()}
                onValueChange={(value) => handleLocalChange('period', parseInt(value))}
              >
                <SelectTrigger data-testid="period-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1" data-testid="period-1">1 day</SelectItem>
                  <SelectItem value="3" data-testid="period-3">3 days</SelectItem>
                  <SelectItem value="7" data-testid="period-7">1 week</SelectItem>
                  <SelectItem value="14" data-testid="period-14">2 weeks</SelectItem>
                  <SelectItem value="21" data-testid="period-21">3 weeks</SelectItem>
                  <SelectItem value="30" data-testid="period-30">1 month (maximum)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="block text-sm font-medium text-slate-700 mb-2" data-testid="order-label">
                Sort by
              </Label>
              <Select
                value={localFilters.orderBy}
                onValueChange={(value) => handleLocalChange('orderBy', value)}
              >
                <SelectTrigger data-testid="order-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {dictionaries?.vacancy_search_order?.map(order => (
                    <SelectItem key={order.id} value={order.id} data-testid={`order-${order.id}`}>
                      {order.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Search Options */}
        <div className="bg-slate-50 rounded-xl p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-slate-800 flex items-center">
              <Search className="mr-3 h-5 w-5 text-primary-600" />
              Search Options
            </h3>
            <Button
              type="button"
              onClick={() => setShowKeywordExpansion(true)}
              variant="outline"
              size="sm"
              className="flex items-center gap-2"
            >
              <Sparkles className="h-4 w-4" />
              Expand Keywords with AI
            </Button>
          </div>
          
          <div className="space-y-4">
            {/* Title-first toggle */}
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="title-first" className="text-sm font-medium text-slate-700">
                  Title-first search
                </Label>
                <p className="text-xs text-slate-500 mt-1">
                  Prioritize job title matches over description/skills (recommended)
                </p>
              </div>
              <Switch
                id="title-first"
                checked={localFilters.titleFirstSearch}
                onCheckedChange={(checked) => handleLocalChange('titleFirstSearch', checked)}
                data-testid="title-first-switch"
              />
            </div>
            
            {/* Exact phrases toggle */}
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="exact-phrases" className="text-sm font-medium text-slate-700">
                  Use exact phrases
                </Label>
                <p className="text-xs text-slate-500 mt-1">
                  Search for exact keyword phrases instead of individual words
                </p>
              </div>
              <Switch
                id="exact-phrases"
                checked={localFilters.useExactPhrases}
                onCheckedChange={(checked) => handleLocalChange('useExactPhrases', checked)}
                data-testid="exact-phrases-switch"
              />
            </div>
            
            {/* Skills tier company fallback toggle */}
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="skills-company-fallback" className="text-sm font-medium text-slate-700">
                  Use company_name fallback for Skills tier
                </Label>
                <p className="text-xs text-slate-500 mt-1">
                  Search company names when looking for skills matches (recommended)
                </p>
              </div>
              <Switch
                id="skills-company-fallback"
                checked={localFilters.useCompanyFallback !== false} // Default true
                onCheckedChange={(checked) => handleLocalChange('useCompanyFallback', checked)}
                data-testid="skills-company-fallback-switch"
              />
            </div>
            
            {/* Safe Mode toggle - temporary for diagnostics */}
            <div className="flex items-center justify-between border-2 border-orange-200 bg-orange-50 p-3 rounded-lg">
              <div>
                <Label htmlFor="safe-mode" className="text-sm font-medium text-orange-700">
                  🔧 Safe Mode (Diagnostics)
                </Label>
                <p className="text-xs text-orange-600 mt-1">
                  Temporary: Forces loose search settings to test if results appear
                </p>
              </div>
              <Switch
                id="safe-mode"
                checked={localFilters.safeMode}
                onCheckedChange={(checked) => handleLocalChange('safeMode', checked)}
                data-testid="safe-mode-switch"
              />
            </div>
            
            {/* Debug mode toggle */}
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="debug-mode" className="text-sm font-medium text-slate-700">
                  Debug mode
                </Label>
                <p className="text-xs text-slate-500 mt-1">
                  Show technical details about search requests (for developers)
                </p>
              </div>
              <Switch
                id="debug-mode"
                checked={localFilters.enableDebugMode}
                onCheckedChange={(checked) => handleLocalChange('enableDebugMode', checked)}
                data-testid="debug-mode-switch"
              />
            </div>
          </div>
        </div>

        {/* Navigation - Forward Only */}
        <div className="flex justify-end gap-4 mt-8">
          <Button
            type="button"
            onClick={handleSubmit}
            className="w-full max-w-md bg-primary-600 text-white py-3 px-6 rounded-xl font-semibold 
                       hover:bg-primary-700 transition-colors"
            data-testid="search-jobs-button"
          >
            Search Jobs
            <Search className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Keyword Expansion Modal */}
      <KeywordExpansionModal
        isOpen={showKeywordExpansion}
        onClose={() => setShowKeywordExpansion(false)}
        onApply={(expandedKeywords) => {
          // Convert string keywords back to keyword objects with source
          const keywordObjects = expandedKeywords.map(text => ({ 
            text, 
            verified: true, 
            source: 'ai' as const 
          }));
          setSelectedKeywords(keywordObjects);
        }}
        originalKeywords={selectedKeywords.map(k => k.text)}
      />
    </div>
  );
}
