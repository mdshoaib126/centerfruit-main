import type { Express } from "express";
const twilio = require('twilio');
const VoiceResponse = twilio.twiml.VoiceResponse;
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth } from "./auth";
import { speechToTextService } from "./services/speechToText";
import { smsService } from "./services/smsService";
import { scoringService } from "./services/scoringService";
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

  app.post('/voice', (req, res) => {
    const twiml = new VoiceResponse();

    // Greeting
    twiml.say(
      { voice: 'alice', language: 'en-IN' },
      'Welcome to Centerfruit Durga Puja Challenge. After the beep, please repeat the tongue twister and press pound when done.'
    );

    // Record 5 seconds max, then post to /handle-recording
    twiml.record({
      action: '/handle-recording',
      method: 'POST',
      maxLength: 5,
      playBeep: true,
      finishOnKey: '#'
    });

    // If nothing recorded
    twiml.say('No recording was received. Goodbye.');
    twiml.hangup();

    res.type('text/xml');
    res.send(twiml.toString());
  });

app.post("/handle-recording", async (req, res) => {
  try {
    const { RecordingUrl, CallSid, From } = req.body;

    // Validate input
    const validatedData = insertSubmissionSchema.pick({
      callSid: true,
      callerNumber: true,
      recordingUrl: true,
      status: true,
    }).parse({
      callSid: CallSid,
      callerNumber: From,
      recordingUrl: RecordingUrl,
      status: "PENDING",
    });

    // Save submission
    const submission = await storage.createSubmission(validatedData);
    console.log("Saved submission:", submission);

    // Build IVR menu
    const twiml = new VoiceResponse();
    const gather = twiml.gather({
      numDigits: 1,
      action: "/handle-gather",
      method: "POST",
      timeout: 10,
    });
    gather.say(
      "To listen to your recording, press 1. To submit, press 2. To record again, press 3."
    );

    twiml.say("We did not receive input. Goodbye.");
    twiml.hangup();

    res.type("text/xml").send(twiml.toString());
  } catch (err) {
    console.error("handle-recording error:", err);
    res.status(500).send("Server error");
  }
});

app.post("/handle-gather", async (req, res) => {
  try {
    const { Digits, CallSid } = req.body;
    const twiml = new VoiceResponse();

    const submission = await storage.getSubmission(CallSid);

    if (!submission) {
      twiml.say("Could not find your recording. Goodbye.");
      twiml.hangup();
      return res.type("text/xml").send(twiml.toString());
    }

    const recordingUrl = submission.recordingUrl;

    if (Digits === "1") {
      // Replay recording
      twiml.say("Playing your recording now.");
      twiml.play({}, recordingUrl);
      twiml.redirect({ method: "POST" }, "/handle-recording");
    } else if (Digits === "2") {
      // Submit recording
      await storage.updateSubmissionStatus(CallSid, "PENDING");
      twiml.say("Thank you for submitting your recording. Goodbye.");
      twiml.hangup();

      // Kick off async process
      processSubmissionAsync(CallSid).catch((err) =>
        console.error("Async processing error:", err)
      );
    } else if (Digits === "3") {
      // Record again
      twiml.say(
        "Please record your message after the beep and press pound when done."
      );
      twiml.record({
        action: "/handle-recording",
        method: "POST",
        maxLength: 5,
        playBeep: true,
        finishOnKey: "#",
      });
    } else {
      twiml.say("Invalid choice. Goodbye.");
      twiml.hangup();
    }

    res.type("text/xml").send(twiml.toString());
  } catch (err) {
    console.error("handle-gather error:", err);
    res.status(500).send("Server error");
  }
});



  // Exotel IVR webhook endpoint
  app.post("/ivr/recording", async (req, res) => {
    try {
      const { CallSid, RecordingUrl, From } = req.body;

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
          console.error("SMS sending failed:", smsResult.error);
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

  const httpServer = createServer(app);
  return httpServer;
}

// Async processing function
async function processSubmissionAsync(submissionId: string) {
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
      console.error("SMS sending failed for submission", submissionId, ":", smsResult.error);
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
