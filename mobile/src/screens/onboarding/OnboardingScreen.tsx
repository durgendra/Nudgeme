import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  Animated,
  FlatList,
} from 'react-native';
import { useTheme } from '../../store/ThemeContext';
import { useOnboarding } from '../../store/OnboardingContext';
import { Theme } from '../../theme';

import OnboardingSlide1 from './OnboardingSlide1';
import OnboardingSlide2 from './OnboardingSlide2';
import OnboardingSlide3 from './OnboardingSlide3';
import OnboardingSlide4 from './OnboardingSlide4';

const { width } = Dimensions.get('window');

const slides = [
  { id: '1', component: OnboardingSlide1 },
  { id: '2', component: OnboardingSlide2 },
  { id: '3', component: OnboardingSlide3 },
  { id: '4', component: OnboardingSlide4 },
];

const OnboardingScreen: React.FC = () => {
  const { theme } = useTheme();
  const { completeOnboarding } = useOnboarding();
  const styles = createStyles(theme);
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);
  const scrollX = useRef(new Animated.Value(0)).current;

  const viewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems[0]) {
      setCurrentIndex(viewableItems[0].index);
    }
  }).current;

  const viewConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;

  const scrollToNext = () => {
    if (currentIndex < slides.length - 1) {
      flatListRef.current?.scrollToIndex({ index: currentIndex + 1 });
    }
  };

  const scrollToPrev = () => {
    if (currentIndex > 0) {
      flatListRef.current?.scrollToIndex({ index: currentIndex - 1 });
    }
  };

  const handleSkip = async () => {
    // Complete onboarding - navigation will automatically switch to Auth stack
    await completeOnboarding();
  };

  const handleSignUp = async () => {
    // Complete onboarding - navigation will automatically switch to Auth stack
    await completeOnboarding();
    // Note: For now, both buttons go to Auth. 
    // The Register vs Login distinction can be handled via navigation params if needed.
  };

  const handleSignIn = async () => {
    // Complete onboarding - navigation will automatically switch to Auth stack
    await completeOnboarding();
  };

  const isLastSlide = currentIndex === slides.length - 1;

  return (
    <View style={styles.container}>
      {/* Skip Button */}
      {!isLastSlide && (
        <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
          <Text style={styles.skipButtonText}>Skip</Text>
        </TouchableOpacity>
      )}

      {/* Slides */}
      <FlatList
        data={slides}
        ref={flatListRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        bounces={false}
        renderItem={({ item }) => {
          // Explicitly render OnboardingSlide4 with its required props
          if (item.id === '4') {
            return (
              <View style={{ width }}>
                <OnboardingSlide4 onSignUp={handleSignUp} onSignIn={handleSignIn} />
              </View>
            );
          }
          const SlideComponent = item.component;
          return (
            <View style={{ width }}>
              <SlideComponent />
            </View>
          );
        }}
        keyExtractor={(item) => item.id}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          { useNativeDriver: false }
        )}
        onViewableItemsChanged={viewableItemsChanged}
        viewabilityConfig={viewConfig}
      />

      {/* Bottom Container - Hidden on last slide since OnboardingSlide4 has its own CTA buttons */}
      {!isLastSlide && (
        <View style={styles.bottomContainer}>
          {/* Pagination */}
          <View style={styles.paginationContainer}>
            {slides.map((_, index) => {
              const inputRange = [
                (index - 1) * width,
                index * width,
                (index + 1) * width,
              ];

              const dotWidth = scrollX.interpolate({
                inputRange,
                outputRange: [8, 24, 8],
                extrapolate: 'clamp',
              });

              const opacity = scrollX.interpolate({
                inputRange,
                outputRange: [0.3, 1, 0.3],
                extrapolate: 'clamp',
              });

              return (
                <Animated.View
                  key={index}
                  style={[
                    styles.paginationDot,
                    {
                      width: dotWidth,
                      opacity,
                      backgroundColor: theme.colors.primary,
                    },
                  ]}
                />
              );
            })}
          </View>

          {/* Navigation Buttons */}
          <View style={styles.navigationButtons}>
            <TouchableOpacity
              style={[styles.navButton, currentIndex === 0 && styles.navButtonDisabled]}
              onPress={scrollToPrev}
              disabled={currentIndex === 0}
            >
              <Text style={[styles.navButtonText, currentIndex === 0 && styles.navButtonTextDisabled]}>
                Previous
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.nextButton} onPress={scrollToNext}>
              <Text style={styles.nextButtonText}>Next</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
};

const createStyles = (theme: Theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  skipButton: {
    position: 'absolute',
    top: 50,
    right: 24,
    zIndex: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  skipButtonText: {
    color: theme.colors.textSecondary,
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
  },
  bottomContainer: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  paginationContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  paginationDot: {
    height: 8,
    borderRadius: 4,
    marginHorizontal: 4,
  },
  navigationButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  navButton: {
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  navButtonDisabled: {
    opacity: 0.3,
  },
  navButtonText: {
    color: theme.colors.textSecondary,
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
  },
  navButtonTextDisabled: {
    color: theme.colors.textMuted,
  },
  nextButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.button,
    paddingHorizontal: 32,
    paddingVertical: 14,
    ...theme.shadows.button,
  },
  nextButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'Inter-Bold',
  },
});

export default OnboardingScreen;
