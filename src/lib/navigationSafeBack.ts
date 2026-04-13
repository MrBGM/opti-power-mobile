import type { NavigationProp, ParamListBase } from '@react-navigation/native';

/**
 * Évite l’erreur GO_BACK quand l’écran d’appairage est ouvert depuis le drawer (sans historique pile).
 */
export function goBackFromPairing(navigation: NavigationProp<ParamListBase>): void {
  if (navigation.canGoBack()) {
    navigation.goBack();
    return;
  }
  const names = navigation.getState()?.routeNames ?? [];
  if (names.includes('Settings')) {
    navigation.navigate('Settings' as never);
    return;
  }
  if (names.includes('Login')) {
    navigation.navigate('Login' as never);
    return;
  }
  const parent = navigation.getParent();
  if (parent?.canGoBack()) {
    parent.goBack();
  }
}
