import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { PlusCircle, LogOut, Settings, Trash2, Clock, Calendar } from "lucide-react";
import { useWizardStore } from "@/state/wizard";
import LoadingLines from "@/components/LoadingLines";
import { useToast } from "@/hooks/use-toast";

interface User {
  id: number;
  username: string;
  isAdmin: boolean;
}

interface JobApplication {
  id: number;
  title: string;
  currentStep: number;
  lastEditedAt: string;
  isCompleted: boolean;
  selectedKeywords: string[];
  suggestedKeywords: string[];
  filters: Record<string, any>;
  currentVacancyIndex: number;
  vacancies: any[];
  searchResults: any[];
  totalVacancies: number;
}

interface DashboardProps {
  user: User;
  onLogout: () => void;
  onStartNewApplication: () => void;
  onContinueApplication: (application: JobApplication) => void;
  onAdminPanel: () => void;
}

export function Dashboard({ 
  user, 
  onLogout, 
  onStartNewApplication, 
  onContinueApplication,
  onAdminPanel 
}: DashboardProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const { data: applications, isLoading } = useQuery<JobApplication[]>({
    queryKey: ["/api/applications"],
    staleTime: 30000 // Cache for 30 seconds
  });

  // Delete application mutation
  const deleteApplicationMutation = useMutation({
    mutationFn: async (applicationId: number) => {
      const response = await fetch(`/api/applications/${applicationId}`, {
        method: 'DELETE'
      });
      if (!response.ok) {
        throw new Error('Failed to delete application');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/applications"] });
      toast({ description: "Application deleted successfully" });
    },
    onError: () => {
      toast({ 
        title: "Error", 
        description: "Failed to delete application",
        variant: "destructive" 
      });
    }
  });

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStepName = (step: number) => {
    switch (step) {
      case 1: return "Keywords";
      case 2: return "Confirmation";
      case 3: return "Filters";
      case 4: return "Results";
      default: return "Unknown";
    }
  };

  const handleDeleteApplication = (applicationId: number) => {
    if (window.confirm('Are you sure you want to delete this job search? This action cannot be undone.')) {
      deleteApplicationMutation.mutate(applicationId);
    }
  };

  const getStepProgress = (step: number) => {
    const steps = [
      { number: 1, name: "Keywords", color: "bg-blue-500" },
      { number: 2, name: "Confirm", color: "bg-green-500" },
      { number: 3, name: "Filters", color: "bg-yellow-500" },
      { number: 4, name: "Results", color: "bg-purple-500" }
    ];
    
    return steps.map(s => ({
      ...s,
      isActive: s.number === step,
      isCompleted: s.number < step
    }));
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="border-b bg-white dark:bg-gray-800">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Job Search Assistant
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Welcome back, {user.username}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {user.isAdmin && (
              <Button variant="outline" onClick={onAdminPanel}>
                <Settings className="mr-2 h-4 w-4" />
                Admin
              </Button>
            )}
            <Button variant="outline" onClick={onLogout}>
              <LogOut className="mr-2 h-4 w-4" />
              Log Out
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="grid gap-6">
          {/* Quick Actions */}
          <div className="grid gap-4">
            {/* Start New Search */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PlusCircle className="h-5 w-5 text-green-600" />
                  Start New Job Search
                </CardTitle>
                <CardDescription>
                  Begin a new AI-powered job search with keyword suggestions and smart filtering
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button onClick={onStartNewApplication} className="w-full bg-green-600 hover:bg-green-700">
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Start New Search
                </Button>
              </CardContent>
            </Card>
          </div>

          <Separator />

          {/* My Applications Section */}
          <div>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">My Applications</h2>
                <p className="text-gray-600 dark:text-gray-400">
                  All your job searches are automatically saved. Click any search to continue where you left off.
                </p>
              </div>
            </div>

            {isLoading ? (
              <div className="space-y-4">
                <LoadingLines count={3} />
              </div>
            ) : !applications || applications.length === 0 ? (
              <Card>
                <CardContent className="text-center py-12">
                  <div className="text-gray-500 dark:text-gray-400 mb-4">
                    <Calendar className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p className="text-lg">No saved searches yet</p>
                    <p className="text-sm">Start your first job search to see it appear here</p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {applications.map((app) => (
                  <Card key={app.id} className="hover:shadow-md transition-shadow">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="text-lg">{app.title}</CardTitle>
                          <CardDescription className="mt-1">
                            <div className="flex items-center gap-4 text-sm">
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {formatDate(app.lastEditedAt)}
                              </span>
                              {app.currentVacancyIndex > 0 && (
                                <span>
                                  Viewing vacancy {app.currentVacancyIndex + 1}
                                  {app.vacancies?.length && ` of ${app.vacancies.length}`}
                                </span>
                              )}
                            </div>
                          </CardDescription>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteApplication(app.id)}
                          disabled={deleteApplicationMutation.isPending}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {/* Progress Steps */}
                        <div className="flex items-center space-x-2">
                          {getStepProgress(app.currentStep).map((step, index) => (
                            <div key={step.number} className="flex items-center">
                              <div 
                                className={`
                                  w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium text-white
                                  ${step.isActive ? step.color : 
                                    step.isCompleted ? 'bg-gray-400' : 'bg-gray-200'}
                                `}
                              >
                                {step.number}
                              </div>
                              {index < 3 && (
                                <div 
                                  className={`w-8 h-0.5 ${
                                    step.isCompleted ? 'bg-gray-400' : 'bg-gray-200'
                                  }`} 
                                />
                              )}
                            </div>
                          ))}
                        </div>

                        {/* Keywords */}
                        {app.selectedKeywords && app.selectedKeywords.length > 0 && (
                          <div>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Keywords:</p>
                            <div className="flex flex-wrap gap-1">
                              {app.selectedKeywords.slice(0, 3).map((keyword, index) => (
                                <Badge key={index} variant="secondary" className="text-xs">
                                  {keyword}
                                </Badge>
                              ))}
                              {app.selectedKeywords.length > 3 && (
                                <Badge variant="outline" className="text-xs">
                                  +{app.selectedKeywords.length - 3} more
                                </Badge>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Continue Button */}
                        <Button 
                          onClick={() => onContinueApplication(app)}
                          className="w-full"
                          variant={app.currentStep === 4 ? "default" : "outline"}
                        >
                          {app.currentStep === 4 ? (
                            "Continue Browsing Vacancies"
                          ) : (
                            `Continue from Step ${app.currentStep}`
                          )}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}