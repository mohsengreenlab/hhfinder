import { useState, useEffect } from 'react';
import { ArrowLeft, Search, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useQuery } from '@tanstack/react-query';
import Combobox from '@/components/Combobox';
import { useWizardStore } from '@/state/wizard';
import { HHDictionaries, HHArea } from '@/types/api';

export default function Step3Filters() {
  const { filters, setFilters, goBack, goNext } = useWizardStore();
  
  // Local form state
  const [localFilters, setLocalFilters] = useState(filters);

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
    setLocalFilters(prev => ({ ...prev, [key]: value }));
  };

  const handleSubmit = () => {
    setFilters(localFilters);
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
            Set your preferences to find the perfect match
          </p>
        </div>

        <div className="grid gap-6">
          {/* Location */}
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label className="block text-sm font-medium text-slate-700 mb-2" data-testid="location-label">
                Location
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
                <MapPin className="absolute right-3 top-4 h-5 w-5 text-slate-400 pointer-events-none" />
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

          {/* Experience */}
          <div>
            <Label className="block text-sm font-medium text-slate-700 mb-3" data-testid="experience-label">
              Experience Level
            </Label>
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
          </div>

          {/* Employment & Schedule */}
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <Label className="block text-sm font-medium text-slate-700 mb-3" data-testid="employment-label">
                Employment Type
              </Label>
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
            </div>
            <div>
              <Label className="block text-sm font-medium text-slate-700 mb-3" data-testid="schedule-label">
                Schedule
              </Label>
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
            </div>
          </div>

          {/* Salary */}
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

          {/* Additional Filters */}
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
                  <SelectItem value="30" data-testid="period-30">1 month</SelectItem>
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

        {/* Navigation */}
        <div className="flex gap-4 mt-8">
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
            onClick={handleSubmit}
            className="flex-1 bg-primary-600 text-white py-3 px-6 rounded-xl font-semibold 
                       hover:bg-primary-700 transition-colors"
            data-testid="search-jobs-button"
          >
            Search Jobs
            <Search className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
