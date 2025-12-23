'use client';

import Link from 'next/link';
import type { LocalCase } from '@/lib/LocalDataService';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { FileText } from 'lucide-react';

interface HistoryCardProps {
  caseItem: LocalCase;
}

export function HistoryCard({ caseItem }: HistoryCardProps) {
  const date = new Date(caseItem.createdAt).toLocaleString();
  const linkPath = caseItem.type === 'diagnosis' ? '/ai-diagnosis' : '/content-generator';

  return (
    <Card className="border shadow-sm transition-all hover:shadow-md">
      <CardHeader>
        <div className="flex justify-between items-start gap-4">
          <div className="flex-grow">
            <CardTitle className="text-lg">{caseItem.title}</CardTitle>
            <CardDescription>{date}</CardDescription>
          </div>
          <Badge variant={caseItem.type === 'diagnosis' ? 'secondary' : 'default'}>
            {caseItem.type === 'diagnosis' ? 'Diagnosis' : 'Content Gen'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex justify-between items-center">
          <Button asChild variant="outline" size="sm">
            <Link href={`${linkPath}?caseId=${caseItem.id}`}>
              <FileText className="mr-2 h-4 w-4" />
              View Case
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
