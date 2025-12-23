'use client';

import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

interface SettingsContextType {
    apiKey: string;
    setApiKey: (key: string) => void;
    isConfigured: boolean;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: ReactNode }) {
    const [apiKey, setApiKeyInternal] = useState<string>('');
    const [isConfigured, setIsConfigured] = useState(false);

    useEffect(() => {
        const savedKey = localStorage.getItem('gemini_api_key');
        if (savedKey) {
            setApiKeyInternal(savedKey);
            setIsConfigured(true);
        } else {
            // Use the provided default key if none is saved
            const defaultKey = 'AIzaSyDZFpZJAzz6enQDQdjCJLvo2z7Y0Kd7ofM';
            setApiKeyInternal(defaultKey);
            setIsConfigured(true);
            localStorage.setItem('gemini_api_key', defaultKey);
        }
    }, []);

    const setApiKey = (key: string) => {
        localStorage.setItem('gemini_api_key', key);
        setApiKeyInternal(key);
        setIsConfigured(!!key);
    };

    return (
        <SettingsContext.Provider value={{ apiKey, setApiKey, isConfigured }}>
            {children}
        </SettingsContext.Provider>
    );
}

export function useSettings() {
    const context = useContext(SettingsContext);
    if (context === undefined) {
        throw new Error('useSettings must be used within a SettingsProvider');
    }
    return context;
}
