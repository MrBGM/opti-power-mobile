/** Shim minimal si les types natifs ne sont pas encore liés (Windows / pnpm). */
declare module 'expo-camera' {
  import type { ComponentType } from 'react';
  import type { StyleProp, ViewStyle } from 'react-native';

  export type CameraPermissionResponse = { granted: boolean; status: string };

  export function useCameraPermissions(): [
    CameraPermissionResponse | null,
    () => Promise<CameraPermissionResponse>,
  ];

  export type CameraViewProps = {
    style?: StyleProp<ViewStyle>;
    facing?: 'back' | 'front';
    barcodeScannerSettings?: { barcodeTypes?: string[] };
    onBarcodeScanned?: (e: { data: string }) => void;
  };

  export const CameraView: ComponentType<CameraViewProps>;
}
