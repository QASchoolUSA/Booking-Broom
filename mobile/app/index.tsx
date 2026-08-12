import { Redirect } from "expo-router";
import { useConvexAuth } from "convex/react";
import { LoadingBlock } from "@/components/ui";

export default function Index() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  if (isLoading) return <LoadingBlock />;
  if (isAuthenticated) {
    return <Redirect href="/bookings" />;
  }
  return <Redirect href="/login" />;
}
