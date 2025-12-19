import { useState } from 'react'
import MonacoEditorPanel from '../components/MonacoEditorPanel'
import CodePreview from '../components/CodePreview'
import FileTree from '../components/FileTree'
import AssetUploader from '../components/AssetUploader'
import WorkspaceChat from '../components/WorkspaceChat'

// Default project structure
const defaultProject = {
    files: {
        'index.html': `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>My Project</title>
    <link rel="stylesheet" href="styles.css">
</head>
<body>
    <h1>Hello DeepFish! 🐟</h1>
    <p>Start coding with your AI team.</p>
    <script src="app.js"></script>
</body>
</html>`,
        'styles.css': `/* My Styles */
body {
    font-family: 'Segoe UI', sans-serif;
    background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
    color: #ffffff;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    margin: 0;
}

h1 {
    color: #1e90ff;
    font-size: 2.5rem;
    margin-bottom: 0.5rem;
}

p {
    color: #a0a0a0;
}`,
        'app.js': `// My JavaScript
console.log('Hello from DeepFish! 🐟');

// Your code here...
function greet(name) {
    return \`Welcome, \${name}!\`;
}

console.log(greet('Developer'));`
    },
    assets: {}
}

function WorkspacePage() {
    const [project, setProject] = useState(defaultProject)
    const [activeFile, setActiveFile] = useState('index.html')
    const [openTabs, setOpenTabs] = useState(['index.html', 'styles.css', 'app.js'])
    const [viewMode, setViewMode] = useState('code') // 'code' or 'preview'

    // Get current file content
    const currentContent = project.files[activeFile] || ''

    // Update file content
    const handleFileChange = (content) => {
        setProject(prev => ({
            ...prev,
            files: {
                ...prev.files,
                [activeFile]: content
            }
        }))
    }

    // Open a file
    const handleOpenFile = (filename) => {
        setActiveFile(filename)
        if (!openTabs.includes(filename)) {
            setOpenTabs([...openTabs, filename])
        }
    }

    // Close a tab
    const handleCloseTab = (filename) => {
        const newTabs = openTabs.filter(t => t !== filename)
        setOpenTabs(newTabs)
        if (activeFile === filename && newTabs.length > 0) {
            setActiveFile(newTabs[0])
        }
    }

    // Create new file
    const handleCreateFile = (filename) => {
        if (!project.files[filename]) {
            setProject(prev => ({
                ...prev,
                files: {
                    ...prev.files,
                    [filename]: ''
                }
            }))
            handleOpenFile(filename)
        }
    }

    // Delete file
    const handleDeleteFile = (filename) => {
        const newFiles = { ...project.files }
        delete newFiles[filename]
        setProject(prev => ({
            ...prev,
            files: newFiles
        }))
        handleCloseTab(filename)
    }

    // Add asset
    const handleAddAsset = (name, data) => {
        setProject(prev => ({
            ...prev,
            assets: {
                ...prev.assets,
                [name]: data
            }
        }))
    }

    // Apply code from chat
    const handleApplyCode = (filename, content) => {
        setProject(prev => ({
            ...prev,
            files: {
                ...prev.files,
                [filename]: content
            }
        }))
        handleOpenFile(filename)
        // Switch to code view to show the applied code
        setViewMode('code')
    }

    return (
        <div className="workspace-page">
            {/* Left: Chat Panel */}
            <div className="workspace-panel workspace-panel--chat">
                <div className="workspace-panel__header">
                    <h3>💬 Agent Chat</h3>
                </div>
                <WorkspaceChat
                    onApplyCode={handleApplyCode}
                    currentFile={activeFile}
                    currentContent={currentContent}
                />
            </div>

            {/* Center: Code Editor OR Preview */}
            <div className="workspace-panel workspace-panel--editor">
                {/* View Toggle */}
                <div className="workspace-view-toggle">
                    <button
                        className={`workspace-view-toggle__btn ${viewMode === 'code' ? 'workspace-view-toggle__btn--active' : ''}`}
                        onClick={() => setViewMode('code')}
                    >
                        📝 Code
                    </button>
                    <button
                        className={`workspace-view-toggle__btn ${viewMode === 'preview' ? 'workspace-view-toggle__btn--active' : ''}`}
                        onClick={() => setViewMode('preview')}
                    >
                        ▶️ Preview
                    </button>
                </div>

                {viewMode === 'code' ? (
                    <>
                        <div className="workspace-tabs">
                            {openTabs.map(tab => (
                                <div
                                    key={tab}
                                    className={`workspace-tab ${tab === activeFile ? 'workspace-tab--active' : ''}`}
                                    onClick={() => setActiveFile(tab)}
                                >
                                    <span className="workspace-tab__name">{tab}</span>
                                    <button
                                        className="workspace-tab__close"
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            handleCloseTab(tab)
                                        }}
                                    >
                                        ×
                                    </button>
                                </div>
                            ))}
                        </div>
                        <MonacoEditorPanel
                            filename={activeFile}
                            content={currentContent}
                            onChange={handleFileChange}
                        />
                    </>
                ) : (
                    <CodePreview
                        files={project.files}
                        assets={project.assets}
                    />
                )}
            </div>

            {/* Right: Files & Assets */}
            <div className="workspace-panel workspace-panel--files">
                <div className="workspace-panel__header">
                    <h3>📁 Files</h3>
                </div>
                <FileTree
                    files={Object.keys(project.files)}
                    activeFile={activeFile}
                    onSelectFile={handleOpenFile}
                    onCreateFile={handleCreateFile}
                    onDeleteFile={handleDeleteFile}
                />

                <div className="workspace-panel__header" style={{ marginTop: 'var(--space-lg)' }}>
                    <h3>📤 Assets</h3>
                </div>
                <AssetUploader
                    assets={project.assets}
                    onAddAsset={handleAddAsset}
                />
            </div>
        </div>
    )
}

export default WorkspacePage
