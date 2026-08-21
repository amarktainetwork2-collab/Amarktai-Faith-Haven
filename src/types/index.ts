export type Denomination = 
  | 'catholic'
  | 'orthodox'
  | 'anglican'
  | 'lutheran'
  | 'methodist'
  | 'presbyterian'
  | 'baptist'
  | 'pentecostal'
  | 'charismatic'
  | 'reformed'
  | 'nondenominational'
  | 'other';

export type Language = 'en' | 'af' | 'zu' | 'xh';

export type SubscriptionPlan = 'free' | 'individual' | 'family' | 'congregation';

export interface User {
  id: string;
  email: string;
  name: string;
  denomination: Denomination;
  language: Language;
  role: 'user' | 'admin';
  subscriptionPlan: SubscriptionPlan;
  emailVerified?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  sources?: string[];
}

export interface PrayerRequest {
  id: string;
  userId: string;
  title: string;
  content: string;
  tags: string[];
  isAnswered: boolean;
  answeredDate?: Date;
  isPublic: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface PrayerWallItem {
  id: string;
  userId: string;
  userName: string;
  content: string;
  prayerCount: number;
  isAnonymous: boolean;
  createdAt: Date;
}

export interface CalendarEvent {
  id: string;
  title: string;
  date: Date;
  type: 'feast' | 'fast' | 'holiday' | 'personal';
  description?: string;
  denomination?: Denomination[];
  isAllDay?: boolean;
}

export interface Devotional {
  id: string;
  title: string;
  verse: string;
  scripture: string;
  reflection: string;
  prayer: string;
  date: Date;
  denomination?: Denomination[];
}

export interface ChildrenStory {
  id: string;
  title: string;
  ageRange: string;
  scripture: string;
  story: string;
  moral: string;
  activity?: string;
}

export interface Sermon {
  id: string;
  title: string;
  scripture: string;
  theme: string;
  outline: string[];
  introduction: string;
  mainPoints: string[];
  conclusion: string;
  illustrations: string[];
  createdAt: Date;
}

export interface WorshipSong {
  id: string;
  title: string;
  artist: string;
  category: string;
  duration?: string;
  lyrics?: string;
  chords?: string;
}

export interface GeoIPData {
  country: string;
  countryCode: string;
  currency: string;
  currencySymbol: string;
  exchangeRate: number;
}

export interface APIConfig {
  provider: "payfast" | "stripe" | "server";
  environment: "sandbox" | "live" | "unavailable";
  callbackUrl: string;
}

export interface PricingTier {
  id: SubscriptionPlan;
  name: string;
  description: string;
  monthlyPrice: number;
  yearlyPrice: number;
  features: string[];
  notIncluded?: string[];
  popular?: boolean;
}

export interface Testimonial {
  id: string;
  name: string;
  role: string;
  denomination: string;
  content: string;
  avatar?: string;
}

export interface FAQItem {
  id: string;
  question: string;
  answer: string;
  category: string;
}

export interface BlogPost {
  id: string;
  title: string;
  excerpt: string;
  content: string;
  author: string;
  date: Date;
  category: string;
  image?: string;
  tags: string[];
}

export interface JobListing {
  id: string;
  title: string;
  department: string;
  location: string;
  type: 'full-time' | 'part-time' | 'contract';
  description: string;
  requirements: string[];
  postedAt: Date;
}

export interface PressRelease {
  id: string;
  title: string;
  date: Date;
  excerpt: string;
  content: string;
}
