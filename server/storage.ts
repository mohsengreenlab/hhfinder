import { 
  type User, 
  type InsertUser, 
  type JobApplication, 
  type InsertJobApplication, 
  type UpdateJobApplication,
  type CreateUserRequest,
  type UpdateUserRequest
} from "@shared/schema";

export interface IStorage {
  // User management
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;
  createUser(user: CreateUserRequest): Promise<User>;
  updateUser(id: number, updates: UpdateUserRequest): Promise<User | undefined>;
  updateUserLastLogin(id: number): Promise<void>;
  
  // Job application management
  getJobApplication(id: number): Promise<JobApplication | undefined>;
  getJobApplicationsByUser(userId: number): Promise<JobApplication[]>;
  getLatestJobApplication(userId: number): Promise<JobApplication | undefined>;
  createJobApplication(application: InsertJobApplication): Promise<JobApplication>;
  updateJobApplication(id: number, updates: UpdateJobApplication): Promise<JobApplication | undefined>;
  deleteJobApplication(id: number): Promise<void>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private jobApplications: Map<number, JobApplication>;
  private userIdCounter: number;
  private appIdCounter: number;

  constructor() {
    this.users = new Map();
    this.jobApplications = new Map();
    this.userIdCounter = 1;
    this.appIdCounter = 1;
    
    // Create default admin user
    this.createDefaultAdmin();
  }

  private async createDefaultAdmin(): Promise<void> {
    const adminUser: User = {
      id: this.userIdCounter++,
      username: "admin",
      password: "admin123", // TODO: Hash this in production
      isAdmin: true,
      isActive: true,
      lastLoginAt: null,
      createdAt: new Date()
    };
    this.users.set(adminUser.id, adminUser);
  }

  // User management methods
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username
    );
  }

  async getAllUsers(): Promise<User[]> {
    return Array.from(this.users.values());
  }

  async createUser(userRequest: CreateUserRequest): Promise<User> {
    const user: User = {
      id: this.userIdCounter++,
      username: userRequest.username,
      password: userRequest.password, // TODO: Hash this in production
      isAdmin: userRequest.isAdmin,
      isActive: true,
      lastLoginAt: null,
      createdAt: new Date()
    };
    this.users.set(user.id, user);
    return user;
  }

  async updateUser(id: number, updates: UpdateUserRequest): Promise<User | undefined> {
    const user = this.users.get(id);
    if (!user) return undefined;

    const updatedUser: User = {
      ...user,
      ...updates
    };
    this.users.set(id, updatedUser);
    return updatedUser;
  }

  async updateUserLastLogin(id: number): Promise<void> {
    const user = this.users.get(id);
    if (user) {
      user.lastLoginAt = new Date();
      this.users.set(id, user);
    }
  }

  // Job application management methods
  async getJobApplication(id: number): Promise<JobApplication | undefined> {
    return this.jobApplications.get(id);
  }

  async getJobApplicationsByUser(userId: number): Promise<JobApplication[]> {
    return Array.from(this.jobApplications.values())
      .filter(app => app.userId === userId)
      .sort((a, b) => b.lastEditedAt.getTime() - a.lastEditedAt.getTime());
  }

  async getLatestJobApplication(userId: number): Promise<JobApplication | undefined> {
    const userApps = await this.getJobApplicationsByUser(userId);
    return userApps.find(app => !app.isCompleted);
  }

  async createJobApplication(appData: InsertJobApplication): Promise<JobApplication> {
    const application: JobApplication = {
      id: this.appIdCounter++,
      ...appData,
      appliedVacancyIds: appData.appliedVacancyIds || [],
      lastEditedAt: new Date(),
      createdAt: new Date()
    };
    this.jobApplications.set(application.id, application);
    return application;
  }

  async updateJobApplication(id: number, updates: UpdateJobApplication): Promise<JobApplication | undefined> {
    const application = this.jobApplications.get(id);
    if (!application) return undefined;

    const updatedApplication: JobApplication = {
      ...application,
      ...updates,
      lastEditedAt: new Date()
    };
    this.jobApplications.set(id, updatedApplication);
    return updatedApplication;
  }

  async deleteJobApplication(id: number): Promise<void> {
    this.jobApplications.delete(id);
  }
}

export const storage = new MemStorage();
