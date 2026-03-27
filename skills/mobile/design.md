# Mobile Design Guidelines

Document design direction in `design.md` inside the project root (fonts, colors, spacing, style) before writing UI code. Reference it throughout for consistency.

## Typography

- Use system fonts for performance, or load custom fonts via `expo-font`
- Establish clear hierarchy: titles, headings, body, captions
- Minimum touch target text: 16px body, 14px captions
- Consider Dynamic Type / font scaling accessibility

```ts
const typography = {
  title: { fontSize: 28, fontWeight: "700" },
  heading: { fontSize: 20, fontWeight: "600" },
  body: { fontSize: 16, fontWeight: "400" },
  caption: { fontSize: 14, fontWeight: "400", color: "#666" },
};
```

## Color

- Define semantic colors: primary, secondary, background, surface, text, error
- Support light and dark modes from the start
- Use `useColorScheme()` hook for theme detection
- Ensure sufficient contrast (WCAG AA minimum)

```ts
const colors = {
  light: {
    primary: "#007AFF",
    background: "#FFFFFF",
    surface: "#F2F2F7",
    text: "#000000",
    textSecondary: "#8E8E93",
  },
  dark: {
    primary: "#0A84FF",
    background: "#000000",
    surface: "#1C1C1E",
    text: "#FFFFFF",
    textSecondary: "#8E8E93",
  },
};
```

## Spacing

- Use consistent spacing scale: 4, 8, 12, 16, 24, 32, 48
- Generous padding in containers (16-24px horizontal)
- Adequate spacing between list items (12-16px)
- Safe area awareness for notches and home indicators

```ts
const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};
```

## Touch Targets

- Minimum 44x44pt touch targets (Apple HIG)
- Adequate spacing between interactive elements
- Visual feedback on press (opacity, scale, or color change)

```tsx
<Pressable
  style={({ pressed }) => [
    styles.button,
    pressed && { opacity: 0.7 }
  ]}
>
```

## Layout

- Use `SafeAreaView` for screen containers
- Flexbox for layouts (React Native default)
- ScrollView or FlatList for scrollable content
- KeyboardAvoidingView for forms

## Platform Considerations

- Respect platform conventions (iOS vs Android)
- Use platform-specific components when appropriate
- Test on both platforms regularly

```tsx
import { Platform } from "react-native";

const styles = StyleSheet.create({
  shadow: Platform.select({
    ios: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
    },
    android: {
      elevation: 4,
    },
  }),
});
```

## Animation

- Use `react-native-reanimated` for complex animations
- Keep animations subtle and purposeful (200-300ms)
- Respect reduced motion preferences
- Layout animations for list changes

## Anti-patterns

- Tiny touch targets (< 44pt)
- Text smaller than 14px
- No dark mode support
- Ignoring safe areas
- Web-like designs that don't feel native
- Overloaded screens with too much content
- Missing loading and error states
