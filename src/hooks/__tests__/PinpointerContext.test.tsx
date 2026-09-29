/**
 * Tests for PinpointerContext — the single shared provider for usePinpointer
 * state (the "H7 fix" against duplicate sync engines / native listeners).
 *
 * usePinpointer itself is mocked here: these tests assert ONLY the context
 * mechanics — provider rendering, value sharing, the outside-provider error,
 * and single instantiation per provider mount.
 *
 * NOTE: @testing-library/react-native v14 made render/renderHook async —
 * every call site awaits them.
 */
import React from 'react';
import { Text } from 'react-native';
import { render, renderHook } from '@testing-library/react-native';
import { PinpointerProvider, usePinpointerShared } from '../PinpointerContext';

jest.mock('../usePinpointer', () => ({ usePinpointer: jest.fn() }));

import { usePinpointer } from '../usePinpointer';

const mockUsePinpointer = usePinpointer as jest.Mock;

describe('PinpointerContext', () => {
    const mockValue = {
        searchText: 'shared',
        handleScan: jest.fn(),
        isSyncing: true,
    } as unknown as ReturnType<typeof usePinpointer>;

    beforeEach(() => {
        jest.clearAllMocks();
        mockUsePinpointer.mockReturnValue(mockValue);
    });

    test('renders children inside the provider', async () => {
        const { getByText } = await render(
            <PinpointerProvider>
                <Text>hello-child</Text>
            </PinpointerProvider>,
        );
        expect(getByText('hello-child')).toBeTruthy();
    });

    test('instantiates usePinpointer exactly once per provider mount', async () => {
        await render(
            <PinpointerProvider>
                <Text>x</Text>
            </PinpointerProvider>,
        );
        expect(mockUsePinpointer).toHaveBeenCalledTimes(1);
    });

    test('usePinpointerShared returns the provider value', async () => {
        const wrapper = ({ children }: { children: React.ReactNode }) => (
            <PinpointerProvider>{children}</PinpointerProvider>
        );
        const { result } = await renderHook(() => usePinpointerShared(), { wrapper });
        expect(result.current).toBe(mockValue);
        expect((result.current as unknown as { searchText: string }).searchText).toBe('shared');
    });

    test('all consumers within one provider share the identical value reference', async () => {
        const seen: unknown[] = [];
        const Probe = () => {
            seen.push(usePinpointerShared());
            return null;
        };
        await render(
            <PinpointerProvider>
                <Probe />
                <Probe />
            </PinpointerProvider>,
        );
        expect(seen).toHaveLength(2);
        expect(seen[0]).toBe(seen[1]);
        expect(seen[0]).toBe(mockValue);
    });

    test('usePinpointerShared outside a provider throws the documented error', async () => {
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        try {
            await expect(renderHook(() => usePinpointerShared())).rejects.toThrow(
                'usePinpointerShared must be used within <PinpointerProvider>',
            );
        } finally {
            consoleSpy.mockRestore();
        }
    });

    test('nested providers give each subtree its own instance', async () => {
        const outerValue = { tag: 'outer' } as unknown as ReturnType<typeof usePinpointer>;
        const innerValue = { tag: 'inner' } as unknown as ReturnType<typeof usePinpointer>;
        mockUsePinpointer.mockReturnValueOnce(outerValue).mockReturnValueOnce(innerValue);

        const outerSeen: unknown[] = [];
        const innerSeen: unknown[] = [];
        const OuterProbe = () => {
            outerSeen.push(usePinpointerShared());
            return null;
        };
        const InnerProbe = () => {
            innerSeen.push(usePinpointerShared());
            return null;
        };

        await render(
            <PinpointerProvider>
                <OuterProbe />
                <PinpointerProvider>
                    <InnerProbe />
                </PinpointerProvider>
            </PinpointerProvider>,
        );

        expect(mockUsePinpointer).toHaveBeenCalledTimes(2);
        expect(outerSeen[0]).toBe(outerValue);
        expect(innerSeen[0]).toBe(innerValue);
    });
});
