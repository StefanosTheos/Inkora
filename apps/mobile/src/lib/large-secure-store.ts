import AsyncStorage from "@react-native-async-storage/async-storage";
import aes from "aes-js";
import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";

/**
 * Encrypted Supabase session storage for Expo.
 * SecureStore has a ~2KB per-value limit and Supabase sessions exceed it, so we:
 *   - store the (large) ciphertext in AsyncStorage
 *   - store the per-key AES encryption key in SecureStore (hardware-backed keychain)
 * This is the production pattern recommended by Supabase for React Native.
 */
export class LargeSecureStore {
  private async encrypt(key: string, value: string): Promise<string> {
    const encryptionKey = Crypto.getRandomBytes(256 / 8);
    const cipher = new aes.ModeOfOperation.ctr(encryptionKey, new aes.Counter(1));
    const encryptedBytes = cipher.encrypt(aes.utils.utf8.toBytes(value));
    await SecureStore.setItemAsync(key, aes.utils.hex.fromBytes(encryptionKey));
    return aes.utils.hex.fromBytes(encryptedBytes);
  }

  private async decrypt(key: string, value: string): Promise<string | null> {
    const encryptionKeyHex = await SecureStore.getItemAsync(key);
    if (!encryptionKeyHex) return null;
    const cipher = new aes.ModeOfOperation.ctr(aes.utils.hex.toBytes(encryptionKeyHex), new aes.Counter(1));
    const decryptedBytes = cipher.decrypt(aes.utils.hex.toBytes(value));
    return aes.utils.utf8.fromBytes(decryptedBytes);
  }

  async getItem(key: string): Promise<string | null> {
    const encrypted = await AsyncStorage.getItem(key);
    if (!encrypted) return null;
    return this.decrypt(key, encrypted);
  }

  async setItem(key: string, value: string): Promise<void> {
    const encrypted = await this.encrypt(key, value);
    await AsyncStorage.setItem(key, encrypted);
  }

  async removeItem(key: string): Promise<void> {
    await AsyncStorage.removeItem(key);
    await SecureStore.deleteItemAsync(key);
  }
}
