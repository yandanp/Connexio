/**
 * Vitest Test Setup
 *
 * This file runs before each test file and sets up the testing environment.
 */

import "@testing-library/jest-dom/vitest";

// Mock Tauri APIs for testing
const mockTauriApis = () => {
  // Mock @tauri-apps/api/core
  vi.mock("@tauri-apps/api/core", () => ({
    invoke: vi.fn(),
  }));

  // Mock @tauri-apps/api/event
  vi.mock("@tauri-apps/api/event", () => ({
    listen: vi.fn().mockResolvedValue(() => {}),
    emit: vi.fn(),
  }));
};

// Mock xterm.js for tests (canvas/webgl not available in jsdom)
const mockXterm = () => {
  vi.mock("@xterm/xterm", () => ({
    Terminal: vi.fn().mockImplementation(() => ({
      open: vi.fn(),
      write: vi.fn(),
      dispose: vi.fn(),
      focus: vi.fn(),
      loadAddon: vi.fn(),
      onData: vi.fn(),
      onTitleChange: vi.fn(),
      rows: 24,
      cols: 80,
    })),
  }));

  vi.mock("@xterm/addon-fit", () => ({
    FitAddon: vi.fn().mockImplementation(() => ({
      fit: vi.fn(),
      dispose: vi.fn(),
    })),
  }));

  vi.mock("@xterm/addon-webgl", () => ({
    WebglAddon: vi.fn().mockImplementation(() => ({
      dispose: vi.fn(),
      onContextLoss: vi.fn(),
    })),
  }));
};

// Setup mocks before all tests
beforeAll(() => {
  mockTauriApis();
  mockXterm();
});

// Clean up after each test
afterEach(() => {
  vi.clearAllMocks();
});

// Reset all mocks after all tests
afterAll(() => {
  vi.resetAllMocks();
});

// Global test utilities
export {};
