import React from 'react';
import {
  Modal, Text, TouchableOpacity, View, FlatList, StyleSheet,
} from 'react-native';
import { theme } from '@theme/index';

export interface PickerOption {
  key: string;
  title: string;
  subtitle?: string;
  tag?: string;
}

interface Props {
  visible: boolean;
  title: string;
  subtitle?: string;
  tab?: 'brands' | 'outlets';
  onTabChange?: (val: 'brands' | 'outlets') => void;
  options: PickerOption[];
  selectedKey: string;
  onSelect: (key: string) => void;
  onClose: () => void;
}

/**
 * Bottom-sheet modal for filter pickers (pharmacy, F&B brand/outlet).
 */
export function PickerModal({
  visible,
  title,
  subtitle,
  tab = 'brands',
  onTabChange,
  options,
  selectedKey,
  onSelect,
  onClose,
}: Props): React.JSX.Element {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.bg}>
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={onClose}
        />

        <View style={styles.sheet}>
          <View style={styles.handle} />

          <Text style={styles.title}>{title}</Text>

          {subtitle && (
            <Text style={styles.subtitle}>{subtitle}</Text>
          )}

          {onTabChange && (
            <View style={styles.tabContainer}>
              <TouchableOpacity
                style={[styles.tab, tab === 'brands' && styles.tabActive]}
                onPress={() => onTabChange('brands')}
              >
                <Text
                  style={[
                    styles.tabText,
                    tab === 'brands' && styles.tabTextActive,
                  ]}
                >
                  Brands
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.tab, tab === 'outlets' && styles.tabActive]}
                onPress={() => onTabChange('outlets')}
              >
                <Text
                  style={[
                    styles.tabText,
                    tab === 'outlets' && styles.tabTextActive,
                  ]}
                >
                  Outlets
                </Text>
              </TouchableOpacity>
            </View>
          )}

          <FlatList
            data={options}
            keyExtractor={(item) => item.key}
            renderItem={({ item }) => {
              const active = item.key === selectedKey;

              return (
                <TouchableOpacity
                  style={[styles.option, active && styles.optionActive]}
                  onPress={() => onSelect(item.key)}
                >
                  <View
                    style={[styles.radio, active && styles.radioActive]}
                  >
                    {active && <View style={styles.radioDot} />}
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={styles.optTitle}>
                      {item.title}
                    </Text>

                    {item.subtitle && (
                      <Text style={styles.optSub}>
                        {item.subtitle}
                      </Text>
                    )}
                  </View>

                  {item.tag && (
                    <Text style={styles.optTag}>
                      {item.tag}
                    </Text>
                  )}
                </TouchableOpacity>
              );
            }}
          />
        </View>
      </View>
    </Modal>
  );
}
const styles = StyleSheet.create({
  bg:        { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.55)' },
  backdrop:  { flex: 1 },
  sheet:     {
    backgroundColor: theme.colors.bg1,
    borderTopLeftRadius: 22, borderTopRightRadius: 22,
    padding: theme.spacing.huge, maxHeight: '85%',
  },
  handle:    {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: theme.colors.borderHi,
    alignSelf: 'center', marginBottom: theme.spacing.md,
  },
  title:     { fontSize: 16, fontWeight: '700', color: theme.colors.text0, textAlign: 'center' },
  subtitle:  { fontSize: 12, color: theme.colors.text2, textAlign: 'center', marginTop: 4, marginBottom: 14 },
  option:    {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: theme.spacing.md, paddingHorizontal: theme.spacing.xl,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surface,
    borderWidth: 1, borderColor: theme.colors.border,
    marginBottom: 6,
  },
  optionActive: {
    backgroundColor: 'rgba(48,224,196,0.10)',
    borderColor: 'rgba(48,224,196,0.38)',
  },
  radio:     {
    width: 18, height: 18, borderRadius: 9,
    borderWidth: 2, borderColor: theme.colors.borderHi,
    alignItems: 'center', justifyContent: 'center',
    marginRight: theme.spacing.lg,
  },
  radioActive: { borderColor: theme.colors.teal },
  radioDot:    { width: 8, height: 8, borderRadius: 4, backgroundColor: theme.colors.teal },
  optTitle:    { fontSize: 13, fontWeight: '600', color: theme.colors.text0 },
  optSub:      { fontSize: 11, color: theme.colors.text2, marginTop: 2 },
  optTag:      {
    fontSize: 10, fontWeight: '700',
    color: theme.colors.gold, backgroundColor: 'rgba(212,175,106,0.14)',
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    padding: 4,
    marginBottom: 12,
  },

  tab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 10,
  },

  tabActive: {
    backgroundColor: 'rgba(212,175,106,0.15)',
  },

  tabText: {
    fontSize: 12,
    color: theme.colors.text2,
    fontWeight: '600',
  },

  tabTextActive: {
    color: theme.colors.gold,
    fontWeight: '700',
  },
code: {
  fontSize: 10,
  fontWeight: '700',
  color: theme.colors.gold,
  backgroundColor: 'rgba(212,175,106,0.14)',
  paddingHorizontal: 6,
  paddingVertical: 2,
  borderRadius: 6,
  overflow: 'hidden',
},

});
