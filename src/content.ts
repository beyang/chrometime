interface Message {
    type: 'GET_TIME' | 'UPDATE_TIME' | 'SETTINGS_CHANGED';
    domain?: string;
    time?: number;
    settings?: { showHeader: boolean; timezone: string };
}

const HEADER_ID = 'chrometime-tracker-header';

let headerElement: HTMLElement | null = null;
let shadowRoot: ShadowRoot | null = null;
let currentDomain: string = window.location.hostname;
let showHeader = false;

function isPageDark(): boolean {
    const bg = window.getComputedStyle(document.body).backgroundColor;
    const match = bg.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (!match) return false;
    const [, r, g, b] = match.map(Number);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance < 0.5;
}

function formatTime(ms: number): string {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
        return `${hours}h ${minutes}m ${seconds}s`;
    } else if (minutes > 0) {
        return `${minutes}m ${seconds}s`;
    }
    return `${seconds}s`;
}

function createHeader(): HTMLElement {
    const existing = document.getElementById(HEADER_ID);
    if (existing) {
        return existing;
    }

    const header = document.createElement('div');
    header.id = HEADER_ID;

    shadowRoot = header.attachShadow({ mode: 'closed' });

    const dark = isPageDark();
    const bgColor = dark ? 'rgba(40, 40, 40, 0.9)' : 'rgba(220, 220, 220, 0.9)';
    const domainColor = dark ? '#aaa' : '#555';
    const timeColor = dark ? '#a0c0e0' : '#4a6a8a';

    const style = document.createElement('style');
    style.textContent = `
    :host {
      all: initial;
      display: block !important;
      position: fixed !important;
      bottom: 0 !important;
      left: 0 !important;
      z-index: 2147483647 !important;
      pointer-events: none !important;
    }
    .header-bar {
      display: inline-flex !important;
      align-items: center !important;
      padding: 4px 8px !important;
      background: ${bgColor} !important;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
      font-size: 11px !important;
      font-weight: 300 !important;
      letter-spacing: 0.3px !important;
    }
    .domain {
      color: ${domainColor} !important;
      margin-right: 6px !important;
    }
    .time {
      color: ${timeColor} !important;
      font-variant-numeric: tabular-nums !important;
    }
  `;

    const bar = document.createElement('div');
    bar.className = 'header-bar';
    bar.innerHTML = `<span class="domain">${currentDomain}</span> <span class="time">0s</span>`;

    shadowRoot.appendChild(style);
    shadowRoot.appendChild(bar);

    return header;
}

function insertHeader(): void {
    if (headerElement && document.body.contains(headerElement)) {
        return;
    }

    const doInsert = () => {
        headerElement = createHeader();
        if (document.body) {
            document.body.appendChild(headerElement);
        }
    };

    if (document.readyState === 'complete') {
        setTimeout(doInsert, 100);
    } else {
        window.addEventListener('load', () => setTimeout(doInsert, 100), { once: true });
    }
}

function removeHeader(): void {
    const existing = document.getElementById(HEADER_ID);
    if (existing) {
        existing.remove();
    }
    headerElement = null;
}

function updateHeaderTime(time: number): void {
    if (!headerElement || !shadowRoot) return;

    const timeEl = shadowRoot.querySelector('.time');
    if (timeEl) {
        timeEl.textContent = formatTime(time);
    }
}

function init(): void {
    chrome.runtime.sendMessage({ type: 'GET_TIME', domain: currentDomain } as Message, (response) => {
        if (chrome.runtime.lastError) return;

        if (response) {
            showHeader = response.settings?.showHeader ?? false;

            if (showHeader) {
                if (document.body) {
                    insertHeader();
                    updateHeaderTime(response.time || 0);
                } else {
                    document.addEventListener('DOMContentLoaded', () => {
                        insertHeader();
                        updateHeaderTime(response.time || 0);
                    });
                }
            }
        }
    });
}

chrome.runtime.onMessage.addListener((message: Message): void => {
    if (message.type === 'UPDATE_TIME' && message.domain === currentDomain) {
        if (showHeader && message.time !== undefined) {
            updateHeaderTime(message.time);
        }
    }

    if (message.type === 'SETTINGS_CHANGED' && message.settings) {
        showHeader = message.settings.showHeader;
        if (showHeader) {
            insertHeader();
            chrome.runtime.sendMessage({ type: 'GET_TIME', domain: currentDomain } as Message, (response) => {
                if (response?.time !== undefined) {
                    updateHeaderTime(response.time);
                }
            });
        } else {
            removeHeader();
        }
    }
});

init();
