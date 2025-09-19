import { type Admin, type InsertAdmin, type Submission, type InsertSubmission, type User, type InsertUser } from "@shared/schema";
import { randomUUID } from "crypto";
import session from "express-session";
import createMemoryStore from "memorystore";

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

export const storage = new MemStorage();
