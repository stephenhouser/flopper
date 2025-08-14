import { useCallback, useEffect, useRef, useState } from "react";
import { Animated, Easing } from "react-native";

export type FlashState = "none" | "correct" | "incorrect";

export function useFlash() {
  const heroFlashOpacity = useRef(new Animated.Value(0)).current;
  const [heroFlash, setHeroFlash] = useState<FlashState>("none");
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const triggerFlash = useCallback((isCorrect: boolean, totalMs: number) => {
    setHeroFlash(isCorrect ? "correct" : "incorrect");
    heroFlashOpacity.setValue(1);
    if (fadeTimerRef.current) { clearTimeout(fadeTimerRef.current); fadeTimerRef.current = null; }

    if (totalMs > 0) {
      const fadeStart = Math.floor(totalMs * 0.75);
      const fadeDuration = Math.max(200, totalMs - fadeStart);
      fadeTimerRef.current = setTimeout(() => {
        Animated.timing(heroFlashOpacity, { toValue: 0, duration: fadeDuration, easing: Easing.out(Easing.quad), useNativeDriver: true }).start(() => { fadeTimerRef.current = null; });
      }, fadeStart);
    } else {
      Animated.timing(heroFlashOpacity, { toValue: 0, duration: 700, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
    }
  }, [heroFlashOpacity]);

  const clearFlash = useCallback(() => {
    setHeroFlash("none");
    heroFlashOpacity.setValue(0);
    if (fadeTimerRef.current) { clearTimeout(fadeTimerRef.current); fadeTimerRef.current = null; }
  }, [heroFlashOpacity]);

  useEffect(() => () => {
    if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
  }, []);

  return { heroFlash, heroFlashOpacity, triggerFlash, clearFlash, setHeroFlash } as const;
}
