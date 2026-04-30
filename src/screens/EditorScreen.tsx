import { StatusBar } from 'expo-status-bar';
import React, { useState, useRef, useEffect } from 'react';
import { 
  StyleSheet, Text, View, TouchableOpacity, SafeAreaView, Dimensions, FlatList,
  ActivityIndicator, Modal, TextInput, Platform, Animated, Easing, KeyboardAvoidingView, ScrollView, Switch
} from 'react-native';
import Slider from '@react-native-community/slider';
import { Video, ResizeMode } from 'expo-av';
import * as DocumentPicker from 'expo-document-picker';
import * as Haptics from 'expo-haptics';
import { 
  Upload, Play, Pause, Languages, Settings, Download, 
  ChevronLeft, Type, Crown, Edit3, Scissors, LogOut, X, AlertCircle, Wand2, RefreshCcw, Video as VideoIcon
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { getApiUrl, apiFetch } from '../api';

const { width, height } = Dimensions.get('window');

// --- Types ---
interface Captions {
  id: string;
  word: string;
  start: number;
  end: number;
}

const CAPTION_TEMPLATES = [
  {
    id: "hormozi",
    name: "هورموزي - ذكي",
    color: '#00FFFF',
    defaults: { textColor: "#00FFFF", bgColor: "#000000", fontSize: 62, hasBackground: false, fontWeight: "900", strokeColor: "#000000", strokeSize: 4, hasStroke: true, shadowColor: "#000000", shadowSize: 2, hasShadow: true }
  },
  {
    id: "ali-abdaal",
    name: "علي عبدال - أنيق",
    color: '#FFFFFF',
    defaults: { textColor: "#FFFFFF", bgColor: "#000000", fontSize: 45, hasBackground: false, fontWeight: "400", strokeColor: "#000000", strokeSize: 1, hasStroke: false, shadowColor: "#000000", shadowSize: 1, hasShadow: true }
  },
  {
    id: "bento",
    name: "بينتو - عصري",
    color: '#A855F7',
    defaults: { textColor: "#FFFFFF", bgColor: "#A855F7", fontSize: 40, hasBackground: true, fontWeight: "700", strokeColor: "#000000", strokeSize: 2, hasStroke: false, shadowColor: "#000000", shadowSize: 0, hasShadow: false }
  },
  {
    id: "tiktok",
    name: "تيك توك",
    color: '#ffffff',
    defaults: { textColor: "#FFFFFF", bgColor: "#000000", fontSize: 45, hasBackground: true, fontWeight: "700", strokeColor: "#000000", strokeSize: 0, hasStroke: false, shadowColor: "#000000", shadowSize: 0, hasShadow: false, bgOpacity: 60 }
  },
  {
    id: "cinematic",
    name: "سينمائي",
    color: '#facc15',
    defaults: { textColor: "#E2E8F0", bgColor: "#000000", fontSize: 28, hasBackground: false, fontWeight: "400", strokeColor: "#000000", strokeSize: 1, hasStroke: true, shadowColor: "#000000", shadowSize: 1, hasShadow: true }
  }
];

export default function EditorScreen({ user, onLogout }: { user: any, onLogout: () => void }) {
  const [videoUri, setVideoUri] = useState<string | null>(null);
  const [currentVideoAsset, setCurrentVideoAsset] = useState<any>(null);
  const [pendingVideoUri, setPendingVideoUri] = useState<string | null>(null);
  const [pendingVideoAsset, setPendingVideoAsset] = useState<any>(null);
  const [showSetupModal, setShowSetupModal] = useState(false);
  const [transcribeLanguage, setTranscribeLanguage] = useState('auto');
  const [wordsPerSegment, setWordsPerSegment] = useState('3'); // Default to 3 for better readability
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingText, setLoadingText] = useState('');
  const [captions, setCaptions] = useState<Captions[]>([]);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(1);
  const [activeTab, setActiveTab] = useState<'captions' | 'style' | 'export'>('captions');
  
  // Styling state
  const [textColor, setTextColor] = useState('#FFFFFF');
  const [fontSize, setFontSize] = useState(62);
  const [fontWeight, setFontWeight] = useState('900');
  
  const [hasBackground, setHasBackground] = useState(false);
  const [bgColor, setBgColor] = useState('#000000');
  const [bgOpacity, setBgOpacity] = useState(100);
  
  const [hasStroke, setHasStroke] = useState(true);
  const [strokeColor, setStrokeColor] = useState('#000000');
  const [strokeSize, setStrokeSize] = useState(4);
  
  const [hasShadow, setHasShadow] = useState(true);
  const [shadowColor, setShadowColor] = useState('#000000');
  const [shadowSize, setShadowSize] = useState(2);
  const [shadowOpacity, setShadowOpacity] = useState(80);

  const [selectedStyleId, setSelectedStyleId] = useState('hormozi');

  
  const videoRef = useRef<Video>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
      easing: Easing.out(Easing.exp)
    }).start();
  }, []);

  const handlePickVideo = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const result = await DocumentPicker.getDocumentAsync({
        type: 'video/*',
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets.length > 0) {
        const asset = result.assets[0];
        setPendingVideoAsset(asset);
        setPendingVideoUri(asset.uri);
        setShowSetupModal(true);
      }
    } catch (e) {
      console.log('Error picking video:', e);
    }
  };

  const startTranscription = async () => {
    if (!pendingVideoAsset) return;
    
    setShowSetupModal(false);
    setIsLoading(true);
    setLoadingText('جاري تحليل الفيديو واستخراج النص...');
    setVideoUri(pendingVideoUri);
    setCurrentVideoAsset(pendingVideoAsset);
    
    try {
      const formData = new FormData();
      if (Platform.OS === 'web' && pendingVideoAsset.file) {
        formData.append('media', pendingVideoAsset.file);
      } else if (Platform.OS === 'web') {
        const res = await fetch(pendingVideoAsset.uri);
        const blob = await res.blob();
        formData.append('media', blob, pendingVideoAsset.name || 'upload.mp4');
      } else {
        formData.append('media', {
          uri: pendingVideoAsset.uri,
          type: pendingVideoAsset.mimeType || 'video/mp4',
          name: pendingVideoAsset.name || 'upload.mp4',
        } as any);
      }
      formData.append('language', transcribeLanguage);
      formData.append('maxWordsPerSegment', wordsPerSegment);

      const response = await apiFetch(`/api/transcribe-form`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      const generatedCaptions = await response.json();
      const formattedCaptions: Captions[] = generatedCaptions.map((seg: any) => ({
        id: seg.id || Math.random().toString(),
        word: seg.text || '', 
        start: seg.start,
        end: seg.end,
      }));
      
      setCaptions(formattedCaptions);
      setIsLoading(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (apiError) {
      console.error("Transcription Failed:", apiError);
      setVideoUri(null);
      setCaptions([]);
      setIsLoading(false);
      alert("تعذر تفريغ الفيديو. يرجى المحاولة مرة أخرى لاحقاً.\n" + String(apiError));
    }
  };

  const handleExport = async () => {
    if (!captions.length || !videoUri) return;
    setIsLoading(true);
    setLoadingText('جاري تصدير الفيديو...');
    try {
      let srtContent = '';
      captions.forEach((c, index) => {
        const start = formatTime(c.start);
        const end = formatTime(c.end);
        srtContent += `${index + 1}\n${start} --> ${end}\n${c.word}\n\n`;
      });

      const styleObj = CAPTION_STYLES.find(s => s.id === selectedStyleId);

      const formData = new FormData();
      if (Platform.OS === 'web' && currentVideoAsset?.file) {
        formData.append('video', currentVideoAsset.file);
      } else if (Platform.OS === 'web') {
        const res = await fetch(videoUri);
        const blob = await res.blob();
        formData.append('video', blob, currentVideoAsset?.name || 'export.mp4');
      } else {
        formData.append('video', {
          uri: videoUri,
          type: currentVideoAsset?.mimeType || 'video/mp4',
          name: currentVideoAsset?.name || 'export.mp4',
        } as any);
      }
      formData.append('srtContent', srtContent);
      formData.append('isAss', 'true');
      formData.append('assStyle', buildAssStyle());
      
      const response = await apiFetch(`/api/export-video`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error(await response.text());
      const { jobId } = await response.json();
      
      let attempts = 0;
      const poll = setInterval(async () => {
        attempts++;
        try {
          const statusRes = await apiFetch(`/api/export-status/${jobId}`);
          const statusData = await statusRes.json();
          if (statusData.status === 'completed') {
            clearInterval(poll);
            setIsLoading(false);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            alert("تم التصدير بنجاح! يمكن تحميله من الخادم."); // Note: Real saving to device can be added with expo-file-system and expo-media-library
          } else if (statusData.status === 'failed') {
            clearInterval(poll);
            setIsLoading(false);
            alert("فشل التصدير: " + statusData.error);
          }
        } catch (e) {
          if (attempts > 20) {
            clearInterval(poll);
            setIsLoading(false);
            alert("انتهى وقت انتظار التصدير.");
          }
        }
      }, 3000);

    } catch (e) {
      setIsLoading(false);
      alert("فشل بدء التصدير: " + String(e));
    }
  };

  const formatTime = (seconds: number) => {
    const d = new Date(0);
    d.setUTCMilliseconds(seconds * 1000);
    return d.toISOString().substr(11, 12).replace('.', ',');
  };

  const togglePlayback = () => {
    if (isPlaying) {
      videoRef.current?.pauseAsync();
    } else {
      videoRef.current?.playAsync();
    }
    setIsPlaying(!isPlaying);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleTranslate = async () => {
    if (!captions.length) return;
    setIsLoading(true);
    setLoadingText('جاري الترجمة باستخدام DeepSeek...');
    try {
      const response = await apiFetch(`/api/translate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          captions: captions.map(c => ({ word: c.word, text: c.word, start: c.start, end: c.end, words: [] })),
          targetLanguage: 'en'
        })
      });

      if (!response.ok) throw new Error(await response.text());
      const translated = await response.json();
      
      setCaptions(translated.map((c: any) => ({
        id: Math.random().toString(),
        word: c.word || c.text,
        start: c.start,
        end: c.end
      })));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setActiveTab('captions');
    } catch (e) {
      alert("فشل الترجمة: " + String(e));
    } finally {
      setIsLoading(false);
    }
  };

  const doLogout = async () => {
     try {
       await apiFetch('/api/auth/logout', { method: 'POST' });
       onLogout();
     } catch (e) {
       onLogout();
     }
  };

  const renderWelcome = () => (
    <SafeAreaView style={styles.container}>
      <Animated.View style={[styles.welcomeWrapper, { opacity: fadeAnim, transform: [{ scale: fadeAnim.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) }] }]}>
        <View style={styles.topProfileBar}>
           <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
             <Text style={styles.userText}>{user?.isAnonymous ? 'حساب مجاني' : user?.email}</Text>
             {user?.tokens !== undefined && (
               <View style={styles.tokenBadge}>
                 <Crown color="#facc15" size={14} />
                 <Text style={styles.tokenText}>{user.tokens} عملة</Text>
               </View>
             )}
           </View>
           <TouchableOpacity onPress={doLogout} style={styles.logoutBtn}>
              <LogOut color="#ef4444" size={20} />
           </TouchableOpacity>
        </View>
        <View style={{flex:1, justifyContent: 'center', alignItems: 'center'}}>
          <View style={styles.iconCircle}>
            <Scissors color="#3e81f6" size={48} />
          </View>
          <Text style={styles.title}>مُمَنْتِج AI</Text>
          <Text style={styles.subtitle}>الاستوديو الاحترافي في جيبك. ولّد الكابشنز، ترجم الفيديوهات وأكثر.</Text>
          
          <TouchableOpacity onPress={handlePickVideo}>
            <LinearGradient colors={['#3e81f6', '#2563eb']} style={styles.uploadButton}>
              <Upload color="#fff" size={24} style={{ marginLeft: 10 }} />
              <Text style={styles.uploadButtonText}>اختر فيديو للبدء</Text>
            </LinearGradient>
          </TouchableOpacity>
          
          <View style={styles.features}>
            <View style={styles.featureItem}>
              <Type color="#94a3b8" size={20} />
              <Text style={styles.featureText}>كابشن تلقائي</Text>
            </View>
            <View style={styles.featureItem}>
              <Languages color="#94a3b8" size={20} />
              <Text style={styles.featureText}>ترجمة ذكية</Text>
            </View>
            <View style={styles.featureItem}>
              <Crown color="#facc15" size={20} />
              <Text style={styles.featureText}>جودة سينمائية</Text>
            </View>
          </View>
        </View>
      </Animated.View>
      
      {/* Setup Modal */}
      <Modal visible={showSetupModal} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setShowSetupModal(false)}>
                <X color="#64748b" size={24} />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>إعدادات الفيديو</Text>
              <View style={{ width: 24 }} />
            </View>

            <ScrollView contentContainerStyle={{ paddingVertical: 16 }}>
              <Text style={styles.modalLabel}>اختر لغة الفيديو المرفوع:</Text>
              <View style={styles.radioGroup}>
                {[ { id: 'auto', name: 'تلقائي (ذكاء اصطناعي)' }, { id: 'ar', name: 'العربية' }, { id: 'en', name: 'الإنجليزية' }].map(lang => (
                  <TouchableOpacity 
                    key={lang.id} 
                    style={[styles.radioOption, transcribeLanguage === lang.id && styles.radioOptionActive]}
                    onPress={() => setTranscribeLanguage(lang.id)}
                  >
                    <Text style={[styles.radioText, transcribeLanguage === lang.id && styles.radioTextActive]}>{lang.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.modalLabel}>متوسط عدد الكلمات في السطر:</Text>
              <View style={styles.radioGroup}>
                {['1', '3', '5', '8'].map(num => (
                  <TouchableOpacity 
                    key={num} 
                    style={[styles.radioOption, wordsPerSegment === num && styles.radioOptionActive]}
                    onPress={() => setWordsPerSegment(num)}
                  >
                    <Text style={[styles.radioText, wordsPerSegment === num && styles.radioTextActive]}>{num} كلمات</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.infoBox}>
                 <AlertCircle color="#3b82f6" size={20} style={{ marginRight: 8 }} />
                 <Text style={styles.infoBoxText}>يمكنك ترجمة النص إلى أي لغة أخرى بعد استخراج النص الأصلي.</Text>
              </View>

            </ScrollView>

            <TouchableOpacity onPress={startTranscription}>
              <LinearGradient colors={['#3e81f6', '#2563eb']} style={styles.primaryBtn}>
                <Text style={styles.primaryBtnText}>ابدأ المعالجة 🚀</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <StatusBar style="light" />
    </SafeAreaView>
  );

  const renderLoading = () => (
    <SafeAreaView style={[styles.container, styles.centerAll]}>
      <ActivityIndicator size="large" color="#3e81f6" />
      <Text style={styles.loadingText}>{loadingText || 'جاري المعالجة...'}</Text>
    </SafeAreaView>
  );

  const hexToAssColor = (hex: string, opacity: number = 100) => {
    let cleanHex = hex.replace('#', '');
    if (cleanHex.length === 3) cleanHex = cleanHex.split('').map(c => c + c).join('');
    const r = cleanHex.substring(0, 2).toUpperCase();
    const g = cleanHex.substring(2, 4).toUpperCase();
    const b = cleanHex.substring(4, 6).toUpperCase();
    const a = Math.round((100 - opacity) * 2.55).toString(16).padStart(2, '0').toUpperCase();
    return `&H${a}${b}${g}${r}`;
  };

  const buildAssStyle = () => {
    const primary = hexToAssColor(textColor, 100);
    const outlineCol = hasStroke ? hexToAssColor(strokeColor, 100) : '&H00000000';
    const shadowCol = hasShadow ? hexToAssColor(shadowColor, shadowOpacity) : '&H00000000';
    const backCol = hasBackground ? hexToAssColor(bgColor, bgOpacity) : '&H00000000';
    
    const borderStyle = hasBackground ? 3 : 1;
    
    return `FontSize=${fontSize},PrimaryColour=${primary},OutlineColour=${outlineCol},BackColour=${backCol},ShadowColour=${shadowCol},BorderStyle=${borderStyle},Outline=${hasStroke ? strokeSize : 0},Shadow=${hasShadow ? shadowSize : 0},Bold=${fontWeight === '400' ? 0 : 1},MarginV=40`;
  };

  const hexToRgba = (hex: string, opacity: number) => {
    let cleanHex = hex.replace('#', '');
    if (cleanHex.length === 3) cleanHex = cleanHex.split('').map(c => c + c).join('');
    const r = parseInt(cleanHex.substring(0, 2), 16);
    const g = parseInt(cleanHex.substring(2, 4), 16);
    const b = parseInt(cleanHex.substring(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity / 100})`;
  };

  const getDynamicContainerStyle = (): any => {
    if (hasBackground) {
      return {
        backgroundColor: hexToRgba(bgColor, bgOpacity),
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 8,
      };
    }
    return { backgroundColor: 'transparent' };
  };

  const getDynamicTextStyle = (): any => {
    return {
      color: textColor,
      fontSize: fontSize / 1.5,
      fontWeight: fontWeight as any,
      textShadowColor: hasShadow ? hexToRgba(shadowColor, shadowOpacity) : 'transparent',
      textShadowOffset: { width: hasShadow ? shadowSize : 0, height: hasShadow ? shadowSize : 0 },
      textShadowRadius: hasShadow ? 2 : 0,
    };
  };

  const applyTemplate = (tmpl: any) => {
    setSelectedStyleId(tmpl.id);
    const d = tmpl.defaults;
    setTextColor(d.textColor);
    setBgColor(d.bgColor);
    setFontSize(d.fontSize);
    setHasBackground(d.hasBackground);
    setFontWeight(d.fontWeight || '700');
    setStrokeColor(d.strokeColor);
    setStrokeSize(d.strokeSize);
    setHasStroke(d.hasStroke);
    setShadowColor(d.shadowColor);
    setShadowSize(d.shadowSize);
    setHasShadow(d.hasShadow);
    if (d.bgOpacity !== undefined) setBgOpacity(d.bgOpacity);
    else setBgOpacity(100);
  };

  const renderEditor = () => {
    const activeCaption = captions.find(c => currentTime >= c.start && currentTime <= c.end);
    
    return (
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.headerIconBtn} onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setVideoUri(null);
          }}>
            <ChevronLeft color="#fff" size={24} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>تعديل الفيديو</Text>
          </View>
          <TouchableOpacity onPress={handleExport}>
            <LinearGradient colors={['#3e81f6', '#2563eb']} style={styles.exportBtnHeader}>
              <Download color="#fff" size={16} />
              <Text style={styles.exportBtnText}>تصدير</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* Video Player */}
        <View style={styles.videoRegion}>
          <View style={styles.videoContainer}>
            <Video
              ref={videoRef}
              source={{ uri: videoUri! }}
              style={styles.video}
              resizeMode={ResizeMode.CONTAIN}
              onPlaybackStatusUpdate={(status) => {
                if (status.isLoaded) {
                  setCurrentTime(status.positionMillis / 1000);
                  setDuration((status.durationMillis || 1) / 1000);
                  setIsPlaying(status.isPlaying);
                }
              }}
            />
            {/* Overlay Active Caption */}
            {activeCaption && (
              <View style={[styles.captionOverlay, getDynamicContainerStyle()]}>
                <Text style={[styles.captionOverlayText, getDynamicTextStyle()]}>
                  {activeCaption.word}
                </Text>
              </View>
            )}

            <TouchableOpacity style={styles.playPauseOverlay} onPress={togglePlayback} activeOpacity={0.9}>
              {!isPlaying && (
                <View style={styles.playIconBg}>
                  <Play color="#fff" size={36} fill="#fff" style={{ marginLeft: 4 }} />
                </View>
              )}
            </TouchableOpacity>
          </View>
          
          {/* Scrubber */}
          <View style={styles.scrubberWrapper}>
            <Text style={styles.timeText}>{formatTime(currentTime).substr(3, 5)}</Text>
            <View style={styles.scrubberTrack}>
               <View style={[styles.scrubberFill, { width: `${(currentTime / duration) * 100}%` }]} />
            </View>
            <Text style={styles.timeText}>{formatTime(duration).substr(3, 5)}</Text>
          </View>
        </View>

        {/* Tabs */}
        <View style={styles.tabsContainer}>
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'captions' && styles.activeTab]} 
            onPress={() => setActiveTab('captions')}
          >
            <Type color={activeTab === 'captions' ? "#3e81f6" : "#64748b"} size={20} />
            <Text style={[styles.tabText, activeTab === 'captions' && styles.activeTabText]}>النصوص</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'style' && styles.activeTab]} 
            onPress={() => setActiveTab('style')}
          >
            <Wand2 color={activeTab === 'style' ? "#a855f7" : "#64748b"} size={20} />
            <Text style={[styles.tabText, activeTab === 'style' && { color: '#a855f7' }]}>التصميم</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'export' && styles.activeTab]} 
            onPress={() => setActiveTab('export')}
          >
            <Languages color={activeTab === 'export' ? "#10b981" : "#64748b"} size={20} />
            <Text style={[styles.tabText, activeTab === 'export' && { color: '#10b981' }]}>ترجمة</Text>
          </TouchableOpacity>
        </View>

        {/* Captions List (Bottom area) */}
        <View style={styles.bottomArea}>
          {activeTab === 'captions' && (
            <FlatList
              data={captions}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.captionsList}
              renderItem={({ item }) => {
                const isActive = currentTime >= item.start && currentTime <= item.end;
                return (
                  <TouchableOpacity 
                    style={[styles.captionItem, isActive && styles.captionItemActive]}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      videoRef.current?.setPositionAsync(item.start * 1000);
                    }}
                  >
                    <View style={styles.captionTimeRow}>
                      <Text style={styles.captionTime}>{item.start.toFixed(1)}s</Text>
                    </View>
                    <TextInput 
                      style={[styles.captionInput, isActive && styles.captionInputActive]} 
                      defaultValue={item.word}
                      placeholderTextColor="#64748b"
                      onChangeText={(newText) => {
                         setCaptions(prev => prev.map(c => c.id === item.id ? { ...c, word: newText } : c));
                      }}
                    />
                    <TouchableOpacity style={styles.editBtn}>
                      <Edit3 color={isActive ? "#3e81f6" : "#64748b"} size={18} />
                    </TouchableOpacity>
                  </TouchableOpacity>
                );
              }}
            />
          )}

          {activeTab === 'style' && (
            <ScrollView style={styles.styleContainer} contentContainerStyle={{ paddingBottom: 100 }}>
              <Text style={styles.sectionTitle}>القوالب الجاهزة</Text>
              <View style={styles.templatesGrid}>
                {CAPTION_TEMPLATES.map((tmpl) => (
                  <TouchableOpacity 
                    key={tmpl.id} 
                    style={[styles.templateCard, selectedStyleId === tmpl.id && styles.templateCardActive, { borderColor: selectedStyleId === tmpl.id ? tmpl.color : '#2d2d33' }]}
                    onPress={() => applyTemplate(tmpl)}
                  >
                    <Text style={[styles.templateName, selectedStyleId === tmpl.id && { color: tmpl.color }]}>{tmpl.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Typography */}
              <View style={styles.controlGroup}>
                <Text style={styles.groupTitle}>الخطوط والنص</Text>
                
                <View style={styles.sliderHeader}>
                  <Text style={styles.controlLabel}>حجم الخط</Text>
                  <Text style={styles.controlValue}>{fontSize}px</Text>
                </View>
                <Slider style={styles.slider} minimumValue={16} maximumValue={120} value={fontSize} onValueChange={(v) => setFontSize(Math.round(v))} minimumTrackTintColor="#a855f7" maximumTrackTintColor="#2d2d33" thumbTintColor="#a855f7" />

                <View style={styles.controlRow}>
                  <Text style={styles.controlLabel}>لون النص</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.colorPalette}>
                    {['#FFFFFF', '#000000', '#00FFFF', '#A855F7', '#facc15', '#f43f5e', '#22c55e', '#3b82f6'].map(c => (
                      <TouchableOpacity key={c} style={[styles.colorSwatch, { backgroundColor: c }, textColor === c && styles.colorSwatchActive]} onPress={() => setTextColor(c)} />
                    ))}
                  </ScrollView>
                </View>
              </View>

              {/* Background */}
              <View style={styles.controlGroup}>
                <View style={styles.toggleRow}>
                  <Text style={styles.groupTitle}>لون الخلفية</Text>
                  <Switch value={hasBackground} onValueChange={(val) => {
                    setHasBackground(val);
                    if (val) setHasStroke(false);
                  }} trackColor={{ false: '#2d2d33', true: '#a855f7' }} />
                </View>
                
                {hasBackground && (
                  <>
                    <View style={styles.controlRow}>
                      <Text style={styles.controlLabel}>اللون</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.colorPalette}>
                        {['#000000', '#FFFFFF', '#A855F7', '#00FFFF', '#f43f5e', '#3b82f6'].map(c => (
                          <TouchableOpacity key={c} style={[styles.colorSwatch, { backgroundColor: c }, bgColor === c && styles.colorSwatchActive]} onPress={() => setBgColor(c)} />
                        ))}
                      </ScrollView>
                    </View>
                    <View style={styles.sliderHeader}>
                      <Text style={styles.controlLabel}>الشفافية</Text>
                      <Text style={styles.controlValue}>{bgOpacity}%</Text>
                    </View>
                    <Slider style={styles.slider} minimumValue={0} maximumValue={100} value={bgOpacity} onValueChange={(v) => setBgOpacity(Math.round(v))} minimumTrackTintColor="#a855f7" maximumTrackTintColor="#2d2d33" thumbTintColor="#a855f7" />
                  </>
                )}
              </View>

              {/* Stroke */}
              <View style={styles.controlGroup}>
                <View style={styles.toggleRow}>
                  <Text style={styles.groupTitle}>الإطار</Text>
                  <Switch value={hasStroke} onValueChange={(val) => {
                    setHasStroke(val);
                    if (val) setHasBackground(false);
                  }} trackColor={{ false: '#2d2d33', true: '#a855f7' }} />
                </View>
                
                {hasStroke && (
                  <>
                    <View style={styles.controlRow}>
                      <Text style={styles.controlLabel}>اللون</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.colorPalette}>
                        {['#000000', '#FFFFFF', '#00FFFF', '#A855F7', '#facc15', '#f43f5e'].map(c => (
                          <TouchableOpacity key={c} style={[styles.colorSwatch, { backgroundColor: c }, strokeColor === c && styles.colorSwatchActive]} onPress={() => setStrokeColor(c)} />
                        ))}
                      </ScrollView>
                    </View>
                    <View style={styles.sliderHeader}>
                      <Text style={styles.controlLabel}>السُمك</Text>
                      <Text style={styles.controlValue}>{strokeSize}px</Text>
                    </View>
                    <Slider style={styles.slider} minimumValue={1} maximumValue={10} value={strokeSize} onValueChange={(v) => setStrokeSize(Math.round(v))} minimumTrackTintColor="#a855f7" maximumTrackTintColor="#2d2d33" thumbTintColor="#a855f7" />
                  </>
                )}
              </View>

              {/* Shadow */}
              <View style={styles.controlGroup}>
                <View style={styles.toggleRow}>
                  <Text style={styles.groupTitle}>الظل</Text>
                  <Switch value={hasShadow} onValueChange={setHasShadow} trackColor={{ false: '#2d2d33', true: '#a855f7' }} />
                </View>
                
                {hasShadow && (
                  <>
                    <View style={styles.controlRow}>
                      <Text style={styles.controlLabel}>اللون</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.colorPalette}>
                        {['#000000', '#FFFFFF', '#A855F7'].map(c => (
                          <TouchableOpacity key={c} style={[styles.colorSwatch, { backgroundColor: c }, shadowColor === c && styles.colorSwatchActive]} onPress={() => setShadowColor(c)} />
                        ))}
                      </ScrollView>
                    </View>
                    <View style={styles.sliderHeader}>
                      <Text style={styles.controlLabel}>السُمك</Text>
                      <Text style={styles.controlValue}>{shadowSize}px</Text>
                    </View>
                    <Slider style={styles.slider} minimumValue={1} maximumValue={10} value={shadowSize} onValueChange={(v) => setShadowSize(Math.round(v))} minimumTrackTintColor="#a855f7" maximumTrackTintColor="#2d2d33" thumbTintColor="#a855f7" />
                  </>
                )}
              </View>
            </ScrollView>
          )}

          {activeTab === 'export' && (
            <View style={styles.styleContainer}>
              <View style={styles.premiumCard}>
                <View style={styles.premiumHeader}>
                   <Crown color="#facc15" size={24} />
                   <Text style={styles.premiumTitle}>DeepSeek ترجمة</Text>
                </View>
                <Text style={styles.subtitleSmall}>حوّل المحتوى الخاص بك للإنجليزية بضغطة زر. سيقوم الذكاء الاصطناعي بإعادة ضبط توقيت الكلمات بدقة عالية.</Text>
                <TouchableOpacity style={styles.translateBtn} onPress={handleTranslate}>
                  <LinearGradient colors={['#10b981', '#059669']} style={styles.translateBtnGradient}>
                    <Languages color="#fff" size={22} />
                    <Text style={styles.translateBtnText}>ترجمة النص للإنجليزية</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
        <StatusBar style="light" />
      </SafeAreaView>
    );
  };

  if (isLoading) return renderLoading();
  if (videoUri) return renderEditor();
  return renderWelcome();
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0c',
  },
  centerAll: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  topProfileBar: {
    position: 'absolute',
    top: 20,
    left: 20,
    right: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 10,
  },
  userText: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '600'
  },
  tokenBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(250, 204, 21, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  tokenText: {
    color: '#facc15',
    fontSize: 12,
    fontWeight: '700',
  },
  logoutBtn: {
    padding: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: 8,
  },
  welcomeWrapper: {
    flex: 1,
    padding: 30,
  },
  iconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(62, 129, 246, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 30,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 16,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 40,
  },
  uploadButton: {
    flexDirection: 'row-reverse',
    paddingVertical: 18,
    paddingHorizontal: 32,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#3e81f6',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
    marginBottom: 40,
  },
  uploadButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
  },
  features: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    flexWrap: 'wrap',
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#16161a',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    gap: 8,
    marginBottom: 10,
  },
  featureText: {
    color: '#cbd5e1',
    fontSize: 14,
    fontWeight: '500',
  },
  loadingText: {
    marginTop: 20,
    color: '#e2e8f0',
    fontSize: 16,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#16161a',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  headerIconBtn: {
    padding: 8,
    backgroundColor: '#16161a',
    borderRadius: 12,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  exportBtnHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 16,
    gap: 6,
  },
  exportBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  videoRegion: {
    backgroundColor: '#000',
    width: width,
    height: height * 0.42,
    justifyContent: 'flex-end',
  },
  videoContainer: {
    width: width,
    flex: 1,
    position: 'relative',
  },
  video: {
    flex: 1,
  },
  captionOverlay: {
    position: 'absolute',
    bottom: 40,
    alignSelf: 'center',
    maxWidth: width * 0.9,
  },
  captionOverlayText: {
    textAlign: 'center',
  },
  playPauseOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playIconBg: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrubberWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 8,
    gap: 12,
  },
  timeText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  scrubberTrack: {
    flex: 1,
    height: 6,
    backgroundColor: '#2d2d33',
    borderRadius: 3,
    overflow: 'hidden',
  },
  scrubberFill: {
    height: '100%',
    backgroundColor: '#3e81f6',
    borderRadius: 3,
  },
  tabsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    borderBottomWidth: 1,
    borderBottomColor: '#16161a',
    backgroundColor: '#0a0a0c',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  activeTab: {
    borderBottomWidth: 3,
    borderBottomColor: '#3e81f6',
    backgroundColor: 'rgba(62, 129, 246, 0.03)',
  },
  tabText: {
    color: '#64748b',
    fontSize: 15,
    fontWeight: '600',
  },
  activeTabText: {
    color: '#3e81f6',
  },
  bottomArea: {
    flex: 1,
    backgroundColor: '#0a0a0c',
  },
  captionsList: {
    padding: 16,
  },
  captionItem: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: '#16161a',
    marginBottom: 12,
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#2d2d33',
  },
  captionItemActive: {
    borderColor: '#3e81f6',
    backgroundColor: 'rgba(62, 129, 246, 0.08)',
    transform: [{ scale: 1.02 }],
  },
  captionTimeRow: {
    marginLeft: 16,
    alignItems: 'center',
    backgroundColor: '#0a0a0c',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  captionTime: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '700',
  },
  captionInput: {
    flex: 1,
    color: '#e2e8f0',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'right',
    paddingVertical: 8,
  },
  captionInputActive: {
    color: '#fff',
  },
  editBtn: {
    marginRight: 16,
  },
  styleContainer: {
    padding: 24,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'right',
  },
  subtitleSmall: {
    color: '#94a3b8',
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'right',
    marginBottom: 24,
  },
  templatesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'flex-end',
  },
  templateCard: {
    backgroundColor: '#16161a',
    borderWidth: 1.5,
    borderColor: '#2d2d33',
    paddingVertical: 20,
    paddingHorizontal: 24,
    borderRadius: 20,
    minWidth: '45%',
    alignItems: 'center',
    marginBottom: 12,
  },
  templateCardActive: {
    borderColor: '#3e81f6',
    backgroundColor: 'rgba(62, 129, 246, 0.1)',
  },
  templateName: {
    color: '#94a3b8',
    fontWeight: '700',
    fontSize: 16,
  },
  controlGroup: {
    backgroundColor: '#16161a',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#2d2d33',
  },
  groupTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 16,
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  controlRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sliderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  controlLabel: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '600',
  },
  controlValue: {
    color: '#3e81f6',
    fontSize: 14,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  slider: {
    width: '100%',
    height: 40,
    marginBottom: 8,
  },
  colorPalette: {
    flexDirection: 'row',
    maxWidth: '70%',
  },
  colorSwatch: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 10,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorSwatchActive: {
    borderColor: '#fff',
    transform: [{ scale: 1.1 }],
  },
  premiumCard: {
    backgroundColor: '#16161a',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: '#2d2d33',
    alignItems: 'center',
  },
  premiumHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  premiumTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: 'bold',
  },
  translateBtn: {
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
    marginTop: 10,
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
  translateBtnGradient: {
    flexDirection: 'row-reverse',
    paddingVertical: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  translateBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginRight: 10,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#16161a',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    padding: 24,
    minHeight: '60%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#2d2d33',
    paddingBottom: 16,
  },
  modalTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  modalLabel: {
    color: '#e2e8f0',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    textAlign: 'right',
  },
  radioGroup: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  radioOption: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#2d2d33',
    backgroundColor: '#0a0a0c',
  },
  radioOptionActive: {
    borderColor: '#3e81f6',
    backgroundColor: 'rgba(62, 129, 246, 0.15)',
  },
  radioText: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '500',
  },
  radioTextActive: {
    color: '#3e81f6',
    fontWeight: 'bold',
  },
  infoBox: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.2)',
    padding: 16,
    borderRadius: 16,
    marginBottom: 24,
  },
  infoBoxText: {
    flex: 1,
    color: '#93c5fd',
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'right',
  },
  primaryBtn: {
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 'auto',
  },
  primaryBtnText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  }
});
