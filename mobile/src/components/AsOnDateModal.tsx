import React, { useState } from 'react';
import {
  Modal, View, Text, TouchableOpacity, StyleSheet,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { theme } from '@theme/index';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSelect: (date: string) => void;
  currentDate: string;
}

export function AsOnDateModal({ visible, onClose, onSelect, currentDate }: Props) {
  // ✅ Parses "YYYY-MM-DD" as LOCAL midnight (avoids UTC off-by-one on parse)
  const parseLocalDate = (s: string) => {
    const [y, m, d] = s.split('-').map(Number);
    return new Date(y, m - 1, d);
  };

  const [selectedDate, setSelectedDate] = useState(parseLocalDate(currentDate));
  const [showPicker, setShowPicker] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);

  // ✅ Formats a Date back to "YYYY-MM-DD" using LOCAL components (no UTC conversion)
  const toISO = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const today = new Date();

  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  const day2 = new Date();
  day2.setDate(today.getDate() - 2);


// ✅ Last Sunday
const getLastSunday = () => {
  const d = new Date();
  const day = d.getDay(); // 0 = Sunday
  const diff = day === 0 ? 7 : day; // go back to last Sunday
  d.setDate(d.getDate() - diff);
  return d;
};

// ✅ Previous month end
const getPrevMonthEnd = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 0); // last day of prev month
};
const getMonthTag = (date: Date) => {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[date.getMonth()]}-end`;
};

const toPretty = (d: Date) =>
  d.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

// Presets
  const presets = [
    {
      id: 'yesterday',
      title: 'Yesterday (end-of-day)',
      subtitle: toPretty(yesterday) + ' · default base',
      date: yesterday,
      tag: 'Day -1',
    },
    {
      id: 'day2',
      title: 'Day before yesterday',
      subtitle: toPretty(day2),
      date: day2,
      tag: 'Day -2',
    },
    {
      id: 'sunday',
      title: 'Last Sunday (week close)',
      subtitle: toPretty(getLastSunday()),
      date: getLastSunday(),
      tag: 'W-end',
    },
    {
      id: 'month',
      title: 'Previous month-end',
      subtitle: toPretty(getPrevMonthEnd()),
      date: getPrevMonthEnd(),
      tag: getMonthTag(getPrevMonthEnd()),
    },
  ];



  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={{ flex: 1 }} onPress={onClose} activeOpacity={0.8} />

        <View style={styles.sheet}>
          <Text style={styles.title}>As on date</Text>
          <Text style={styles.subtitle}>
            All KPIs recompute to end-of-day on the selected date
          </Text>

          {/* ✅ Presets */}
         {presets.map(p => {
           const isSelected = selectedPreset === p.id;

           return (
             <TouchableOpacity
               key={p.id}
               style={[
                 styles.option,
                 isSelected && styles.optionActive,
               ]}
               onPress={() => {
                 setSelectedPreset(p.id);
                 onSelect(toISO(p.date));
               }}
             >
               {/* ✅ Radio */}
               <View style={[styles.radio, isSelected && styles.radioActive]}>
                 {isSelected && <View style={styles.radioDot} />}
               </View>

               {/* ✅ Text block */}
               <View style={{ flex: 1 }}>
                 <Text style={styles.optTitle}>{p.title}</Text>
                 <Text style={styles.optSub}>{p.subtitle}</Text>
               </View>

               {/* ✅ Tag */}
               <View style={styles.tag}>
                 <Text style={styles.tagText}>{p.tag}</Text>
               </View>
             </TouchableOpacity>
           );
         })}


        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.input}
            onPress={() => setShowPicker(true)}
          >
            <Text style={styles.inputText}>
              {toISO(selectedDate)}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.button}
            onPress={() => {
              setSelectedPreset(null);   // ✅ clears preset selection
              onSelect(toISO(selectedDate));
              onClose();
            }}
          >
            <Text style={styles.buttonText}>
              Use date
            </Text>
          </TouchableOpacity>
        </View>


          {/* ✅ Native picker */}
          {showPicker && (
            <DateTimePicker
              value={selectedDate}
              mode="date"
              maximumDate={new Date()}
              onChange={(e, d) => {
                setShowPicker(false);
                if (d) setSelectedDate(d);
              }}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },

  sheet: {
    backgroundColor: theme.colors.bg1,
    padding: 16,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },

  title: {
    color: theme.colors.text0,
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },

  subtitle: {
    color: theme.colors.text2,
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 12,
  },

  option: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },

  optionText: {
    color: theme.colors.text0,
    fontSize: 13,
  },

  manualRow: {
    flexDirection: 'row',
    marginTop: 10,
    gap: 10,
  },
  optionActive: {
    borderColor: 'rgba(212,175,106,0.6)',
    backgroundColor: 'rgba(212,175,106,0.06)',
  },

  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: theme.colors.borderHi,
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },

  radioActive: {
    borderColor: theme.colors.gold,
  },

  radioDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.gold,
  },

  optTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.text0,
  },

  optSub: {
    fontSize: 11,
    color: theme.colors.text2,
    marginTop: 2,
  },


  tag: {
    backgroundColor: 'rgba(212,175,106,0.14)',
    paddingHorizontal: 10,
    paddingVertical: 2,
    borderRadius: 10,
    alignSelf: 'flex-start',
  },

  tagText: {
    fontSize: 10,
    fontWeight: '700',
    color: theme.colors.gold,
    lineHeight: 12,
  },

  footer: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },

  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 10,
    padding: 12,
    justifyContent: 'center',
  },

  inputText: {
    color: theme.colors.text0,
  },

  button: {
    backgroundColor: theme.colors.gold,
    paddingHorizontal: 16,
    justifyContent: 'center',
    borderRadius: 10,
  },

  buttonText: {
    fontWeight: '700',
    color: '#000',
  },

});