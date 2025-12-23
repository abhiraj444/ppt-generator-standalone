'use client';

// For structured slide content
export interface ParagraphContent {
    type: 'paragraph';
    text: string;
    bold?: string[];
}
export interface ListItemContent {
    text: string;
    bold?: string[];
}
export interface BulletListContent {
    type: 'bullet_list';
    items: ListItemContent[];
}
export interface NumberedListContent {
    type: 'numbered_list';
    items: ListItemContent[];
}
export interface NoteContent {
    type: 'note';
    text: string;
}
export interface TableRowContent {
    cells: string[];
}
export interface TableContent {
    type: 'table';
    headers: string[];
    rows: TableRowContent[];
}
export type ContentItem = ParagraphContent | BulletListContent | NumberedListContent | NoteContent | TableContent;

export interface Slide {
    title: string;
    content: ContentItem[];
}

export interface StructuredQuestion {
    summary: string;
    images: string[];
}

interface BaseCase {
    id: string;
    userId: string;
    title: string;
    createdAt: number; // Changed from Timestamp to number (epoch)
}

export interface DiagnosisCase extends BaseCase {
    type: 'diagnosis';
    inputData: {
        patientData?: string;
        supportingDocuments?: string[];
        structuredQuestion?: StructuredQuestion;
    };
    outputData: {
        diagnoses: any[]; // Simplified for local usage
        clinicalAnswer: any | null;
    };
}

export interface ContentCase extends BaseCase {
    type: 'content-generator';
    inputData: {
        mode: 'question' | 'topic';
        question?: string;
        images?: string[];
        topic?: string;
        structuredQuestion?: StructuredQuestion;
    };
    outputData: {
        result: any;
        slides: Slide[] | null;
    };
}

export type Case = DiagnosisCase | ContentCase;
