import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { PHONE_COUNTRIES, normalizePhoneInput, splitPhoneNumber, PhoneCountry } from '../config/phoneCountries';
import { useTheme } from '../design/theme';

type PhoneNumberInputProps = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
};

export function PhoneNumberInput({ label, value, onChangeText }: PhoneNumberInputProps) {
  const theme = useTheme();
  const parsed = useMemo(() => splitPhoneNumber(value), [value]);
  const [country, setCountry] = useState<PhoneCountry>(parsed.country);
  const [localNumber, setLocalNumber] = useState(parsed.localNumber);
  const [selectorOpen, setSelectorOpen] = useState(false);

  useEffect(() => {
    setCountry(parsed.country);
    setLocalNumber(parsed.localNumber);
  }, [parsed.country, parsed.localNumber]);

  const updateValue = (nextCountry: PhoneCountry, nextLocalNumber: string) => {
    setCountry(nextCountry);
    setLocalNumber(nextLocalNumber);
    onChangeText(normalizePhoneInput(nextCountry, nextLocalNumber));
  };

  return (
    <View style={styles.wrap}>
      <Text style={[styles.label, { color: theme.colors.text }]}>{label}</Text>
      <View style={[styles.row, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
        <Pressable
          accessibilityRole="button"
          onPress={() => setSelectorOpen(true)}
          style={({ pressed }) => [styles.countryButton, { opacity: pressed ? 0.75 : 1 }]}
        >
          <Text style={[styles.countryText, { color: theme.colors.text }]}>{country.name}</Text>
          <Text style={[styles.dialText, { color: theme.colors.textMuted }]}>{country.dialCode}</Text>
        </Pressable>
        <TextInput
          keyboardType="phone-pad"
          onChangeText={(next) => updateValue(country, next)}
          placeholder="99123456"
          placeholderTextColor={theme.colors.textMuted}
          style={[styles.input, { color: theme.colors.text }]}
          value={localNumber}
        />
      </View>
      <Modal animationType="fade" transparent visible={selectorOpen} onRequestClose={() => setSelectorOpen(false)}>
        <View style={styles.backdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setSelectorOpen(false)} />
          <View style={[styles.modalCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
            <Text style={[styles.modalTitle, { color: theme.colors.text }]}>Country code</Text>
            <ScrollView style={styles.countryList}>
              {PHONE_COUNTRIES.map((item) => (
                <Pressable
                  key={item.code}
                  accessibilityRole="button"
                  onPress={() => {
                    updateValue(item, localNumber);
                    setSelectorOpen(false);
                  }}
                  style={({ pressed }) => [
                    styles.countryOption,
                    {
                      backgroundColor: item.code === country.code ? `${theme.colors.success}18` : 'transparent',
                      opacity: pressed ? 0.75 : 1,
                    },
                  ]}
                >
                  <Text style={[styles.optionName, { color: theme.colors.text }]}>{item.name}</Text>
                  <Text style={[styles.optionDial, { color: theme.colors.textMuted }]}>{item.dialCode}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
  },
  row: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    minHeight: 50,
    paddingHorizontal: 10,
  },
  countryButton: {
    borderRadius: 7,
    gap: 1,
    minWidth: 122,
    paddingHorizontal: 8,
    paddingVertical: 7,
  },
  countryText: {
    fontSize: 13,
    fontWeight: '900',
  },
  dialText: {
    fontSize: 12,
    fontWeight: '800',
  },
  input: {
    flex: 1,
    fontSize: 16,
    minHeight: 48,
    paddingVertical: 10,
  },
  backdrop: {
    alignItems: 'center',
    backgroundColor: 'rgba(2, 6, 23, 0.58)',
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    borderRadius: 16,
    borderWidth: 1,
    maxHeight: '76%',
    maxWidth: 420,
    padding: 18,
    width: '100%',
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '900',
    marginBottom: 10,
  },
  countryList: {
    marginHorizontal: -8,
  },
  countryOption: {
    alignItems: 'center',
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 12,
  },
  optionName: {
    fontSize: 15,
    fontWeight: '800',
  },
  optionDial: {
    fontSize: 14,
    fontWeight: '900',
  },
});
