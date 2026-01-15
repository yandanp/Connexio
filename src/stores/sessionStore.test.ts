/**
 * Session Store Tests
 *
 * Tests for the Zustand session store that manages tab state.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { useSessionStore } from "@/stores/sessionStore";

describe("sessionStore", () => {
  // Reset store before each test
  beforeEach(() => {
    useSessionStore.setState({
      tabs: [],
      activeTabId: null,
      version: 1,
    });
  });

  describe("addTab", () => {
    it("should add a new tab with correct shell type", () => {
      const store = useSessionStore.getState();
      const tabId = store.addTab("powershell");

      const state = useSessionStore.getState();
      expect(state.tabs).toHaveLength(1);
      expect(state.tabs[0].id).toBe(tabId);
      expect(state.tabs[0].shellType).toBe("powershell");
      expect(state.tabs[0].title).toBe("PowerShell");
    });

    it("should set the new tab as active", () => {
      const store = useSessionStore.getState();
      const tabId = store.addTab("cmd");

      const state = useSessionStore.getState();
      expect(state.activeTabId).toBe(tabId);
    });

    it("should set working directory when provided", () => {
      const store = useSessionStore.getState();
      store.addTab("powershell", "C:\\Users");

      const state = useSessionStore.getState();
      expect(state.tabs[0].workingDirectory).toBe("C:\\Users");
    });

    it("should mark new tab as loading", () => {
      const store = useSessionStore.getState();
      store.addTab("powershell");

      const state = useSessionStore.getState();
      expect(state.tabs[0].isLoading).toBe(true);
    });

    it("should generate unique tab IDs", () => {
      const store = useSessionStore.getState();
      const id1 = store.addTab("powershell");
      const id2 = store.addTab("cmd");
      const id3 = store.addTab("wsl");

      expect(id1).not.toBe(id2);
      expect(id2).not.toBe(id3);
      expect(id1).not.toBe(id3);
    });
  });

  describe("removeTab", () => {
    it("should remove a tab by ID", () => {
      const store = useSessionStore.getState();
      const tabId = store.addTab("powershell");

      store.removeTab(tabId);

      const state = useSessionStore.getState();
      expect(state.tabs).toHaveLength(0);
    });

    it("should select next tab when active tab is removed", () => {
      const store = useSessionStore.getState();
      const tab1 = store.addTab("powershell");
      const tab2 = store.addTab("cmd");

      // tab2 is now active
      store.setActiveTab(tab1);
      store.removeTab(tab1);

      const state = useSessionStore.getState();
      expect(state.activeTabId).toBe(tab2);
    });

    it("should set activeTabId to null when last tab is removed", () => {
      const store = useSessionStore.getState();
      const tabId = store.addTab("powershell");

      store.removeTab(tabId);

      const state = useSessionStore.getState();
      expect(state.activeTabId).toBeNull();
    });

    it("should not change activeTabId when non-active tab is removed", () => {
      const store = useSessionStore.getState();
      const tab1 = store.addTab("powershell");
      const tab2 = store.addTab("cmd");

      // tab2 is active, remove tab1
      store.removeTab(tab1);

      const state = useSessionStore.getState();
      expect(state.activeTabId).toBe(tab2);
    });
  });

  describe("setActiveTab", () => {
    it("should set the active tab", () => {
      const store = useSessionStore.getState();
      const tab1 = store.addTab("powershell");
      store.addTab("cmd"); // Creates second tab, making it active

      store.setActiveTab(tab1);

      const state = useSessionStore.getState();
      expect(state.activeTabId).toBe(tab1);
    });

    it("should not change if tab ID does not exist", () => {
      const store = useSessionStore.getState();
      store.addTab("powershell");
      const currentActive = useSessionStore.getState().activeTabId;

      store.setActiveTab("non-existent-id");

      const state = useSessionStore.getState();
      expect(state.activeTabId).toBe(currentActive);
    });
  });

  describe("updateTab", () => {
    it("should update tab properties", () => {
      const store = useSessionStore.getState();
      const tabId = store.addTab("powershell");

      store.updateTab(tabId, {
        title: "New Title",
        isLoading: false,
        ptyId: "pty-123",
      });

      const state = useSessionStore.getState();
      expect(state.tabs[0].title).toBe("New Title");
      expect(state.tabs[0].isLoading).toBe(false);
      expect(state.tabs[0].ptyId).toBe("pty-123");
    });

    it("should not affect other tabs", () => {
      const store = useSessionStore.getState();
      const tab1 = store.addTab("powershell");
      const tab2 = store.addTab("cmd");

      store.updateTab(tab1, { title: "Updated" });

      const state = useSessionStore.getState();
      const cmdTab = state.tabs.find((t) => t.id === tab2);
      expect(cmdTab?.title).toBe("Command Prompt");
    });
  });

  describe("navigation", () => {
    it("should navigate to next tab", () => {
      const store = useSessionStore.getState();
      const tab1 = store.addTab("powershell");
      const tab2 = store.addTab("cmd");
      store.addTab("wsl"); // tab3, not used in assertion

      store.setActiveTab(tab1);
      store.nextTab();

      expect(useSessionStore.getState().activeTabId).toBe(tab2);
    });

    it("should wrap around when navigating past last tab", () => {
      const store = useSessionStore.getState();
      const tab1 = store.addTab("powershell");
      store.addTab("cmd"); // tab2, not used in assertion
      const tab3 = store.addTab("wsl");

      store.setActiveTab(tab3);
      store.nextTab();

      expect(useSessionStore.getState().activeTabId).toBe(tab1);
    });

    it("should navigate to previous tab", () => {
      const store = useSessionStore.getState();
      const tab1 = store.addTab("powershell");
      const tab2 = store.addTab("cmd");

      store.setActiveTab(tab2);
      store.prevTab();

      expect(useSessionStore.getState().activeTabId).toBe(tab1);
    });

    it("should go to tab by 1-based index", () => {
      const store = useSessionStore.getState();
      store.addTab("powershell"); // tab1, creates tab at index 0
      const tab2 = store.addTab("cmd");
      store.addTab("wsl"); // tab3, creates tab at index 2

      store.goToTab(2);

      expect(useSessionStore.getState().activeTabId).toBe(tab2);
    });
  });

  describe("closeTabsToRight", () => {
    it("should close all tabs to the right", () => {
      const store = useSessionStore.getState();
      const tab1 = store.addTab("powershell");
      store.addTab("cmd");
      store.addTab("wsl");

      store.closeTabsToRight(tab1);

      const state = useSessionStore.getState();
      expect(state.tabs).toHaveLength(1);
      expect(state.tabs[0].id).toBe(tab1);
    });
  });

  describe("closeOtherTabs", () => {
    it("should close all tabs except the specified one", () => {
      const store = useSessionStore.getState();
      store.addTab("powershell");
      const tab2 = store.addTab("cmd");
      store.addTab("wsl");

      store.closeOtherTabs(tab2);

      const state = useSessionStore.getState();
      expect(state.tabs).toHaveLength(1);
      expect(state.tabs[0].id).toBe(tab2);
    });
  });

  describe("duplicateTab", () => {
    it("should duplicate a tab with same shell type", () => {
      const store = useSessionStore.getState();
      const tabId = store.addTab("wsl", "C:\\Projects");

      const newTabId = store.duplicateTab(tabId);

      const state = useSessionStore.getState();
      expect(state.tabs).toHaveLength(2);

      const newTab = state.tabs.find((t) => t.id === newTabId);
      expect(newTab?.shellType).toBe("wsl");
      expect(newTab?.workingDirectory).toBe("C:\\Projects");
    });

    it("should return null for non-existent tab", () => {
      const store = useSessionStore.getState();
      const result = store.duplicateTab("non-existent");
      expect(result).toBeNull();
    });
  });
});
