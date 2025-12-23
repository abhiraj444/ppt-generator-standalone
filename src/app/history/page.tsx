'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { LocalDataService, type LocalCase } from '@/lib/LocalDataService';
import { HistoryCard } from '@/components/HistoryCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';

export default function HistoryPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [cases, setCases] = useState<LocalCase[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!user) return;

    const loadCases = async () => {
      setLoading(true);
      try {
        const casesData = await LocalDataService.getUserCases(user.id);
        setCases(casesData);
      } catch (error) {
        console.error('Failed to load cases:', error);
      } finally {
        setLoading(false);
      }
    };

    loadCases();
  }, [user]);

  if (authLoading || (!user)) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <Card className="border shadow-sm">
        <CardHeader>
          <CardTitle>Case History</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : cases.length > 0 ? (
            <div className="space-y-4">
              {cases.map((caseItem) => (
                <HistoryCard key={caseItem.id} caseItem={caseItem as any} />
              ))}
            </div>
          ) : (
            <p className="text-center text-muted-foreground">
              You have no saved cases. Your work will appear here automatically.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
