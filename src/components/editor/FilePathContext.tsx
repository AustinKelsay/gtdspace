/**
 * @fileoverview React context for providing the current editor file path to blocks
 * Exposes a provider and hook so deeply nested custom blocks can access the file path
 * without relying on window globals. Keeps data flow predictable and testable.
 */

/* eslint-disable react-refresh/only-export-components */

import React from 'react';

/**
 * FilePathContext holds the absolute path of the currently edited file.
 * Undefined means no file path is available.
 */
export const FilePathContext = React.createContext<string | undefined>(undefined);

/**
 * FilePathProvider wraps a subtree and provides a `filePath` value to consumers.
 *
 * @param props.filePath Optional absolute file path for the current editor document
 * @param props.children React children which will consume the context
 */
export function FilePathProvider(props: { filePath?: string; children: React.ReactNode }) {
    return (
        <FilePathContext.Provider value={props.filePath}>
            {props.children}
        </FilePathContext.Provider>
    );
}

/**
 * useFilePath returns the provided file path or undefined when none is set.
 */
export function useFilePath(): string | undefined {
    return React.useContext(FilePathContext);
}


