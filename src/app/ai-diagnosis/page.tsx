'use client';

import { useState, type ChangeEvent, type ClipboardEvent, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { DiagnosisCard } from '@/components/DiagnosisCard';
import { FileText, Loader2, Upload, PlusCircle, BrainCircuit, Lightbulb, Copy, X, Settings } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useSettings } from '@/context/SettingsContext';
import { LocalDataService, type LocalCase } from '@/lib/LocalDataService';
import { ClientSideAiService } from '@/lib/ClientSideAiService';
import type { StructuredQuestion } from '@/types';
import { QuestionDisplay } from '@/components/QuestionDisplay';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import Link from 'next/link';
import { Capacitor } from '@capacitor/core';

function AiDiagnosisContent() {
  const [patientData, setPatientData] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [filePreviews, setFilePreviews] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<any[] | null>(null);
  const [clinicalAnswer, setClinicalAnswer] = useState<any | null>(null);
  const [structuredQuestion, setStructuredQuestion] = useState<StructuredQuestion | null>(null);
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
            setPatientData(caseData.inputData.patientData || '');
            if (caseData.inputData.structuredQuestion) {
              setStructuredQuestion({
                ...caseData.inputData.structuredQuestion,
                images: caseData.inputData.supportingDocuments || [],
              });
            } else {
              setStructuredQuestion(null);
            }
            setFilePreviews(caseData.inputData.supportingDocuments || []);
            setResults(caseData.outputData?.diagnoses || null);
            setClinicalAnswer(caseData.outputData?.clinicalAnswer || null);
            setCurrentCaseId(caseId);
            toast({ title: 'Case Loaded', description: `Successfully loaded case: ${caseData.title}` });
          } else {
            toast({ title: 'Error', description: 'Could not find or access the specified case.', variant: 'destructive' });
            router.push('/ai-diagnosis');
          }
        } catch (error) {
          console.error('Failed to load case:', error);
          toast({ title: 'Error', description: 'Failed to load the case from history.', variant: 'destructive' });
          router.push('/ai-diagnosis');
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
      setFiles(prev => [...prev, ...newFiles]);
      const newPreviews = newFiles.map(file => URL.createObjectURL(file));
      setFilePreviews(prev => [...prev, ...newPreviews]);
    }
  };

  const handleRemoveFile = (indexToRemove: number) => {
    setFiles(files.filter((_, index) => index !== indexToRemove));
    setFilePreviews(filePreviews.filter((_, index) => index !== indexToRemove));
  };

  const handlePaste = (event: ClipboardEvent<HTMLTextAreaElement>) => {
    const items = event.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile();
        if (file) {
          setFiles(prev => [...prev, file]);
          setFilePreviews(prev => [...prev, URL.createObjectURL(file)]);
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

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user) return;
    if (!isConfigured) {
      toast({ title: 'API Key Missing', description: 'Please set your Gemini API Key in Settings.', variant: 'destructive' });
      return;
    }
    setIsLoading(true);
    try {
      const imageUrls = await Promise.all(files.map(file => LocalDataService.saveFile(file, user.id)));
      const images = await Promise.all(files.map(fileToDataUri));

      const [diagnosisResponse, answerResponse, summaryResponse] = await Promise.all([
        ClientSideAiService.generateDiagnosis(apiKey, patientData.trim() || undefined, images),
        ClientSideAiService.answerClinicalQuestion(apiKey, patientData.trim() || undefined, images),
        ClientSideAiService.summarizeQuestion(apiKey, patientData.trim() || undefined, images)
      ]);

      setResults(diagnosisResponse);
      setClinicalAnswer(answerResponse);
      const newStructuredQuestion = { summary: summaryResponse.summary, images: imageUrls };
      setStructuredQuestion(newStructuredQuestion);
      setFilePreviews(imageUrls);

      const caseData: Partial<LocalCase> = {
        id: currentCaseId || undefined,
        userId: user.id,
        type: 'diagnosis',
        title: summaryResponse.summary,
        inputData: {
          patientData: patientData.trim() || null,
          supportingDocuments: imageUrls,
          structuredQuestion: newStructuredQuestion,
        },
        outputData: {
          diagnoses: diagnosisResponse,
          clinicalAnswer: answerResponse,
        }
      };

      const savedId = await LocalDataService.saveCase(caseData);
      if (!currentCaseId) setCurrentCaseId(savedId);
      toast({ title: 'Case Saved', description: 'Your diagnosis case has been saved locally.' });
    } catch (error) {
      console.error('Diagnosis failed:', error);
      toast({ title: 'Error', description: 'Failed to generate diagnosis.', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: 'Copied', description: `${type.charAt(0).toUpperCase() + type.slice(1)} copied to clipboard.` });
  };

  const formatText = (text: string) => {
    if (!text) return '';
    return text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br />');
  };

  const handleNewCase = () => {
    setPatientData('');
    setFiles([]);
    setFilePreviews([]);
    setResults(null);
    setClinicalAnswer(null);
    setStructuredQuestion(null);
    setCurrentCaseId(null);
    router.push('/ai-diagnosis');
  };

  if (authLoading) {
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

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <div className="space-y-6">
          <Card className="border shadow-sm">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>AI Diagnosis</CardTitle>
                  <CardDescription>Enter patient data or upload medical reports for analysis.</CardDescription>
                </div>
                <Button variant="ghost" size="icon" onClick={handleNewCase} title="New Case">
                  <PlusCircle className="h-5 w-5" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="patientData">Patient Data / Clinical Notes</Label>
                  <Textarea
                    id="patientData"
                    placeholder="Describe symptoms, history, or paste clinical notes..."
                    value={patientData}
                    onChange={(e) => setPatientData(e.target.value)}
                    onPaste={handlePaste}
                    className="min-h-[200px] resize-none"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Supporting Documents (Images/PDFs)</Label>
                  <div className="flex flex-wrap gap-2">
                    {filePreviews.map((preview, index) => (
                      <div key={index} className="relative h-20 w-20 overflow-hidden rounded-md border">
                        <img src={preview} alt={`Preview ${index}`} className="h-full w-full object-cover" />
                        <button
                          type="button"
                          onClick={() => handleRemoveFile(index)}
                          className="absolute right-1 top-1 rounded-full bg-black/50 p-1 text-white hover:bg-black/70"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                    <label className="flex h-20 w-20 cursor-pointer flex-col items-center justify-center rounded-md border border-dashed hover:bg-muted">
                      <Upload className="h-6 w-6 text-muted-foreground" />
                      <span className="text-[10px] text-muted-foreground">Upload</span>
                      <input type="file" multiple accept="image/*,application/pdf" onChange={handleFileChange} className="hidden" />
                    </label>
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={isLoading || (!patientData.trim() && files.length === 0)}>
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <BrainCircuit className="mr-2 h-4 w-4" />
                      Generate Diagnosis
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>

          {structuredQuestion && (
            <QuestionDisplay
              summary={structuredQuestion.summary}
              images={structuredQuestion.images}
            />
          )}

          {clinicalAnswer && (
            <Card className="border shadow-sm overflow-hidden">
              <CardHeader className="bg-primary/5 border-b">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <FileText className="h-5 w-5 text-primary" />
                    Clinical Analysis
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleCopy(clinicalAnswer.answer, 'answer')}
                    className="h-8 w-8"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="prose prose-sm max-w-none dark:prose-invert" dangerouslySetInnerHTML={{ __html: formatText(clinicalAnswer.answer) }}></div>

                {clinicalAnswer.reasoning && (
                  <Accordion type="single" collapsible className="mt-6">
                    <AccordionItem value="reasoning" className="border-none">
                      <AccordionTrigger>
                        <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-primary">
                          <Lightbulb className="h-4 w-4" />
                          Click here to see the detailed analysis
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="mt-2 rounded-md border border-border bg-reasoning text-reasoning-foreground p-4">
                          <div className="flex items-start justify-between">
                            <h4 className="font-semibold text-foreground mb-2 flex-grow">
                              Reasoning
                            </h4>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleCopy(clinicalAnswer.reasoning, 'reasoning')}
                              className="h-8 w-8 flex-shrink-0 -mr-2 -mt-2 text-muted-foreground hover:bg-muted hover:text-foreground"
                              aria-label="Copy reasoning"
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                          </div>
                          <div className="prose prose-sm max-w-none text-muted-foreground" dangerouslySetInnerHTML={{ __html: formatText(clinicalAnswer.reasoning) }}></div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                )}
              </CardContent>
            </Card>
          )}
        </div>
        <div className="space-y-6">
          {results && results.length > 0 && results.map((diag, index) => (
            <DiagnosisCard key={index} diagnosis={diag} />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function AiDiagnosisPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}>
      <AiDiagnosisContent />
    </Suspense>
  );
}