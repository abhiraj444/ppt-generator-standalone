'use client';

import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, TouchSensor } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import React, { useEffect, useState } from 'react';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  Table,
  TableRow as DocxTableRow,
  TableCell,
  BorderStyle,
} from 'docx';
import { saveAs } from 'file-saver';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Checkbox } from './ui/checkbox';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from './ui/alert-dialog';
import {
  Table as ShadcnTable,
  TableBody,
  TableCell as ShadcnTableCell,
  TableHead,
  TableHeader,
  TableRow as ShadcnTableRow,
} from '@/components/ui/table';
import {
  Trash2,
  Plus,
  RefreshCw,
  FileDown,
  Loader2,
  Wand2,
  Scaling,
  ClipboardCopy,
  FileText,
  List,
  ListOrdered,
  Type,
  PlusCircle,
  File,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Label } from './ui/label';
import type { Slide, ContentItem } from '@/types';
import dynamic from 'next/dynamic';
import { registerNotoSansRegular } from '@/lib/pdf-fonts/NotoSansRegular';
import EnhancedSlideRenderer from './EnhancedSlideRenderer';
import { registerNotoSansBold } from '@/lib/pdf-fonts/NotoSansBold';
import { registerNotoSansItalic } from '@/lib/pdf-fonts/NotoSansItalic';
import { useSettings } from '@/context/SettingsContext';
import { ClientSideAiService } from '@/lib/ClientSideAiService';

export type { Slide };

const BoldRenderer = ({ text, bold }: { text: string; bold?: string[] }) => {
  if (!text) return null;
  if (!bold || bold.length === 0) {
    return <>{text}</>;
  }

  const boldEscaped = bold.map(b => b.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'));
  const regex = new RegExp(`(${boldEscaped.join('|')})`, 'g');
  const parts = text.split(regex).filter(Boolean);

  return (
    <>
      {parts.map((part, i) =>
        bold.includes(part) ? <strong key={i}>{part}</strong> : part
      )}
    </>
  );
};

const renderContentItem = (item: ContentItem, index: number) => {
  const getIcon = () => {
    switch (item.type) {
      case 'paragraph': return <Type className="h-4 w-4" />;
      case 'bullet_list': return <List className="h-4 w-4" />;
      case 'numbered_list': return <ListOrdered className="h-4 w-4" />;
      case 'table': return <FileText className="h-4 w-4" />;
      case 'note': return <FileText className="h-4 w-4" />;
      default: return null;
    }
  };

  return (
    <div key={index} className="mb-2 flex items-start gap-3 rounded-md border p-3">
      <span className="text-muted-foreground pt-1">{getIcon()}</span>
      <div className='w-full'>
        {item.type === 'paragraph' && (
          <p><BoldRenderer text={item.text} bold={item.bold} /></p>
        )}
        {item.type === 'bullet_list' && (
          <ul className="list-disc pl-5">
            {item.items.map((listItem, i) => <li key={i}><BoldRenderer text={listItem.text} bold={listItem.bold} /></li>)}
          </ul>
        )}
        {item.type === 'numbered_list' && (
          <ol className="list-decimal pl-5">
            {item.items.map((listItem, i) => <li key={i}><BoldRenderer text={listItem.text} bold={listItem.bold} /></li>)}
          </ol>
        )}
        {item.type === 'note' && (
          <p className="text-sm italic text-muted-foreground">Note: {item.text.replace(/^Note:\s*/i, '')}</p>
        )}
        {item.type === 'table' && (
          <ShadcnTable>
            <TableHeader>
              <ShadcnTableRow>
                {item.headers.map((header, i) => <TableHead key={i}>{header}</TableHead>)}
              </ShadcnTableRow>
            </TableHeader>
            <TableBody>
              {item.rows.map((row, i) => (
                <ShadcnTableRow key={i}>
                  {row.cells.map((cell, j) => <ShadcnTableCell key={j}>{cell}</ShadcnTableCell>)}
                </ShadcnTableRow>
              ))}
            </TableBody>
          </ShadcnTable>
        )}
      </div>
    </div>
  );
};

// Add SortableItem component for dnd-kit sortable functionality
const SortableItem = ({ id, children }: { id: string; children: React.ReactNode }) => {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      {children}
    </div>
  );
};

export function SlideEditor({
  initialSlides,
  topic: initialTopic,
  caseId,
  onRefresh,
  initialUsedTopics,
  onUpdate,
  questionContext,
  outline,
  initialSuggestedTopics,
  onNewCase,
}: {
  initialSlides: Slide[];
  topic: string;
  caseId: string | null;
  onRefresh?: () => void;
  initialUsedTopics?: string[];
  onUpdate: (data: { slides?: Slide[]; suggestedTopics?: string[]; usedTopics?: string[] }) => void;
  questionContext?: string;
  outline?: string[];
  initialSuggestedTopics?: string[];
  onNewCase?: () => void;
}) {
  const [slides, setSlides] = useState<Slide[]>(initialSlides);
  const [selectedIndices, setSelectedIndices] = useState<number[]>([]);
  const [topic, setTopic] = useState(initialTopic);
  const [isModifying, setIsModifying] = useState(false);
  const [isRefreshModalOpen, setIsRefreshModalOpen] = useState(false);
  const [loadingSlides, setLoadingSlides] = useState<Set<number>>(new Set());
  const [isAddSectionModalOpen, setIsAddSectionModalOpen] = useState(false);
  const [newTopicSuggestions, setNewTopicSuggestions] = useState<string[]>(initialSuggestedTopics || []);
  const [usedTopics, setUsedTopics] = useState<string[]>(initialUsedTopics || []);
  const [customTopic, setCustomTopic] = useState('');
  const [selectedNewTopics, setSelectedNewTopics] = useState<string[]>([]);
  const [isSuggestingTopics, setIsSuggestingTopics] = useState(false);
  const { toast } = useToast();
  const { apiKey } = useSettings();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 250,
        tolerance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    setSlides(initialSlides);
    setSelectedIndices([]);

    // Update used topics based on existing slides when slides change
    if (initialSlides.length > 0) {
      const existingTopics = initialSlides.map(slide => slide.title);
      const updatedUsedTopics = Array.from(new Set([...(initialUsedTopics || []), ...existingTopics]));
      if (updatedUsedTopics.length > (initialUsedTopics?.length || 0)) {
        setUsedTopics(updatedUsedTopics);
        onUpdate({ usedTopics: updatedUsedTopics });
      }
    }
  }, [initialSlides, initialUsedTopics, onUpdate]);

  const handleSelectionChange = (index: number, checked: boolean) => {
    if (checked) {
      setSelectedIndices((prev) => [...prev, index]);
    } else {
      setSelectedIndices((prev) => prev.filter((i) => i !== index));
    }
  };

  const handleSelectAll = (checked: boolean | 'indeterminate') => {
    if (checked === true) {
      setSelectedIndices(slides.map((_, i) => i));
    } else {
      setSelectedIndices([]);
    }
  };

  const fetchNewTopicSuggestions = async () => {
    if (!apiKey) {
      toast({ title: 'Error', description: 'API Key missing.', variant: 'destructive' });
      return;
    }
    setIsSuggestingTopics(true);
    try {
      const data = await ClientSideAiService.suggestTopics(apiKey, {
        question: questionContext,
        topic: topic,
        existingTopics: [...(outline || []), ...newTopicSuggestions],
      });

      const incomingTopics = Array.isArray(data.topics) ? data.topics : [];

      const updatedSuggestions = Array.from(new Set([...newTopicSuggestions, ...incomingTopics]));
      setNewTopicSuggestions(updatedSuggestions);
      onUpdate({ suggestedTopics: updatedSuggestions });

    } catch (error) {
      console.error('Failed to suggest new topics:', error);
      toast({ title: 'Error', description: 'Could not fetch topic suggestions.', variant: 'destructive' });
    } finally {
      setIsSuggestingTopics(false);
    }
  };

  const handleAddSectionClick = () => {
    setIsAddSectionModalOpen(true);
    setSelectedNewTopics([]);
    setCustomTopic('');
    if (newTopicSuggestions.length === 0) {
      fetchNewTopicSuggestions();
    }
  };

  const handleAddSelectedSlides = async () => {
    if (!apiKey) return;
    const topicsToGenerate = [...selectedNewTopics];
    if (customTopic.trim()) {
      topicsToGenerate.push(customTopic.trim());
    }

    if (topicsToGenerate.length === 0) {
      toast({ title: 'No Topics Selected', description: 'Please select or enter a topic to add.', variant: 'destructive' });
      return;
    }

    // Create placeholder slides first
    const placeholderSlides = topicsToGenerate.map(topic => ({
      title: topic,
      content: [] as ContentItem[]
    }));

    const updatedSlidesWithPlaceholders = [...slides, ...placeholderSlides];
    setSlides(updatedSlidesWithPlaceholders);
    onUpdate({ slides: updatedSlidesWithPlaceholders });

    setIsModifying(true);
    setIsAddSectionModalOpen(false);

    // Add new slide indices to loadingSlides
    const startIndex = slides.length;
    setLoadingSlides(prev => {
      const next = new Set(prev);
      topicsToGenerate.forEach((_, i) => next.add(startIndex + i));
      return next;
    });

    // Scroll to bottom to show new placeholders
    setTimeout(() => {
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    }, 100);

    try {
      const slidePromises = topicsToGenerate.map(topic =>
        ClientSideAiService.generateSingleSlide(apiKey, topic)
      );

      const newSlides = await Promise.all(slidePromises);

      // Calculate the updated slides
      const updatedSlides = [...slides];
      const startIndexForNew = slides.length;

      // Replace placeholders with actual slides
      newSlides.forEach((slide, index) => {
        const targetIndex = startIndexForNew + index;
        if (targetIndex < updatedSlides.length) {
          updatedSlides[targetIndex] = slide;
        } else {
          updatedSlides.push(slide);
        }
      });

      setSlides(updatedSlides);

      const newUsedTopics = Array.from(new Set([...usedTopics, ...topicsToGenerate]));
      setUsedTopics(newUsedTopics);

      // Clear loading state for newly added slides
      setLoadingSlides(new Set());

      // Update everything in one go to prevent race conditions
      onUpdate({
        slides: updatedSlides,
        usedTopics: newUsedTopics,
        suggestedTopics: newTopicSuggestions
      });

      toast({ title: 'Slides Added', description: `Successfully added ${newSlides.length} new slide(s).` });
    } catch (error) {
      console.error('Failed to add slides:', error);
      toast({ title: 'Error Adding Slides', description: 'Failed to generate slides.', variant: 'destructive' });
      // Clear loading state on error as well
      setLoadingSlides(new Set());
    } finally {
      setIsModifying(false);
    }
  };

  const removeSlide = (index: number) => {
    const newSlides = slides.filter((_, i) => i !== index);
    setSlides(newSlides);
    onUpdate({ slides: newSlides });
    setSelectedIndices((prev) =>
      prev.filter((i) => i !== index).map((i) => (i > index ? i - 1 : i))
    );
  };

  const deleteSelectedSlides = () => {
    const newSlides = slides.filter((_, index) => !selectedIndices.includes(index));
    const deletedCount = selectedIndices.length;
    setSlides(newSlides);
    onUpdate({ slides: newSlides });
    setSelectedIndices([]);
    toast({
      title: 'Slides Deleted',
      description: `${deletedCount} slides have been removed.`,
    });
  };

  const handleRefreshClick = () => {
    onRefresh?.();
  };

  const handleModifySlides = async (action: 'expand_content' | 'replace_content' | 'expand_selected') => {
    if (!apiKey) return;
    if (selectedIndices.length === 0) {
      toast({ title: 'No Sections Selected', description: 'Please select sections to modify.', variant: 'destructive' });
      return;
    }

    // Set the selected slides as loading with shimmer effect
    const loadingSet = new Set(selectedIndices);
    setLoadingSlides(loadingSet);

    setIsModifying(true);
    setIsRefreshModalOpen(false);
    try {
      const result = await ClientSideAiService.modifySlides(apiKey, {
        slides,
        selectedIndices,
        action,
      });

      if (Array.isArray(result) && result.length > 0) {
        setSlides(result);
        onUpdate({ slides: result });
        setSelectedIndices([]);
        setLoadingSlides(new Set()); // Reset loading state
        toast({
          title: 'Slides Updated',
          description: 'The selected slides have been modified.',
        });
      } else {
        setLoadingSlides(new Set()); // Reset loading state on error
        throw new Error('Invalid response format from AI');
      }
    } catch (error) {
      console.error(`Slide modification failed for action: ${action}`, error);
      setLoadingSlides(new Set()); // Reset loading state on error
      toast({
        title: 'An Error Occurred',
        description: 'Failed to modify slides. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsModifying(false);
    }
  };

  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    if (active.id !== over.id) {
      setSlides((items) => {
        const oldIndex = items.findIndex((item) => item.title === active.id);
        const newIndex = items.findIndex((item) => item.title === over.id);
        const newSlides = arrayMove(items, oldIndex, newIndex);
        onUpdate({ slides: newSlides });
        return newSlides;
      });
    }
  };

  const handleCopyRawContent = () => {
    const rawContent = JSON.stringify({ slides }, null, 2);
    navigator.clipboard.writeText(rawContent).then(
      () => toast({ title: 'Content Copied', description: 'The raw JSON slide content has been copied.' }),
      () => toast({ title: 'Error', description: 'Failed to copy content.', variant: 'destructive' })
    );
  };

  const handleExportToPdf = () => {
    setIsModifying(true);
    try {
      // Initialize jsPDF document
      const doc = new jsPDF();
      // Register your custom fonts with jsPDF
      registerNotoSansRegular(doc);
      registerNotoSansBold(doc);
      registerNotoSansItalic(doc);
      // Set the default font for the document to 'NotoSans'
      // This name 'NotoSans' must match the name used in registerNotoSansX functions
      doc.setFont('NotoSans');
      const margin = 20; // Page margin in mm
      let currentY = margin; // Current Y position on the page
      const pageHeight = doc.internal.pageSize.height; // Total page height
      const pageWidth = doc.internal.pageSize.width; // Total page width
      const contentWidth = pageWidth - 2 * margin; // Usable content width

      // Define colors - Explicitly define as tuples
      const titleColor = '#4A90E2'; // Blue
      const paragraphColor = '#333333'; // Dark Gray
      const listItemColor = '#333333'; // Dark Gray
      const headerBgColor: [number, number, number] = [220, 230, 240]; // Light blue-gray for table headers (RGB)
      const headerTextColor = '#2C3E50'; // Dark blue-gray for table headers (Hex, will be converted by jsPDF)
      const rowEvenColor: [number, number, number] = [255, 255, 255]; // White for even rows (RGB)
      const rowOddColor: [number, number, number] = [245, 245, 245]; // Very light gray for odd rows (RGB)

      // Function to add a new page and reset Y position to the top margin
      const addNewPage = () => {
        doc.addPage();
        currentY = margin;
      };

      const renderTextBlock = (doc: jsPDF, text: string, boldParts: string[] | undefined, x: number, y: number, maxWidth: number, fontSize: number, textColor: string): number => {
        doc.setFontSize(fontSize);
        doc.setTextColor(textColor);
        const lineHeight = fontSize * 0.4; // Estimate line height

        const segments: { text: string; isBold: boolean }[] = [];
        const escapedBoldParts = (boldParts || []).map(bp => bp.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'));
        const regex = new RegExp(`(${escapedBoldParts.join('|')})`, 'g');
        const parts = text.split(regex);

        parts.forEach(part => {
          if (part) {
            const isBold = escapedBoldParts.includes(part);
            segments.push({ text: part, isBold });
          }
        });

        const lines: { text: string; isBold: boolean }[][] = [];
        let currentLineSegments: { text: string; isBold: boolean }[] = [];
        let currentLineText = '';

        for (const segment of segments) {
          const words = segment.text.split(/(\s+)/);

          for (const word of words) {
            if (!word) continue;

            doc.setFont('NotoSans', segment.isBold ? 'bold' : 'normal');
            const wordWidth = doc.getTextWidth(word);

            if (doc.getTextWidth(currentLineText + word) > maxWidth && currentLineText !== '') {
              lines.push(currentLineSegments);
              currentLineSegments = [];
              currentLineText = '';
            }

            currentLineSegments.push({ text: word, isBold: segment.isBold });
            currentLineText += word;
          }
        }
        if (currentLineSegments.length > 0) {
          lines.push(currentLineSegments);
        }

        const estimatedHeight = lines.length * lineHeight;

        if (currentY + estimatedHeight > pageHeight - margin) {
          addNewPage();
        }

        const startYForBlock = currentY;

        for (let i = 0; i < lines.length; i++) {
          const lineSegments = lines[i];
          let currentX = x;
          const lineY = startYForBlock + (i * lineHeight);

          for (const segment of lineSegments) {
            doc.setFont('NotoSans', segment.isBold ? 'bold' : 'normal');
            doc.text(segment.text, currentX, lineY);
            currentX += doc.getTextWidth(segment.text);
          }
        }

        currentY += estimatedHeight;
        return estimatedHeight;
      };

      const renderTable = (doc: jsPDF, headers: string[], rows: { cells: string[] }[], x: number, y: number, maxWidth: number, fontSize: number) => {
        doc.setFontSize(fontSize);
        const tableLineHeight = fontSize * 0.4;
        const cellPadding = 2;
        const numColumns = headers.length;
        const colWidth = maxWidth / numColumns;

        const drawTableHeaders = () => {
          doc.setFont('NotoSans', 'bold');
          let headerX = x;
          let maxHeaderHeight = tableLineHeight + 2 * cellPadding;

          headers.forEach(headerText => {
            const lines = doc.splitTextToSize(headerText, colWidth - 2 * cellPadding);
            maxHeaderHeight = Math.max(maxHeaderHeight, lines.length * tableLineHeight + 2 * cellPadding);
          });

          headers.forEach(headerText => {
            doc.setFillColor(headerBgColor[0], headerBgColor[1], headerBgColor[2]);
            doc.rect(headerX, currentY, colWidth, maxHeaderHeight, 'F');
            doc.setTextColor(headerTextColor);
            const lines = doc.splitTextToSize(headerText, colWidth - 2 * cellPadding);
            doc.text(lines, headerX + cellPadding, currentY + cellPadding + (maxHeaderHeight - lines.length * tableLineHeight) / 2);
            headerX += colWidth;
          });
          doc.setFont('NotoSans', 'normal');
          doc.setTextColor(paragraphColor);
          currentY += maxHeaderHeight;
        };

        if (currentY + (tableLineHeight + 2 * cellPadding) > pageHeight - margin) {
          addNewPage();
        }
        drawTableHeaders();

        rows.forEach((row, rowIndex) => {
          let rowHeight = tableLineHeight + 2 * cellPadding;

          row.cells.forEach(cellText => {
            const lines = doc.splitTextToSize(cellText, colWidth - 2 * cellPadding);
            rowHeight = Math.max(rowHeight, lines.length * tableLineHeight + 2 * cellPadding);
          });

          if (currentY + rowHeight > pageHeight - margin) {
            addNewPage();
            drawTableHeaders();
          }

          let cellX = x;
          const fillColor = rowIndex % 2 === 0 ? rowEvenColor : rowOddColor;

          row.cells.forEach(cellText => {
            doc.setFillColor(fillColor[0], fillColor[1], fillColor[2]);
            doc.rect(cellX, currentY, colWidth, rowHeight, 'F');
            doc.rect(cellX, currentY, colWidth, rowHeight, 'S');
            doc.setTextColor(listItemColor);
            doc.setFont('NotoSans', 'normal');
            const lines = doc.splitTextToSize(cellText, colWidth - 2 * cellPadding);
            doc.text(lines, cellX + cellPadding, currentY + cellPadding + (rowHeight - lines.length * tableLineHeight) / 2);
            cellX += colWidth;
          });
          currentY += rowHeight;
        });
      };

      slides.forEach((slide, slideIndex) => {
        if (slideIndex > 0) {
          addNewPage();
        }

        doc.setFontSize(18);
        doc.setFont('NotoSans', 'bold');
        doc.setTextColor(titleColor);
        const titleLines = doc.splitTextToSize(slide.title, contentWidth);
        const titleHeight = titleLines.length * 18 * 0.4;

        if (currentY + titleHeight > pageHeight - margin) {
          addNewPage();
        }
        doc.text(titleLines, margin, currentY);
        currentY += titleHeight + 15;
        doc.setFont('NotoSans', 'normal');

        slide.content.forEach(block => {
          if (block.type === 'paragraph') {
            renderTextBlock(doc, block.text, block.bold, margin, currentY, contentWidth, 12, paragraphColor);
            currentY += 10;
          } else if (block.type === 'bullet_list' || block.type === 'numbered_list') {
            const listItemIndent = 10;
            const itemSpacing = 3;
            doc.setFontSize(11);

            block.items.forEach((item, index) => {
              const prefix = block.type === 'bullet_list' ? '• ' : `${index + 1}. `;
              const itemText = prefix + item.text;
              const boldParts = item.bold || [];

              const itemHeight = renderTextBlock(doc, itemText, boldParts, margin + listItemIndent, currentY, contentWidth - listItemIndent, 11, listItemColor);
              currentY += itemSpacing;
            });
            currentY += 10;
          } else if (block.type === 'table') {
            renderTable(doc, block.headers, block.rows, margin, currentY, contentWidth, 10);
            currentY += 10;
          }
        });
      });

      const docName = `${topic.replace(/\s+/g, '_') || 'document'}.pdf`;
      doc.save(docName);
      toast({
        title: 'Document Downloaded',
        description: 'Your PDF document has been downloaded locally.',
      });

    } catch (error) {
      console.error('Error generating PDF:', error);
      toast({ title: 'Error', description: 'Failed to generate PDF.', variant: 'destructive' });
    } finally {
      setIsModifying(false);
    }
  };

  const handleExportToPptx = async () => {
    setIsModifying(true);
    try {
      const { generatePptx } = await import('@/lib/ppt-generator');
      const docName = `${topic.replace(/\s+/g, '_') || 'document'}.pptx`;
      if (!virtualSlideRef.current) {
        throw new Error("Virtual slide element not found for measurement.");
      }
      await generatePptx(slides, docName, virtualSlideRef.current);
      toast({
        title: 'Document Downloaded',
        description: 'Your PowerPoint document has been downloaded locally.',
      });
    } catch (error) {
      console.error('Error generating PPTX:', error);
      toast({ title: 'Error', description: 'Failed to generate PowerPoint.', variant: 'destructive' });
    } finally {
      setIsModifying(false);
    }
  };

  const handleExportToWord = async () => {
    setIsModifying(true);
    try {
      const createTextRuns = (text: string, bold?: string[]): TextRun[] => {
        if (!text) return [new TextRun({ text: '' })];
        if (!bold || bold.length === 0) {
          return [new TextRun({ text })];
        }

        const boldEscaped = bold.map(b => b.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'));
        const regex = new RegExp(`(${boldEscaped.join('|')})`, 'g');
        const parts = text.split(regex).filter(Boolean);

        return parts.map(part => {
          return new TextRun({ text: part, bold: bold.includes(part) });
        });
      };

      const docChildren: (Paragraph | Table)[] = [];

      slides.forEach((slide) => {
        docChildren.push(
          new Paragraph({
            text: slide.title,
            heading: HeadingLevel.HEADING_1,
            spacing: { after: 200 },
          })
        );

        slide.content.forEach((item) => {
          switch (item.type) {
            case 'paragraph':
              docChildren.push(new Paragraph({ children: createTextRuns(item.text, item.bold), spacing: { after: 100 } }));
              break;
            case 'bullet_list':
              item.items.forEach((listItem) => docChildren.push(new Paragraph({ children: createTextRuns(listItem.text, listItem.bold), bullet: { level: 0 }, spacing: { after: 50 } })));
              break;
            case 'numbered_list':
              item.items.forEach((listItem) => docChildren.push(new Paragraph({ children: createTextRuns(listItem.text, listItem.bold), numbering: { reference: 'default-numbering', level: 0 }, spacing: { after: 50 } })));
              break;
            case 'table':
              const headerRow = new DocxTableRow({ children: item.headers.map((header) => new TableCell({ children: [new Paragraph({ children: createTextRuns(header), alignment: AlignmentType.CENTER })], shading: { fill: 'EBF2FA' } })), tableHeader: true });
              const bodyRows = item.rows.map((row) => new DocxTableRow({ children: row.cells.map((cellText) => new TableCell({ children: [new Paragraph({ children: createTextRuns(cellText) })] })) }));
              docChildren.push(new Table({ rows: [headerRow, ...bodyRows], width: { size: 9000, type: 'dxa' }, borders: { top: { style: BorderStyle.SINGLE, size: 1, color: "D3D3D3" }, bottom: { style: BorderStyle.SINGLE, size: 1, color: "D3D3D3" }, left: { style: BorderStyle.SINGLE, size: 1, color: "D3D3D3" }, right: { style: BorderStyle.SINGLE, size: 1, color: "D3D3D3" }, insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: "D3D3D3" }, insideVertical: { style: BorderStyle.SINGLE, size: 1, color: "D3D3D3" } } }));
              docChildren.push(new Paragraph({ text: '', spacing: { after: 200 } }));
              break;
            case 'note':
              const noteRuns: TextRun[] = [new TextRun({ text: 'Note: ', italics: true })];
              const cleanedText = item.text.replace(/^Note:\s*/i, '');
              const contentRuns = createTextRuns(cleanedText);
              contentRuns.forEach(run => noteRuns.push(new TextRun({ ...run, italics: true })));
              docChildren.push(new Paragraph({ children: noteRuns, spacing: { after: 100 } }));
              break;
          }
        });
      });

      const doc = new Document({ numbering: { config: [{ levels: [{ level: 0, format: 'decimal', text: '%1.', alignment: AlignmentType.LEFT }], reference: 'default-numbering' }] }, sections: [{ children: docChildren }] });
      const blob = await Packer.toBlob(doc);
      const docName = `${topic.replace(/\s+/g, '_') || 'document'}.docx`;
      saveAs(blob, docName);
      toast({ title: 'Word Document Downloaded', description: 'Your document has been downloaded.' });
    } catch (error) {
      console.error('Error generating docx:', error);
      toast({ title: 'Error', description: 'Failed to generate Word document.', variant: 'destructive' });
    } finally {
      setIsModifying(false);
    }
  };

  const virtualSlideRef = React.useRef<HTMLDivElement>(null);

  const allSelected = selectedIndices.length > 0 && selectedIndices.length === slides.length;
  const someSelected = selectedIndices.length > 0 && selectedIndices.length < slides.length;
  const checkboxState = allSelected ? true : someSelected ? 'indeterminate' : false;

  return (
    <div className="relative w-full max-w-full overflow-x-hidden mobile-container">
      {/* Hidden virtual slide for height measurements - mimics codePPT.html */}
      <div
        id="virtual-slide"
        ref={virtualSlideRef}
        style={{
          position: 'absolute',
          top: '-9999px',
          left: '-9999px',
          visibility: 'hidden',
          width: '880px', /* 960px slide width - 40px left/right padding */
          padding: '0',
          fontFamily: 'Inter, sans-serif',
        }}
      ></div>
      <Card className="border shadow-sm w-full max-w-full overflow-x-hidden">
        <CardHeader>
          <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 flex-1">
              <CardTitle>Content Editor</CardTitle>
              <CardDescription>Review, edit, and reorder your content before exporting.</CardDescription>
            </div>
            <Button variant="outline" onClick={onNewCase} disabled={isModifying} className="w-full shrink-0 sm:w-auto">
              <PlusCircle className="mr-2 h-4 w-4" /> New Case
            </Button>
          </div>
          <div className="flex flex-col gap-4 pt-4 md:flex-row md:items-end">
            <div className="flex-grow space-y-1">
              <Label htmlFor="topic-refresh" className="text-xs font-medium text-muted-foreground">Presentation Topic</Label>
              <Input id="topic-refresh" value={topic} onChange={(e) => setTopic(e.target.value)} />
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <Button variant="outline" onClick={handleAddSectionClick} disabled={isModifying} className="w-full sm:w-auto"><Plus className="mr-2 h-4 w-4" />Add Section</Button>
              <Button variant="outline" onClick={handleCopyRawContent} disabled={isModifying || slides.length === 0} className="w-full sm:w-auto"><ClipboardCopy className="mr-2 h-4 w-4" />Copy Raw</Button>
              <Button onClick={handleExportToWord} disabled={isModifying || slides.length === 0} className="w-full sm:w-auto"><File className="mr-2 h-4 w-4" />Word</Button>
              <Button onClick={handleExportToPdf} disabled={isModifying || slides.length === 0} className="w-full sm:w-auto"><FileDown className="mr-2 h-4 w-4" />PDF</Button>
              <Button onClick={handleExportToPptx} disabled={isModifying || slides.length === 0} className="w-full sm:w-auto"><File className="mr-2 h-4 w-4" />PowerPoint</Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2 border-b pb-2">
            <Checkbox id="select-all" onCheckedChange={handleSelectAll} checked={checkboxState} aria-label="Select all slides" />
            <Label htmlFor="select-all" className="text-sm font-medium">
              {selectedIndices.length > 0 ? `${selectedIndices.length} of ${slides.length} selected` : 'Select sections to modify'}
            </Label>
          </div>

          <div className="grid gap-4 sm:gap-6 w-full max-w-full overflow-x-hidden">
            {slides.map((slide, index) => (
              <div key={slide.title} className="relative w-full max-w-full mobile-slide overflow-x-hidden">
                {/* Selection Overlay */}
                <div className="absolute top-3 left-3 sm:top-4 sm:left-4 z-10">
                  <Checkbox
                    id={`select-${index}`}
                    checked={selectedIndices.includes(index)}
                    onCheckedChange={(checked) => handleSelectionChange(index, !!checked)}
                    aria-label={`Select slide ${index + 1}`}
                    className="bg-white/20 border-white/40 data-[state=checked]:bg-white data-[state=checked]:text-black"
                  />
                </div>

                {/* Top Action Buttons - positioned above slide title */}
                {selectedIndices.includes(index) && (
                  <div className="absolute top-2 left-1/2 transform -translate-x-1/2 -translate-y-2 z-20 flex space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleModifySlides('replace_content')}
                      disabled={isModifying}
                      className="flex items-center gap-2 text-sm bg-background/95 backdrop-blur-sm hover:bg-background/100 border border-border shadow-lg transition-all duration-200 px-3 py-2 rounded-lg hover:shadow-xl"
                    >
                      <RefreshCw className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                      <span className="font-medium text-foreground">Refresh</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleModifySlides('expand_selected')}
                      disabled={isModifying}
                      className="flex items-center gap-2 text-sm bg-background/95 backdrop-blur-sm hover:bg-background/100 border border-border shadow-lg transition-all duration-200 px-3 py-2 rounded-lg hover:shadow-xl"
                    >
                      <Scaling className="h-4 w-4 text-green-600 dark:text-green-400" />
                      <span className="font-medium text-foreground">Expand</span>
                    </Button>
                  </div>
                )}

                {/* Delete Button - Top Right */}
                <div className="absolute top-3 right-3 sm:top-4 sm:right-4 z-10">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeSlide(index)}
                    className="h-7 w-7 sm:h-8 sm:w-8 bg-red-500/20 hover:bg-red-500/30 text-red-200 hover:text-white border border-red-400/30 transition-all duration-200"
                  >
                    <Trash2 className="h-3 w-3 sm:h-4 sm:w-4" />
                  </Button>
                </div>

                <EnhancedSlideRenderer
                  slide={slide}
                  index={index}
                  isSelected={selectedIndices.includes(index)}
                  isLoading={loadingSlides.has(index)}
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={isAddSectionModalOpen} onOpenChange={setIsAddSectionModalOpen}>
        <AlertDialogContent className="max-h-[90vh] flex flex-col">
          <AlertDialogHeader>
            <AlertDialogTitle>Add New Section</AlertDialogTitle>
            <AlertDialogDescription>Select suggested topics or enter your own to add new slides.</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex-grow overflow-y-auto pr-6 -mr-6">
            {isSuggestingTopics && newTopicSuggestions.length === 0 ? (
              <div className="flex items-center justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
            ) : (
              <div className="grid gap-4">
                <div className="grid gap-2">
                  {newTopicSuggestions.length > 0 && <p className="text-sm font-medium">Suggested Topics:</p>}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {newTopicSuggestions.map((topic, index) => (
                      <div key={index} className={`flex items-center space-x-2 ${(usedTopics.includes(topic) || slides.some(slide => slide.title === topic)) ? 'opacity-50' : ''}`}>
                        <Checkbox
                          id={`new-topic-${index}`}
                          checked={selectedNewTopics.includes(topic) || usedTopics.includes(topic) || slides.some(slide => slide.title === topic)}
                          disabled={usedTopics.includes(topic) || slides.some(slide => slide.title === topic)}
                          onCheckedChange={(checked) => {
                            setSelectedNewTopics(prev => checked ? [...prev, topic] : prev.filter(t => t !== topic));
                          }}
                        />
                        <Label htmlFor={`new-topic-${index}`} className={`font-normal ${(usedTopics.includes(topic) || slides.some(slide => slide.title === topic)) ? 'line-through text-muted-foreground' : ''}`}>
                          {topic}
                          {(usedTopics.includes(topic) || slides.some(slide => slide.title === topic)) && <span className="ml-2 text-xs text-muted-foreground">(Already used)</span>}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex flex-col gap-2 mt-4">
                  <Label htmlFor="custom-topic">Or enter a custom topic:</Label>
                  <Input id="custom-topic" placeholder="e.g., 'Advanced Diagnostic Techniques'" value={customTopic} onChange={(e) => setCustomTopic(e.target.value)} />
                </div>
              </div>
            )}
          </div>
          <AlertDialogFooter className="mt-4 pt-4 border-t">
            <Button variant="outline" onClick={fetchNewTopicSuggestions} disabled={isSuggestingTopics}>
              {isSuggestingTopics ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              Get New Topics
            </Button>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button onClick={handleAddSelectedSlides} disabled={isModifying || (selectedNewTopics.length === 0 && !customTopic.trim())}>
              {isModifying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />} Add Selected
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}
