import { forwardRef } from "react";
import { FlatList, type FlatListProps } from "react-native";

/**
 * FlatList wrapper used instead of FlashList in Expo Go.
 * FlashList's AutoLayoutView native view is not always available in Expo Go
 * with the New Architecture, which crashes the app on list mount.
 */
export const VirtualList = forwardRef(function VirtualList<T>(
  props: FlatListProps<T>,
  ref: React.ForwardedRef<FlatList<T>>
) {
  return <FlatList ref={ref} {...props} />;
}) as <T>(
  props: FlatListProps<T> & { ref?: React.Ref<FlatList<T>> }
) => React.ReactElement;
