import { useState } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/use-auth";
import { useWizardStore } from "@/state/wizard";
import { LoginForm } from "@/components/LoginForm";
import { Dashboard } from "@/components/Dashboard";
import { AdminPanel } from "@/components/AdminPanel";
import Home from "@/pages/Home";
import LoadingLines from "@/components/LoadingLines";

interface JobApplication {
  id: number;
  title: string;
  currentStep: number;
  selectedKeywords: string[];
  suggestedKeywords: string[];
  filters: Record<string, any>;
  currentVacancyIndex: number;
  vacancies: any[];
  totalVacancies: number;
  lastEditedAt: string;
  isCompleted: boolean;
}

interface User {
  id: number;
  username: string;
  isAdmin: boolean;
}

type AppState = 'dashboard' | 'admin' | 'wizard';

function AuthenticatedApp() {
  const { user, isAuthenticated, isLoading, logout, setUser } = useAuth();
  const [appState, setAppState] = useState<AppState>('dashboard');
  const queryClientInstance = useQueryClient();
  const { 
    setCurrentStep, 
    setSelectedKeywords, 
    setSuggestedKeywords, 
    setFilters, 
    setCurrentVacancyIndex, 
    setVacancies, 
    setSearchResults,
    setCurrentApplicationId,
    appliedVacancyIds,
    markVacancyAsApplied,
    reset,
    restoreSearchState
  } = useWizardStore();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center space-y-4">
          <LoadingLines count={3} />
          <p className="text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginForm onSuccess={setUser} />;
  }

  const handleStartNewApplication = () => {
    // Clear all cached data before starting a new search
    queryClientInstance.invalidateQueries();
    queryClientInstance.clear();
    
    reset();
    setCurrentStep(1);
    setAppState('wizard');
  };

  const handleContinueApplication = (application: JobApplication) => {
    console.log('🔄 Continuing application:', application.title);
    
    // Clear all cached data before loading a different application
    queryClientInstance.invalidateQueries();
    queryClientInstance.clear();
    
    // First completely reset state to ensure clean slate
    reset();
    
    // Set the application ID and step first
    setCurrentApplicationId(application.id);
    setCurrentStep(application.currentStep);
    setSuggestedKeywords(application.suggestedKeywords || []);
    
    // Use the new restore method that properly handles search signatures
    const signature = restoreSearchState(application);
    
    console.log('🔄 Application restored with search signature:', signature);
    console.log('🔄 Will navigate to step:', application.currentStep);
    
    setAppState('wizard');
  };

  const handleBackToDashboard = () => {
    setAppState('dashboard');
  };

  const handleAdminPanel = () => {
    setAppState('admin');
  };

  switch (appState) {
    case 'admin':
      return <AdminPanel onBack={handleBackToDashboard} />;
    case 'wizard':
      return <Home onBackToDashboard={handleBackToDashboard} />;
    case 'dashboard':
    default:
      return (
        <Dashboard
          user={user as User}
          onLogout={logout}
          onStartNewApplication={handleStartNewApplication}
          onContinueApplication={handleContinueApplication}
          onAdminPanel={handleAdminPanel}
        />
      );
  }
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <AuthenticatedApp />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
