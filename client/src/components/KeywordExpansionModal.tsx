import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Loader2, Sparkles, CheckCircle } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';

interface ExpansionPreview {
  exactPhrases: { text: string; enabled: boolean }[];
  strongSynonyms: { text: string; enabled: boolean }[];
  weakSynonyms: { text: string; enabled: boolean }[];
}

interface KeywordExpansionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (selectedKeywords: string[]) => void;
  originalKeywords: string[];
}

export default function KeywordExpansionModal({ 
  isOpen, 
  onClose, 
  onApply, 
  originalKeywords 
}: KeywordExpansionModalProps) {
  const [preview, setPreview] = useState<ExpansionPreview | null>(null);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

  const expandKeywordsMutation = useMutation({
    mutationFn: async (keywords: string[]) => {
      const response = await fetch('/api/keywords/expand', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keywords })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to expand keywords');
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      setPreview(data.preview);
      // Pre-select exact phrases and strong synonyms
      const initialSelected = new Set([
        ...data.preview.exactPhrases.filter((item: any) => item.enabled).map((item: any) => item.text),
        ...data.preview.strongSynonyms.filter((item: any) => item.enabled).map((item: any) => item.text)
      ]);
      setSelectedItems(initialSelected);
    }
  });

  const handleExpand = () => {
    expandKeywordsMutation.mutate(originalKeywords);
  };

  const toggleItem = (text: string) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(text)) {
      newSelected.delete(text);
    } else {
      newSelected.add(text);
    }
    setSelectedItems(newSelected);
  };

  const handleApply = () => {
    const selectedKeywords = Array.from(selectedItems);
    onApply(selectedKeywords);
    onClose();
  };

  const handleClose = () => {
    setPreview(null);
    setSelectedItems(new Set());
    expandKeywordsMutation.reset();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5" />
            Keyword Expansion with AI
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div className="text-sm text-muted-foreground">
            Generate relevant synonyms and variations for your keywords to find more job opportunities.
          </div>

          {!preview && !expandKeywordsMutation.isPending && (
            <div className="space-y-4">
              <div>
                <h4 className="font-medium mb-2">Original Keywords:</h4>
                <div className="flex flex-wrap gap-2">
                  {originalKeywords.map(keyword => (
                    <Badge key={keyword} variant="outline">
                      {keyword}
                    </Badge>
                  ))}
                </div>
              </div>
              
              <Button 
                onClick={handleExpand} 
                className="w-full"
                disabled={expandKeywordsMutation.isPending}
              >
                <Sparkles className="w-4 h-4 mr-2" />
                Generate Smart Expansions
              </Button>
            </div>
          )}

          {expandKeywordsMutation.isPending && (
            <div className="flex items-center justify-center py-8">
              <div className="text-center space-y-2">
                <Loader2 className="w-8 h-8 animate-spin mx-auto" />
                <p className="text-sm text-muted-foreground">
                  Generating keyword expansions...
                </p>
              </div>
            </div>
          )}

          {expandKeywordsMutation.error && (
            <div className="text-sm text-destructive p-3 bg-destructive/10 rounded">
              Error: {expandKeywordsMutation.error.message}
            </div>
          )}

          {preview && (
            <div className="space-y-6">
              {/* Exact Phrases */}
              <div>
                <h4 className="font-medium mb-3 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  Keep Exact Phrases (always included)
                </h4>
                <div className="space-y-2">
                  {preview.exactPhrases.map(item => (
                    <div key={item.text} className="flex items-center space-x-2">
                      <Checkbox 
                        checked={true}
                        disabled={true}
                      />
                      <Badge variant="default" className="bg-green-100 text-green-800">
                        {item.text}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>

              {/* Strong Synonyms */}
              {preview.strongSynonyms.length > 0 && (
                <div>
                  <h4 className="font-medium mb-3">
                    Strong Synonyms (checked by default)
                  </h4>
                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    {preview.strongSynonyms.map(item => (
                      <div key={item.text} className="flex items-center space-x-2">
                        <Checkbox 
                          checked={selectedItems.has(item.text)}
                          onCheckedChange={() => toggleItem(item.text)}
                        />
                        <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                          {item.text}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Weak Synonyms */}
              {preview.weakSynonyms.length > 0 && (
                <div>
                  <h4 className="font-medium mb-3">
                    Weak/Ambiguous Terms (unchecked by default)
                  </h4>
                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    {preview.weakSynonyms.map(item => (
                      <div key={item.text} className="flex items-center space-x-2">
                        <Checkbox 
                          checked={selectedItems.has(item.text)}
                          onCheckedChange={() => toggleItem(item.text)}
                        />
                        <Badge variant="outline" className="text-gray-600">
                          {item.text}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-between items-center pt-4 border-t">
                <div className="text-sm text-muted-foreground">
                  Selected: {selectedItems.size} keywords
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={handleClose}>
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleApply}
                    disabled={selectedItems.size === 0}
                  >
                    Apply Selected Keywords
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}