import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ColorValue } from 'react-native';

const iconMap: Record<string, string> = {
  house: 'home-variant-outline',
  'books.vertical': 'book-open-page-variant-outline',
  calendar: 'calendar-month-outline',
  'textformat.size': 'format-size',
  bell: 'bell-outline',
  'bell.fill': 'bell',
  gearshape: 'cog-outline',
  heart: 'heart-outline',
  'heart.fill': 'heart',
  'person.crop.circle': 'account-outline',
  'rectangle.portrait.and.arrow.right': 'logout',
  'book.closed': 'book-open-page-variant-outline',
  'book.closed.fill': 'book-open-page-variant',
  'books.vertical.fill': 'bookshelf',
  'chart.bar.fill': 'chart-bar',
  'chevron.left': 'chevron-left',
  'chevron.right': 'chevron-right',
  'arrow.right': 'arrow-right',
  'arrow.down': 'arrow-down',
  'arrow.clockwise': 'reload',
  'clock.fill': 'clock-time-four',
  'checkmark.circle.fill': 'check-circle',
  creditcard: 'credit-card-outline',
  'creditcard.fill': 'credit-card',
  'square.and.arrow.down': 'file-download-outline',
  'play.circle.fill': 'play-circle',
  'wifi.slash': 'wifi-off',
  bookmark: 'bookmark-outline',
  'bookmark.fill': 'bookmark',
  'pause.fill': 'pause',
  'play.fill': 'play',
  waveform: 'waveform',
  'square.and.arrow.up': 'share-variant-outline',
  checkmark: 'check',
  'checkmark.circle': 'check-circle-outline',
  magnifyingglass: 'magnify',
  'xmark.circle.fill': 'close-circle',
  flame: 'fire',
  'flame.fill': 'fire',
  'pencil.line': 'pencil-outline',
  'hands.sparkles.fill': 'hand-heart-outline',
  tray: 'tray',
  globe: 'web',
  'list.bullet': 'format-list-bulleted',
  pencil: 'pencil-outline',
  trash: 'trash-can-outline',
  'info.circle': 'information-outline',
  'rectangle.3.group': 'view-grid-outline',
  lock: 'lock-outline',
  envelope: 'email-outline',
  sparkles: 'creation-outline',
  photo: 'image-outline',
  plus: 'plus',
  xmark: 'close',
  'paperplane.fill': 'send',
  'gearshape.fill': 'cog',
  'cloud.offline': 'cloud-off-outline',
  refresh: 'refresh',
  clock: 'clock-outline',
  'arrow.up.doc': 'file-upload-outline',
  'doc.on.doc': 'content-copy',
  eye: 'eye-outline',
  'arrow.down.doc': 'file-download-outline',
  moon: 'moon-waning-crescent',
  'eye.slash': 'eye-off-outline',
  'checkmark.seal.fill': 'check-decagram',
};

type AppIconProps = {
  name: string;
  size?: number;
  tintColor?: ColorValue;
};

export default function AppIcon({ name, size = 20, tintColor = '#1E2A24' }: AppIconProps) {
  if (__DEV__ && !iconMap[name]) {
    console.warn(`[AppIcon] Missing icon mapping for name: "${name}"`);
  }
  return <MaterialCommunityIcons name={(iconMap[name] ?? 'help-circle-outline') as any} size={size} color={tintColor} />;
}
