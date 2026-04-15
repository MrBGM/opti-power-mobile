/**
 * Shim expo-camera pour TypeScript (Windows / pnpm — les types natifs ne se lient pas toujours).
 * Aligné sur expo-camera v17 (Expo SDK 54).
 */
declare module 'expo-camera' {
  import type { ComponentType } from 'react';
  import type { StyleProp, ViewStyle } from 'react-native';

  export type FocusMode = 'on' | 'off';
  export type CameraType = 'back' | 'front';
  export type FlashMode = 'on' | 'off' | 'auto' | 'torch';
  export type BarcodeType =
    | 'aztec' | 'ean13' | 'ean8' | 'qr' | 'pdf417' | 'upc_e'
    | 'datamatrix' | 'code39' | 'code93' | 'itf14' | 'codabar' | 'code128' | 'upc_a';

  export type BarcodeSettings = {
    barcodeTypes: BarcodeType[];
  };

  /** Résultat d'un scan barcode — passé directement au callback onBarcodeScanned. */
  export type BarcodeScanningResult = {
    type: string;
    /** Contenu décodé (JSON string dans le cas du QR d'appairage). */
    data: string;
    /** Octets bruts (Android uniquement). */
    raw?: string;
    cornerPoints: { x: number; y: number }[];
    bounds: {
      origin: { x: number; y: number };
      size:   { width: number; height: number };
    };
  };

  export type CameraPermissionResponse = {
    granted:      boolean;
    status:       'granted' | 'denied' | 'undetermined';
    canAskAgain:  boolean;
    expires:      'never' | number;
  };

  export type CameraViewProps = {
    style?:                   StyleProp<ViewStyle>;
    facing?:                  CameraType;
    flash?:                   FlashMode;
    /**
     * Режим автофокуса.
     * - `'on'`  → autofocus une fois puis verrouille.
     * - `'off'` → autofocus continu (recommandé pour le scan QR).
     * @default 'off'
     */
    autofocus?:               FocusMode;
    zoom?:                    number;
    barcodeScannerSettings?:  BarcodeSettings;
    /**
     * Appelé quand un code-barres est détecté.
     * Le callback reçoit directement un BarcodeScanningResult (pas de nativeEvent wrapper).
     */
    onBarcodeScanned?:        (result: BarcodeScanningResult) => void;
    active?:                  boolean;
    [key: string]:            unknown;
  };

  export const CameraView: ComponentType<CameraViewProps>;

  export function useCameraPermissions(): [
    CameraPermissionResponse | null,
    () => Promise<CameraPermissionResponse>,
    () => Promise<CameraPermissionResponse>,
  ];
}
