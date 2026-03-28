import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  type ImageSourcePropType
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Search } from 'lucide-react-native';
import { useAuthStore } from '@store/auth';
import { CustomerScreenShell } from '@components/customer/CustomerScreenShell';
import { WebPublicImages } from '@constants/images';
import { tokens } from '@theme/tokens';

type CategoryId = 'food' | 'grocery' | 'medicine' | 'ride' | 'courier' | 'wallet';

const CATEGORY_CARDS: {
  id: CategoryId;
  label: string;
  image: ImageSourcePropType;
  comingSoon?: boolean;
}[] = [
  { id: 'food', label: 'Food', image: WebPublicImages.foodPlate },
  { id: 'grocery', label: 'Grocery', image: WebPublicImages.groceryBasket },
  { id: 'medicine', label: 'Medicine', image: WebPublicImages.medicineBox },
  { id: 'ride', label: 'Ride', image: WebPublicImages.deliveryScooter, comingSoon: true },
  { id: 'courier', label: 'Courier', image: WebPublicImages.deliveryPackage, comingSoon: true },
  { id: 'wallet', label: 'Crypto Wallet', image: WebPublicImages.wallet }
];

export function CustomerHomeScreen() {
  const user = useAuthStore((s) => s.user);
  const navigation = useNavigation<any>();
  const firstName = user?.name?.split(' ')[0] ?? user?.name ?? 'Customer';

  const openProfile = () =>
    navigation.getParent()?.navigate('MoreTab', { screen: 'CustomerProfile' });

  return (
    <CustomerScreenShell
      title="VYBE"
      rightAction={
        <View style={styles.headerActions}>
          <TouchableOpacity
            onPress={() => navigation.navigate('CustomerSearch')}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel="Search stores"
          >
            <Search color={tokens.white} size={22} strokeWidth={2} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={openProfile}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel="Account"
          >
            <Image source={WebPublicImages.userAvatar} style={styles.avatarSm} />
          </TouchableOpacity>
        </View>
      }
    >
      <View style={styles.pad}>
        <Text style={styles.title}>Hi, {firstName}</Text>
        <Text style={styles.subtitle}>What would you like to order today?</Text>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Categories</Text>
          <TouchableOpacity onPress={() => navigation.navigate('CustomerStores')}>
            <Text style={styles.link}>All stores</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.grid}>
          {CATEGORY_CARDS.map((cat) => {
            const comingSoon = !!cat.comingSoon;
            const onPress = () => {
              if (comingSoon) return;
              if (cat.id === 'wallet') {
                navigation.getParent()?.navigate('WalletTab', { screen: 'CustomerWallet' });
                return;
              }
              navigation.navigate('CustomerCategory', {
                type: cat.id,
                title: cat.label
              });
            };
            return (
              <TouchableOpacity
                key={cat.id}
                style={[styles.card, comingSoon && styles.cardDisabled]}
                disabled={comingSoon}
                onPress={onPress}
                activeOpacity={0.85}
              >
                <Image source={cat.image} style={styles.cardImage} resizeMode="contain" />
                <Text style={styles.cardLabel}>{cat.label}</Text>
                {comingSoon && <Text style={styles.badge}>Coming soon</Text>}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </CustomerScreenShell>
  );
}

const styles = StyleSheet.create({
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12
  },
  avatarSm: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)'
  },
  pad: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: tokens.slate800
  },
  subtitle: {
    fontSize: 14,
    color: tokens.slate500,
    marginTop: 4,
    marginBottom: 20
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: tokens.slate500
  },
  link: {
    fontSize: 13,
    color: tokens.accent,
    fontWeight: '600'
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12
  },
  card: {
    width: '48%',
    borderRadius: tokens.radiusCard,
    backgroundColor: tokens.surface,
    paddingVertical: 16,
    paddingHorizontal: 12,
    alignItems: 'center',
    ...tokens.shadowSoft
  },
  cardDisabled: {
    opacity: 0.5
  },
  cardImage: {
    width: 64,
    height: 64,
    marginBottom: 8
  },
  cardLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: tokens.slate800,
    textAlign: 'center'
  },
  badge: {
    marginTop: 8,
    alignSelf: 'center',
    fontSize: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: tokens.slate200,
    color: tokens.slate600,
    fontWeight: '500'
  }
});
