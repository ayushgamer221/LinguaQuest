import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Brain, Sparkles, Send, Loader2, BookOpen } from "lucide-react";
import { useAuth } from "@/lib/auth";

interface AITutorProps {
  lessonTitle?: string;
  lessonContent?: string;
  defaultTopic?: string;
}

export function AITutor({ lessonTitle, lessonContent, defaultTopic }: AITutorProps) {
  const { user } = useAuth();
  const [topic, setTopic] = useState(defaultTopic || "");
  const [explanation, setExplanation] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const getExplanation = useCallback(async () => {
    if (!topic.trim()) return;
    
    setIsLoading(true);
    setExplanation("");
    
    try {
      const response = await fetch("/api/ai/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: topic.trim(),
          context: lessonContent?.slice(0, 500),
          userLevel: user?.skillLevel || "beginner"
        }),
        credentials: "include"
      });
      
      if (!response.ok) throw new Error("Failed to get explanation");
      
      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response body");
      
      const decoder = new TextDecoder();
      let buffer = "";
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(line.slice(6));
            if (event.content) {
              setExplanation(prev => prev + event.content);
            }
          } catch {}
        }
      }
    } catch (error) {
      setExplanation("Sorry, I couldn't generate an explanation right now. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, [topic, lessonContent, user?.skillLevel]);

  if (!isOpen) {
    return (
      <Button 
        variant="outline" 
        onClick={() => setIsOpen(true)}
        className="gap-2"
        data-testid="button-open-ai-tutor"
      >
        <Brain className="h-4 w-4" />
        Ask AI Tutor
      </Button>
    );
  }

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent" data-testid="card-ai-tutor">
      <CardHeader className="pb-3 gap-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <CardTitle className="flex items-center gap-2 text-lg">
            <div className="h-8 w-8 bg-primary/10 rounded-lg flex items-center justify-center">
              <Brain className="h-4 w-4 text-primary" />
            </div>
            AI Tutor
          </CardTitle>
          <Badge variant="secondary" className="text-xs">
            <Sparkles className="h-3 w-3 mr-1" />
            Powered by AI
          </Badge>
        </div>
        {lessonTitle && (
          <p className="text-sm text-muted-foreground flex items-center gap-1">
            <BookOpen className="h-3 w-3" />
            Helping with: {lessonTitle}
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input
            placeholder="Ask about any English concept..."
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !isLoading && getExplanation()}
            disabled={isLoading}
            data-testid="input-ai-topic"
          />
          <Button 
            onClick={getExplanation} 
            disabled={isLoading || !topic.trim()}
            size="icon"
            data-testid="button-ask-ai"
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
        
        {isLoading && !explanation && (
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-5/6" />
          </div>
        )}
        
        {explanation && (
          <div 
            className="prose prose-sm dark:prose-invert max-w-none p-4 bg-background rounded-lg border"
            data-testid="text-ai-explanation"
          >
            <div className="whitespace-pre-wrap">{explanation}</div>
          </div>
        )}
        
        <div className="flex gap-2 flex-wrap">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => { setTopic(""); setExplanation(""); }}
            disabled={isLoading}
          >
            Clear
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setIsOpen(false)}
          >
            Close
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
