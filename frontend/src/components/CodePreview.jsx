import { useMemo } from 'react'

function CodePreview({ files, assets }) {
    // Build the HTML document for preview
    const previewDoc = useMemo(() => {
        const html = files['index.html'] || `
<!DOCTYPE html>
<html>
<head>
    <title>Preview</title>
    <style>${files['styles.css'] || ''}</style>
</head>
<body>
    <p>Create an index.html file to see your preview here!</p>
    <script>${files['app.js'] || ''}</script>
</body>
</html>`

        // If there's an index.html, inject CSS and JS
        if (files['index.html']) {
            let doc = files['index.html']

            // Inject CSS if not already linked
            if (files['styles.css'] && !doc.includes('styles.css')) {
                const css = `<style>\n${files['styles.css']}\n</style>`
                doc = doc.replace('</head>', `${css}\n</head>`)
            }

            // Inject JS if not already linked
            if (files['app.js'] && !doc.includes('app.js')) {
                const js = `<script>\n${files['app.js']}\n</script>`
                doc = doc.replace('</body>', `${js}\n</body>`)
            }

            // Handle asset URLs - convert asset references to data URLs
            Object.entries(assets || {}).forEach(([name, asset]) => {
                if (asset.data) {
                    // Replace references to asset filename with data URL
                    const regex = new RegExp(`(['"\`])${name}\\1`, 'g')
                    doc = doc.replace(regex, `$1${asset.data}$1`)

                    // Also replace src= and url() references
                    doc = doc.replace(new RegExp(`src=["']${name}["']`, 'g'), `src="${asset.data}"`)
                    doc = doc.replace(new RegExp(`url\\(['"]?${name}['"]?\\)`, 'g'), `url("${asset.data}")`)
                }
            })

            return doc
        }

        return html
    }, [files, assets])

    // Create blob URL for iframe
    const iframeSrc = useMemo(() => {
        const blob = new Blob([previewDoc], { type: 'text/html' })
        return URL.createObjectURL(blob)
    }, [previewDoc])

    return (
        <div className="code-preview">
            <div className="code-preview__toolbar">
                <span className="code-preview__status">
                    🟢 Live Preview
                </span>
                <button
                    className="btn btn--ghost btn--sm"
                    onClick={() => window.open(iframeSrc, '_blank')}
                    title="Open in new window"
                >
                    🔗 Open in Tab
                </button>
            </div>
            <iframe
                className="code-preview__frame"
                src={iframeSrc}
                title="Preview"
                sandbox="allow-scripts allow-modals"
            />
        </div>
    )
}

export default CodePreview
