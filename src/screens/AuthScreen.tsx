import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform, SafeAreaView } from 'react-native';
import { Mail, Lock, Scissors, UserCheck } from 'lucide-react-native';
import { apiFetch } from '../api';

export default function AuthScreen({ onLoginSuccess }: { onLoginSuccess: (user: any) => void }) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleAuth = async () => {
    if (!email || !password) {
      setError('يرجى تعبئة جميع الحقول');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const endpoint = isLogin ? '/api/auth/login' : '/api/auth/signup';
      const body: any = { email, password };
      if (!isLogin) body.otp = '123456'; // Assuming OTP bypass logic or matching web app's mockup

      const res = await apiFetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || 'فشل تسجيل الدخول');
      onLoginSuccess(data.user);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleStartFree = async () => {
    setLoading(true);
    setError('');
    try {
       const res = await apiFetch('/api/auth/start-free', { method: 'POST' });
       const data = await res.json();
       if (!res.ok) throw new Error(data.error || 'فشل بدء الجلسة المجانية');
       onLoginSuccess(data.user);
    } catch (err: any) {
       setError(err.message);
    } finally {
       setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboardView}>
        <View style={styles.content}>
          <View style={styles.iconCircle}>
            <Scissors color="#3e81f6" size={48} />
          </View>
          <Text style={styles.title}>مرحباً بك في مُمَنْتِج AI</Text>
          <Text style={styles.subtitle}>سجل دخولك أو ابدأ تجربة مجانية الآن</Text>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <View style={styles.inputContainer}>
            <Mail color="#64748b" size={20} style={styles.inputIcon} />
            <TextInput 
              style={styles.input} 
              placeholder="البريد الإلكتروني" 
              placeholderTextColor="#64748b"
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={setEmail}
            />
          </View>

          <View style={styles.inputContainer}>
            <Lock color="#64748b" size={20} style={styles.inputIcon} />
            <TextInput 
              style={styles.input} 
              placeholder="كلمة المرور" 
              placeholderTextColor="#64748b"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />
          </View>

          <TouchableOpacity style={styles.primaryBtn} onPress={handleAuth} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>{isLogin ? 'تسجيل الدخول' : 'إنشاء حساب جديد'}</Text>}
          </TouchableOpacity>

          <TouchableOpacity onPress={() => setIsLogin(!isLogin)} style={styles.switchModeBtn}>
            <Text style={styles.switchModeText}>
              {isLogin ? 'ليس لديك حساب؟ ' : 'لديك حساب بالفعل؟ '}
              <Text style={{ color: '#3e81f6' }}>{isLogin ? 'سجل الآن' : 'سجل الدخول'}</Text>
            </Text>
          </TouchableOpacity>

          <View style={styles.divider}>
             <View style={styles.dividerLine} />
             <Text style={styles.dividerText}>أو</Text>
             <View style={styles.dividerLine} />
          </View>

          <TouchableOpacity style={styles.secondaryBtn} onPress={handleStartFree} disabled={loading}>
             <UserCheck color="#cbd5e1" size={20} style={{ marginRight: 8 }} />
             <Text style={styles.secondaryBtnText}>تجربة سريعة مجانية (بدون حساب)</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0c' },
  keyboardView: { flex: 1 },
  content: { flex: 1, justifyContent: 'center', padding: 24, alignItems: 'center' },
  iconCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(62, 129, 246, 0.15)', justifyContent: 'center', alignItems: 'center', marginBottom: 24 },
  title: { color: '#ffffff', fontSize: 24, fontWeight: 'bold', marginBottom: 8, textAlign: 'center' },
  subtitle: { color: '#94a3b8', fontSize: 14, marginBottom: 32, textAlign: 'center' },
  errorText: { color: '#ef4444', marginBottom: 16, textAlign: 'center' },
  inputContainer: { flexDirection: 'row-reverse', alignItems: 'center', backgroundColor: '#16161a', borderWidth: 1, borderColor: '#2d2d33', borderRadius: 12, marginBottom: 16, height: 55, width: '100%', paddingHorizontal: 16 },
  inputIcon: { marginLeft: 12 },
  input: { flex: 1, color: '#ffffff', fontSize: 16, textAlign: 'right' },
  primaryBtn: { backgroundColor: '#3e81f6', width: '100%', height: 55, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginTop: 8 },
  primaryBtnText: { color: '#ffffff', fontSize: 16, fontWeight: 'bold' },
  switchModeBtn: { marginTop: 16, padding: 8 },
  switchModeText: { color: '#94a3b8', fontSize: 14 },
  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 32, width: '100%' },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#2d2d33' },
  dividerText: { color: '#64748b', marginHorizontal: 16 },
  secondaryBtn: { flexDirection: 'row', backgroundColor: '#16161a', borderWidth: 1, borderColor: '#2d2d33', width: '100%', height: 55, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  secondaryBtnText: { color: '#cbd5e1', fontSize: 15, fontWeight: '600' },
});
