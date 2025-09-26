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

  private async streamToBuffer(stream: ArrayBuffer): Promise<Buffer> {
    return Buffer.from(stream);
  }

  constructor() {
    // Initialize Google Cloud Speech client
    const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    if (!keyPath) {
      throw new Error('GOOGLE_APPLICATION_CREDENTIALS environment variable is not set');
    }

    try {
      this.client = new SpeechClient({
        keyFilename: keyPath,
      });
    } catch (error) {
      console.error('Failed to initialize Google Speech client:', error);
      throw error;
    }
  }

  async transcribeAudio(recordingUrl: string): Promise<SpeechToTextResult> {
    // Test mode: return mock transcript for testing without external API
    if (process.env.NODE_ENV === 'test' || process.env.DISABLE_EXTERNAL_CALLS === 'true') {
      return {
        transcript: "चंदू के चाचा ने चंदू की चाची को चांदनी चौक में चांदी के चम्मच से चटनी चटाई।",
        confidence: 0.9,
      };
    }

    try {
      // Download the audio file
      console.log('Downloading audio from:', recordingUrl);

      // Check if this is an Exotel recording URL that requires authentication
      const isExotelUrl = recordingUrl.includes('recordings.exotel.com');
      let audioResponse;

      if (isExotelUrl) {
        // Use Exotel credentials for authenticated download
        const exotelUsername = process.env.EXOTEL_USERNAME;
        const exotelPassword = process.env.EXOTEL_PASSWORD;
        
        if (!exotelUsername || !exotelPassword) {
          throw new Error('EXOTEL_USERNAME and EXOTEL_PASSWORD environment variables are required for Exotel recordings');
        }

        const authHeader = 'Basic ' + Buffer.from(`${exotelUsername}:${exotelPassword}`).toString('base64');
        
        audioResponse = await fetch(recordingUrl, {
          method: 'GET',
          headers: {
            'Authorization': authHeader,
          },
        });
      } else {
        // Regular download for other URLs (like Twilio)
        audioResponse = await fetch(recordingUrl);
      }

      if (!audioResponse.ok) {
        throw new Error(`Failed to download audio: ${audioResponse.status} ${audioResponse.statusText}`);
      }
      
      const arrayBuffer = await audioResponse.arrayBuffer();
      const audioBuffer = await this.streamToBuffer(arrayBuffer);

      // Configure the request
      const request = {
        audio: {
          content: audioBuffer.toString('base64'),
        },
        config: {
          encoding: 'MP3' as const,
          sampleRateHertz: 44100,  // Standard MP3 sample rate
          languageCode: 'bn-IN', // Bengali for Durga Puja contest
          alternativeLanguageCodes: ['en-IN'], // Fallback to English
          enableAutomaticPunctuation: true,
          model: 'default',
          useEnhanced: true,
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

      // Log the speech recognition result
      console.log('Speech-to-Text Result:', {
        transcript: alternative.transcript,
        confidence: alternative.confidence || 0
      });

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
  /*
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
          sampleRateHertz: 44100, // Standard rate for MP3
          languageCode: 'hi-IN', // Hindi for Durga Puja contest
          alternativeLanguageCodes: ['en-IN'], // Fallback to English
          enableAutomaticPunctuation: true,
          model: 'default',
          useEnhanced: true,
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
  } */
}

export const speechToTextService = new SpeechToTextService();
