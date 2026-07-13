

import React from 'react';
import { Text } from 'react-native';
import { Card } from './Card';
import { theme } from '@theme/index';

export function NoDataCard() {
  return (
    <Card>
      <Text
        style={{
          color: theme.colors.text2,
          textAlign: 'center',
          paddingVertical: 24,
        }}
      >
        No data available for the selected filters and period.
      </Text>
    </Card>
  );
}