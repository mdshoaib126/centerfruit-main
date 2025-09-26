import type { Express } from "express";
import express from "express";
// @ts-ignore - Twilio has module resolution issues with ES6 imports
import twilio from "twilio";
const { VoiceResponse } = twilio.twiml;
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth } from "./auth";
import { speechToTextService } from "./services/speechToText";
import { smsService } from "./services/smsService";
import { scoringService } from "./services/scoringService";
import { exotelPollingService } from "./services/exotelPollingService";
import { insertSubmissionSchema, updateSubmissionStatusSchema } from "@shared/schema";
import { z } from "zod";

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

  // Tongue twister audio files
  const tongueTwisters = [
    `${process.env.BASE_URL || 'http://localhost:5000'}/audios/Pakhi Paka Pepe khay.mp3`,
    `${process.env.BASE_URL || 'http://localhost:5000'}/audios/Tele chultaja jole chun taja.mp3`,
    `${process.env.BASE_URL || 'http://localhost:5000'}/audios/Kacha gab paka gab.mp3`
  ];

  // Serve static audio files
  app.use('/audios', express.static('server/audios'));

  // Simple API Route - returns random audio file URL as plain text
  app.all('/voice', (req, res) => {
    try {
      const { CallSid, From } = req.method === 'POST' ? req.body : req.query;
      
      // Randomly select a tongue twister
      const randomIndex = Math.floor(Math.random() * tongueTwisters.length);
      const selectedTwisterUrl = tongueTwisters[randomIndex];
      
      console.log(`📞 Request from: ${CallSid} - ${From}`);
      console.log(`🎵 Random audio selected: ${selectedTwisterUrl}`);

      // Return plain text with audio URL
      res.set('Content-Type', 'text/plain');
      res.send(selectedTwisterUrl);
      
    } catch (error) {
      console.error('Voice route error:', error);
      res.status(500).set('Content-Type', 'text/plain').send('Server error');
    }
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

      // Validate input data
      const validatedData = insertSubmissionSchema.pick({
        callSid: true,
        callerNumber: true,
        recordingUrl: true,
        status: true
      }).parse({
        callSid: CallSid,
        callerNumber: From,
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
