import { SpeechClient } from '@google-cloud/speech';
import fetch from 'node-fetch';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface SpeechToTextResult {
  transcript: string;
  confidence: number;
}

export class SpeechToTextService {
  private client: SpeechClient;

  constructor() {
    // Initialize Google Cloud Speech client
    // Use environment credentials for security
    if (process.env.NODE_ENV === 'test' || process.env.DISABLE_EXTERNAL_CALLS === 'true') {
      // In test mode, we'll return mock responses anyway
      this.client = new SpeechClient();
    } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      // Production: use GOOGLE_APPLICATION_CREDENTIALS environment variable
      this.client = new SpeechClient();
    } else {
      // Development: use the uploaded service account key if it exists
      const keyPath = path.resolve(__dirname, '../config/service-account-key.json');
      try {
        this.client = new SpeechClient({
          keyFilename: keyPath,
        });
      } catch (error) {
        console.warn('No service account key found. Speech-to-Text will use mock responses.');
        this.client = new SpeechClient();
      }
    }
  }

  async transcribeAudio(recordingUrl: string): Promise<SpeechToTextResult> {
    // Test mode: return mock transcript for testing without external API
    if (process.env.NODE_ENV === 'test' || process.env.DISABLE_EXTERNAL_CALLS === 'true') {
      return {
        transcript: "कच्चे घर में कुछ कच्चे कचौरी खाए।",
        confidence: 0.9,
      };
    }

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

  // Method to test local audio files
  async transcribeLocalFile(filePath: string): Promise<SpeechToTextResult> {
    try {
      console.log(`Testing local audio file: ${filePath}`);
      
      // Read the local audio file
      const audioBuffer = readFileSync(filePath);
      
      // Configure the request for MP3 files
      const request = {
        audio: {
          content: audioBuffer.toString('base64'),
        },
        config: {
          encoding: 'MP3' as const, // For MP3 files
          sampleRateHertz: 16000, // Standard rate for MP3
          languageCode: 'hi-IN', // Hindi for Durga Puja contest
          alternativeLanguageCodes: ['en-IN'], // Fallback to English
          enableAutomaticPunctuation: true,
          model: 'latest_short',
        },
      };

      // Perform the speech recognition
      const [sttResponse] = await this.client.recognize(request);
      
      if (!sttResponse.results || sttResponse.results.length === 0) {
        throw new Error('No transcript found in audio file');
      }

      const result = sttResponse.results[0];
      const alternative = result.alternatives?.[0];
      
      if (!alternative || !alternative.transcript) {
        throw new Error('No transcript alternative found');
      }

      console.log(`Transcription result: "${alternative.transcript}" (confidence: ${alternative.confidence})`);
      
      return {
        transcript: alternative.transcript,
        confidence: alternative.confidence || 0,
      };
    } catch (error) {
      console.error('Local file transcription error:', error);
      throw new Error(`Failed to transcribe local file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

export const speechToTextService = new SpeechToTextService();
