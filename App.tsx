// @ts-nocheck
import { StatusBar } from 'expo-status-bar';
import React, { useState, useEffect, useRef, Component, ErrorInfo, ReactNode } from 'react';
import { StyleSheet, Platform, View, Text, ActivityIndicator, TouchableOpacity, BackHandler, ScrollView } from 'react-native';
import { WebView } from 'react-native-webview';
import NetInfo from '@react-native-community/netinfo';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error, errorInfo: null };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({ errorInfo });
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.offlineContainer}>
          <ScrollView contentContainerStyle={{ padding: 20 }}>
            <Text style={{ color: 'red', fontSize: 18, fontWeight: 'bold' }}>App Crashed!</Text>
            <Text style={{ color: 'white', marginTop: 10 }}>{this.state.error?.toString()}</Text>
            <Text style={{ color: 'gray', marginTop: 10, fontSize: 12 }}>{this.state.errorInfo?.componentStack}</Text>
          </ScrollView>
        </View>
      );
    }
    return this.props.children;
  }
}

function MainApp() {
  const [isConnected, setIsConnected] = useState<boolean | null>(true);
  const [canGoBack, setCanGoBack] = useState(false);
  const webViewRef = useRef<WebView>(null);
  
  const baseAppUrl = 'https://www.mumantij-ai.com/';
  // Append a query param so the web app can behave accordingly 
  // (e.g. conditionally hiding payment buttons based on remote config)
  const appUrl = `${baseAppUrl}?platform=native_mobile`;

  useEffect(() => {
    // Monitor internet connection state
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsConnected(state.isConnected);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    // Handle Android hardware back button
    const backAction = () => {
      if (canGoBack && webViewRef.current) {
        webViewRef.current.goBack();
        return true;
      }
      return false;
    };

    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
    return () => backHandler.remove();
  }, [canGoBack]);

  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && window.location.port === '8081') {
       window.location.port = '3000';
    }
  }

  // Native Offline Screen
  if (isConnected === false) {
    return (
      <View style={styles.offlineContainer}>
        <Text style={styles.offlineTitle}>No Internet Connection</Text>
        <Text style={styles.offlineText}>Please check your network settings and try again.</Text>
        <TouchableOpacity 
          style={styles.retryButton} 
          onPress={() => NetInfo.fetch().then(state => setIsConnected(state.isConnected))}
        >
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
        <StatusBar style="light" />
      </SafeAreaView>
    );
  }

  const injectedJS = `
    window.onerror = function(message, source, lineno, colno, error) {
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'error', message: message, source: source, lineno: lineno, colno: colno }));
    };
    window.addEventListener('unhandledrejection', function(event) {
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'promise_error', message: event.reason }));
    });
    const originalConsoleError = console.error;
    console.error = function(...args) {
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'console_error', message: args.join(' ') }));
      originalConsoleError.apply(console, args);
    };
    true;
  `;

  return (
    <View style={styles.container}>
      <WebView 
        ref={webViewRef}
        source={{ uri: appUrl }} 
        style={styles.webview}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        originWhitelist={['*']}
        mixedContentMode="always"
        incognito={false}
        opaque={false}
        backgroundColor="#16161a"
        injectedJavaScriptBeforeContentLoaded={injectedJS}
        injectedJavaScript={injectedJS}
        onMessage={(event) => {
          try {
            const data = JSON.parse(event.nativeEvent.data);
            if (data.type === 'error' || data.type === 'promise_error' || data.type === 'console_error') {
              console.warn("Web JS Error: ", data);
              alert("Web Error: " + data.message + (data.lineno ? ' at line ' + data.lineno : ''));
            }
          } catch(e) {}
        }}
        allowsInlineMediaPlayback={true}
        mediaPlaybackRequiresUserAction={false}
        allowsBackForwardNavigationGestures={true} // iOS swipe to go back
        pullToRefreshEnabled={true} // Add native pull to refresh
        bounces={true} // Give native bounce effect on scroll
        onNavigationStateChange={(navState) => setCanGoBack(navState.canGoBack)}
        onError={(syntheticEvent) => {
          const { nativeEvent } = syntheticEvent;
          console.warn('WebView error: ', nativeEvent);
          alert(`WebView error: ${nativeEvent.description} (${nativeEvent.code})`);
        }}
        onHttpError={(syntheticEvent) => {
          const { nativeEvent } = syntheticEvent;
          console.warn('WebView HTTP error: ', nativeEvent);
          alert(`WebView HTTP error: ${nativeEvent.statusCode} for url ${nativeEvent.url}`);
        }}
        startInLoadingState={true}
        renderLoading={() => (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#4F46E5" />
            <Text style={{color: 'white', marginTop: 10}}>Loading Web App...</Text>
          </View>
        )}
      />
      <StatusBar style="light" />
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <MainApp />
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  webview: {
    flex: 1,
    backgroundColor: '#16161a',
  },
  loadingContainer: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#16161a',
  },
  offlineContainer: {
    flex: 1,
    backgroundColor: '#16161a',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  offlineTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 10,
  },
  offlineText: {
    fontSize: 16,
    color: '#a1a1aa',
    textAlign: 'center',
    marginBottom: 30,
  },
  retryButton: {
    backgroundColor: '#4F46E5',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

