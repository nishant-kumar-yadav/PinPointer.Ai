import React, { useEffect, useRef } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity,
    Modal, Animated, Dimensions, Alert, ViewStyle, TextStyle,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useModelService } from '../services/ModelService';
import { AppColors } from '../theme';
import RNFS from 'react-native-fs';

const { height } = Dimensions.get('window');

interface ModelRowProps {
    icon: string;
    name: string;
    size: string;
    accent: string;
    isDownloading: boolean;
    isLoading: boolean;
    isLoaded: boolean;
    progress: number;
    onDownload: () => void;
}

const ModelRow: React.FC<ModelRowProps> = ({
    icon, name, size, accent,
    isDownloading, isLoading, isLoaded, progress, onDownload,
}) => {
    const animWidth = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.timing(animWidth, {
            toValue: isDownloading ? progress : isLoaded ? 100 : 0,
            duration: 300,
            useNativeDriver: false,
        }).start();
    }, [progress, isDownloading, isLoaded, animWidth]);

    const getStatus = () => {
        if (isLoaded) return { label: '✅ Ready', color: '#22C55E' };
        if (isLoading) return { label: '⚙️ Loading...', color: AppColors.accentCyan };
        if (isDownloading) return { label: `📦 Unpacking ${Math.round(progress)}%`, color: accent };
        return { label: size, color: AppColors.textMuted };
    };

    const status = getStatus();

    // Dynamic styles (depend on props/state; kept out of JSX for lint).
    const iconAccentStyle: ViewStyle = { backgroundColor: accent + '20' };
    const statusColorStyle: TextStyle = { color: status.color };
    const trackFillAnimatedStyle: ViewStyle = {
        backgroundColor: isLoaded ? '#22C55E' : accent,
        width: animWidth.interpolate({
            inputRange: [0, 100],
            outputRange: ['0%', '100%'],
        }),
    };
    const downloadBtnAccentStyle: ViewStyle = { borderColor: accent };
    const downloadBtnDisabledStyle: ViewStyle = { borderColor: accent, opacity: 0.5 };
    const downloadBtnTextAccentStyle: TextStyle = { color: accent };

    return (
        <View style={styles.modelRow}>
            <View style={[styles.modelIcon, iconAccentStyle]}>
                <Text style={styles.modelEmoji}>{icon}</Text>
            </View>

            <View style={styles.modelBody}>
                <View style={styles.modelHeader}>
                    <Text style={styles.modelName}>{name}</Text>
                    <Text style={[styles.modelStatus, statusColorStyle]}>{status.label}</Text>
                </View>

                {/* Progress track */}
                <View style={styles.track}>
                    <Animated.View
                        style={[
                            styles.trackFill,
                            trackFillAnimatedStyle,
                        ]}
                    />
                </View>
            </View>

            {!isLoaded && !isDownloading && !isLoading && (
                <TouchableOpacity
                    style={[styles.downloadBtn, downloadBtnAccentStyle]}
                    onPress={onDownload}
                >
                    <Text style={[styles.downloadBtnText, downloadBtnTextAccentStyle]}>↓</Text>
                </TouchableOpacity>
            )}

            {(isLoading || isDownloading) && (
                <View style={[styles.downloadBtn, downloadBtnDisabledStyle]}>
                    <Text style={styles.downloadPendingIcon}>⏳</Text>
                </View>
            )}
        </View>
    );
};

interface Props {
    visible: boolean;
    onClose: () => void;
}

/**
 * Bottom sheet listing the on-device AI models with download progress.
 *
 * @param visible Whether the sheet is shown.
 * @param onClose Called when the sheet is dismissed.
 */
export const ModelDownloadSheet: React.FC<Props> = ({ visible, onClose }) => {
    const slideAnim = useRef(new Animated.Value(height)).current;
    const {
        isSTTDownloading, isSTTLoading, isSTTLoaded, sttDownloadProgress, downloadAndLoadSTT,
        downloadAndLoadAllModels,
    } = useModelService();

    const allReady = isSTTLoaded;

    useEffect(() => {
        Animated.spring(slideAnim, {
            toValue: visible ? 0 : height,
            useNativeDriver: true,
            tension: 65,
            friction: 11,
        }).start();
    }, [visible, slideAnim]);

    return (
        <Modal transparent visible={visible} animationType="none" onRequestClose={onClose}>
            <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
            <Animated.View style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}>
                <LinearGradient colors={['#1A1A2E', '#16213E']} style={styles.sheetInner}>

                    {/* Handle */}
                    <View style={styles.handle} />

                    {/* Header */}
                    <View style={styles.sheetHeader}>
                        <View>
                            <Text style={styles.sheetTitle}>🧠 AI Models</Text>
                            <Text style={styles.sheetSubtitle}>All processing is 100% on-device</Text>
                            <TouchableOpacity onPress={async () => {
                                try {
                                    const contents = await RNFS.readDirAssets('models');
                                    Alert.alert('Asset Models Folder', JSON.stringify(contents.map(c => c.name), null, 2));
                                } catch (e: unknown) {
                                    Alert.alert('Read Dir Failed', e instanceof Error ? e.message : 'unknown error');
                                }
                            }} style={styles.debugBtn}>
                                <Text style={styles.debugBtnText}>Debug Assets</Text>
                            </TouchableOpacity>
                        </View>
                        <TouchableOpacity onPress={onClose}>
                            <Text style={styles.closeBtnText}>✕</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Model rows */}
                    <View style={styles.models}>
                        <ModelRow
                            icon="🎤" name="Whisper Base STT" size="Bundled"
                            accent={AppColors.accentViolet}
                            isDownloading={isSTTDownloading} isLoading={isSTTLoading}
                            isLoaded={isSTTLoaded} progress={sttDownloadProgress}
                            onDownload={downloadAndLoadSTT}
                        />
                    </View>

                    {/* Footer button */}
                    {allReady ? (
                        <TouchableOpacity style={styles.doneBtn} onPress={onClose}>
                            <LinearGradient colors={[AppColors.accentCyan, AppColors.accentViolet]} style={styles.doneBtnGrad}>
                                <Text style={styles.doneBtnText}>✅ All Models Ready — Let's Go!</Text>
                            </LinearGradient>
                        </TouchableOpacity>
                    ) : (
                        <TouchableOpacity style={styles.doneBtn} onPress={downloadAndLoadAllModels}>
                            <LinearGradient colors={[AppColors.accentCyan, AppColors.accentViolet]} style={styles.doneBtnGrad}>
                                <Text style={styles.doneBtnText}>📦 Unpack Local Models</Text>
                            </LinearGradient>
                        </TouchableOpacity>
                    )}

                    <Text style={styles.privacyNote}>🔒 Models run fully offline · Nothing leaves your device</Text>
                </LinearGradient>
            </Animated.View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    backdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
    },
    sheet: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        overflow: 'hidden',
    },
    sheetInner: { padding: 24, paddingBottom: 36 },
    handle: {
        width: 40, height: 4,
        backgroundColor: 'rgba(255,255,255,0.2)',
        borderRadius: 2,
        alignSelf: 'center',
        marginBottom: 20,
    },
    sheetHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 24,
    },
    sheetTitle: { color: '#FFF', fontSize: 20, fontWeight: '800' },
    sheetSubtitle: { color: 'rgba(255,255,255,0.45)', fontSize: 12, marginTop: 3 },

    models: { gap: 16, marginBottom: 28 },
    modelRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 14,
        padding: 14,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.07)',
    },
    modelIcon: {
        width: 44, height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
    },
    modelEmoji: { fontSize: 22 },
    modelHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    modelName: { color: '#FFF', fontSize: 14, fontWeight: '600' },
    modelStatus: { fontSize: 12, fontWeight: '700' },
    track: {
        height: 5,
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 3,
        overflow: 'hidden',
    },
    trackFill: { height: '100%', borderRadius: 3 },
    downloadBtn: {
        width: 34, height: 34,
        borderRadius: 17,
        borderWidth: 1.5,
        justifyContent: 'center',
        alignItems: 'center',
    },
    downloadBtnText: { fontSize: 16, fontWeight: '700' },
    downloadPendingIcon: { fontSize: 12 },
    modelBody: { flex: 1 },
    debugBtn: {
        marginTop: 8,
        padding: 4,
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 4,
    },
    debugBtnText: { color: 'white', fontSize: 10 },
    closeBtnText: { color: AppColors.textMuted, fontSize: 22 },

    doneBtn: { borderRadius: 14, overflow: 'hidden', marginBottom: 16 },
    doneBtnGrad: { paddingVertical: 15, alignItems: 'center' },
    doneBtnText: { color: '#FFF', fontSize: 15, fontWeight: '800' },
    privacyNote: {
        color: 'rgba(255,255,255,0.3)',
        fontSize: 11,
        textAlign: 'center',
    },
});
