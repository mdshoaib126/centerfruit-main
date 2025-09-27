import fetch from 'node-fetch';

interface SMSResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export class SMSService {
  private apiKey: string;
  private senderId: string;
  private baseUrl = 'https://api.msg91.com/api/v5/flow/';
  private readonly DAILY_PASS_SMS_LIMIT = 100;

  constructor() {
    this.apiKey = process.env.MSG91_API_KEY || process.env.MSG91_API_KEY_ENV_VAR || "default_key";
    this.senderId = process.env.MSG91_SENDER_ID || "SBUZZT";
  }

  private async getTodayPassSmsCount(): Promise<number> {
    try {
      // Import storage to count today's PASS submissions
      const { storage } = await import('../storage');
      
      // Get start and end of today
      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
      
      // Query submissions with PASS status created today
      const { submissions } = await storage.getSubmissions({
        status: 'PASS',
        fromDate: startOfDay.toISOString(),
        toDate: endOfDay.toISOString(),
        limit: 10000 // Get all to count accurately
      });
      
      return submissions.length;
    } catch (error) {
      console.error('Error counting today\'s PASS SMS:', error);
      return 0; // Default to 0 if error, allowing SMS to be sent
    }
  }

  async sendResultSMS(phoneNumber: string, status: 'PASS' | 'FAIL', score?: number): Promise<SMSResult> {
    // Check daily limit for PASS messages only
    if (status === 'PASS') {
      const todayPassCount = await this.getTodayPassSmsCount();
      if (todayPassCount >= this.DAILY_PASS_SMS_LIMIT) {
        console.log(`🚫 Daily PASS SMS limit reached (${todayPassCount}/${this.DAILY_PASS_SMS_LIMIT}). Skipping SMS for ${phoneNumber}`);
        return {
          success: false,
          error: `Daily PASS SMS limit of ${this.DAILY_PASS_SMS_LIMIT} reached. SMS not sent.`
        };
      } else {
        console.log(`📊 PASS SMS count today: ${todayPassCount}/${this.DAILY_PASS_SMS_LIMIT}`);
      }
    }
    // Test mode: return mock success without sending actual SMS
    /* if (process.env.NODE_ENV === 'test' || process.env.DISABLE_EXTERNAL_CALLS === 'true' || !process.env.MSG91_API_KEY) {
      return {
        success: true,
        messageId: 'mock-message-' + Date.now(),
      };
    } */

    try {
      const templateId = status === 'PASS' ? 
        process.env.MSG91_PASS_TEMPLATE_ID : 
        process.env.MSG91_FAIL_TEMPLATE_ID;

      if (!templateId) {
        throw new Error(`Template ID not configured for ${status} status`);
      }

       
      const payload = {
        template_id: templateId,
        sender: this.senderId,
        short_url: "0",
        mobiles: phoneNumber,  
        
      };

      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'authkey': this.apiKey,
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json() as any;

      if (!response.ok) {
        throw new Error(result.message || `SMS API error: ${response.statusText}`);
      }

      return {
        success: true,
        messageId: result.data?.id || result.id,
      };
    } catch (error) {
      console.error('SMS sending error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown SMS error',
      };
    }
  }

  // Public method to check current daily PASS SMS count
  async getDailyPassSmsStats(): Promise<{ count: number; limit: number; remaining: number }> {
    const count = await this.getTodayPassSmsCount();
    return {
      count,
      limit: this.DAILY_PASS_SMS_LIMIT,
      remaining: Math.max(0, this.DAILY_PASS_SMS_LIMIT - count)
    };
  }
}

export const smsService = new SMSService();
