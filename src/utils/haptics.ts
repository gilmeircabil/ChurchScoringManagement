/**
 * Haptic feedback utility.
 * Vibration is completely disabled per user preference to ensure a quiet, vibration-free experience.
 */

export enum ImpactFeedbackStyle {
  Light = 'light',
  Medium = 'medium',
  Heavy = 'heavy',
}

export enum NotificationFeedbackType {
  Success = 'success',
  Warning = 'warning',
  Error = 'error',
}

export const impactAsync = async (_style?: ImpactFeedbackStyle): Promise<void> => {
  // Vibration disabled
};

export const notificationAsync = async (_type?: NotificationFeedbackType): Promise<void> => {
  // Vibration disabled
};

export const selectionAsync = async (): Promise<void> => {
  // Vibration disabled
};
