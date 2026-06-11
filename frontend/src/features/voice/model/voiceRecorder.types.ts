export type VoiceRecorderState = 'idle' | 'recording' | 'uploading' | 'error';

export type UseVoiceRecorderParams = {
  onText: (text: string) => Promise<void> | void;
  lang?: string;
  chunkMs?: number;
};
