import { type Admin, type InsertAdmin, type Submission, type InsertSubmission, type User, type InsertUser, admins, submissions } from "@shared/schema";
import { eq, and, gte, lte, ilike, desc, count } from "drizzle-orm";
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
       
    } catch (error) {
      console.log("Database initialization completed (some operations may have been skipped)");
    }
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
 

export const storage = new DatabaseStorage();
