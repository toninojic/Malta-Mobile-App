import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { CheckCircle2, Flag, RefreshCw } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { useCreateReport } from '../../api/reportHooks';
import { AppModal } from '../../components/AppModal';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { OptionSelect } from '../../components/OptionSelect';
import { Screen } from '../../components/Screen';
import { TextField } from '../../components/TextField';
import { useTheme } from '../../design/theme';
import { ActivityStackParamList } from '../../navigation/types';
import { ReportReason } from '../../types/domain';
import { REPORT_REASON_OPTIONS, reportTargetLabel } from '../../utils/reportLabels';

type Props = NativeStackScreenProps<ActivityStackParamList, 'ReportForm'>;

export function ReportFormScreen({ route, navigation }: Props) {
  const theme = useTheme();
  const createReportMutation = useCreateReport();
  const [reason, setReason] = useState<ReportReason>('SPAM');
  const [description, setDescription] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [successOpen, setSuccessOpen] = useState(false);
  const targetLabel = reportTargetLabel(route.params.targetType);

  const submit = () => {
    const trimmedDescription = description.trim();
    if (reason === 'OTHER' && !trimmedDescription) {
      setLocalError('Please describe the issue when choosing Other.');
      return;
    }

    setLocalError(null);
    createReportMutation.mutate(
      {
        targetType: route.params.targetType,
        targetId: route.params.targetId,
        reason,
        description: trimmedDescription || undefined,
      },
      {
        onSuccess: () => setSuccessOpen(true),
        onError: (error) => setLocalError(error instanceof Error ? error.message : 'Could not submit report.'),
      },
    );
  };

  return (
    <Screen contentTopPadding={28}>
      <AppModal
        visible={successOpen}
        title="Report Submitted"
        body="Thank you. Our admin team will review your report."
        icon={CheckCircle2}
        actions={[
          {
            label: 'Close',
            variant: 'primary',
            onPress: () => {
              setSuccessOpen(false);
              navigation.goBack();
            },
          },
        ]}
        onRequestClose={() => {
          setSuccessOpen(false);
          navigation.goBack();
        }}
      />

      <Card>
        <Text style={[styles.title, { color: theme.colors.text }]}>Report {targetLabel}</Text>
        <Text style={[styles.copy, { color: theme.colors.textMuted }]}>
          Reports are private and reviewed by MaltaPro admins.
        </Text>
        <Text style={[styles.target, { color: theme.colors.text }]}>
          {route.params.targetSummary ?? `${targetLabel} ${route.params.targetId.slice(0, 8)}`}
        </Text>
      </Card>

      <OptionSelect
        label="Reason"
        value={reason}
        options={REPORT_REASON_OPTIONS}
        onChange={(value) => {
          setReason(value as ReportReason);
          setLocalError(null);
        }}
      />

      <TextField
        label={reason === 'OTHER' ? 'Description required' : 'Description'}
        value={description}
        onChangeText={(value) => {
          setDescription(value);
          setLocalError(null);
        }}
        multiline
        maxLength={1500}
        placeholder="Add context that helps the admin team understand the issue."
        error={localError ?? undefined}
      />

      <Button
        title="Submit Report"
        icon={Flag}
        loading={createReportMutation.isPending}
        onPress={submit}
      />
      {createReportMutation.isError && !localError ? (
        <Button title="Try Again" icon={RefreshCw} variant="secondary" onPress={submit} />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 24,
    fontWeight: '900',
  },
  copy: {
    fontSize: 14,
    lineHeight: 21,
  },
  target: {
    fontSize: 15,
    fontWeight: '900',
  },
});
