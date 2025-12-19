import Editor from '@monaco-editor/react'

// File extension to language mapping
const getLanguage = (filename) => {
    const ext = filename.split('.').pop().toLowerCase()
    const languageMap = {
        js: 'javascript',
        jsx: 'javascript',
        ts: 'typescript',
        tsx: 'typescript',
        html: 'html',
        htm: 'html',
        css: 'css',
        scss: 'scss',
        json: 'json',
        md: 'markdown',
        py: 'python',
        rb: 'ruby',
        java: 'java',
        cpp: 'cpp',
        c: 'c',
        go: 'go',
        rs: 'rust',
        sql: 'sql',
        xml: 'xml',
        yaml: 'yaml',
        yml: 'yaml',
        sh: 'shell',
        bash: 'shell',
    }
    return languageMap[ext] || 'plaintext'
}

function MonacoEditorPanel({ filename, content, onChange }) {
    const language = getLanguage(filename)

    const handleEditorChange = (value) => {
        onChange(value || '')
    }

    return (
        <div className="monaco-editor-wrapper">
            <Editor
                height="100%"
                language={language}
                value={content}
                onChange={handleEditorChange}
                theme="vs-dark"
                options={{
                    fontSize: 14,
                    fontFamily: "'Fira Code', 'Consolas', 'Monaco', monospace",
                    minimap: { enabled: true },
                    scrollBeyondLastLine: false,
                    wordWrap: 'on',
                    automaticLayout: true,
                    padding: { top: 16 },
                    lineNumbers: 'on',
                    renderLineHighlight: 'all',
                    cursorBlinking: 'smooth',
                    smoothScrolling: true,
                }}
            />
        </div>
    )
}

export default MonacoEditorPanel
