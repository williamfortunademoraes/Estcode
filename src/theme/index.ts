import { MD3LightTheme, type MD3Theme } from 'react-native-paper';

export const appTheme: MD3Theme = {
  ...MD3LightTheme,
  roundness: 14,
  colors: {
    ...MD3LightTheme.colors,
    primary: '#155EEF',
    onPrimary: '#FFFFFF',
    primaryContainer: '#DCE8FF',
    onPrimaryContainer: '#001A41',
    secondary: '#475467',
    secondaryContainer: '#E7EAF0',
    onSecondaryContainer: '#151B26',
    background: '#F8FAFC',
    surface: '#FFFFFF',
    surfaceVariant: '#EEF2F6',
    onSurface: '#172033',
    onSurfaceVariant: '#667085',
    outline: '#D0D5DD',
    error: '#D92D20',
    errorContainer: '#FEE4E2',
    onErrorContainer: '#7A271A',
  },
};
