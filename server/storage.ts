import { type Admin, type InsertAdmin, type Submission, type InsertSubmission, type User, type InsertUser, admins, submissions } from "@shared/schema";
import { randomUUID } from "crypto";
import session from "express-session";
import createMemoryStore from "memorystore";
import { db } from "./db";
import { eq, and, gte, lte, ilike, desc, count } from "drizzle-orm";

const MemoryStore = createMemoryStore(session);

export interface IStorage {
  // Admin methods
  getAdmin(id: string): Promise<Admin | undefined>;
  getAdminByUsername(username: string): Promise<Admin | undefined>;
  createAdmin(admin: InsertAdmin): Promise<Admin>;
  
  // User methods (aliases for admin for compatibility)
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Submission methods
  getSubmission(id: string): Promise<Submission | undefined>;
  createSubmission(submission: InsertSubmission): Promise<Submission>;
  updateSubmission(id: string, updates: Partial<Pick<Submission, 'transcript' | 'score' | 'status'>>): Promise<Submission | undefined>;
  updateSubmissionStatus(id: string, status: "PENDING" | "PASS" | "FAIL"): Promise<Submission | undefined>;
  getSubmissions(filters?: {
    status?: string;
    fromDate?: string;
    toDate?: string;
    searchPhone?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ submissions: Submission[]; total: number }>;
  
  // Session store
  sessionStore: any;
}

export class DatabaseStorage implements IStorage {
  public sessionStore: any;

  constructor() {
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000,
    });
    
    // Initialize database with default admin and sample data
    this.initializeDatabase();
  }

  private async initializeDatabase() {
    try {
      // Create default admin with proper scrypt format
      // Hash generated for password "admin123" using scrypt
      await this.createAdmin({
        username: "admin", 
        password: "959d4f408acce790eeeb6b8eb91ab555dd23bab9b438846775d7b590d668926231cbd313f1950c3e786bb7267b5904485cfcbbad8e0cd1fa4045b914d403a81e.316121602da53fb1776e1ab55aa88645",
      }).catch(() => {}); // Ignore if already exists

      // Initialize with sample submissions for testing
      await this.initializeSampleData();
    } catch (error) {
      console.log("Database initialization completed (some operations may have been skipped)");
    }
  }

  private async initializeSampleData() {
    console.log("Initializing sample data in database...");
    
    // Check if sample data already exists
    const existingSubmissions = await db.select().from(submissions).limit(1);
    if (existingSubmissions.length > 0) {
      console.log("Sample data already exists, skipping initialization");
      return;
    }

    // Create sample submissions for testing dashboard functionality
    const sampleSubmissions = [
      {
        callSid: "sample-call-1",
        callerNumber: "+919876543210",
        recordingUrl: "http://example.com/sample1.wav",
        transcript: "कच्चे घर में कुछ कच्चे कचौरी खाए।",
        score: 45,
        status: "FAIL" as const
      },
      {
        callSid: "sample-call-2", 
        callerNumber: "+919876543211",
        recordingUrl: "http://example.com/sample2.wav",
        transcript: "कच्चे घर में कच्चे पत्ते कच्चे कचौरी खाए।",
        score: 85,
        status: "PASS" as const
      },
      {
        callSid: "sample-call-3",
        callerNumber: "+919876543212", 
        recordingUrl: "http://example.com/sample3.wav",
        transcript: "कच्चे घर में कुछ पत्ते खाए।",
        score: 62,
        status: "FAIL" as const
      }
    ];

    // Create the sample submissions with timestamps spread over the last few days
    const now = new Date();
    for (let i = 0; i < sampleSubmissions.length; i++) {
      const sample = sampleSubmissions[i];
      const createdAt = new Date(now.getTime() - (i * 24 * 60 * 60 * 1000)); // i days ago
      
      await db.insert(submissions).values({
        callSid: sample.callSid,
        callerNumber: sample.callerNumber,
        recordingUrl: sample.recordingUrl,
        transcript: sample.transcript,
        score: sample.score,
        status: sample.status,
      });
    }
    console.log("Sample data inserted successfully");
  }

  async getAdmin(id: string): Promise<Admin | undefined> {
    const [admin] = await db.select().from(admins).where(eq(admins.id, id));
    return admin || undefined;
  }

  async getAdminByUsername(username: string): Promise<Admin | undefined> {
    const [admin] = await db.select().from(admins).where(eq(admins.username, username));
    return admin || undefined;
  }

  async createAdmin(insertAdmin: InsertAdmin): Promise<Admin> {
    const [admin] = await db
      .insert(admins)
      .values(insertAdmin)
      .returning();
    return admin;
  }

  // User methods (aliases for admin for compatibility)
  async getUser(id: string): Promise<User | undefined> {
    return this.getAdmin(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return this.getAdminByUsername(username);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    return this.createAdmin(insertUser);
  }

  async getSubmission(id: string): Promise<Submission | undefined> {
    const [submission] = await db.select().from(submissions).where(eq(submissions.id, id));
    return submission || undefined;
  }

  async createSubmission(insertSubmission: InsertSubmission): Promise<Submission> {
    const [submission] = await db
      .insert(submissions)
      .values(insertSubmission)
      .returning();
    return submission;
  }

  async updateSubmission(id: string, updates: Partial<Pick<Submission, 'transcript' | 'score' | 'status'>>): Promise<Submission | undefined> {
    const [submission] = await db
      .update(submissions)
      .set(updates)
      .where(eq(submissions.id, id))
      .returning();
    return submission || undefined;
  }

  async updateSubmissionStatus(id: string, status: "PENDING" | "PASS" | "FAIL"): Promise<Submission | undefined> {
    return this.updateSubmission(id, { status });
  }

  async getSubmissions(filters?: {
    status?: string;
    fromDate?: string;
    toDate?: string;
    searchPhone?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ submissions: Submission[]; total: number }> {
    let query = db.select().from(submissions);
    let countQuery = db.select({ count: count() }).from(submissions);
    
    // Build where conditions
    const conditions = [];
    
    if (filters?.status) {
      conditions.push(eq(submissions.status, filters.status));
    }
    
    if (filters?.searchPhone) {
      conditions.push(ilike(submissions.callerNumber, `%${filters.searchPhone}%`));
    }
    
    if (filters?.fromDate) {
      conditions.push(gte(submissions.createdAt, new Date(filters.fromDate)));
    }
    
    if (filters?.toDate) {
      conditions.push(lte(submissions.createdAt, new Date(filters.toDate)));
    }
    
    // Apply conditions if any exist
    if (conditions.length > 0) {
      const whereClause = conditions.length === 1 ? conditions[0] : and(...conditions);
      query = query.where(whereClause);
      countQuery = countQuery.where(whereClause);
    }
    
    // Get total count
    const [totalResult] = await countQuery;
    const total = totalResult.count;
    
    // Apply sorting and pagination
    query = query.orderBy(desc(submissions.createdAt));
    
    if (filters?.limit) {
      query = query.limit(filters.limit);
    }
    
    if (filters?.offset) {
      query = query.offset(filters.offset);
    }
    
    const submissionResults = await query;
    
    return { submissions: submissionResults, total };
  }
}

export class MemStorage implements IStorage {
  private admins: Map<string, Admin>;
  private submissions: Map<string, Submission>;
  public sessionStore: any;

  constructor() {
    this.admins = new Map();
    this.submissions = new Map();
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000,
    });
    
    // Create default admin with proper scrypt format
    // Hash generated for password "admin123" using scrypt
    this.createAdmin({
      username: "admin", 
      password: "959d4f408acce790eeeb6b8eb91ab555dd23bab9b438846775d7b590d668926231cbd313f1950c3e786bb7267b5904485cfcbbad8e0cd1fa4045b914d403a81e.316121602da53fb1776e1ab55aa88645",
    });
    
    // Initialize with sample submissions for testing
    this.initializeSampleData();
  }

  private initializeSampleData() {
    console.log("Initializing sample data...");
    // Create sample submissions for testing dashboard functionality
    const sampleSubmissions = [
      {
        callSid: "sample-call-1",
        callerNumber: "+919876543210",
        recordingUrl: "http://example.com/sample1.wav",
        transcript: "कच्चे घर में कुछ कच्चे कचौरी खाए।",
        score: 45,
        status: "FAIL" as const
      },
      {
        callSid: "sample-call-2", 
        callerNumber: "+919876543211",
        recordingUrl: "http://example.com/sample2.wav",
        transcript: "कच्चे घर में कच्चे पत्ते कच्चे कचौरी खाए।",
        score: 85,
        status: "PASS" as const
      },
      {
        callSid: "sample-call-3",
        callerNumber: "+919876543212", 
        recordingUrl: "http://example.com/sample3.wav",
        transcript: "कच्चे घर में कुछ पत्ते खाए।",
        score: 62,
        status: "FAIL" as const
      }
    ];

    // Create the sample submissions with timestamps spread over the last few days
    const now = new Date();
    for (let i = 0; i < sampleSubmissions.length; i++) {
      const sample = sampleSubmissions[i];
      const createdAt = new Date(now.getTime() - (i * 24 * 60 * 60 * 1000)); // i days ago
      
      const submission: Submission = {
        id: randomUUID(),
        callSid: sample.callSid,
        callerNumber: sample.callerNumber,
        recordingUrl: sample.recordingUrl,
        transcript: sample.transcript,
        score: sample.score,
        status: sample.status,
        createdAt
      };
      
      this.submissions.set(submission.id, submission);
    }
  }

  async getAdmin(id: string): Promise<Admin | undefined> {
    return this.admins.get(id);
  }

  async getAdminByUsername(username: string): Promise<Admin | undefined> {
    return Array.from(this.admins.values()).find(
      (admin) => admin.username === username,
    );
  }

  async createAdmin(insertAdmin: InsertAdmin): Promise<Admin> {
    const id = randomUUID();
    const admin: Admin = { ...insertAdmin, id };
    this.admins.set(id, admin);
    return admin;
  }

  // User methods (aliases for admin for compatibility)
  async getUser(id: string): Promise<User | undefined> {
    return this.getAdmin(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return this.getAdminByUsername(username);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    return this.createAdmin(insertUser);
  }

  async getSubmission(id: string): Promise<Submission | undefined> {
    return this.submissions.get(id);
  }

  async createSubmission(insertSubmission: InsertSubmission): Promise<Submission> {
    const id = randomUUID();
    const submission: Submission = { 
      ...insertSubmission, 
      id, 
      createdAt: new Date(),
      transcript: insertSubmission.transcript || null,
      score: insertSubmission.score || null,
      status: insertSubmission.status || "PENDING",
    };
    this.submissions.set(id, submission);
    return submission;
  }

  async updateSubmission(id: string, updates: Partial<Pick<Submission, 'transcript' | 'score' | 'status'>>): Promise<Submission | undefined> {
    const submission = this.submissions.get(id);
    if (!submission) return undefined;
    
    const updated = { ...submission, ...updates };
    this.submissions.set(id, updated);
    return updated;
  }

  async updateSubmissionStatus(id: string, status: "PENDING" | "PASS" | "FAIL"): Promise<Submission | undefined> {
    return this.updateSubmission(id, { status });
  }

  async getSubmissions(filters?: {
    status?: string;
    fromDate?: string;
    toDate?: string;
    searchPhone?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ submissions: Submission[]; total: number }> {
    let submissions = Array.from(this.submissions.values());
    
    // Apply filters
    if (filters?.status) {
      submissions = submissions.filter(s => s.status === filters.status);
    }
    
    if (filters?.searchPhone) {
      submissions = submissions.filter(s => 
        s.callerNumber.includes(filters.searchPhone!)
      );
    }
    
    if (filters?.fromDate) {
      const fromDate = new Date(filters.fromDate);
      submissions = submissions.filter(s => s.createdAt >= fromDate);
    }
    
    if (filters?.toDate) {
      const toDate = new Date(filters.toDate);
      submissions = submissions.filter(s => s.createdAt <= toDate);
    }
    
    // Sort by creation date (newest first)
    submissions.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    
    const total = submissions.length;
    
    // Apply pagination
    const limit = filters?.limit || 10;
    const offset = filters?.offset || 0;
    submissions = submissions.slice(offset, offset + limit);
    
    return { submissions, total };
  }
}

export const storage = new DatabaseStorage();
