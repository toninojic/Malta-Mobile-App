import { Bot, Edit3, Send, Sparkles, Trash2, X } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  useAiJobAssistant,
  useCreateAiJobAssistantConversation,
  useDiscardAiJobDraft,
  usePublishAiJobDraft,
  useSendAiJobAssistantMessage,
} from '../api/aiJobAssistantHooks';
import { Button } from './Button';
import { Card } from './Card';
import { MALTA_SERVICE_LOCATIONS } from '../config/maltaLocations';
import { serviceCategoryLabel, serviceSubcategoryLabel } from '../config/serviceCategories';
import { useTheme } from '../design/theme';
import { useAuthStore } from '../store/auth.store';
import { AiJobDraft, AiJobAssistantState, JobRequest } from '../types/domain';

type Props = {
  currentRouteName?: string;
  onEditManually: (draft: AiJobDraft) => void;
  onPublished: (job: JobRequest) => void;
};

const HIDDEN_ROUTES = new Set([
  'ConversationThread',
  'Conversations',
  'JobForm',
  'OfferForm',
  'LeaveReview',
  'RefundRequest',
  'PaymentSuccess',
  'PaymentFailed',
  'PaymentPending',
]);
const ANDROID_SUGGESTION_BAR_CLEARANCE = 47;

export function AiJobAssistantHost({ currentRouteName, onEditManually, onPublished }: Props) {
  const theme = useTheme();
  const user = useAuthStore((state) => state.user);
  const [open, setOpen] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  const hiddenByRoute = currentRouteName ? HIDDEN_ROUTES.has(currentRouteName) || currentRouteName.endsWith('Form') : false;
  const visible = user?.role === 'EMPLOYER' && !open && !keyboardVisible && !hiddenByRoute;

  return (
    <>
      {visible ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open AI Job Assistant"
          onPress={() => setOpen(true)}
          style={({ pressed }) => [
            styles.floatingButton,
            {
              backgroundColor: pressed ? theme.colors.primaryPressed : theme.colors.success,
              shadowColor: '#0F172A',
            },
          ]}
        >
          <Sparkles color="#FFFFFF" size={18} />
        </Pressable>
      ) : null}
      <AiJobAssistantModal
        visible={open}
        onClose={() => setOpen(false)}
        onEditManually={(draft) => {
          setOpen(false);
          onEditManually(draft);
        }}
        onPublished={(job) => {
          setOpen(false);
          onPublished(job);
        }}
      />
    </>
  );
}

function AiJobAssistantModal({
  visible,
  onClose,
  onEditManually,
  onPublished,
}: {
  visible: boolean;
  onClose: () => void;
  onEditManually: (draft: AiJobDraft) => void;
  onPublished: (job: JobRequest) => void;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [createRequested, setCreateRequested] = useState(false);
  const [keyboardClearance, setKeyboardClearance] = useState(0);
  const assistantQuery = useAiJobAssistant(visible);
  const createConversationMutation = useCreateAiJobAssistantConversation();
  const sendMutation = useSendAiJobAssistantMessage();
  const publishMutation = usePublishAiJobDraft();
  const discardMutation = useDiscardAiJobDraft();
  const state = (assistantQuery.data ?? createConversationMutation.data) as AiJobAssistantState | undefined;
  const conversationId = state?.conversation?.id;
  const draft = state?.draft ?? null;
  const remaining = state?.remainingMessages ?? state?.usage?.remainingMessages ?? 0;
  const limit = state?.usage?.limit ?? 20;
  const unavailable = state && !state.isAvailable;

  useEffect(() => {
    if (!visible || assistantQuery.isFetching || createConversationMutation.isPending || createRequested) {
      return;
    }

    if (assistantQuery.data?.isAvailable && !assistantQuery.data.conversation) {
      setCreateRequested(true);
      createConversationMutation.mutate();
    }
  }, [
    assistantQuery.data?.conversation,
    assistantQuery.data?.isAvailable,
    assistantQuery.isFetching,
    createConversationMutation,
    createRequested,
    visible,
  ]);

  useEffect(() => {
    if (!visible) {
      setMessage('');
      setError('');
      setCreateRequested(false);
      setKeyboardClearance(0);
    }
  }, [visible]);

  useEffect(() => {
    if (!visible) {
      return undefined;
    }

    const showSubscription = Keyboard.addListener('keyboardDidShow', () => {
      setKeyboardClearance(Platform.OS === 'android' ? ANDROID_SUGGESTION_BAR_CLEARANCE : 0);
    });
    const hideSubscription = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardClearance(0);
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, [visible]);

  const canSend = Boolean(
    conversationId &&
      message.trim() &&
      message.length <= 500 &&
      remaining > 0 &&
      !sendMutation.isPending &&
      !unavailable,
  );

  const send = () => {
    if (!conversationId || !canSend) {
      return;
    }

    const trimmed = message.trim();
    setError('');
    setMessage('');
    sendMutation.mutate(
      { conversationId, message: trimmed },
      {
        onError: (requestError) => {
          setMessage(trimmed);
          setError(requestError instanceof Error ? requestError.message : 'AI assistant is currently unavailable.');
        },
      },
    );
  };

  const publish = () => {
    if (!draft) {
      return;
    }

    setError('');
    publishMutation.mutate(draft.id, {
      onSuccess: (result) => onPublished(result.job),
      onError: (requestError) => setError(requestError instanceof Error ? requestError.message : 'Could not publish draft.'),
    });
  };

  const discard = () => {
    if (!draft) {
      return;
    }

    setError('');
    discardMutation.mutate(draft.id, {
      onSuccess: onClose,
      onError: (requestError) => setError(requestError instanceof Error ? requestError.message : 'Could not discard draft.'),
    });
  };

  const messages = useMemo(() => state?.messages ?? [], [state?.messages]);

  return (
    <Modal animationType="slide" visible={visible} presentationStyle="fullScreen" onRequestClose={onClose}>
      <SafeAreaView style={[styles.modalRoot, { backgroundColor: theme.colors.background }]}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
          style={styles.modalRoot}
        >
          <View style={[styles.modalHeader, { borderBottomColor: theme.colors.border }]}>
            <View style={styles.headerTitleRow}>
              <View style={[styles.headerIcon, { backgroundColor: `${theme.colors.success}18` }]}>
                <Bot color={theme.colors.success} size={20} />
              </View>
              <View style={styles.headerCopy}>
                <Text style={[styles.modalTitle, { color: theme.colors.text }]}>AI Job Assistant</Text>
                <Text style={[styles.counter, { color: theme.colors.textMuted }]}>
                  {remaining} / {limit} messages left today
                </Text>
              </View>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Close AI Job Assistant" onPress={onClose} style={styles.closeButton}>
              <X color={theme.colors.text} size={22} />
            </Pressable>
          </View>

          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.modalContent}>
            {assistantQuery.isLoading || createConversationMutation.isPending ? (
              <View style={styles.loadingWrap}>
                <ActivityIndicator color={theme.colors.success} />
                <Text style={[styles.helper, { color: theme.colors.textMuted }]}>Preparing AI assistant</Text>
              </View>
            ) : null}

            {unavailable ? (
              <Card>
                <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Assistant unavailable</Text>
                <Text style={[styles.bodyText, { color: theme.colors.textMuted }]}>
                  {state?.unavailableReason ?? 'AI assistant is currently unavailable.'}
                </Text>
                <Text style={[styles.bodyText, { color: theme.colors.textMuted }]}>
                  You can still create a job manually from the Jobs tab.
                </Text>
              </Card>
            ) : null}

            {!messages.length && !unavailable ? (
              <Card>
                <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Describe the job you need help with.</Text>
                <Text style={[styles.bodyText, { color: theme.colors.textMuted }]}>
                  Include the work needed, the area in Malta, and any important details. AI will prepare a draft that you can edit before publishing.
                </Text>
              </Card>
            ) : null}

            {messages.map((item) => (
              <View
                key={item.id}
                style={[
                  styles.messageBubble,
                  item.role === 'USER' ? styles.userBubble : styles.assistantBubble,
                  {
                    backgroundColor: item.role === 'USER' ? theme.colors.success : theme.colors.surface,
                    borderColor: theme.colors.border,
                  },
                ]}
              >
                <Text style={[styles.messageText, { color: item.role === 'USER' ? '#FFFFFF' : theme.colors.text }]}>{item.content}</Text>
              </View>
            ))}

            {sendMutation.isPending ? (
              <View style={[styles.messageBubble, styles.assistantBubble, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
                <Text style={[styles.messageText, { color: theme.colors.textMuted }]}>Thinking...</Text>
              </View>
            ) : null}

            {draft ? (
              <DraftPreview
                draft={draft}
                publishing={publishMutation.isPending}
                discarding={discardMutation.isPending}
                onPublish={publish}
                onEditManually={() => onEditManually(draft)}
                onDiscard={discard}
              />
            ) : null}

            {remaining <= 0 && !unavailable ? (
              <Card>
                <Text style={[styles.bodyText, { color: theme.colors.textMuted }]}>
                  You have used your AI messages for today. You can create a job manually or try again tomorrow.
                </Text>
              </Card>
            ) : null}

            {error ? <Text style={[styles.errorText, { color: theme.colors.danger }]}>{error}</Text> : null}
          </ScrollView>

          {!unavailable ? (
            <View
              style={[
                styles.inputBar,
                {
                  borderTopColor: theme.colors.border,
                  backgroundColor: theme.colors.surface,
                  marginBottom: keyboardClearance,
                  paddingBottom: Math.max(insets.bottom, 10),
                },
              ]}
            >
              <View style={[styles.inputWrap, { borderColor: theme.colors.border, backgroundColor: theme.colors.background }]}>
                <TextInput
                  value={message}
                  onChangeText={setMessage}
                  placeholder="Describe the job you need help with."
                  placeholderTextColor={theme.colors.textMuted}
                  maxLength={500}
                  multiline
                  style={[styles.input, { color: theme.colors.text }]}
                />
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Send AI message"
                disabled={!canSend}
                onPress={send}
                style={({ pressed }) => [
                  styles.sendButton,
                  {
                    backgroundColor: canSend ? (pressed ? theme.colors.primaryPressed : theme.colors.success) : theme.colors.surfaceMuted,
                  },
                ]}
              >
                <Send color={canSend ? '#FFFFFF' : theme.colors.textMuted} size={19} />
              </Pressable>
            </View>
          ) : null}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

function DraftPreview({
  draft,
  publishing,
  discarding,
  onPublish,
  onEditManually,
  onDiscard,
}: {
  draft: AiJobDraft;
  publishing: boolean;
  discarding: boolean;
  onPublish: () => void;
  onEditManually: () => void;
  onDiscard: () => void;
}) {
  const theme = useTheme();
  const locationLabel = MALTA_SERVICE_LOCATIONS.find((location) => location.key === draft.locationKey)?.label ?? draft.locationKey;

  return (
    <Card>
      <View style={styles.draftHeader}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Job draft</Text>
        <Text style={[styles.draftBadge, { color: theme.colors.success, backgroundColor: `${theme.colors.success}18` }]}>Review before publish</Text>
      </View>
      <InfoRow label="Title" value={draft.title} />
      <InfoRow label="Description" value={draft.description} />
      <InfoRow label="Category" value={serviceCategoryLabel(draft.categoryKey)} />
      <InfoRow label="Subcategory" value={serviceSubcategoryLabel(draft.categoryKey, draft.subcategoryKey)} />
      <InfoRow label="Location" value={locationLabel} />
      <View style={styles.draftActions}>
        <Button title="Publish" icon={Sparkles} loading={publishing} onPress={onPublish} style={styles.actionButton} />
        <Button title="Edit manually" icon={Edit3} variant="secondary" onPress={onEditManually} style={styles.actionButton} />
        <Button title="Discard" icon={Trash2} variant="ghost" loading={discarding} onPress={onDiscard} style={styles.actionButton} />
      </View>
    </Card>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  const theme = useTheme();

  return (
    <View style={styles.infoRow}>
      <Text style={[styles.infoLabel, { color: theme.colors.textMuted }]}>{label}</Text>
      <Text style={[styles.infoValue, { color: theme.colors.text }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  floatingButton: {
    position: 'absolute',
    bottom: 112,
    left: 18,
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 5,
    shadowOpacity: 0.22,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    zIndex: 50,
  },
  modalRoot: {
    flex: 1,
  },
  modalHeader: {
    minHeight: 68,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    gap: 12,
  },
  headerTitleRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCopy: {
    flex: 1,
    gap: 2,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '900',
  },
  counter: {
    fontSize: 12,
    fontWeight: '700',
  },
  closeButton: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalContent: {
    flexGrow: 1,
    gap: 12,
    padding: 16,
  },
  loadingWrap: {
    alignItems: 'center',
    gap: 10,
    paddingVertical: 28,
  },
  helper: {
    fontSize: 13,
    fontWeight: '700',
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '900',
  },
  bodyText: {
    fontSize: 14,
    lineHeight: 20,
  },
  messageBubble: {
    maxWidth: '86%',
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  userBubble: {
    alignSelf: 'flex-end',
  },
  assistantBubble: {
    alignSelf: 'flex-start',
  },
  messageText: {
    fontSize: 14,
    lineHeight: 20,
  },
  draftHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  draftBadge: {
    borderRadius: 8,
    overflow: 'hidden',
    paddingHorizontal: 8,
    paddingVertical: 5,
    fontSize: 11,
    fontWeight: '900',
  },
  infoRow: {
    gap: 4,
  },
  infoLabel: {
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  infoValue: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
  },
  draftActions: {
    gap: 8,
  },
  actionButton: {
    width: '100%',
  },
  errorText: {
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 19,
  },
  inputBar: {
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    paddingHorizontal: 12,
    paddingTop: 10,
  },
  inputWrap: {
    flex: 1,
    minHeight: 46,
    maxHeight: 116,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  input: {
    fontSize: 15,
    lineHeight: 20,
    minHeight: 28,
    maxHeight: 92,
    padding: 0,
    textAlignVertical: 'top',
  },
  sendButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
