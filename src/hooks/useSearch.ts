import { useState, useEffect, useCallback } from 'react';
import { searchDocuments, DocumentRecord } from '../database';
import { encodeText } from '../services/EmbeddingService';
import { AppLogger } from '../utils/AppLogger';
import {
    loadSearchHistory, saveSearch, deleteSearchItem,
    clearSearchHistory, SearchHistoryItem,
} from '../utils/SearchHistory';

/**
 * useSearch — handles search text, debounced DB queries, results, and history.
 *
 * Runs the FTS + vector hybrid search 200ms after the last keystroke and
 * persists successful queries to the search history (debounced 800ms).
 *
 * @param isDbReady Whether the SQLite database has finished initializing.
 * @returns Search state (text, results, pending flags, history) and handlers.
 */
export const useSearch = (isDbReady: boolean) => {
    const [searchText, setSearchText] = useState('');
    const [debouncedSearchText, setDebouncedSearchText] = useState('');
    const [searchResults, setSearchResults] = useState<DocumentRecord[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [isSearchPending, setIsSearchPending] = useState(false);
    const [searchHistory, setSearchHistory] = useState<SearchHistoryItem[]>([]);

    // Load history on mount
    useEffect(() => {
        if (!isDbReady) return;
        loadSearchHistory().then(setSearchHistory);
    }, [isDbReady]);

    // Debounced search — 200ms after last keystroke
    useEffect(() => {
        if (!isDbReady || !searchText.trim()) {
            setSearchResults([]);
            setIsSearchPending(false);
            return;
        }

        let isCurrent = true;
        setIsSearchPending(true);
        const timer = setTimeout(async () => {
            try {
                // Generate semantic query vector for hybrid search
                const queryVector = await encodeText(searchText);
                if (!isCurrent) return;
                const results = searchDocuments(searchText, queryVector ?? undefined);
                if (!isCurrent) return;
                setSearchResults(results);
                setDebouncedSearchText(searchText);
            } catch (e) {
                AppLogger.error('Search', 'search error:', e);
            } finally {
                if (isCurrent) {
                    setIsSearchPending(false);
                }
            }
        }, 200);
        return () => {
            isCurrent = false;
            clearTimeout(timer);
        };
    }, [searchText, isDbReady]);

    // Save to history when user stops typing (debounced 800ms)
    useEffect(() => {
        if (!searchText.trim() || !isDbReady) return;
        let isCurrent = true;
        const timer = setTimeout(async () => {
            try {
                // Generate semantic query vector for hybrid search
                const queryVector = await encodeText(searchText);
                if (!isCurrent) return;
                const results = searchDocuments(searchText, queryVector ?? undefined);
                if (!isCurrent) return;
                await saveSearch(searchText, results.length);
                if (!isCurrent) return;
                setSearchHistory(await loadSearchHistory());
            } catch (e) {
                AppLogger.error('Search', 'saveSearch error:', e);
            }
        }, 800);
        return () => {
            isCurrent = false;
            clearTimeout(timer);
        };
    }, [searchText, isDbReady]);

    const handleSelectHistory = useCallback((query: string) => {
        setSearchText(query);
        setIsSearching(true);
    }, []);

    const handleDeleteHistory = useCallback(async (query: string) => {
        await deleteSearchItem(query);
        setSearchHistory(await loadSearchHistory());
    }, []);

    const handleClearHistory = useCallback(async () => {
        await clearSearchHistory();
        setSearchHistory([]);
    }, []);

    return {
        searchText, setSearchText, debouncedSearchText,
        searchResults,
        isSearching, setIsSearching, isSearchPending,
        searchHistory,
        handleSelectHistory, handleDeleteHistory, handleClearHistory,
    };
};
