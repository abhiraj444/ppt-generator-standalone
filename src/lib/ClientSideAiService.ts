import { GoogleGenerativeAI } from '@google/generative-ai';

export const ClientSideAiService = {
    async getGeminiModel(apiKey: string) {
        const genAI = new GoogleGenerativeAI(apiKey);
        return genAI.getGenerativeModel({ model: 'gemini-3-flash-preview' });
    },

    async generateDiagnosis(apiKey: string, patientData?: string, images?: string[]) {
        const model = await this.getGeminiModel(apiKey);

        let prompt = `
      You are a medical AI assistant. Analyze the following patient data and provide a provisional diagnosis, confidence level, and reasoning.
      
      **Constraints:**
      1. Output MUST be a valid JSON array of objects.
      2. Each object must have: "diagnosis", "confidenceLevel" (a number between 0 and 1, e.g., 0.85), "reasoning", and "missingInformation" (which is an object with "information" and "tests" arrays).
    `;

        if (patientData) prompt += `\n\nPatient Data: ${patientData}`;

        const parts: any[] = [prompt];

        if (images && images.length > 0) {
            for (const img of images) {
                const base64Data = img.split(',')[1];
                const mimeType = img.split(',')[0].split(':')[1].split(';')[0];
                parts.push({
                    inlineData: {
                        data: base64Data,
                        mimeType: mimeType
                    }
                });
            }
        }

        const result = await model.generateContent(parts);
        const response = await result.response;
        const text = response.text();

        try {
            const jsonMatch = text.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }
        } catch (e) {
            console.error('Failed to parse diagnosis JSON:', e);
        }

        return [{
            diagnosis: "AI Analysis Result",
            confidenceLevel: 0.5,
            reasoning: text,
            missingInformation: { information: [], tests: [] }
        }];
    },

    async answerClinicalQuestion(apiKey: string, question?: string, images?: string[]) {
        const model = await this.getGeminiModel(apiKey);

        let prompt = `
      Answer the following clinical question in detail with reasoning.
      
      **Constraints:**
      1. Output MUST be a valid JSON object.
      2. The object must have: "answer", "reasoning", and "topic".
    `;

        if (question) prompt += `\n\nQuestion: ${question}`;

        const parts: any[] = [prompt];

        if (images && images.length > 0) {
            for (const img of images) {
                const base64Data = img.split(',')[1];
                const mimeType = img.split(',')[0].split(':')[1].split(';')[0];
                parts.push({
                    inlineData: {
                        data: base64Data,
                        mimeType: mimeType
                    }
                });
            }
        }

        const result = await model.generateContent(parts);
        const response = await result.response;
        const text = response.text();

        try {
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }
        } catch (e) {
            console.error('Failed to parse answer JSON:', e);
        }

        return {
            answer: text,
            reasoning: "Analysis performed by Gemini 3 Flash Preview",
            topic: "Clinical Analysis"
        };
    },

    async summarizeQuestion(apiKey: string, question?: string, images?: string[]) {
        const model = await this.getGeminiModel(apiKey);
        let prompt = "Summarize the following clinical question or patient data into a concise 1-2 sentence summary for a case title.";
        if (question) prompt += `\n\nInput: ${question}`;

        const parts: any[] = [prompt];
        if (images && images.length > 0) {
            for (const img of images) {
                const base64Data = img.split(',')[1];
                const mimeType = img.split(',')[0].split(':')[1].split(';')[0];
                parts.push({ inlineData: { data: base64Data, mimeType } });
            }
        }

        const result = await model.generateContent(parts);
        return { summary: result.response.text() };
    },

    async generatePresentationOutline(apiKey: string, input: { question?: string, answer?: string, reasoning?: string, topic?: string }) {
        const model = await this.getGeminiModel(apiKey);
        let prompt = "";

        if (input.topic) {
            prompt = `
        Generate a concise and high-yield presentation outline for the medical topic: **${input.topic}**.
        Provide exactly 15 slide titles in total.
        Output a valid JSON object with a single key "outline" whose value is an array of 15 strings.
      `;
        } else {
            prompt = `
        Generate a presentation outline of 10-12 topics based on the clinical case provided.
        The VERY FIRST topic MUST be "Clinical Case Summary and Key Questions".
        Output a valid JSON object with a single key "outline" containing an array of strings.
        
        Case Details:
        Question: ${input.question}
        Answer: ${input.answer}
        Reasoning: ${input.reasoning}
      `;
        }

        const result = await model.generateContent(prompt);
        const text = result.response.text();

        try {
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (jsonMatch) return JSON.parse(jsonMatch[0]);
        } catch (e) {
            console.error('Failed to parse outline JSON:', e);
        }

        return { outline: ["Introduction", "Pathophysiology", "Clinical Features", "Diagnosis", "Management", "Case Studies", "Conclusion"] };
    },

    async generateSlideContent(apiKey: string, input: any) {
        const model = await this.getGeminiModel(apiKey);
        const prompt = `You are an expert in medical education. Your task is to generate detailed slide content for a presentation based on a provided list of topics.

**Source Information:**
- **Main Topic:** ${input.topic}
${input.fullQuestion ? `- **Full Original Question:** ${input.fullQuestion}` : ''}
${input.fullAnswer ? `- **Full Original Answer:** ${input.fullAnswer}` : ''}
${input.fullReasoning ? `- **Full Original Reasoning:** ${input.fullReasoning}` : ''}

**Topics for Slide Generation:**
${input.selectedTopics.map((t: string) => `- ${t}`).join('\n')}

**Core Instructions:**

1.  **Generate one slide for EACH topic listed in "Topics for Slide Generation".** The output must be a JSON array containing exactly one slide object per topic.
2.  **Handle the "Clinical Question, Answer, and Analysis Summary" topic:**
    *   If this specific topic is in the list, the corresponding slide MUST be titled "Case Presentation".
    *   The content for this slide MUST be generated using the "Full Original Question," "Full Original Answer," and a summary of the "Full Original Reasoning" provided above. Do not use any other information for this slide.
3.  **For all other topics:**
    *   Generate technically rich, detailed, and condensed content suitable for a professional medical audience.
    *   Fill each slide with substantial information. Use tables frequently to compare/contrast concepts or summarize data.
    *   Do **NOT** include a "Conclusion" or "Summary" slide unless it is explicitly requested as a topic.

**Formatting & Table Rules:**
Format the entire output as a JSON array of slide objects. Each slide object must conform to the following rules:
1.  **Slide Object**: Each slide is an object with a "title" (string) and a "content" (array of content items). The title must exactly match the topic from the input list, except for the special "Case Presentation" title.
2.  **Content Breakdown**: Deconstruct complex topics into multiple small, distinct points. Use 'bullet_list' or 'numbered_list' extensively. Each item in a list should be concise. Avoid long paragraphs; use lists to convey information concisely. For each slide, aim for a maximum of 6-8 distinct points (bullets, list items, or table rows) to ensure clarity and readability.
3.  **Content Array**: The "content" array contains different types of content objects. Do NOT put too much content on a single slide; create more slides if a topic is complex. Each content item must be an object with a "type" field.
4.  **Bolding**: For "paragraph" and list "items", use the 'bold' array to specify substrings of the 'text' that should be bolded. **Do NOT use markdown like '**text**' inside any text fields.**
5.  **Table Rules (CRITICAL):**
    *   When creating a "table" content item, the number of items in each 'cells' array inside 'rows' MUST be exactly equal to the number of items in the 'headers' array.
    *   Before outputting the JSON, you MUST validate every table. If a row has a different number of cells than the header, you MUST correct it. **This is a strict requirement; failure to comply will result in an error.**

Supported "type" values for content items:
- **"paragraph"**: For a block of text. This should be used sparingly.
  - "text": The full paragraph string.
  - "bold": (Optional) An array of substrings from "text" that should be formatted as bold.
- **"bullet_list"**: For an unordered list.
  - "items": An array of list item objects. Each object must have a "text" field and can have an optional "bold" array.
- **"numbered_list"**: For an ordered list.
  - "items": An array of list item objects. Each object must have a "text" field and can have an optional "bold" array.
- **"note"**: For a brief, supplementary note.
  - "text": The content of the note.
- **"table"**: For tabular data.
  - "headers": An array of strings for the table column headers.
  - "rows": An array of row objects. Each object has a "cells" property, which is an array of strings for that row.

Example:
[
  {
    "title": "Introduction to Condition X",
    "content": [
      { "type": "paragraph", "text": "Condition X is a chronic inflammatory disease affecting the joints.", "bold": ["Condition X", "chronic inflammatory disease"] },
      { "type": "bullet_list", "items": [ { "text": "Symptom A" }, { "text": "Symptom B is more complex.", "bold": ["Symptom B"] } ] }
    ]
  },
  {
    "title": "Diagnostic Criteria",
    "content": [
       { "type": "table", "headers": ["Criteria", "Description"], "rows": [{ "cells": ["Criteria 1", "Details for 1"] }, { "cells": ["Criteria 2", "Details for 2"] }] }
    ]
  }
]

Produce ONLY the JSON array and nothing else. Ensure it is valid JSON.
`;

        const result = await model.generateContent(prompt);
        const text = result.response.text();

        try {
            // Try to extract JSON array from the response
            const jsonMatch = text.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
                let jsonText = jsonMatch[0];

                // Clean up ONLY problematic escaped characters that break JSON
                // Remove literal \n and \t that appear in the raw text (not in strings)
                // This is more conservative than before - only fixes actual issues
                jsonText = jsonText.replace(/\\n/g, ' ');
                jsonText = jsonText.replace(/\\t/g, ' ');

                const parsed = JSON.parse(jsonText);
                return parsed;
            }
        } catch (e) {
            console.error('Failed to parse slides JSON:', e);
            console.error('Raw LLM response:', text);
        }

        // Fallback: return placeholder slides
        return input.selectedTopics.map((t: string) => ({
            title: t,
            content: [{
                type: 'paragraph',
                text: 'Content generation failed. Please try again or select fewer topics.'
            }]
        }));
    },

    async suggestTopics(apiKey: string, input: { question?: string, topic?: string, existingTopics: string[] }) {
        const model = await this.getGeminiModel(apiKey);
        const prompt = `
      Based on the following ${input.topic ? 'medical topic' : 'clinical question'}, suggest 5-7 new, highly technical medical topics for a presentation.
      Exclude existing topics: ${input.existingTopics.join(', ')}
      
      Output a JSON object with a single key "topics" containing an array of strings.
      ${input.topic ? `Topic: ${input.topic}` : `Question: ${input.question}`}
    `;

        const result = await model.generateContent(prompt);
        const text = result.response.text();
        try {
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (jsonMatch) return JSON.parse(jsonMatch[0]);
        } catch (e) {
            console.error('Failed to parse topics JSON:', e);
        }
        return { topics: [] };
    },

    async generateSingleSlide(apiKey: string, topic: string) {
        const model = await this.getGeminiModel(apiKey);
        const prompt = `
      You are an expert in medical education. Your task is to generate the content for a single presentation slide based on the provided topic.

      **Topic:** ${topic}

      **Instructions:**
      1.  The slide's "title" must be the exact topic provided above.
      2.  The "content" should be technically rich, detailed, and suitable for a professional medical audience.
      3.  Break down the topic into multiple small, distinct points. Use bullet lists, numbered lists, or tables extensively. Avoid long paragraphs.
      4.  Format the entire output as a single JSON object that conforms to the slide schema, having a "title" and a "content" array.
      5.  Do NOT include a "Conclusion" or "Summary" slide. The presentation should end on a technical note.

      **Content Schema:**
      -   \`{"type": "paragraph", "text": "...", "bold": ["...", "..."]}\`
      -   \`{"type": "bullet_list", "items": [{"text": "...", "bold": ["..."]}, ...]}\`
      -   \`{"type": "numbered_list", "items": [{"text": "...", "bold": ["..."]}, ...]}\`
      -   \`{"type": "note", "text": "..."}\`
      -   \`{"type": "table", "headers": ["...", "..."], "rows": [{"cells": ["...", "..."]}, ...]}\`

      **Critical Rules:**
      - Each content item MUST have a "type" field
      - For "paragraph" and list "items", use the "bold" array to specify substrings that should be bolded
      - Do NOT use markdown like '**text**' inside any text fields
      - For tables, ensure the number of cells in each row matches the number of headers

      Produce the JSON object and nothing else.
    `;

        const result = await model.generateContent(prompt);
        const text = result.response.text();
        try {
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (jsonMatch) return JSON.parse(jsonMatch[0]);
        } catch (e) {
            console.error('Failed to parse single slide JSON:', e);
        }
        return { title: topic, content: [{ type: 'paragraph', text: 'Failed to generate content.' }] };
    },

    async modifySlides(apiKey: string, input: { slides: any[], selectedIndices: number[], action: string }) {
        const model = await this.getGeminiModel(apiKey);
        const prompt = `
      Modify the following medical presentation slides based on the action: ${input.action}.
      Selected indices: ${input.selectedIndices.join(', ')}
      Current slides: ${JSON.stringify(input.slides)}
      
      Output the COMPLETE array of all slides (modified and unmodified).
    `;

        const result = await model.generateContent(prompt);
        const text = result.response.text();
        try {
            const jsonMatch = text.match(/\[[\s\S]*\]/);
            if (jsonMatch) return JSON.parse(jsonMatch[0]);
        } catch (e) {
            console.error('Failed to parse modified slides JSON:', e);
        }
        return input.slides;
    }
};
