import React, { useRef, useState } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Dimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import OnboardingSlide from '../atoms/OnboardingSlide';
import OnboardingDots from '../molecules/OnboardingDots';
import Button from '../atoms/Button';
import { COLORS, SPACING } from '../../constants/config';

export interface OnboardingData {
  title: string;
  subtitle?: string;
  icon: string;
  backgroundColor: string;
}

interface OnboardingCarouselProps {
  data: OnboardingData[];
  onComplete: (role: 'client' | 'professional') => void;
  onSkip: () => void;
}

const { width, height } = Dimensions.get('window');

const OnboardingCarousel: React.FC<OnboardingCarouselProps> = ({
  data,
  onComplete,
  onSkip,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / width);
    setCurrentIndex(index);
  };

  const handleNext = () => {
    if (currentIndex < data.length - 1) {
      scrollRef.current?.scrollTo({ x: width * (currentIndex + 1), animated: true });
    }
  };

  const isLastSlide = currentIndex === data.length - 1;

  return (
    <View style={styles.container}>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        style={styles.scrollView}
      >
        {data.map((item, index) => (
          <OnboardingSlide
            key={index}
            title={item.title}
            subtitle={item.subtitle}
            icon={item.icon}
            backgroundColor={item.backgroundColor}
          />
        ))}
      </ScrollView>

      {/* Skip button - only show on non-last slides */}
      {!isLastSlide && (
        <View style={styles.skipContainer}>
          <Button
            title="Omitir"
            variant="ghost"
            onPress={onSkip}
            textStyle={styles.skipText}
          />
        </View>
      )}

      {/* Navigation buttons */}
      <View style={styles.navigationContainer}>
        {isLastSlide ? (
          <View style={styles.buttonRow}>
            <Button
              title="Soy cliente"
              variant="primary"
              onPress={() => onComplete('client')}
              style={styles.actionButton}
            />
            <Button
              title="Soy profesional"
              variant="secondary"
              onPress={() => onComplete('professional')}
              style={styles.actionButton}
            />
          </View>
        ) : (
          <View style={styles.nextButtonContainer}>
            <Button
              title="Siguiente"
              variant="primary"
              onPress={handleNext}
              style={styles.nextButton}
            />
          </View>
        )}
      </View>

      {/* Dots */}
      <OnboardingDots total={data.length} current={currentIndex} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  skipContainer: {
    position: 'absolute',
    top: SPACING.xxl + 20,
    right: SPACING.md,
    zIndex: 10,
  },
  skipText: {
    color: COLORS.white,
    fontWeight: '600',
  },
  navigationContainer: {
    position: 'absolute',
    bottom: SPACING.xxl + 40,
    left: 0,
    right: 0,
    paddingHorizontal: SPACING.lg,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  actionButton: {
    flex: 1,
  },
  nextButtonContainer: {
    alignItems: 'flex-end',
  },
  nextButton: {
    width: 140,
  },
});

export default OnboardingCarousel;
