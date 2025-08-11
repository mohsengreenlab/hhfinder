import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { PlayCircle, PlusCircle, History, LogOut, Settings } from "lucide-react";
import { useWizardStore } from "@/state/wizard";
import LoadingLines from "@/components/LoadingLines";

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
  const [showApplications, setShowApplications] = useState(false);
  
  const { data: applications, isLoading } = useQuery<JobApplication[]>({
    queryKey: ["/api/applications"],
    enabled: showApplications
  });

  const { data: latestApplication } = useQuery<JobApplication | null>({
    queryKey: ["/api/applications/latest"]
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

  const handleContinueLatest = () => {
    if (latestApplication) {
      onContinueApplication(latestApplication);
    }
  };

  const handleViewApplications = () => {
    setShowApplications(true);
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
          <div className="grid md:grid-cols-2 gap-4">
            {/* Continue Latest */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PlayCircle className="h-5 w-5 text-blue-600" />
                  Continue Your Search
                </CardTitle>
                {latestApplication ? (
                  <CardDescription>
                    "{latestApplication.title}" - Step {latestApplication.currentStep} ({getStepName(latestApplication.currentStep)})
                    <br />
                    <span className="text-xs text-gray-500">
                      Last edited {formatDate(latestApplication.lastEditedAt)}
                    </span>
                  </CardDescription>
                ) : (
                  <CardDescription>
                    No previous application found yet
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent>
                <Button 
                  onClick={handleContinueLatest}
                  disabled={!latestApplication}
                  className="w-full"
                >
                  {latestApplication ? 'Continue Application' : 'No Previous Work'}
                </Button>
              </CardContent>
            </Card>

            {/* Start New */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PlusCircle className="h-5 w-5 text-green-600" />
                  Start a New Search
                </CardTitle>
                <CardDescription>
                  Begin a fresh job search from scratch
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button onClick={onStartNewApplication} className="w-full">
                  Start New Search
                </Button>
              </CardContent>
            </Card>
          </div>

          <Separator />

          {/* My Applications */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5 text-purple-600" />
                My Applications
              </CardTitle>
              <CardDescription>
                View and manage your past job searches
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!showApplications ? (
                <Button onClick={handleViewApplications} variant="outline" className="w-full">
                  View All Applications
                </Button>
              ) : isLoading ? (
                <LoadingLines count={3} />
              ) : applications && applications.length > 0 ? (
                <div className="space-y-3">
                  {applications.map((app: JobApplication) => (
                    <div key={app.id} className="border rounded-lg p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium">{app.title}</h4>
                        <div className="flex items-center gap-2">
                          <Badge variant={app.isCompleted ? "default" : "secondary"}>
                            {app.isCompleted ? 'Completed' : `Step ${app.currentStep}`}
                          </Badge>
                        </div>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Keywords: {app.selectedKeywords.join(", ") || "None"}
                      </p>
                      <p className="text-xs text-gray-500">
                        Last edited {formatDate(app.lastEditedAt)}
                      </p>
                      <div className="flex gap-2 pt-2">
                        <Button
                          size="sm"
                          onClick={() => onContinueApplication(app)}
                        >
                          Continue
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            // Create a similar search based on this application
                            const newApp = {
                              ...app,
                              id: 0, // Will be assigned by server
                              title: `Similar to "${app.title}"`,
                              currentStep: 1,
                              isCompleted: false,
                              lastEditedAt: new Date().toISOString()
                            };
                            onContinueApplication(newApp);
                          }}
                        >
                          Start Similar Search
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-gray-500 py-8">
                  No applications found yet. Start your first job search!
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}