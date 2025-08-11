import { 
  type User, 
  type InsertUser, 
  type JobApplication, 
  type InsertJobApplication, 
  type UpdateJobApplication,
  type CreateUserRequest,
  type UpdateUserRequest,
  type SavedPrompt,
  type InsertSavedPromptWithUser,
  type UpdateSavedPrompt,
  type UserSettings,
  type InsertUserSettings,
  type UpdateUserSettings
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
  
  // Saved prompt management
  getSavedPrompt(id: number): Promise<SavedPrompt | undefined>;
  getSavedPromptsByUser(userId: number): Promise<SavedPrompt[]>;
  createSavedPrompt(prompt: InsertSavedPromptWithUser): Promise<SavedPrompt>;
  updateSavedPrompt(id: number, updates: UpdateSavedPrompt): Promise<SavedPrompt | undefined>;
  deleteSavedPrompt(id: number): Promise<void>;
  getSavedPromptByUserAndName(userId: number, name: string): Promise<SavedPrompt | undefined>;
  
  // User settings management
  getUserSettings(userId: number): Promise<UserSettings | undefined>;
  createUserSettings(settings: InsertUserSettings): Promise<UserSettings>;
  updateUserSettings(userId: number, updates: UpdateUserSettings): Promise<UserSettings | undefined>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private jobApplications: Map<number, JobApplication>;
  private savedPrompts: Map<number, SavedPrompt>;
  private userSettings: Map<number, UserSettings>;
  private userIdCounter: number;
  private appIdCounter: number;
  private promptIdCounter: number;
  private settingsIdCounter: number;

  constructor() {
    this.users = new Map();
    this.jobApplications = new Map();
    this.savedPrompts = new Map();
    this.userSettings = new Map();
    this.userIdCounter = 1;
    this.appIdCounter = 1;
    this.promptIdCounter = 1;
    this.settingsIdCounter = 1;
    
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

  // Saved prompt management methods
  async getSavedPrompt(id: number): Promise<SavedPrompt | undefined> {
    return this.savedPrompts.get(id);
  }

  async getSavedPromptsByUser(userId: number): Promise<SavedPrompt[]> {
    return Array.from(this.savedPrompts.values())
      .filter(prompt => prompt.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async createSavedPrompt(promptData: InsertSavedPromptWithUser): Promise<SavedPrompt> {
    const prompt: SavedPrompt = {
      id: this.promptIdCounter++,
      ...promptData,
      createdAt: new Date()
    };
    this.savedPrompts.set(prompt.id, prompt);
    return prompt;
  }

  async updateSavedPrompt(id: number, updates: UpdateSavedPrompt): Promise<SavedPrompt | undefined> {
    const prompt = this.savedPrompts.get(id);
    if (!prompt) return undefined;

    const updatedPrompt: SavedPrompt = {
      ...prompt,
      ...updates,
    };
    this.savedPrompts.set(id, updatedPrompt);
    return updatedPrompt;
  }

  async deleteSavedPrompt(id: number): Promise<void> {
    this.savedPrompts.delete(id);
  }

  async getSavedPromptByUserAndName(userId: number, name: string): Promise<SavedPrompt | undefined> {
    return Array.from(this.savedPrompts.values()).find(
      prompt => prompt.userId === userId && prompt.name === name
    );
  }

  // User settings management methods
  async getUserSettings(userId: number): Promise<UserSettings | undefined> {
    return Array.from(this.userSettings.values()).find(
      settings => settings.userId === userId
    );
  }

  async createUserSettings(settingsData: InsertUserSettings): Promise<UserSettings> {
    const settings: UserSettings = {
      id: this.settingsIdCounter++,
      ...settingsData,
      updatedAt: new Date()
    };
    this.userSettings.set(settings.id, settings);
    return settings;
  }

  async updateUserSettings(userId: number, updates: UpdateUserSettings): Promise<UserSettings | undefined> {
    let settings = await this.getUserSettings(userId);
    
    if (!settings) {
      // Create new settings if they don't exist
      settings = await this.createUserSettings({ userId, ...updates });
    } else {
      const updatedSettings: UserSettings = {
        ...settings,
        ...updates,
        updatedAt: new Date()
      };
      this.userSettings.set(settings.id, updatedSettings);
      settings = updatedSettings;
    }
    
    return settings;
  }
}

export const storage = new MemStorage();
