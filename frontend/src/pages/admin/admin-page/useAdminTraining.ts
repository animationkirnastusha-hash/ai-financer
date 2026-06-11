import { useEffect, useState } from 'react';
import { adminApi, type AdminAITrainingExample } from '@/features/admin/api/admin.api';
import type { AdminTab } from './adminPage.types';

export function useAdminTraining(isAdmin: boolean, tab: AdminTab) {
  const [trainingExamples, setTrainingExamples] = useState<AdminAITrainingExample[]>([]);
  const [trainingDrafts, setTrainingDrafts] = useState<Record<string, string>>({});
  const [trainingBusyId, setTrainingBusyId] = useState<string | null>(null);
  const [isTrainingLoading, setIsTrainingLoading] = useState(false);

  const loadTrainingExamples = async () => {
    setIsTrainingLoading(true);
    try {
      const payload = await adminApi.aiTraining();
      setTrainingExamples(payload.items);
      setTrainingDrafts((current) => {
        const next = { ...current };
        payload.items.forEach((item) => {
          if (next[item.id] === undefined) next[item.id] = item.correctedOutput ?? '';
        });
        return next;
      });
    } finally {
      setIsTrainingLoading(false);
    }
  };

  useEffect(() => {
    if (!isAdmin || tab !== 'training') return;
    void loadTrainingExamples();
  }, [isAdmin, tab]);

  const handleSaveTrainingExample = async (exampleId: string, success: boolean) => {
    setTrainingBusyId(exampleId);
    try {
      const correctedOutput = trainingDrafts[exampleId] ?? '';
      const response = await adminApi.updateAITraining(exampleId, { correctedOutput, success });
      setTrainingExamples((items) => items.map((item) => item.id === exampleId ? response.result : item));
    } finally {
      setTrainingBusyId(null);
    }
  };

  return {
    trainingExamples,
    trainingDrafts,
    trainingBusyId,
    isTrainingLoading,
    setTrainingDrafts,
    loadTrainingExamples,
    handleSaveTrainingExample,
  };
}
