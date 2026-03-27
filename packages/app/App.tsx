import { StatusBar } from "expo-status-bar";
import { StyleSheet, Text, View, ActivityIndicator } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Providers } from "./src/components/providers";
import { api } from "./src/lib/api";

function HomeScreen() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["health"],
    queryFn: async () => {
      const res = await api.api.health.$get();
      return res.json();
    },
  });

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Sandbox Mobile</Text>
      
      {isLoading && <ActivityIndicator style={styles.loader} />}
      
      {error && (
        <Text style={styles.error}>
          Error: {error.message}
        </Text>
      )}
      
      {data && (
        <View style={styles.status}>
          <Text style={styles.statusText}>
            API Status: {data.status}
          </Text>
          <Text style={styles.timestamp}>
            {new Date(data.timestamp).toLocaleTimeString()}
          </Text>
        </View>
      )}
      
      <StatusBar style="auto" />
    </View>
  );
}

export default function App() {
  return (
    <Providers>
      <HomeScreen />
    </Providers>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    marginBottom: 24,
  },
  loader: {
    marginVertical: 16,
  },
  error: {
    color: "#dc2626",
    marginVertical: 16,
  },
  status: {
    backgroundColor: "#f0fdf4",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  statusText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#16a34a",
  },
  timestamp: {
    fontSize: 14,
    color: "#666",
    marginTop: 4,
  },
});
