import { render, screen } from '@testing-library/react-native';
import { PaperProvider } from 'react-native-paper';

import { MetricCard } from '@/src/components/MetricCard';
import { appTheme } from '@/src/theme';

describe('MetricCard', () => {
  it('renders the label, value and helper text without inventing data', async () => {
    await render(
      <PaperProvider theme={appTheme}>
        <MetricCard label="Produtos" value="—" helper="Aguardando dados" />
      </PaperProvider>,
    );

    expect(screen.getByText('Produtos')).toBeTruthy();
    expect(screen.getByText('—')).toBeTruthy();
    expect(screen.getByText('Aguardando dados')).toBeTruthy();
  });
});
