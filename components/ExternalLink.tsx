import type { ComponentProps } from 'react';
import { Link } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

type ExternalLinkProps = Omit<ComponentProps<typeof Link>, 'href'> & {
  href: string;
};

export function ExternalLink({ href, ...props }: ExternalLinkProps) {
  const openNativeBrowser = async () => {
    if (Platform.OS !== 'web') {
      await WebBrowser.openBrowserAsync(href);
    }
  };

  return (
    <Link
      {...props}
      href={href as ComponentProps<typeof Link>['href']}
      target={Platform.OS === 'web' ? '_blank' : undefined}
      onPress={openNativeBrowser}
    />
  );
}
