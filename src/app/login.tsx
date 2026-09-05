import { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { login, register } from '@/lib/auth';
import { Spacing } from '@/constants/theme';
import { Border, Font, NV, Radius } from '@/constants/nutrovia';

export default function LoginScreen() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit() {
    setError('');
    if (!email || !password || (mode === 'register' && !name)) {
      setError('Rellena todos los campos');
      return;
    }
    if (password.length < 8) {
      setError('La contraseña debe tener mínimo 8 caracteres');
      return;
    }
    setLoading(true);
    try {
      if (mode === 'register') {
        await register(name.trim(), email.trim(), password);
      } else {
        await login(email.trim(), password);
      }
      // No navegar manualmente: el Stack.Protected de _layout.tsx cambia
      // a la pantalla (tabs) automáticamente cuando loggedIn pasa a true.
    } catch (err: any) {
      setError(err.message || 'Error de conexión');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.container}>
        <View style={styles.header}>
          <Image
            source={require('@/assets/images/vytal-logo-black.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.subtitle}>
            {mode === 'login' ? 'Bienvenido de nuevo' : 'Crea tu cuenta para empezar'}
          </Text>
        </View>

        <View style={styles.form}>
          {mode === 'register' && (
            <TextInput
              style={styles.input}
              placeholder="Tu nombre"
              placeholderTextColor={NV.textoTenue}
              value={name}
              onChangeText={setName}
              autoComplete="name"
            />
          )}

          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor={NV.textoTenue}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
          />

          <TextInput
            style={styles.input}
            placeholder="Contraseña"
            placeholderTextColor={NV.textoTenue}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete={mode === 'register' ? 'new-password' : 'password'}
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable
            style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
            onPress={handleSubmit}
            disabled={loading}>
            {loading ? (
              <ActivityIndicator color={NV.papel} />
            ) : (
              <Text style={styles.buttonText}>
                {mode === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}
              </Text>
            )}
          </Pressable>

          <Pressable onPress={() => setMode(mode === 'login' ? 'register' : 'login')}>
            <Text style={styles.switchText}>
              {mode === 'login'
                ? '¿No tienes cuenta? Regístrate'
                : '¿Ya tienes cuenta? Inicia sesión'}
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: NV.papel,
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
  },
  header: {
    alignItems: 'center',
    marginBottom: Spacing.five,
  },
  logo: {
    width: 220,
    height: 220 / 4.641,
  },
  subtitle: {
    color: NV.textoSuave,
    fontFamily: Font.regular,
    marginTop: Spacing.two,
    fontSize: 15,
  },
  form: {
    gap: Spacing.three,
  },
  input: {
    backgroundColor: NV.papelAlt,
    color: NV.texto,
    fontFamily: Font.regular,
    borderRadius: Radius.none,
    paddingHorizontal: Spacing.three,
    paddingVertical: 14,
    fontSize: 16,
    borderWidth: Border.structural,
    borderColor: NV.tinta,
  },
  error: {
    color: NV.arcilla700,
    fontFamily: Font.regular,
    fontSize: 13,
  },
  button: {
    backgroundColor: NV.savia,
    borderRadius: Radius.none,
    borderWidth: Border.structural,
    borderColor: NV.savia,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: Spacing.two,
  },
  // Estado pulsado del sistema: un paso más de la rampa, no opacidad.
  buttonPressed: {
    backgroundColor: NV.savia700,
    borderColor: NV.savia700,
  },
  buttonText: {
    color: NV.papel,
    fontFamily: Font.bold,
    fontSize: 16,
    fontWeight: '700',
  },
  switchText: {
    color: NV.savia700,
    fontFamily: Font.regular,
    textAlign: 'center',
    marginTop: Spacing.two,
    fontSize: 14,
  },
});
