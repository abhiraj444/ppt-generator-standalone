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
      2. Each object must have: "diagnosis", "confidenceLevel", "reasoning", and "missingInformation" (which is an object with "information" and "tests" arrays).
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
            confidenceLevel: "Medium",
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
        const prompt = `
      You are an expert in medical education. Generate detailed slide content for a presentation.
      
      Main Topic: ${input.topic}
      Topics for Slide Generation: ${input.selectedTopics.join(', ')}
      
      **Constraints:**
      1. Output MUST be a valid JSON array of slide objects.
      2. Each slide object: { "title": "...", "content": [ { "type": "paragraph" | "bullet_list" | "table", ... } ] }
    `;

        const result = await model.generateContent(prompt);
        const text = result.response.text();

        try {
            const jsonMatch = text.match(/\[[\s\S]*\]/);
            if (jsonMatch) return JSON.parse(jsonMatch[0]);
        } catch (e) {
            console.error('Failed to parse slides JSON:', e);
        }

        return input.selectedTopics.map((t: string) => ({ title: t, content: [{ type: 'paragraph', text: 'Content generation failed.' }] }));
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
      Generate the content for a single medical presentation slide.
      Topic: ${topic}
      
      Output a JSON object: { "title": "${topic}", "content": [...] }
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
