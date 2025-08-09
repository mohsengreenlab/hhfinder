import { useWizardStore } from '@/state/wizard';
import Step1Keywords from '@/steps/Step1Keywords';
import Step2Confirm from '@/steps/Step2Confirm';
import Step3Filters from '@/steps/Step3Filters';
import Step4Viewer from '@/steps/Step4Viewer';
import TransitionLoader from '@/components/TransitionLoader';

export default function Home() {
  const { currentStep, isTransitioning, transitionFrom, transitionTo, completeTransition } = useWizardStore();

  // Show transition loader during transitions
  if (isTransitioning && transitionFrom && transitionTo) {
    return (
      <TransitionLoader
        fromStep={transitionFrom}
        toStep={transitionTo}
        onComplete={completeTransition}
        duration={4000}
      />
    );
  }

  const renderStep = () => {
    switch (currentStep) {
      case 'keywords':
        return <Step1Keywords />;
      case 'confirm':
        return <Step2Confirm />;
      case 'filters':
        return <Step3Filters />;
      case 'results':
        return <Step4Viewer />;
      default:
        return <Step1Keywords />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      {renderStep()}
    </div>
  );
}
