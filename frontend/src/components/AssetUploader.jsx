import { useState, useRef } from 'react'

function AssetUploader({ assets, onAddAsset }) {
    const [isDragging, setIsDragging] = useState(false)
    const [urlInput, setUrlInput] = useState('')
    const fileInputRef = useRef(null)

    // Handle drag events
    const handleDragOver = (e) => {
        e.preventDefault()
        setIsDragging(true)
    }

    const handleDragLeave = () => {
        setIsDragging(false)
    }

    const handleDrop = (e) => {
        e.preventDefault()
        setIsDragging(false)

        const files = Array.from(e.dataTransfer.files)
        files.forEach(processFile)
    }

    // Process uploaded file
    const processFile = (file) => {
        const reader = new FileReader()
        reader.onload = (e) => {
            onAddAsset(file.name, {
                type: file.type,
                data: e.target.result,
                size: file.size
            })
        }
        reader.readAsDataURL(file)
    }

    // Handle file input change
    const handleFileInput = (e) => {
        const files = Array.from(e.target.files)
        files.forEach(processFile)
    }

    // Handle URL input
    const handleUrlSubmit = async () => {
        if (!urlInput.trim()) return

        try {
            // Extract filename from URL
            const url = new URL(urlInput)
            const filename = url.pathname.split('/').pop() || 'asset'

            onAddAsset(filename, {
                type: 'url',
                data: urlInput,
                size: 0
            })

            setUrlInput('')
        } catch (err) {
            alert('Invalid URL')
        }
    }

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            handleUrlSubmit()
        }
    }

    return (
        <div className="asset-uploader">
            {/* Asset list */}
            {Object.keys(assets).length > 0 && (
                <div className="asset-list">
                    {Object.entries(assets).map(([name, asset]) => (
                        <div key={name} className="asset-item">
                            {asset.type?.startsWith('image') || asset.type === 'url' ? (
                                <img
                                    src={asset.data}
                                    alt={name}
                                    className="asset-item__thumb"
                                />
                            ) : (
                                <div className="asset-item__icon">📎</div>
                            )}
                            <span className="asset-item__name" title={name}>
                                {name.length > 12 ? name.slice(0, 12) + '...' : name}
                            </span>
                        </div>
                    ))}
                </div>
            )}

            {/* Drop zone */}
            <div
                className={`asset-dropzone ${isDragging ? 'asset-dropzone--active' : ''}`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
            >
                <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept="image/*,audio/*,video/*,.json,.txt"
                    onChange={handleFileInput}
                    style={{ display: 'none' }}
                />
                <div className="asset-dropzone__content">
                    <span className="asset-dropzone__icon">📤</span>
                    <span className="asset-dropzone__text">
                        {isDragging ? 'Drop files here!' : 'Drop files or click to upload'}
                    </span>
                </div>
            </div>

            {/* URL input */}
            <div className="asset-url-input">
                <input
                    type="text"
                    className="input"
                    placeholder="Or paste image URL..."
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                />
                <button
                    className="btn btn--primary btn--sm"
                    onClick={handleUrlSubmit}
                    disabled={!urlInput.trim()}
                >
                    Add
                </button>
            </div>
        </div>
    )
}

export default AssetUploader
