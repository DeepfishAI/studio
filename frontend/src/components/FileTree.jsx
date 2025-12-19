import { useState } from 'react'

function FileTree({ files, activeFile, onSelectFile, onCreateFile, onDeleteFile }) {
    const [newFileName, setNewFileName] = useState('')
    const [isCreating, setIsCreating] = useState(false)

    const handleCreate = () => {
        if (newFileName.trim()) {
            onCreateFile(newFileName.trim())
            setNewFileName('')
            setIsCreating(false)
        }
    }

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            handleCreate()
        } else if (e.key === 'Escape') {
            setIsCreating(false)
            setNewFileName('')
        }
    }

    // Get file icon based on extension
    const getFileIcon = (filename) => {
        const ext = filename.split('.').pop().toLowerCase()
        const icons = {
            html: '🌐',
            htm: '🌐',
            css: '🎨',
            scss: '🎨',
            js: '📜',
            jsx: '⚛️',
            ts: '📘',
            tsx: '⚛️',
            json: '📋',
            md: '📝',
            py: '🐍',
            png: '🖼️',
            jpg: '🖼️',
            gif: '🖼️',
            svg: '🖼️',
        }
        return icons[ext] || '📄'
    }

    return (
        <div className="file-tree">
            <div className="file-tree__list">
                {files.map(file => (
                    <div
                        key={file}
                        className={`file-tree__item ${file === activeFile ? 'file-tree__item--active' : ''}`}
                        onClick={() => onSelectFile(file)}
                    >
                        <span className="file-tree__icon">{getFileIcon(file)}</span>
                        <span className="file-tree__name">{file}</span>
                        <button
                            className="file-tree__delete"
                            onClick={(e) => {
                                e.stopPropagation()
                                if (confirm(`Delete ${file}?`)) {
                                    onDeleteFile(file)
                                }
                            }}
                            title="Delete file"
                        >
                            🗑️
                        </button>
                    </div>
                ))}
            </div>

            {isCreating ? (
                <div className="file-tree__create">
                    <input
                        type="text"
                        className="file-tree__input"
                        placeholder="filename.js"
                        value={newFileName}
                        onChange={(e) => setNewFileName(e.target.value)}
                        onKeyDown={handleKeyDown}
                        autoFocus
                    />
                    <button className="btn btn--sm btn--primary" onClick={handleCreate}>
                        ✓
                    </button>
                    <button className="btn btn--sm btn--ghost" onClick={() => setIsCreating(false)}>
                        ✕
                    </button>
                </div>
            ) : (
                <button
                    className="file-tree__add-btn"
                    onClick={() => setIsCreating(true)}
                >
                    + New File
                </button>
            )}
        </div>
    )
}

export default FileTree
