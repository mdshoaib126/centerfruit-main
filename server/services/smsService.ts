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

  constructor() {
    this.apiKey = process.env.MSG91_API_KEY || process.env.MSG91_API_KEY_ENV_VAR || "default_key";
    this.senderId = process.env.MSG91_SENDER_ID || "CNTFRT";
  }

  async sendResultSMS(phoneNumber: string, status: 'PASS' | 'FAIL', score?: number): Promise<SMSResult> {
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
        mobiles: phoneNumber.replace('+91', '').replace(/\s+/g, ''), // Clean phone number
        var1: status === 'PASS' ? 'Congratulations!' : 'Better luck next time!',
        var2: score ? score.toString() : 'N/A',
        var3: 'Centerfruit Durga Puja Contest',
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
}

export const smsService = new SMSService();
