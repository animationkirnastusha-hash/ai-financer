import type { Request, Response } from 'express';
import {
  VoiceAudioTooLargeError,
  VoiceAudioUnsupportedError,
  VoiceProviderRequestError,
  VoiceTranscriptionNotConfiguredError,
  voiceService,
} from '../services/voice.service';
import {
  VoiceTtsNotConfiguredError,
  VoiceTtsProviderError,
  voiceTtsService,
} from '../services/voice-tts.service';


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
    'visibilityState',
    'textLength',
    'hasText',
    'provider',
    'model',
    'language',
    'originalName',
    'platform',
    'peakRms',
    'rms',
    'silenceMs',
    'graceMs',
    'sessionMs',
    'audioTracks',
    'persistentStream',
    'candidates',
    'role',
    'segmentCount',
    'correctionCount',
    'target',
    'kind',
    'reason',
    'visualOnly',
    'cooldownMs',
    'missCount',
    'commandLength',
    'matchType',
    'source',
    'voiceState',
    'pointerActive',
    'isPressed',
    'deferredStop',
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

  if (process.env.VOICE_DEBUG_LOGS === '1') {
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
    ...voiceTtsService.getStatus(),
  });
}

export async function transcribeVoice(req: Request, res: Response) {
  const startedAt = Date.now();
  const userId = typeof (req as Request & { userId?: unknown }).userId === 'string'
    ? (req as Request & { userId?: string }).userId
    : undefined;

  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        code: 'VOICE_AUDIO_REQUIRED',
        message: 'Audio file is required.',
      });
    }

    if (process.env.VOICE_DEBUG_LOGS === '1') {
      console.info('[voice-transcribe]', JSON.stringify({
        at: new Date().toISOString(),
        userId,
        event: 'transcribe_received',
        details: {
          mimeType: req.file.mimetype,
          originalName: req.file.originalname,
          blobSize: req.file.size,
        },
      }));
    }

    const result = await voiceService.transcribe({
      buffer: req.file.buffer,
      mimeType: req.file.mimetype,
      originalName: req.file.originalname,
      language: typeof req.body?.language === 'string' ? req.body.language : undefined,
    });

    if (process.env.VOICE_DEBUG_LOGS === '1') {
      console.info('[voice-transcribe]', JSON.stringify({
        at: new Date().toISOString(),
        userId,
        event: 'transcribe_finished',
        details: {
          provider: result.provider,
          model: result.model,
          language: result.language,
          elapsedMs: Date.now() - startedAt,
          textLength: result.text.length,
          hasText: Boolean(result.text.trim()),
        },
      }));
    }

    return res.json({
      success: true,
      text: result.text,
      provider: result.provider,
      model: result.model,
      language: result.language,
    });
  } catch (error) {
    if (process.env.VOICE_DEBUG_LOGS === '1') {
      console.info('[voice-transcribe]', JSON.stringify({
        at: new Date().toISOString(),
        userId,
        event: 'transcribe_failed',
        details: {
          elapsedMs: Date.now() - startedAt,
          error: error instanceof Error ? error.name : 'unknown',
          code: error instanceof VoiceProviderRequestError ? error.code : error instanceof Error ? error.message : 'unknown',
          status: error instanceof VoiceProviderRequestError ? error.status : undefined,
        },
      }));
    }
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


export async function getVoiceCueAudio(req: Request, res: Response) {
  const rawCue = typeof req.params.cue === 'string' ? req.params.cue : '';

  if (!voiceTtsService.isCue(rawCue)) {
    return res.status(404).json({
      success: false,
      code: 'VOICE_TTS_CUE_NOT_FOUND',
      message: 'Voice cue not found.',
    });
  }

  try {
    const result = await voiceTtsService.getCueAudio(rawCue);

    if (process.env.VOICE_DEBUG_LOGS === '1') {
      const userId = typeof (req as Request & { userId?: unknown }).userId === 'string'
        ? (req as Request & { userId?: string }).userId
        : undefined;
      console.info('[voice-tts]', JSON.stringify({
        at: new Date().toISOString(),
        userId,
        event: 'tts_cue_served',
        details: {
          cue: result.cue,
          cached: result.cached,
          textLength: result.text.length,
        },
      }));
    }

    res.setHeader('Content-Type', result.contentType);
    res.setHeader('Cache-Control', 'private, max-age=604800');
    res.setHeader('X-Voice-Cue', result.cue);
    return res.send(result.buffer);
  } catch (error) {
    if (error instanceof VoiceTtsNotConfiguredError) {
      return res.status(503).json({
        success: false,
        code: 'VOICE_TTS_NOT_CONFIGURED',
        message: 'Voice TTS is not configured on the server.',
      });
    }

    if (error instanceof VoiceTtsProviderError) {
      console.error('Voice TTS provider failed:', {
        status: error.status,
        code: error.code,
        details: error.details,
      });

      return res.status(error.status >= 400 && error.status < 600 ? error.status : 502).json({
        success: false,
        code: error.code,
        message: 'Voice TTS provider failed.',
      });
    }

    console.error('Voice TTS failed:', error);
    return res.status(500).json({
      success: false,
      code: 'VOICE_TTS_FAILED',
      message: 'Voice TTS failed.',
    });
  }
}
