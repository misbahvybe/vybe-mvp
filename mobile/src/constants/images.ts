import type { ImageSourcePropType } from 'react-native';

/** Bundled copies of frontend/public PNGs for UI parity */
export const WebPublicImages: Record<string, ImageSourcePropType> = {
  foodPlate: require('../../assets/web-public/food-plate.png'),
  groceryBasket: require('../../assets/web-public/grocery-shopping-basket.png'),
  medicineBox: require('../../assets/web-public/medicine-box.png'),
  wallet: require('../../assets/web-public/wallet.png'),
  userAvatar: require('../../assets/web-public/user-avatar.png'),
  mapLocation: require('../../assets/web-public/map-location.png'),
  creditCards: require('../../assets/web-public/credit-cards.png'),
  securePadlock: require('../../assets/web-public/secure-padlock.png'),
  users: require('../../assets/web-public/users.png')
};
