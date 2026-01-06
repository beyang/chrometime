interface Message {
    type: 'GET_TIME' | 'UPDATE_TIME' | 'SETTINGS_CHANGED';
    domain?: string;
    time?: number;
    settings?: { showHeader: boolean; timezone: string };
}

const HEADER_ID = 'chrometime-tracker-header';
const HEADER_HEIGHT = '24px';

let headerElement: HTMLElement | null = null;
let shadowRoot: ShadowRoot | null = null;
let currentDomain: string = window.location.hostname;
let showHeader = false;

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

    const style = document.createElement('style');
    style.textContent = `
    :host {
      all: initial;
      display: block !important;
      position: fixed !important;
      top: 0 !important;
      left: 0 !important;
      right: 0 !important;
      height: ${HEADER_HEIGHT} !important;
      z-index: 2147483647 !important;
      pointer-events: none !important;
    }
    .header-bar {
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      height: 100% !important;
      background: linear-gradient(to right, #1a1a2e, #16213e) !important;
      color: #eee !important;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
      font-size: 12px !important;
      font-weight: 500 !important;
      letter-spacing: 0.3px !important;
      box-shadow: 0 1px 3px rgba(0,0,0,0.2) !important;
    }
    .domain {
      color: #64b5f6 !important;
      margin-right: 6px !important;
    }
    .time {
      color: #81c784 !important;
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

    headerElement = createHeader();

    if (document.body) {
        document.body.insertBefore(headerElement, document.body.firstChild);
        document.body.style.setProperty('margin-top', HEADER_HEIGHT, 'important');
    }
}

function removeHeader(): void {
    const existing = document.getElementById(HEADER_ID);
    if (existing) {
        existing.remove();
    }
    headerElement = null;
    document.body?.style.removeProperty('margin-top');
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
