import { requireOptionalNativeModule } from "expo";
import { PermissionsAndroid, Platform } from "react-native";
import { UserFacingError } from "./user-error";
export type NativeStatus = {
  policyAccess: boolean;
  exactAlarms: boolean;
  notifications: boolean;
  active: boolean;
  until: number;
  owner: string;
};
type Events = {
  onBleDevice: (v: { id: string; name: string }) => void;
  onHeartRate: (v: { bpm: number; second: number }) => void;
  onBleState: (v: { state: string }) => void;
};
type Bridge = {
  addListener<K extends keyof Events>(
    event: K,
    callback: Events[K],
  ): { remove(): void };
  configure(userId: string, json: string): Promise<void>;
  clearAccount(): Promise<void>;
  status(): Promise<NativeStatus>;
  startFocus(owner: string, minutes: number): Promise<NativeStatus>;
  stopFocus(owner: string): Promise<void>;
  openPolicySettings(): Promise<void>;
  openExactSettings(): Promise<void>;
  scan(): Promise<void>;
  connect(id: string): Promise<void>;
  disconnect(): Promise<void>;
};
export const wellbeingNative =
  Platform.OS === "android"
    ? requireOptionalNativeModule<Bridge>("VitalisWellbeing")
    : null;
export const requireWellbeingNative = () => {
  if (!wellbeingNative)
    throw new UserFacingError("Este recurso requer o APK Android atualizado.");
  return wellbeingNative;
};
export async function requestReminderPermission() {
  if (Platform.OS === "android" && Number(Platform.Version) >= 33) {
    const result = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
    );
    if (result !== PermissionsAndroid.RESULTS.GRANTED)
      throw new UserFacingError(
        "Permita as notificações nas configurações para receber lembretes.",
      );
  }
}
export async function requestBlePermission() {
  if (Platform.OS !== "android")
    throw new UserFacingError("Conexão BLE disponível no Android.");
  const permissions =
    Number(Platform.Version) >= 31
      ? [
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
        ]
      : [PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION];
  const result = await PermissionsAndroid.requestMultiple(permissions);
  if (permissions.some((p) => result[p] !== PermissionsAndroid.RESULTS.GRANTED))
    throw new UserFacingError(
      "Permita o acesso ao Bluetooth para conectar o sensor.",
    );
}
