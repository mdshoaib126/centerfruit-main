import { SpeechClient } from '@google-cloud/speech';
import fetch from 'node-fetch';

interface SpeechToTextResult {
  transcript: string;
  confidence: number;
}

export class SpeechToTextService {
  private client: SpeechClient;

  constructor() {
    // Initialize Google Cloud Speech client
    // Service account key should be provided via GOOGLE_APPLICATION_CREDENTIALS env var
    this.client = new SpeechClient({
      keyFilename: process.env.GOOGLE_STT_JSON_KEY_PATH,
    });
  }

  async transcribeAudio(recordingUrl: string): Promise<SpeechToTextResult> {
    try {
      // Download the audio file
      const audioResponse = await fetch(recordingUrl);
      if (!audioResponse.ok) {
        throw new Error(`Failed to download audio: ${audioResponse.statusText}`);
      }
      
      const audioBuffer = await audioResponse.buffer();

      // Configure the request
      const request = {
        audio: {
          content: audioBuffer.toString('base64'),
        },
        config: {
          encoding: 'LINEAR16' as const,
          sampleRateHertz: 8000,
          languageCode: 'hi-IN', // Hindi for Durga Puja contest
          alternativeLanguageCodes: ['en-IN'], // Fallback to English
          enableAutomaticPunctuation: true,
          model: 'latest_short',
        },
      };

      // Perform the speech recognition
      const [sttResponse] = await this.client.recognize(request);
      
      if (!sttResponse.results || sttResponse.results.length === 0) {
        throw new Error('No transcript found in audio');
      }

      const result = sttResponse.results[0];
      const alternative = result.alternatives?.[0];
      
      if (!alternative || !alternative.transcript) {
        throw new Error('No transcript alternative found');
      }

      return {
        transcript: alternative.transcript,
        confidence: alternative.confidence || 0,
      };
    } catch (error) {
      console.error('Speech-to-text error:', error);
      throw new Error(`Failed to transcribe audio: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

export const speechToTextService = new SpeechToTextService();
