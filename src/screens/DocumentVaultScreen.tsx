import React, { useCallback, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    StatusBar,
    ScrollView,
    TouchableOpacity,
    Linking,
    NativeModules,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { StackNavigationProp } from '@react-navigation/stack';
import { useFocusEffect } from '@react-navigation/native';
import { RootStackParamList } from '../navigation/types';
import { getAllDocuments, DocumentRecord } from '../database';
import { classifyDocument, type ClassificationResult, type DocumentCategory } from '../utils/DocumentClassifier';

const { StorageModule } = NativeModules;

type Props = {
    navigation: StackNavigationProp<RootStackParamList, 'DocumentVault'>;
};

// ─── Category Grouping ──────────────────────────────────────────────────────

interface CategoryGroup {
    category: DocumentCategory;
    emoji: string;
    label: string;
    documents: DocumentRecord[];
    avgConfidence: number;
}

const groupDocumentsByCategory = (docs: DocumentRecord[]): CategoryGroup[] => {
    const groups = new Map<DocumentCategory, CategoryGroup>();

    for (const doc of docs) {
        const fileName = doc.filePath.split('/').pop() || '';
        const classification = classifyDocument(doc.content || '', fileName);

        if (!groups.has(classification.category)) {
            groups.set(classification.category, {
                category: classification.category,
                emoji: classification.emoji,
                label: classification.label,
                documents: [],
                avgConfidence: 0,
            });
        }

        const group = groups.get(classification.category)!;
        group.documents.push(doc);
        group.avgConfidence = (group.avgConfidence * (group.documents.length - 1) + classification.confidence) / group.documents.length;
    }

    // Sort: most documents first, then by name
    return Array.from(groups.values()).sort((a, b) => b.documents.length - a.documents.length);
};

// ─── Category Colors ────────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<string, string> = {
    AADHAAR_CARD: '#F59E0B',
    PAN_CARD: '#3B82F6',
    VOTER_ID: '#8B5CF6',
    DRIVING_LICENSE: '#10B981',
    PASSPORT: '#EF4444',
    BANK_STATEMENT: '#06B6D4',
    INVOICE: '#F97316',
    RECEIPT: '#F97316',
    SALARY_SLIP: '#22C55E',
    TAX_RETURN: '#6366F1',
    MARKSHEET: '#A855F7',
    CERTIFICATE: '#EC4899',
    RESUME: '#14B8A6',
    INSURANCE: '#6366F1',
    ELECTRICITY_BILL: '#FACC15',
    PHONE_BILL: '#3B82F6',
    MEDICAL_REPORT: '#EF4444',
    PROPERTY_DOC: '#F59E0B',
    EDUCATION: '#8B5CF6',
    GENERAL_DOCUMENT: '#6B7280',
};

// ─── Screen Component ───────────────────────────────────────────────────────

export const DocumentVaultScreen: React.FC<Props> = ({ navigation }) => {
    const [groups, setGroups] = useState<CategoryGroup[]>([]);
    const [totalDocs, setTotalDocs] = useState(0);
    const [expandedCategory, setExpandedCategory] = useState<DocumentCategory | null>(null);

    useFocusEffect(
        useCallback(() => {
            const docs = getAllDocuments();
            setTotalDocs(docs.length);
            setGroups(groupDocumentsByCategory(docs));
        }, [])
    );

    const openDocument = (filePath: string) => {
        try {
            if (StorageModule && StorageModule.openPDF) {
                StorageModule.openPDF(filePath.replace('file://', ''));
            } else {
                const uri = filePath.startsWith('file://') ? filePath : `file://${filePath}`;
                Linking.openURL(uri);
            }
        } catch (e) {
            console.warn('Failed to open document:', e);
        }
    };

    const identityDocs = groups.filter(g =>
        ['AADHAAR_CARD', 'PAN_CARD', 'VOTER_ID', 'DRIVING_LICENSE', 'PASSPORT'].includes(g.category)
    );
    const financialDocs = groups.filter(g =>
        ['BANK_STATEMENT', 'INVOICE', 'RECEIPT', 'SALARY_SLIP', 'TAX_RETURN'].includes(g.category)
    );
    const otherDocs = groups.filter(g =>
        !['AADHAAR_CARD', 'PAN_CARD', 'VOTER_ID', 'DRIVING_LICENSE', 'PASSPORT',
            'BANK_STATEMENT', 'INVOICE', 'RECEIPT', 'SALARY_SLIP', 'TAX_RETURN'].includes(g.category)
    ).sort((a, b) => {
        if (a.category === 'GENERAL_DOCUMENT') return 1;
        if (b.category === 'GENERAL_DOCUMENT') return -1;
        return 0; // retain existing size-based sorting for others
    });

    const renderCategoryCard = (group: CategoryGroup) => {
        const color = CATEGORY_COLORS[group.category] || '#6B7280';
        const isExpanded = expandedCategory === group.category;

        return (
            <TouchableOpacity
                key={group.category}
                activeOpacity={0.7}
                onPress={() => setExpandedCategory(isExpanded ? null : group.category)}
                style={styles.categoryCard}
            >
                <LinearGradient
                    colors={[`${color}18`, `${color}08`]}
                    style={styles.categoryCardGradient}
                >
                    <View style={styles.categoryHeader}>
                        <Text style={styles.categoryEmoji}>{group.emoji}</Text>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.categoryLabel}>{group.label}</Text>
                            <Text style={[styles.categoryCount, { color }]}>
                                {group.documents.length} {group.documents.length === 1 ? 'document' : 'documents'}
                            </Text>
                        </View>
                        <View style={[styles.countBadge, { backgroundColor: `${color}30`, borderColor: `${color}50` }]}>
                            <Text style={[styles.countBadgeText, { color }]}>{group.documents.length}</Text>
                        </View>
                    </View>

                    {isExpanded && (
                        <View style={styles.documentsList}>
                            {group.documents.map((doc, idx) => (
                                <TouchableOpacity
                                    key={doc.id || idx}
                                    style={styles.documentItem}
                                    onPress={() => openDocument(doc.filePath)}
                                    activeOpacity={0.6}
                                >
                                    <Text style={styles.documentIcon}>📄</Text>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.documentTitle} numberOfLines={1}>
                                            {doc.title || 'Untitled'}
                                        </Text>
                                        <Text style={styles.documentPath} numberOfLines={1}>
                                            {doc.filePath.split('/').pop()}
                                        </Text>
                                    </View>
                                    <Text style={styles.openArrow}>→</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    )}
                </LinearGradient>
            </TouchableOpacity>
        );
    };

    const renderSection = (title: string, icon: string, sectionGroups: CategoryGroup[]) => {
        if (sectionGroups.length === 0) return null;
        const totalInSection = sectionGroups.reduce((sum, g) => sum + g.documents.length, 0);

        return (
            <View style={styles.section}>
                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionIcon}>{icon}</Text>
                    <Text style={styles.sectionTitle}>{title}</Text>
                    <Text style={styles.sectionCount}>{totalInSection}</Text>
                </View>
                {sectionGroups.map(renderCategoryCard)}
            </View>
        );
    };

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor="#05050A" />

            {/* Background Glow */}
            <View style={[StyleSheet.absoluteFillObject, { overflow: 'hidden' }]}>
                <View style={{ position: 'absolute', top: -120, right: -200, width: 500, height: 300, backgroundColor: 'rgba(99, 102, 241, 0.08)', transform: [{ rotate: '25deg' }], borderRadius: 250 }} />
                <View style={{ position: 'absolute', bottom: -80, left: -150, width: 600, height: 250, backgroundColor: 'rgba(168, 85, 247, 0.06)', transform: [{ rotate: '-20deg' }], borderRadius: 300 }} />
            </View>

            <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                        <Text style={styles.backArrow}>←</Text>
                    </TouchableOpacity>
                    <View style={styles.headerTextContainer}>
                        <Text style={styles.headerTitle}>Document Vault</Text>
                        <Text style={styles.headerSubtitle}>AI-classified by Pinpointer</Text>
                    </View>
                </View>

                {/* Stats Bar */}
                <LinearGradient
                    colors={['rgba(139, 92, 246, 0.15)', 'rgba(99, 102, 241, 0.08)']}
                    style={styles.statsBar}
                >
                    <View style={styles.statItem}>
                        <Text style={styles.statNumber}>{totalDocs}</Text>
                        <Text style={styles.statLabel}>Documents</Text>
                    </View>
                    <View style={styles.statDivider} />
                    <View style={styles.statItem}>
                        <Text style={styles.statNumber}>{groups.length}</Text>
                        <Text style={styles.statLabel}>Categories</Text>
                    </View>
                    <View style={styles.statDivider} />
                    <View style={styles.statItem}>
                        <Text style={styles.statNumber}>{identityDocs.reduce((s, g) => s + g.documents.length, 0)}</Text>
                        <Text style={styles.statLabel}>ID Cards</Text>
                    </View>
                </LinearGradient>

                {/* Empty State */}
                {totalDocs === 0 && (
                    <View style={styles.emptyState}>
                        <Text style={styles.emptyEmoji}>📂</Text>
                        <Text style={styles.emptyTitle}>No documents indexed yet</Text>
                        <Text style={styles.emptySubtitle}>
                            Run "Scan Docs" from the Pinpointer dashboard to discover and classify all PDFs on your device.
                        </Text>
                    </View>
                )}

                {/* Category Sections */}
                {renderSection('Identity Documents', '🪪', identityDocs)}
                {renderSection('Financial Documents', '💰', financialDocs)}
                {renderSection('Other Documents', '📁', otherDocs)}

                {/* Privacy Footer */}
                <View style={styles.privacyFooter}>
                    <Text style={styles.privacyIcon}>◈</Text>
                    <Text style={styles.privacyText}>
                        All classification is done on-device. No data leaves your phone.
                    </Text>
                </View>
            </ScrollView>
        </View>
    );
};

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#05050A',
    },
    scroll: {
        flex: 1,
    },
    scrollContent: {
        padding: 20,
        paddingBottom: 40,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 24,
        paddingTop: 16,
    },
    backButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(255, 255, 255, 0.06)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    backArrow: {
        fontSize: 20,
        color: '#E2E8F0',
    },
    headerTextContainer: {
        flex: 1,
    },
    headerTitle: {
        fontSize: 26,
        fontWeight: '700',
        color: '#F1F5F9',
        letterSpacing: -0.5,
    },
    headerSubtitle: {
        fontSize: 13,
        color: '#8B5CF6',
        marginTop: 2,
        letterSpacing: 0.5,
    },

    // Stats Bar
    statsBar: {
        flexDirection: 'row',
        borderRadius: 16,
        padding: 16,
        marginBottom: 24,
        borderWidth: 1,
        borderColor: 'rgba(139, 92, 246, 0.2)',
    },
    statItem: {
        flex: 1,
        alignItems: 'center',
    },
    statNumber: {
        fontSize: 24,
        fontWeight: '700',
        color: '#F1F5F9',
    },
    statLabel: {
        fontSize: 11,
        color: '#94A3B8',
        marginTop: 4,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    statDivider: {
        width: 1,
        backgroundColor: 'rgba(139, 92, 246, 0.3)',
    },

    // Sections
    section: {
        marginBottom: 24,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    sectionIcon: {
        fontSize: 18,
        marginRight: 8,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#CBD5E1',
        flex: 1,
    },
    sectionCount: {
        fontSize: 14,
        fontWeight: '700',
        color: '#8B5CF6',
    },

    // Category Cards
    categoryCard: {
        marginBottom: 10,
        borderRadius: 14,
        overflow: 'hidden',
    },
    categoryCardGradient: {
        padding: 14,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.06)',
    },
    categoryHeader: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    categoryEmoji: {
        fontSize: 28,
        marginRight: 14,
    },
    categoryLabel: {
        fontSize: 15,
        fontWeight: '600',
        color: '#E2E8F0',
    },
    categoryCount: {
        fontSize: 12,
        marginTop: 2,
    },
    countBadge: {
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
    },
    countBadgeText: {
        fontSize: 15,
        fontWeight: '700',
    },

    // Document List (Expanded)
    documentsList: {
        marginTop: 12,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255, 255, 255, 0.06)',
        paddingTop: 10,
    },
    documentItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
        paddingHorizontal: 4,
    },
    documentIcon: {
        fontSize: 16,
        marginRight: 10,
    },
    documentTitle: {
        fontSize: 13,
        fontWeight: '500',
        color: '#CBD5E1',
    },
    documentPath: {
        fontSize: 11,
        color: '#64748B',
        marginTop: 1,
    },
    openArrow: {
        fontSize: 16,
        color: '#8B5CF6',
        marginLeft: 8,
    },

    // Empty State
    emptyState: {
        alignItems: 'center',
        paddingVertical: 60,
    },
    emptyEmoji: {
        fontSize: 48,
        marginBottom: 16,
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#CBD5E1',
        marginBottom: 8,
    },
    emptySubtitle: {
        fontSize: 14,
        color: '#64748B',
        textAlign: 'center',
        lineHeight: 20,
        paddingHorizontal: 40,
    },

    // Privacy Footer
    privacyFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 16,
        opacity: 0.5,
    },
    privacyIcon: {
        fontSize: 14,
        color: '#8B5CF6',
        marginRight: 8,
    },
    privacyText: {
        fontSize: 12,
        color: '#64748B',
    },
});
