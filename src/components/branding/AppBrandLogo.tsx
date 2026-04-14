import { Image, View, type StyleProp, type ViewStyle } from 'react-native';

const LOGO = require('../../../assets/images/logo.png');

type Props = {
  /** Taille du conteneur carré (px). */
  size?: number;
  /**
   * Facteur > 1 agrandit le rendu du PNG (marges transparentes du fichier).
   * Le débordement est rogné pour remplir visuellement la boîte.
   */
  overscan?: number;
  style?: StyleProp<ViewStyle>;
};

/** Logo Opti Power (même ressource que le bureau `renderer/assets/logo.png`). */
export function AppBrandLogo({ size = 40, overscan = 1.12, style }: Props) {
  const img = Math.round(size * overscan);
  return (
    <View
      style={[
        {
          width: size,
          height: size,
          overflow: 'hidden',
          alignItems: 'center',
          justifyContent: 'center',
        },
        style,
      ]}
    >
      <Image
        source={LOGO}
        accessibilityLabel="Opti Power"
        style={{ width: img, height: img, resizeMode: 'contain' }}
      />
    </View>
  );
}
