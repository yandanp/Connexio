/**
 * Workspace Utilities
 *
 * Shared utility functions for workspace management.
 * Extracted from WorkspaceSidebar and WorkspaceManagerDialog to avoid duplication.
 */

import { WORKSPACE_COLORS, type WorkspaceColorId } from "@/stores";

// =============================================================================
// CONSTANTS
// =============================================================================

/** Maximum allowed length for workspace names */
export const MAX_WORKSPACE_NAME_LENGTH = 50;

/** Maximum number of workspaces allowed */
export const MAX_WORKSPACES = 20;

/** Maximum tabs per workspace */
export const MAX_TABS_PER_WORKSPACE = 15;

/** Drag activation distance in pixels */
export const DRAG_ACTIVATION_DISTANCE = 8;

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Get initials from workspace name (max 2 chars)
 *
 * Examples:
 * - "Project Alpha" → "PA"
 * - "connexio" → "CO"
 * - "My Dev Environment" → "MD"
 */
export function getWorkspaceInitials(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "??";

  const words = trimmed.split(/\s+/);
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  return trimmed.slice(0, 2).toUpperCase();
}

/**
 * Generate a consistent color based on workspace name (fallback)
 * Uses simple hash function for deterministic color assignment.
 */
export function getWorkspaceColorFallback(name: string): (typeof WORKSPACE_COLORS)[number] {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return WORKSPACE_COLORS[Math.abs(hash) % WORKSPACE_COLORS.length];
}

/**
 * Get workspace color by ID or generate from name as fallback
 *
 * @param colorId - Optional color ID from workspace settings
 * @param name - Workspace name (used for fallback color generation)
 * @returns Color object with id, bg class, and hex value
 */
export function getWorkspaceColor(
  colorId: WorkspaceColorId | undefined,
  name: string
): (typeof WORKSPACE_COLORS)[number] {
  if (colorId) {
    const found = WORKSPACE_COLORS.find((c) => c.id === colorId);
    if (found) return found;
  }
  return getWorkspaceColorFallback(name);
}

/**
 * Validate workspace name
 *
 * @param name - Name to validate
 * @returns Object with isValid boolean and optional error message
 */
export function validateWorkspaceName(name: string): { isValid: boolean; error?: string } {
  const trimmed = name.trim();

  if (!trimmed) {
    return { isValid: false, error: "Workspace name cannot be empty" };
  }

  if (trimmed.length > MAX_WORKSPACE_NAME_LENGTH) {
    return {
      isValid: false,
      error: `Workspace name cannot exceed ${MAX_WORKSPACE_NAME_LENGTH} characters`,
    };
  }

  return { isValid: true };
}

/**
 * Truncate workspace name if too long (for display)
 */
export function truncateWorkspaceName(name: string, maxLength: number = 30): string {
  if (name.length <= maxLength) return name;
  return name.slice(0, maxLength - 3) + "...";
}

/**
 * Format timestamp for display
 */
export function formatWorkspaceDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
