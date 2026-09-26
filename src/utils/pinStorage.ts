import AsyncStorage from '@react-native-async-storage/async-storage';

const PIN_KEY = 'app_pin';

export const getPIN = async (): Promise<string | null> => {
  try {
    return await AsyncStorage.getItem(PIN_KEY);
  } catch (error) {
    console.error('Error getting PIN:', error);
    return null;
  }
};

export const setPIN = async (pin: string): Promise<void> => {
  try {
    await AsyncStorage.setItem(PIN_KEY, pin);
  } catch (error) {
    console.error('Error setting PIN:', error);
  }
};

export const hasPIN = async (): Promise<boolean> => {
  try {
    const pin = await AsyncStorage.getItem(PIN_KEY);
    return pin !== null;
  } catch (error) {
    console.error('Error checking PIN:', error);
    return false;
  }
};
