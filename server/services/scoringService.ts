interface ScoringResult {
  score: number;
  status: 'PASS' | 'FAIL';
  similarity: number;
}

export class ScoringService {
  private expectedTongueTwister = "कच्चे घर में कुछ कच्चे कचौरी खाए, कच्चे घर में कुछ कच्चे कचौरी खाए। चंदू के चाचा ने चंदू की चाची को चांदनी चौक में चांदी के चम्मच से चटनी चटाई।";
  private passThreshold = 70;

  // Levenshtein distance algorithm
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));

    for (let i = 0; i <= str1.length; i++) {
      matrix[0][i] = i;
    }

    for (let j = 0; j <= str2.length; j++) {
      matrix[j][0] = j;
    }

    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1, // deletion
          matrix[j - 1][i] + 1, // insertion
          matrix[j - 1][i - 1] + indicator // substitution
        );
      }
    }

    return matrix[str2.length][str1.length];
  }

  // Calculate similarity percentage
  private calculateSimilarity(original: string, transcript: string): number {
    const normalizedOriginal = original.toLowerCase().replace(/[^\w\s]/g, '').trim();
    const normalizedTranscript = transcript.toLowerCase().replace(/[^\w\s]/g, '').trim();

    const maxLength = Math.max(normalizedOriginal.length, normalizedTranscript.length);
    if (maxLength === 0) return 0;

    const distance = this.levenshteinDistance(normalizedOriginal, normalizedTranscript);
    const similarity = ((maxLength - distance) / maxLength) * 100;
    
    return Math.max(0, Math.min(100, similarity));
  }

  // Score the transcript
  public scoreTranscript(transcript: string): ScoringResult {
    const similarity = this.calculateSimilarity(this.expectedTongueTwister, transcript);
    const score = Math.round(similarity);
    const status = score >= this.passThreshold ? 'PASS' : 'FAIL';

    return {
      score,
      status,
      similarity,
    };
  }

  // Get expected tongue twister
  public getExpectedTongueTwister(): string {
    return this.expectedTongueTwister;
  }

  // Get pass threshold
  public getPassThreshold(): number {
    return this.passThreshold;
  }
}

export const scoringService = new ScoringService();
