import { AIHandleOptions } from './types';

export class AICommandBuilderService {
  build(command: string, options: AIHandleOptions = {}) {
    const voiceSession = options.voiceSession;
    if (options.source !== 'voice_session' || !voiceSession || !Array.isArray(voiceSession.segments) || !voiceSession.segments.length) {
      return command;
    }

    const segments = voiceSession.segments
      .map((segment, index) => {
        const role = segment.role === 'correction' ? 'correction' : segment.role === 'initial' ? 'initial' : 'continuation';
        return `${index + 1}. [${role}] ${String(segment.text || '').trim()}`;
      })
      .filter((line) => line.trim())
      .join('\n');

    if (!segments) return command;

    return [
      'VOICE_SESSION_COMMAND.',
      'The user dictated one command in several speech segments. Later correction segments override earlier conflicting details. Preserve earlier details that were not explicitly cancelled or replaced. Do not create two competing plans. Resolve one final intended financial action. If uncertain, ask one clarification.',
      'Segments:',
      segments,
      `Final transcript: ${voiceSession.finalText || command}`,
    ].join('\n');
  }
}
