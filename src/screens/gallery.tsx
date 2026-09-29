import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  Image,
  Modal,
  ScrollView,
  Share,
  Linking,
  Platform,
  NativeModules,
  TouchableOpacity,
  FlatList,
} from "react-native";
import LinearGradient from 'react-native-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../navigation/types';

const BackIcon: React.FC<{ size?: number; color?: string }> = ({ size = 24, color = '#fff' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M19 12H5" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    <Path d="M12 19L5 12L12 5" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

import { getRecentPhotos, RecentPhoto } from '../utils/RecentPhotos';

const { width } = Dimensions.get("window");
const CARD_SIZE = (width - 60) / 3;

type FilterType = "Today" | "Yesterday" | "Last Week";

/**
 * Recent-photos gallery with Today / Yesterday / Last Week filters.
 *
 * Tapping a photo opens a preview modal with scan (→ SmartClipboard),
 * edit, share, and close actions.
 */
export const GalleryScreen = () => {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const [activeFilter, setActiveFilter] = useState<FilterType>("Today");
  const [allPhotos, setAllPhotos] = useState<RecentPhoto[]>([]);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  React.useEffect(() => {
    getRecentPhotos().then(setAllPhotos);
  }, []);

  const handleShare = React.useCallback(() => {
    if (!selectedImage) return;

    if (Platform.OS === 'android' && NativeModules.StorageModule && NativeModules.StorageModule.shareImage) {
      NativeModules.StorageModule.shareImage(selectedImage.replace('file://', ''));
    } else {
      Share.share({ url: selectedImage });
    }
  }, [selectedImage]);

  const handleEdit = React.useCallback(() => {
    if (selectedImage) Linking.openURL(selectedImage);
  }, [selectedImage]);

  const getFilteredData = () => {
    const ONE_DAY = 24 * 60 * 60 * 1000;
    const startOfToday = new Date().setHours(0, 0, 0, 0);

    if (activeFilter === 'Today') {
      return allPhotos.filter(p => p.viewedAt >= startOfToday);
    } else if (activeFilter === 'Yesterday') {
      return allPhotos.filter(p => p.viewedAt >= startOfToday - ONE_DAY && p.viewedAt < startOfToday);
    } else {
      // Last week (anything older than yesterday for now, up to 7 days)
      return allPhotos.filter(p => p.viewedAt < startOfToday - ONE_DAY);
    }
  };

  const renderItem = ({ item }: { item: RecentPhoto }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => setSelectedImage(item.uri)}
    >
      <Image
        source={{ uri: item.uri }}
        style={styles.gridImage}
        resizeMode="cover"
      />
    </TouchableOpacity>
  );

  return (
    <LinearGradient
      colors={["#0f0c29", "#1a1446", "#0b0b1a"]}
      style={styles.container}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <BackIcon size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>Gallery</Text>
      </View>

      {/* Filters */}
      <View style={styles.filterRow}>
        {["Today", "Yesterday", "Last Week"].map((item) => (
          <TouchableOpacity
            key={item}
            onPress={() => setActiveFilter(item as FilterType)}
            style={[
              styles.filterChip,
              activeFilter === item && styles.activeChip,
            ]}
          >
            <Text
              style={[
                styles.filterText,
                activeFilter === item && styles.activeText,
              ]}
            >
              {item}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Grid */}
      <FlatList
        data={getFilteredData()}
        renderItem={renderItem}
        keyExtractor={(item) => item.uri}
        numColumns={3}
        columnWrapperStyle={styles.columnWrapper}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyText}>No recent photos found for {activeFilter.toLowerCase()}.</Text>
          </View>
        }
      />

      {/* GALLERY PREVIEW MODAL */}
      <Modal visible={!!selectedImage} transparent animationType="fade" onRequestClose={() => setSelectedImage(null)}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity
              onPress={() => setSelectedImage(null)}
              accessibilityLabel="Close image"
              accessibilityRole="button"
            >
              <Text style={styles.headerIcon}>✕</Text>
            </TouchableOpacity>
            <View style={styles.modalActions}>
              <TouchableOpacity
                onPress={() => {
                  if (selectedImage) {
                    const uri = selectedImage;
                    setSelectedImage(null);
                    navigation.navigate('SmartClipboard', { scanUri: uri });
                  }
                }}
                style={styles.actionBtn}
                accessibilityLabel="Scan image"
                accessibilityRole="button"
              >
                <Text style={styles.headerIcon}>🔍</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleEdit}
                style={styles.actionBtn}
                accessibilityLabel="Edit image"
                accessibilityRole="button"
              >
                <Text style={styles.headerIcon}>✏️</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleShare}
                accessibilityLabel="Share image"
                accessibilityRole="button"
              >
                <Text style={styles.headerIcon}>📤</Text>
              </TouchableOpacity>
            </View>
          </View>
          <ScrollView maximumZoomScale={5} contentContainerStyle={styles.scrollContainer}>
            {selectedImage && (
              <Image
                source={{ uri: selectedImage }}
                style={{ width, height: Dimensions.get('window').height * 0.8 }}
                resizeMode="contain"
              />
            )}
          </ScrollView>
        </View>
      </Modal>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 60,
  },
  gridImage: { width: '100%', height: '100%', borderRadius: 20 },
  columnWrapper: { justifyContent: "space-between" },
  listContent: { paddingBottom: 40 },
  emptyWrap: { alignItems: 'center', marginTop: 40 },
  emptyText: { color: 'rgba(255,255,255,0.4)' },
  modalActions: { flexDirection: 'row' },
  actionBtn: { marginRight: 25 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },
  title: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "600",
    marginLeft: 15,
  },
  filterRow: {
    flexDirection: "row",
    marginBottom: 25,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.08)",
    marginRight: 10,
  },
  activeChip: {
    backgroundColor: "#6C4DF6",
  },
  filterText: {
    color: "#aaa",
    fontSize: 14,
  },
  activeText: {
    color: "#fff",
    fontWeight: "600",
  },
  card: {
    width: CARD_SIZE,
    height: CARD_SIZE,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.06)",
    marginBottom: 20,
  },
  modalContainer: { flex: 1, backgroundColor: '#000' },
  modalHeader: { position: 'absolute', top: 50, left: 0, right: 0, zIndex: 10, flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20 },
  headerIcon: { color: '#FFF', fontSize: 24 },
  scrollContainer: { flexGrow: 1, justifyContent: 'center', alignItems: 'center' },
});