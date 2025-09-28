import type { Express } from "express";
import express from "express"; 
import builder from "xmlbuilder"; 
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth } from "./auth";
import { speechToTextService } from "./services/speechToText";
import { smsService } from "./services/smsService";
import { scoringService } from "./services/scoringService";
import { exotelPollingService } from "./services/exotelPollingService";
import { insertSubmissionSchema, updateSubmissionStatusSchema } from "@shared/schema";
import { z } from "zod";

// Utility function to normalize mobile numbers
function normalizeMobileNumber(phoneNumber: string): string {
  if (!phoneNumber) return phoneNumber;
  
  // Remove any spaces, dashes, or other formatting
  let normalized = phoneNumber.replace(/[\s\-\(\)]/g, '');
  
  // Remove leading 0 if present
  if (normalized.startsWith('0')) {
    normalized = normalized.substring(1);
  }
  
  // Add country code 91 if not present
  if (!normalized.startsWith('91') && !normalized.startsWith('+91')) {
    normalized = '91' + normalized;
  }
  
  // Remove + if present at the beginning
  if (normalized.startsWith('+')) {
    normalized = normalized.substring(1);
  }
  
  console.log(`📱 Normalized phone number: ${phoneNumber} → ${normalized}`);
  return normalized;
}

export function registerRoutes(app: Express): Server {
  // Setup authentication routes
  setupAuth(app);

  // Enable CORS for frontend-backend communication
  app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET,PUT,POST,DELETE,OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
    if (req.method === "OPTIONS") {
      res.sendStatus(200);
      return;
    }
    next();
  });
  
  app.use(express.urlencoded({ extended: true })); // Needed for Exotel webhooks
  app.use(express.json()); // In case you test via Postman
  
  // Tongue twister audio files  
  const audioUrls = {
    greetings: "http://centerfruit.karmatech.in/audios/Greetings-Message.wav",
    press1: "http://centerfruit.karmatech.in/audios/press-1-to-listen-again.wav",
    thankYou: "http://centerfruit.karmatech.in/audios/thank-you.wav"
  };

  // Tongue twister list
  const tongueTwisters = [
    "http://centerfruit.karmatech.in/audios/Tele-chultaja-jole-chun-taja.mp3",
    "http://centerfruit.karmatech.in/audios/Twister-2.mp3",
    "http://centerfruit.karmatech.in/audios/Twister-3.mp3"
  ];

  // Serve static audio files
  app.use('/audios', express.static('server/audios'));

  // Main IVR entry point - Greetings and random tongue twister
  
// 1. Main IVR entry point
app.get("/voice", (req, res) => {
  const randomIndex = Math.floor(Math.random() * tongueTwisters.length);
  const selectedTwisterUrl = tongueTwisters[randomIndex];

  const xml = builder.create("Response");
  xml.ele("Play", {}, audioUrls.greetings);
  xml.ele("Play", {}, selectedTwisterUrl);

  const gather = xml.ele("Gather", {
    numDigits: "1",
    timeout: "3",
    action: `http://centerfruit.karmatech.in/voice/gather?twister=${randomIndex}`,
    method: "GET"
  });
  gather.ele("Play", {}, audioUrls.press1);

  xml.ele("Redirect", { method: "GET" }, `http://centerfruit.karmatech.in/voice/record?twister=${randomIndex}`);

  res.type("text/xml");
  res.send(xml.end({ pretty: true }));
});

// 2. Handle user input
app.get("/voice/gather", (req, res) => {
  const { Digits } = req.query;
  const twisterParam = req.query.twister;
  const twisterIndex = parseInt(
    typeof twisterParam === "string"
      ? twisterParam
      : Array.isArray(twisterParam) && typeof twisterParam[0] === "string"
        ? twisterParam[0]
        : "0",
    10
  ) || 0;
  const selectedTwisterUrl = tongueTwisters[twisterIndex];

  const xml = builder.create("Response");

  if (Digits === "1") {
    xml.ele("Play", {}, selectedTwisterUrl);

    const gather = xml.ele("Gather", {
      numDigits: "1",
      timeout: "3",
      action: `http://centerfruit.karmatech.in/voice/gather?twister=${twisterIndex}`,
      method: "GET"
    });
    gather.ele("Play", {}, audioUrls.press1);

    xml.ele("Redirect", { method: "GET" }, `http://centerfruit.karmatech.in/voice/record?twister=${twisterIndex}`);
  } else {
    xml.ele("Redirect", { method: "GET" }, `http://centerfruit.karmatech.in/voice/record?twister=${twisterIndex}`);
  }

  res.type("text/xml");
  res.send(xml.end({ pretty: true }));
});

// 3. Recording phase
app.get("/voice/record", (req, res) => {
  const { twister } = req.query;

  const xml = builder.create("Response");
  xml.ele("Record", {
    action: "http://centerfruit.karmatech.in/voice/complete",
    method: "GET",
    maxLength: "30",
    finishOnKey: "#",
    playBeep: "true",
    recordingCallback: "http://centerfruit.karmatech.in/ivr/recording"
  });

  xml.ele("Play", {}, "http://centerfruit.karmatech.in/audios/please-say-3-times.wav");

  res.type("text/xml");
  res.send(xml.end({ pretty: true }));
});

// 4. Completion
  app.get("/voice/complete", (req, res) => {
    const xml = builder.create("Response");
    xml.ele("Play", {}, audioUrls.thankYou);
    xml.ele("Hangup");

    res.type("text/xml");
    res.send(xml.end({ pretty: true })); 
  });
  

  

  // Exotel IVR webhook endpoint
  app.post("/ivr/recording", async (req, res) => {
    try {
      const {CallSid,RecordingUrl,From} = req.body;

      console.log("📞 New Recording Webhook Received:");
      console.log("CallSid:", CallSid);
      console.log("Recording URL:", RecordingUrl);
      console.log("From:", From); 
      
      if (!CallSid || !RecordingUrl || !From) {
        return res.status(400).json({ error: "Missing required fields: CallSid, RecordingUrl, From" });
      }

      // Normalize the mobile number for proper SMS delivery
      const normalizedPhoneNumber = normalizeMobileNumber(From);

      // Validate input data
      const validatedData = insertSubmissionSchema.pick({
        callSid: true,
        callerNumber: true,
        recordingUrl: true,
        status: true
      }).parse({
        callSid: CallSid,
        callerNumber: normalizedPhoneNumber,
        recordingUrl: RecordingUrl,
        status: "PENDING",
      });

      // Create initial submission record
      const submission = await storage.createSubmission(validatedData);

      // Process asynchronously
      processSubmissionAsync(submission.id);

      res.status(200).json({ 
        success: true, 
        submissionId: submission.id,
        message: "Recording received and processing started" 
      });
    } catch (error) {
      console.error("IVR webhook error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Admin API routes
  app.get("/api/submissions", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.sendStatus(401);
    }

    try {
      const {
        status,
        fromDate,
        toDate,
        searchPhone,
        limit = "10",
        offset = "0"
      } = req.query;

      const filters = {
        status: status as string,
        fromDate: fromDate as string,
        toDate: toDate as string,
        searchPhone: searchPhone as string,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
      };

      const result = await storage.getSubmissions(filters);
      res.json(result);
    } catch (error) {
      console.error("Get submissions error:", error);
      res.status(500).json({ error: "Failed to fetch submissions" });
    }
  });

  app.get("/api/submission/:id", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.sendStatus(401);
    }

    try {
      const submission = await storage.getSubmission(req.params.id);
      if (!submission) {
        return res.status(404).json({ error: "Submission not found" });
      }
      res.json(submission);
    } catch (error) {
      console.error("Get submission error:", error);
      res.status(500).json({ error: "Failed to fetch submission" });
    }
  });

  app.put("/api/submission/:id/status", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.sendStatus(401);
    }

    try {
      const { status } = updateSubmissionStatusSchema.parse(req.body);
      const submission = await storage.updateSubmissionStatus(req.params.id, status);
      
      if (!submission) {
        return res.status(404).json({ error: "Submission not found" });
      }

      // Send SMS notification if status changed to PASS or FAIL
      if (status === "PASS" || status === "FAIL") {
        const smsResult = await smsService.sendResultSMS(
          submission.callerNumber, 
          status, 
          submission.score || undefined
        );
        if (!smsResult.success) {
          if (smsResult.error?.includes('Daily PASS SMS limit')) {
            console.warn(`📱 SMS limit reached: ${smsResult.error}`);
          } else {
            console.error("SMS sending failed:", smsResult.error);
          }
        } else {
          console.log(`📱 SMS sent successfully to ${submission.callerNumber} for ${status} status`);
        }
      }

      res.json(submission);
    } catch (error) {
      console.error("Update submission status error:", error);
      res.status(500).json({ error: "Failed to update submission status" });
    }
  });

  // Get dashboard stats
  app.get("/api/stats", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.sendStatus(401);
    }

    try {
      const { submissions: allSubmissions } = await storage.getSubmissions({ limit: 10000 });
      
      const totalSubmissions = allSubmissions.length;
      const pendingCount = allSubmissions.filter(s => s.status === "PENDING").length;
      const passCount = allSubmissions.filter(s => s.status === "PASS").length;
      const failCount = allSubmissions.filter(s => s.status === "FAIL").length;
      
      const passRate = totalSubmissions > 0 ? (passCount / (passCount + failCount)) * 100 : 0;
      
      const scoresWithValues = allSubmissions.filter(s => s.score !== null);
      const avgScore = scoresWithValues.length > 0 
        ? scoresWithValues.reduce((sum, s) => sum + (s.score || 0), 0) / scoresWithValues.length 
        : 0;

      res.json({
        totalSubmissions,
        pendingCount,
        passRate: Math.round(passRate * 10) / 10,
        avgScore: Math.round(avgScore * 10) / 10,
      });
    } catch (error) {
      console.error("Get stats error:", error);
      res.status(500).json({ error: "Failed to fetch stats" });
    }
  });

  // Get expected tongue twister
  app.get("/api/expected-twister", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.sendStatus(401);
    }

    res.json({
      text: scoringService.getExpectedTongueTwister(),
      passThreshold: scoringService.getPassThreshold(),
    });
  });

  // Get daily SMS stats
  app.get("/api/sms-stats", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.sendStatus(401);
    }

    try {
      const stats = await smsService.getDailyPassSmsStats();
      res.json(stats);
    } catch (error) {
      console.error("Get SMS stats error:", error);
      res.status(500).json({ error: "Failed to fetch SMS stats" });
    }
  });

  // Audio proxy endpoint for authenticated Exotel recordings
  app.get("/api/audio-proxy", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.sendStatus(401);
    }

    try {
      const { url } = req.query;
      
      if (!url || typeof url !== 'string') {
        return res.status(400).json({ error: "URL parameter is required" });
      }

      // Check if this is an Exotel recording URL that requires authentication
      const isExotelUrl = url.includes('recordings.exotel.com');
      let audioResponse;

      if (isExotelUrl) {
        // Use Exotel credentials for authenticated download
        const exotelUsername = process.env.EXOTEL_USERNAME;
        const exotelPassword = process.env.EXOTEL_PASSWORD;
        
        if (!exotelUsername || !exotelPassword) {
          return res.status(500).json({ error: "Exotel credentials not configured" });
        }

        const authHeader = 'Basic ' + Buffer.from(`${exotelUsername}:${exotelPassword}`).toString('base64');
        
        audioResponse = await fetch(url, {
          method: 'GET',
          headers: {
            'Authorization': authHeader,
          },
        });
      } else {
        // Regular download for other URLs
        audioResponse = await fetch(url);
      }

      if (!audioResponse.ok) {
        return res.status(audioResponse.status).json({ 
          error: `Failed to fetch audio: ${audioResponse.statusText}` 
        });
      }

      // Get the content type from the original response
      const contentType = audioResponse.headers.get('content-type') || 'audio/mpeg';
      
      // Set appropriate headers for audio streaming
      res.setHeader('Content-Type', contentType);
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour
      
      // Stream the audio data
      const buffer = await audioResponse.arrayBuffer();
      res.send(Buffer.from(buffer));

    } catch (error) {
      console.error("Audio proxy error:", error);
      res.status(500).json({ error: "Failed to proxy audio" });
    }
  });

  const httpServer = createServer(app);
  
  // Start Exotel polling service
  exotelPollingService.startPolling().catch(err => 
    console.error('Failed to start Exotel polling service:', err)
  );
  
  return httpServer;
}

// Async processing function - exported for use by polling service
export async function processSubmissionAsync(submissionId: string) {
  try {
    console.log(`Starting processing for submission ${submissionId}`);
    
    const submission = await storage.getSubmission(submissionId);
    if (!submission) {
      console.error("Submission not found for processing:", submissionId);
      return;
    }

    console.log(`Processing recording URL: ${submission.recordingUrl}`);
    
    // Step 1: Transcribe audio
    const transcriptResult = await speechToTextService.transcribeAudio(submission.recordingUrl);
    
    // Check if transcription is empty (audio file not found or no speech detected)
    if (!transcriptResult.transcript || transcriptResult.transcript.trim() === '') {
      console.warn(`No audio or transcript found for submission ${submissionId}, marking as FAIL`);
      
      await storage.updateSubmission(submissionId, {
        transcript: 'No audio found',
        score: 0,
        status: 'FAIL',
      });
      
      return; // Skip SMS and further processing
    }
    
    // Step 2: Score the transcript
    const scoringResult = scoringService.scoreTranscript(transcriptResult.transcript);
    
    // Step 3: Update submission with transcript, score, and status
    const updatedSubmission = await storage.updateSubmission(submissionId, {
      transcript: transcriptResult.transcript,
      score: scoringResult.score,
      status: scoringResult.status,
    });

    // Step 4: Send SMS notification
    const smsResult = await smsService.sendResultSMS(
      submission.callerNumber,
      scoringResult.status,
      scoringResult.score
    );

    if (!smsResult.success) {
      if (smsResult.error?.includes('Daily PASS SMS limit')) {
        console.warn(`📱 SMS limit reached for submission ${submissionId}: ${smsResult.error}`);
      } else {
        console.error("SMS sending failed for submission", submissionId, ":", smsResult.error);
      }
    } else {
      console.log(`📱 SMS sent successfully to ${submission.callerNumber} for ${scoringResult.status} status`);
    }

    console.log(`Submission ${submissionId} processed successfully:`, {
      status: scoringResult.status,
      score: scoringResult.score,
      smsDelivered: smsResult.success,
    });

  } catch (error) {
    console.error("Error processing submission", submissionId, ":", error);
    
    // Update status to FAIL on processing error
    try {
      await storage.updateSubmissionStatus(submissionId, "FAIL");
    } catch (updateError) {
      console.error("Failed to update submission status after processing error:", updateError);
    }
  }
}
