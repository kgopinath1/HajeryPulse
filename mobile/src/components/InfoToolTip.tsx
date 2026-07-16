// components/InfoTooltip.tsx
import React, { useState } from 'react';
import { View, Text, Pressable, Modal, StyleSheet } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { theme } from '@theme/index';

interface InfoToolTipProps {
  text: string;
  style?: any;
}

export function InfoToolTip({ text, style }: InfoToolTipProps) {
  const [visible, setVisible] = useState(false);

  return (
    <>
      <Pressable
        onPress={() => setVisible(true)}
        onHoverIn={() => setVisible(true)} // works on RN Web / desktop
        hitSlop={8}
        style={style}
      >
        <Ionicons name="information-circle-outline" size={14} color={theme.colors.text2} />
      </Pressable>

      <Modal transparent visible={visible} animationType="fade" onRequestClose={() => setVisible(false)}>
        <Pressable style={styles.backdrop} onPress={() => setVisible(false)}>
          <View style={styles.bubble}>
            <Text style={styles.bubbleText}>{text}</Text>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  bubble: {
    backgroundColor: theme.colors.bg1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 16,
    maxWidth: 280,
  },
  bubbleText: {
    color: theme.colors.text0,
    fontSize: 13,
    lineHeight: 18,
  },
});