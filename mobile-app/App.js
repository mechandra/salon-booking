import React, { useState } from 'react';
import { Alert, Linking, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';

export default function App() {
  const [serverUrl, setServerUrl] = useState('http://localhost:3000');

  const openSalonApp = async () => {
    const url = serverUrl.trim();

    if (!url || !url.startsWith('http')) {
      Alert.alert('Invalid URL', 'Please enter a valid http:// or https:// address.');
      return;
    }

    const supported = await Linking.canOpenURL(url);
    if (!supported) {
      Alert.alert('Cannot open URL', 'This address cannot be opened. Check the URL and try again.');
      return;
    }

    Linking.openURL(url);
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Salon Booking Mobile</Text>
        <Text style={styles.subtitle}>Open the web app in your device browser.</Text>

        <View style={styles.row}>
          <Text style={styles.label}>Server URL</Text>
          <TextInput
            style={styles.input}
            value={serverUrl}
            onChangeText={setServerUrl}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            placeholder="http://192.168.x.x:3000"
          />
        </View>

        <Text style={styles.hint}>
          For a real iPhone, use your computer IP address like http://192.168.x.x:3000. For the iOS simulator, use http://localhost:3000.
        </Text>

        <TouchableOpacity style={styles.button} onPress={openSalonApp}>
          <Text style={styles.buttonText}>Open Salon App</Text>
        </TouchableOpacity>

        <Text style={styles.notice}>Make sure your backend is running with npm start in the main project folder.</Text>
      </View>
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  card: {
    width: '100%',
    maxWidth: 520,
    backgroundColor: '#f9f9f9',
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#555',
    marginBottom: 16,
  },
  row: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    color: '#333',
    marginBottom: 8,
  },
  input: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  hint: {
    fontSize: 13,
    color: '#666',
    marginBottom: 20,
  },
  button: {
    backgroundColor: '#222',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 16,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  notice: {
    fontSize: 13,
    color: '#777',
  },
});
