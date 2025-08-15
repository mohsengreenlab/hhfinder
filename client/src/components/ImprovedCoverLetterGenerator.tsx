import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { 
  X, 
  Copy, 
  Download,
  Sparkles,
  RefreshCw,
  Trash2,
  AlertCircle
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import LoadingLines from "@/components/LoadingLines";

interface SavedPrompt {
  id: number;
  name: string;
  prompt: string;
  createdAt: string;
}

interface UserSettings {
  lastUsedPromptType?: string;
  lastUsedPromptId?: number;
  lastUsedCustomPrompt?: string;
}

interface VacancyDetails {
  id: string;
  name: string;
  employerName?: string;
  areaName?: string;
  skillsList?: string[];
  plainDescription?: string;
}

interface ImprovedCoverLetterGeneratorProps {
  vacancy: VacancyDetails;
  onClose: () => void;
}

const defaultPrompts = {
  default: "Write a professional cover letter that highlights relevant experience and skills",
  technical: "Focus on technical skills and problem-solving abilities",
  creative: "Emphasize creativity, innovation, and unique approaches to challenges"
};

export function ImprovedCoverLetterGenerator({ vacancy, onClose }: ImprovedCoverLetterGeneratorProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // State management
  const [selectedPromptType, setSelectedPromptType] = useState<string>('default');
  const [customPromptText, setCustomPromptText] = useState('');
  const [coverLetterText, setCoverLetterText] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [savePromptName, setSavePromptName] = useState('');
  const [promptToDelete, setPromptToDelete] = useState<SavedPrompt | null>(null);
  const [showPromptPreview, setShowPromptPreview] = useState(false);

  // Fetch saved prompts
  const { data: savedPrompts = [], refetch: refetchPrompts } = useQuery({
    queryKey: ['/api/saved-prompts'],
    queryFn: async () => {
      const response = await fetch('/api/saved-prompts', {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to fetch prompts');
      return response.json() as Promise<SavedPrompt[]>;
    }
  });

  // Fetch user settings
  const { data: userSettings } = useQuery({
    queryKey: ['/api/user-settings'],
    queryFn: async () => {
      const response = await fetch('/api/user-settings', {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to fetch settings');
      return response.json() as Promise<UserSettings | null>;
    }
  });

  // Save prompt mutation
  const savePromptMutation = useMutation({
    mutationFn: async (data: { name: string; prompt: string }) => {
      const response = await fetch('/api/saved-prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        credentials: 'include'
      });
      if (!response.ok) {
        const error = await response.json();
        throw { status: response.status, ...error };
      }
      return response.json();
    },
    onSuccess: (newPrompt: SavedPrompt) => {
      toast({ title: "Prompt saved successfully!" });
      refetchPrompts();
      setShowSaveDialog(false);
      setSavePromptName('');
      
      // Automatically select the newly saved prompt as the active choice
      const newPromptValue = `saved-${newPrompt.id}`;
      setSelectedPromptType(newPromptValue);
      
      // Update user settings to remember this as the last used prompt
      const newSettings: UserSettings = {
        lastUsedPromptType: newPromptValue,
        lastUsedPromptId: newPrompt.id
      };
      saveSettingsMutation.mutate(newSettings);
    },
    onError: (error: any) => {
      if (error.status === 409) {
        toast({ 
          title: "Prompt name already exists", 
          description: "Please choose a different name.",
          variant: "destructive" 
        });
      } else {
        toast({ 
          title: "Failed to save prompt", 
          description: "Please try again.",
          variant: "destructive" 
        });
      }
    }
  });

  // Delete prompt mutation
  const deletePromptMutation = useMutation({
    mutationFn: async (promptId: number) => {
      const response = await fetch(`/api/saved-prompts/${promptId}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to delete prompt');
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Prompt deleted successfully!" });
      refetchPrompts();
      setPromptToDelete(null);
    },
    onError: () => {
      toast({ 
        title: "Failed to delete prompt", 
        description: "Please try again.",
        variant: "destructive" 
      });
    }
  });

  // Save user settings mutation
  const saveSettingsMutation = useMutation({
    mutationFn: async (settings: UserSettings) => {
      const response = await fetch('/api/user-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to save settings');
      return response.json();
    },
    onError: () => {
      // Silently fail - this is not critical
      console.warn('Failed to save user settings');
    }
  });

  // Build the exact AI prompt that will be sent to Gemini
  const buildFinalPrompt = () => {
    if (!vacancy) return '';
    
    const systemPrompt = `You write concise, polite cover letters in English for real job applicants.

Requirements:
- 150-220 words
- 3 short paragraphs
- Mention 2-4 relevant skills
- Include 1 specific fact from the job posting
- No fluff or clichés
- Professional tone`;

    let userPrompt = '';
    
    const jobInfo = {
      position: vacancy.name,
      company: vacancy.employerName || 'the company',
      location: vacancy.areaName || 'location not specified',
      skills: vacancy.skillsList?.join(', ') || 'skills not specified',
      description: vacancy.plainDescription?.substring(0, 1000) || 'description not available'
    };

    switch (selectedPromptType) {
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
        userPrompt = customPromptText
          .replace(/\{\{POSITION\}\}/g, vacancy.name || 'the position')
          .replace(/\{\{COMPANY\}\}/g, vacancy.employerName || 'the company')
          .replace(/\{\{LOCATION\}\}/g, vacancy.areaName || 'location not specified')
          .replace(/\{\{SKILLS\}\}/g, vacancy.skillsList?.join(', ') || 'skills not specified')
          .replace(/\{\{DESCRIPTION\}\}/g, vacancy.plainDescription?.substring(0, 1500) || 'description not available');
        
        // Return only user prompt for custom templates
        return userPrompt;
        
      default:
        // Check if it's a saved prompt
        const savedPrompt = savedPrompts.find(p => p.name === selectedPromptType);
        if (savedPrompt) {
          userPrompt = savedPrompt.prompt
            .replace(/\{\{POSITION\}\}/g, vacancy.name || 'the position')
            .replace(/\{\{COMPANY\}\}/g, vacancy.employerName || 'the company')
            .replace(/\{\{LOCATION\}\}/g, vacancy.areaName || 'location not specified')
            .replace(/\{\{SKILLS\}\}/g, vacancy.skillsList?.join(', ') || 'skills not specified')
            .replace(/\{\{DESCRIPTION\}\}/g, vacancy.plainDescription?.substring(0, 1500) || 'description not available');
          
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

  // Generate cover letter mutation
  const generateMutation = useMutation({
    mutationFn: async (prompt: string) => {
      const requestData = {
        name: vacancy.name,
        employerName: vacancy.employerName || 'Company',
        areaName: vacancy.areaName || 'Location',
        skillsList: vacancy.skillsList || [],
        plainDescription: vacancy.plainDescription || '',
        customPrompt: prompt
      };
      
      const response = await fetch('/api/cover-letter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestData),
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to generate cover letter');
      return response.json() as Promise<{ text: string }>;
    },
    onSuccess: (data) => {
      setCoverLetterText(data.text);
      setIsGenerating(false);
      
      // Smooth scroll to the generated cover letter result
      setTimeout(() => {
        const coverLetterOutput = document.querySelector('[data-testid="cover-letter-output"]');
        if (coverLetterOutput) {
          coverLetterOutput.scrollIntoView({
            behavior: 'smooth',
            block: 'start',
            inline: 'nearest'
          });
        }
      }, 200);
    },
    onError: (error) => {
      setIsGenerating(false);
      toast({ 
        title: "Failed to generate cover letter", 
        description: "Please try again or check your internet connection.",
        variant: "destructive" 
      });
      console.error('Cover letter generation error:', error);
    }
  });

  // Load user settings on mount and prioritize saved prompts
  useEffect(() => {
    // Always prioritize saved prompts if they exist
    if (savedPrompts.length > 0) {
      const firstPrompt = savedPrompts[0];
      const promptValue = `saved-${firstPrompt.id}`;
      
      // Check if the user's last used prompt is still valid (exists in saved prompts)
      let shouldUseFirstPrompt = true;
      
      if (userSettings?.lastUsedPromptType?.startsWith('saved-')) {
        const promptId = parseInt(userSettings.lastUsedPromptType.replace('saved-', ''));
        const existingPrompt = savedPrompts.find(p => p.id === promptId);
        if (existingPrompt) {
          // User's last prompt still exists, use it
          setSelectedPromptType(userSettings.lastUsedPromptType);
          setCustomPromptText(existingPrompt.prompt);
          shouldUseFirstPrompt = false;
        }
      }
      
      // If no valid saved prompt preference, use the first saved prompt
      if (shouldUseFirstPrompt) {
        setSelectedPromptType(promptValue);
        setCustomPromptText(firstPrompt.prompt);
        
        // Update user settings to remember this choice
        const newSettings: UserSettings = {
          lastUsedPromptType: promptValue,
          lastUsedPromptId: firstPrompt.id
        };
        saveSettingsMutation.mutate(newSettings);
      }
    }
    // Only fall back to user settings if no saved prompts exist
    else if (userSettings?.lastUsedPromptType) {
      setSelectedPromptType(userSettings.lastUsedPromptType);
      if (userSettings.lastUsedCustomPrompt && userSettings.lastUsedPromptType === 'custom') {
        setCustomPromptText(userSettings.lastUsedCustomPrompt);
      }
    }
  }, [userSettings, savedPrompts]);

  // Save user settings when prompt type or text changes
  useEffect(() => {
    const settings: UserSettings = {
      lastUsedPromptType: selectedPromptType,
      lastUsedCustomPrompt: selectedPromptType === 'custom' ? customPromptText : undefined
    };
    
    if (selectedPromptType.startsWith('saved-')) {
      settings.lastUsedPromptId = parseInt(selectedPromptType.replace('saved-', ''));
    }
    
    saveSettingsMutation.mutate(settings);
  }, [selectedPromptType, customPromptText]);

  const getCurrentPromptText = (): string => {
    if (selectedPromptType === 'custom') {
      return customPromptText;
    } else if (selectedPromptType.startsWith('saved-')) {
      const promptId = parseInt(selectedPromptType.replace('saved-', ''));
      const savedPrompt = savedPrompts.find(p => p.id === promptId);
      return savedPrompt?.prompt || '';
    } else {
      return defaultPrompts[selectedPromptType as keyof typeof defaultPrompts] || defaultPrompts.default;
    }
  };

  const handlePromptTypeChange = (value: string) => {
    setSelectedPromptType(value);
    
    if (value.startsWith('saved-')) {
      const promptId = parseInt(value.replace('saved-', ''));
      const savedPrompt = savedPrompts.find(p => p.id === promptId);
      if (savedPrompt) {
        setCustomPromptText(savedPrompt.prompt);
      }
    } else if (value !== 'custom') {
      setCustomPromptText('');
    }
  };

  const handleGenerate = async () => {
    // Use buildFinalPrompt() which handles templates, placeholders, and system prompts correctly
    const promptText = buildFinalPrompt();
    if (!promptText.trim()) {
      toast({ 
        title: "Please enter a prompt", 
        description: "Write some instructions for your cover letter.",
        variant: "destructive" 
      });
      return;
    }

    setIsGenerating(true);
    generateMutation.mutate(promptText);
    
    // Smooth scroll to show the cover letter generation area after clicking generate
    setTimeout(() => {
      const coverLetterSection = document.querySelector('[data-testid="cover-letter-section"]');
      if (coverLetterSection) {
        const rect = coverLetterSection.getBoundingClientRect();
        const offset = window.pageYOffset + rect.bottom - window.innerHeight + 100;
        window.scrollTo({
          top: Math.max(0, offset),
          behavior: 'smooth'
        });
      }
    }, 100);
  };

  const handleSavePrompt = () => {
    const currentText = selectedPromptType === 'custom' ? customPromptText : getCurrentPromptText();
    if (!currentText.trim()) {
      toast({ 
        title: "No prompt to save", 
        description: "Please write a custom prompt first.",
        variant: "destructive" 
      });
      return;
    }
    setShowSaveDialog(true);
  };

  const confirmSavePrompt = () => {
    const currentText = selectedPromptType === 'custom' ? customPromptText : getCurrentPromptText();
    if (savePromptName.trim() && currentText.trim()) {
      savePromptMutation.mutate({
        name: savePromptName.trim(),
        prompt: currentText
      });
    }
  };

  const insertPlaceholder = (placeholder: string) => {
    const textarea = document.querySelector('[data-testid="custom-prompt-textarea"]') as HTMLTextAreaElement;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newValue = customPromptText.substring(0, start) + placeholder + customPromptText.substring(end);
      setCustomPromptText(newValue);
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + placeholder.length, start + placeholder.length);
      }, 0);
    }
  };

  const copyToClipboard = async () => {
    if (coverLetterText) {
      await navigator.clipboard.writeText(coverLetterText);
      toast({ title: "Cover letter copied to clipboard!" });
    }
  };

  const copyPromptToClipboard = async () => {
    const finalPrompt = buildFinalPrompt();
    if (finalPrompt) {
      await navigator.clipboard.writeText(finalPrompt);
      toast({ title: "AI prompt copied to clipboard!" });
    }
  };

  const downloadAsText = () => {
    if (coverLetterText) {
      const blob = new Blob([coverLetterText], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cover-letter-${vacancy.name.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({ title: "Cover letter downloaded!" });
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-lg p-8 animate-fade-in" data-testid="cover-letter-section">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-semibold text-slate-800">AI Cover Letter Generator</h3>
          <Button
            onClick={onClose}
            variant="ghost"
            size="sm"
            data-testid="close-cover-letter-button"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-slate-600">Generate a personalized cover letter for this position using AI</p>
      </div>

      {/* Prompt Selection and Management */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-slate-700 mb-2">
          Choose your prompt template
        </label>
        
        <div className="space-y-3">
          <Select value={selectedPromptType} onValueChange={handlePromptTypeChange}>
            <SelectTrigger data-testid="prompt-template-select">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {/* Saved prompts appear at the top */}
              {savedPrompts.map(prompt => (
                <SelectItem key={`saved-${prompt.id}`} value={`saved-${prompt.id}`}>
                  📝 {prompt.name}
                </SelectItem>
              ))}
              {/* Built-in templates below saved prompts */}
              <SelectItem value="default">Default Template</SelectItem>
              <SelectItem value="technical">Technical Focus</SelectItem>
              <SelectItem value="creative">Creative Approach</SelectItem>
              <SelectItem value="custom">Custom Prompt</SelectItem>
            </SelectContent>
          </Select>

          {/* Prompt Preview Toggle */}
          <div className="flex items-center gap-2 mt-3">
            <Button
              onClick={() => setShowPromptPreview(!showPromptPreview)}
              variant="outline"
              size="sm"
              className="text-xs"
            >
              {showPromptPreview ? 'Hide AI prompt' : 'Show AI prompt'}
            </Button>
            <span className="text-xs text-slate-500">See the exact text sent to AI</span>
          </div>

          {/* Prompt Preview */}
          {showPromptPreview && (
            <div className="mt-3 p-3 bg-slate-50 rounded-lg border">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-slate-700">Final AI Prompt (with placeholders filled)</span>
                <Button
                  onClick={copyPromptToClipboard}
                  variant="ghost"
                  size="sm"
                  className="text-xs h-6"
                >
                  <Copy className="h-3 w-3 mr-1" />
                  Copy
                </Button>
              </div>
              <div className="bg-white rounded border p-3 max-h-48 overflow-y-auto">
                <pre className="text-xs text-slate-600 whitespace-pre-wrap font-mono leading-relaxed">
                  {buildFinalPrompt()}
                </pre>
              </div>
            </div>
          )}

          {/* Custom prompt textarea */}
          {(selectedPromptType === 'custom' || selectedPromptType.startsWith('saved-')) && (
            <div>
              <Textarea
                value={customPromptText}
                onChange={(e) => setCustomPromptText(e.target.value)}
                placeholder="Write your custom instructions for the cover letter..."
                className="h-32 text-sm"
                data-testid="custom-prompt-textarea"
              />
              
              {/* Clickable Placeholders */}
              <div className="flex flex-wrap gap-1 mt-2 mb-3">
                {['{{POSITION}}', '{{COMPANY}}', '{{LOCATION}}', '{{SKILLS}}', '{{DESCRIPTION}}'].map(placeholder => (
                  <button
                    key={placeholder}
                    onClick={() => insertPlaceholder(placeholder)}
                    className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs border transition-colors"
                  >
                    {placeholder}
                  </button>
                ))}
              </div>

              {/* Single Save Button */}
              <div className="flex items-center gap-2">
                <Button
                  onClick={handleSavePrompt}
                  variant="outline"
                  size="sm"
                  className="text-sm"
                  disabled={savePromptMutation.isPending || !customPromptText.trim()}
                >
                  Save your prompt
                </Button>

                {/* Delete button for saved prompts */}
                {selectedPromptType.startsWith('saved-') && (
                  <Button
                    onClick={() => {
                      const promptId = parseInt(selectedPromptType.replace('saved-', ''));
                      const prompt = savedPrompts.find(p => p.id === promptId);
                      if (prompt) setPromptToDelete(prompt);
                    }}
                    variant="outline"
                    size="sm"
                    className="text-sm text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="h-3 w-3 mr-1" />
                    Delete
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Generate Button */}
      <div className="mb-6">
        <Button
          onClick={handleGenerate}
          disabled={isGenerating || generateMutation.isPending}
          className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white"
        >
          {isGenerating || generateMutation.isPending ? (
            <>
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Sparkles className="mr-2 h-4 w-4" />
              Generate Cover Letter
            </>
          )}
        </Button>
      </div>

      {/* Cover Letter Output */}
      {(generateMutation.isPending || isGenerating) && (
        <div className="mb-6">
          <LoadingLines count={8} />
          <p className="text-sm text-slate-600 mt-2 text-center">AI is crafting your personalized cover letter...</p>
        </div>
      )}

      {coverLetterText && !generateMutation.isPending && !isGenerating && (
        <div className="mb-6" data-testid="cover-letter-output">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-lg font-medium text-slate-800">Your Cover Letter</h4>
            <div className="flex gap-2">
              <Button onClick={copyToClipboard} variant="outline" size="sm">
                <Copy className="mr-2 h-3 w-3" />
                Copy
              </Button>
              <Button onClick={downloadAsText} variant="outline" size="sm">
                <Download className="mr-2 h-3 w-3" />
                Download
              </Button>
            </div>
          </div>
          <div className="bg-slate-50 rounded-lg p-4 border max-h-96 overflow-y-auto">
            <div className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
              {coverLetterText}
            </div>
          </div>
        </div>
      )}

      {/* Save Prompt Dialog */}
      <AlertDialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Save your prompt</AlertDialogTitle>
            <AlertDialogDescription>
              Give your prompt a name so you can reuse it later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Input
              value={savePromptName}
              onChange={(e) => setSavePromptName(e.target.value)}
              placeholder="e.g., Technical Focus, Creative Style..."
              onKeyPress={(e) => e.key === 'Enter' && confirmSavePrompt()}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowSaveDialog(false)}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmSavePrompt}
              disabled={!savePromptName.trim() || savePromptMutation.isPending}
            >
              {savePromptMutation.isPending ? 'Saving...' : 'Save Prompt'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Prompt Confirmation */}
      <AlertDialog open={!!promptToDelete} onOpenChange={() => setPromptToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete prompt</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{promptToDelete?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPromptToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => promptToDelete && deletePromptMutation.mutate(promptToDelete.id)}
              className="bg-red-600 hover:bg-red-700"
              disabled={deletePromptMutation.isPending}
            >
              {deletePromptMutation.isPending ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}