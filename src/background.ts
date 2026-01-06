import { DomainTimeData, StorageData, Settings, DEFAULT_SETTINGS, Message } from './types.js';

const UPDATE_INTERVAL_MS = 1000;
let currentTabId: number | null = null;
let currentDomain: string | null = null;
let lastUpdateTime: number = Date.now();

function getDomain(url: string): string | null {
  try {
    const urlObj = new URL(url);
    if (urlObj.protocol === 'chrome:' || urlObj.protocol === 'chrome-extension:') {
      return null;
    }
    return urlObj.hostname;
  } catch {
    return null;
  }
}

function getTodayDateString(timezone: string): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: timezone });
}

async function getStorageData(): Promise<StorageData> {
  const result = await chrome.storage.local.get(['timeData', 'lastResetDate', 'settings']);
  const settings: Settings = result.settings || DEFAULT_SETTINGS;
  const todayDate = getTodayDateString(settings.timezone);
  
  if (result.lastResetDate !== todayDate) {
    return {
      timeData: {},
      lastActiveTime: Date.now(),
      lastActiveDomain: null,
      lastResetDate: todayDate,
      settings
    };
  }
  
  return {
    timeData: result.timeData || {},
    lastActiveTime: Date.now(),
    lastActiveDomain: null,
    lastResetDate: todayDate,
    settings
  };
}

async function saveTimeData(timeData: DomainTimeData, lastResetDate: string): Promise<void> {
  await chrome.storage.local.set({ timeData, lastResetDate });
}

async function updateTime(): Promise<void> {
  if (!currentDomain) return;
  
  const now = Date.now();
  const elapsed = now - lastUpdateTime;
  lastUpdateTime = now;
  
  if (elapsed > 0 && elapsed < 60000) {
    const data = await getStorageData();
    data.timeData[currentDomain] = (data.timeData[currentDomain] || 0) + elapsed;
    await saveTimeData(data.timeData, data.lastResetDate);
    
    if (currentTabId !== null) {
      try {
        await chrome.tabs.sendMessage(currentTabId, {
          type: 'UPDATE_TIME',
          domain: currentDomain,
          time: data.timeData[currentDomain]
        } as Message);
      } catch {
        // Tab might not have content script loaded
      }
    }
  }
}

async function handleTabChange(tabId: number, url: string | undefined): Promise<void> {
  await updateTime();
  
  currentTabId = tabId;
  currentDomain = url ? getDomain(url) : null;
  lastUpdateTime = Date.now();
}

chrome.tabs.onActivated.addListener(async (activeInfo) => {
  const tab = await chrome.tabs.get(activeInfo.tabId);
  await handleTabChange(activeInfo.tabId, tab.url);
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.url && tabId === currentTabId) {
    await handleTabChange(tabId, changeInfo.url);
  }
});

chrome.windows.onFocusChanged.addListener(async (windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    await updateTime();
    currentDomain = null;
    currentTabId = null;
  } else {
    try {
      const [tab] = await chrome.tabs.query({ active: true, windowId });
      if (tab && tab.id) {
        await handleTabChange(tab.id, tab.url);
      }
    } catch {
      // Window might be closing
    }
  }
});

chrome.runtime.onMessage.addListener((message: Message, sender, sendResponse) => {
  if (message.type === 'GET_TIME' && message.domain) {
    getStorageData().then(data => {
      sendResponse({ time: data.timeData[message.domain!] || 0, settings: data.settings });
    });
    return true;
  }
  if (message.type === 'SETTINGS_CHANGED') {
    chrome.tabs.query({}, async (tabs) => {
      for (const tab of tabs) {
        if (tab.id) {
          try {
            await chrome.tabs.sendMessage(tab.id, message);
          } catch {
            // Tab might not have content script
          }
        }
      }
    });
  }
});

chrome.alarms.create('updateTime', { periodInMinutes: 1 / 60 });
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'updateTime') {
    await updateTime();
  }
});

(async () => {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.id && tab.url) {
      await handleTabChange(tab.id, tab.url);
    }
  } catch {
    // No active tab on startup
  }
})();
