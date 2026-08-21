import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { 
  User, 
  ChatMessage, 
  PrayerRequest, 
  Denomination, 
  Language, 
  SubscriptionPlan,
  GeoIPData,
  APIConfig,
  CalendarEvent,
  PrayerWallItem,
  Devotional,
  WorshipSong,
  BlogPost,
  JobListing,
  PressRelease,
  FAQItem
} from '@/types';
import { apiRequest, endSession } from '@/lib/api';

// Authentication state is intentionally kept in memory. Session credentials remain in secure cookies.
type ApiUser = Omit<User, 'createdAt' | 'updatedAt'> & { createdAt: string; updatedAt: string };
const toUser = (user: ApiUser): User => ({ ...user, createdAt: new Date(user.createdAt), updatedAt: new Date(user.updatedAt) });

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  initialized: boolean;
  setUser: (user: User | null) => void;
  initialize: () => Promise<void>;
  login: (email: string, password: string) => Promise<boolean>;
  register: (email: string, password: string, name: string, denomination: Denomination) => Promise<boolean>;
  logout: () => Promise<void>;
  updateProfile: (updates: Partial<User>) => Promise<boolean>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<boolean>;
}

export const useAuthStore = create<AuthState>()((set, get) => ({
  user: null,
  isAuthenticated: false,
  isLoading: false,
  initialized: false,
  setUser: (user) => set({ user, isAuthenticated: !!user }),
  initialize: async () => {
    try {
      const data = await apiRequest<{ user: ApiUser }>('/api/auth/me');
      set({ user: toUser(data.user), isAuthenticated: true, initialized: true });
    } catch {
      set({ user: null, isAuthenticated: false, initialized: true });
    }
  },
  login: async (email, password) => {
    set({ isLoading: true });
    try {
      const data = await apiRequest<{ user: ApiUser }>('/api/auth/login', {
        method: 'POST', body: JSON.stringify({ email, password }),
      });
      set({ user: toUser(data.user), isAuthenticated: true, isLoading: false });
      return true;
    } catch {
      set({ isLoading: false });
      return false;
    }
  },
  register: async (email, password, name, denomination) => {
    set({ isLoading: true });
    try {
      const data = await apiRequest<{ user: ApiUser }>('/api/auth/register', {
        method: 'POST', body: JSON.stringify({ email, password, name, denomination }),
      });
      set({ user: toUser(data.user), isAuthenticated: true, isLoading: false });
      return true;
    } catch {
      set({ isLoading: false });
      return false;
    }
  },
  logout: async () => {
    await endSession();
    set({ user: null, isAuthenticated: false });
  },
  updateProfile: async (updates) => {
    if (!get().user) return false;
    try {
      const data = await apiRequest<{ user: ApiUser }>('/api/user/profile', { method: 'PUT', body: JSON.stringify(updates) });
      set({ user: toUser(data.user) });
      return true;
    } catch { return false; }
  },
  changePassword: async (currentPassword, newPassword) => {
    try {
      await apiRequest<{ ok: true }>('/api/auth/change-password', { method: 'POST', body: JSON.stringify({ currentPassword, newPassword }) });
      set({ user: null, isAuthenticated: false });
      return true;
    } catch { return false; }
  },
}));

// Chat Store
interface ChatState {
  messages: ChatMessage[];
  isTyping: boolean;
  showAdminPrompt: boolean;
  adminUnlocked: boolean;
  addMessage: (message: Omit<ChatMessage, 'id' | 'timestamp'>) => void;
  clearChat: () => void;
  setIsTyping: (isTyping: boolean) => void;
  setShowAdminPrompt: (show: boolean) => void;
  unlockAdmin: (password: string) => boolean;
  lockAdmin: () => void;
}

export const useChatStore = create<ChatState>()(
  persist(
    (set) => ({
      messages: [],
      isTyping: false,
      showAdminPrompt: false,
      adminUnlocked: false,
      addMessage: (message) => {
        const newMessage: ChatMessage = {
          ...message,
          id: Date.now().toString(),
          timestamp: new Date(),
        };
        set((state) => ({ messages: [...state.messages, newMessage] }));
      },
      clearChat: () => set({ messages: [] }),
      setIsTyping: (isTyping) => set({ isTyping }),
      setShowAdminPrompt: (show) => set({ showAdminPrompt: show }),
      unlockAdmin: () => {
        return false;
      },
      lockAdmin: () => set({ adminUnlocked: false }),
    }),
    {
      name: 'chat-storage',
    }
  )
);

// Prayer Store
interface PrayerState {
  prayers: PrayerRequest[];
  addPrayer: (prayer: Omit<PrayerRequest, 'id' | 'createdAt' | 'updatedAt'>) => void;
  deletePrayer: (id: string) => void;
  markAnswered: (id: string) => void;
}

export const usePrayerStore = create<PrayerState>()(
  persist(
    (set) => ({
      prayers: [],
      addPrayer: (prayer) => {
        const newPrayer: PrayerRequest = {
          ...prayer,
          id: Date.now().toString(),
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        set((state) => ({ prayers: [...state.prayers, newPrayer] }));
      },
      deletePrayer: (id) => {
        set((state) => ({
          prayers: state.prayers.filter((p) => p.id !== id),
        }));
      },
      markAnswered: (id) => {
        set((state) => ({
          prayers: state.prayers.map((p) =>
            p.id === id
              ? { ...p, isAnswered: true, answeredDate: new Date(), updatedAt: new Date() }
              : p
          ),
        }));
      },
    }),
    {
      name: 'prayer-storage',
    }
  )
);

// UI Store
interface UIState {
  sidebarOpen: boolean;
  currentLanguage: Language;
  theme: 'light' | 'dark';
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  setLanguage: (lang: Language) => void;
  toggleTheme: () => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      sidebarOpen: true,
      currentLanguage: 'en',
      theme: 'light',
      toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      setLanguage: (lang) => set({ currentLanguage: lang }),
      toggleTheme: () => set((state) => ({ theme: state.theme === 'light' ? 'dark' : 'light' })),
    }),
    {
      name: 'ui-storage',
    }
  )
);

// Pricing Store
interface PricingState {
  geoData: GeoIPData | null;
  selectedPlan: SubscriptionPlan;
  selectedPeriod: 'monthly' | 'yearly';
  isLoading: boolean;
  fetchGeoData: () => Promise<void>;
  setSelectedPlan: (plan: SubscriptionPlan) => void;
  setSelectedPeriod: (period: 'monthly' | 'yearly') => void;
  convertPrice: (zarAmount: number) => number;
  getCurrencySymbol: () => string;
}

export const usePricingStore = create<PricingState>()((set, get) => ({
  geoData: null,
  selectedPlan: 'individual',
  selectedPeriod: 'monthly',
  isLoading: false,
  fetchGeoData: async () => {
    // Prices are currently charged in ZAR. Locale-specific pricing requires a server-managed FX source.
    set({
      geoData: { country: 'South Africa', countryCode: 'ZA', currency: 'ZAR', currencySymbol: 'R', exchangeRate: 1 },
      isLoading: false,
    });
  },
  setSelectedPlan: (plan) => set({ selectedPlan: plan }),
  setSelectedPeriod: (period) => set({ selectedPeriod: period }),
  convertPrice: (zarAmount) => {
    const { geoData } = get();
    if (!geoData) return zarAmount;
    return Math.round(zarAmount * geoData.exchangeRate);
  },
  getCurrencySymbol: () => {
    const { geoData } = get();
    return geoData?.currencySymbol || 'R';
  },
}));

// Admin Store
interface AdminState {
  stats: {
    totalUsers: number;
    activeSubscribers: number;
    chatMessages: number;
    prayers: number;
    devotionals: number;
  };
  subscribers: Array<{ id: string; name: string; email: string; status: 'active' | 'inactive'; plan: string }>;
  apiConfig: APIConfig;
  isLoading: boolean;
  fetchStats: () => Promise<void>;
  fetchSubscribers: () => Promise<void>;
  updateAPIConfig: (config: Partial<APIConfig>) => void;
}

export const useAdminStore = create<AdminState>()((set) => ({
      stats: {
        totalUsers: 0,
        activeSubscribers: 0,
        chatMessages: 0,
        prayers: 0,
        devotionals: 0,
      },
      subscribers: [],
      apiConfig: {
        provider: 'server',
        environment: 'unavailable',
        callbackUrl: '',
      },
      isLoading: false,
      fetchStats: async () => {
        set({ isLoading: true });
        try {
          const data = await apiRequest<{ stats: { total_users: number; active_subscribers: number; ai_requests: number; prayer_posts: number; published_devotionals: number } }>('/api/admin/stats');
          set({ stats: { totalUsers: data.stats.total_users, activeSubscribers: data.stats.active_subscribers, chatMessages: data.stats.ai_requests, prayers: data.stats.prayer_posts, devotionals: data.stats.published_devotionals }, isLoading: false });
        } catch {
          set({ isLoading: false });
        }
      },
      fetchSubscribers: async () => {
        set({ isLoading: true });
        try {
          const data = await apiRequest<{ subscribers: AdminState['subscribers'] }>('/api/admin/subscribers');
          set({ subscribers: data.subscribers, isLoading: false });
        } catch {
          set({ isLoading: false });
        }
      },
      updateAPIConfig: (config) => set((state) => ({
        apiConfig: { ...state.apiConfig, ...config }
      })),
    })
);

// Blog Store
interface BlogState {
  posts: BlogPost[];
  isLoading: boolean;
  fetchPosts: () => Promise<void>;
}

export const useBlogStore = create<BlogState>()((set) => ({
  posts: [],
  isLoading: false,
  fetchPosts: async () => {
    set({ isLoading: true });
    await new Promise(resolve => setTimeout(resolve, 500));
    set({ isLoading: false });
  },
}));

// Careers Store
interface CareersState {
  jobs: JobListing[];
  isLoading: boolean;
  fetchJobs: () => Promise<void>;
}

export const useCareersStore = create<CareersState>()((set) => ({
  jobs: [],
  isLoading: false,
  fetchJobs: async () => {
    set({ isLoading: true });
    await new Promise(resolve => setTimeout(resolve, 500));
    set({ isLoading: false });
  },
}));

// FAQ Store
interface FAQState {
  items: FAQItem[];
  isLoading: boolean;
  fetchItems: () => Promise<void>;
}

export const useFAQStore = create<FAQState>()((set) => ({
  items: [],
  isLoading: false,
  fetchItems: async () => {
    set({ isLoading: true });
    await new Promise(resolve => setTimeout(resolve, 500));
    set({ isLoading: false });
  },
}));

// Press Store
interface PressState {
  releases: PressRelease[];
  isLoading: boolean;
  fetchReleases: () => Promise<void>;
}

export const usePressStore = create<PressState>()((set) => ({
  releases: [],
  isLoading: false,
  fetchReleases: async () => {
    set({ isLoading: true });
    await new Promise(resolve => setTimeout(resolve, 500));
    set({ isLoading: false });
  },
}));

// Prayer Wall Store
interface PrayerWallState {
  prayers: PrayerWallItem[];
  isLoading: boolean;
  fetchWallItems: () => Promise<void>;
  addPrayer: (prayer: Omit<PrayerWallItem, 'id' | 'prayerCount' | 'createdAt'>) => Promise<void>;
  prayFor: (id: string) => Promise<void>;
}

export const usePrayerWallStore = create<PrayerWallState>()((set) => ({
  prayers: [],
  isLoading: false,
  fetchWallItems: async () => {
    set({ isLoading: true });
    try {
      const data = await apiRequest<{ prayers: Array<{ id: string; content: string; is_anonymous: boolean; author_name: string; prayer_count: number; created_at: string }> }>('/api/prayer-wall');
      set({
        prayers: data.prayers.map((p) => ({ id: p.id, userId: '', userName: p.author_name, content: p.content, isAnonymous: p.is_anonymous, prayerCount: p.prayer_count, createdAt: new Date(p.created_at) })),
        isLoading: false,
      });
    } catch {
      set({ isLoading: false });
    }
  },
  addPrayer: async (prayer) => {
    try {
      await apiRequest<{ prayer: unknown }>('/api/prayer-wall', {
        method: 'POST',
        body: JSON.stringify({ content: prayer.content, isAnonymous: prayer.isAnonymous }),
      });
      await usePrayerWallStore.getState().fetchWallItems();
    } catch {
      // noop
    }
  },
  prayFor: async (id) => {
    try {
      await apiRequest<void>(`/api/prayer-wall/${id}/pray`, { method: 'POST' });
      set((state) => ({ prayers: state.prayers.map((p) => (p.id === id ? { ...p, prayerCount: p.prayerCount + 1 } : p)) }));
    } catch {
      // noop
    }
  }
}));

// Calendar Store
interface CalendarState {
  events: CalendarEvent[];
  isLoading: boolean;
  fetchEvents: () => Promise<void>;
  addEvent: (event: Omit<CalendarEvent, 'id'>) => Promise<void>;
}

export const useCalendarStore = create<CalendarState>()((set) => ({
  events: [],
  isLoading: false,
  fetchEvents: async () => {
    set({ isLoading: true });
    try {
      const data = await apiRequest<{ events: Array<{ id: string; title: string; description: string; starts_at: string; category: CalendarEvent['type'] }> }>('/api/calendar');
      set({
        events: data.events.map((e) => ({ id: e.id, title: e.title, description: e.description, date: new Date(e.starts_at), type: e.category || 'personal' })),
        isLoading: false,
      });
    } catch {
      set({ isLoading: false });
    }
  },
  addEvent: async (event) => {
    try {
      const data = await apiRequest<{ event: { id: string; title: string; description: string; starts_at: string; category: CalendarEvent['type'] } }>('/api/calendar', {
        method: 'POST',
        body: JSON.stringify({ title: event.title, description: event.description || '', startsAt: event.date.toISOString(), category: event.type }),
      });
      set((state) => ({ events: [...state.events, { id: data.event.id, title: data.event.title, description: data.event.description, date: new Date(data.event.starts_at), type: data.event.category || 'personal' }] }));
    } catch {
      // noop
    }
  },
}));

// Devotional Store
interface DevotionalState {
  devotionals: Devotional[];
  isLoading: boolean;
  fetchDevotionals: () => Promise<void>;
  getTodaysDevotional: () => Devotional | undefined;
}

export const useDevotionalStore = create<DevotionalState>()((set, get) => ({
  devotionals: [],
  isLoading: false,
  fetchDevotionals: async () => {
    set({ isLoading: true });
    try {
      const data = await apiRequest<{ devotionals: Array<{ id: string; title: string; scripture_reference: string; scripture_text: string | null; reflection: string; prayer: string; published_at: string | null; created_at: string }> }>('/api/devotionals');
      set({
        devotionals: data.devotionals.map((d) => ({ id: d.id, title: d.title, verse: d.scripture_reference, scripture: d.scripture_text || '', reflection: d.reflection, prayer: d.prayer, date: new Date(d.published_at || d.created_at) })),
        isLoading: false,
      });
    } catch {
      set({ isLoading: false });
    }
  },
  getTodaysDevotional: () => {
    const { devotionals } = get();
    return devotionals[0];
  },
}));

// Worship Store
interface WorshipState {
  songs: WorshipSong[];
  playlists: Array<{ id: string; name: string; songs: number; color: string }>;
  isLoading: boolean;
  fetchSongs: () => Promise<void>;
}

export const useWorshipStore = create<WorshipState>()((set) => ({
  songs: [],
  playlists: [],
  isLoading: false,
  fetchSongs: async () => {
    set({ isLoading: true });
    try {
      const data = await apiRequest<{ songs: WorshipSong[]; playlists: WorshipState['playlists'] }>('/api/content/worship');
      set({ songs: data.songs, playlists: data.playlists, isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },
}));
