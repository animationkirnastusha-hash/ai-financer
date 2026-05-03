import type { Request, Response } from 'express';
import { voiceService } from '../services/voice.service';

export async function transcribeVoice(req: Request, res: Response) {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Audio file is required.',
      });
    }

    const result = await voiceService.transcribe({
      buffer: req.file.buffer,
      mimeType: req.file.mimetype,
      originalName: req.file.originalname,
    });

    return res.json({
      success: true,
      text: result.text,
    });
  } catch (error) {
    console.error('Voice transcription failed:', error);

    return res.status(500).json({
      success: false,
      message: 'Voice transcription failed.',
    });
  }
}