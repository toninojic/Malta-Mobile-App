import { X } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { FlatList, Image, Modal, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

type ImageItem = {
  id: string;
  url: string;
  headers?: Record<string, string>;
};

type Props = {
  images: ImageItem[];
  initialIndex: number;
  visible: boolean;
  onClose: () => void;
};

export function ImageViewerModal({ images, initialIndex, visible, onClose }: Props) {
  const { width, height } = useWindowDimensions();
  const listRef = useRef<FlatList<ImageItem>>(null);
  const [index, setIndex] = useState(initialIndex);

  useEffect(() => {
    if (visible) {
      setIndex(initialIndex);
      requestAnimationFrame(() => {
        listRef.current?.scrollToIndex({ index: initialIndex, animated: false });
      });
    }
  }, [initialIndex, visible]);

  return (
    <Modal animationType="fade" visible={visible} transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.topBar}>
          <Text style={styles.counter}>{images.length ? `${index + 1} / ${images.length}` : ''}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Close image viewer" onPress={onClose} style={styles.closeButton}>
            <X color="#FFFFFF" size={24} />
          </Pressable>
        </View>
        <FlatList
          ref={listRef}
          data={images}
          horizontal
          keyExtractor={(image) => image.id}
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          getItemLayout={(_data, itemIndex) => ({ length: width, offset: width * itemIndex, index: itemIndex })}
          onMomentumScrollEnd={(event) => {
            setIndex(Math.round(event.nativeEvent.contentOffset.x / width));
          }}
          renderItem={({ item }) => (
            <View style={[styles.slide, { width, height }]}>
              <Image source={{ uri: item.url, headers: item.headers }} style={[styles.image, { width, height: height * 0.78 }]} resizeMode="contain" />
            </View>
          )}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    backgroundColor: 'rgba(2, 6, 23, 0.96)',
    flex: 1,
  },
  topBar: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    left: 0,
    paddingHorizontal: 18,
    paddingTop: 18,
    position: 'absolute',
    right: 0,
    top: 0,
    zIndex: 2,
  },
  counter: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  closeButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.72)',
    borderRadius: 8,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  slide: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    maxWidth: '100%',
  },
});
