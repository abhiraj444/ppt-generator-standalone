'use client';

import { useState, type ChangeEvent, type ClipboardEvent, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Wand2, Lightbulb, FileText, Bot, BrainCircuit, PlusCircle, Copy, X, Settings } from 'lucide-react';
import { SlideEditor } from '@/components/SlideEditor';
import type { Slide } from '@/components/SlideEditor';
import { useAuth } from '@/hooks/useAuth';
import { useSettings } from '@/context/SettingsContext';
import { LocalDataService, type LocalCase } from '@/lib/LocalDataService';
import { ClientSideAiService } from '@/lib/ClientSideAiService';
import type { StructuredQuestion } from '@/types';
import { QuestionDisplay } from '@/components/QuestionDisplay';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import Link from 'next/link';

function ContentGeneratorContent() {
  const [mode, setMode] = useState<'question' | 'topic'>('question');
  const [question, setQuestion] = useState('');
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [topic, setTopic] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<any | null>(null);
  const [structuredQuestion, setStructuredQuestion] = useState<StructuredQuestion | null>(null);
  const [slides, setSlides] = useState<Slide[] | null>(null);
  const [presentationOutline, setPresentationOutline] = useState<string[] | null>(null);
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [currentCaseId, setCurrentCaseId] = useState<string | null>(null);

  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();
  const { apiKey, isConfigured } = useSettings();
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    const caseId = searchParams.get('caseId');
    if (caseId && user && caseId !== currentCaseId) {
      const loadCase = async () => {
        setIsLoading(true);
        try {
          const caseData = await LocalDataService.getCase(caseId);
          if (caseData && caseData.userId === user.id) {
            setMode(caseData.inputData.mode || 'question');
            if (caseData.inputData.mode === 'question') {
              setQuestion(caseData.inputData.question || '');
            } else {
              setTopic(caseData.inputData.topic || '');
            }
            setImagePreviews(caseData.inputData.images || []);
            setResult(caseData.outputData?.result || null);
            setSlides(caseData.outputData?.slides || null);
            setPresentationOutline(caseData.outputData?.outline || null);
            setSelectedTopics(caseData.outputData?.outline || []);
            setCurrentCaseId(caseId);
            toast({ title: 'Case Loaded', description: `Successfully loaded case: ${caseData.title}` });
          }
        } catch (error) {
          console.error('Failed to load case:', error);
          toast({ title: 'Error', description: 'Failed to load the case.', variant: 'destructive' });
        } finally {
          setIsLoading(false);
        }
      };
      loadCase();
    }
  }, [searchParams, user, router, toast, currentCaseId]);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      const newFiles = Array.from(event.target.files);
      setImageFiles(prev => [...prev, ...newFiles]);
      const newPreviews = newFiles.map(file => URL.createObjectURL(file));
      setImagePreviews(prev => [...prev, ...newPreviews]);
    }
  };

  const handleRemoveImage = (indexToRemove: number) => {
    setImageFiles(imageFiles.filter((_, index) => index !== indexToRemove));
    setImagePreviews(imagePreviews.filter((_, index) => index !== indexToRemove));
  };

  const handlePaste = (event: ClipboardEvent<HTMLTextAreaElement | HTMLInputElement>) => {
    const items = event.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile();
        if (file) {
          setImageFiles(prev => [...prev, file]);
          setImagePreviews(prev => [...prev, URL.createObjectURL(file)]);
          toast({ title: 'Image Pasted', description: 'Pasted image from clipboard.' });
          break;
        }
      }
    }
  };

  const fileToDataUri = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleQuestionSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user) return;
    if (!isConfigured) {
      toast({ title: 'API Key Missing', description: 'Please set your Gemini API Key in Settings.', variant: 'destructive' });
      return;
    }
    setIsLoading(true);
    try {
      const imageUrls = await Promise.all(imageFiles.map(file => LocalDataService.saveFile(file, user.id)));
      const images = await Promise.all(imageFiles.map(fileToDataUri));

      const [response, summaryResponse] = await Promise.all([
        ClientSideAiService.answerClinicalQuestion(apiKey, question.trim() || undefined, images),
        ClientSideAiService.summarizeQuestion(apiKey, question.trim() || undefined, images)
      ]);

      setResult(response);
      const newStructuredQuestion = { summary: summaryResponse.summary, images: imageUrls };
      setStructuredQuestion(newStructuredQuestion);

      const caseData: Partial<LocalCase> = {
        id: currentCaseId || undefined,
        userId: user.id,
        type: 'content-generator',
        title: response.topic,
        inputData: {
          mode: 'question',
          question: question.trim() || null,
          images: imageUrls,
          structuredQuestion: newStructuredQuestion,
        },
        outputData: { result: response }
      };

      const savedId = await LocalDataService.saveCase(caseData);
      if (!currentCaseId) setCurrentCaseId(savedId);
      toast({ title: 'Case Saved', description: 'Your content generation case has been saved locally.' });
    } catch (error) {
      console.error('Question submission failed:', error);
      toast({ title: 'Error', description: 'Failed to generate content.', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleTopicSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user) return;
    if (!isConfigured) {
      toast({ title: 'API Key Missing', description: 'Please set your Gemini API Key in Settings.', variant: 'destructive' });
      return;
    }
    setIsLoading(true);
    try {
      const data = await ClientSideAiService.generatePresentationOutline(apiKey, { topic: topic.trim() });
      setPresentationOutline(data.outline);
      setSelectedTopics(data.outline);
      setResult({
        answer: `Outline generated for topic: **${topic}**. Select topics below and generate the presentation.`,
        topic: topic,
      });

      const caseData: Partial<LocalCase> = {
        id: currentCaseId || undefined,
        userId: user.id,
        type: 'content-generator',
        title: topic,
        inputData: {
          mode: 'topic',
          topic: topic.trim(),
        },
        outputData: { outline: data.outline }
      };

      const savedId = await LocalDataService.saveCase(caseData);
      if (!currentCaseId) setCurrentCaseId(savedId);
    } catch (error) {
      console.error('Topic submission failed:', error);
      toast({ title: 'Error', description: 'Failed to generate outline.', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateOutline = async () => {
    if (!user || !apiKey) return;
    setIsLoading(true);
    try {
      const data = await ClientSideAiService.generatePresentationOutline(apiKey, {
        question: question,
        answer: result?.answer,
        reasoning: result?.reasoning
      });
      setPresentationOutline(data.outline);
      setSelectedTopics(data.outline);
    } catch (error) {
      console.error('Outline generation failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGeneratePresentation = async () => {
    if (!user || !apiKey || selectedTopics.length === 0) return;
    setIsLoading(true);
    try {
      const generatedSlides = await ClientSideAiService.generateSlideContent(apiKey, {
        topic: result?.topic || topic,
        selectedTopics,
        fullQuestion: question,
        fullAnswer: result?.answer,
        fullReasoning: result?.reasoning
      });
      setSlides(generatedSlides);

      const caseData = await LocalDataService.getCase(currentCaseId!);
      if (caseData) {
        caseData.outputData = {
          ...caseData.outputData,
          slides: generatedSlides,
          outline: presentationOutline
        };
        await LocalDataService.saveCase(caseData);
      }
      toast({ title: 'Presentation Generated', description: 'Your presentation has been saved locally.' });
    } catch (error) {
      console.error('Presentation generation failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleNewCase = () => {
    setMode('question');
    setQuestion('');
    setImageFiles([]);
    setImagePreviews([]);
    setTopic('');
    setResult(null);
    setSlides(null);
    setCurrentCaseId(null);
    setStructuredQuestion(null);
    setPresentationOutline(null);
    setSelectedTopics([]);
    router.push('/content-generator');
  };

  const formatText = (text: string) => {
    if (!text) return '';
    return text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br />');
  };

  if (authLoading || (!user && !searchParams.get('caseId'))) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      {!isConfigured && (
        <Card className="mb-8 border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <Settings className="h-8 w-8 text-yellow-600" />
              <div className="flex-1">
                <h3 className="font-bold text-yellow-800 dark:text-yellow-200">Gemini API Key Required</h3>
                <p className="text-sm text-yellow-700 dark:text-yellow-300">
                  To use AI features, please provide your Google Gemini API key in the settings.
                </p>
              </div>
              <Button asChild variant="outline" className="border-yellow-600 text-yellow-800 hover:bg-yellow-100 dark:text-yellow-200 dark:hover:bg-yellow-900/40">
                <Link href="/settings">Go to Settings</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {!result && !isLoading && (
        <Card className="border shadow-sm">
          <CardHeader>
            <CardTitle>Content Generator</CardTitle>
            <CardDescription>Select a mode to analyze a clinical question or generate a presentation.</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={mode} onValueChange={(v) => setMode(v as any)} className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="question">Clinical Question</TabsTrigger>
                <TabsTrigger value="topic">Medical Topic</TabsTrigger>
              </TabsList>
              <TabsContent value="question" className="pt-4">
                <form onSubmit={handleQuestionSubmit} className="space-y-4">
                  <Textarea
                    placeholder="Enter your question or paste an image..."
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    onPaste={handlePaste}
                    className="min-h-[100px]"
                  />
                  <Input type="file" multiple accept="image/*" onChange={handleFileChange} />
                  <Button type="submit" disabled={isLoading || (!question.trim() && imageFiles.length === 0)}>
                    {isLoading ? <Loader2 className="animate-spin mr-2" /> : <Bot className="mr-2" />}
                    Get Answer
                  </Button>
                </form>
              </TabsContent>
              <TabsContent value="topic" className="pt-4">
                <form onSubmit={handleTopicSubmit} className="space-y-4">
                  <Input placeholder="Enter a medical topic..." value={topic} onChange={(e) => setTopic(e.target.value)} />
                  <Button type="submit" disabled={isLoading || !topic.trim()}>
                    {isLoading ? <Loader2 className="animate-spin mr-2" /> : <Wand2 className="mr-2" />}
                    Generate Outline
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}

      {isLoading && !result && (
        <div className="flex flex-col items-center justify-center py-12">
          <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
          <p className="text-muted-foreground">Generating content...</p>
        </div>
      )}

      {result && (
        <Card className="border shadow-sm">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <BrainCircuit className="text-primary" />
                  AI Response
                </CardTitle>
                <CardDescription>Topic: {result.topic}</CardDescription>
              </div>
              <Button variant="outline" onClick={handleNewCase}>
                <PlusCircle className="mr-2 h-4 w-4" />
                New Case
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="prose prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: formatText(result.answer) }}></div>

            {!slides && !presentationOutline && !isLoading && (
              <Button onClick={handleGenerateOutline}>
                <Wand2 className="mr-2 h-4 w-4" />
                Generate Presentation Outline
              </Button>
            )}

            {presentationOutline && !slides && (
              <div className="space-y-4 rounded-lg border p-4">
                <h3 className="font-semibold">Select Topics for Presentation</h3>
                <div className="grid grid-cols-1 gap-2">
                  {presentationOutline.map((t, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={selectedTopics.includes(t)}
                        onChange={() => setSelectedTopics(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t])}
                      />
                      <span className="text-sm">{t}</span>
                    </div>
                  ))}
                </div>
                <Button onClick={handleGeneratePresentation} disabled={selectedTopics.length === 0}>
                  Generate Presentation
                </Button>
              </div>
            )}

            {slides && (
              <SlideEditor
                initialSlides={slides}
                topic={result.topic}
                caseId={currentCaseId}
                onSlidesUpdate={async (updated) => {
                  setSlides(updated);
                  const caseData = await LocalDataService.getCase(currentCaseId!);
                  if (caseData) {
                    caseData.outputData.slides = updated;
                    await LocalDataService.saveCase(caseData);
                  }
                }}
              />
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function ContentGeneratorPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}>
      <ContentGeneratorContent />
    </Suspense>
  );
}
