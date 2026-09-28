import AsyncStorage from '@react-native-async-storage/async-storage';
import { logError } from './logger';

const WHEEL_CONFIG_STORAGE_KEY = '@church_scoring_wheel_config_v2';

export interface WheelConfig {
  name: string;
  items: string[];
  initialItems: string[];
}

export const DEFAULT_WHEEL_ITEMS: string[] = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];

export const DEFAULT_WHEEL_NAME = 'Random Wheel';

export const WheelStorage = {
  async getConfig(): Promise<WheelConfig> {
    try {
      const raw = await AsyncStorage.getItem(WHEEL_CONFIG_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.items) && parsed.items.length > 0) {
          return {
            name: typeof parsed.name === 'string' && parsed.name.trim() ? parsed.name.trim() : DEFAULT_WHEEL_NAME,
            items: parsed.items,
            initialItems: Array.isArray(parsed.initialItems) && parsed.initialItems.length > 0 ? parsed.initialItems : parsed.items,
          };
        }
      }
    } catch (err) {
      logError('Failed to load wheel config:', err);
    }

    return {
      name: DEFAULT_WHEEL_NAME,
      items: [...DEFAULT_WHEEL_ITEMS],
      initialItems: [...DEFAULT_WHEEL_ITEMS],
    };
  },

  async saveConfig(config: WheelConfig): Promise<void> {
    try {
      await AsyncStorage.setItem(WHEEL_CONFIG_STORAGE_KEY, JSON.stringify(config));
    } catch (err) {
      logError('Failed to save wheel config:', err);
    }
  },

  async resetConfig(): Promise<WheelConfig> {
    const defaultConfig: WheelConfig = {
      name: DEFAULT_WHEEL_NAME,
      items: [...DEFAULT_WHEEL_ITEMS],
      initialItems: [...DEFAULT_WHEEL_ITEMS],
    };
    try {
      await AsyncStorage.setItem(WHEEL_CONFIG_STORAGE_KEY, JSON.stringify(defaultConfig));
    } catch (err) {
      logError('Failed to reset wheel config:', err);
    }
    return defaultConfig;
  },
};
