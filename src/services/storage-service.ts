import AsyncStorage from '@react-native-async-storage/async-storage';

export interface DriveEvent {
  id: string;
  type: 'harsh_brake' | 'harsh_accel' | 'sharp_turn' | 'aggressive_steer' | 'excessive_movement' | 'phone_handling';
  label: string;
  timestamp: number; // relative to start of drive in ms
  magnitude: number;
  scoreImpact: number;
}

export interface RoutePoint {
  latitude: number;
  longitude: number;
  speed: number; // m/s
  timestamp: number; // absolute
  safetyColor: string; // hex color for route replay
}

export interface DriveSession {
  id: string;
  date: string; // ISO string
  startTime: number; // absolute ms
  endTime: number; // absolute ms
  duration: number; // seconds
  score: number;
  rating: 'Elite' | 'Safe' | 'Average' | 'Risky';
  totalEvents: number;
  eventBreakdown: Record<DriveEvent['type'], number>;
  timeline: DriveEvent[];
  path: RoutePoint[];
  aiFeedback?: string;
}

const HISTORY_KEY = '@safe_drive_history';

export const StorageService = {
  /**
   * Save a newly completed drive session
   */
  async saveDrive(session: DriveSession): Promise<void> {
    try {
      const history = await this.getHistory();
      // Unshift to place newest drives first
      history.unshift(session);
      await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    } catch (error) {
      console.error('Failed to save drive history:', error);
    }
  },

  /**
   * Retrieve all driving history
   */
  async getHistory(): Promise<DriveSession[]> {
    try {
      const data = await AsyncStorage.getItem(HISTORY_KEY);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Failed to get drive history:', error);
      return [];
    }
  },

  /**
   * Fetch a single drive by ID
   */
  async getDriveById(id: string): Promise<DriveSession | null> {
    const history = await this.getHistory();
    return history.find((d) => d.id === id) || null;
  },

  /**
   * Delete a drive session from history
   */
  async deleteDrive(id: string): Promise<void> {
    try {
      const history = await this.getHistory();
      const updated = history.filter((d) => d.id !== id);
      await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
    } catch (error) {
      console.error('Failed to delete drive:', error);
    }
  },

  /**
   * Wipe all drive history
   */
  async clearHistory(): Promise<void> {
    try {
      await AsyncStorage.removeItem(HISTORY_KEY);
    } catch (error) {
      console.error('Failed to clear drive history:', error);
    }
  },

  /**
   * Calculate overall statistics
   */
  async getAggregatedStats() {
    const history = await this.getHistory();
    if (history.length === 0) {
      return {
        totalDrives: 0,
        averageScore: 100,
        totalDuration: 0,
        totalEvents: 0,
        ratingBreakdown: { Elite: 0, Safe: 0, Average: 0, Risky: 0 },
        eventBreakdown: {
          harsh_brake: 0,
          harsh_accel: 0,
          sharp_turn: 0,
          aggressive_steer: 0,
          excessive_movement: 0,
          phone_handling: 0,
        },
      };
    }

    let sumScore = 0;
    let totalDuration = 0;
    let totalEvents = 0;
    const ratingBreakdown = { Elite: 0, Safe: 0, Average: 0, Risky: 0 };
    const eventBreakdown = {
      harsh_brake: 0,
      harsh_accel: 0,
      sharp_turn: 0,
      aggressive_steer: 0,
      excessive_movement: 0,
      phone_handling: 0,
    };

    history.forEach((session) => {
      sumScore += session.score;
      totalDuration += session.duration;
      totalEvents += session.totalEvents;
      ratingBreakdown[session.rating] = (ratingBreakdown[session.rating] || 0) + 1;

      Object.keys(eventBreakdown).forEach((key) => {
        const type = key as DriveEvent['type'];
        eventBreakdown[type] += session.eventBreakdown[type] || 0;
      });
    });

    return {
      totalDrives: history.length,
      averageScore: Math.round(sumScore / history.length),
      totalDuration,
      totalEvents,
      ratingBreakdown,
      eventBreakdown,
    };
  },
};
