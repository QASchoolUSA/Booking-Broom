import { FlatList, type FlatListProps } from "react-native";

/**
 * FlatList wrapper used instead of FlashList in Expo Go.
 * FlashList's AutoLayoutView native view is not always available in Expo Go
 * with the New Architecture, which crashes the app on list mount.
 */
export function VirtualList<T>(props: FlatListProps<T>) {
  return <FlatList {...props} />;
}
