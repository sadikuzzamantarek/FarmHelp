import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import {
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { withAlpha } from "@/constants/app-theme";
import { SEEDS } from "@/constants/seeds";
import {
  SERVICES,
  getServiceAccent,
  type ServiceDefinition,
} from "@/constants/services";
import { useAppTheme } from "@/contexts/app-theme";
import { useToast } from "@/contexts/toast";
import { haversineKm } from "@/utils/geoEngine";

type ProviderDetailsProps = {
  visible: boolean;
  providerId: string | null;
  provider: any | null;
  origin: { lat: number; lng: number };
  /** Highlights the seed the farmer searched for. */
  seedId?: string | null;
  onClose: () => void;
};

type Offer = {
  service: ServiceDefinition;
  offer: any;
};

export function ProviderDetails({
  visible,
  providerId,
  provider,
  origin,
  seedId,
  onClose,
}: ProviderDetailsProps) {
  const insets = useSafeAreaInsets();
  const { colors, mode, isDark } = useAppTheme();
  const { showToast } = useToast();

  const offers: Offer[] = SERVICES.flatMap((service) => {
    const offer = provider?.services?.[service.id];
    return offer ? [{ service, offer }] : [];
  });

  const primaryService = offers[0]?.service;
  const accent = primaryService
    ? getServiceAccent(primaryService, mode)
    : colors.primary;
  const distance =
    provider && Number.isFinite(provider.lat) && Number.isFinite(provider.lng)
      ? haversineKm(origin, { lat: provider.lat, lng: provider.lng })
      : null;

  // Future-proof: show a real number when the provider API supplies one.
  const phone: string | null =
    provider?.phone ?? provider?.contact_phone ?? provider?.phone_number ?? null;

  const callProvider = () => {
    if (!phone) return;
    Linking.openURL(`tel:${phone}`).catch(() =>
      showToast("Could not open the phone app", "error"),
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={[styles.backdrop, { backgroundColor: colors.overlay }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close provider details"
          style={StyleSheet.absoluteFill}
          onPress={onClose}
        />

        <View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              paddingBottom: Math.max(insets.bottom, 16) + 8,
            },
          ]}
        >
          <View style={[styles.handle, { backgroundColor: colors.border }]} />

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.sheetContent}
          >
            <View style={styles.header}>
              <View
                style={[
                  styles.avatar,
                  { backgroundColor: withAlpha(accent, isDark ? 0.22 : 0.14) },
                ]}
              >
                <MaterialCommunityIcons
                  name={primaryService?.icon ?? "storefront-outline"}
                  size={30}
                  color={accent}
                />
              </View>

              <View style={styles.headerText}>
                <Text style={[styles.name, { color: colors.text }]}>
                  {provider?.name ?? "Provider details"}
                </Text>
                <View style={styles.badgeRow}>
                  <View
                    style={[
                      styles.demoBadge,
                      { backgroundColor: colors.accentSoft },
                    ]}
                  >
                    <Text
                      style={[styles.demoBadgeText, { color: colors.accent }]}
                    >
                      DEMO PROVIDER
                    </Text>
                  </View>
                  {providerId ? (
                    <Text style={[styles.providerId, { color: colors.textMuted }]}>
                      ID {providerId}
                    </Text>
                  ) : null}
                </View>
              </View>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close"
                hitSlop={10}
                onPress={onClose}
                style={[styles.closeButton, { backgroundColor: colors.chip }]}
              >
                <MaterialCommunityIcons
                  name="close"
                  size={20}
                  color={colors.textMuted}
                />
              </Pressable>
            </View>

            <View style={styles.statsRow}>
              <Stat
                icon="map-marker-distance"
                label="Distance from map center"
                value={distance !== null ? `${distance.toFixed(1)} km` : "—"}
                colors={colors}
              />
              <Stat
                icon="briefcase-outline"
                label="Services offered"
                value={String(offers.length)}
                colors={colors}
              />
            </View>

            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Services and prices
            </Text>

            {offers.length === 0 ? (
              <View
                style={[
                  styles.emptyBox,
                  { backgroundColor: colors.chip, borderColor: colors.border },
                ]}
              >
                <MaterialCommunityIcons
                  name="information-outline"
                  size={18}
                  color={colors.textMuted}
                />
                <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                  Service details were not loaded for this provider. Try
                  refreshing the map.
                </Text>
              </View>
            ) : (
              offers.map(({ service, offer }) => {
                const serviceColor = getServiceAccent(service, mode);
                const selectedVariety =
                  service.id === "seed" && seedId
                    ? offer.varieties?.[seedId]
                    : null;
                const price =
                  selectedVariety?.price_per_kg ??
                  offer.price_per_acre ??
                  offer.price_per_kg ??
                  offer.price;
                const unit = service.unit === "kg" ? "kg" : "acre";
                const available = selectedVariety
                  ? selectedVariety.available !== false
                  : offer.available !== false;

                return (
                  <View
                    key={service.id}
                    style={[
                      styles.offerRow,
                      {
                        backgroundColor: colors.elevated,
                        borderColor: colors.border,
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.offerIcon,
                        {
                          backgroundColor: withAlpha(
                            serviceColor,
                            isDark ? 0.22 : 0.14,
                          ),
                        },
                      ]}
                    >
                      <MaterialCommunityIcons
                        name={service.icon}
                        size={20}
                        color={serviceColor}
                      />
                    </View>

                    <View style={styles.offerText}>
                      <Text style={[styles.offerName, { color: colors.text }]}>
                        {service.label}
                      </Text>
                      <Text
                        style={[
                          styles.offerPrice,
                          { color: colors.textMuted },
                        ]}
                      >
                        {price != null
                          ? `Tk ${Number(price).toFixed(0)} per ${unit}`
                          : "Price not provided"}
                      </Text>

                      {service.id === "seed" && offer.varieties ? (
                        <View style={styles.varietyGrid}>
                          {SEEDS.map((seed) => {
                            const variety = offer.varieties[seed.id];
                            if (!variety) return null;

                            const varietyPrice = Number(
                              variety.price_per_kg ?? variety.price,
                            );
                            const isSelected = seed.id === seedId;
                            const isAvailable = variety.available !== false;

                            return (
                              <View
                                key={seed.id}
                                style={[
                                  styles.varietyPill,
                                  {
                                    backgroundColor: isSelected
                                      ? colors.primarySoft
                                      : colors.chip,
                                    borderColor: isSelected
                                      ? colors.primary
                                      : "transparent",
                                    opacity: isAvailable ? 1 : 0.45,
                                  },
                                ]}
                              >
                                <Text
                                  style={[
                                    styles.varietyName,
                                    {
                                      color: isSelected
                                        ? colors.primary
                                        : colors.text,
                                    },
                                  ]}
                                >
                                  {seed.emoji} {seed.label}
                                </Text>
                                <Text
                                  style={[
                                    styles.varietyPrice,
                                    { color: colors.textMuted },
                                  ]}
                                >
                                  {Number.isFinite(varietyPrice)
                                    ? `Tk ${varietyPrice.toFixed(0)}`
                                    : "—"}
                                </Text>
                              </View>
                            );
                          })}
                        </View>
                      ) : null}
                    </View>

                    <View
                      style={[
                        styles.availability,
                        {
                          backgroundColor: available
                            ? colors.primarySoft
                            : colors.chip,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.availabilityText,
                          {
                            color: available
                              ? colors.primary
                              : colors.textMuted,
                          },
                        ]}
                      >
                        {available ? "AVAILABLE" : "BUSY"}
                      </Text>
                    </View>
                  </View>
                );
              })
            )}

            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Contact
            </Text>

            {phone ? (
              <View
                style={[
                  styles.contactRow,
                  { backgroundColor: colors.chip, borderColor: colors.border },
                ]}
              >
                <View
                  style={[styles.contactIcon, { backgroundColor: colors.surface }]}
                >
                  <MaterialCommunityIcons
                    name="phone"
                    size={19}
                    color={colors.primary}
                  />
                </View>
                <View style={styles.contactText}>
                  <Text style={[styles.contactValue, { color: colors.text }]}>
                    {phone}
                  </Text>
                  <Text
                    style={[styles.contactHint, { color: colors.textMuted }]}
                  >
                    Shared by the provider
                  </Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Call ${provider?.name ?? "provider"}`}
                  onPress={callProvider}
                  style={[styles.callButton, { backgroundColor: colors.primary }]}
                >
                  <MaterialCommunityIcons
                    name="phone"
                    size={15}
                    color={colors.onPrimary}
                  />
                  <Text
                    style={[styles.callButtonText, { color: colors.onPrimary }]}
                  >
                    Call
                  </Text>
                </Pressable>
              </View>
            ) : (
              <View
                style={[
                  styles.emptyBox,
                  { backgroundColor: colors.chip, borderColor: colors.border },
                ]}
              >
                <MaterialCommunityIcons
                  name="phone-off-outline"
                  size={18}
                  color={colors.textMuted}
                />
                <View style={styles.emptyTextWrap}>
                  <Text style={[styles.contactValue, { color: colors.text }]}>
                    Phone number not shared yet
                  </Text>
                  <Text
                    style={[styles.contactHint, { color: colors.textMuted }]}
                  >
                    Demo providers do not publish phone numbers. Contact details
                    will appear after a booking is accepted, once booking is
                    built.
                  </Text>
                </View>
              </View>
            )}

            <Text style={[styles.disclaimer, { color: colors.textMuted }]}>
              This is a synthetic test record for the FarmHelper demo. It is not
              a real business.
            </Text>

            <Pressable
              accessibilityRole="button"
              onPress={onClose}
              style={({ pressed }) => [
                styles.doneButton,
                {
                  backgroundColor: colors.primary,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              <Text style={[styles.doneText, { color: colors.onPrimary }]}>
                Done
              </Text>
            </Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function Stat({
  icon,
  label,
  value,
  colors,
}: {
  icon: React.ComponentProps<typeof MaterialCommunityIcons>["name"];
  label: string;
  value: string;
  colors: ReturnType<typeof useAppTheme>["colors"];
}) {
  return (
    <View
      style={[
        styles.stat,
        { backgroundColor: colors.elevated, borderColor: colors.border },
      ]}
    >
      <MaterialCommunityIcons name={icon} size={17} color={colors.primary} />
      <Text style={[styles.statValue, { color: colors.text }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: colors.textMuted }]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "flex-end",
  },
  sheet: {
    maxHeight: "82%",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingTop: 8,
  },
  handle: {
    width: 42,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 14,
  },
  sheetContent: {
    paddingBottom: 8,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  avatar: {
    width: 58,
    height: 58,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  headerText: {
    flex: 1,
  },
  name: {
    fontSize: 21,
    fontWeight: "800",
    lineHeight: 26,
  },
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 5,
  },
  demoBadge: {
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  demoBadgeText: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  providerId: {
    fontSize: 10.5,
    fontWeight: "600",
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  statsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 16,
  },
  stat: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    gap: 2,
  },
  statValue: {
    fontSize: 16,
    fontWeight: "800",
    marginTop: 2,
  },
  statLabel: {
    fontSize: 10.5,
    fontWeight: "600",
    lineHeight: 14,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 0.3,
    marginTop: 20,
    marginBottom: 8,
  },
  offerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderRadius: 14,
    padding: 11,
    marginBottom: 8,
  },
  offerIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  offerText: {
    flex: 1,
  },
  offerName: {
    fontSize: 14,
    fontWeight: "800",
  },
  offerPrice: {
    fontSize: 11.5,
    fontWeight: "600",
    marginTop: 1,
  },
  varietyGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 5,
    marginTop: 8,
  },
  varietyPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 4,
  },
  varietyName: {
    fontSize: 10.5,
    fontWeight: "700",
  },
  varietyPrice: {
    fontSize: 10.5,
    fontWeight: "700",
  },
  availability: {
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  availabilityText: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  contactRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderRadius: 14,
    padding: 11,
  },
  contactIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  contactText: {
    flex: 1,
  },
  contactValue: {
    fontSize: 14,
    fontWeight: "800",
  },
  contactHint: {
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "500",
    marginTop: 2,
  },
  callButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  callButtonText: {
    fontSize: 12,
    fontWeight: "800",
  },
  emptyBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 9,
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
  },
  emptyText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "600",
  },
  emptyTextWrap: {
    flex: 1,
  },
  disclaimer: {
    fontSize: 10.5,
    lineHeight: 15,
    marginTop: 16,
    textAlign: "center",
  },
  doneButton: {
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: "center",
    marginTop: 16,
  },
  doneText: {
    fontSize: 15,
    fontWeight: "800",
  },
});
