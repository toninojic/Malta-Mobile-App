import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../design/theme';
import { formatDate } from '../utils/date';

type DatePickerFieldProps = {
  label: string;
  value: Date;
  minimumDate?: Date;
  onChange: (date: Date) => void;
};

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function DatePickerField({ label, value, minimumDate, onChange }: DatePickerFieldProps) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState(() => monthStart(value));
  const days = useMemo(() => calendarDays(visibleMonth), [visibleMonth]);
  const minDate = minimumDate ? startOfDay(minimumDate) : null;

  const chooseDate = (date: Date) => {
    if (minDate && startOfDay(date) < minDate) {
      return;
    }
    onChange(startOfDay(date));
    setOpen(false);
  };

  return (
    <View style={styles.wrap}>
      <Text style={[styles.label, { color: theme.colors.text }]}>{label}</Text>
      <Pressable
        accessibilityRole="button"
        onPress={() => setOpen(true)}
        style={({ pressed }) => [
          styles.inputWrap,
          {
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.border,
            opacity: pressed ? 0.78 : 1,
          },
        ]}
      >
        <CalendarDays color={theme.colors.textMuted} size={18} />
        <Text style={[styles.inputText, { color: theme.colors.text }]}>{formatDate(value)}</Text>
      </Pressable>

      <Modal animationType="fade" transparent visible={open} onRequestClose={() => setOpen(false)}>
        <View style={styles.backdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setOpen(false)} />
          <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
            <View style={styles.monthHeader}>
              <Pressable
                accessibilityRole="button"
                onPress={() => setVisibleMonth(addMonths(visibleMonth, -1))}
                style={styles.iconButton}
              >
                <ChevronLeft color={theme.colors.text} size={22} />
              </Pressable>
              <Text style={[styles.monthTitle, { color: theme.colors.text }]}>
                {visibleMonth.toLocaleString('en-GB', { month: 'long', year: 'numeric' })}
              </Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => setVisibleMonth(addMonths(visibleMonth, 1))}
                style={styles.iconButton}
              >
                <ChevronRight color={theme.colors.text} size={22} />
              </Pressable>
            </View>
            <View style={styles.weekGrid}>
              {WEEKDAYS.map((day) => (
                <Text key={day} style={[styles.weekday, { color: theme.colors.textMuted }]}>{day}</Text>
              ))}
              {days.map((day, index) => {
                if (!day) {
                  return <View key={`blank-${index}`} style={styles.dayCell} />;
                }
                const disabled = Boolean(minDate && startOfDay(day) < minDate);
                const selected = sameDay(day, value);
                return (
                  <Pressable
                    key={day.toISOString()}
                    accessibilityRole="button"
                    disabled={disabled}
                    onPress={() => chooseDate(day)}
                    style={[
                      styles.dayCell,
                      {
                        backgroundColor: selected ? theme.colors.success : 'transparent',
                        opacity: disabled ? 0.28 : 1,
                      },
                    ]}
                  >
                    <Text style={[styles.dayText, { color: selected ? '#FFFFFF' : theme.colors.text }]}>
                      {day.getDate()}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function startOfDay(value: Date) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

function monthStart(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), 1);
}

function addMonths(value: Date, months: number) {
  return new Date(value.getFullYear(), value.getMonth() + months, 1);
}

function calendarDays(month: Date) {
  const first = monthStart(month);
  const firstWeekday = (first.getDay() + 6) % 7;
  const last = new Date(first.getFullYear(), first.getMonth() + 1, 0);
  const days: Array<Date | null> = Array.from({ length: firstWeekday }, () => null);

  for (let day = 1; day <= last.getDate(); day += 1) {
    days.push(new Date(first.getFullYear(), first.getMonth(), day));
  }

  while (days.length % 7 !== 0) {
    days.push(null);
  }

  return days;
}

function sameDay(left: Date, right: Date) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
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
  inputWrap: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    minHeight: 50,
    paddingHorizontal: 12,
  },
  inputText: {
    fontSize: 16,
    fontWeight: '800',
  },
  backdrop: {
    alignItems: 'center',
    backgroundColor: 'rgba(2, 6, 23, 0.58)',
    flex: 1,
    justifyContent: 'center',
    padding: 18,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    maxWidth: 420,
    padding: 16,
    width: '100%',
  },
  monthHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  monthTitle: {
    fontSize: 18,
    fontWeight: '900',
  },
  iconButton: {
    alignItems: 'center',
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  weekGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  weekday: {
    fontSize: 12,
    fontWeight: '900',
    textAlign: 'center',
    width: `${100 / 7}%`,
  },
  dayCell: {
    alignItems: 'center',
    aspectRatio: 1,
    borderRadius: 8,
    justifyContent: 'center',
    width: `${100 / 7}%`,
  },
  dayText: {
    fontSize: 15,
    fontWeight: '900',
  },
});
