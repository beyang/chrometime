import { DomainTimeData, Settings, DEFAULT_SETTINGS, Message } from './types.js';

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

async function loadData(): Promise<{ timeData: DomainTimeData; settings: Settings }> {
    const result = await chrome.storage.local.get(['timeData', 'settings']);
    return {
        timeData: result.timeData || {},
        settings: result.settings || DEFAULT_SETTINGS
    };
}

async function saveSettings(settings: Settings): Promise<void> {
    await chrome.storage.local.set({ settings });
    chrome.runtime.sendMessage({ type: 'SETTINGS_CHANGED', settings } as Message);
}

function populateTimezones(selectEl: HTMLSelectElement, currentTz: string): void {
    const timezones = Intl.supportedValuesOf('timeZone');

    for (const tz of timezones) {
        const option = document.createElement('option');
        option.value = tz;
        option.textContent = tz.replace(/_/g, ' ');
        if (tz === currentTz) {
            option.selected = true;
        }
        selectEl.appendChild(option);
    }
}

function renderTimeData(container: HTMLElement, timeData: DomainTimeData): void {
    const sorted = Object.entries(timeData)
        .filter(([_, time]) => time > 0)
        .sort((a, b) => b[1] - a[1]);

    if (sorted.length === 0) {
        container.innerHTML = '<p class="no-data">No browsing data yet today.</p>';
        return;
    }

    const totalTime = sorted.reduce((sum, [_, time]) => sum + time, 0);

    let html = '';
    for (const [domain, time] of sorted) {
        const percent = Math.round((time / totalTime) * 100);
        html += `
      <div class="domain-row">
        <div class="domain-info">
          <span class="domain-name">${domain}</span>
          <span class="chrometime">${formatTime(time)}</span>
        </div>
        <div class="progress-bar">
          <div class="progress-fill" style="width: ${percent}%"></div>
        </div>
      </div>
    `;
    }

    html += `<div class="total-row">Total: ${formatTime(totalTime)}</div>`;
    container.innerHTML = html;
}

async function init(): Promise<void> {
    const { timeData, settings } = await loadData();

    const container = document.getElementById('time-data')!;
    const showHeaderCheckbox = document.getElementById('show-header') as HTMLInputElement;
    const timezoneSelect = document.getElementById('timezone') as HTMLSelectElement;

    renderTimeData(container, timeData);

    showHeaderCheckbox.checked = settings.showHeader;
    populateTimezones(timezoneSelect, settings.timezone);

    showHeaderCheckbox.addEventListener('change', async () => {
        const newSettings = { ...settings, showHeader: showHeaderCheckbox.checked };
        await saveSettings(newSettings);
    });

    timezoneSelect.addEventListener('change', async () => {
        const newSettings = { ...settings, timezone: timezoneSelect.value };
        await saveSettings(newSettings);
    });
}

document.addEventListener('DOMContentLoaded', init);
