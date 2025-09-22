interface ExotelCallDetail {
  Sid: string;
  From: string;
  To: string;
  Status: string;
  RecordingUrl: string;
  StartTime: string;
  EndTime: string;
  DateCreated: string;
  DateUpdated: string;
  Duration: number;
  Direction: string;
  // Add other fields from Exotel response
}

interface ExotelApiResponse {
  Metadata: {
    Total: number;
    PageSize: number;
    FirstPageUri: string;
    PrevPageUri?: string;
    NextPageUri?: string;
  };
  Calls: ExotelCallDetail[];
}

export class ExotelPollingService {
  private processedCallSids = new Set<string>();
  private pollingInterval: NodeJS.Timeout | null = null;
  private isPolling = false;

  constructor() {
    // Load previously processed call SIDs from database on startup
    this.loadProcessedCallSids();
  }

  async startPolling() {
    if (this.isPolling) {
      console.log('Polling already started');
      return;
    }

    this.isPolling = true;
    console.log('Starting Exotel polling service - checking every 2 minutes');

    // Poll immediately, then every 2 minutes
    await this.pollExotelCalls();
    
    this.pollingInterval = setInterval(async () => {
      try {
        await this.pollExotelCalls();
      } catch (error) {
        console.error('Error in polling interval:', error);
      }
    }, 2 * 60 * 1000); // 2 minutes
  }

  stopPolling() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
    this.isPolling = false;
    console.log('Stopped Exotel polling service');
  }

  private async pollExotelCalls() {
    try {
      console.log('🔄 Polling Exotel for new calls...');
      
      // Get calls from last 10 minutes to ensure we don't miss any
      const fromTime = new Date(Date.now() - 10 * 60 * 1000).toISOString();
      const toTime = new Date().toISOString();
      
      const calls = await this.fetchExotelCalls(fromTime, toTime);
      
      let newCallsProcessed = 0;
      
      for (const call of calls) {
        // Skip if we've already processed this call
        if (this.processedCallSids.has(call.Sid)) {
          continue;
        }

        // Only process completed inbound calls with recordings
        if (call.Status === 'completed' && 
            call.Direction === 'inbound' && 
            call.RecordingUrl && 
            call.RecordingUrl.trim() !== '') {
          await this.processNewCall(call);
          this.processedCallSids.add(call.Sid);
          newCallsProcessed++;
        } else {
          // Log why we're skipping this call
          if (call.Status !== 'completed') {
            console.log(`⏭️ Skipping call ${call.Sid}: Status is ${call.Status}`);
          } else if (call.Direction !== 'inbound') {
            console.log(`⏭️ Skipping call ${call.Sid}: Direction is ${call.Direction}`);
          } else if (!call.RecordingUrl || call.RecordingUrl.trim() === '') {
            console.log(`⏭️ Skipping call ${call.Sid}: No recording URL`);
          }
        }
      }

      if (newCallsProcessed > 0) {
        console.log(`✅ Processed ${newCallsProcessed} new calls`);
        // Save processed call SIDs to database
        await this.saveProcessedCallSids();
      } else {
        console.log('No new calls to process');
      }

    } catch (error) {
      console.error('Error polling Exotel calls:', error);
    }
  }

  private async fetchExotelCalls(fromTime: string, toTime: string): Promise<ExotelCallDetail[]> {
    const exotelUsername = process.env.EXOTEL_USERNAME;
    const exotelPassword = process.env.EXOTEL_PASSWORD;
    
    if (!exotelUsername || !exotelPassword) {
      throw new Error('Missing Exotel credentials in environment variables');
    }

    // Format dates for Exotel API (YYYY-MM-DD HH:MM:SS)
    const fromDate = new Date(fromTime).toISOString().slice(0, 19).replace('T', ' ');
    const toDate = new Date(toTime).toISOString().slice(0, 19).replace('T', ' ');
    
    // Use the exact URL format with date filtering
    const apiUrl = `https://${exotelUsername}:${exotelPassword}@api.exotel.com/v1/Accounts/expm61/Calls.json?DateCreated=gte:${fromDate};lte:${toDate}&SortBy=DateCreated:desc&PageSize=50`;
    
    console.log(`🔍 Fetching calls from ${fromDate} to ${toDate}`);
    
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Exotel API error: ${response.status} ${response.statusText}`);
    }

    const data: ExotelApiResponse = await response.json();
    console.log(`📊 Found ${data.Calls?.length || 0} calls in response`);
    
    return data.Calls || [];
  }

  private async processNewCall(call: ExotelCallDetail) {
    try {
      console.log(`📞 Processing new call: ${call.Sid} from ${call.From}`);
      
      // Import storage here to avoid circular dependencies
      const { storage } = await import('../storage');
      const { insertSubmissionSchema } = await import('@shared/schema');
      
      // Check if submission already exists (extra safety)
      const existingSubmission = await storage.getSubmission(call.Sid);
      if (existingSubmission) {
        console.log(`Submission ${call.Sid} already exists, skipping`);
        return;
      }

      // Validate and create submission
      const validatedData = insertSubmissionSchema.pick({
        callSid: true,
        callerNumber: true,
        recordingUrl: true,
        status: true,
      }).parse({
        callSid: call.Sid,
        callerNumber: call.From,
        recordingUrl: call.RecordingUrl,
        status: "PENDING",
      });

      const submission = await storage.createSubmission(validatedData);
      console.log(`✅ Created submission: ${submission.id}`);

      // Process asynchronously using the exported function
      const { processSubmissionAsync } = await import('../routes');
      processSubmissionAsync(submission.id).catch((err: any) =>
        console.error('Async processing error:', err)
      );

    } catch (error) {
      console.error(`Error processing call ${call.Sid}:`, error);
    }
  }

  private async loadProcessedCallSids() {
    try {
      // TODO: Load from database or persistent storage
      // For now, we'll start fresh each time the service starts
      // You might want to load recent processed calls from your database
      console.log('Loading previously processed call SIDs...');
    } catch (error) {
      console.error('Error loading processed call SIDs:', error);
    }
  }

  private async saveProcessedCallSids() {
    try {
      // TODO: Save to database or persistent storage
      // Convert Set to array and save the recent ones
      const recentSids = Array.from(this.processedCallSids).slice(-1000); // Keep last 1000
      console.log(`Saving ${recentSids.length} processed call SIDs`);
    } catch (error) {
      console.error('Error saving processed call SIDs:', error);
    }
  }
}

export const exotelPollingService = new ExotelPollingService();
