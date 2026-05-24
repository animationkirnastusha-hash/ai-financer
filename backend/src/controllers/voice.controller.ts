import type { Request, Response } from 'express';
import {
  VoiceAudioTooLargeError,
  VoiceAudioUnsupportedError,
  VoiceProviderRequestError,
  VoiceTranscriptionNotConfiguredError,
  voiceService,
} from '../services/voice.service';


function sanitizeVoiceDebugDetails(details: unknown) {
  if (!details || typeof details !== 'object' || Array.isArray(details)) return undefined;

  const allowedKeys = new Set([
    'mode',
    'state',
    'error',
    'code',
    'status',
    'mimeType',
    'extension',
    'blobSize',
    'isSupported',
    'permissionState',
    'recordingState',
    'elapsedMs',
    'userAgent',
    'url',
    'visibilityState',
  ]);

  const source = details as Record<string, unknown>;
  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(source)) {
    if (!allowedKeys.has(key)) continue;

    if (typeof value === 'string') {
      sanitized[key] = value.slice(0, 240);
      continue;
    }

    if (typeof value === 'number' || typeof value === 'boolean' || value === null) {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

export async function logVoiceDebug(req: Request, res: Response) {
  const event = typeof req.body?.event === 'string' ? req.body.event.slice(0, 80) : 'voice_debug';
  const details = sanitizeVoiceDebugDetails(req.body?.details);
  const userId = typeof (req as Request & { userId?: unknown }).userId === 'string'
    ? (req as Request & { userId?: string }).userId
    : undefined;

  if (process.env.VOICE_DEBUG_LOGS !== '0') {
    console.info('[voice-debug]', JSON.stringify({
      at: new Date().toISOString(),
      userId,
      event,
      details,
    }));
  }

  return res.json({ success: true });
}

export async function getVoiceStatus(_req: Request, res: Response) {
  return res.json({
    success: true,
    ...voiceService.getStatus(),
  });
}

export async function transcribeVoice(req: Request, res: Response) {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        code: 'VOICE_AUDIO_REQUIRED',
        message: 'Audio file is required.',
      });
    }

    const result = await voiceService.transcribe({
      buffer: req.file.buffer,
      mimeType: req.file.mimetype,
      originalName: req.file.originalname,
      language: typeof req.body?.language === 'string' ? req.body.language : undefined,
    });

    return res.json({
      success: true,
      text: result.text,
      provider: result.provider,
      model: result.model,
      language: result.language,
    });
  } catch (error) {
    if (error instanceof VoiceTranscriptionNotConfiguredError) {
      return res.status(503).json({
        success: false,
        message: 'Voice transcription is not configured on the server.',
        code: 'VOICE_TRANSCRIPTION_NOT_CONFIGURED',
      });
    }

    if (error instanceof VoiceAudioTooLargeError) {
      return res.status(413).json({
        success: false,
        message: 'Audio file is too large.',
        code: 'VOICE_AUDIO_TOO_LARGE',
      });
    }

    if (error instanceof VoiceAudioUnsupportedError) {
      return res.status(415).json({
        success: false,
        message: 'Unsupported audio format.',
        code: 'VOICE_AUDIO_UNSUPPORTED',
      });
    }

    if (error instanceof VoiceProviderRequestError) {
      console.error('Voice provider request failed:', {
        provider: error.provider,
        status: error.status,
        code: error.code,
        details: error.details,
      });

      return res.status(error.status >= 400 && error.status < 600 ? error.status : 502).json({
        success: false,
        message: 'Voice transcription provider failed.',
        code: error.code,
        provider: error.provider,
      });
    }

    console.error('Voice transcription failed:', error);

    return res.status(500).json({
      success: false,
      message: 'Voice transcription failed.',
      code: 'VOICE_TRANSCRIPTION_FAILED',
    });
  }
}
