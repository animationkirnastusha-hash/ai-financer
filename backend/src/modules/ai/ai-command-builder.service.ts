import { AIHandleOptions } from './types';

export class AICommandBuilderService {
  build(command: string, options: AIHandleOptions = {}) {
    const voiceSession = options.voiceSession;

    if (options.source === 'voice' && (!voiceSession || !Array.isArray(voiceSession.segments) || !voiceSession.segments.length)) {
      return [
        'VOICE_TRANSCRIPT_COMMAND.',
        'The user dictated this by voice. Speech recognition can confuse amounts, account names and short financial words. Preserve explicit compact amounts such as 20к, 20 тыс, 20 тысяч and do not substitute them with a nearby value. If a critical field is not explicit enough, leave it missing so validator asks one clarification instead of guessing.',
        `Transcript: ${command}`,
      ].join('\n');
    }

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
      'The user dictated one command in several speech segments. Later correction segments override earlier conflicting details. Preserve earlier details that were not explicitly cancelled or replaced, especially explicit compact amounts such as 20к, 20 тыс or 20 тысяч. Do not create two competing plans. Resolve one final intended financial action. If uncertain, ask one clarification.',
      'Segments:',
      segments,
      `Final transcript: ${voiceSession.finalText || command}`,
    ].join('\n');
  }
}
