'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useSettings } from '@/context/SettingsContext';
import { ArrowLeft, Save } from 'lucide-react';

export default function SettingsPage() {
    const { apiKey, setApiKey } = useSettings();
    const [newKey, setNewKey] = useState(apiKey);
    const router = useRouter();
    const { toast } = useToast();

    const handleSave = () => {
        setApiKey(newKey);
        toast({
            title: 'Settings Saved',
            description: 'Your Gemini API Key has been updated.',
        });
        router.back();
    };

    return (
        <div className="container mx-auto max-w-2xl px-4 py-8">
            <Button variant="ghost" onClick={() => router.back()} className="mb-6">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
            </Button>

            <Card className="border shadow-sm">
                <CardHeader>
                    <CardTitle>App Settings</CardTitle>
                    <CardDescription>
                        Configure your local application settings. These are stored only on this device.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="space-y-2">
                        <Label htmlFor="api-key">Google Gemini API Key</Label>
                        <Input
                            id="api-key"
                            type="password"
                            placeholder="AIzaSy..."
                            value={newKey}
                            onChange={(e) => setNewKey(e.target.value)}
                        />
                        <p className="text-xs text-muted-foreground">
                            You can get your free API key from{' '}
                            <a
                                href="https://aistudio.google.com/apikey"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary hover:underline"
                            >
                                Google AI Studio
                            </a>.
                        </p>
                    </div>
                </CardContent>
                <CardFooter>
                    <Button onClick={handleSave} className="w-full">
                        <Save className="mr-2 h-4 w-4" />
                        Save Settings
                    </Button>
                </CardFooter>
            </Card>
        </div>
    );
}
