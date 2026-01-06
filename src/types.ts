export interface DomainTimeData {
  [domain: string]: number;
}

export interface StorageData {
  timeData: DomainTimeData;
  lastActiveTime: number;
  lastActiveDomain: string | null;
  lastResetDate: string;
  settings: Settings;
}

export interface Settings {
  showHeader: boolean;
  timezone: string;
}

export interface Message {
  type: 'GET_TIME' | 'UPDATE_TIME' | 'SETTINGS_CHANGED';
  domain?: string;
  time?: number;
  settings?: Settings;
}

export const DEFAULT_SETTINGS: Settings = {
  showHeader: false,
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
};
