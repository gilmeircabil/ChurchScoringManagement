import AsyncStorage from '@react-native-async-storage/async-storage';
import { ItemPointsConfig, ItemRuleConfig } from '../types';
import { APP_CONFIG } from '../constants/config';
import { logWarn } from './logger';

const ITEM_RULES_STORAGE_KEY = 'quiz_item_rules_config';

export async function getDefaultItemRules(): Promise<ItemRuleConfig> {
  try {
    const raw = await AsyncStorage.getItem(ITEM_RULES_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        book_name: typeof parsed.book_name === 'string' && parsed.book_name.trim() ? parsed.book_name.trim() : APP_CONFIG.defaultItemNames.book,
        book_points: typeof parsed.book_points === 'number' ? parsed.book_points : (typeof parsed.book === 'number' ? parsed.book : APP_CONFIG.defaultItemPoints.book),
        pen_name: typeof parsed.pen_name === 'string' && parsed.pen_name.trim() ? parsed.pen_name.trim() : APP_CONFIG.defaultItemNames.pen,
        pen_points: typeof parsed.pen_points === 'number' ? parsed.pen_points : (typeof parsed.pen === 'number' ? parsed.pen : APP_CONFIG.defaultItemPoints.pen),
        paper_name: typeof parsed.paper_name === 'string' && parsed.paper_name.trim() ? parsed.paper_name.trim() : APP_CONFIG.defaultItemNames.paper,
        paper_points: typeof parsed.paper_points === 'number' ? parsed.paper_points : (typeof parsed.paper === 'number' ? parsed.paper : APP_CONFIG.defaultItemPoints.paper),
        bible_name: typeof parsed.bible_name === 'string' && parsed.bible_name.trim() ? parsed.bible_name.trim() : APP_CONFIG.defaultItemNames.bible,
        bible_points: typeof parsed.bible_points === 'number' ? parsed.bible_points : (typeof parsed.bible === 'number' ? parsed.bible : APP_CONFIG.defaultItemPoints.bible),
      };
    }
  } catch (err) {
    logWarn('Failed to load item rules from storage:', err);
  }
  return {
    book_name: APP_CONFIG.defaultItemNames.book,
    book_points: APP_CONFIG.defaultItemPoints.book,
    pen_name: APP_CONFIG.defaultItemNames.pen,
    pen_points: APP_CONFIG.defaultItemPoints.pen,
    paper_name: APP_CONFIG.defaultItemNames.paper,
    paper_points: APP_CONFIG.defaultItemPoints.paper,
    bible_name: APP_CONFIG.defaultItemNames.bible,
    bible_points: APP_CONFIG.defaultItemPoints.bible,
  };
}

export async function saveDefaultItemRules(rules: ItemRuleConfig): Promise<void> {
  try {
    await AsyncStorage.setItem(ITEM_RULES_STORAGE_KEY, JSON.stringify(rules));
  } catch (err) {
    logWarn('Failed to save item rules to storage:', err);
  }
}

// Backward compatible helper
export async function getDefaultItemPoints(): Promise<ItemPointsConfig> {
  const rules = await getDefaultItemRules();
  return {
    book: rules.book_points,
    pen: rules.pen_points,
    paper: rules.paper_points,
    bible: rules.bible_points,
  };
}

export async function saveDefaultItemPoints(points: ItemPointsConfig): Promise<void> {
  const current = await getDefaultItemRules();
  await saveDefaultItemRules({
    ...current,
    book_points: points.book,
    pen_points: points.pen,
    paper_points: points.paper,
    bible_points: points.bible,
  });
}
