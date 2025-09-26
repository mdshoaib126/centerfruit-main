interface ScoringResult {
  score: number;
  status: 'PASS' | 'FAIL';
  similarity: number;
  matchedTwister?: string;
}

export class ScoringService {
  private tongueTwisters = [
    "পাখি পাকা পেঁপে খায়",
    "তেলে চুল তাজা, জলে চুন তাজা", 
    "কাঁচা গাব পাকা গাব"
  ];
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
    // Only remove punctuation and whitespace, preserve Bengali characters
    const normalizedOriginal = original.replace(/[।,.!?়্ঃ]/g, '').replace(/\s+/g, ' ').trim();
    const normalizedTranscript = transcript.replace(/[।,.!?়্ঃ]/g, '').replace(/\s+/g, ' ').trim();

    console.log('Scoring Comparison:', {
      original: normalizedOriginal,
      transcript: normalizedTranscript
    });

    const maxLength = Math.max(normalizedOriginal.length, normalizedTranscript.length);
    if (maxLength === 0) return 0;

    const distance = this.levenshteinDistance(normalizedOriginal, normalizedTranscript);
    const similarity = ((maxLength - distance) / maxLength) * 100;
    
    console.log('Scoring Result:', {
      distance,
      maxLength,
      similarity
    });
    
    return Math.max(0, Math.min(100, similarity));
  }

  // Score the transcript against all tongue twisters (must be said 3 times) and return the best match
  public scoreTranscript(transcript: string): ScoringResult {
    console.log('Scoring input transcript:', transcript);
    console.log('Checking against tongue twisters (must be said 3 times):', this.tongueTwisters);

    let bestResult: ScoringResult = {
      score: 0,
      status: 'FAIL',
      similarity: 0,
      matchedTwister: undefined
    };

    // Check transcript against each tongue twister repeated 3 times
    for (const tongueTwister of this.tongueTwisters) {
      // Create expected pattern: tongue twister repeated 3 times
      const expectedThreeTimes = `${tongueTwister} ${tongueTwister} ${tongueTwister}`;
      
      console.log(`Expected 3x pattern: "${expectedThreeTimes}"`);
      
      const similarity = this.calculateSimilarity(expectedThreeTimes, transcript);
      const score = Math.round(similarity);
      const status = score >= this.passThreshold ? 'PASS' : 'FAIL';

      console.log(`Comparison with "${tongueTwister}" (3x):`, {
        score,
        status,
        similarity
      });

      // Keep the best match (highest score)
      if (score > bestResult.score) {
        bestResult = {
          score,
          status,
          similarity,
          matchedTwister: tongueTwister
        };
      }
    }

    console.log('Best match result (3x requirement):', bestResult);

    return bestResult;
  }

  // Get all tongue twisters
  public getTongueTwisters(): string[] {
    return this.tongueTwisters;
  }

  // Get expected tongue twister (return all tongue twisters with 3x requirement)
  public getExpectedTongueTwister(): string {
    return this.tongueTwisters.map(twister => `${twister} (3 times)`).join(', ');
  }

  // Get pass threshold
  public getPassThreshold(): number {
    return this.passThreshold;
  }

  // Get a specific tongue twister repeated 3 times (for testing or display)
  public getTongueTwisterThreeTimes(index: number): string {
    if (index < 0 || index >= this.tongueTwisters.length) {
      throw new Error(`Invalid tongue twister index: ${index}`);
    }
    const twister = this.tongueTwisters[index];
    return `${twister} ${twister} ${twister}`;
  }
}

export const scoringService = new ScoringService();