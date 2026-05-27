import Browserbase from '@browserbasehq/sdk';
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import type { ComputerAction } from './types';

export type BrowserSession = {
	page: Page;
	browserbaseSessionId: string;
	debuggerUrl?: string;
	currentUrl: () => string;
	screenshotDataUrl: () => Promise<string>;
	executeAction: (action: ComputerAction) => Promise<void>;
	close: () => Promise<void>;
};

export type BrowserSessionCredentials = {
	apiKey: string;
	projectId: string;
};

export async function createBrowserSession(
	credentials: BrowserSessionCredentials,
	initialUrl = 'about:blank'
): Promise<BrowserSession> {
	const client = new Browserbase({ apiKey: credentials.apiKey });
	const browserbaseSession = await client.sessions.create({
		projectId: credentials.projectId,
		browserSettings: {
			viewport: { width: 1024, height: 768 },
			recordSession: true,
			logSession: true
		},
		userMetadata: {
			app: 'flightlog'
		}
	});
	const browser: Browser = await chromium.connectOverCDP(browserbaseSession.connectUrl);
	const context = await browserContext(browser);
	const page = await browserPage(context);
	await page.setViewportSize({ width: 1024, height: 768 });
	await page.goto(initialUrl);
	const debugUrls = await client.sessions.debug(browserbaseSession.id).catch(() => undefined);

	return {
		page,
		browserbaseSessionId: browserbaseSession.id,
		debuggerUrl: debugUrls?.debuggerUrl,
		currentUrl: () => page.url(),
		screenshotDataUrl: async () => {
			const screenshot = await page.screenshot({ type: 'png' });
			return `data:image/png;base64,${screenshot.toString('base64')}`;
		},
		executeAction: async (action) => {
			switch (action.type) {
				case 'click':
					await page.mouse.click(action.x, action.y, { button: normalizeButton(action.button) });
					break;
				case 'double_click':
					await page.mouse.dblclick(action.x, action.y, { button: normalizeButton(action.button) });
					break;
				case 'scroll':
					await page.mouse.move(action.x ?? 512, action.y ?? 384);
					await page.evaluate(({ scrollX, scrollY }) => window.scrollBy(scrollX, scrollY), {
						scrollX: action.scroll_x ?? 0,
						scrollY: action.scroll_y ?? 0
					});
					break;
				case 'keypress':
					for (const key of action.keys) await page.keyboard.press(normalizeKey(key));
					break;
				case 'type':
					await page.keyboard.type(action.text);
					break;
				case 'wait':
					await page.waitForTimeout(1000);
					break;
				case 'screenshot':
					break;
				default:
					await page.waitForTimeout(250);
					break;
			}
		},
		close: () => browser.close()
	};
}

async function browserContext(browser: Browser): Promise<BrowserContext> {
	return browser.contexts()[0] ?? (await browser.newContext());
}

async function browserPage(context: BrowserContext): Promise<Page> {
	return context.pages()[0] ?? (await context.newPage());
}

function normalizeButton(button: string | undefined): 'left' | 'right' | 'middle' {
	if (button === 'right' || button === 'middle') return button;
	return 'left';
}

function normalizeKey(key: string) {
	const lower = key.toLowerCase();
	if (lower === 'enter' || lower === 'return') return 'Enter';
	if (lower === 'space') return ' ';
	return key;
}
