import { useQuery } from '@tanstack/react-query';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { BriefcaseBusiness, RefreshCw } from 'lucide-react-native';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { api } from '../../api/client';
import { EmptyState } from '../../components/EmptyState';
import { OfferWorkCard } from '../../components/OfferWorkCard';
import { Screen } from '../../components/Screen';
import { useTheme } from '../../design/theme';
import { JobsStackParamList } from '../../navigation/types';
import { Offer } from '../../types/domain';
import { isActiveOffer, OFFER_WORK_FILTERS, offerMatchesFilter, OfferWorkFilter } from '../../utils/offerWork';

type Props = NativeStackScreenProps<JobsStackParamList, 'MyOffers'>;

export function MyOffersScreen({ navigation, route }: Props) {
  const theme = useTheme();
  const activeOnly = route.params?.mode !== 'activity';
  const initialFilter = (route.params?.initialFilter as OfferWorkFilter | undefined) ?? 'ALL';
  const [filter, setFilter] = useState<OfferWorkFilter>(initialFilter);

  const query = useQuery({
    queryKey: ['offers', 'mine'],
    queryFn: () => api.myOffers({ limit: 100 }),
  });

  useFocusEffect(
    useCallback(() => {
      void query.refetch();
    }, [query.refetch]),
  );

  const offers = useMemo(() => {
    const allOffers = query.data?.data ?? [];
    const visible = activeOnly ? allOffers.filter(isActiveOffer) : allOffers.filter((offer) => offerMatchesFilter(offer, filter));
    return visible.sort(sortOffers);
  }, [activeOnly, filter, query.data?.data]);

  return (
    <Screen refreshing={query.isRefetching} onRefresh={() => void query.refetch()}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.colors.text }]}>{activeOnly ? 'Active offers' : 'My offers'}</Text>
        <Text style={[styles.subtitle, { color: theme.colors.textMuted }]}>
          {activeOnly ? 'Current offers that still need action.' : 'Manage every offer and work status from one place.'}
        </Text>
      </View>

      {!activeOnly ? (
        <View style={styles.filterFrame}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.filterScroll}
            contentContainerStyle={styles.filters}
          >
            {OFFER_WORK_FILTERS.map((item) => (
              <Pressable
                accessibilityRole="button"
                key={item.value}
                onPress={() => setFilter(item.value)}
                style={[
                  styles.filterPill,
                  {
                    backgroundColor: filter === item.value ? theme.colors.primary : theme.colors.surfaceMuted,
                    borderColor: filter === item.value ? theme.colors.primary : theme.colors.border,
                  },
                ]}
              >
                <Text style={[styles.filterText, { color: filter === item.value ? '#FFFFFF' : theme.colors.text }]}>
                  {item.label}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      ) : null}

      {query.isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      ) : null}

      {query.error ? (
        <EmptyState
          icon={RefreshCw}
          title="Could not load offers"
          message={query.error instanceof Error ? query.error.message : 'Please try again.'}
          actionTitle="Retry"
          onAction={() => void query.refetch()}
        />
      ) : null}

      {!query.isLoading && !query.error && offers.length === 0 ? (
        <EmptyState
          icon={BriefcaseBusiness}
          title={activeOnly ? 'No active job offers.' : 'No offers for this filter'}
          message={activeOnly ? 'Pending, selected, unlocked, and in-progress offers will appear here.' : 'Try another status filter.'}
        />
      ) : null}

      <View style={styles.list}>
        {offers.map((offer) => (
          <OfferWorkCard
            key={offer.id}
            offer={offer}
            onPress={() => navigation.navigate('OfferWorkDetails', { offerId: offer.id })}
          />
        ))}
      </View>
    </Screen>
  );
}

function sortOffers(a: Offer, b: Offer) {
  return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
}

const styles = StyleSheet.create({
  header: {
    gap: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 21,
  },
  filterFrame: {
    height: 44,
    maxHeight: 44,
    overflow: 'hidden',
  },
  filterScroll: {
    flexGrow: 0,
  },
  filters: {
    alignItems: 'center',
    gap: 8,
    paddingRight: 12,
  },
  filterPill: {
    borderRadius: 8,
    borderWidth: 1,
    height: 34,
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  filterText: {
    fontSize: 13,
    fontWeight: '800',
  },
  center: {
    paddingVertical: 32,
  },
  list: {
    gap: 12,
  },
});
