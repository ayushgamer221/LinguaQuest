import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { ArrowLeft, CheckCircle, XCircle, Calendar, Trophy, Eye, Loader2 } from "lucide-react";
import type { DailyQuiz } from "@shared/schema";

interface QuizQuestion {
  question: string;
  options: string[];
  correctIndex?: number;
}

interface DailyQuizResponse {
  quiz: DailyQuiz;
  completed: boolean;
  score?: number;
  userAnswers?: number[];
}

interface CompletionResult {
  score: number;
}

export default function DailyQuizPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [userAnswers, setUserAnswers] = useState<number[]>([]);
  const [isReviewMode, setIsReviewMode] = useState(false);
  const [finalScore, setFinalScore] = useState<number | null>(null);

  const { data, isLoading, error, refetch } = useQuery<DailyQuizResponse>({
    queryKey: ["/api/daily-quiz"],
  });

  const completeMutation = useMutation({
    mutationFn: async ({ answers }: { answers: number[] }) => {
      const res = await apiRequest("POST", `/api/daily-quiz/${data?.quiz.id}/complete`, { userAnswers: answers });
      return res.json() as Promise<CompletionResult>;
    },
    onSuccess: (result) => {
      setFinalScore(result.score);
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/daily-quiz"] });
      toast({ title: "Daily quiz completed!", description: `You scored ${result.score}% and earned XP!` });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to submit quiz. Please try again.", variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (error || !data?.quiz) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <Card className="text-center p-8">
          <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">No Daily Quiz Available</h2>
          <p className="text-muted-foreground mb-4">
            Check back later for today's quiz, or complete your onboarding to unlock quizzes for your skill level.
          </p>
          <Link href="/dashboard">
            <Button data-testid="button-back-dashboard">Back to Dashboard</Button>
          </Link>
        </Card>
      </div>
    );
  }

  const quiz = data.quiz;
  const questions = (quiz.questions as QuizQuestion[]) || [];
  const currentQuestion = questions[currentQuestionIndex];
  const alreadyCompleted = data.completed;
  const savedAnswers = Array.isArray(data.userAnswers) ? data.userAnswers : [];
  const quizCompleted = completeMutation.isSuccess || alreadyCompleted;

  const handleAnswerSubmit = () => {
    if (selectedAnswer === null || !currentQuestion) return;

    const newAnswers = [...userAnswers, selectedAnswer];
    setUserAnswers(newAnswers);

    if (currentQuestionIndex + 1 < questions.length) {
      setCurrentQuestionIndex((prev) => prev + 1);
      setSelectedAnswer(null);
    } else {
      completeMutation.mutate({ answers: newAnswers });
    }
  };

  const displayScore = finalScore ?? data.score ?? 0;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4 flex-wrap">
        <Link href="/dashboard">
          <Button variant="ghost" size="icon" data-testid="button-back">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary flex-shrink-0" />
            <h1 className="text-2xl font-bold truncate">{quiz.title}</h1>
          </div>
          <p className="text-muted-foreground">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <Badge variant="secondary" className="text-lg px-4 py-2">
          <Trophy className="h-4 w-4 mr-2" />
          {quiz.rewardXp} XP
        </Badge>
      </div>

      {alreadyCompleted && !isReviewMode ? (
        <Card className="text-center p-8" data-testid="card-already-completed">
          <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Already Completed!</h2>
          <p className="text-muted-foreground mb-4">
            You've already completed today's quiz with a score of {data.score}%.
          </p>
          <div className="flex justify-center gap-4 flex-wrap">
            <Button variant="outline" onClick={() => { refetch(); setIsReviewMode(true); }} data-testid="button-review">
              <Eye className="h-4 w-4 mr-2" />
              Review Answers
            </Button>
            <Link href="/dashboard">
              <Button data-testid="button-dashboard">Back to Dashboard</Button>
            </Link>
          </div>
        </Card>
      ) : isReviewMode ? (
        <Card data-testid="card-quiz-review">
          <CardHeader className="gap-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <CardTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5" />
                Quiz Review
              </CardTitle>
              <Badge variant="secondary">
                Score: {data.score}%
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {questions.map((question, qIndex) => {
              const userAnswer = savedAnswers[qIndex];
              const correctIndex = question.correctIndex;
              return (
                <div key={qIndex} className="space-y-3 pb-4 border-b last:border-b-0">
                  <div className="flex items-start gap-2">
                    <span className="font-medium text-muted-foreground">{qIndex + 1}.</span>
                    <p className="font-medium">{question.question}</p>
                  </div>
                  <div className="space-y-2 ml-6">
                    {question.options.map((option, oIndex) => (
                      <div
                        key={oIndex}
                        className={`flex items-center gap-3 p-3 border rounded-md ${
                          oIndex === correctIndex
                            ? "border-green-500 bg-green-50 dark:bg-green-950"
                            : userAnswer === oIndex
                            ? "border-red-500 bg-red-50 dark:bg-red-950"
                            : ""
                        }`}
                      >
                        <span className="flex-1">{option}</span>
                        {oIndex === correctIndex && (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        )}
                        {userAnswer === oIndex && oIndex !== correctIndex && (
                          <XCircle className="h-4 w-4 text-red-500" />
                        )}
                        {userAnswer === oIndex && (
                          <Badge variant="outline" className="text-xs">Your answer</Badge>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
            <div className="flex justify-end pt-4">
              <Button onClick={() => setIsReviewMode(false)} data-testid="button-back-from-review">
                Back
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : quizCompleted ? (
        <Card className="text-center p-8" data-testid="card-quiz-result">
          <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Quiz Complete!</h2>
          <p className="text-muted-foreground mb-4">
            You scored {displayScore}%{displayScore >= 80 ? " - Great job!" : ""}
          </p>
          <Link href="/dashboard">
            <Button data-testid="button-continue">Continue to Dashboard</Button>
          </Link>
        </Card>
      ) : completeMutation.isPending ? (
        <Card className="text-center p-8" data-testid="card-submitting">
          <Loader2 className="h-16 w-16 text-primary mx-auto mb-4 animate-spin" />
          <h2 className="text-xl font-bold mb-2">Submitting your answers...</h2>
        </Card>
      ) : currentQuestion ? (
        <Card data-testid="card-quiz">
          <CardHeader className="gap-2">
            <div className="flex items-center justify-between gap-2">
              <CardTitle>Question {currentQuestionIndex + 1}</CardTitle>
              <span className="text-sm text-muted-foreground">
                {currentQuestionIndex + 1} of {questions.length}
              </span>
            </div>
            <Progress value={((currentQuestionIndex + 1) / questions.length) * 100} className="h-2" />
          </CardHeader>
          <CardContent className="space-y-6">
            <p className="text-lg font-medium">{currentQuestion.question}</p>

            <RadioGroup
              value={selectedAnswer?.toString()}
              onValueChange={(val) => setSelectedAnswer(parseInt(val))}
            >
              {currentQuestion.options.map((option, index) => (
                <div
                  key={index}
                  className="flex items-center space-x-3 p-4 border rounded-md hover-elevate cursor-pointer"
                  data-testid={`option-${index}`}
                >
                  <RadioGroupItem value={index.toString()} id={`option-${index}`} />
                  <Label htmlFor={`option-${index}`} className="flex-1 cursor-pointer">
                    {option}
                  </Label>
                </div>
              ))}
            </RadioGroup>

            <div className="flex justify-end gap-4">
              <Button onClick={handleAnswerSubmit} disabled={selectedAnswer === null} data-testid="button-submit-answer">
                {currentQuestionIndex + 1 < questions.length ? "Next Question" : "Finish Quiz"}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="text-center p-8">
          <p className="text-muted-foreground">No questions available for this quiz.</p>
        </Card>
      )}
    </div>
  );
}
